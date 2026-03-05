import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, CreditCard as Edit2 } from 'lucide-react';
import { useAppState } from '../App';
import type { Forfait } from '../App';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

const ensureDefaultProject = async (clientId: string): Promise<string | null> => {
  if (!supabaseEnabled) return null;
  const { data } = await supabase
    .schema('timesheet')
    .from('projects')
    .select('id,name,active,created_at')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (data && data.length > 0) return data[0].id as string;
  const { data: created } = await supabase
    .schema('timesheet')
    .from('projects')
    .insert([{ client_id: clientId, name: 'Général', active: true }])
    .select('id')
    .single();
  return created ? (created.id as string) : null;
};

type Entry = {
  id: string;
  project_id: string;
  date: string;
  startTime: string;
  endTime: string;
  isForfait: Forfait;
  caller: string;
  description: string;
  travelUnits: number;
  total: number;
  billingStatus: 'unbilled' | 'pending' | 'archived';
  pendingAt?: string;
  archivedAt?: string;
  isEvent: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const stripSeconds = (t: string) => (t ? t.slice(0, 5) : '00:00');

const mapDbEntry = (row: Record<string, unknown>): Entry => ({
  id: row.id as string,
  project_id: row.project_id as string,
  date: row.work_date as string,
  startTime: row.start_time ? stripSeconds(row.start_time as string) : '00:00',
  endTime: row.end_time ? stripSeconds(row.end_time as string) : '00:00',
  isForfait: (row.is_forfait as Forfait) || 'none',
  caller: (row.caller as string) || '',
  description: (row.description as string) || '',
  travelUnits: (row.travel_units as number) || 0,
  total: parseFloat(String(row.total ?? 0)),
  billingStatus: (row.billing_status as Entry['billingStatus']) || 'unbilled',
  pendingAt: (row.pending_at as string) || undefined,
  archivedAt: (row.archived_at as string) || undefined,
  isEvent: Boolean(row.is_event),
});

const computeTotal = (
  isForfait: Forfait,
  startTime: string,
  endTime: string,
  travelUnits: number,
  rates: { halfHour: number; hour: number; travelHalfHour: number; halfDay: number; fullDay: number }
): number => {
  let base = 0;
  if (isForfait === 'halfDay') {
    base = rates.halfDay;
  } else if (isForfait === 'fullDay') {
    base = rates.fullDay;
  } else {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMinutes > 0) {
      const fullHours = Math.floor(durationMinutes / 60);
      const halfHours = (durationMinutes % 60) / 30;
      base = fullHours * rates.hour + halfHours * rates.halfHour;
    }
  }
  return base + travelUnits * rates.travelHalfHour;
};

const computeMinutes = (isForfait: Forfait, startTime: string, endTime: string): number => {
  if (isForfait === 'halfDay') return 240;
  if (isForfait === 'fullDay') return 480;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};

const emptyForm = () => ({
  date: today(),
  isForfait: 'none' as Forfait,
  startTime: '09:00',
  endTime: '10:00',
  caller: '',
  description: '',
  travelUnits: 0,
  isEvent: false,
});


const TIME_START = 6 * 60;
const TIME_END = 22 * 60;
const TIME_STEP = 30;
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let t = TIME_START; t <= TIME_END; t += TIME_STEP) {
    opts.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${t % 60 === 0 ? '00' : '30'}`);
  }
  return opts;
})();

const fmtDateFR = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatForfait = (f: Forfait) => {
  if (f === 'halfDay') return 'Demi-journée';
  if (f === 'fullDay') return 'Journée';
  return '—';
};

const getCashLevel = (total: number): number | null => {
  if (total < 250) return null;
  if (total < 500) return 1;
  if (total < 1000) return 2;
  if (total < 1500) return 3;
  if (total < 2000) return 4;
  if (total < 3000) return 5;
  return 6;
};

const groupByDate = (entries: Entry[], dateKey: 'pendingAt' | 'archivedAt') => {
  const map: Record<string, Entry[]> = {};
  for (const e of entries) {
    const k = e[dateKey] || 'unknown';
    if (!map[k]) map[k] = [];
    map[k].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
};

type ConfirmDialog = { message: string; onConfirm: () => void } | null;

export const ClientTimesheets = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();

  const client = clients.find(c => c.id === clientId);
  if (!client) return <Navigate to="/" replace />;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [tsForm, setTsForm] = useState(emptyForm());
  const [tsErrors, setTsErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [saving, setSaving] = useState(false);

  const [selectedUnbilled, setSelectedUnbilled] = useState<Set<string>>(new Set());
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(new Set());
  const [pdfToast, setPdfToast] = useState(false);

  useEffect(() => {
    ensureDefaultProject(client.id).then(id => { if (id) setSelectedProjectId(id); });
  }, [client.id]);

  const fetchEntries = useCallback(async () => {
    if (!supabaseEnabled || !selectedProjectId) { setEntries([]); return; }
    setEntriesLoading(true);
    const { data, error } = await supabase
      .schema('timesheet')
      .from('entries')
      .select('id,project_id,work_date,start_time,end_time,minutes,caller,description,travel_units,is_forfait,total,billing_status,pending_at,archived_at,is_event,created_at')
      .eq('project_id', selectedProjectId)
      .order('work_date', { ascending: true })
      .order('created_at', { ascending: true });
    setEntriesLoading(false);
    if (!error) setEntries((data ?? []).map(r => mapDbEntry(r as Record<string, unknown>)));
  }, [selectedProjectId]);

  useEffect(() => { fetchEntries(); setSelectedUnbilled(new Set()); setSelectedPending(new Set()); setSelectedArchived(new Set()); }, [fetchEntries]);

  const unbilledEntries = entries.filter(e => e.billingStatus === 'unbilled');
  const pendingEntries = entries.filter(e => e.billingStatus === 'pending');
  const archivedEntries = entries.filter(e => e.billingStatus === 'archived');

  const fmtTotal = (list: Entry[]) => {
    const sum = list.reduce((acc, e) => acc + e.total, 0);
    return Number.isInteger(sum) ? `${sum} €` : `${sum.toFixed(2)} €`;
  };

  const toggleSelect = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  };

  const toggleAll = (list: Entry[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    setFn(list.every(e => set.has(e.id)) ? new Set() : new Set(list.map(e => e.id)));
  };

  const batchDbUpdate = async (ids: Set<string>, fields: Record<string, unknown>) => {
    if (ids.size === 0) return;
    await supabase
      .schema('timesheet')
      .from('entries')
      .update(fields)
      .in('id', Array.from(ids));
    await fetchEntries();
  };

  const handleExportPending = () => {
    if (selectedUnbilled.size === 0) return;
    setConfirmDialog({
      message: `Exporter ${selectedUnbilled.size} entrée(s) de "${client.name}" vers Pending ?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await batchDbUpdate(selectedUnbilled, { billing_status: 'pending', pending_at: today() });
        setSelectedUnbilled(new Set());
      },
    });
  };

  const handleArchive = () => {
    if (selectedPending.size === 0) return;
    setConfirmDialog({
      message: `Archiver ${selectedPending.size} entrée(s) de "${client.name}" ?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await batchDbUpdate(selectedPending, { billing_status: 'archived', archived_at: today() });
        setSelectedPending(new Set());
      },
    });
  };

  const handlePendingToUnbilled = async () => {
    if (selectedPending.size === 0) return;
    await batchDbUpdate(selectedPending, { billing_status: 'unbilled', pending_at: null });
    setSelectedPending(new Set());
  };

  const handleArchivedToPending = async () => {
    if (selectedArchived.size === 0) return;
    await batchDbUpdate(selectedArchived, { billing_status: 'pending', pending_at: today(), archived_at: null });
    setSelectedArchived(new Set());
  };

  const handleArchivedToUnbilled = async () => {
    if (selectedArchived.size === 0) return;
    await batchDbUpdate(selectedArchived, { billing_status: 'unbilled', pending_at: null, archived_at: null });
    setSelectedArchived(new Set());
  };

  const handleGeneratePdf = () => {
    if (selectedPending.size === 0) { setPdfToast(true); setTimeout(() => setPdfToast(false), 3000); return; }

    const selected = pendingEntries
      .filter(e => selectedPending.has(e.id))
      .sort((a, b) => { const dc = a.date.localeCompare(b.date); return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime); });

    const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y.slice(2)}`; };
    const sortSection = (list: Entry[]) => [...list].sort((a, b) => { const dc = a.date.localeCompare(b.date); return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime); });
    const dates = selected.map(e => e.date).sort();
    const periodFrom = fmtDate(dates[0]);
    const periodTo = fmtDate(dates[dates.length - 1]);
    const now = new Date();
    const exportDateTime = now.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
    const fmtEur = (n: number) => Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;

    const buildCommentaire = (e: Entry): string => {
      const parts: string[] = [];
      if (e.isForfait === 'halfDay') {
        parts.push(`Demi-journée forfait (${fmtEur(client.rates.halfDay)})`);
      } else if (e.isForfait === 'fullDay') {
        parts.push(`Journée forfait (${fmtEur(client.rates.fullDay)})`);
      } else {
        const [sh, sm] = e.startTime.split(':').map(Number);
        const [eh, em] = e.endTime.split(':').map(Number);
        const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
        if (durationMinutes > 0) {
          const fullHours = Math.floor(durationMinutes / 60);
          const halfHours = (durationMinutes % 60) / 30;
          const timeParts: string[] = [];
          if (fullHours > 0) timeParts.push(`${fullHours}h (${fmtEur(fullHours * client.rates.hour)})`);
          if (halfHours > 0) timeParts.push(`0h30 (${fmtEur(halfHours * client.rates.halfHour)})`);
          if (timeParts.length > 0) parts.push(timeParts.join(' + '));
        }
      }
      if (e.travelUnits > 0) {
        const travelCost = e.travelUnits * client.rates.travelHalfHour;
        parts.push(e.travelUnits === 1 ? `1 déplacement (${fmtEur(client.rates.travelHalfHour)})` : `${e.travelUnits} déplacements (${e.travelUnits}×${fmtEur(client.rates.travelHalfHour)}) = ${fmtEur(travelCost)}`);
      }
      return parts.join(' + ') + ` = ${fmtEur(e.total)}`;
    };

    const buildRows = (list: Entry[]) => sortSection(list).map(e => {
      const isForfait = e.isForfait !== 'none';
      const startCell = isForfait ? `<span style="color:#aaa">00:00</span>` : e.startTime;
      const endCell = isForfait ? `<span style="color:#aaa">00:00</span>` : e.endTime;
      return `<tr><td>${fmtDate(e.date)}</td><td>${startCell}</td><td>${endCell}</td><td>${e.caller || '—'}</td><td>${e.description || '—'}</td><td style="text-align:center">${e.travelUnits}</td><td style="text-align:right;font-weight:600">${fmtEur(e.total)}</td><td>${buildCommentaire(e)}</td></tr>`;
    }).join('');

    const buildSectionFooter = (list: Entry[]) => {
      const sTotal = list.reduce((acc, e) => acc + e.total, 0);
      return `<tr class="total-row"><td colspan="7" style="text-align:right;font-weight:700">TOTAL HTVA</td><td style="text-align:right;font-weight:700">${fmtEur(sTotal)}</td></tr>`;
    };

    const theadHtml = `<colgroup><col class="c-date" /><col class="c-start" /><col class="c-end" /><col class="c-caller" /><col class="c-desc" /><col class="c-travel" /><col class="c-total" /><col class="c-comment" /></colgroup><thead><tr><th>Date</th><th>Début</th><th>Fin</th><th>Caller</th><th>Description</th><th style="text-align:center">Déplacement (×30 min)</th><th style="text-align:right">Prix</th><th>Commentaire prix</th></tr></thead>`;

    const interventions = selected.filter(e => !e.isEvent);
    const events = selected.filter(e => e.isEvent);
    const globalTotal = selected.reduce((acc, e) => acc + e.total, 0);

    const interventionsBlock = interventions.length > 0 ? `<h2 class="section-title">Interventions</h2><table>${theadHtml}<tbody>${buildRows(interventions)}</tbody><tfoot>${buildSectionFooter(interventions)}</tfoot></table>` : '';
    const eventsBlock = events.length > 0 ? `<h2 class="section-title">Événements</h2><table>${theadHtml}<tbody>${buildRows(events)}</tbody><tfoot>${buildSectionFooter(events)}</tfoot></table>` : '';
    const globalBlock = (interventions.length > 0 && events.length > 0) ? `<table class="global-total-table"><tbody><tr class="total-row"><td style="text-align:right">TOTAL HTVA GLOBAL</td><td style="text-align:right;width:90px">${fmtEur(globalTotal)}</td></tr></tbody></table>` : '';
    const logoHtml = client.logoUrl ? `<img src="${client.logoUrl}" alt="${client.name}" style="max-height:56px;max-width:140px;object-fit:contain" />` : '';

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Timesheets — ${client.name}</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, sans-serif; font-size: 10px; color: #111; background: #fff; padding: 20px; } header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; } header .left { display: flex; align-items: center; gap: 12px; } h1 { font-size: 15px; font-weight: 700; } .meta { font-size: 9px; color: #555; margin-top: 2px; } .period { font-size: 10px; font-weight: 600; margin-bottom: 10px; } .section-title { font-size: 11px; font-weight: 700; margin: 16px 0 4px; border-left: 3px solid #111; padding-left: 7px; } table { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; border: 2px solid #111; } thead tr { background: #e8e8e8; } th { padding: 4px 5px; text-align: left; font-weight: 700; font-size: 9px; border: 1px solid #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; } td { padding: 4px 5px; border: 1px solid #111; font-size: 10px; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; } th:nth-child(1), td:nth-child(1), th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3), th:nth-child(6), td:nth-child(6), th:nth-child(7), td:nth-child(7) { white-space: nowrap !important; word-break: normal !important; overflow-wrap: normal !important; overflow: hidden; text-overflow: ellipsis; } tr:nth-child(even) td { background: #f5f5f5; } col.c-date { width: 8%; } col.c-start { width: 7%; } col.c-end { width: 7%; } col.c-caller { width: 10%; } col.c-desc { width: 18%; } col.c-travel { width: 6%; } col.c-total { width: 7%; } col.c-comment { width: 37%; } tfoot td { border: none; padding: 0; } .total-row td { background: #222; color: #fff; font-weight: 700; font-size: 11px; padding: 5px 7px; border: none; } .global-total-table { width: auto; margin-left: auto; margin-top: 14px; border-collapse: collapse; border: none; } .global-total-table .total-row td { background: #111; color: #fff; font-weight: 700; font-size: 12px; padding: 6px 10px; border: none; } @media print { body { padding: 10px; } }</style></head><body><header><div class="left">${logoHtml}<div><h1>${client.name}</h1><div class="meta">Timesheets — Export pour facturation</div></div></div><div style="text-align:right"><div class="meta">Exporté le ${exportDateTime}</div></div></header><div class="period">Période : ${periodFrom} → ${periodTo}</div>${interventionsBlock}${eventsBlock}${globalBlock}</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!tsForm.date) errors.date = 'La date est requise';
    if (tsForm.isForfait === 'none') {
      if (!tsForm.startTime) errors.startTime = 'Requis';
      if (!tsForm.endTime) errors.endTime = 'Requis';
      if (tsForm.startTime && tsForm.endTime) {
        const [sh, sm] = tsForm.startTime.split(':').map(Number);
        const [eh, em] = tsForm.endTime.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) errors.endTime = 'Fin doit être après début';
      }
    }
    setTsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openNew = () => {
    setEditingEntry(null);
    setTsForm(emptyForm());
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const openEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setTsForm({
      date: entry.date,
      isForfait: entry.isForfait,
      startTime: entry.startTime,
      endTime: entry.endTime,
      caller: entry.caller,
      description: entry.description,
      travelUnits: entry.travelUnits,
      isEvent: entry.isEvent,
    });
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedProjectId) return;
    setSaving(true);

    const startTime = tsForm.isForfait !== 'none' ? null : tsForm.startTime;
    const endTime = tsForm.isForfait !== 'none' ? null : tsForm.endTime;
    const effectiveStart = startTime ?? '00:00';
    const effectiveEnd = endTime ?? '00:00';
    const total = computeTotal(tsForm.isForfait, effectiveStart, effectiveEnd, tsForm.travelUnits, client.rates);
    const minutes = computeMinutes(tsForm.isForfait, effectiveStart, effectiveEnd);

    if (editingEntry) {
      const wasArchived = editingEntry.billingStatus === 'archived';
      const fields: Record<string, unknown> = {
        work_date: tsForm.date,
        start_time: startTime,
        end_time: endTime,
        minutes,
        caller: tsForm.caller,
        description: tsForm.description,
        travel_units: tsForm.travelUnits,
        is_forfait: tsForm.isForfait,
        total,
        is_event: tsForm.isEvent,
      };
      if (wasArchived) {
        fields.billing_status = 'pending';
        fields.pending_at = today();
        fields.archived_at = null;
      }
      await supabase.schema('timesheet').from('entries').update(fields).eq('id', editingEntry.id);
    } else {
      await supabase.schema('timesheet').from('entries').insert([{
        project_id: selectedProjectId,
        work_date: tsForm.date,
        start_time: startTime,
        end_time: endTime,
        minutes,
        caller: tsForm.caller,
        description: tsForm.description,
        travel_units: tsForm.travelUnits,
        is_forfait: tsForm.isForfait,
        total,
        billing_status: 'unbilled',
        is_event: tsForm.isEvent,
      }]);
    }

    setSaving(false);
    await fetchEntries();
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    setSaving(true);
    await supabase.schema('timesheet').from('entries').delete().eq('id', editingEntry.id);
    setSaving(false);
    await fetchEntries();
    setIsModalOpen(false);
  };

  const liveTotal = computeTotal(
    tsForm.isForfait,
    tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime,
    tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime,
    tsForm.travelUnits,
    client.rates
  );

  const colHeaders = (checkboxEl: React.ReactNode) => (
    <tr>
      <th className="px-2 py-2 w-7">{checkboxEl}</th>
      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Date</th>
      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Début</th>
      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Fin</th>
      <th className="px-2 py-2 text-left font-semibold text-gray-700">Appelant</th>
      <th className="px-2 py-2 text-left font-semibold text-gray-700 w-[28%]">Description</th>
      <th className="px-2 py-2 text-center font-semibold text-gray-700 whitespace-nowrap">Déplt.</th>
      <th className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Total (HTVA)</th>
      <th className="px-2 py-2 w-9" />
    </tr>
  );

  const renderRow = (entry: Entry, checked: boolean, onCheck: () => void, editLabel?: string) => (
    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-2 py-2 text-center">
        <input type="checkbox" checked={checked} onChange={onCheck} className="accent-blue-600 w-4 h-4 cursor-pointer" />
      </td>
      <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {entry.date}
          {entry.isEvent && <span className="inline-block px-1 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded">Év.</span>}
        </div>
      </td>
      <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{entry.isForfait !== 'none' ? formatForfait(entry.isForfait) : entry.startTime}</td>
      <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">{entry.isForfait !== 'none' ? '—' : entry.endTime}</td>
      <td className="px-2 py-2 text-xs text-gray-600 whitespace-normal break-words">{entry.caller || '—'}</td>
      <td className="px-2 py-2 text-xs text-gray-600 whitespace-normal break-words">{entry.description || '—'}</td>
      <td className="px-2 py-2 text-xs text-gray-600 text-center whitespace-nowrap">{entry.travelUnits}</td>
      <td className="px-2 py-2 text-xs text-gray-900 font-semibold text-right whitespace-nowrap">{entry.total} €</td>
      <td className="px-2 py-2">
        <button onClick={() => openEdit(entry)} title={editLabel ?? 'Éditer'} className="flex items-center justify-center p-1.5 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
          <Edit2 size={12} />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors text-sm font-medium">
            <ArrowLeft size={16} />
            Retour
          </button>
          <img src="/images/ui/logo-clear-computing.png" alt="Clear_Computing" className="h-8 w-auto" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {client.logoUrl && (
              <img
                src={client.logoUrl}
                alt={client.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="h-9 w-9 object-contain rounded flex-shrink-0"
              />
            )}
            <h1 className="text-3xl font-bold text-gray-900 truncate">Timesheets — {client.name}</h1>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {(() => {
              const unbilledTotal = unbilledEntries.reduce((acc, e) => acc + e.total, 0);
              const level = getCashLevel(unbilledTotal);
              return level ? (
                <img
                  src={`/images/ui/cash-${level}.png`}
                  alt={`Niveau ${level}`}
                  className="block w-[120px] sm:w-[170px] h-auto select-none object-contain"
                />
              ) : null;
            })()}
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus size={18} />
              Nouveau timesheet
            </button>
          </div>
        </div>

        {(!supabaseEnabled || selectedProjectId) && (
          <>
            {entriesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Chargement des entrées…
              </div>
            )}

            {/* Section A: Unbilled */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-800">Pas encore facturé</h2>
                  {unbilledEntries.length > 0 && <span className="text-sm font-medium text-gray-500">Total: {fmtTotal(unbilledEntries)}</span>}
                </div>
                <button
                  onClick={handleExportPending}
                  disabled={selectedUnbilled.size === 0}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
                >
                  Exporter pour la facturation ({selectedUnbilled.size})
                </button>
              </div>
              {unbilledEntries.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                  <p className="text-gray-500 text-sm">Aucune entrée non facturée.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      {colHeaders(<input type="checkbox" checked={unbilledEntries.length > 0 && unbilledEntries.every(e => selectedUnbilled.has(e.id))} onChange={() => toggleAll(unbilledEntries, selectedUnbilled, setSelectedUnbilled)} className="accent-blue-600 w-4 h-4 cursor-pointer" />)}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {unbilledEntries.map(entry => renderRow(entry, selectedUnbilled.has(entry.id), () => toggleSelect(selectedUnbilled, setSelectedUnbilled, entry.id)))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Section B: Pending */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-800">Pending</h2>
                  {pendingEntries.length > 0 && <span className="text-sm font-medium text-gray-500">Total: {fmtTotal(pendingEntries)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePendingToUnbilled} disabled={selectedPending.size === 0} className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors">
                    Remettre en non facturé ({selectedPending.size})
                  </button>
                  <button onClick={handleGeneratePdf} disabled={selectedPending.size === 0} className="px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors">
                    Générer PDF ({selectedPending.size})
                  </button>
                  <button onClick={handleArchive} disabled={selectedPending.size === 0} className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors">
                    Archiver ({selectedPending.size})
                  </button>
                </div>
              </div>
              {pendingEntries.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                  <p className="text-gray-500 text-sm">Aucune entrée en pending.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      {colHeaders(<input type="checkbox" checked={pendingEntries.length > 0 && pendingEntries.every(e => selectedPending.has(e.id))} onChange={() => toggleAll(pendingEntries, selectedPending, setSelectedPending)} className="accent-blue-600 w-4 h-4 cursor-pointer" />)}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupByDate(pendingEntries, 'pendingAt').map(([date, group]) => (
                        <>
                          <tr key={`divider-${date}`}>
                            <td colSpan={10} className="px-4 py-2 bg-blue-50 text-xs font-medium text-blue-700 border-y border-blue-100">Mis en pending le {date}</td>
                          </tr>
                          {group.map(entry => renderRow(entry, selectedPending.has(entry.id), () => toggleSelect(selectedPending, setSelectedPending, entry.id)))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Section C: Archived */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Archivé</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleArchivedToUnbilled} disabled={selectedArchived.size === 0} className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors">
                    Remettre en non facturé ({selectedArchived.size})
                  </button>
                  <button onClick={handleArchivedToPending} disabled={selectedArchived.size === 0} className="px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors">
                    Remettre en pending ({selectedArchived.size})
                  </button>
                </div>
              </div>
              {archivedEntries.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                  <p className="text-gray-500 text-sm">Aucune entrée archivée.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      {colHeaders(<input type="checkbox" checked={archivedEntries.length > 0 && archivedEntries.every(e => selectedArchived.has(e.id))} onChange={() => toggleAll(archivedEntries, selectedArchived, setSelectedArchived)} className="accent-blue-600 w-4 h-4 cursor-pointer" />)}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupByDate(archivedEntries, 'archivedAt').map(([date, group]) => (
                        <>
                          <tr key={`divider-${date}`}>
                            <td colSpan={10} className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 border-y border-gray-200">Archivé le {date}</td>
                          </tr>
                          {group.map(entry => renderRow(entry, selectedArchived.has(entry.id), () => toggleSelect(selectedArchived, setSelectedArchived, entry.id), 'Éditer (→ Pending)'))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {pdfToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          Sélectionne au moins une ligne
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <p className="text-gray-800 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center md:p-4 z-50">
          <div className="bg-white rounded-t-2xl md:rounded-xl shadow-2xl w-full md:max-w-lg max-h-[92vh] md:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingEntry ? 'Modifier le timesheet' : 'Nouveau timesheet'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 transition-colors"><X size={20} /></button>
            </div>

            {editingEntry?.billingStatus === 'archived' && (
              <div className="mx-5 mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Cette entrée est archivée. Toute modification la remettra automatiquement en <strong>Pending</strong>.
              </div>
            )}

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                <input
                  type="date"
                  value={tsForm.date}
                  onChange={(e) => setTsForm({ ...tsForm, date: e.target.value })}
                  className={`w-full px-3 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                />
                {tsForm.date && <p className="text-xs text-gray-400 mt-1">{fmtDateFR(tsForm.date)}</p>}
                {tsErrors.date && <p className="text-xs text-red-600 mt-1">{tsErrors.date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Forfait</label>
                <select
                  value={tsForm.isForfait}
                  onChange={(e) => setTsForm({ ...tsForm, isForfait: e.target.value as Forfait })}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">Aucun (heures)</option>
                  <option value="halfDay">Demi-journée</option>
                  <option value="fullDay">Journée complète</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['startTime', 'endTime'] as const).map((field) => {
                  const label = field === 'startTime' ? 'Début *' : 'Fin *';
                  const disabled = tsForm.isForfait !== 'none';
                  const err = tsErrors[field];
                  return (
                    <div key={field}>
                      <label className={`block text-sm font-medium mb-1.5 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</label>
                      {disabled ? (
                        <div className="w-full px-3 py-3 text-base border border-gray-200 rounded-lg bg-gray-100 text-gray-400">—</div>
                      ) : (
                        <select
                          value={TIME_OPTIONS.includes(tsForm[field]) ? tsForm[field] : TIME_OPTIONS[0]}
                          onChange={(e) => setTsForm({ ...tsForm, [field]: e.target.value })}
                          className={`w-full px-3 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      )}
                      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Appelant</label>
                <input
                  type="text"
                  value={tsForm.caller}
                  onChange={(e) => setTsForm({ ...tsForm, caller: e.target.value })}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'appelant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={tsForm.description}
                  onChange={(e) => setTsForm({ ...tsForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Description de l'intervention"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Déplacement (×30 min)
                  </label>
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    {tsForm.travelUnits}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={tsForm.travelUnits}
                  onChange={(e) => setTsForm({ ...tsForm, travelUnits: parseInt(e.target.value) })}
                  className="w-full h-3 accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {[0,1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id="isEvent"
                  checked={tsForm.isEvent}
                  onChange={(e) => setTsForm({ ...tsForm, isEvent: e.target.checked })}
                  className="accent-amber-500 w-5 h-5 cursor-pointer"
                />
                <label htmlFor="isEvent" className="text-sm font-medium text-gray-700 cursor-pointer select-none">Événement</label>
              </div>

              <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total estimé (HTVA)</span>
                <span className="text-lg font-bold text-blue-900">{liveTotal} €</span>
              </div>

              {editingEntry ? (
                <div className="flex flex-col md:flex-row gap-3 pt-2 pb-2">
                  {deleteConfirm ? (
                    <>
                      <button type="button" onClick={handleDelete} disabled={saving} className="flex-1 min-h-[48px] px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
                        Confirmer suppression
                      </button>
                      <button type="button" onClick={() => setDeleteConfirm(false)} className="min-h-[48px] px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setDeleteConfirm(true)} className="min-h-[48px] px-4 py-3 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors">Supprimer</button>
                      <button type="submit" disabled={saving} className="flex-1 min-h-[48px] px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-3 pt-2 pb-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 min-h-[48px] px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
                  <button type="submit" disabled={saving} className="flex-1 min-h-[48px] px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
                    {saving ? 'Création…' : 'Créer'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

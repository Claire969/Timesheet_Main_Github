import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2 } from 'lucide-react';
import { useAppState } from '../App';
import type { Forfait, TimesheetEntry } from '../App';

const today = () => new Date().toISOString().slice(0, 10);

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

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m === 30 ? 30 : 0 };
};

const buildTime = (h: number, m: number) =>
  `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${m === 30 ? '30' : '00'}`;

const formatForfait = (f: Forfait) => {
  if (f === 'halfDay') return 'Demi-journée';
  if (f === 'fullDay') return 'Journée';
  return '—';
};

const groupByDate = (entries: TimesheetEntry[], dateKey: 'pendingAt' | 'archivedAt') => {
  const map: Record<string, TimesheetEntry[]> = {};
  for (const e of entries) {
    const k = e[dateKey] || 'unknown';
    if (!map[k]) map[k] = [];
    map[k].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
};

type ConfirmDialog = {
  message: string;
  onConfirm: () => void;
} | null;

export const ClientTimesheets = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients, clientTimesheets, setClientTimesheets } = useAppState();

  const client = clients.find(c => c.id === clientId);
  if (!client) return <Navigate to="/" replace />;

  const entries: TimesheetEntry[] = clientTimesheets[client.id] || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [tsForm, setTsForm] = useState(emptyForm());
  const [tsErrors, setTsErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const [selectedUnbilled, setSelectedUnbilled] = useState<Set<string>>(new Set());
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(new Set());

  const unbilledEntries = entries.filter(e => e.billingStatus === 'unbilled');
  const pendingEntries = entries.filter(e => e.billingStatus === 'pending');
  const archivedEntries = entries.filter(e => e.billingStatus === 'archived');

  const fmtTotal = (list: TimesheetEntry[]) => {
    const sum = list.reduce((acc, e) => acc + e.total, 0);
    return Number.isInteger(sum) ? `${sum} €` : `${sum.toFixed(2)} €`;
  };

  const toggleSelect = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  };

  const toggleAll = (list: TimesheetEntry[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    if (list.every(e => set.has(e.id))) {
      setFn(new Set());
    } else {
      setFn(new Set(list.map(e => e.id)));
    }
  };

  const batchUpdate = (ids: Set<string>, updater: (e: TimesheetEntry) => TimesheetEntry) => {
    setClientTimesheets(prev => ({
      ...prev,
      [client.id]: (prev[client.id] || []).map(e => ids.has(e.id) ? updater(e) : e),
    }));
  };

  const handleExportPending = () => {
    if (selectedUnbilled.size === 0) return;
    setConfirmDialog({
      message: `Exporter ${selectedUnbilled.size} entrée(s) de "${client.name}" vers Pending ?`,
      onConfirm: () => {
        const t = today();
        batchUpdate(selectedUnbilled, e => ({ ...e, billingStatus: 'pending', pendingAt: t }));
        setSelectedUnbilled(new Set());
        setConfirmDialog(null);
      },
    });
  };

  const handleArchive = () => {
    if (selectedPending.size === 0) return;
    setConfirmDialog({
      message: `Archiver ${selectedPending.size} entrée(s) de "${client.name}" ?`,
      onConfirm: () => {
        const t = today();
        batchUpdate(selectedPending, e => ({ ...e, billingStatus: 'archived', archivedAt: t }));
        setSelectedPending(new Set());
        setConfirmDialog(null);
      },
    });
  };

  const handlePendingToUnbilled = () => {
    if (selectedPending.size === 0) return;
    batchUpdate(selectedPending, e => {
      const { pendingAt: _p, ...rest } = e;
      return { ...rest, billingStatus: 'unbilled' };
    });
    setSelectedPending(new Set());
  };

  const handleArchivedToPending = () => {
    if (selectedArchived.size === 0) return;
    const t = today();
    batchUpdate(selectedArchived, e => {
      const { archivedAt: _a, ...rest } = e;
      return { ...rest, billingStatus: 'pending', pendingAt: t };
    });
    setSelectedArchived(new Set());
  };

  const handleArchivedToUnbilled = () => {
    if (selectedArchived.size === 0) return;
    batchUpdate(selectedArchived, e => {
      const { pendingAt: _p, archivedAt: _a, ...rest } = e;
      return { ...rest, billingStatus: 'unbilled' };
    });
    setSelectedArchived(new Set());
  };

  const [pdfToast, setPdfToast] = useState(false);

  const handleGeneratePdf = () => {
    if (selectedPending.size === 0) {
      setPdfToast(true);
      setTimeout(() => setPdfToast(false), 3000);
      return;
    }

    const selected = pendingEntries
      .filter(e => selectedPending.has(e.id))
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        return dateCmp !== 0 ? dateCmp : a.startTime.localeCompare(b.startTime);
      });

    const fmtDate = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}-${m}-${y.slice(2)}`;
    };

    const sortSection = (list: TimesheetEntry[]) =>
      [...list].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
      });

    const dates = selected.map(e => e.date).sort();
    const periodFrom = fmtDate(dates[0]);
    const periodTo = fmtDate(dates[dates.length - 1]);

    const now = new Date();
    const exportDateTime = now.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });

    const fmtEur = (n: number) => Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;

    const buildCommentaire = (e: TimesheetEntry): string => {
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
        if (e.travelUnits === 1) {
          parts.push(`1 déplacement (${fmtEur(client.rates.travelHalfHour)})`);
        } else {
          parts.push(`${e.travelUnits} déplacements (${e.travelUnits}×${fmtEur(client.rates.travelHalfHour)}) = ${fmtEur(travelCost)}`);
        }
      }
      return parts.join(' + ') + ` = ${fmtEur(e.total)}`;
    };

    const buildRows = (list: TimesheetEntry[]) => sortSection(list).map(e => {
      const isForfait = e.isForfait !== 'none';
      const startCell = isForfait ? `<span style="color:#aaa">00:00</span>` : e.startTime;
      const endCell = isForfait ? `<span style="color:#aaa">00:00</span>` : e.endTime;
      const commentaire = buildCommentaire(e);
      return `
        <tr>
          <td>${fmtDate(e.date)}</td>
          <td>${startCell}</td>
          <td>${endCell}</td>
          <td>${e.caller || '—'}</td>
          <td>${e.description || '—'}</td>
          <td style="text-align:center">${e.travelUnits}</td>
          <td style="text-align:right;font-weight:600">${fmtEur(e.total)}</td>
          <td>${commentaire}</td>
        </tr>`;
    }).join('');

    const buildSectionFooter = (list: TimesheetEntry[]) => {
      const sTotal = list.reduce((acc, e) => acc + e.total, 0);
      return `
    <tr class="total-row">
      <td colspan="7" style="text-align:right;font-weight:700">TOTAL HTVA</td>
      <td style="text-align:right;font-weight:700">${fmtEur(sTotal)}</td>
    </tr>`;
    };

    const theadHtml = `
  <colgroup>
    <col class="c-date" /><col class="c-start" /><col class="c-end" /><col class="c-caller" /><col class="c-desc" /><col class="c-travel" /><col class="c-total" /><col class="c-comment" />
  </colgroup>
  <thead>
    <tr>
      <th>Date</th>
      <th>Début</th>
      <th>Fin</th>
      <th>Caller</th>
      <th>Description</th>
      <th style="text-align:center">Déplacement (×30 min)</th>
      <th style="text-align:right">Prix</th>
      <th>Commentaire prix</th>
    </tr>
  </thead>`;

    const interventions = selected.filter(e => !e.isEvent);
    const events = selected.filter(e => e.isEvent);
    const globalTotal = selected.reduce((acc, e) => acc + e.total, 0);

    const interventionsBlock = interventions.length > 0 ? `
<h2 class="section-title">Interventions</h2>
<table>${theadHtml}
  <tbody>${buildRows(interventions)}</tbody>
  <tfoot>${buildSectionFooter(interventions)}</tfoot>
</table>` : '';

    const eventsBlock = events.length > 0 ? `
<h2 class="section-title">Événements</h2>
<table>${theadHtml}
  <tbody>${buildRows(events)}</tbody>
  <tfoot>${buildSectionFooter(events)}</tfoot>
</table>` : '';

    const globalBlock = (interventions.length > 0 && events.length > 0) ? `
<table class="global-total-table">
  <tbody>
    <tr class="total-row">
      <td style="text-align:right">TOTAL HTVA GLOBAL</td>
      <td style="text-align:right;width:90px">${fmtEur(globalTotal)}</td>
    </tr>
  </tbody>
</table>` : '';

    const logoHtml = client.logoUrl
      ? `<img src="${client.logoUrl}" alt="${client.name}" style="max-height:56px;max-width:140px;object-fit:contain" />`
      : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Timesheets — ${client.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Arial, sans-serif;
    font-size: 10px;
    color: #111;
    background: #fff;
    padding: 20px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
  }

  header .left { display: flex; align-items: center; gap: 12px; }

  h1 { font-size: 15px; font-weight: 700; }

  .meta { font-size: 9px; color: #555; margin-top: 2px; }

  .period { font-size: 10px; font-weight: 600; margin-bottom: 10px; }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    margin: 16px 0 4px;
    border-left: 3px solid #111;
    padding-left: 7px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    table-layout: fixed;
    border: 2px solid #111; /* contour plus lisible */
  }

  thead tr { background: #e8e8e8; }

  th {
    padding: 4px 5px;
    text-align: left;
    font-weight: 700;
    font-size: 9px;
    border: 1px solid #111;   /* traits noirs */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  td {
    padding: 4px 5px;
    border: 1px solid #111;   /* traits noirs */
    font-size: 10px;
    vertical-align: middle;   /* centré verticalement */
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* Empêche les retours à la ligne dans les petites colonnes */
  th:nth-child(1), td:nth-child(1),
  th:nth-child(2), td:nth-child(2),
  th:nth-child(3), td:nth-child(3),
  th:nth-child(6), td:nth-child(6),
  th:nth-child(7), td:nth-child(7) {
    white-space: nowrap !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  tr:nth-child(even) td { background: #f5f5f5; }

  /* Largeurs colonnes */
  col.c-date    { width: 8%; }
  col.c-start   { width: 7%; }  /* au lieu de 5% */
  col.c-end     { width: 7%; }  /* au lieu de 5% */
  col.c-caller  { width: 10%; }
  col.c-desc    { width: 22%; } /* ajusté */
  col.c-travel  { width: 6%; }
  col.c-total   { width: 7%; }
  col.c-comment { width: 33%; }
  
  /* Footer totals */
  tfoot td { border: none; padding: 0; }

  .total-row td {
    background: #222;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    padding: 5px 7px;
    border: none;
  }

  .global-total-table {
    width: auto;
    margin-left: auto;
    margin-top: 14px;
    border-collapse: collapse;
    border: none;
  }

  .global-total-table .total-row td {
    background: #111;
    color: #fff;
    font-weight: 700;
    font-size: 12px;
    padding: 6px 10px;
    border: none;
  }

  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<header>
  <div class="left">
    ${logoHtml}
    <div>
      <h1>${client.name}</h1>
      <div class="meta">Timesheets — Export pour facturation</div>
    </div>
  </div>
  <div style="text-align:right">
    <div class="meta">Exporté le ${exportDateTime}</div>
  </div>
</header>
<div class="period">Période : ${periodFrom} → ${periodTo}</div>
${interventionsBlock}
${eventsBlock}
${globalBlock}
</body>
</html>`;

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
    setEditingEntryId(null);
    setTsForm(emptyForm());
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const openEdit = (entry: TimesheetEntry) => {
    setEditingEntryId(entry.id);
    setTsForm({
      date: entry.date,
      isForfait: entry.isForfait,
      startTime: entry.startTime,
      endTime: entry.endTime,
      caller: entry.caller,
      description: entry.description,
      travelUnits: entry.travelUnits,
      isEvent: entry.isEvent ?? false,
    });
    setTsErrors({});
    setDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const startTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.startTime;
    const endTime = tsForm.isForfait !== 'none' ? '00:00' : tsForm.endTime;
    const total = computeTotal(tsForm.isForfait, startTime, endTime, tsForm.travelUnits, client.rates);

    if (editingEntryId) {
      setClientTimesheets(prev => ({
        ...prev,
        [client.id]: (prev[client.id] || []).map(e => {
          if (e.id !== editingEntryId) return e;
          const wasArchived = e.billingStatus === 'archived';
          const updated: TimesheetEntry = {
            ...e,
            date: tsForm.date,
            startTime,
            endTime,
            isForfait: tsForm.isForfait,
            caller: tsForm.caller,
            description: tsForm.description,
            travelUnits: tsForm.travelUnits,
            total,
            isEvent: tsForm.isEvent,
          };
          if (wasArchived) {
            const { archivedAt: _a, ...rest } = updated;
            return { ...rest, billingStatus: 'pending', pendingAt: today() };
          }
          return updated;
        }),
      }));
    } else {
      const newEntry: TimesheetEntry = {
        id: Date.now().toString(),
        date: tsForm.date,
        startTime,
        endTime,
        isForfait: tsForm.isForfait,
        caller: tsForm.caller,
        description: tsForm.description,
        travelUnits: tsForm.travelUnits,
        total,
        isEvent: tsForm.isEvent,
        billingStatus: 'unbilled',
      };
      setClientTimesheets(prev => ({
        ...prev,
        [client.id]: [newEntry, ...(prev[client.id] || [])],
      }));
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (!editingEntryId) return;
    setClientTimesheets(prev => ({
      ...prev,
      [client.id]: (prev[client.id] || []).filter(e => e.id !== editingEntryId),
    }));
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
      <th className="px-3 py-3 w-8">{checkboxEl}</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Début</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Fin</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Appelant</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
      <th className="px-4 py-3 text-center font-semibold text-gray-700">Déplacement</th>
      <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
      <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (HTVA)</th>
      <th className="px-4 py-3" />
    </tr>
  );

  const renderRow = (
    entry: TimesheetEntry,
    checked: boolean,
    onCheck: () => void,
    editLabel?: string
  ) => (
    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="accent-blue-600 w-4 h-4 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {entry.date}
          {entry.isEvent && (
            <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
              Événement
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {entry.isForfait !== 'none' ? formatForfait(entry.isForfait) : entry.startTime}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {entry.isForfait !== 'none' ? '—' : entry.endTime}
      </td>
      <td className="px-4 py-3 text-gray-600">{entry.caller || '—'}</td>
      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.description || '—'}</td>
      <td className="px-4 py-3 text-gray-600 text-center">{entry.travelUnits}</td>
      <td className="px-4 py-3 text-gray-600">{client.name}</td>
      <td className="px-4 py-3 text-gray-900 font-semibold text-right whitespace-nowrap">{entry.total} €</td>
      <td className="px-4 py-3">
        <button
          onClick={() => openEdit(entry)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          <Edit2 size={12} />
          {editLabel ?? 'Éditer'}
        </button>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <div className="text-sm text-gray-500">Clear_Computing</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Timesheets — {client.name}</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus size={18} />
            Nouveau timesheet
          </button>
        </div>

        {/* Section A: Unbilled */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">Pas encore facturé</h2>
              {unbilledEntries.length > 0 && (
                <span className="text-sm font-medium text-gray-500">Total: {fmtTotal(unbilledEntries)}</span>
              )}
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
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {colHeaders(
                    <input
                      type="checkbox"
                      checked={unbilledEntries.length > 0 && unbilledEntries.every(e => selectedUnbilled.has(e.id))}
                      onChange={() => toggleAll(unbilledEntries, selectedUnbilled, setSelectedUnbilled)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  )}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unbilledEntries.map(entry =>
                    renderRow(
                      entry,
                      selectedUnbilled.has(entry.id),
                      () => toggleSelect(selectedUnbilled, setSelectedUnbilled, entry.id)
                    )
                  )}
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
              {pendingEntries.length > 0 && (
                <span className="text-sm font-medium text-gray-500">Total: {fmtTotal(pendingEntries)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePendingToUnbilled}
                disabled={selectedPending.size === 0}
                className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors"
              >
                Remettre en non facturé ({selectedPending.size})
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={selectedPending.size === 0}
                className="px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors"
              >
                Générer PDF ({selectedPending.size})
              </button>
              <button
                onClick={handleArchive}
                disabled={selectedPending.size === 0}
                className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg transition-colors"
              >
                Archiver ({selectedPending.size})
              </button>
            </div>
          </div>
          {pendingEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500 text-sm">Aucune entrée en pending.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {colHeaders(
                    <input
                      type="checkbox"
                      checked={pendingEntries.length > 0 && pendingEntries.every(e => selectedPending.has(e.id))}
                      onChange={() => toggleAll(pendingEntries, selectedPending, setSelectedPending)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  )}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupByDate(pendingEntries, 'pendingAt').map(([date, group]) => (
                    <>
                      <tr key={`divider-${date}`}>
                        <td colSpan={10} className="px-4 py-2 bg-blue-50 text-xs font-medium text-blue-700 border-y border-blue-100">
                          Mis en pending le {date}
                        </td>
                      </tr>
                      {group.map(entry =>
                        renderRow(
                          entry,
                          selectedPending.has(entry.id),
                          () => toggleSelect(selectedPending, setSelectedPending, entry.id)
                        )
                      )}
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
              <button
                onClick={handleArchivedToUnbilled}
                disabled={selectedArchived.size === 0}
                className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors"
              >
                Remettre en non facturé ({selectedArchived.size})
              </button>
              <button
                onClick={handleArchivedToPending}
                disabled={selectedArchived.size === 0}
                className="px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors"
              >
                Remettre en pending ({selectedArchived.size})
              </button>
            </div>
          </div>
          {archivedEntries.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500 text-sm">Aucune entrée archivée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {colHeaders(
                    <input
                      type="checkbox"
                      checked={archivedEntries.length > 0 && archivedEntries.every(e => selectedArchived.has(e.id))}
                      onChange={() => toggleAll(archivedEntries, selectedArchived, setSelectedArchived)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  )}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupByDate(archivedEntries, 'archivedAt').map(([date, group]) => (
                    <>
                      <tr key={`divider-${date}`}>
                        <td colSpan={10} className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 border-y border-gray-200">
                          Archivé le {date}
                        </td>
                      </tr>
                      {group.map(entry =>
                        renderRow(
                          entry,
                          selectedArchived.has(entry.id),
                          () => toggleSelect(selectedArchived, setSelectedArchived, entry.id),
                          'Éditer (→ Pending)'
                        )
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntryId ? 'Modifier le timesheet' : 'Nouveau timesheet'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            {editingEntryId && entries.find(e => e.id === editingEntryId)?.billingStatus === 'archived' && (
              <div className="mx-5 mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Cette entrée est archivée. Toute modification la remettra automatiquement en <strong>Pending</strong>.
              </div>
            )}

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                <input
                  type="date"
                  value={tsForm.date}
                  onChange={(e) => setTsForm({ ...tsForm, date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tsErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                />
                {tsErrors.date && <p className="text-xs text-red-600 mt-1">{tsErrors.date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Forfait</label>
                <select
                  value={tsForm.isForfait}
                  onChange={(e) => setTsForm({ ...tsForm, isForfait: e.target.value as Forfait })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">Aucun (heures)</option>
                  <option value="halfDay">Demi-journée</option>
                  <option value="fullDay">Journée complète</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(['startTime', 'endTime'] as const).map((field) => {
                  const label = field === 'startTime' ? 'Début *' : 'Fin *';
                  const disabled = tsForm.isForfait !== 'none';
                  const timeVal = disabled ? '00:00' : tsForm[field];
                  const { h, m } = parseTime(timeVal);
                  const err = tsErrors[field];
                  return (
                    <div key={field}>
                      <label className={`block text-sm font-medium mb-1.5 ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                        {label}
                      </label>
                      <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${disabled ? 'bg-gray-100 border-gray-200' : err ? 'border-red-500 bg-white' : 'border-gray-300 bg-white'}`}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={23}
                          value={disabled ? 0 : h}
                          disabled={disabled}
                          onChange={(e) => {
                            const val = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                            setTsForm({ ...tsForm, [field]: buildTime(val, m) });
                          }}
                          className={`w-12 text-center text-sm font-mono border-0 focus:outline-none focus:ring-0 p-0 bg-transparent ${disabled ? 'text-gray-400' : 'text-gray-900'}`}
                        />
                        <span className={`text-sm font-mono ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>h</span>
                        <div className="flex rounded overflow-hidden border border-gray-200 ml-1">
                          {(['00', '30'] as const).map((min) => {
                            const active = !disabled && String(m) === min;
                            return (
                              <button
                                key={min}
                                type="button"
                                disabled={disabled}
                                onClick={() => setTsForm({ ...tsForm, [field]: buildTime(h, parseInt(min)) })}
                                className={`px-2 py-0.5 text-xs font-medium transition-colors ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : active ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                              >
                                :{min}
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nom de l'appelant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={tsForm.description}
                  onChange={(e) => setTsForm({ ...tsForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Description de l'intervention"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Déplacement — {tsForm.travelUnits} unité{tsForm.travelUnits !== 1 ? 's' : ''} (×30 min)
                </label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={tsForm.travelUnits}
                  onChange={(e) => setTsForm({ ...tsForm, travelUnits: parseInt(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {[0,1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isEvent"
                  checked={tsForm.isEvent}
                  onChange={(e) => setTsForm({ ...tsForm, isEvent: e.target.checked })}
                  className="accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isEvent" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Événement
                </label>
              </div>

              <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total estimé (HTVA)</span>
                <span className="text-lg font-bold text-blue-900">{liveTotal} €</span>
              </div>

              {editingEntryId ? (
                <div className="flex gap-3 pt-2">
                  {deleteConfirm ? (
                    <div className="flex-1 flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Confirmer suppression
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="px-4 py-2.5 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Supprimer
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Enregistrer
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Créer
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

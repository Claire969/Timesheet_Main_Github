import type {
  EventReport,
  EventReportDay,
  EventReportHourlyRow,
  EventReportIncident,
  EventReportImage,
  EventReportWifiNetwork,
  EventReportSetupStep,
} from '../lib/eventReportTypes';

type ReportRow = EventReport & { venue_client_name?: string; venue_client_logo?: string | null };

export interface PrintableDayData {
  day: EventReportDay;
  hourlyRows: EventReportHourlyRow[];
  incidents: EventReportIncident[];
  images: EventReportImage[];
}

export interface PrintableReportData {
  report: ReportRow;
  days: PrintableDayData[];
  wifiNetworks: EventReportWifiNetwork[];
  setupSteps: EventReportSetupStep[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtDateRange = (report: ReportRow) => {
  if (!report.start_date) return '—';
  if (report.total_days <= 1) return fmtDate(report.start_date);
  const end = new Date(report.start_date);
  end.setDate(end.getDate() + report.total_days - 1);
  return `${fmtDate(report.start_date)} – ${fmtDate(end.toISOString().slice(0, 10))}`;
};

// ─── Design tokens (shared inline style constants) ───────────────────────────

const NAVY = '#183B6B';
const NAVY_LIGHT = '#e8eef6';
const TEXT_PRIMARY = '#1a1a2e';
const TEXT_SECONDARY = '#4b5563';
const TEXT_MUTED = '#9ca3af';
const BORDER = '#D9E2EC';
const ACCENT_BLUE = '#2563eb';
const ACCENT_GREEN = '#059669';
const ACCENT_ORANGE = '#d97706';
const BG_ROW_ALT = '#F4F7FB';
const INC_LABEL_COLOR = '#5B6B7A';
const INC_IMPACT_COLOR = '#C97A1A';

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: NAVY,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const sectionBlock: React.CSSProperties = {
  marginBottom: 24,
};

// ─── Charts ──────────────────────────────────────────────────────────────────

interface PrintLineChartProps {
  rows: EventReportHourlyRow[];
  field: 'wifi_users' | 'bandwidth_in' | 'bandwidth_out';
  color: string;
  label: string;
  secondaryField?: 'bandwidth_in' | 'bandwidth_out';
  secondaryColor?: string;
  secondaryLabel?: string;
}

function PrintLineChart({
  rows,
  field,
  color,
  label,
  secondaryField,
  secondaryColor,
  secondaryLabel,
}: PrintLineChartProps) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const labels = sorted.map((r) => r.hour_label);
  const values = sorted.map((r) => (r[field] as number) ?? 0);
  const secondaryValues = secondaryField ? sorted.map((r) => (r[secondaryField] as number) ?? 0) : [];

  const PAD = { top: 12, right: 20, bottom: 30, left: 48 };
  const W = 540;
  const H = 130;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const allVals = [...values, ...secondaryValues];
  const maxVal = Math.max(...allVals, 1);

  const xPos = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);
  const xStep = Math.max(1, Math.ceil(n / 10));
  const xTickIndices = labels.map((_, i) => i).filter((i) => i % xStep === 0 || i === n - 1);

  const makePaths = (vals: number[]) => ({
    line: vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' '),
    area: [
      `${xPos(0)},${PAD.top + innerH}`,
      ...vals.map((v, i) => `${xPos(i)},${yPos(v)}`),
      `${xPos(n - 1)},${PAD.top + innerH}`,
    ].join(' '),
  });

  const primary = makePaths(values);
  const secondary = secondaryField ? makePaths(secondaryValues) : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {secondaryField && secondaryColor && secondaryLabel && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: TEXT_MUTED }}>
              <span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
              {label.replace('Bande passante (GB)', 'Download (↓)')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: TEXT_MUTED }}>
              <span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: secondaryColor, borderRadius: 1 }} />
              {secondaryLabel}
            </span>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="#f8fafc" rx={2} />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yPos(tick)} y2={yPos(tick)} stroke={BORDER} strokeWidth={1} />
            <text x={PAD.left - 5} y={yPos(tick)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill={TEXT_MUTED}>
              {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick % 1 === 0 ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {xTickIndices.map((i) => (
          <text key={i} x={xPos(i)} y={H - PAD.bottom + 13} textAnchor="middle" fontSize={8} fill={TEXT_MUTED}>
            {labels[i]}
          </text>
        ))}
        {secondary && (
          <>
            <polygon points={secondary.area} fill={secondaryColor} fillOpacity={0.06} />
            <polyline points={secondary.line} fill="none" stroke={secondaryColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            {n <= 20 && secondaryValues.map((v, i) => (
              <circle key={`s${i}`} cx={xPos(i)} cy={yPos(v)} r={2} fill={secondaryColor} />
            ))}
          </>
        )}
        <polygon points={primary.area} fill={color} fillOpacity={0.1} />
        <polyline points={primary.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {n <= 20 && values.map((v, i) => (
          <circle key={`p${i}`} cx={xPos(i)} cy={yPos(v)} r={2.5} fill={color} />
        ))}
      </svg>
    </div>
  );
}

// ─── Shared day-page header (first page + continuation) ──────────────────────

function DayPageHeader({ eventName, centerLabel, reportDate, isContinuation, pageNumber, totalPages }: {
  eventName: string;
  centerLabel: string;
  reportDate: string | null;
  isContinuation: boolean;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <>
      <div style={{
        background: NAVY,
        padding: isContinuation ? '7px 18px' : '9px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {eventName}
        </div>
        <div style={{ fontSize: isContinuation ? 9 : 10, fontWeight: 800, color: '#fff', letterSpacing: '0.02em', textAlign: 'center', flex: 'none', padding: '0 16px' }}>
          {centerLabel}
          {isContinuation && (
            <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>(suite)</span>
          )}
          {!isContinuation && reportDate && (
            <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginLeft: 8 }}>{fmtDate(reportDate)}</span>
          )}
        </div>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', flex: 1, textAlign: 'right', whiteSpace: 'nowrap' }}>
          Page {pageNumber} / {totalPages}
        </div>
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)`, marginBottom: 20 }} />
    </>
  );
}

// ─── Day page ─────────────────────────────────────────────────────────────────

function PrintableDayPage({ dayData, dayIndex, totalEventDays, pageNumber, totalPages, eventName }: {
  dayData: PrintableDayData;
  dayIndex: number;
  totalEventDays: number;
  pageNumber: number;
  totalPages: number;
  eventName: string;
}) {
  const { day, hourlyRows, incidents, images } = dayData;
  const sorted = [...hourlyRows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const hasData = sorted.length > 0 || !!day.summary || incidents.length > 0 || images.length > 0;

  const dayTypeLabel = day.is_setup_day ? 'Montage' : 'Événement';
  const dayNumberLabel = day.is_setup_day ? 'Montage' : `Jour ${dayIndex + 1}`;
  const centerLabel = `${dayNumberLabel} — ${dayTypeLabel}`;

  const headerProps = {
    eventName,
    centerLabel,
    reportDate: day.report_date,
    totalPages,
  };

  return (
    <div className="print-page">
      <DayPageHeader {...headerProps} isContinuation={false} pageNumber={pageNumber} />

      {!hasData && (
        <p style={{ fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic' }}>Aucune donnée enregistrée pour ce jour.</p>
      )}

      {/* Summary */}
      {day.summary && (
        <div style={{ ...sectionBlock, background: '#f8fafc', borderRadius: 6, padding: '12px 16px', border: `1px solid ${BORDER}` }}>
          <div style={sectionLabel}>Résumé du jour</div>
          <p style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{day.summary}</p>
        </div>
      )}

      {/* Hourly table */}
      {sorted.length > 0 && (
        <div style={sectionBlock}>
          <div style={sectionLabel}>Suivi réseau horaire</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, borderRadius: 6, overflow: 'hidden' }}>
            <thead>
              <tr>
                {['Heure', 'Utilisateurs Wi-Fi', 'Download (GB)', 'Upload (GB)'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      background: NAVY,
                      color: '#fff',
                      padding: '7px 12px',
                      textAlign: i === 0 ? 'left' : 'right',
                      fontWeight: 700,
                      fontSize: 9,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? BG_ROW_ALT : '#fff', borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '5px 12px', fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{row.hour_label}</td>
                  <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{row.wifi_users ?? '—'}</td>
                  <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{row.bandwidth_out != null ? row.bandwidth_out.toFixed(2) : '—'}</td>
                  <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{row.bandwidth_in != null ? row.bandwidth_in.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Charts */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px' }}>
              <PrintLineChart
                rows={sorted}
                field="wifi_users"
                color={ACCENT_BLUE}
                label="Utilisateurs Wi-Fi"
              />
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bande passante (GB)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: TEXT_MUTED }}>
                  <span style={{ display: 'inline-block', width: 12, height: 2, backgroundColor: ACCENT_GREEN, borderRadius: 1 }} />
                  Download ↓
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: TEXT_MUTED }}>
                  <span style={{ display: 'inline-block', width: 12, height: 2, backgroundColor: ACCENT_BLUE, borderRadius: 1 }} />
                  Upload ↑
                </span>
              </div>
              <PrintLineChart
                rows={sorted}
                field="bandwidth_out"
                color={ACCENT_GREEN}
                label=""
                secondaryField="bandwidth_in"
                secondaryColor={ACCENT_BLUE}
                secondaryLabel="Upload ↑"
              />
            </div>
          </div>
        </div>
      )}

      {/* Incidents — flow naturally after table/charts; each block is kept together */}
      {incidents.length > 0 && (
        <IncidentsSection incidents={incidents} />
      )}

      {/* Images — flow naturally; each image card is kept together */}
      {images.length > 0 && (
        <ImagesSection images={images} />
      )}
    </div>
  );
}

// ─── Extracted section renderers ─────────────────────────────────────────────

function IncidentsSection({ incidents }: { incidents: EventReportIncident[] }) {
  return (
    <div style={sectionBlock}>
      <div style={sectionLabel}>
        Incidents
        <span style={{ fontSize: 9, background: NAVY_LIGHT, color: NAVY, padding: '1px 7px', borderRadius: 20, fontWeight: 700, marginLeft: 4 }}>
          {incidents.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incidents.map((inc) => (
          <div
            key={inc.id}
            style={{
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${inc.network_impact ? INC_IMPACT_COLOR : NAVY}`,
              borderRadius: 5,
              background: BG_ROW_ALT,
              overflow: 'hidden',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px 6px',
              borderBottom: `1px solid ${BORDER}`,
              background: '#fff',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                {inc.incident_time && (
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    color: NAVY,
                    background: NAVY_LIGHT,
                    padding: '2px 7px',
                    borderRadius: 3,
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {inc.incident_time.slice(0, 5)}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 800, color: NAVY, lineHeight: 1.3 }}>{inc.title}</span>
              </div>
              {inc.network_impact && (
                <span style={{
                  fontSize: 8,
                  background: '#FEF3E2',
                  color: INC_IMPACT_COLOR,
                  border: `1px solid #F5D9A0`,
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  Impact réseau
                </span>
              )}
            </div>
            <div style={{ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {inc.description?.trim() && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: INC_LABEL_COLOR, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</span>
                  <span style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{inc.description}</span>
                </div>
              )}
              {inc.resolution?.trim() && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: INC_LABEL_COLOR, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Résolution</span>
                  <span style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{inc.resolution}</span>
                </div>
              )}
              {inc.network_impact && inc.network_impact_text?.trim() && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: INC_IMPACT_COLOR, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Impact</span>
                  <span style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{inc.network_impact_text}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagesSection({ images }: { images: EventReportImage[] }) {
  return (
    <div style={sectionBlock}>
      <div style={sectionLabel}>Captures / Photos</div>
      <div style={{ display: 'grid', gridTemplateColumns: images.length === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
        {images.map((img) => (
          <div
            key={img.id}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              overflow: 'hidden',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
              pageBreakBefore: 'auto',
            }}
          >
            <div style={{ background: BG_ROW_ALT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, minHeight: 40, maxHeight: images.length === 1 ? 340 : 220, overflow: 'hidden' }}>
              <img
                src={img.file_url}
                alt={img.caption || ''}
                style={{ maxWidth: '100%', maxHeight: images.length === 1 ? 320 : 200, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </div>
            {img.caption && (
              <div style={{ padding: '5px 10px', background: '#fff', borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 9, color: TEXT_MUTED, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>{img.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface PrintableReportProps {
  data: PrintableReportData;
}

export function PrintableReport({ data }: PrintableReportProps) {
  const { report, days, wifiNetworks, setupSteps } = data;
  const setupDay = days.find((d) => d.day.is_setup_day);
  const eventDays = days.filter((d) => !d.day.is_setup_day);

  return (
    <div
      id="printable-report"
      style={{
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: TEXT_PRIMARY,
        background: '#fff',
        WebkitFontSmoothing: 'antialiased',
      }}
    >

      {/* ═══════════════════════════ COVER PAGE ══════════════════════════════ */}
      <div className="print-page" style={{ display: 'flex', flexDirection: 'column', padding: 0, minHeight: '267mm' }}>

        {/* ── Full-width header band ── */}
        <div style={{
          background: NAVY,
          padding: '22px 28px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>
              Clear Computing
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Rapport d'événement réseau
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {report.venue_client_logo ? (
              <img
                src={report.venue_client_logo}
                alt={report.venue_client_name ?? ''}
                style={{ maxHeight: 42, maxWidth: 120, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : report.venue_client_name ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em' }}>{report.venue_client_name}</div>
            ) : null}
          </div>
        </div>

        {/* ── Accent stripe ── */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)`, flexShrink: 0 }} />

        {/* ── Body ── */}
        <div style={{ flex: 1, padding: '28px 28px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Event title hero */}
          <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: TEXT_PRIMARY, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {report.event_name}
            </div>
            {(report.final_client_name || report.venue_client_name) && (
              <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_SECONDARY }}>
                {[report.final_client_name, report.venue_client_name].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>

          {/* Metadata grid card */}
          <div style={{
            background: '#f8fafc',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 22,
          }}>
            <div style={{
              background: NAVY_LIGHT,
              borderBottom: `1px solid #c7d8ee`,
              padding: '8px 16px',
              fontSize: 9,
              fontWeight: 800,
              color: NAVY,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Informations générales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
              {[
                { label: 'Client', value: report.final_client_name || '—' },
                { label: 'Lieu / Salle', value: report.venue_client_name || '—' },
                { label: 'Date', value: fmtDateRange(report) },
                { label: 'Durée', value: `${report.total_days} jour${report.total_days > 1 ? 's' : ''}` },
                { label: 'Rédigé par', value: 'Claire Vandenbosch' },
                { label: 'Statut', value: 'Validé', valueColor: ACCENT_GREEN },
              ].map(({ label, value, valueColor }, idx) => (
                <div
                  key={label}
                  style={{
                    padding: '10px 16px',
                    borderRight: idx % 3 < 2 ? `1px solid ${BORDER}` : 'none',
                    borderBottom: idx < 3 ? `1px solid ${BORDER}` : 'none',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 8, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: valueColor || TEXT_PRIMARY, lineHeight: 1.3 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Wi-Fi section */}
          {wifiNetworks.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: NAVY, textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', width: 3, height: 13, background: ACCENT_BLUE, borderRadius: 2 }} />
                Réseaux Wi-Fi déployés
              </div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      {['SSID', 'Mot de passe', 'Débit / Bande passante'].map((h, i) => (
                        <th key={h} style={{
                          background: NAVY,
                          color: '#fff',
                          padding: '7px 14px',
                          textAlign: 'left',
                          fontWeight: 700,
                          fontSize: 9,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          borderRight: i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wifiNetworks.map((net, i) => (
                      <tr key={net.id} style={{ background: i % 2 === 0 ? BG_ROW_ALT : '#fff', borderBottom: i < wifiNetworks.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                        <td style={{ padding: '7px 14px', fontWeight: 700, color: NAVY }}>{net.ssid}</td>
                        <td style={{ padding: '7px 14px', color: TEXT_PRIMARY, fontFamily: 'monospace', fontSize: 10 }}>{net.password || '—'}</td>
                        <td style={{ padding: '7px 14px', color: TEXT_PRIMARY }}>{net.speed || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Setup steps */}
          {setupSteps.filter(s => s.text?.trim()).length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: NAVY, textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', width: 3, height: 13, background: ACCENT_ORANGE, borderRadius: 2 }} />
                Mise en place
              </div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                {setupSteps.filter(s => s.text?.trim()).map((step, i, arr) => (
                  <div key={step.id} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '8px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: i % 2 === 0 ? BG_ROW_ALT : '#fff',
                  }}>
                    <div style={{
                      minWidth: 20, height: 20, borderRadius: '50%',
                      background: NAVY, color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 10.5, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Building plan */}
          {setupDay && setupDay.images.length > 0 && (
            <div style={{ marginBottom: 0 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: NAVY, textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', width: 3, height: 13, background: TEXT_MUTED, borderRadius: 2 }} />
                Plan / Schéma de salle
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: setupDay.images.length === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
                {setupDay.images.slice(0, 2).map((img) => (
                  <div key={img.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ background: BG_ROW_ALT, padding: 8, display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={img.file_url}
                        alt={img.caption || 'Plan de salle'}
                        style={{ maxWidth: '100%', maxHeight: 190, objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                    {img.caption && (
                      <div style={{ padding: '4px 10px', borderTop: `1px solid ${BORDER}` }}>
                        <p style={{ fontSize: 9, color: TEXT_MUTED, margin: 0, textAlign: 'center' }}>{img.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Cover footer ── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`,
          padding: '8px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 8, color: TEXT_MUTED, letterSpacing: '0.03em' }}>Clear Computing · {report.event_name}</span>
          <span style={{ fontSize: 8, color: TEXT_MUTED, letterSpacing: '0.03em' }}>Document confidentiel</span>
        </div>
      </div>

      {/* ═══════════════════════════ DAY PAGES ═══════════════════════════════ */}
      {eventDays.map((dayData, i) => (
        <PrintableDayPage
          key={dayData.day.id}
          dayData={dayData}
          dayIndex={i}
          totalEventDays={eventDays.length}
          pageNumber={i + 2}
          totalPages={eventDays.length + 1}
          eventName={report.event_name}
        />
      ))}
    </div>
  );
}

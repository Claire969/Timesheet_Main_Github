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

// ─── Design tokens ──────────────────────────────────────────────────────────

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

// ─── Charts ─────────────────────────────────────────────────────────────────

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
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: TEXT_SECONDARY,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>

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
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yPos(tick)}
              y2={yPos(tick)}
              stroke={BORDER}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 5}
              y={yPos(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={8}
              fill={TEXT_MUTED}
            >
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
            <polyline
              points={secondary.line}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {n <= 20 &&
              secondaryValues.map((v, i) => (
                <circle key={`s${i}`} cx={xPos(i)} cy={yPos(v)} r={2} fill={secondaryColor} />
              ))}
          </>
        )}

        <polygon points={primary.area} fill={color} fillOpacity={0.1} />
        <polyline
          points={primary.line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {n <= 20 &&
          values.map((v, i) => <circle key={`p${i}`} cx={xPos(i)} cy={yPos(v)} r={2.5} fill={color} />)}
      </svg>
    </div>
  );
}

// ─── Shared day-page header ─────────────────────────────────────────────────

function DayPageHeader({
  eventName,
  centerLabel,
  reportDate,
  isContinuation,
  pageNumber,
  totalPages,
}: {
  eventName: string;
  centerLabel: string;
  reportDate: string | null;
  isContinuation: boolean;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <>
      <div
        style={{
          background: NAVY,
          padding: isContinuation ? '7px 18px' : '9px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 0,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.04em',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {eventName}
        </div>

        <div
          style={{
            fontSize: isContinuation ? 9 : 10,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.02em',
            textAlign: 'center',
            flex: 'none',
            padding: '0 16px',
          }}
        >
          {centerLabel}
          {isContinuation && (
            <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>
              (suite)
            </span>
          )}
          {!isContinuation && reportDate && (
            <span style={{ fontSize: 8, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginLeft: 8 }}>
              {fmtDate(reportDate)}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.04em',
            flex: 1,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          Page {pageNumber}
        </div>
      </div>

      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)`,
          marginBottom: 20,
        }}
      />
    </>
  );
}

// ─── Fixed repeat header ────────────────────────────────────────────────────

function RepeatHeader({ eventName, totalPages }: { eventName: string; totalPages: number }) {
  return (
    <div className="repeat-header">
      <div
        style={{
          background: NAVY,
          padding: '6px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.04em',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Clear Computing
        </div>

        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.02em',
            textAlign: 'center',
            flex: 'none',
            padding: '0 16px',
          }}
        >
          {eventName}
        </div>

        <div
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.04em',
            flex: 1,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          Rapport réseau
        </div>
      </div>

      <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)` }} />
    </div>
  );
}

// ─── Daily totals block (event days only) ───────────────────────────────────

function DailyTotalsBlock({ rows }: { rows: EventReportHourlyRow[] }) {
  if (rows.length === 0) return null;

  const totalDownload = rows.reduce((sum, r) => sum + (r.bandwidth_out ?? 0), 0);
  const totalUpload = rows.reduce((sum, r) => sum + (r.bandwidth_in ?? 0), 0);

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginTop: 16,
        marginBottom: 8,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {[
        { label: 'Total Download', value: `${totalDownload.toFixed(2)} GB`, color: ACCENT_GREEN },
        { label: 'Total Upload', value: `${totalUpload.toFixed(2)} GB`, color: ACCENT_BLUE },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          style={{
            flex: 1,
            background: '#f8fafc',
            border: `1px solid ${BORDER}`,
            borderTop: `3px solid ${color}`,
            borderRadius: 6,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Setup / Montage block (grouped) ────────────────────────────────────────

function PrintableSetupBlock({
  setupDays,
  setupSteps,
  pageNumber,
  totalPages,
  eventName,
}: {
  setupDays: PrintableDayData[];
  setupSteps: EventReportSetupStep[];
  pageNumber: number;
  totalPages: number;
  eventName: string;
}) {
  const notes = setupDays.filter((d) => d.day.summary?.trim());
  const incidents = setupDays.flatMap((d) => d.incidents);
  const images = setupDays.flatMap((d) => d.images);
  const usefulSetupSteps = setupSteps.filter((s) => s.text?.trim());
  const dates = setupDays.map((d) => fmtDate(d.day.report_date)).filter((date) => date !== '—');
  const hasUsefulContent = notes.length > 0 || usefulSetupSteps.length > 0 || incidents.length > 0 || images.length > 0;

  if (setupDays.length === 0 || !hasUsefulContent) return null;

  return (
    <div className="print-page">
      <DayPageHeader
        eventName={eventName}
        centerLabel="Montage / Préparation"
        reportDate={null}
        isContinuation={false}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div className="day-flow">
        <div
          style={{
            ...sectionBlock,
            background: '#fff7ed',
            borderRadius: 6,
            padding: '12px 16px',
            border: `1px solid #fed7aa`,
          }}
        >
          <div style={sectionLabel}>Bloc regroupé de préparation / montage</div>
          {dates.length > 0 && (
            <p style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, margin: 0 }}>
              Dates regroupées : {dates.join(' · ')}
            </p>
          )}
        </div>

        {usefulSetupSteps.length > 0 && (
          <div style={sectionBlock}>
            <div style={sectionLabel}>Mise en place / Setup</div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              {usefulSetupSteps.map((step, i, arr) => (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '8px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: i % 2 === 0 ? BG_ROW_ALT : '#fff',
                  }}
                >
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: NAVY,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 10.5, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {notes.map((d) => (
          <div
            key={d.day.id}
            style={{
              ...sectionBlock,
              background: '#f8fafc',
              borderRadius: 6,
              padding: '12px 16px',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={sectionLabel}>Notes de montage — {fmtDate(d.day.report_date)}</div>
            <p style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {d.day.summary}
            </p>
          </div>
        ))}

        {incidents.length > 0 && <IncidentsSection incidents={incidents} />}
        {images.length > 0 && <ImagesSection images={images} />}
      </div>
    </div>
  );
}

// ─── Event day (detailed) ────────────────────────────────────────────────────

function PrintableDayPage({
  dayData,
  dayIndex,
  pageNumber,
  totalPages,
  eventName,
}: {
  dayData: PrintableDayData;
  dayIndex: number;
  pageNumber: number;
  totalPages: number;
  eventName: string;
}) {
  const { day, hourlyRows, incidents, images } = dayData;
  const sorted = [...hourlyRows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const hasData = sorted.length > 0 || !!day.summary || incidents.length > 0 || images.length > 0;

  const centerLabel = `Jour ${dayIndex + 1} — Événement`;

  return (
    <div className="print-page">
      <DayPageHeader
        eventName={eventName}
        centerLabel={centerLabel}
        reportDate={day.report_date}
        isContinuation={false}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div className="day-flow">
        {!hasData && (
          <p style={{ fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic' }}>
            Aucune donnée enregistrée pour ce jour.
          </p>
        )}

        {day.summary && (
          <div
            style={{
              ...sectionBlock,
              background: '#f8fafc',
              borderRadius: 6,
              padding: '12px 16px',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={sectionLabel}>Résumé du jour</div>
            <p style={{ fontSize: 11, color: TEXT_PRIMARY, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {day.summary}
            </p>
          </div>
        )}

        {sorted.length > 0 && (
          <div style={sectionBlock}>
            <div style={sectionLabel}>Suivi réseau horaire</div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 10,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
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
                  <tr
                    key={row.id}
                    style={{
                      background: i % 2 === 0 ? BG_ROW_ALT : '#fff',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <td
                      style={{
                        padding: '5px 12px',
                        fontWeight: 700,
                        color: NAVY,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 10,
                      }}
                    >
                      {row.hour_label}
                    </td>
                    <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.wifi_users ?? '—'}
                    </td>
                    <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.bandwidth_out != null ? row.bandwidth_out.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '5px 12px', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.bandwidth_in != null ? row.bandwidth_in.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px' }}>
                <PrintLineChart rows={sorted} field="wifi_users" color={ACCENT_BLUE} label="Utilisateurs Wi-Fi" />
              </div>

              <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Bande passante (GB)
                  </span>
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

            <DailyTotalsBlock rows={sorted} />
          </div>
        )}

        {incidents.length > 0 && <IncidentsSection incidents={incidents} />}
        {images.length > 0 && <ImagesSection images={images} />}
      </div>
    </div>
  );
}

// ─── Extracted section renderers ────────────────────────────────────────────

function IncidentsSection({ incidents }: { incidents: EventReportIncident[] }) {
  return (
    <div style={{ ...sectionBlock, marginBottom: 16 }}>
      <div style={sectionLabel}>
        Incidents
        <span
          style={{
            fontSize: 9,
            background: NAVY_LIGHT,
            color: NAVY,
            padding: '1px 7px',
            borderRadius: 20,
            fontWeight: 700,
            marginLeft: 4,
          }}
        >
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px 6px',
                borderBottom: `1px solid ${BORDER}`,
                background: '#fff',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                {inc.incident_time && (
                  <span
                    style={{
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
                    }}
                  >
                    {inc.incident_time.slice(0, 5)}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 800, color: NAVY, lineHeight: 1.3 }}>{inc.title}</span>
              </div>

              {inc.network_impact && (
                <span
                  style={{
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
                  }}
                >
                  Impact réseau
                </span>
              )}
            </div>

            <div style={{ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {inc.description?.trim() && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: INC_LABEL_COLOR,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    Description
                  </span>
                  <span style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{inc.description}</span>
                </div>
              )}

              {inc.resolution?.trim() && (
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: INC_LABEL_COLOR,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    Résolution
                  </span>
                  <span style={{ fontSize: 10, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{inc.resolution}</span>
                </div>
              )}

              {inc.network_impact &&
                inc.network_impact_text?.trim() &&
                inc.network_impact_text.toLowerCase() !== 'null' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0 8px', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: INC_IMPACT_COLOR,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      Impact
                    </span>
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

const cardBase: React.CSSProperties = {
  minWidth: 0,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  overflow: 'hidden',
  pageBreakInside: 'avoid',
  breakInside: 'avoid',
};

function CardImg({ img, maxHeight }: { img: EventReportImage; maxHeight: number }) {
  return (
    <div style={cardBase}>
      <div style={{ background: BG_ROW_ALT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <img
          src={img.file_url}
          alt={img.caption || ''}
          style={{
            maxWidth: '100%',
            maxHeight,
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
          }}
        />
      </div>

      {img.caption && (
        <div style={{ padding: '5px 10px', background: '#fff', borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 9, color: TEXT_MUTED, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
            {img.caption}
          </p>
        </div>
      )}
    </div>
  );
}

function ImagesSection({ images }: { images: EventReportImage[] }) {
  const count = images.length;
  if (count === 0) return null;

  if (count === 1) {
    return (
      <div style={{ ...sectionBlock, marginBottom: 16 }}>
        <div style={sectionLabel}>Captures / Photos</div>
        <CardImg img={images[0]} maxHeight={480} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div style={{ ...sectionBlock, marginBottom: 16 }}>
        <div style={sectionLabel}>Captures / Photos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {images.map((img) => (
            <div key={img.id} style={{ width: '100%' }}>
              <CardImg img={img} maxHeight={400} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div style={{ ...sectionBlock, marginBottom: 16 }}>
        <div style={sectionLabel}>Captures / Photos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CardImg img={images[0]} maxHeight={380} />
          <div style={{ display: 'flex', gap: 10 }}>
            {images.slice(1).map((img) => (
              <div key={img.id} style={{ flex: '1 1 0', minWidth: 0 }}>
                <CardImg img={img} maxHeight={280} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rows: EventReportImage[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    rows.push(images.slice(i, i + 2));
  }

  return (
    <div style={{ ...sectionBlock, marginBottom: 16 }}>
      <div style={sectionLabel}>Captures / Photos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: 'flex',
              gap: 10,
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            {row.map((img) => (
              <div key={img.id} style={{ flex: '1 1 0', minWidth: 0 }}>
                <CardImg img={img} maxHeight={280} />
              </div>
            ))}
            {row.length === 1 && <div style={{ flex: '1 1 0', minWidth: 0 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────

interface PrintableReportProps {
  data: PrintableReportData;
}

export function PrintableReport({ data }: PrintableReportProps) {
  const { report, days, wifiNetworks, setupSteps } = data;

  console.log(`[PrintableReport] Rendering with ${days.length} total days:`, days.map(d => ({ id: d.day.id, is_setup: d.day.is_setup_day, date: d.day.report_date })));

  const setupDays = days.filter((d) => d.day.is_setup_day);
  const eventDays = days.filter((d) => !d.day.is_setup_day);
  const hasSetupBlock = setupDays.some((d) => d.day.summary?.trim() || d.incidents.length > 0 || d.images.length > 0)
    || setupSteps.some((s) => s.text?.trim());
  const setupPageCount = setupDays.length > 0 && hasSetupBlock ? 1 : 0;
  const summaryPageCount = 1;
  const totalPages = 1 + setupPageCount + Math.max(eventDays.length, 1) + summaryPageCount;

  console.log(`[PrintableReport] Setup days: ${setupDays.length}, Event days: ${eventDays.length}`);

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
        <div
          style={{
            background: NAVY,
            padding: '22px 28px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Clear Computing
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Rapport d'événement réseau
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {report.venue_client_logo ? (
              <img
                src={report.venue_client_logo}
                alt={report.venue_client_name ?? ''}
                style={{
                  maxHeight: 42,
                  maxWidth: 120,
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.85,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : report.venue_client_name ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.75)',
                  letterSpacing: '0.06em',
                }}
              >
                {report.venue_client_name}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ height: 4, background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)`, flexShrink: 0 }} />

        <div style={{ flex: 1, padding: '28px 28px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: TEXT_PRIMARY,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}
            >
              {report.event_name}
            </div>
            {(report.final_client_name || report.venue_client_name) && (
              <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_SECONDARY }}>
                {[report.final_client_name, report.venue_client_name].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 22,
            }}
          >
            <div
              style={{
                background: NAVY_LIGHT,
                borderBottom: `1px solid #c7d8ee`,
                padding: '8px 16px',
                fontSize: 9,
                fontWeight: 800,
                color: NAVY,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
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
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: TEXT_MUTED,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 4,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: valueColor || TEXT_PRIMARY, lineHeight: 1.3 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {wifiNetworks.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: NAVY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ display: 'inline-block', width: 3, height: 13, background: ACCENT_BLUE, borderRadius: 2 }} />
                Réseaux Wi-Fi déployés
              </div>

              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      {['SSID', 'Mot de passe', 'Débit / Bande passante'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            background: NAVY,
                            color: '#fff',
                            padding: '7px 14px',
                            textAlign: 'left',
                            fontWeight: 700,
                            fontSize: 9,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            borderRight: i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {wifiNetworks.map((net, i) => (
                      <tr
                        key={net.id}
                        style={{
                          background: i % 2 === 0 ? BG_ROW_ALT : '#fff',
                          borderBottom: i < wifiNetworks.length - 1 ? `1px solid ${BORDER}` : 'none',
                        }}
                      >
                        <td style={{ padding: '7px 14px', fontWeight: 700, color: NAVY }}>{net.ssid}</td>
                        <td style={{ padding: '7px 14px', color: TEXT_PRIMARY, fontFamily: 'monospace', fontSize: 10 }}>
                          {net.password || '—'}
                        </td>
                        <td style={{ padding: '7px 14px', color: TEXT_PRIMARY }}>{net.speed || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {setupSteps.filter((s) => s.text?.trim()).length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: NAVY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ display: 'inline-block', width: 3, height: 13, background: ACCENT_ORANGE, borderRadius: 2 }} />
                Mise en place
              </div>

              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                {setupSteps
                  .filter((s) => s.text?.trim())
                  .map((step, i, arr) => (
                    <div
                      key={step.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        padding: '8px 14px',
                        borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                        background: i % 2 === 0 ? BG_ROW_ALT : '#fff',
                      }}
                    >
                      <div
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: NAVY,
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 10.5, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step.text}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {setupDays.some((d) => d.images.length > 0) && (
            <div style={{ marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: NAVY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ display: 'inline-block', width: 3, height: 13, background: TEXT_MUTED, borderRadius: 2 }} />
                Plan / Schéma de salle
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: setupDays.flatMap((d) => d.images).length === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
                {setupDays.flatMap((d) => d.images).slice(0, 2).map((img) => (
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

        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: '8px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 8, color: TEXT_MUTED, letterSpacing: '0.03em' }}>
            Clear Computing · {report.event_name}
          </span>
          <span style={{ fontSize: 8, color: TEXT_MUTED, letterSpacing: '0.03em' }}>Document confidentiel</span>
        </div>
      </div>

      {/* Setup / montage days — grouped before event days */}
      {setupPageCount > 0 && (
        <PrintableSetupBlock
          setupDays={setupDays}
          setupSteps={setupSteps}
          pageNumber={2}
          totalPages={totalPages}
          eventName={report.event_name}
        />
      )}

      {eventDays.length > 0 && (
        <RepeatHeader
          eventName={report.event_name}
          totalPages={totalPages}
        />
      )}

      {eventDays.length > 0 ? (
        eventDays.map((dayData, i) => (
          <PrintableDayPage
            key={dayData.day.id}
            dayData={dayData}
            dayIndex={i}
            pageNumber={i + 2 + setupPageCount}
            totalPages={totalPages}
            eventName={report.event_name}
          />
        ))
      ) : (
        <div className="print-page" style={{ padding: '20px' }}>
          <p style={{ fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic' }}>
            Aucun jour d'événement enregistré.
          </p>
        </div>
      )}

      {/* ═══════════════════ NETWORK EVENT SUMMARY ═══════════════════════ */}
      <StreamingSessionSummary eventDays={eventDays} report={report} />
    </div>
  );
}

// ─── Streaming session summary ───────────────────────────────────────────────

function StreamingSessionSummary({
  eventDays,
  report,
}: {
  eventDays: PrintableDayData[];
  report: { event_name: string; start_date: string | null; total_days: number; venue_client_name?: string };
}) {
  const allRows = eventDays.flatMap((d) => d.hourlyRows);
  const totalDownload = allRows.reduce((sum, r) => sum + (r.bandwidth_out ?? 0), 0);
  const totalUpload = allRows.reduce((sum, r) => sum + (r.bandwidth_in ?? 0), 0);
  const peakUsers = allRows.reduce((max, r) => Math.max(max, r.wifi_users ?? 0), 0);
  const totalIncidents = eventDays.reduce((sum, d) => sum + d.incidents.length, 0);

  return (
    <div
      className="print-page"
      style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
    >
      <div
        style={{
          background: NAVY,
          padding: '9px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 0,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em' }}>
          {report.event_name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.02em', textAlign: 'center', flex: 'none', padding: '0 16px' }}>
          Résumé de l’événement réseau
        </div>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', flex: 1, textAlign: 'right' }} />
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT_BLUE} 0%, #38bdf8 100%)`, marginBottom: 24 }} />

      <div style={{ padding: '0 4px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { label: 'Total Download', value: allRows.length > 0 ? `${totalDownload.toFixed(2)} GB` : '—', color: ACCENT_GREEN },
            { label: 'Total Upload', value: allRows.length > 0 ? `${totalUpload.toFixed(2)} GB` : '—', color: ACCENT_BLUE },
            { label: 'Pic utilisateurs Wi-Fi', value: peakUsers > 0 ? String(peakUsers) : '—', color: NAVY },
            { label: 'Incidents enregistrés', value: String(totalIncidents), color: totalIncidents > 0 ? ACCENT_ORANGE : ACCENT_GREEN },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: '#f8fafc',
                border: `1px solid ${BORDER}`,
                borderTop: `3px solid ${color}`,
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 8, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: NAVY_LIGHT,
              borderBottom: `1px solid #c7d8ee`,
              padding: '8px 16px',
              fontSize: 9,
              fontWeight: 800,
              color: NAVY,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Récapitulatif par jour
          </div>

          {eventDays.length === 0 ? (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic', margin: 0 }}>
                Aucun jour d'événement disponible.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['Jour', 'Date', 'Download (GB)', 'Upload (GB)', 'Pic utilisateurs', 'Incidents'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        background: '#fff',
                        borderBottom: `1px solid ${BORDER}`,
                        color: TEXT_SECONDARY,
                        padding: '7px 14px',
                        textAlign: i <= 1 ? 'left' : 'right',
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventDays.map((d, i) => {
                  const rows = d.hourlyRows;
                  const dl = rows.reduce((s, r) => s + (r.bandwidth_out ?? 0), 0);
                  const ul = rows.reduce((s, r) => s + (r.bandwidth_in ?? 0), 0);
                  const peak = rows.reduce((m, r) => Math.max(m, r.wifi_users ?? 0), 0);
                  return (
                    <tr key={d.day.id} style={{ background: i % 2 === 0 ? BG_ROW_ALT : '#fff', borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '7px 14px', fontWeight: 700, color: NAVY }}>Jour {i + 1}</td>
                      <td style={{ padding: '7px 14px', color: TEXT_SECONDARY }}>
                        {d.day.report_date
                          ? (() => { const [y, m, dd] = d.day.report_date!.split('-'); return `${dd}/${m}/${y}`; })()
                          : '—'}
                      </td>
                      <td style={{ padding: '7px 14px', color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {rows.length > 0 ? dl.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '7px 14px', color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {rows.length > 0 ? ul.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '7px 14px', color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {peak > 0 ? peak : '—'}
                      </td>
                      <td style={{ padding: '7px 14px', color: d.incidents.length > 0 ? ACCENT_ORANGE : TEXT_PRIMARY, textAlign: 'right', fontWeight: d.incidents.length > 0 ? 700 : 400 }}>
                        {d.incidents.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
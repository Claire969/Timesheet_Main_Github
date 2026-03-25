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

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtDateRange = (report: ReportRow) => {
  if (!report.start_date) return '—';
  if (report.total_days <= 1) return fmtDate(report.start_date);
  const start = new Date(report.start_date);
  const end = new Date(report.start_date);
  end.setDate(end.getDate() + report.total_days - 1);
  return `${fmtDate(report.start_date)} – ${fmtDate(end.toISOString().slice(0, 10))}`;
};

interface PrintHourlyChartProps {
  rows: EventReportHourlyRow[];
  field: 'wifi_users' | 'bandwidth_in' | 'bandwidth_out';
  color: string;
  label: string;
  yUnit?: string;
}

function PrintLineChart({ rows, field, color, label, yUnit = '' }: PrintHourlyChartProps) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const labels = sorted.map((r) => r.hour_label);
  const values = sorted.map((r) => (r[field] as number) ?? 0);
  const PAD = { top: 10, right: 16, bottom: 28, left: 44 };
  const W = 520;
  const H = 120;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const maxVal = Math.max(...values, 1);
  const xPos = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
  const tickCount = 3;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);
  const xStep = Math.max(1, Math.ceil(n / 8));
  const xTickIndices = labels.map((_, i) => i).filter((i) => i % xStep === 0 || i === n - 1);
  const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  const areaPoints = [
    `${xPos(0)},${PAD.top + innerH}`,
    ...values.map((v, i) => `${xPos(i)},${yPos(v)}`),
    `${xPos(n - 1)},${PAD.top + innerH}`,
  ].join(' ');

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yPos(tick)} y2={yPos(tick)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 4} y={yPos(tick)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="#9ca3af">
              {tick % 1 === 0 ? tick : tick.toFixed(1)}{yUnit}
            </text>
          </g>
        ))}
        {xTickIndices.map((i) => (
          <text key={i} x={xPos(i)} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
            {labels[i]}
          </text>
        ))}
        <polygon points={areaPoints} fill={color} fillOpacity={0.1} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {n <= 24 && values.map((v, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(v)} r={2.5} fill={color} />
        ))}
      </svg>
    </div>
  );
}

function PrintBandwidthChart({ rows }: { rows: EventReportHourlyRow[] }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const labels = sorted.map((r) => r.hour_label);
  const downValues = sorted.map((r) => r.bandwidth_out ?? 0);
  const upValues = sorted.map((r) => r.bandwidth_in ?? 0);
  const PAD = { top: 10, right: 16, bottom: 28, left: 44 };
  const W = 520;
  const H = 120;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const maxVal = Math.max(...downValues, ...upValues, 1);
  const xPos = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
  const tickCount = 3;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);
  const xStep = Math.max(1, Math.ceil(n / 8));
  const xTickIndices = labels.map((_, i) => i).filter((i) => i % xStep === 0 || i === n - 1);

  const makePath = (values: number[]) => ({
    line: values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' '),
    area: [
      `${xPos(0)},${PAD.top + innerH}`,
      ...values.map((v, i) => `${xPos(i)},${yPos(v)}`),
      `${xPos(n - 1)},${PAD.top + innerH}`,
    ].join(' '),
  });

  const downPath = makePath(downValues);
  const upPath = makePath(upValues);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Bande passante (GB)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9ca3af' }}>
          <span style={{ display: 'inline-block', width: 12, height: 2, backgroundColor: '#10b981', borderRadius: 1 }} />
          Download (↓)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9ca3af' }}>
          <span style={{ display: 'inline-block', width: 12, height: 2, backgroundColor: '#3b82f6', borderRadius: 1 }} />
          Upload (↑)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yPos(tick)} y2={yPos(tick)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 4} y={yPos(tick)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="#9ca3af">
              {tick % 1 === 0 ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {xTickIndices.map((i) => (
          <text key={i} x={xPos(i)} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
            {labels[i]}
          </text>
        ))}
        <polygon points={downPath.area} fill="#10b981" fillOpacity={0.08} />
        <polyline points={downPath.line} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <polygon points={upPath.area} fill="#3b82f6" fillOpacity={0.08} />
        <polyline points={upPath.line} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {n <= 24 && downValues.map((v, i) => (
          <circle key={`d${i}`} cx={xPos(i)} cy={yPos(v)} r={2} fill="#10b981" />
        ))}
        {n <= 24 && upValues.map((v, i) => (
          <circle key={`u${i}`} cx={xPos(i)} cy={yPos(v)} r={2} fill="#3b82f6" />
        ))}
      </svg>
    </div>
  );
}

interface PrintableDayPageProps {
  dayData: PrintableDayData;
  index: number;
  total: number;
}

function PrintableDayPage({ dayData }: PrintableDayPageProps) {
  const { day, hourlyRows, incidents, images } = dayData;
  const sorted = [...hourlyRows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));

  return (
    <div className="print-page">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '2px solid #1e3a5f', paddingBottom: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>
            {day.is_setup_day ? 'Installation' : `Jour ${day.day_number}`}
          </h2>
          {day.report_date && (
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{fmtDate(day.report_date)}</span>
          )}
          {day.is_setup_day && (
            <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Mise en place</span>
          )}
        </div>

        {day.summary && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Résumé
            </div>
            <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{day.summary}</p>
          </div>
        )}

        {sorted.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Suivi réseau horaire
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['Heure', 'Wi-Fi (users)', 'Download (GB)', 'Upload (GB)', 'Notes'].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: '#1e3a5f',
                        color: '#fff',
                        padding: '6px 10px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>{row.hour_label}</td>
                    <td style={{ padding: '5px 10px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{row.wifi_users ?? '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{row.bandwidth_out != null ? row.bandwidth_out.toFixed(2) : '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{row.bandwidth_in != null ? row.bandwidth_in.toFixed(2) : '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#6b7280', fontSize: 9 }}>{row.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 16 }}>
              <PrintLineChart rows={sorted} field="wifi_users" color="#3b82f6" label="Utilisateurs Wi-Fi" />
              <PrintBandwidthChart rows={sorted} />
            </div>
          </div>
        )}

        {incidents.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Incidents ({incidents.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderLeft: inc.network_impact ? '4px solid #f97316' : '4px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '10px 12px',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {inc.incident_time && (
                      <span style={{ fontSize: 9, fontFamily: 'monospace', background: '#f3f4f6', color: '#374151', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                        {inc.incident_time.slice(0, 5)}
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{inc.title}</span>
                    {inc.network_impact && (
                      <span style={{ fontSize: 9, background: '#fff7ed', color: '#c2410c', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>
                        Impact réseau
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p style={{ fontSize: 10, color: '#374151', margin: '4px 0', lineHeight: 1.5 }}><strong>Description : </strong>{inc.description}</p>
                  )}
                  {inc.resolution && (
                    <p style={{ fontSize: 10, color: '#374151', margin: '4px 0', lineHeight: 1.5 }}><strong>Résolution : </strong>{inc.resolution}</p>
                  )}
                  {inc.network_impact && inc.network_impact_text && (
                    <p style={{ fontSize: 10, color: '#c2410c', margin: '4px 0', lineHeight: 1.5 }}><strong>Impact réseau : </strong>{inc.network_impact_text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Captures / Photos
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {images.map((img) => (
                <div key={img.id} style={{ maxWidth: 220 }}>
                  <img
                    src={img.file_url}
                    alt={img.caption || ''}
                    style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 4, border: '1px solid #e5e7eb' }}
                  />
                  {img.caption && (
                    <p style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PrintableReportProps {
  data: PrintableReportData;
}

export function PrintableReport({ data }: PrintableReportProps) {
  const { report, days, wifiNetworks, setupSteps } = data;
  const setupDay = days.find((d) => d.day.is_setup_day);
  const eventDays = days.filter((d) => !d.day.is_setup_day);

  return (
    <div id="printable-report" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: '#111827', background: '#fff' }}>

      {/* ---- COVER PAGE ---- */}
      <div className="print-page" style={{ minHeight: '270mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0 0 32px 0' }}>
        <div>
          <div style={{ background: '#1e3a5f', height: 8, borderRadius: '0 0 4px 4px', marginBottom: 40 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Clear Computing
            </div>
            {report.venue_client_logo && (
              <img
                src={report.venue_client_logo}
                alt={report.venue_client_name ?? ''}
                style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          <div style={{ padding: '0 8px', marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Rapport d'événement
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111827', lineHeight: 1.15, margin: '0 0 12px 0' }}>
              {report.event_name}
            </h1>
            {report.final_client_name && (
              <div style={{ fontSize: 16, color: '#374151', fontWeight: 600, marginBottom: 6 }}>{report.final_client_name}</div>
            )}
            {report.venue_client_name && (
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Salle / Lieu : {report.venue_client_name}</div>
            )}
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {fmtDateRange(report)}
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '16px 20px', margin: '0 8px 24px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Informations générales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Rédigé par</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>Claire Vandenbosch</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Durée</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{report.total_days} jour{report.total_days > 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>

          {wifiNetworks.length > 0 && (
            <div style={{ margin: '0 8px 24px', padding: '14px 18px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Réseaux Wi-Fi déployés
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    {['SSID', 'Mot de passe', 'Débit'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', color: '#1d4ed8', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', paddingBottom: 6, borderBottom: '1px solid #bfdbfe' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wifiNetworks.map((net) => (
                    <tr key={net.id}>
                      <td style={{ padding: '4px 0', fontWeight: 600, color: '#1e40af' }}>{net.ssid}</td>
                      <td style={{ padding: '4px 0', color: '#374151', fontFamily: 'monospace', fontSize: 10 }}>{net.password || '—'}</td>
                      <td style={{ padding: '4px 0', color: '#374151' }}>{net.speed || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {setupSteps.length > 0 && (
            <div style={{ margin: '0 8px 24px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Mise en place
              </div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {setupSteps.map((step, i) => (
                  <li key={step.id} style={{ fontSize: 11, color: '#374151', marginBottom: 4, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{i + 1}.</span> {step.text}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {setupDay && setupDay.images.length > 0 && (
            <div style={{ margin: '0 8px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Plan / Schéma
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {setupDay.images.slice(0, 2).map((img) => (
                  <div key={img.id} style={{ maxWidth: 240 }}>
                    <img
                      src={img.file_url}
                      alt={img.caption || 'Plan'}
                      style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb' }}
                    />
                    {img.caption && (
                      <p style={{ fontSize: 9, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>{img.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <span style={{ fontSize: 9, color: '#9ca3af' }}>Clear Computing — {report.event_name}</span>
          <span style={{ fontSize: 9, color: '#9ca3af' }}>Document confidentiel</span>
        </div>
      </div>

      {/* ---- DAY PAGES ---- */}
      {eventDays.map((dayData, i) => (
        <PrintableDayPage key={dayData.day.id} dayData={dayData} index={i} total={eventDays.length} />
      ))}
    </div>
  );
}

import type { EventReportHourlyRow } from '../lib/eventReportTypes';

interface LineChartProps {
  labels: string[];
  series: { label: string; color: string; values: number[] }[];
  yUnit?: string;
  height?: number;
  yMin?: number;
}

function LineChart({ labels, series, yUnit = '', height = 140, yMin = 0 }: LineChartProps) {
  const PAD = { top: 12, right: 16, bottom: 32, left: 44 };
  const W = 600;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, yMin, 1);
  const n = labels.length;

  const xPos = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);

  const xStep = Math.max(1, Math.ceil(n / 8));
  const xTickIndices = labels.map((_, i) => i).filter((i) => i % xStep === 0 || i === n - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yPos(tick)}
            y2={yPos(tick)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={yPos(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            {tick % 1 === 0 ? tick : tick.toFixed(1)}{yUnit}
          </text>
        </g>
      ))}

      {xTickIndices.map((i) => (
        <text
          key={i}
          x={xPos(i)}
          y={H - PAD.bottom + 14}
          textAnchor="middle"
          fontSize={10}
          fill="#9ca3af"
        >
          {labels[i]}
        </text>
      ))}

      {series.map((s) => {
        const points = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
        const areaPoints = [
          `${xPos(0)},${PAD.top + innerH}`,
          ...s.values.map((v, i) => `${xPos(i)},${yPos(v)}`),
          `${xPos(n - 1)},${PAD.top + innerH}`,
        ].join(' ');

        return (
          <g key={s.label}>
            <polygon points={areaPoints} fill={s.color} fillOpacity={0.08} />
            <polyline
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {n <= 20 && s.values.map((v, i) => (
              <circle key={i} cx={xPos(i)} cy={yPos(v)} r={3} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

interface LegendItem {
  label: string;
  color: string;
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex items-center gap-4 mb-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

interface HourlyChartsProps {
  rows: EventReportHourlyRow[];
}

export function HourlyCharts({ rows }: HourlyChartsProps) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.hour_label.localeCompare(b.hour_label));
  const labels = sorted.map((r) => r.hour_label);
  const wifiValues = sorted.map((r) => r.wifi_users ?? 0);
  const bwInValues = sorted.map((r) => r.bandwidth_in ?? 0);
  const bwOutValues = sorted.map((r) => r.bandwidth_out ?? 0);

  return (
    <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateurs Wi-Fi</span>
        </div>
        <LineChart
          labels={labels}
          series={[{ label: 'Wi-Fi', color: '#3b82f6', values: wifiValues }]}
          height={160}
          yMin={1000}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bande passante (GB)</span>
          <Legend
            items={[
              { label: 'Download (↓)', color: '#10b981' },
              { label: 'Upload (↑)', color: '#3b82f6' },
            ]}
          />
        </div>
        <LineChart
          labels={labels}
          series={[
            { label: 'Download', color: '#10b981', values: bwOutValues },
            { label: 'Upload', color: '#3b82f6', values: bwInValues },
          ]}
          yUnit=""
          height={130}
        />
      </div>
    </div>
  );
}

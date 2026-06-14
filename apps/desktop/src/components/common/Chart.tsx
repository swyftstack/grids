/**
 * A tiny, dependency-free chart renderer for dashboard widgets.
 *
 * Takes a query result (fields + rows) and a chart configuration, and draws an SVG bar / line /
 * area / pie chart, a single "number" stat, or a compact table. It is deliberately simple — enough
 * to make a saved query legible at a glance, not a full charting library.
 */
import { useMemo } from 'react';
import type { CellValue, ChartType } from '@swyftgrid/core';
import { formatNumber } from '@swyftgrid/core';

export interface ChartData {
  fields: { name: string }[];
  rows: CellValue[][];
}

interface ChartProps {
  type: ChartType;
  data: ChartData;
  labelColumn?: string;
  valueColumns?: string[];
}

const PALETTE = [
  'rgb(var(--sg-accent))',
  'rgb(var(--sg-info))',
  'rgb(var(--sg-success))',
  'rgb(var(--sg-warning))',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
];

function toNumber(v: CellValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function Chart({ type, data, labelColumn, valueColumns }: ChartProps) {
  const model = useMemo(() => {
    const names = data.fields.map((f) => f.name);
    const idx = (name?: string) => (name ? names.indexOf(name) : -1);
    // Sensible fallbacks: first column is the label, the first numeric column is the value.
    const firstNumeric = data.rows[0]
      ? data.rows[0].findIndex((v) => typeof v === 'number' || Number.isFinite(Number(v)))
      : -1;
    const labelIdx = idx(labelColumn) >= 0 ? idx(labelColumn) : 0;
    const valueIdx =
      idx(valueColumns?.[0]) >= 0 ? idx(valueColumns![0]) : firstNumeric >= 0 ? firstNumeric : 1;
    const points = data.rows.map((r) => ({
      label: String(r[labelIdx] ?? ''),
      value: toNumber(r[valueIdx >= 0 ? valueIdx : 0] ?? null),
    }));
    return { points, valueName: names[valueIdx] ?? names[0] ?? 'value' };
  }, [data, labelColumn, valueColumns]);

  if (!data.rows.length) {
    return <div className="grid h-40 place-items-center text-xs text-content-subtle">No rows</div>;
  }

  if (type === 'number') {
    const value = model.points[0]?.value ?? 0;
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {formatNumber(value)}
        </span>
        <span className="text-2xs uppercase tracking-wide text-content-subtle">
          {model.valueName}
        </span>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="max-h-60 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface text-2xs text-content-subtle">
            <tr className="border-b border-border">
              {data.fields.map((f) => (
                <th key={f.name} className="px-2 py-1.5 text-left font-medium">
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 100).map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 font-mono">
                    {cell === null ? (
                      <span className="text-content-subtle">null</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'pie') return <PieChart points={model.points} />;
  if (type === 'line' || type === 'area')
    return <LineChart points={model.points} area={type === 'area'} />;
  return <BarChart points={model.points} />;
}

type Point = { label: string; value: number };

function BarChart({ points }: { points: Point[] }) {
  const data = points.slice(0, 16);
  const max = Math.max(1, ...data.map((p) => p.value));
  const W = 320;
  const H = 160;
  const gap = 6;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" preserveAspectRatio="none">
        {data.map((p, i) => {
          const h = (p.value / max) * H;
          const x = i * (bw + gap);
          return (
            <g key={i}>
              <rect
                x={x}
                y={H - h}
                width={bw}
                height={h}
                rx={2}
                fill="rgb(var(--sg-accent))"
                opacity={0.85}
              >
                <title>{`${p.label}: ${formatNumber(p.value)}`}</title>
              </rect>
              <text
                x={x + bw / 2}
                y={H + 14}
                textAnchor="middle"
                className="fill-content-subtle"
                style={{ fontSize: 8 }}
              >
                {p.label.length > 8 ? p.label.slice(0, 7) + '…' : p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function LineChart({ points, area }: { points: Point[]; area: boolean }) {
  const data = points.slice(0, 60);
  const max = Math.max(1, ...data.map((p) => p.value));
  const min = Math.min(0, ...data.map((p) => p.value));
  const W = 320;
  const H = 160;
  const x = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * W);
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const fill = `${line} L ${x(data.length - 1)} ${H} L ${x(0)} ${H} Z`;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {area && <path d={fill} fill="rgb(var(--sg-accent))" opacity={0.12} />}
        <path d={line} fill="none" stroke="rgb(var(--sg-accent))" strokeWidth={2} />
        {data.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={2} fill="rgb(var(--sg-accent))">
            <title>{`${p.label}: ${formatNumber(p.value)}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}

function PieChart({ points }: { points: Point[] }) {
  const data = points.slice(0, 8).filter((p) => p.value > 0);
  const total = data.reduce((s, p) => s + p.value, 0) || 1;
  let angle = -Math.PI / 2;
  const R = 70;
  const C = 80;
  const slices = data.map((p, i) => {
    const frac = p.value / total;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = C + R * Math.cos(start);
    const y1 = C + R * Math.sin(start);
    const x2 = C + R * Math.cos(end);
    const y2 = C + R * Math.sin(end);
    return {
      d: `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`,
      color: PALETTE[i % PALETTE.length],
      label: p.label,
      value: p.value,
      pct: Math.round(frac * 100),
    };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="rgb(var(--sg-surface))" strokeWidth={1}>
            <title>{`${s.label}: ${formatNumber(s.value)} (${s.pct}%)`}</title>
          </path>
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="text-content-subtle">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

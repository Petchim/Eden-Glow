import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { money, moneyShort, pct } from '../lib/format.ts';

/* Small dependency-free SVG charts drawn at the container's real pixel width, so text never
   stretches. Colours come from the admin palette (burgundy → rose → blush). */
export const SERIES = ['#7a1830', '#c25e74', '#e29aa8', '#f2c9cf', '#b98a8f', '#ead9da'];

function useWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * mag;
}

interface TipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}

function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div className="ad-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.title}</strong>
      {tip.rows.map((r) => (
        <span key={r.label}>
          {r.color && <i style={{ background: r.color }} />}
          {r.label}: {r.value}
        </span>
      ))}
    </div>
  );
}

/**
 * Bars (one or two series) with an optional line for the darker series.
 * data: [{ label, a, b? }]  series: [{ key, label, color }]
 */
export interface ChartSeries<K extends string> {
  key: K;
  label: string;
  color?: string;
}

interface BarChartProps<K extends string> {
  data: (Record<K, number> & { label: string })[];
  series: ChartSeries<K>[];
  height?: number;
  /** Draw a line through the last series. */
  line?: boolean;
  labelEvery?: number;
  ariaLabel?: string;
}

export function BarChart<K extends string>({ data, series, height = 220, line = false, labelEvery, ariaLabel }: BarChartProps<K>) {
  const [ref, w] = useWidth();
  const [tip, setTip] = useState<TipState | null>(null);
  const pad = { l: 46, r: 8, t: 12, b: 28 };
  const iw = Math.max(w - pad.l - pad.r, 10);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.flatMap((d) => series.map((s) => d[s.key] || 0)), 0) * 1.05);
  const step = iw / Math.max(data.length, 1);
  const groupW = Math.min(step * 0.7, 34);
  const barW = groupW / series.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const every = labelEvery || Math.max(1, Math.ceil(data.length / Math.max(Math.floor(iw / 56), 1)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const lineKey = line ? series[series.length - 1].key : null;
  const total = data.reduce((s, d) => s + series.reduce((t, k) => t + (d[k.key] || 0), 0), 0);

  return (
    <div className="ad-chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel || `Chart, total ${money(total)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="ad-grid" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="ad-axis">
                {moneyShort(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + step * i + step / 2;
            return (
              <g key={d.label + i}>
                {series.map((s, k) => {
                  const v = d[s.key] || 0;
                  const h = Math.max((v / max) * ih, v > 0 ? 2 : 0);
                  const color = s.color || (series.length === 1 ? (i % 3 === 1 ? SERIES[0] : i % 3 === 2 ? SERIES[1] : SERIES[2]) : SERIES[k]);
                  return <rect key={s.key} x={cx - groupW / 2 + k * barW} y={pad.t + ih - h} width={Math.max(barW - 2, 2)} height={h} rx={Math.min(3, barW / 3)} fill={color} />;
                })}
                <rect
                  x={cx - step / 2}
                  y={pad.t}
                  width={step}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() =>
                    setTip({
                      x: Math.min(Math.max(cx, 70), w - 70),
                      y: 0,
                      title: d.label,
                      rows: series.map((s, k) => ({ label: s.label, value: money(d[s.key] || 0), color: s.color || SERIES[k] })),
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
                {i % every === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" className="ad-axis">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          {lineKey && (
            <polyline
              className="ad-line"
              fill="none"
              points={data.map((d, i) => `${pad.l + step * i + step / 2},${y(d[lineKey] || 0)}`).join(' ')}
            />
          )}
        </svg>
      )}
      <Tip tip={tip} />
    </div>
  );
}

export interface DonutItem {
  label: string;
  value: number;
  color?: string;
}

interface DonutProps {
  items: DonutItem[];
  centerLabel: string;
  centerValue: ReactNode;
  size?: number;
  thickness?: number;
  /** Legend shows each share as a percentage or an amount. */
  legendValue?: 'pct' | 'money';
}

/** Ring chart with legend. items: [{ label, value }] */
export function Donut({ items, centerLabel, centerValue, size = 170, thickness = 30, legendValue = 'pct' }: DonutProps) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = size / 2 - thickness / 2 - 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="ad-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f6e3e2" strokeWidth={thickness} />
        {total > 0 &&
          items.map((it, k) => {
            const len = (it.value / total) * c;
            const el = (
              <circle
                key={it.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={it.color || SERIES[k % SERIES.length]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
                strokeDashoffset={-acc}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${it.label}: ${money(it.value)}`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        <text x="50%" y="47%" textAnchor="middle" className="ad-donut-v">
          {centerValue}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="ad-donut-l">
          {centerLabel}
        </text>
      </svg>
      <ul className="ad-legend">
        {items.map((it, k) => (
          <li key={it.label}>
            <i style={{ background: it.color || SERIES[k % SERIES.length] }} />
            <span>{it.label}</span>
            <b>{legendValue === 'money' ? money(it.value) : total ? pct((it.value / total) * 100) : '0%'}</b>
          </li>
        ))}
        {!items.length && <li className="ad-muted">No data for this period</li>}
      </ul>
    </div>
  );
}

/** Keep the top N, fold the rest into "Others". */
export function topN(entries: DonutItem[], n = 5): DonutItem[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  if (sorted.length <= n + 1) return sorted;
  const rest = sorted.slice(n).reduce((s, e) => s + e.value, 0);
  return [...sorted.slice(0, n), { label: 'Others', value: rest }];
}

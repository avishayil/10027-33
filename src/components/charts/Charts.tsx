/**
 * The chart kit (V1 visual outputs). Hand-built, dependency-free, CSP-safe (no inline scripts, no network). Rules from
 * the data-viz method: thin marks with 4px rounded data-ends, 2px surface gaps, hairline recessive axes, one axis per
 * chart, a legend for ≥ 2 series, selective direct labels, text never in the series colour, tooltips on hover AND
 * keyboard focus (they enhance — every value is also in the table beside the chart), right-to-left by default (bars
 * grow from the start side), time running left to right. Colours: the validated reference categorical order (owner =
 * blue, developer = orange, third = aqua…), status green/red only for better/worse with an arrow and a word.
 */
import { useRef, useState, type ReactNode } from 'react';

export const SERIES = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'];
/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Text colour inside a filled mark: white or near-black, whichever contrasts more with the fill. */
export const ON_SERIES = (c: string) => (contrast(luminance(c), 1) >= contrast(luminance(c), luminance('#0b0b0b')) ? '#ffffff' : '#0b0b0b');
export const C = {
  owner: SERIES[0],
  developer: SERIES[1],
  third: SERIES[2],
  muted: '#c2c2c2',
  total: '#0f4a96',
  good: '#0aac23',
  bad: '#dc3c3d',
};

interface Tip {
  x: number;
  y: number;
  text: string;
}

/** A figure with a title, an optional legend and a shared tooltip for every `[data-tip]` mark inside it. */
export function Figure({
  title,
  sub,
  legend,
  children,
  label,
  note,
}: {
  title?: string;
  sub?: string;
  legend?: { label: string; color: string; shape?: 'line' | 'box' }[];
  children: ReactNode;
  /** Accessible name of the figure (defaults to the title). */
  label?: string;
  note?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (el: Element | null) => {
    const t = el?.closest('[data-tip]');
    if (!t || !ref.current) return setTip(null);
    const box = ref.current.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2 - box.left, y: r.top - box.top, text: t.getAttribute('data-tip') ?? '' });
  };
  return (
    <figure className="viz" aria-label={label ?? title}>
      {(title || sub) && (
        <figcaption className="viz-head">
          {title && <span className="viz-title">{title}</span>}
          {sub && <span className="viz-sub">{sub}</span>}
        </figcaption>
      )}
      {legend && legend.length > 1 && (
        <ul className="viz-legend" aria-label="מקרא">
          {legend.map((l) => (
            <li key={l.label}>
              <span className={`viz-key ${l.shape === 'line' ? 'viz-key-line' : ''}`} style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div
        className="viz-body"
        ref={ref}
        onPointerOver={(e) => show(e.target as Element)}
        onPointerLeave={() => setTip(null)}
        onFocus={(e) => show(e.target as Element)}
        onBlur={() => setTip(null)}
      >
        {children}
        {tip && (
          <div className="viz-tip" role="status" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
      {note && <p className="viz-note">{note}</p>}
    </figure>
  );
}

const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%`;

export interface BarRow {
  id: string;
  label: string;
  value: number;
  /** The value as text (at the bar's tip). */
  text: string;
  sub?: string;
  /** The row the story is about (accent); others are context (gray) when any row is emphasised. */
  emphasis?: boolean;
  color?: string;
}

/** Ranked horizontal bars from one baseline (start side). Negative values grow the other way from a centre line. */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const anyEmphasis = rows.some((r) => r.emphasis);
  const signed = rows.some((r) => r.value < 0);
  const m = max ?? Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className={`viz-bars ${signed ? 'viz-bars-signed' : ''}`} role="list">
      {rows.map((r) => {
        const w = Math.abs(r.value) / m;
        const color = r.color ?? (anyEmphasis && !r.emphasis ? C.muted : C.owner);
        return (
          <div key={r.id} className="viz-bar-row" role="listitem" tabIndex={0} data-tip={`${r.label}: ${r.text}`}>
            <span className="viz-bar-label">
              {r.label}
              {r.sub && <span className="viz-bar-sub">{r.sub}</span>}
            </span>
            <span className="viz-bar-track">
              {signed ? (
                <>
                  <span className="viz-bar-half viz-bar-neg">{r.value < 0 && <span className="viz-bar viz-bar-end" style={{ width: pct(w), background: color }} />}</span>
                  <span className="viz-bar-half viz-bar-pos">{r.value > 0 && <span className="viz-bar" style={{ width: pct(w), background: color }} />}</span>
                </>
              ) : (
                r.value !== 0 && <span className="viz-bar" style={{ width: pct(w), background: color }} />
              )}
            </span>
            <span className={`viz-bar-value ${r.emphasis ? 'viz-strong' : ''}`}>{r.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface Part {
  key: string;
  label: string;
  value: number;
  color: string;
  text: string;
}

/** One whole split into parts. Tall: amounts inside where they fit, legend below. Thin: no text (figures beside it). */
export function SegmentedBar({ parts, tall = false, legend = true }: { parts: Part[]; tall?: boolean; legend?: boolean }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) return null;
  return (
    <div className="viz-seg-wrap">
      <div className={`viz-seg ${tall ? 'viz-seg-tall' : 'viz-seg-thin'}`} role="img" aria-label={parts.map((p) => `${p.label}: ${p.text}`).join('; ')}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const share = p.value / total;
            return (
              <span key={p.key} className="viz-seg-part" tabIndex={0} data-tip={`${p.label}: ${p.text} (${Math.round(share * 100)}%)`} style={{ flexGrow: share, background: p.color, color: ON_SERIES(p.color) }}>
                {tall && share >= 0.16 ? p.text : ''}
              </span>
            );
          })}
      </div>
      {legend && (
        <ul className="viz-legend viz-legend-inline">
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <li key={p.key}>
                <span className="viz-key" style={{ background: p.color }} aria-hidden="true" />
                {p.label}
                {(!tall || p.value / total < 0.16) && <span className="viz-legend-figure">{p.text}</span>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/** A ratio against a limit, with an optional marker (e.g. the developer's hurdle). */
export function Meter({ value, max, text, marker, color = C.owner }: { value: number; max: number; text: string; marker?: { value: number; label: string }; color?: string }) {
  const w = max > 0 ? value / max : 0;
  return (
    <div className="viz-meter" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text} tabIndex={0} data-tip={text}>
      <span className="viz-meter-track">
        <span className="viz-meter-fill" style={{ width: pct(w), background: color }} />
        {marker && <span className="viz-meter-marker" style={{ insetInlineStart: pct(marker.value / max) }} title={marker.label} />}
      </span>
      <span className="viz-meter-text">
        {text}
        {marker && <span className="viz-bar-sub">{marker.label}</span>}
      </span>
    </div>
  );
}

export interface Step {
  label: string;
  value: number;
  text: string;
}

/** A bridge: each step moves the running total; the total closes it. Up = blue, down = red, total = dark blue. */
export function Waterfall({ steps, total }: { steps: Step[]; total: Step }) {
  const marks = bridge(steps);
  const lo = Math.min(0, ...marks.map((m) => Math.min(m.from, m.to)), total.value);
  const hi = Math.max(0, ...marks.map((m) => Math.max(m.from, m.to)), total.value);
  const span = Math.max(1e-9, hi - lo);
  const pos = (x: number) => (x - lo) / span;
  const row = (key: string, label: string, text: string, a: number, b: number, color: string, strong = false) => (
    <div key={key} className={`viz-wf-row ${strong ? 'viz-wf-total' : ''}`} role="listitem" tabIndex={0} data-tip={`${label}: ${text}`}>
      <span className="viz-bar-label">{label}</span>
      <span className="viz-bar-track viz-wf-track">
        {lo < 0 && <span className="viz-wf-zero" style={{ insetInlineStart: pct(pos(0)) }} />}
        <span className="viz-wf-bar" style={{ insetInlineStart: pct(pos(Math.min(a, b))), width: pct(Math.abs(b - a) / span), background: color }} />
      </span>
      <span className={`viz-bar-value ${strong ? 'viz-strong' : ''}`}>{text}</span>
    </div>
  );
  return (
    <div className="viz-wf" role="list">
      {marks.map((m, i) => row(`s${i}`, m.label, m.text, m.from, m.to, m.value >= 0 ? C.owner : C.bad))}
      {row('total', total.label, total.text, 0, total.value, C.total, true)}
    </div>
  );
}

/** Running from / to of each bridge step (pure). */
export function bridge(steps: Step[]): (Step & { from: number; to: number })[] {
  const out: (Step & { from: number; to: number })[] = [];
  steps.forEach((s, i) => {
    const from = i === 0 ? 0 : out[i - 1].to;
    out.push({ ...s, from, to: from + s.value });
  });
  return out;
}

/** Two measures per row on one scale (e.g. worth to you vs cost to the developer). */
export function PairedBars({
  rows,
  series,
}: {
  rows: { id: string; label: string; a: number | null; b: number | null; aText: string; bText: string; sub?: string }[];
  series: [{ label: string; color: string }, { label: string; color: string }];
}) {
  const m = Math.max(1e-9, ...rows.flatMap((r) => [Math.abs(r.a ?? 0), Math.abs(r.b ?? 0)]));
  return (
    <div className="viz-pairs" role="list">
      {rows.map((r) => (
        <div key={r.id} className="viz-pair-row" role="listitem">
          <span className="viz-bar-label">
            {r.label}
            {r.sub && <span className="viz-bar-sub">{r.sub}</span>}
          </span>
          <span className="viz-pair-bars">
            {([
              [r.a, r.aText, series[0]],
              [r.b, r.bText, series[1]],
            ] as const).map(([v, t, s], i) => (
              <span key={i} className="viz-pair-line" tabIndex={0} data-tip={`${s.label}: ${t}`}>
                <span className="viz-bar-track">{v !== null && v !== 0 && <span className="viz-bar" style={{ width: pct(Math.abs(v) / m), background: s.color }} />}</span>
                <span className="viz-bar-value">{v === null ? '—' : t}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Ranges on one shared axis (e.g. the combination % where each side accepts), with optional point markers. */
export function RangeAxis({
  min,
  max,
  ticks,
  format,
  rows,
  marker,
}: {
  min: number;
  max: number;
  ticks: number[];
  format: (x: number) => string;
  rows: { id: string; label: string; ranges: { from: number; to: number; color: string; label: string; lane: number }[] }[];
  marker?: { value: number; label: string };
}) {
  const p = (x: number) => (Math.max(min, Math.min(max, x)) - min) / (max - min);
  return (
    <div className="viz-ranges" role="list">
      {rows.map((r) => (
        <div key={r.id} className="viz-range-row" role="listitem">
          <span className="viz-bar-label">{r.label}</span>
          <span className="viz-range-track">
            {r.ranges.map((g, i) => (
              <span
                key={i}
                className="viz-range"
                tabIndex={0}
                data-tip={`${g.label}: ${g.from === g.to ? format(g.from) : `${format(g.from)}–${format(g.to)}`}`}
                style={{ insetInlineStart: pct(p(g.from)), width: `max(6px, ${pct(p(g.to) - p(g.from))})`, background: g.color, top: `${3 + g.lane * 9}px` }}
              />
            ))}
            {marker && <span className="viz-range-marker" style={{ insetInlineStart: pct(p(marker.value)) }} title={marker.label} />}
          </span>
        </div>
      ))}
      <div className="viz-range-row viz-range-axis" aria-hidden="true">
        <span className="viz-bar-label" />
        <span className="viz-range-track viz-range-ticks">
          {ticks.map((t, i) => (
            <span key={t} className={`viz-tick ${i === 0 ? 'viz-tick-first' : i === ticks.length - 1 ? 'viz-tick-last' : ''}`} style={{ insetInlineStart: pct(p(t)) }}>
              {format(t)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** Three values per row on one axis (favourable · base · adverse), joined by a hairline. */
export function DotRange({
  rows,
  series,
  format,
}: {
  rows: { id: string; label: string; values: (number | null)[]; emphasis?: boolean }[];
  series: { label: string; color: string }[];
  format: (x: number) => string;
}) {
  const all = rows.flatMap((r) => r.values.filter((v): v is number => v !== null));
  if (!all.length) return null;
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all);
  const p = (x: number) => (x - lo) / Math.max(1e-9, hi - lo);
  return (
    <div className="viz-dots" role="list">
      {rows.map((r) => {
        const vs = r.values.filter((v): v is number => v !== null);
        return (
          <div key={r.id} className={`viz-dot-row ${r.emphasis ? 'viz-strong' : ''}`} role="listitem">
            <span className="viz-bar-label">{r.label}</span>
            <span className="viz-dot-track">
              {vs.length > 1 && <span className="viz-dot-span" style={{ insetInlineStart: pct(p(Math.min(...vs))), width: pct(p(Math.max(...vs)) - p(Math.min(...vs))) }} />}
              {r.values.map((v, i) =>
                v === null ? null : (
                  <span key={i} className="viz-dot" tabIndex={0} data-tip={`${series[i].label}: ${format(v)}`} style={{ insetInlineStart: pct(p(v)), background: series[i].color }} />
                ),
              )}
            </span>
            <span className="viz-bar-value">{r.values[1] === null ? '—' : format(r.values[1]!)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Lines over time (≤ 3 series, one axis), with a crosshair readout of every series at the nearest x. */
export function LineChart({
  series,
  xs,
  xLabel,
  yFormat,
  height = 180,
}: {
  series: { label: string; color: string; ys: number[] }[];
  xs: number[];
  xLabel: (x: number) => string;
  yFormat: (y: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { l: 56, r: 12, t: 10, b: 24 };
  const all = series.flatMap((s) => s.ys);
  const yMax = Math.max(1, ...all);
  const yMin = Math.min(0, ...all);
  const nice = niceTicks(yMin, yMax, 4);
  const top = nice[nice.length - 1];
  const bottom = nice[0];
  const x = (i: number) => pad.l + (i / Math.max(1, xs.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - bottom) / Math.max(1e-9, top - bottom)) * (H - pad.t - pad.b);
  const near = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(xs.length - 1, Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * (xs.length - 1))));
  };
  const readout = hover === null ? null : `${xLabel(xs[hover])}: ${series.map((s) => `${s.label} ${yFormat(s.ys[hover])}`).join(' · ')}`;
  return (
    <div className="viz-line" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={series.map((s) => `${s.label}: ${xLabel(xs[0])} ${yFormat(s.ys[0])} → ${xLabel(xs[xs.length - 1])} ${yFormat(s.ys[s.ys.length - 1])}`).join('; ')}
        tabIndex={0}
        onPointerMove={(e) => setHover(near(e.clientX, e.currentTarget))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((h) => Math.min(xs.length - 1, (h ?? -1) + 1));
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? xs.length) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        {nice.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-axis' : 'viz-grid'} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="viz-tick-text">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xs.map((v, i) =>
          i === 0 || i === xs.length - 1 || i % Math.ceil(xs.length / 6) === 0 ? (
            <text key={v} x={x(i)} y={H - 6} textAnchor="middle" className="viz-tick-text">
              {xLabel(v)}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.ys.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            <circle cx={x(s.ys.length - 1)} cy={y(s.ys[s.ys.length - 1])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="viz-crosshair" />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.ys[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      <p className="viz-readout" aria-live="polite" dir="rtl">
        {readout ?? 'העבירו את הסמן (או חצים במקלדת) כדי לראות כל שנה'}
      </p>
    </div>
  );
}

/** Clean axis ticks (1 / 2 / 2.5 / 5 × 10ⁿ) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = Math.max(1e-9, hi - lo);
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) out.push(Math.round(v / step) * step);
  if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
  return out;
}

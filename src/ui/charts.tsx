/**
 * Data-viz in the Halo grammar (Assets › Data-viz): one bright series in blue, the rest in neutral tones, values in
 * tabular figures. Bars (Asset/Chart/Bars), area curve that draws itself (Anim · Courbe), rings (Asset/Chart/Ring,
 * Asset/Health/ActivityRings), KPI card with rolling numbers (NumberFlow, Anim · Compteur).
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { cn } from './cn';
import { motionTokens } from '../theme/motion';

export function KpiCard({ label, value, suffix, decimals = 0, of, active, onClick, className }: { label: string; value: number; suffix?: string; decimals?: number; of?: number; active?: boolean; onClick?: () => void; className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'glass-panel flex min-w-0 flex-col items-start justify-between gap-1 rounded-xl px-4 py-3.5 text-left transition-[border-color,box-shadow]',
        active && '!border-border-accent !shadow-[0_0_0_1px_var(--color-border-accent),0_0_24px_rgb(90_162_255/0.28)] max-md:!shadow-[0_0_0_1px_var(--color-border-accent),0_0_12px_rgb(90_162_255/0.3)]',
        onClick && 'hover:border-border-strong',
        className,
      )}
    >
      <span className="w-full truncate text-label-s text-text-secondary max-md:line-clamp-2 max-md:whitespace-normal">{label}</span>
      <span className={cn('tnum flex items-baseline gap-1 text-data-l', active ? 'text-text-accent' : 'text-text-primary')}>
        <NumberFlow value={value} locales="fr-FR" format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }} />
        {of !== undefined && <span className="text-title-m text-text-muted">/&#8239;{of}</span>}
        {suffix && <span className="text-title-m text-text-secondary">{suffix}</span>}
      </span>
    </Tag>
  );
}

/** KPI whose value is a text (pace « 5:42 /km »). Labels span the card (w-full): with items-start they took the width
 *  of their text and overflowed the card instead of being cut. */
export function KpiText({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('glass-panel flex min-w-0 flex-col items-start justify-between gap-1 rounded-xl px-4 py-3.5', className)}>
      <span className="w-full truncate text-label-s text-text-secondary max-md:line-clamp-2 max-md:whitespace-normal">{label}</span>
      <span className="tnum w-full truncate text-data-l text-text-primary">{value}</span>
    </div>
  );
}

/** Weekly bars: the last bar (current week) in accent, the others neutral. */
export function WeekBars({ data, format, height = 150, labels }: { data: { label: string; value: number }[]; format: (v: number) => string; height?: number; labels?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const t = motionTokens();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const last = i === data.length - 1;
          const h = Math.max(4, (d.value / max) * (height - 22));
          return (
            <div key={d.label + i} className="group/bar relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className={cn('tnum mb-1 text-caption whitespace-nowrap transition-opacity', last ? 'text-text-accent opacity-100' : 'text-text-secondary opacity-0 group-hover/bar:opacity-100')}>{format(d.value)}</span>
              <motion.span
                className={cn('w-full max-w-7 rounded-full', last ? 'bg-accent-default shadow-glow-accent' : 'bg-route-rest/45 group-hover/bar:bg-route-rest/70')}
                initial={{ height: 4 }}
                animate={{ height: h }}
                transition={{ duration: t.medium * 1.6, ease: t.expo, delay: i * 0.03 }}
              />
            </div>
          );
        })}
      </div>
      {labels && (
        <div className="flex gap-2">
          {data.map((d, i) => (
            <span key={d.label + i} className={cn('min-w-0 flex-1 truncate text-center text-caption', i === data.length - 1 ? 'text-text-accent' : 'text-text-muted')}>
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Monotone cubic (Fritsch–Carlson): smooth, but never above a peak nor under zero between two points. */
function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n < 2) return '';
  const dx = points.slice(1).map((p, i) => p[0] - points[i]![0]);
  const slope = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / (dx[i] || 1));
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b);
  });
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${x1 + h},${y1 + tangent[i]! * h} ${x2 - h},${y2 - tangent[i + 1]! * h} ${x2},${y2}`;
  }
  return d;
}

/** Smooth area curve; the line draws itself, the last point breathes (halo live). Fills its container, drawn at its
 *  real pixel size so the labels keep the type scale. */
export function AreaCurve({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const id = useId().replace(/:/g, '');
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const t = motionTokens();
  const W = size?.w ?? 0;
  const H = size?.h ?? 0;
  const padX = 18;
  const top = 34;
  const bottom = 30;
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.1;
  const pts: [number, number][] = data.map((d, i) => [padX + (i * (W - padX * 2)) / Math.max(1, data.length - 1), top + (1 - d.value / max) * (H - top - bottom)]);
  const line = W > 0 ? smoothPath(pts) : '';
  const last = pts[pts.length - 1];
  return (
    <div ref={box} className="relative h-full min-h-[160px] w-full">
      {size && W > 0 && (
        <svg width={W} height={H} className="absolute inset-0 overflow-visible" role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-accent-default)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--color-accent-default)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={padX} x2={W - padX} y1={top + g * (H - top - bottom)} y2={top + g * (H - top - bottom)} stroke="var(--color-border-default)" strokeDasharray="3 6" />
          ))}
          {line && <motion.path d={`${line} L${last![0]},${H - bottom} L${pts[0]![0]},${H - bottom} Z`} fill={`url(#area-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.5 }} />}
          {line && <motion.path d={line} fill="none" stroke="var(--color-accent-default)" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: t.expo }} style={{ filter: 'drop-shadow(0 0 6px rgb(90 162 255 / 0.45))' }} />}
          {data.map((d, i) => {
            // As many labels as fit (about 44 px each), counted back from the last one, which is always shown.
            const every = Math.max(1, Math.ceil((data.length * 44) / Math.max(1, W - padX * 2)));
            const last = i === data.length - 1;
            if (!last && (data.length - 1 - i) % every !== 0) return null;
            return (
              <text key={d.label + i} x={pts[i]![0]} y={H - 8} textAnchor="middle" fontSize="11" className={last ? 'fill-text-accent' : 'fill-text-muted'}>
                {d.label}
              </text>
            );
          })}
          {last && (
            <g>
              <circle cx={last[0]} cy={last[1]} r="10" fill="var(--color-accent-default)" opacity="0.18">
                <animate attributeName="r" values="6;14;6" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle cx={last[0]} cy={last[1]} r="5" fill="var(--color-bg-card)" stroke="var(--color-accent-default)" strokeWidth="2.5" />
              <text x={last[0] - 12} y={last[1] - 14} textAnchor="end" fontSize="13" fontWeight="500" className="tnum fill-text-accent">
                {format(data[data.length - 1]!.value)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

/** Progress ring (Asset/Chart/Ring) with free content in the middle. */
export function Ring({ value, size = 120, stroke = 10, tone = 'accent', children }: { value: number; size?: number; stroke?: number; tone?: 'accent' | 'signal' | 'warn'; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === 'accent' ? 'var(--color-accent-default)' : tone === 'signal' ? 'var(--color-signal-default)' : 'var(--color-warn-default)';
  const t = motionTokens();
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-hover)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1, ease: t.expo }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Three concentric rings (Asset/Health/ActivityRings): tasks, habits, sport. */
export function ActivityRings({ rings, size = 150 }: { rings: { value: number; color: string; label: string }[]; size?: number }) {
  const stroke = 12;
  const gap = 4;
  const t = motionTokens();
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" role="img" aria-label={rings.map((r) => `${r.label} ${Math.round(r.value * 100)} %`).join(', ')}>
      {rings.map((ring, i) => {
        const r = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * r;
        const v = Math.max(0, Math.min(1, ring.value));
        return (
          <g key={ring.label}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeOpacity="0.16" strokeWidth={stroke} />
            <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1.1, ease: t.expo, delay: 0.15 + i * 0.12 }} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * NotchCard (Halo signature, Organismes › ShipmentCard, Foundations › Encoche): a card whose top-right corner is
 * carved out (radius 28, concave fillet, gap 10 around the button) with a round button sitting in the notch. One per
 * screen at most, only for an object (here: the next gym session).
 * The shape is a path computed for the measured size (Benchmark › « clip-path avec le tracé SVG »); clip-path cuts
 * box-shadow and border, so the rim and the soft shadow are drawn in SVG around it. WebKit does not cut a backdrop-filter
 * by a clip-path (the notch showed frosted): there the frost lies in two rounded boxes beside and under the notch.
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE } from './atoms';
import { useLiquidGlass, webkitBackdrop } from './glass';

const R = 28; // radius/2xl
const BUTTON = 52;
const GAP = 10; // notch/gap
const S = BUTTON + GAP;

function notchPath(w: number, h: number): string {
  return [
    `M${R},0`,
    `H${w - S - R}`,
    `A${R} ${R} 0 0 1 ${w - S},${R}`,
    `V${S - R}`,
    `A${R} ${R} 0 0 0 ${w - S + R},${S}`,
    `H${w - R}`,
    `A${R} ${R} 0 0 1 ${w},${S + R}`,
    `V${h - R}`,
    `A${R} ${R} 0 0 1 ${w - R},${h}`,
    `H${R}`,
    `A${R} ${R} 0 0 1 0,${h - R}`,
    `V${R}`,
    `A${R} ${R} 0 0 1 ${R},0`,
    'Z',
  ].join(' ');
}

export function NotchCard({ children, onAction, actionLabel, className }: { children: ReactNode; onAction: () => void; actionLabel: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const id = useId().replace(/:/g, '');
  const glass = useLiquidGlass<HTMLButtonElement>({ bezel: 18, strength: 12 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const d = size && size.w > S * 2 && size.h > S * 2 ? notchPath(size.w, size.h) : null;
  return (
    <div ref={box} className={cn('relative', className)}>
      {d && size && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h}>
          <defs>
            <mask id={`out-${id}`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={size.w + 120} height={size.h + 120}>
              <rect x={-60} y={-60} width={size.w + 120} height={size.h + 120} fill="white" />
              <path d={d} fill="black" />
            </mask>
            <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>
          <g mask={`url(#out-${id})`}>
            <path d={d} transform="translate(0 10)" fill="rgb(14 16 20 / 0.12)" filter={`url(#soft-${id})`} />
          </g>
        </svg>
      )}
      {d && webkitBackdrop && (
        <>
          <span aria-hidden className="chip-frost pointer-events-none absolute inset-y-0 left-0" style={{ right: S, borderRadius: `${R}px ${R}px 0 ${R}px` }} />
          <span aria-hidden className="chip-frost pointer-events-none absolute right-0 bottom-0" style={{ top: S, width: S, borderRadius: `0 ${R}px ${R}px 0` }} />
        </>
      )}
      <div
        className={cn('relative h-full overflow-hidden', d ? cn('bg-(--glass-panel)', !webkitBackdrop && 'backdrop-blur-[24px] backdrop-saturate-[1.7]') : 'glass-panel rounded-2xl')}
        style={d ? { clipPath: `path('${d}')` } : undefined}
      >
        {children}
      </div>
      {d && size && (
        <svg aria-hidden className="pointer-events-none absolute inset-0" width={size.w} height={size.h}>
          <defs>
            <clipPath id={`in-${id}`}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill="none" stroke="var(--glass-rim-light)" strokeWidth="3" clipPath={`url(#in-${id})`} opacity="0.9" />
        </svg>
      )}
      <button
        ref={glass}
        type="button"
        onClick={onAction}
        aria-label={actionLabel}
        className="liquid absolute top-0 right-0 inline-flex items-center justify-center rounded-full text-text-primary transition-transform duration-(--v-duree-courte) hover:scale-105 active:scale-95"
        style={{ width: BUTTON, height: BUTTON }}
      >
        <ChevronRight size={22} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </div>
  );
}

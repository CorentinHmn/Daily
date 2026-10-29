/**
 * Floating layer anchored to an element (menus, selects, pickers, quick add), in liquid glass.
 * Portal to <body>, fixed position under the anchor (above when there is no room), same width as the anchor unless
 * `width` is given. Closes on outside click and Escape; follows the anchor when a panel scrolls.
 * It comes out of its trigger like the rail's wave: a drop as wide as the trigger, just under it, that swells into the
 * panel with the same spring (clip-path keyframes), the content fading in; it flows back into the trigger to close.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './cn';
import { useLiquidGlass } from './glass';
import { motionTokens } from '../theme/motion';
import { SPRING, reducedMotion } from './liquid';

interface Place {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  above: boolean;
  /** The trigger's span across the panel: px from the panel's left and right edges (where the drop comes out). */
  from: { left: number; right: number };
}

/**
 * Transform keyframes from the drop at the trigger (as wide as it, a sliver high) to the whole panel, on the bars'
 * spring (its overshoot halved: a panel swells a little past its size, then settles). Scaling, not clipping: the
 * panel's glass, rim and shadow grow with it, and the compositor plays it.
 */
function emerge(place: Place): string[] {
  const sx = Math.max(0.25, Math.min(1, (place.width - place.from.left - place.from.right) / place.width));
  const sy = 0.16;
  return SPRING.frames.map(({ p }) => {
    const q = p > 1 ? 1 + (p - 1) * 0.5 : p;
    return `scale(${(sx + (1 - sx) * q).toFixed(4)}, ${(sy + (1 - sy) * q).toFixed(4)})`;
  });
}

const GAP = 6;
const MARGIN = 12;

function measure(anchor: HTMLElement, width: number | 'anchor', align: 'start' | 'end', preferredHeight: number): Place {
  const r = anchor.getBoundingClientRect();
  const w = width === 'anchor' ? r.width : width;
  const below = window.innerHeight - r.bottom - MARGIN;
  const aboveSpace = r.top - MARGIN;
  // Opens where it fits whole, else on the roomier side (a 10-item menu opened low on the screen was cut short).
  const above = below < preferredHeight && aboveSpace > below;
  let left = align === 'end' ? r.right - w : r.left;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
  const from = { left: Math.max(0, Math.min(w, r.left - left)), right: Math.max(0, Math.min(w, left + w - r.right)) };
  // Fits on neither side but fits the screen: slide it up over the anchor rather than cutting it.
  if (Math.max(below, aboveSpace) - GAP < preferredHeight && preferredHeight <= window.innerHeight - MARGIN * 2) {
    return { top: window.innerHeight - MARGIN - preferredHeight, left, width: w, maxHeight: preferredHeight, above: false, from };
  }
  const maxHeight = Math.max(160, Math.min(preferredHeight, (above ? aboveSpace : below) - GAP));
  return { top: above ? r.top - GAP : r.bottom + GAP, left, width: w, maxHeight, above, from };
}

export function Popover({
  open,
  anchor,
  onClose,
  children,
  width = 'anchor',
  align = 'start',
  maxHeight = 320,
  className,
  role,
  label,
  id,
}: {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  width?: number | 'anchor';
  align?: 'start' | 'end';
  maxHeight?: number;
  className?: string;
  role?: string;
  label?: string;
  id?: string;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 14, strength: 10, blur: 8 });
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    // Measured in a frame callback (the panel starts transparent, so the first frame never shows a stale place).
    const update = () => {
      if (anchor.current) setPlace(measure(anchor.current, width, align, maxHeight));
    };
    const raf = requestAnimationFrame(update);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        anchor.current?.focus();
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchor, width, align, maxHeight]);

  const t = motionTokens();
  const still = reducedMotion();
  const frames = place && !still ? emerge(place) : null;
  return createPortal(
    <AnimatePresence>
      {open && place && (
        <motion.div
          ref={(el) => {
            panel.current = el;
            glass(el);
          }}
          data-popover=""
          // Portalled to <body>, but React still bubbles its clicks to the trigger's ancestors: a « Supprimer » in a
          // task row's menu also clicked the row, which opened the (now deleted) task as « Nouvelle tâche ».
          onClick={(e) => e.stopPropagation()}
          id={id}
          role={role}
          aria-label={label}
          initial={frames ? { transform: frames[0], opacity: 0 } : { opacity: 0 }}
          animate={frames ? { transform: frames, opacity: 1, transition: { transform: { duration: SPRING.ms / 1000, ease: 'linear' }, opacity: { duration: 0.08 } } } : { opacity: 1, transition: { duration: t.short } }}
          exit={frames ? { transform: frames[0], opacity: 0, transition: { transform: { duration: 0.2, ease: [0.5, 0, 0.9, 0.6] }, opacity: { duration: 0.08, delay: 0.12 } } } : { opacity: 0, transition: { duration: t.short } }}
          style={{
            position: 'fixed',
            left: place.left,
            width: place.width,
            maxHeight: place.maxHeight,
            ...(place.above ? { bottom: window.innerHeight - place.top } : { top: place.top }),
            // It grows from the trigger: the middle of the trigger's span, on the side facing it.
            transformOrigin: `${place.from.left + (place.width - place.from.left - place.from.right) / 2}px ${place.above ? '100%' : '0%'}`,
          }}
          className={cn('liquid liquid-strong z-[1350] flex flex-col overflow-hidden rounded-lg', className)}
        >
          {/* The content shows once the glass has come out, and leaves first. */}
          <motion.div
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: still ? 1 : 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, delay: still ? 0 : SPRING.ms / 1000 * 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

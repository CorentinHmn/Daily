/**
 * Floating layer anchored to an element (menus, selects, quick add), in liquid glass.
 * Portal to <body>, fixed position under the anchor (above when there is no room), same width as the anchor unless
 * `width` is given. Closes on outside click and Escape; follows the anchor when a panel scrolls.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './cn';
import { useLiquidGlass } from './glass';
import { motionTokens } from '../theme/motion';

interface Place {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  above: boolean;
}

const GAP = 6;
const MARGIN = 12;

function measure(anchor: HTMLElement, width: number | 'anchor', align: 'start' | 'end', preferredHeight: number): Place {
  const r = anchor.getBoundingClientRect();
  const w = width === 'anchor' ? r.width : width;
  const below = window.innerHeight - r.bottom - MARGIN;
  const aboveSpace = r.top - MARGIN;
  const above = below < Math.min(preferredHeight, 240) && aboveSpace > below;
  const maxHeight = Math.max(160, Math.min(preferredHeight, (above ? aboveSpace : below) - GAP));
  let left = align === 'end' ? r.right - w : r.left;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
  return { top: above ? r.top - GAP : r.bottom + GAP, left, width: w, maxHeight, above };
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
  return createPortal(
    <AnimatePresence>
      {open && place && (
        <motion.div
          ref={(el) => {
            panel.current = el;
            glass(el);
          }}
          data-popover=""
          id={id}
          role={role}
          aria-label={label}
          initial={{ opacity: 0, y: place.above ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: t.medium * 0.7, ease: t.entry } }}
          exit={{ opacity: 0, transition: { duration: t.short, ease: t.exit } }}
          style={{
            position: 'fixed',
            left: place.left,
            width: place.width,
            maxHeight: place.maxHeight,
            ...(place.above ? { bottom: window.innerHeight - place.top } : { top: place.top }),
            transformOrigin: place.above ? 'bottom' : 'top',
          }}
          className={cn('liquid liquid-strong z-[1350] flex flex-col overflow-hidden rounded-lg', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

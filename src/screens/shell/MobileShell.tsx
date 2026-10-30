/**
 * Phone shell (below 1200 px, Halo Guide « rail en barre basse »; on a tablet the column stays phone-width, centred): the whole page scrolls under two pieces of glass —
 * the compact title bar (PageHeader, once scrolled) and the floating tab bar at the bottom, with the round + next to it
 * (the rail's FAB). Safe areas of the iPhone (notch, home bar) are kept clear.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { cn } from '../../ui/cn';
import { ICON_STROKE } from '../../ui/atoms';
import { useLiquidGlass } from '../../ui/glass';
import type { NavItem } from '../../ui/navigation';
import { motionTokens } from '../../theme/motion';
import { PageScrollContext } from './scroll';
import { Backdrop } from '../../ui/backdrop';
import { SPRING, currentShift, follow, reducedMotion, travel } from '../../ui/liquid';

export function MobileShell<T extends string>({
  items,
  active,
  onNavigate,
  onFab,
  fabRef,
  screenKey,
  children,
}: {
  items: NavItem<T>[];
  active: T;
  onNavigate: (id: T) => void;
  onFab: () => void;
  fabRef: (el: HTMLButtonElement | null) => void;
  screenKey: string;
  children: ReactNode;
}) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const t = motionTokens();
  // A new screen starts at the top (the scroll event then hides the compact bar).
  useEffect(() => {
    scroller?.scrollTo({ top: 0 });
  }, [screenKey, scroller]);
  return (
    <PageScrollContext.Provider value={{ scrolled, element: scroller }}>
      <div className="relative h-dvh overflow-clip">
        <Backdrop />
        <main
          ref={setScroller}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 52)}
          className="relative z-10 h-full overflow-y-auto overscroll-y-contain px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-[calc(env(safe-area-inset-bottom)+112px)]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screenKey}
              className="mx-auto flex w-full max-w-[720px] flex-col"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: t.medium, ease: t.entry } }}
              exit={{ opacity: 0, transition: { duration: t.short, ease: t.exit } }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <TabBar items={items} active={active} onNavigate={onNavigate} onFab={onFab} fabRef={fabRef} />
      </div>
    </PageScrollContext.Provider>
  );
}

function TabBar<T extends string>({ items, active, onNavigate, onFab, fabRef }: { items: NavItem<T>[]; active: T; onNavigate: (id: T) => void; onFab: () => void; fabRef: (el: HTMLButtonElement | null) => void }) {
  const glass = useLiquidGlass<HTMLSpanElement>({ bezel: 20, strength: 14 });
  const plus = useLiquidGlass<HTMLButtonElement>({ bezel: 20, strength: 14 });
  const shell = useRef<HTMLSpanElement | null>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const icons = useRef(new Map<T, HTMLSpanElement>());
  const label = useRef<HTMLSpanElement>(null);
  // The tapped tab lights up at once; the screen follows two frames later (see onClick).
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  // Layout positions at rest (no transform), to animate from on the next change.
  const rest = useRef<{ icons: Map<T, number> } | null>(null);

  const place = useCallback(() => {
    const b = bubble.current;
    const tab = tabs.current.get(shown);
    if (!b || !tab) return null;
    b.style.left = `${tab.offsetLeft}px`;
    b.style.width = `${tab.offsetWidth}px`;
    return { left: tab.offsetLeft, width: tab.offsetWidth };
  }, [shown]);

  useLayoutEffect(() => {
    const b = bubble.current;
    const nav = b?.parentElement;
    if (!b || !nav) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new tab.
    const seen = b.getBoundingClientRect();
    const base = nav.getBoundingClientRect().left;
    const fromCenter = seen.left - base + seen.width / 2;
    const fromWidth = seen.width;
    const shifts = new Map([...icons.current].map(([k, el]) => [k, currentShift(el)]));
    for (const el of [b, shell.current, ...icons.current.values()]) el?.getAnimations().forEach((x) => x.cancel());
    const to = place();
    const prev = rest.current;
    const layoutX = new Map([...icons.current].map(([k, el]) => [k, (tabs.current.get(k)?.offsetLeft ?? 0) + el.offsetLeft]));
    rest.current = { icons: layoutX };
    if (!to || !prev || !fromWidth || reducedMotion()) return;
    const dx = fromCenter - (to.left + to.width / 2);
    b.animate(travel(dx, 'x', fromWidth, to.width), { duration: SPRING.ms, easing: 'linear' });
    // On the first or last tab, the overshoot would take the bubble out of the glass: the glass stretches with it.
    const stretch = shell.current && follow(dx, fromWidth, to, nav.offsetWidth, nav.offsetHeight);
    if (stretch) shell.current?.animate(stretch, { duration: SPRING.ms, easing: 'linear' });
    for (const [k, el] of icons.current) {
      const from = (prev.icons.get(k) ?? 0) + (shifts.get(k) ?? 0);
      const d = from - (layoutX.get(k) ?? 0);
      if (Math.abs(d) < 0.5) continue;
      el.animate(
        SPRING.frames.map(({ p }) => ({ transform: `translateX(${d * (1 - p)}px)` })),
        { duration: SPRING.ms, easing: 'linear' },
      );
    }
    label.current?.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 110, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
  }, [shown, place]);

  // A rotated phone or a resized window: the bubble follows its tab, without animation.
  useEffect(() => {
    const nav = bubble.current?.parentElement;
    if (!nav) return;
    const ro = new ResizeObserver(() => {
      place();
      rest.current = { icons: new Map([...icons.current].map(([k, el]) => [k, (tabs.current.get(k)?.offsetLeft ?? 0) + el.offsetLeft])) };
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [place]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[640px] items-end gap-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <nav aria-label="Navigation principale" className="pointer-events-auto relative flex h-16 min-w-0 flex-1 items-stretch gap-0.5 rounded-full p-1.5">
        {/* The glass, a layer behind the bubble: its rim never crosses the blue, and it stretches with the overshoot. */}
        <span
          ref={(el) => {
            shell.current = el;
            glass(el);
          }}
          aria-hidden
          className="liquid liquid-bar pointer-events-none absolute inset-0 rounded-full"
        />
        <span ref={bubble} aria-hidden className="absolute inset-y-1.5 rounded-full bg-nav-active [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        {items.map((item) => {
          const on = item.id === shown;
          const Icon = item.icon;
          // The active tab widens and shows its name; the others are icons only (5 names do not fit on a phone).
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabs.current.set(item.id, el);
                else tabs.current.delete(item.id);
              }}
              type="button"
              onClick={() => {
                if (item.id === active) return onNavigate(item.id);
                setPending({ id: item.id, from: active });
                requestAnimationFrame(() => requestAnimationFrame(() => onNavigate(item.id)));
              }}
              aria-label={item.label}
              aria-current={item.id === active ? 'page' : undefined}
              className={cn('relative flex min-w-0 items-center justify-center gap-1.5 rounded-full transition-colors duration-200', on ? 'flex-[2.4] text-text-on-nav delay-75' : 'flex-1 text-text-secondary active:text-text-primary')}
            >
              <span
                ref={(el) => {
                  if (el) icons.current.set(item.id, el);
                  else icons.current.delete(item.id);
                }}
                className="relative shrink-0"
              >
                <Icon size={21} strokeWidth={ICON_STROKE} aria-hidden />
                {item.badge && !on && <span className="tnum absolute -top-1.5 -right-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[9px] font-medium text-text-primary">{item.badge}</span>}
                {item.live && <span aria-label="Séance en cours" className="live-halo absolute -top-0.5 -right-1 size-2 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
              </span>
              {on && (
                <span ref={label} className="relative min-w-0 truncate text-label-s">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <button
        ref={(el) => {
          plus(el);
          fabRef(el);
        }}
        type="button"
        aria-label="Ajouter"
        onClick={onFab}
        className="liquid liquid-bar pointer-events-auto inline-flex size-16 shrink-0 items-center justify-center rounded-full text-text-accent transition-transform duration-200 active:scale-95"
      >
        <Plus size={26} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

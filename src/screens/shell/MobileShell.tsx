/**
 * Phone shell (below 1200 px, Halo Guide « rail en barre basse »; on a tablet the column stays phone-width, centred): the whole page scrolls under two pieces of glass —
 * the compact title bar (PageHeader, once scrolled) and the floating tab bar at the bottom, with the round + next to it
 * (the rail's FAB). Safe areas of the iPhone (notch, home bar) are kept clear.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { cn } from '../../ui/cn';
import { ICON_STROKE } from '../../ui/atoms';
import { useLiquidGlass } from '../../ui/glass';
import type { NavItem } from '../../ui/navigation';
import { motionTokens, springGesture } from '../../theme/motion';
import { PageScrollContext } from './scroll';

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
        <div aria-hidden className="aurora">
          <i />
          <i />
          <i />
          <i />
          <b />
        </div>
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
  const bar = useLiquidGlass<HTMLElement>({ bezel: 20, strength: 14 });
  const plus = useLiquidGlass<HTMLButtonElement>({ bezel: 20, strength: 14 });
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[640px] items-end gap-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <nav ref={bar} aria-label="Navigation principale" className="liquid liquid-bar pointer-events-auto flex h-16 min-w-0 flex-1 items-stretch gap-0.5 rounded-full p-1.5">
        {items.map((item) => {
          const on = item.id === active;
          const Icon = item.icon;
          // The active tab widens and shows its name; the others are icons only (5 names do not fit on a phone).
          return (
            <motion.button
              key={item.id}
              layout
              transition={springGesture()}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={on ? 'page' : undefined}
              className={cn('relative flex min-w-0 items-center justify-center gap-1.5 rounded-full transition-colors duration-(--v-duree-courte)', on ? 'flex-[2.4] text-text-on-accent' : 'flex-1 text-text-secondary active:text-text-primary')}
            >
              {on && <motion.span layoutId="tabbar-active" transition={springGesture()} className="absolute inset-0 rounded-full bg-accent-default shadow-hairline-top drop-shadow-glow-accent" />}
              <span className="relative shrink-0">
                <Icon size={21} strokeWidth={ICON_STROKE} aria-hidden />
                {item.badge && !on && <span className="tnum absolute -top-1.5 -right-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[9px] font-medium text-text-primary">{item.badge}</span>}
                {item.live && <span aria-label="Séance en cours" className="live-halo absolute -top-0.5 -right-1 size-2 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
              </span>
              {on && <span className="relative min-w-0 truncate text-label-s">{item.label}</span>}
            </motion.button>
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
        className="liquid liquid-bar pointer-events-auto inline-flex size-16 shrink-0 items-center justify-center rounded-full text-text-accent active:scale-95"
      >
        <Plus size={26} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

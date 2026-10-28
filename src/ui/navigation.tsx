/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Plus, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE, Logo } from './atoms';
import { useLiquidGlass } from './glass';
import { springGesture } from '../theme/motion';

export type NavItem<T extends string> = { id: T; label: string; icon: LucideIcon; badge?: string; live?: boolean };

/** The rail's three dots (Figma: green, grey, grey), decorative. */
function RailDots() {
  const dot = 'size-2 rounded-full';
  return (
    <div aria-hidden className="flex h-5 items-center gap-1.5">
      <span className={cn(dot, 'bg-signal-default')} />
      <span className={cn(dot, 'bg-border-strong')} />
      <span className={cn(dot, 'bg-border-strong')} />
    </div>
  );
}

/** Vertical app rail (NavRail 71:238), liquid glass. Active item = the only light of the rail. No « Menu » label. */
export function NavRail<T extends string>({
  items,
  active,
  onNavigate,
  onFab,
  fabLabel,
  fabRef,
  onLogo,
}: {
  items: NavItem<T>[];
  active: T;
  onNavigate: (id: T) => void;
  onFab: () => void;
  fabLabel: string;
  fabRef?: (el: HTMLButtonElement | null) => void;
  onLogo?: () => void;
}) {
  const glass = useLiquidGlass<HTMLElement>({ bezel: 26, strength: 18 });
  return (
    <nav ref={glass} aria-label="Navigation principale" className="liquid relative z-20 flex h-full w-(--layout-rail) shrink-0 flex-col items-center rounded-2xl pt-[22px] pb-[23px]">
      <RailDots />
      <button type="button" onClick={onLogo} aria-label="Cadence, aujourd'hui" title="Cadence" className="mt-[22px] rounded-full">
        <Logo size={44} />
      </button>
      <ul className="mt-7 flex flex-col gap-3.5">
        {items.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group/nav relative inline-flex size-12 items-center justify-center rounded-full transition-colors duration-(--v-duree-courte)',
                  isActive ? 'text-text-on-accent drop-shadow-glow-nav' : 'text-text-secondary hover:bg-bg-card/70 hover:text-text-primary',
                )}
              >
                {isActive && <motion.span layoutId="navrail-active" transition={springGesture()} className="absolute inset-0 rounded-full bg-accent-default shadow-hairline-top" />}
                <Icon className="relative" size={20} strokeWidth={ICON_STROKE} aria-hidden />
                {item.badge && (
                  <span className="tnum absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[10px] font-medium text-text-primary">{item.badge}</span>
                )}
                {item.live && <span aria-label="Séance en cours" className="live-halo absolute top-1 right-1 size-2.5 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-full z-10 ml-3 rounded-sm bg-text-primary px-2 py-1 text-label-s whitespace-nowrap text-bg-card opacity-0 transition-opacity duration-(--v-duree-courte) group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100"
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-3">
        <button
          ref={fabRef}
          type="button"
          aria-label={fabLabel}
          title={fabLabel}
          onClick={onFab}
          className="inline-flex size-12 items-center justify-center rounded-full bg-accent-default text-text-on-accent drop-shadow-glow-accent transition-[background-color,transform] duration-(--v-duree-courte) hover:bg-accent-glow active:scale-95"
        >
          <Plus size={24} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/** View or mode switch (2–4 options, SegmentedControl 66:343), in liquid glass. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: ReactNode; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  const id = useId();
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 12, strength: 8 });
  return (
    <div ref={glass} role="radiogroup" aria-label={label} className="liquid inline-flex gap-1 rounded-full p-1">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('relative inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-label-m transition-colors duration-(--v-duree-courte)', active ? 'text-text-on-accent' : 'text-text-secondary hover:text-text-primary')}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={springGesture()} className="absolute inset-0 rounded-full bg-accent-default shadow-hairline-top" />}
            {Icon && <Icon className="relative" size={16} strokeWidth={ICON_STROKE} aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

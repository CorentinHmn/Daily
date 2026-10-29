/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Plus, Settings, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE, Logo } from './atoms';
import { useLiquidGlass } from './glass';
import { springGesture } from '../theme/motion';
import { SPRING, reducedMotion, travel } from './liquid';

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

/** Tooltip of a rail button, outside the rail on the right (hover and keyboard focus). */
function RailTip({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="pointer-events-none absolute left-full z-10 ml-3 rounded-sm bg-text-primary px-2 py-1 text-label-s whitespace-nowrap text-bg-card opacity-0 transition-opacity duration-(--v-duree-courte) group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100">
      {children}
    </span>
  );
}

/** Extra width of the name's bubble, kept hidden so that its spring can overshoot (the liquid bounce) without a gap. */
const OVERSHOOT = 14;

/**
 * Vertical app rail (NavRail 71:238), liquid glass. Active item = the only light of the rail. No « Menu » label.
 * The light is one bubble that travels between the items like the phone's tab bar (spring keyframes played by Web
 * Animations on the compositor). Once there, it pours out of the rail with the item's name, then flows back in;
 * hovering the active item shows the name again.
 */
export function NavRail<T extends string>({
  items,
  active,
  onNavigate,
  onFab,
  fabLabel,
  fabRef,
  onLogo,
  onSettings,
}: {
  items: NavItem<T>[];
  active: T;
  onNavigate: (id: T) => void;
  onFab: () => void;
  fabLabel: string;
  fabRef?: (el: HTMLButtonElement | null) => void;
  onLogo?: () => void;
  onSettings?: () => void;
}) {
  const glass = useLiquidGlass<HTMLElement>({ bezel: 26, strength: 18 });
  const bubble = useRef<HTMLSpanElement>(null);
  const tongue = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const placed = useRef(false);
  // The clicked item lights up at once; the screen follows two frames later, the bubble already on its way.
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  const label = items.find((i) => i.id === shown)?.label ?? '';

  /** The bubble pours out of the rail with the name, holds, then flows back in. */
  const pour = useCallback((delay: number) => {
    const t = tongue.current;
    const n = name.current;
    if (!t || !n || reducedMotion()) return;
    t.getAnimations().forEach((a) => a.cancel());
    n.getAnimations().forEach((a) => a.cancel());
    const size = t.offsetHeight;
    const hidden = t.offsetWidth - size;
    const r = size / 2;
    const clip = (right: number) => `inset(0 ${Math.max(0, right)}px 0 0 round ${r}px)`;
    const hold = 1100;
    const back = 320;
    const total = delay + SPRING.ms + hold + back;
    const at = (ms: number) => ms / total;
    t.animate(
      [
        { offset: 0, clipPath: clip(hidden) },
        { offset: at(delay), clipPath: clip(hidden) },
        ...SPRING.frames.slice(1).map(({ p }, i) => ({ offset: at(delay + ((i + 1) * 1000) / 60), clipPath: clip(OVERSHOOT + (hidden - OVERSHOOT) * (1 - p)) })),
        { offset: at(delay + SPRING.ms + hold), clipPath: clip(OVERSHOOT), easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
        { offset: 1, clipPath: clip(hidden) },
      ],
      { duration: total, easing: 'linear' },
    );
    n.animate(
      [
        { offset: 0, opacity: 0, transform: 'translateX(-8px)' },
        { offset: at(delay + SPRING.ms * 0.25), opacity: 0, transform: 'translateX(-8px)' },
        { offset: at(delay + SPRING.ms * 0.6), opacity: 1, transform: 'none' },
        { offset: at(delay + SPRING.ms + hold), opacity: 1, transform: 'none' },
        { offset: at(delay + SPRING.ms + hold + back * 0.6), opacity: 0, transform: 'translateX(-6px)' },
        { offset: 1, opacity: 0 },
      ],
      { duration: total, easing: 'ease-out' },
    );
  }, []);

  useLayoutEffect(() => {
    const b = bubble.current;
    const t = tongue.current;
    const nav = b?.parentElement;
    const tab = tabs.current.get(shown);
    if (!b || !t || !nav || !tab) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new item.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.top - nav.getBoundingClientRect().top + seen.height / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const { offsetTop: top, offsetLeft: left, offsetWidth: size } = tab;
    for (const el of [b, t]) {
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.height = `${size}px`;
    }
    b.style.width = `${size}px`;
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    if (Math.abs(dy) > 0.5) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
    pour(Math.abs(dy) > 0.5 ? 170 : 0);
  }, [shown, pour]);

  return (
    <nav ref={glass} aria-label="Navigation principale" className="liquid relative z-20 flex h-full w-(--layout-rail) shrink-0 flex-col items-center rounded-2xl pt-[22px] pb-[23px]">
      {/* The name's bubble: same blue as the light, wider than the rail; clipped down to the light at rest. */}
      <span ref={tongue} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="absolute flex items-center rounded-full bg-accent-default pr-[calc(18px+14px)] pl-[54px] text-label-m whitespace-nowrap text-text-on-accent [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)]">
        <span ref={name} className="opacity-0">
          {label}
        </span>
      </span>
      <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
      <RailDots />
      <button type="button" onClick={onLogo} aria-label="Cadence, aujourd'hui" title="Cadence" className="relative mt-[22px] rounded-full">
        <Logo size={44} />
      </button>
      <ul className="mt-7 flex flex-col gap-3.5">
        {items.map((item) => {
          const on = item.id === shown;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
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
                onMouseEnter={() => {
                  if (on && !tongue.current?.getAnimations().length) pour(0);
                }}
                aria-label={item.label}
                aria-current={item.id === active ? 'page' : undefined}
                className={cn('group/nav relative inline-flex size-12 items-center justify-center rounded-full transition-colors duration-200', on ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:bg-bg-card/70 hover:text-text-primary')}
              >
                <Icon className="relative" size={20} strokeWidth={ICON_STROKE} aria-hidden />
                {item.badge && (
                  <span className="tnum absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[10px] font-medium text-text-primary">{item.badge}</span>
                )}
                {item.live && <span aria-label="Séance en cours" className="live-halo absolute top-1 right-1 size-2.5 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
                {!on && <RailTip>{item.label}</RailTip>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col items-center gap-3 pt-3">
        {onSettings && (
          <button type="button" onClick={onSettings} aria-label="Paramètres" className="group/nav relative inline-flex size-12 items-center justify-center rounded-full text-text-secondary transition-colors duration-(--v-duree-courte) hover:bg-bg-card/70 hover:text-text-primary">
            <Settings size={20} strokeWidth={ICON_STROKE} aria-hidden />
            <RailTip>Paramètres</RailTip>
          </button>
        )}
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

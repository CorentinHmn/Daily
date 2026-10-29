/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Settings, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE, Logo } from './atoms';
import { useLiquidGlass } from './glass';
import { SPRING, reducedMotion, travel, useDeferredPick, useLiquidBubble } from './liquid';

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
/** Glass around the poured bubble (px), and radius of the hollow curves where it leaves the rail. */
const SLEEVE = 7;
const FILLET = 14;
/** Room left around the name's bubble for its glow (a clip-path also clips the shadow). */
const GLOW = 22;
/** The name pours out once the bubble has (almost) arrived. */
const ARRIVE_MS = (SPRING.frames.findIndex((f) => f.p > 0.9) * 1000) / 60;

/**
 * Vertical app rail (NavRail 71:238), liquid glass. Active item = the only light of the rail. No « Menu » label.
 * The light is one bubble that travels between the items like the phone's tab bar (spring keyframes played by Web
 * Animations on the compositor). Once there, it pours out of the rail with the item's name, the rail's glass
 * stretching around it with hollow curves, then both flow back in; hovering the active item shows the name again.
 * The stretched glass sits next to the rail, not in it: inside, it would only see the rail (backdrop root).
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
  const railRef = useRef<HTMLElement | null>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const tongue = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const sleeve = useRef<HTMLSpanElement>(null);
  const filletTop = useRef<HTMLSpanElement>(null);
  const filletBottom = useRef<HTMLSpanElement>(null);
  const glow = useRef<Animation | null>(null);
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const placed = useRef(false);
  // The clicked item lights up at once; the screen follows two frames later, the bubble already on its way.
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  const label = items.find((i) => i.id === shown)?.label ?? '';

  /** The bubble pours out of the rail with the name and the rail's glass, holds, then all flow back in. */
  const pour = useCallback((delay: number) => {
    const [t, n, b, sl, ft, fb, rail] = [tongue.current, name.current, bubble.current, sleeve.current, filletTop.current, filletBottom.current, railRef.current];
    if (!t || !n || !b || !sl || !ft || !fb || !rail || reducedMotion()) return;
    for (const el of [t, n, sl, ft, fb]) el.getAnimations().forEach((a) => a.cancel());
    glow.current?.cancel();
    const size = t.offsetHeight;
    const width = t.offsetWidth;
    const hidden = width - size;
    const r = size / 2;
    const inside = rail.offsetWidth - (t.offsetLeft - SLEEVE);
    const hold = 1100;
    const back = 320;
    const total = delay + SPRING.ms + hold + back;
    // The right edge of the poured bubble, as the amount clipped off its right (shared by the bubble and the glass).
    const steps: { at: number; right: number; easing?: string }[] = [
      { at: delay, right: hidden },
      ...SPRING.frames.slice(1).map(({ p }, i) => ({ at: delay + ((i + 1) * 1000) / 60, right: OVERSHOOT + (hidden - OVERSHOOT) * (1 - p) })),
      { at: delay + SPRING.ms + hold, right: OVERSHOOT, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
      { at: total, right: hidden },
    ];
    const opts = { duration: total, easing: 'linear' };
    const frames = (f: (right: number) => Keyframe, before: Keyframe) => [{ offset: 0, ...before }, { offset: Math.max(0, delay - 1) / total, ...before }, ...steps.map((s) => ({ offset: s.at / total, easing: s.easing, ...f(s.right) }))];
    const off = 'inset(0 100% 0 0)';
    t.animate(frames((right) => ({ clipPath: `inset(-${GLOW}px ${right - GLOW}px -${GLOW}px -${GLOW}px round ${r + GLOW}px)` }), { clipPath: off }), opts);
    sl.animate(frames((right) => ({ clipPath: `inset(0 ${right}px 0 ${inside}px round 0 ${r + SLEEVE}px ${r + SLEEVE}px 0)` }), { clipPath: off }), opts);
    // The hollow curves grow with the glass that comes out of the rail.
    const out = (right: number) => Math.max(0, Math.min(1, (width - right + SLEEVE - inside) / (FILLET * 2)));
    for (const el of [ft, fb]) el.animate(frames((right) => ({ opacity: out(right), transform: `scale(${out(right)})` }), { opacity: 0, transform: 'scale(0)' }), opts);
    // One light only: while the name's bubble (with its own glow) is out, the round one gives up its glow.
    const rest = getComputedStyle(b).boxShadow;
    glow.current = b.animate([{ offset: 0, boxShadow: rest }, { offset: delay / total, boxShadow: rest }, { offset: Math.min(1, (delay + 1) / total), boxShadow: 'none' }, { offset: (total - 1) / total, boxShadow: 'none' }, { offset: 1, boxShadow: rest }], { duration: total });
    n.animate(
      [
        { offset: 0, opacity: 0, transform: 'translateX(-8px)' },
        { offset: (delay + SPRING.ms * 0.25) / total, opacity: 0, transform: 'translateX(-8px)' },
        { offset: (delay + SPRING.ms * 0.6) / total, opacity: 1, transform: 'none' },
        { offset: (delay + SPRING.ms + hold) / total, opacity: 1, transform: 'none' },
        { offset: (delay + SPRING.ms + hold + back * 0.6) / total, opacity: 0, transform: 'translateX(-6px)' },
        { offset: 1, opacity: 0 },
      ],
      { duration: total, easing: 'ease-out' },
    );
  }, []);

  useLayoutEffect(() => {
    const [b, t, sl, ft, fb, nav] = [bubble.current, tongue.current, sleeve.current, filletTop.current, filletBottom.current, railRef.current];
    const tab = tabs.current.get(shown);
    if (!b || !t || !sl || !ft || !fb || !nav || !tab) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new item.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.top - nav.getBoundingClientRect().top + seen.height / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const { offsetTop: top, offsetLeft: left, offsetWidth: size } = tab;
    Object.assign(b.style, { top: `${top}px`, left: `${left}px`, width: `${size}px`, height: `${size}px` });
    Object.assign(t.style, { top: `${top}px`, left: `${left}px`, height: `${size}px` });
    Object.assign(sl.style, { top: `${top - SLEEVE}px`, left: `${left - SLEEVE}px`, height: `${size + SLEEVE * 2}px`, width: `${t.offsetWidth + SLEEVE * 2}px` });
    const edge = `${nav.offsetWidth}px`;
    Object.assign(ft.style, { top: `${top - SLEEVE - FILLET}px`, left: edge });
    Object.assign(fb.style, { top: `${top + size + SLEEVE}px`, left: edge });
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    const moves = Math.abs(dy) > 0.5;
    if (moves) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
    pour(moves ? ARRIVE_MS : 0);
  }, [shown, pour]);

  return (
    <div className="relative z-20 flex h-full shrink-0">
      <nav
        ref={(el) => {
          railRef.current = el;
          glass(el);
        }}
        aria-label="Navigation principale"
        className="liquid relative z-10 flex h-full w-(--layout-rail) shrink-0 flex-col items-center rounded-2xl pt-[22px] pb-[23px]"
      >
        <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        {/* The name's bubble: the same blue as the round one, over it and over the rail's rim (z-1, the items z-2);
            clipped away at rest. */}
        <span ref={tongue} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="absolute z-[1] flex items-center rounded-full bg-accent-default pr-[calc(18px+14px)] pl-[54px] text-label-m whitespace-nowrap text-text-on-accent [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)]">
          <span ref={name} className="opacity-0">
            {label}
          </span>
        </span>
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
                  className={cn('group/nav relative z-[2] inline-flex size-12 items-center justify-center rounded-full transition-colors duration-200', on ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:bg-bg-card/70 hover:text-text-primary')}
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
      {/* The rail's glass stretching around the poured bubble, and its two hollow curves (clipped away at rest). */}
      <span ref={sleeve} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="rail-sleeve pointer-events-none absolute" />
      <span ref={filletTop} aria-hidden style={{ width: FILLET, height: FILLET, opacity: 0, transformOrigin: '0 100%', maskImage: `radial-gradient(circle at 100% 0, transparent ${FILLET - 0.5}px, #000 ${FILLET}px)` }} className="rail-sleeve pointer-events-none absolute" />
      <span ref={filletBottom} aria-hidden style={{ width: FILLET, height: FILLET, opacity: 0, transformOrigin: '0 0', maskImage: `radial-gradient(circle at 100% 100%, transparent ${FILLET - 0.5}px, #000 ${FILLET}px)` }} className="rail-sleeve pointer-events-none absolute" />
    </div>
  );
}

/** View or mode switch (2–4 options, SegmentedControl 66:343), in liquid glass. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: ReactNode; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 12, strength: 8 });
  // Same bubble as the tab bar: it moves at once, the view (often a heavy screen) follows two frames later.
  const { shown, pick } = useDeferredPick(value, onChange);
  const { bubble, item } = useLiquidBubble(shown, options.length);
  return (
    <div ref={glass} role="radiogroup" aria-label={label} className="liquid inline-flex gap-1 rounded-full p-1">
      <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default shadow-hairline-top will-change-transform" />
      {options.map((o) => {
        const active = o.value === shown;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={item(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(o.value)}
            className={cn('relative inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-label-m transition-colors duration-200', active ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:text-text-primary')}
          >
            {Icon && <Icon className="relative" size={16} strokeWidth={ICON_STROKE} aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

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
/** Glass of the wave around the poured bubble (px), and radius of its hollow curves where it leaves the rail. */
const SLEEVE = 12;
const FILLET = 26;
/** Width of the rail's glass beyond the rail, where the wave can go. */
const ROOM = 190;
/** The name pours out once the bubble has (almost) arrived. */
const ARRIVE_MS = (SPRING.frames.findIndex((f) => f.p > 0.9) * 1000) / 60;
/** The rim can follow the wave where CSS can animate an SVG path (Chromium, Firefox); elsewhere it fades meanwhile. */
const dAnimates = typeof CSS !== 'undefined' && CSS.supports('d', 'path("M0 0")');

/** Clip of the shadow: everything but the glass's outline (even-odd: a large frame minus the outline). */
const outside = (W: number, H: number, d: string) => `path(evenodd, 'M -80 -80 H ${W + ROOM + 80} V ${H + 80} H -80 Z ${d}')`;

/**
 * Outline of the rail's glass: the rail (W × H, corners R) and, on its right side around height `cy`, the wave: a
 * pill out by `e` px, `hh` high on each side of `cy`, joined to the rail by two hollow curves. Always the same commands,
 * so that the path can be interpolated (e = 0: the bare rail).
 */
function railShape(W: number, H: number, R: number, e: number, cy: number, hh: number): string {
  const f = Math.min(FILLET, e * 0.75);
  const c = Math.max(0, Math.min(hh, e - f));
  const top = cy - hh;
  const bottom = cy + hh;
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M ${R} 0 H ${W - R} A ${R} ${R} 0 0 1 ${W} ${R}`,
    `V ${n(top - f)} A ${n(f)} ${n(f)} 0 0 0 ${n(W + f)} ${n(top)}`,
    `H ${n(W + e - c)} A ${n(c)} ${n(hh)} 0 0 1 ${n(W + e)} ${n(cy)} A ${n(c)} ${n(hh)} 0 0 1 ${n(W + e - c)} ${n(bottom)}`,
    `H ${n(W + f)} A ${n(f)} ${n(f)} 0 0 0 ${W} ${n(bottom + f)}`,
    `V ${H - R} A ${R} ${R} 0 0 1 ${W - R} ${H} H ${R} A ${R} ${R} 0 0 1 0 ${H - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`,
  ].join(' ');
}

/**
 * Vertical app rail (NavRail 71:238), liquid glass. Active item = the only light of the rail. No « Menu » label.
 * The light is one bubble that travels between the items like the phone's tab bar (spring keyframes played by Web
 * Animations on the compositor). Once there, it pours out of the rail with the item's name: the rail's own glass
 * swells into a wave around it, following the same spring, then both flow back in; hovering the active item shows
 * the name again. The glass is one layer wider than the rail, shaped by an animated clip-path, with its rim drawn
 * along the same outline: the wave and the rail are one piece, no seam between them.
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
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 26, strength: 18 });
  const railRef = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement | null>(null);
  const rim = useRef<SVGSVGElement>(null);
  const rimShade = useRef<SVGPathElement>(null);
  const rimLight = useRef<SVGPathElement>(null);
  const shadow = useRef<SVGSVGElement>(null);
  const shadowPath = useRef<SVGPathElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const tongue = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const glow = useRef<Animation | null>(null);
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const placed = useRef(false);
  // The clicked item lights up at once; the screen follows two frames later, the bubble already on its way.
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  const label = items.find((i) => i.id === shown)?.label ?? '';

  /** Size of the rail and the radius of its corners. */
  const geometry = useCallback(() => {
    const nav = railRef.current;
    if (!nav) return null;
    return { W: nav.offsetWidth, H: nav.offsetHeight, R: parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 28 };
  }, []);

  /** The glass at rest: the bare rail. */
  const rest = useCallback(() => {
    const g = geometry();
    const [sl, rv, sh] = [shell.current, rim.current, shadow.current];
    if (!g || !sl || !rv || !sh) return;
    const d = railShape(g.W, g.H, g.R, 0, g.H / 2, 0);
    sl.style.clipPath = rv.style.clipPath = `path('${d}')`;
    sh.style.clipPath = outside(g.W, g.H, d);
    for (const p of [rimShade.current, rimLight.current, shadowPath.current]) p?.setAttribute('d', d);
    rv.setAttribute('viewBox', `0 0 ${g.W + ROOM} ${g.H}`);
    // The rim's light runs at 140° across the rail, like the .liquid rim: bright top left, a glint bottom right.
    const grad = rv.querySelector('linearGradient');
    const [dx, dy] = [Math.sin((140 * Math.PI) / 180), -Math.cos((140 * Math.PI) / 180)];
    const half = (g.W * Math.abs(dx) + g.H * Math.abs(dy)) / 2;
    grad?.setAttribute('x1', String(g.W / 2 - dx * half));
    grad?.setAttribute('y1', String(g.H / 2 - dy * half));
    grad?.setAttribute('x2', String(g.W / 2 + dx * half));
    grad?.setAttribute('y2', String(g.H / 2 + dy * half));
  }, [geometry]);

  /** The bubble pours out with the name and the rail's glass swells around it, holds, then all flow back in. */
  const pour = useCallback(
    (delay: number) => {
      const [t, n, b, sl, rv] = [tongue.current, name.current, bubble.current, shell.current, rim.current];
      const g = geometry();
      if (!t || !n || !b || !sl || !rv || !g || reducedMotion()) return;
      const sh = shadow.current;
      for (const el of [t, n, sl, rv, sh, rimShade.current, rimLight.current, shadowPath.current]) el?.getAnimations().forEach((a) => a.cancel());
      glow.current?.cancel();
      const size = t.offsetHeight;
      const width = t.offsetWidth;
      const hidden = width - size;
      const r = size / 2;
      const cy = t.offsetTop + r;
      const hold = 1100;
      const back = 320;
      const total = delay + SPRING.ms + hold + back;
      // How much of the name's bubble is clipped off on the right, and how thin the pour is (fast = thinner).
      const steps: { at: number; right: number; thin: number; easing?: string }[] = [
        { at: delay, right: hidden, thin: 1 },
        ...SPRING.frames.slice(1).map(({ p, v }, i) => ({ at: delay + ((i + 1) * 1000) / 60, right: OVERSHOOT + (hidden - OVERSHOOT) * (1 - p), thin: 1 - Math.min(0.16, Math.abs(hidden * v) / 5000) })),
        { at: delay + SPRING.ms + hold, right: OVERSHOOT, thin: 1, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
        { at: total, right: hidden, thin: 1 },
      ];
      const opts = { duration: total, easing: 'linear' };
      const frames = (f: (s: (typeof steps)[number]) => Keyframe, before: Keyframe) => [{ offset: 0, ...before }, { offset: Math.max(0, delay - 1) / total, ...before }, ...steps.map((s) => ({ offset: s.at / total, easing: s.easing, ...f(s) }))];
      const shape = (s: (typeof steps)[number]) => {
        const e = Math.max(0, t.offsetLeft + width - s.right + SLEEVE - g.W);
        return railShape(g.W, g.H, g.R, e, cy, r * s.thin + SLEEVE);
      };
      const bare = railShape(g.W, g.H, g.R, 0, cy, r + SLEEVE);
      // Thinner as it pours fast: clipped from the top and the bottom too (over the round bubble, a liquid neck).
      t.animate(
        frames((s) => {
          const v = r * (1 - s.thin);
          return { clipPath: `inset(${v}px ${s.right}px ${v}px 0 round ${r - v}px)` };
        }, { clipPath: 'inset(0 100% 0 0)' }),
        opts,
      );
      for (const el of [sl, rv]) el.animate(frames((s) => ({ clipPath: `path('${shape(s)}')` }), { clipPath: `path('${bare}')` }), opts);
      if (dAnimates) {
        for (const el of [rimShade.current, rimLight.current, shadowPath.current]) el?.animate(frames((s) => ({ d: `path('${shape(s)}')` }), { d: `path('${bare}')` }), opts);
        sh?.animate(frames((s) => ({ clipPath: outside(g.W, g.H, shape(s)) }), { clipPath: outside(g.W, g.H, bare) }), opts);
      } else rv.animate([{ opacity: 1 }, { offset: delay / total, opacity: 0 }, { offset: (total - 60) / total, opacity: 0 }, { opacity: 1 }], { duration: total });
      // One blue: the round bubble's glow fades while the name is out (a clip-path would cut the glow of the rest).
      const lit = getComputedStyle(b).boxShadow;
      const fade = 140;
      glow.current = b.animate(
        [
          { offset: 0, boxShadow: lit },
          { offset: delay / total, boxShadow: lit },
          { offset: Math.min(1, (delay + fade) / total), boxShadow: 'none' },
          { offset: (total - back) / total, boxShadow: 'none' },
          { offset: 1, boxShadow: lit },
        ],
        { duration: total },
      );
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
    },
    [geometry],
  );

  useLayoutEffect(() => {
    const [b, t, nav] = [bubble.current, tongue.current, railRef.current];
    const tab = tabs.current.get(shown);
    if (!b || !t || !nav || !tab) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new item.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.top - nav.getBoundingClientRect().top + seen.height / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const { offsetTop: top, offsetLeft: left, offsetWidth: size } = tab;
    Object.assign(b.style, { top: `${top}px`, left: `${left}px`, width: `${size}px`, height: `${size}px` });
    Object.assign(t.style, { top: `${top}px`, left: `${left}px`, height: `${size}px` });
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    const moves = Math.abs(dy) > 0.5;
    if (moves) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
    pour(moves ? ARRIVE_MS : 0);
  }, [shown, pour]);

  // The glass at rest follows the rail's size (window resized).
  useLayoutEffect(() => {
    rest();
    const nav = railRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => rest());
    ro.observe(nav);
    return () => ro.disconnect();
  }, [rest]);

  return (
    <div className="relative z-20 flex h-full shrink-0">
      {/* The glass's shadow (only outside its outline, so it never darkens the glass), then the glass, wider than the
          rail for the wave. */}
      <svg ref={shadow} aria-hidden style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }} className="pointer-events-none absolute inset-y-0 left-0 h-full overflow-visible">
        <path ref={shadowPath} className="rail-shadow" />
      </svg>
      <div
        ref={(el) => {
          shell.current = el;
          glass(el);
        }}
        aria-hidden
        style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }}
        className="rail-glass pointer-events-none absolute inset-y-0 left-0"
      >
        <div className="rail-sheen absolute inset-y-0 left-0 w-(--layout-rail) rounded-2xl" />
      </div>
      <svg ref={rim} aria-hidden style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }} className="pointer-events-none absolute inset-y-0 left-0 h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rail-rim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="96" y2="300">
            <stop offset="0" className="rail-rim-a" />
            <stop offset="0.34" className="rail-rim-b" />
            <stop offset="0.56" className="rail-rim-c" />
            <stop offset="1" className="rail-rim-d" />
          </linearGradient>
        </defs>
        <path ref={rimShade} fill="none" strokeWidth="2" className="stroke-(--glass-rim-shade)" />
        <path ref={rimLight} fill="none" strokeWidth="3" stroke="url(#rail-rim)" />
      </svg>
      <nav ref={railRef} aria-label="Navigation principale" className="relative z-10 flex h-full w-(--layout-rail) shrink-0 flex-col items-center rounded-2xl pt-[22px] pb-[23px]">
        <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        {/* The name's bubble: the same blue as the round one, over it (z-1, the items z-2); clipped away at rest. */}
        <span ref={tongue} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="absolute z-[1] flex items-center rounded-full bg-accent-default pr-[calc(18px+14px)] pl-[54px] text-label-m whitespace-nowrap text-text-on-accent shadow-hairline-top">
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

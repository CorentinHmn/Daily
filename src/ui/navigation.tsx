/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Settings, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE, Logo } from './atoms';
import { useLiquidGlass } from './glass';
import { SPRING, reducedMotion, stretchAt, travel, useDeferredPick, useLiquidBubble } from './liquid';

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
/** Width of the rail's glass beyond the rail, where the wave can go (the longest name fits). */
const ROOM = 150;
/** One frame (the pour is sampled at 60 per second), the hold with the name out, the flow back in. */
const FRAME = 1000 / 60;
const HOLD = 1100;
const BACK = 380;
/** While moving, the name starts pouring when the bubble is halfway, then rides along with it. */
const POUR_AT = SPRING.frames.findIndex((f) => f.p >= 0.5);

/** Clip of the shadow: everything but the glass's outline (even-odd: a large frame minus the outline). */
const outside = (W: number, H: number, d: string) => `path(evenodd, 'M -80 -80 H ${W + ROOM + 80} V ${H + 80} H -80 Z ${d}')`;

/**
 * Outline of the rail's glass: the rail (W × H, corners R) and, on its right side around height `cy`, the wave: a
 * pill out by `e` px, `hh` high on each side of `cy`, joined to the rail by two hollow curves. `inset` = the same
 * outline moved inwards (for the rim's ring). Always the same commands, so that the path can be interpolated (e = 0:
 * the bare rail).
 */
function railShape(W: number, H: number, R: number, e: number, cy: number, hh: number, inset = 0): string {
  const i = inset;
  // Out far enough (the name's bubble has a minimum width), the end is a half circle and the curves are FILLET wide;
  // while it comes out, both grow in the same proportion, whatever the name's length.
  const full = hh + FILLET;
  const c = e >= full ? hh : (e * hh) / full;
  const f = e >= full ? FILLET : (e * FILLET) / full;
  const top = cy - hh;
  const bottom = cy + hh;
  const fi = f + i;
  const ci = Math.max(0, c - i);
  const hi = Math.max(0, hh - i);
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M ${R} ${i} H ${W - R} A ${R - i} ${R - i} 0 0 1 ${W - i} ${R}`,
    `V ${n(top - f)} A ${n(fi)} ${n(fi)} 0 0 0 ${n(W + f)} ${n(top + i)}`,
    `H ${n(W + e - c)} A ${n(ci)} ${n(hi)} 0 0 1 ${n(W + e - c + ci)} ${n(cy)} A ${n(ci)} ${n(hi)} 0 0 1 ${n(W + e - c)} ${n(bottom - i)}`,
    `H ${n(W + f)} A ${n(fi)} ${n(fi)} 0 0 0 ${W - i} ${n(bottom + f)}`,
    `V ${H - R} A ${R - i} ${R - i} 0 0 1 ${W - R} ${H - i} H ${R} A ${R - i} ${R - i} 0 0 1 ${i} ${H - R} V ${R} A ${R - i} ${R - i} 0 0 1 ${R} ${i} Z`,
  ].join(' ');
}

/**
 * Vertical app rail (NavRail 71:238), liquid glass. Active item = the only light of the rail. No « Menu » label.
 * The light is one bubble that travels between the items like the phone's tab bar (spring keyframes played by Web
 * Animations). Halfway there, it starts pouring out of the rail with the item's name, the rail's own glass swelling
 * into a wave around it; the poured bubble and the wave ride along with the round one (same spring, same stretch,
 * same bounce), hold, then flow back in. Hovering the active item pours the name again.
 * The glass is one layer wider than the rail, shaped by a clip-path; its shadow (only outside it) and its rim (a ring
 * between the outline and the outline moved inwards) are clip-paths of the same outline, animated with the same
 * keyframes: one piece of glass, no seam, nothing that can drift from the rest.
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
  const rimShade = useRef<HTMLDivElement>(null);
  const rimLight = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const shadowShape = useRef<HTMLDivElement>(null);
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

  /** The clip-paths of every layer for one outline (the glass, its shadow, its rim). */
  const layers = useCallback((g: { W: number; H: number; R: number }, e: number, cy: number, hh: number) => {
    const d = railShape(g.W, g.H, g.R, e, cy, hh);
    return {
      glass: `path('${d}')`,
      shadow: outside(g.W, g.H, d),
      shade: `path(evenodd, '${d} ${railShape(g.W, g.H, g.R, e, cy, hh, 1)}')`,
      light: `path(evenodd, '${d} ${railShape(g.W, g.H, g.R, e, cy, hh, 1.5)}')`,
    };
  }, []);

  /** The glass at rest: the bare rail. */
  const rest = useCallback(() => {
    const g = geometry();
    const [sl, sh, ss, rs, rl] = [shell.current, shadow.current, shadowShape.current, rimShade.current, rimLight.current];
    if (!g || !sl || !sh || !ss || !rs || !rl) return;
    const l = layers(g, 0, g.H / 2, 0);
    sl.style.clipPath = ss.style.clipPath = l.glass;
    sh.style.clipPath = l.shadow;
    rs.style.clipPath = l.shade;
    rl.style.clipPath = l.light;
  }, [geometry, layers]);

  /**
   * The bubble pours out with the name and the rail's glass swells around it, holds, then all flow back in. Every
   * layer gets keyframes sampled on one 60 fps timeline from the click: the round bubble's travel `dy` (its spring,
   * stretch and bounce, which the poured bubble and the wave follow), from `start` frames the pour's spring.
   */
  const pour = useCallback(
    (dy: number, start: number) => {
      const [t, n, b, sl, sh, ss, rs, rl] = [tongue.current, name.current, bubble.current, shell.current, shadow.current, shadowShape.current, rimShade.current, rimLight.current];
      const g = geometry();
      if (!t || !n || !b || !sl || !sh || !ss || !rs || !rl || !g || reducedMotion()) return;
      for (const el of [t, n, sl, sh, ss, rs, rl]) el.getAnimations().forEach((a) => a.cancel());
      glow.current?.cancel();
      const size = t.offsetHeight;
      const width = t.offsetWidth;
      const hidden = width - size;
      const r = size / 2;
      const cy = t.offsetTop + r;
      const out = start * FRAME + SPRING.ms;
      const total = out + HOLD + BACK;
      const count = Math.ceil(total / FRAME);
      const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const samples = Array.from({ length: count + 1 }, (_, i) => {
        const at = Math.min(total, i * FRAME);
        // The round bubble: where it is (its travel spring) and how it stretches.
        const travelled = SPRING.frames[i] ?? { p: 1, v: 0 };
        const off = dy * (1 - travelled.p);
        const along = 1 + stretchAt(dy, travelled.v);
        // The pour: how much of the name's bubble is still clipped off on the right, and its speed.
        let right = width;
        let speed = 0;
        if (i >= start && at < out) {
          const f = SPRING.frames[i - start] ?? { p: 1, v: 0 };
          right = OVERSHOOT + (hidden - OVERSHOOT) * (1 - f.p);
          speed = hidden * f.v;
        } else if (at >= out && at < out + HOLD) right = OVERSHOOT;
        else if (at >= out + HOLD) {
          const x = Math.min(1, (at - out - HOLD) / BACK);
          const h = 0.001;
          right = OVERSHOOT + (hidden - OVERSHOOT) * ease(x);
          speed = (((hidden - OVERSHOOT) * (ease(Math.min(1, x + h)) - ease(x))) / h) * (1000 / BACK);
          if (x >= 1) right = width;
        }
        // Liquid: the faster it pours, the thinner it gets.
        const thin = 1 - Math.min(0.16, Math.abs(speed) / 5000);
        return { at, off, along, right, thin };
      });
      const play = (el: Element, f: (s: (typeof samples)[number], i: number) => Keyframe) =>
        el.animate(
          samples.map((s, i) => ({ offset: s.at / total, ...f(s, i) })),
          { duration: total, easing: 'linear' },
        );
      // The poured bubble rides with the round one (and stretches with it); thinner as it pours fast, clipped from the
      // top and the bottom too (over the round bubble: a liquid neck).
      play(t, (s) => {
        const v = r * (1 - s.thin);
        return { transform: `translateY(${s.off}px) scaleY(${s.along})`, clipPath: s.right >= width ? `inset(0 ${width}px 0 0 round ${r}px)` : `inset(${v}px ${s.right}px ${v}px 0 round ${r - v}px)` };
      });
      // The wave: as far out as the poured bubble, as high as it (with the glass around), where the round bubble is.
      const outline = samples.map((s) => {
        const e = s.right >= width ? 0 : Math.max(0, t.offsetLeft + width - s.right + SLEEVE - g.W);
        return layers(g, e, cy + s.off, r * s.thin * s.along + SLEEVE);
      });
      play(sl, (_, i) => ({ clipPath: outline[i]!.glass }));
      play(ss, (_, i) => ({ clipPath: outline[i]!.glass }));
      play(sh, (_, i) => ({ clipPath: outline[i]!.shadow }));
      play(rs, (_, i) => ({ clipPath: outline[i]!.shade }));
      play(rl, (_, i) => ({ clipPath: outline[i]!.light }));
      // The name fades in once the bubble is well out, and out as it flows back.
      play(n, (s) => {
        const shownPart = s.right >= width ? 0 : Math.max(0, Math.min(1, (hidden - s.right) / Math.max(1, hidden - OVERSHOOT)));
        const k = Math.max(0, Math.min(1, (shownPart - 0.45) / 0.4));
        return { opacity: k, transform: `translateX(${(1 - k) * -8}px)` };
      });
      // One blue: the round bubble's glow fades while the name is out (a clip-path would cut the glow of the rest).
      const lit = getComputedStyle(b).boxShadow;
      const from = (start * FRAME) / total;
      glow.current = b.animate(
        [
          { offset: 0, boxShadow: lit },
          { offset: from, boxShadow: lit },
          { offset: Math.min(1, from + 160 / total), boxShadow: 'none' },
          { offset: (out + HOLD + BACK * 0.5) / total, boxShadow: 'none' },
          { offset: 1, boxShadow: lit },
        ],
        { duration: total },
      );
    },
    [geometry, layers],
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
    // The same rounding for every name: long enough for the wave's full half-circle end (concentric with the blue one)
    // and its full curves, short enough to stay in the glass (a longer name ends with « … »).
    t.style.minWidth = `${nav.offsetWidth + size / 2 + FILLET + OVERSHOOT - left}px`;
    t.style.maxWidth = `${nav.offsetWidth + ROOM - SLEEVE - 6 - left}px`;
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    const moves = Math.abs(dy) > 0.5;
    if (moves) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
    pour(moves ? dy : 0, moves ? POUR_AT : 0);
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
      {/* The glass's shadow (a blurred copy of its outline, seen only outside it), the glass (wider than the rail, for
          the wave) and its rim: all clipped to the same outline. */}
      <div ref={shadow} aria-hidden style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }} className="pointer-events-none absolute inset-y-0 left-0">
        <div className="rail-shadow absolute inset-0">
          <div ref={shadowShape} className="absolute inset-0 bg-current" />
        </div>
      </div>
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
      <div ref={rimShade} aria-hidden style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }} className="pointer-events-none absolute inset-y-0 left-0 bg-(--glass-rim-shade)" />
      <div ref={rimLight} aria-hidden style={{ width: `calc(var(--layout-rail) + ${ROOM}px)` }} className="rail-rim pointer-events-none absolute inset-y-0 left-0" />
      <nav ref={railRef} aria-label="Navigation principale" className="relative z-10 flex h-full w-(--layout-rail) shrink-0 flex-col items-center rounded-2xl pt-[22px] pb-[23px]">
        <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        {/* The name's bubble: the same blue as the round one, over it (z-1, the items z-2); clipped away at rest. */}
        <span ref={tongue} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="absolute z-[1] flex items-center rounded-full bg-accent-default pr-[calc(18px+14px)] pl-[54px] text-label-m whitespace-nowrap text-text-on-accent shadow-hairline-top">
          <span ref={name} className="min-w-0 truncate opacity-0">
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
                    if (on && !tongue.current?.getAnimations().length) pour(0, 0);
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
  const glass = useLiquidGlass<HTMLSpanElement>({ bezel: 12, strength: 8 });
  // Same bubble as the tab bar: it moves at once, the view (often a heavy screen) follows two frames later.
  const { shown, pick } = useDeferredPick(value, onChange);
  const { bubble, item, shell } = useLiquidBubble(shown, options.length);
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex gap-1 rounded-full p-1">
      {/* The glass, a layer behind the bubble: its rim never crosses the blue, and it stretches with the overshoot. */}
      <span
        ref={(el) => {
          shell(el);
          glass(el);
        }}
        aria-hidden
        className="liquid pointer-events-none absolute inset-0 rounded-full"
      />
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

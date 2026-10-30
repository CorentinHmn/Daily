/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE } from './atoms';
import { useLiquidGlass, webkitBackdrop } from './glass';
import { SPRING, reducedMotion, stretchAt, travel, useDeferredPick, useLiquidBubble } from './liquid';
import { cssPx } from '../theme/tokens';

export type NavItem<T extends string> = { id: T; label: string; icon: LucideIcon; badge?: string; live?: boolean };

/** Room for the glass beyond the open rail: its spring overshoots a little. */
const ROOM = 24;
/** Open or folded, kept on this device; folded at first (the slim pill of the glass dashboard). */
const KEY = 'cadence.rail';
export function readRailOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'open';
  } catch {
    // Private window: the default.
    return false;
  }
}
export function saveRailOpen(open: boolean) {
  try {
    localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    // Private window: the default next time.
  }
}

/** The spring's progress with half its overshoot: the rail, and the page beside it, only sway a little. */
const soft = (p: number) => (p > 1 ? 1 + (p - 1) * 0.5 : p);
/** Its names fade in once the rail is on its way (as the tab bar's name), and out at once when it folds. */
const LABEL_IN: Keyframe[] = [
  { opacity: 0, transform: 'translateX(-6px)' },
  { opacity: 1, transform: 'none' },
];

/** Folded, the name pours out of the rail with the active item: */
/** extra width of the name's bubble, kept hidden so that its spring can overshoot (the liquid bounce) without a gap; */
const OVERSHOOT = 14;
/** glass of the wave around the poured bubble (px), and radius of its hollow curves where it leaves the rail; */
const SLEEVE = 12;
const FILLET = 26;
/** width of the glass beyond the folded rail, where the wave can go (the longest name fits); */
const WAVE = 150;
/** one frame (the pour is sampled at 60 per second), the hold with the name out, the flow back in (the profile menu's); */
const FRAME = 1000 / 60;
const HOLD = 1100;
const BACK = 300;
/** while moving, the name starts pouring when the bubble is halfway, then rides along with it. */
const POUR_AT = SPRING.frames.findIndex((f) => f.p >= 0.5);

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
    `M ${R} ${i} H ${n(W - R)} A ${R - i} ${R - i} 0 0 1 ${n(W - i)} ${R}`,
    `V ${n(top - f)} A ${n(fi)} ${n(fi)} 0 0 0 ${n(W + f)} ${n(top + i)}`,
    `H ${n(W + e - c)} A ${n(ci)} ${n(hi)} 0 0 1 ${n(W + e - c + ci)} ${n(cy)} A ${n(ci)} ${n(hi)} 0 0 1 ${n(W + e - c)} ${n(bottom - i)}`,
    `H ${n(W + f)} A ${n(fi)} ${n(fi)} 0 0 0 ${n(W - i)} ${n(bottom + f)}`,
    `V ${H - R} A ${R - i} ${R - i} 0 0 1 ${n(W - R)} ${H - i} H ${R} A ${R - i} ${R - i} 0 0 1 ${i} ${H - R} V ${R} A ${R - i} ${R - i} 0 0 1 ${R} ${i} Z`,
  ].join(' ');
}

/** The clip-paths of every layer for one outline: the glass, its shadow (only outside it), its rim (a ring). */
function railLayers(W: number, H: number, R: number, e = 0, cy = H / 2, hh = 0) {
  const d = railShape(W, H, R, e, cy, hh);
  return {
    glass: `path('${d}')`,
    shadow: `path(evenodd, 'M -80 -80 H ${Math.round(W + WAVE + ROOM + 400)} V ${H + 80} H -80 Z ${d}')`,
    shade: `path(evenodd, '${d} ${railShape(W, H, R, e, cy, hh, 1)}')`,
    light: `path(evenodd, '${d} ${railShape(W, H, R, e, cy, hh, 1.5)}')`,
  };
}

/** An item's name beside its icon: clipped by its own box while the rail folds, faded in and out as it moves. */
function RailLabel({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <span data-rail-label aria-hidden className={cn('flex min-w-0 flex-1 items-center overflow-hidden text-left whitespace-nowrap', open ? 'opacity-100' : 'opacity-0', className)}>
      {children}
    </span>
  );
}

/**
 * Vertical app rail (NavRail 71:238): a slim pill of liquid glass, centred on the left of the page (the glass
 * dashboard's), open (icons and names) or folded (icons only) from the top bar, kept on this device.
 * Active item = the only light of the rail: one bubble (a pill under the icon and its name, a circle when folded) that
 * travels between the items like the phone's tab bar, with the same spring (keyframes played by Web Animations).
 * Folded, hovering another item shows its name in a small label beside the rail.
 * Opening or folding, the rail's width follows that same spring (half its overshoot): the bubble, the rows and the page
 * beside it follow the layout, the names fade in once it is on its way and out at once.
 * Folded, halfway there the bubble starts pouring out of the rail with the item's name, the rail's own glass swelling
 * into a wave around it; the poured bubble and the wave ride along with the round one (same spring, same stretch,
 * same bounce), hold, then flow back in. Hovering the active item pours the name again.
 * The glass is one layer wider than the rail (open, or folded with its wave), shaped by a clip-path; its shadow (only
 * outside it) and its rim (a ring between the outline and the outline moved inwards) are clip-paths of the same
 * outline, animated with the same keyframes: one piece of glass, no seam, nothing that can drift from the rest. While
 * it moves, its refraction gives way to the same frost in CSS (an SVG filter run again on every frame stuttered).
 */
export function NavRail<T extends string>({ items, active, onNavigate, open }: { items: NavItem<T>[]; active: T; onNavigate: (id: T) => void; open: boolean }) {
  // While it opens or folds, the glass keeps its frost without the bent rim (see `paused`), rebuilt once it rests.
  const [moving, setMoving] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const glass = useLiquidGlass<HTMLDivElement>({
    bezel: 26,
    strength: 18,
    lens: () => {
      const nav = railRef.current;
      if (!nav) return null;
      const r = parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 28;
      return { x: 0, y: 0, w: cssPx(open ? '--layout-rail-open' : '--layout-rail'), h: nav.offsetHeight, r };
    },
    lensKey: open ? 'open' : 'folded',
    paused: moving,
  });
  const frame = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement | null>(null);
  const sheen = useRef<HTMLDivElement>(null);
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
  /** The state the rail was last laid out in (a change of `open` from the top bar starts a move). */
  const laid = useRef(open);
  // The clicked item lights up at once; the screen follows two frames later, the bubble already on its way.
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  const label = items.find((i) => i.id === shown)?.label ?? '';
  const layerWidth = { width: `calc(max(var(--layout-rail-open) + ${ROOM}px, var(--layout-rail) + ${WAVE}px))` };

  /** Size of the rail and the radius of its corners. */
  const geometry = useCallback(() => {
    const nav = railRef.current;
    if (!nav) return null;
    return { W: nav.offsetWidth, H: nav.offsetHeight, R: parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 28 };
  }, []);

  /** The layers that follow the rail's outline. */
  const parts = useCallback(() => {
    const [sl, sn, sh, ss, rs, rl] = [shell.current, sheen.current, shadow.current, shadowShape.current, rimShade.current, rimLight.current];
    return sl && sn && sh && ss && rs && rl ? { sl, sn, sh, ss, rs, rl } : null;
  }, []);

  /** The glass at rest, as wide as the rail. */
  const rest = useCallback(() => {
    const g = geometry();
    const p = parts();
    if (!g || !p) return;
    const W = g.W;
    const l = railLayers(W, g.H, g.R);
    p.sl.style.clipPath = p.ss.style.clipPath = l.glass;
    p.sh.style.clipPath = l.shadow;
    p.rs.style.clipPath = l.shade;
    p.rl.style.clipPath = l.light;
    p.rl.style.backgroundSize = `${W}px 100%`;
    p.sn.style.width = `${W}px`;
  }, [geometry, parts]);

  /** Stops the wave (it flows back at once): the rail opens or folds, or a new pour starts. */
  const still = useCallback(() => {
    for (const el of [tongue.current, name.current]) el?.getAnimations().forEach((a) => a.cancel());
    glow.current?.cancel();
  }, []);

  /**
   * Folded: the bubble pours out with the name and the rail's glass swells around it, holds, then all flow back in.
   * Every layer gets keyframes sampled on one 60 fps timeline from the click: the round bubble's travel `dy` (its
   * spring, stretch and bounce, which the poured bubble and the wave follow), from `start` frames the pour's spring.
   */
  const pour = useCallback(
    (dy: number, start: number) => {
      const [t, n, b] = [tongue.current, name.current, bubble.current];
      const g = geometry();
      const p = parts();
      // Not while the rail folds: the wave grows from the rail's final edge.
      if (!t || !n || !b || !g || !p || reducedMotion() || frame.current?.getAnimations().length) return;
      still();
      for (const el of Object.values(p)) el.getAnimations().forEach((a) => a.cancel());
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
      const flow = play(t, (s) => {
        const v = r * (1 - s.thin);
        return { transform: `translateY(${s.off}px) scaleY(${s.along})`, clipPath: s.right >= width ? `inset(0 ${width}px 0 0 round ${r}px)` : `inset(${v}px ${s.right}px ${v}px 0 round ${r - v}px)` };
      });
      // The wave: as far out as the poured bubble, as high as it (with the glass around), where the round bubble is.
      const outline = samples.map((s) => {
        const e = s.right >= width ? 0 : Math.max(0, t.offsetLeft + width - s.right + SLEEVE - g.W);
        return railLayers(g.W, g.H, g.R, e, cy + s.off, r * s.thin * s.along + SLEEVE);
      });
      play(p.sl, (_, i) => ({ clipPath: outline[i]!.glass }));
      play(p.ss, (_, i) => ({ clipPath: outline[i]!.glass }));
      play(p.sh, (_, i) => ({ clipPath: outline[i]!.shadow }));
      play(p.rs, (_, i) => ({ clipPath: outline[i]!.shade }));
      play(p.rl, (_, i) => ({ clipPath: outline[i]!.light }));
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
      setMoving(true);
      flow.onfinish = () => setMoving(false);
    },
    [geometry, parts, still],
  );

  // Open or fold: the rail's width (the page beside it follows) and every layer of its glass on one spring.
  useLayoutEffect(() => {
    const [f, nav, g, p] = [frame.current, railRef.current, geometry(), parts()];
    if (!f || !nav || !g || !p || laid.current === open) return;
    laid.current = open;
    // Where the move starts: mid-flight, the width the running spring holds; at rest, the other state's.
    const start = f.getAnimations().length ? f.getBoundingClientRect().width : cssPx(open ? '--layout-rail' : '--layout-rail-open');
    setMoving(!reducedMotion());
    still();
    for (const el of [f, ...Object.values(p)]) el.getAnimations().forEach((a) => a.cancel());
    const labels = [...nav.querySelectorAll<HTMLElement>('[data-rail-label]')];
    labels.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    const to = f.offsetWidth;
    rest();
    if (reducedMotion() || Math.abs(start - to) < 0.5) return setMoving(false);
    const widths = SPRING.frames.map(({ p: q }) => start + (to - start) * soft(q));
    const timing = { duration: SPRING.ms, easing: 'linear' };
    const shapes = widths.map((w) => railLayers(w, g.H, g.R));
    const move = f.animate(
      widths.map((w) => ({ width: `${w}px` })),
      timing,
    );
    p.sl.animate(
      shapes.map((s) => ({ clipPath: s.glass })),
      timing,
    );
    p.ss.animate(
      shapes.map((s) => ({ clipPath: s.glass })),
      timing,
    );
    p.sh.animate(
      shapes.map((s) => ({ clipPath: s.shadow })),
      timing,
    );
    p.rs.animate(
      shapes.map((s) => ({ clipPath: s.shade })),
      timing,
    );
    p.rl.animate(
      shapes.map((s, i) => ({ clipPath: s.light, backgroundSize: `${widths[i]}px 100%` })),
      timing,
    );
    p.sn.animate(
      widths.map((w) => ({ width: `${w}px` })),
      timing,
    );
    for (const el of labels) {
      if (open) el.animate(LABEL_IN, { duration: 220, delay: 110, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
      else el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: 'linear' });
    }
    move.onfinish = () => setMoving(false);
  }, [open, geometry, parts, rest, still]);

  // The bubble goes to the shown item: as wide as the rows (CSS), only its height and place are set here; folded, the
  // name pours out with it.
  useLayoutEffect(() => {
    const [b, t, nav] = [bubble.current, tongue.current, railRef.current];
    const tab = tabs.current.get(shown);
    if (!b || !t || !nav || !tab) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new item.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.top - nav.getBoundingClientRect().top + seen.height / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const { offsetTop: top, offsetLeft: left, offsetHeight: size } = tab;
    Object.assign(b.style, { top: `${top}px`, height: `${size}px` });
    Object.assign(t.style, { top: `${top}px`, left: `${left}px`, height: `${size}px` });
    // The same rounding for every name: long enough for the wave's full half-circle end (concentric with the blue one)
    // and its full curves, short enough to stay in the glass (a longer name ends with « … »).
    t.style.minWidth = `${nav.offsetWidth + size / 2 + FILLET + OVERSHOOT - left}px`;
    t.style.maxWidth = `${nav.offsetWidth + WAVE - SLEEVE - 6 - left}px`;
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    const moves = Math.abs(dy) > 0.5;
    if (moves) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
    if (!open) pour(moves ? dy : 0, moves ? POUR_AT : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open: opening or folding is not a move of the bubble
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

  const row = 'relative flex h-12 w-full items-center rounded-full text-label-m';
  const icon = 'relative inline-flex size-12 shrink-0 items-center justify-center rounded-full';
  const badge = 'tnum inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[10px] font-medium text-text-primary';

  return (
    <div ref={frame} style={{ width: open ? 'var(--layout-rail-open)' : 'var(--layout-rail)' }} className="relative z-20 flex shrink-0">
      {/* The glass's shadow (a blurred copy of its outline, seen only outside it), the glass (as wide as the open
          rail) and its rim: all clipped to the same outline. */}
      <div ref={shadow} aria-hidden style={layerWidth} className="pointer-events-none absolute inset-y-0 left-0">
        <div className="rail-shadow absolute inset-0">
          <div ref={shadowShape} className="absolute inset-0 bg-current" />
        </div>
      </div>
      {/* WebKit: the frost in the rail's own rounded box (it ignores the clip-path); the wave keeps the tint only. */}
      {webkitBackdrop && <div aria-hidden className="chip-frost pointer-events-none absolute inset-0 rounded-(--radius-rail)" />}
      <div
        ref={(el) => {
          shell.current = el;
          glass(el);
        }}
        aria-hidden
        style={webkitBackdrop ? { ...layerWidth, backdropFilter: 'none', WebkitBackdropFilter: 'none' } : layerWidth}
        className="rail-glass pointer-events-none absolute inset-y-0 left-0"
      >
        <div ref={sheen} className="rail-sheen absolute inset-y-0 left-0 w-(--layout-rail) rounded-(--radius-rail)" />
      </div>
      <div ref={rimShade} aria-hidden style={layerWidth} className="pointer-events-none absolute inset-y-0 left-0 bg-(--glass-rim-shade)" />
      <div ref={rimLight} aria-hidden style={layerWidth} className="rail-rim pointer-events-none absolute inset-y-0 left-0" />
      <nav ref={railRef} aria-label="Navigation principale" className="relative z-10 flex w-full flex-col rounded-(--radius-rail) p-2">
        <span ref={bubble} aria-hidden className="absolute inset-x-2 rounded-full bg-nav-active [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        {/* Folded, the name's bubble: the same colour as the round one, over it (z-1, the items z-2); clipped away at rest. */}
        <span ref={tongue} aria-hidden style={{ clipPath: 'inset(0 100% 0 0)' }} className="absolute z-[1] flex items-center rounded-full bg-nav-active pr-[calc(18px+14px)] pl-[54px] text-label-m whitespace-nowrap text-text-on-nav shadow-hairline-top">
          <span ref={name} className="min-w-0 truncate opacity-0">
            {label}
          </span>
        </span>
        <ul className="flex flex-col gap-2">
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
                    if (on && !open && !tongue.current?.getAnimations().length) pour(0, 0);
                  }}
                  aria-label={item.label}
                  aria-current={item.id === active ? 'page' : undefined}
                  className={cn(row, 'group/item z-[2] transition-colors duration-200', on ? 'text-text-on-nav delay-75' : 'text-text-secondary hover:text-text-primary')}
                >
                  <span className={cn(icon, !on && 'bg-bg-subtle transition-colors group-hover/item:bg-bg-hover')}>
                    <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden />
                    {item.badge && !open && <span className={cn(badge, 'absolute -top-1 -right-1')}>{item.badge}</span>}
                    {item.live && <span aria-label="Séance en cours" className="live-halo absolute top-1 right-1 size-2.5 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
                  </span>
                  <RailLabel open={open} className="pl-1">
                    {item.label}
                    {item.badge && open && <span className={cn(badge, 'mr-3 ml-auto')}>{item.badge}</span>}
                  </RailLabel>
                  {/* Folded: another item's name, beside the rail on hover (the active one pours out instead). */}
                  {!open && !on && (
                    <span aria-hidden className="rail-tip pointer-events-none absolute top-1/2 left-[calc(100%+14px)] -translate-x-1 -translate-y-1/2 rounded-full px-2.5 py-1 text-label-s whitespace-nowrap opacity-0 transition-[opacity,translate] duration-(--v-duree-courte) group-hover/item:translate-x-0 group-hover/item:opacity-100">
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
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
      <span ref={bubble} aria-hidden className="absolute rounded-full bg-nav-active shadow-hairline-top will-change-transform" />
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
            className={cn('relative inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-label-m transition-colors duration-200', active ? 'text-text-on-nav delay-75' : 'text-text-secondary hover:text-text-primary')}
          >
            {Icon && <Icon className="relative" size={16} strokeWidth={ICON_STROKE} aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Halo shell pieces (Components 71:294, 66:343): NavRail in liquid glass and SegmentedControl (view switch of the page
 * header).
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Settings, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE, Logo } from './atoms';
import { useLiquidGlass } from './glass';
import { SPRING, reducedMotion, travel, useDeferredPick, useLiquidBubble } from './liquid';
import { cssPx } from '../theme/tokens';

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

/** Room for the glass beyond the open rail: its spring overshoots a little. */
const ROOM = 24;
/** Open or folded, kept on this device; open at first on a large screen (it takes room from the page). */
const KEY = 'cadence.rail';
function readOpen(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Private window: the default.
  }
  return saved ? saved === 'open' : window.innerWidth >= 1440;
}
function saveOpen(open: boolean) {
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

/** Outline of the rail's glass (W × H, corners R); `inset` = the same outline moved inwards (for the rim's ring). */
function railShape(W: number, H: number, R: number, inset = 0): string {
  const i = inset;
  const r = R - i;
  const n = (v: number) => Math.round(v * 100) / 100;
  return `M ${R} ${i} H ${n(W - R)} A ${r} ${r} 0 0 1 ${n(W - i)} ${R} V ${H - R} A ${r} ${r} 0 0 1 ${n(W - R)} ${H - i} H ${R} A ${r} ${r} 0 0 1 ${i} ${H - R} V ${R} A ${r} ${r} 0 0 1 ${R} ${i} Z`;
}

/** The clip-paths of every layer for a rail W wide: the glass, its shadow (only outside it), its rim (a ring). */
function railLayers(W: number, H: number, R: number) {
  const d = railShape(W, H, R);
  return {
    glass: `path('${d}')`,
    shadow: `path(evenodd, 'M -80 -80 H ${Math.round(W + ROOM + 400)} V ${H + 80} H -80 Z ${d}')`,
    shade: `path(evenodd, '${d} ${railShape(W, H, R, 1)}')`,
    light: `path(evenodd, '${d} ${railShape(W, H, R, 1.5)}')`,
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
 * Vertical app rail (NavRail 71:238), liquid glass, open (icons and names) or folded (icons only), kept on this device.
 * Active item = the only light of the rail: one bubble (a pill under the icon and its name, a circle when folded) that
 * travels between the items like the phone's tab bar, with the same spring (keyframes played by Web Animations).
 * Opening or folding, the rail's width follows that same spring (half its overshoot): the bubble, the rows and the page
 * beside it follow the layout, the names fade in once it is on its way and out at once.
 * The glass is one layer as wide as the open rail (and a little more), shaped by a clip-path; its shadow (only outside
 * it) and its rim (a ring between the outline and the outline moved inwards) are clip-paths of the same outline,
 * animated with the same keyframes: one piece of glass, no seam, nothing that can drift from the rest. While it moves,
 * its refraction gives way to the same frost in CSS (an SVG filter run on every frame stuttered).
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
  const [open, setOpen] = useState(readOpen);
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
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  const placed = useRef(false);
  /** The rail's width as seen when it was toggled (mid-flight included): where the next move starts. */
  const from = useRef<number | null>(null);
  // The clicked item lights up at once; the screen follows two frames later, the bubble already on its way.
  const [pending, setPending] = useState<{ id: T; from: T } | null>(null);
  const shown = pending && pending.from === active ? pending.id : active;
  const layerWidth = { width: `calc(var(--layout-rail-open) + ${ROOM}px)` };

  /** Height of the rail and the radius of its corners. */
  const geometry = useCallback(() => {
    const nav = railRef.current;
    if (!nav) return null;
    return { H: nav.offsetHeight, R: parseFloat(getComputedStyle(nav).borderTopLeftRadius) || 28 };
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
    const nav = railRef.current;
    if (!g || !p || !nav) return;
    const W = nav.offsetWidth;
    const l = railLayers(W, g.H, g.R);
    p.sl.style.clipPath = p.ss.style.clipPath = l.glass;
    p.sh.style.clipPath = l.shadow;
    p.rs.style.clipPath = l.shade;
    p.rl.style.clipPath = l.light;
    p.rl.style.backgroundSize = `${W}px 100%`;
    p.sn.style.width = `${W}px`;
  }, [geometry, parts]);

  const toggle = () => {
    from.current = frame.current?.getBoundingClientRect().width ?? null;
    setMoving(!reducedMotion());
    setOpen((o) => {
      saveOpen(!o);
      return !o;
    });
  };

  // Open or fold: the rail's width (the page beside it follows) and every layer of its glass on one spring.
  useLayoutEffect(() => {
    const [f, nav, g, p] = [frame.current, railRef.current, geometry(), parts()];
    const start = from.current;
    from.current = null;
    if (!f || !nav || !g || !p || start === null) return;
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
  }, [open, geometry, parts, rest]);

  // The bubble goes to the shown item: as wide as the rows (CSS), only its height and place are set here.
  useLayoutEffect(() => {
    const [b, nav] = [bubble.current, railRef.current];
    const tab = tabs.current.get(shown);
    if (!b || !nav || !tab) return;
    // Where the bubble is seen now (mid-flight included), before moving it to the new item.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.top - nav.getBoundingClientRect().top + seen.height / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const { offsetTop: top, offsetHeight: size } = tab;
    Object.assign(b.style, { top: `${top}px`, height: `${size}px` });
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.height || reducedMotion()) return;
    const dy = fromCenter - (top + size / 2);
    if (Math.abs(dy) > 0.5) b.animate(travel(dy, 'y', seen.height, size), { duration: SPRING.ms, easing: 'linear' });
  }, [shown]);

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
  const icon = 'relative inline-flex size-12 shrink-0 items-center justify-center';
  const badge = 'tnum inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-card px-1 text-[10px] font-medium text-text-primary';
  const ghost = 'text-text-secondary transition-colors duration-(--v-duree-courte) hover:bg-bg-card/70 hover:text-text-primary';

  return (
    <div ref={frame} style={{ width: open ? 'var(--layout-rail-open)' : 'var(--layout-rail)' }} className="relative z-20 flex h-full shrink-0">
      {/* The glass's shadow (a blurred copy of its outline, seen only outside it), the glass (as wide as the open
          rail) and its rim: all clipped to the same outline. */}
      <div ref={shadow} aria-hidden style={layerWidth} className="pointer-events-none absolute inset-y-0 left-0">
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
        style={layerWidth}
        className="rail-glass pointer-events-none absolute inset-y-0 left-0"
      >
        <div ref={sheen} className="rail-sheen absolute inset-y-0 left-0 w-(--layout-rail) rounded-2xl" />
      </div>
      <div ref={rimShade} aria-hidden style={layerWidth} className="pointer-events-none absolute inset-y-0 left-0 bg-(--glass-rim-shade)" />
      <div ref={rimLight} aria-hidden style={layerWidth} className="rail-rim pointer-events-none absolute inset-y-0 left-0" />
      <nav ref={railRef} aria-label="Navigation principale" className="relative z-10 flex h-full w-full flex-col rounded-2xl px-6 pt-[22px] pb-[23px]">
        <span ref={bubble} aria-hidden className="absolute inset-x-6 rounded-full bg-accent-default [box-shadow:var(--shadow-hairline-top),var(--drop-shadow-glow-nav)] will-change-transform" />
        <div className="flex w-12 justify-center">
          <RailDots />
        </div>
        <button type="button" onClick={onLogo} aria-label="Cadence, aujourd'hui" className="relative mt-[22px] flex w-full items-center rounded-full">
          <span className="inline-flex w-12 shrink-0 justify-center">
            <Logo size={44} />
          </span>
          <RailLabel open={open} className="pl-2 text-title-s font-semibold text-text-primary">
            Cadence
          </RailLabel>
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
                  aria-label={item.label}
                  aria-current={item.id === active ? 'page' : undefined}
                  className={cn(row, 'z-[2] transition-colors duration-200', on ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:bg-bg-card/70 hover:text-text-primary')}
                >
                  <span className={icon}>
                    <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden />
                    {item.badge && !open && <span className={cn(badge, 'absolute -top-1 -right-1')}>{item.badge}</span>}
                    {item.live && <span aria-label="Séance en cours" className="live-halo absolute top-1 right-1 size-2.5 rounded-full bg-accent-default text-accent-default ring-2 ring-bg-card" />}
                  </span>
                  <RailLabel open={open}>
                    {item.label}
                    {item.badge && open && <span className={cn(badge, 'mr-3 ml-auto')}>{item.badge}</span>}
                  </RailLabel>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-3 pt-3">
          <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? 'Réduire le menu' : 'Déplier le menu'} className={cn(row, ghost)}>
            <span className={icon}>{open ? <PanelLeftClose size={20} strokeWidth={ICON_STROKE} aria-hidden /> : <PanelLeftOpen size={20} strokeWidth={ICON_STROKE} aria-hidden />}</span>
            <RailLabel open={open}>Réduire</RailLabel>
          </button>
          {onSettings && (
            <button type="button" onClick={onSettings} aria-label="Paramètres" className={cn(row, ghost)}>
              <span className={icon}>
                <Settings size={20} strokeWidth={ICON_STROKE} aria-hidden />
              </span>
              <RailLabel open={open}>Paramètres</RailLabel>
            </button>
          )}
          <button
            ref={fabRef}
            type="button"
            aria-label={fabLabel}
            onClick={onFab}
            className={cn(row, 'bg-accent-default text-text-on-accent drop-shadow-glow-accent transition-[background-color,transform] duration-(--v-duree-courte) hover:bg-accent-glow active:scale-95')}
          >
            <span className={icon}>
              <Plus size={24} strokeWidth={ICON_STROKE} aria-hidden />
            </span>
            <RailLabel open={open}>{fabLabel}</RailLabel>
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

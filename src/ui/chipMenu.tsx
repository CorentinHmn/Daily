/**
 * A liquid-glass chip that grows into its menu (the profile chip, the + of the quick add): one piece of glass, the
 * chip's pill swelling down (or up, `up`: the phone's +, at the bottom) into the menu, joined by a hollow curve, with
 * the bubbles' spring (open) and a flow back (close). Like the rail's glass: the glass is a layer larger than the chip,
 * shaped by an animated clip-path; its shadow (outside the outline), rim (a ring between the outline and the outline
 * moved inwards) and the menu's denser tint follow the same keyframes.
 * WebKit (Safari, every iPhone browser) does not clip a backdrop-filter by a clip-path (the whole layer showed as a
 * frosted square around the menu), nor a clip-path inside a filter (the blurred shadow was the whole layer: a square
 * shadow). There the outline keeps its tint and rim (plain painting, clipped); the frost comes from two rounded boxes
 * — the chip's column and the menu — and the shadow from the box-shadows of two such boxes, clipped (no filter) to
 * what lies outside the outline, all moved on the same keyframes. (A single box over the outline's bounds left a faint
 * rectangle beside the chip.)
 * The chip's content and the menu's items sit above the glass, so its rim never crosses them (the sync dot).
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { cn } from './cn';
import { useLiquidGlass, webkitBackdrop } from './glass';
import { SPRING, reducedMotion } from './liquid';
import { MenuList, type MenuItem } from './overlays';

/** Gap between the chip and the menu, room around the shapes (overshoot), the menu's corners, the hollow curve. */
const GAP = 6;
const ROOM = 10;
const CORNER = 16;
const FILLET = 14;
/** One menu row and the list's padding (MenuList), until the list is measured. */
const ROW = 36;
const PAD = 6;
const FRAME = 1000 / 60;
const CLOSE_MS = 300;

/** Safari and the iPhone's browsers (all WebKit): see above. */
const WEBKIT = webkitBackdrop;

interface Box {
  /** chip: left, right, top and height (its pill); menu: left, right, top, bottom — all in the glass layer. */
  cx0: number;
  cx1: number;
  top: number;
  ch: number;
  mx0: number;
  my0: number;
  my1: number;
}

/**
 * How far the glass has gone at `q`: its bottom (down from the chip) and its left edge. Down first, then wide (and back
 * the other way): the menu widens to the left a little behind its growth.
 */
function reach(g: Box, q: number) {
  const bottom = g.top + g.ch + (g.my1 - g.top - g.ch) * q;
  const w = Math.max(0, Math.min(1.1, (q - 0.6) / 0.4));
  const out = (g.cx0 - g.mx0) * (w <= 1 ? w * w * (3 - 2 * w) : 1 + (w - 1) * 0.5);
  return { bottom, out, left: g.cx0 - out };
}

/**
 * Outline at `q` (0 = the chip's pill, 1 = chip + menu): the pill's right side runs down into the menu's, its left
 * side meets the menu's top through a hollow curve; `inset` = the same outline moved inwards (the rim's ring). Always
 * the same commands, so that it can be interpolated. Drawn downwards; `flip` = the layer's height when the menu opens
 * upwards (the outline mirrored).
 */
function shape(g: Box, q: number, inset = 0, flip?: number): string {
  const i = inset;
  const k = Math.min(1, q);
  const rc = g.ch / 2;
  const { bottom, out, left } = reach(g, q);
  const rb = rc + (CORNER - rc) * k;
  const ytop = g.top + rc + (g.my0 - g.top - rc) * q;
  // What the menu sticks out beyond the chip is shared, in proportion, between its corner and the hollow curve — never
  // a sharp angle where the chip's side meets the menu's top, however far it is.
  const rt = Math.min(CORNER, (out * CORNER) / (CORNER + FILLET));
  const f = Math.min(FILLET, (out * FILLET) / (CORNER + FILLET), (g.my0 - g.top - rc) * Math.max(0, q));
  const n = (v: number) => Math.round(v * 100) / 100;
  const r0 = (v: number) => n(Math.max(0, v));
  const Y = (v: number) => n(flip === undefined ? v : flip - v);
  // Mirrored, every arc turns the other way.
  const s = (sweep: 0 | 1) => (flip === undefined ? sweep : 1 - sweep);
  return [
    `M ${n(g.cx0 + rc)} ${Y(g.top + i)} H ${n(g.cx1 - rc)} A ${r0(rc - i)} ${r0(rc - i)} 0 0 ${s(1)} ${n(g.cx1 - i)} ${Y(g.top + rc)}`,
    `V ${Y(bottom - rb)} A ${r0(rb - i)} ${r0(rb - i)} 0 0 ${s(1)} ${n(g.cx1 - rb)} ${Y(bottom - i)}`,
    `H ${n(left + rb)} A ${r0(rb - i)} ${r0(rb - i)} 0 0 ${s(1)} ${n(left + i)} ${Y(bottom - rb)}`,
    `V ${Y(ytop + rt)} A ${r0(rt - i)} ${r0(rt - i)} 0 0 ${s(1)} ${n(left + rt)} ${Y(ytop + i)}`,
    `H ${n(g.cx0 - f)} A ${n(f + i)} ${n(f + i)} 0 0 ${s(0)} ${n(g.cx0 + i)} ${Y(ytop - f)}`,
    `V ${Y(g.top + rc)} A ${r0(rc - i)} ${r0(rc - i)} 0 0 ${s(1)} ${n(g.cx0 + rc)} ${Y(g.top + i)} Z`,
  ].join(' ');
}

/** The clip-paths of every layer for the outline at `q`. */
function layers(g: Box, W: number, H: number, q: number, up: boolean) {
  const flip = up ? H : undefined;
  const d = shape(g, q, 0, flip);
  return {
    glass: `path('${d}')`,
    shadow: `path(evenodd, 'M -60 -60 H ${W + 60} V ${H + 60} H -60 Z ${d}')`,
    shade: `path(evenodd, '${d} ${shape(g, q, 1, flip)}')`,
    light: `path(evenodd, '${d} ${shape(g, q, 1.5, flip)}')`,
  };
}

/** The outline's bounds at `q`, in the layer: the sheen and the rim's light spread over the glass as it grows. */
function bounds(g: Box, H: number, q: number, up: boolean) {
  const { bottom, left } = reach(g, q);
  const px = (v: number) => `${Math.round(v * 100) / 100}px`;
  const x = left;
  const y = up ? H - bottom : g.top;
  const w = g.cx1 - left;
  const h = bottom - g.top;
  return {
    box: { left: px(x), top: px(y), width: px(w), height: px(h) },
    light: { backgroundPosition: `${px(x)} ${px(y)}`, backgroundSize: `${px(w)} ${px(h)}` },
  };
}

/**
 * WebKit: the frost under the outline at `q`, as two rounded boxes: the chip's column (down to the menu's top) and the
 * menu (its corner beside the column square, where they meet). Only the hollow curve has no frost.
 */
function frost(g: Box, H: number, q: number, up: boolean): Keyframe[] {
  const rc = g.ch / 2;
  const { bottom, out, left } = reach(g, q);
  const rb = rc + (CORNER - rc) * Math.min(1, q);
  const ytop = g.top + rc + (g.my0 - g.top - rc) * q;
  const rt = Math.min(CORNER, (out * CORNER) / (CORNER + FILLET));
  const px = (v: number) => `${Math.round(Math.max(0, v) * 100) / 100}px`;
  // Corners top left, top right, bottom right, bottom left; mirrored when the menu opens upwards.
  const piece = (x0: number, x1: number, y0: number, y1: number, [tl, tr, br, bl]: [number, number, number, number]): Keyframe => {
    const [t, b] = up ? [H - y1, H - y0] : [y0, y1];
    const r = up ? [bl, br, tr, tl] : [tl, tr, br, bl];
    return { left: px(x0), top: px(t), width: px(x1 - x0), height: px(b - t), borderRadius: r.map(px).join(' ') };
  };
  return [piece(g.cx0, g.cx1, g.top, ytop, [rc, rc, 0, 0]), piece(left, g.cx1, ytop, bottom, [rt, 0, rb, rb])];
}

export interface ChipMenuHandle {
  open: () => void;
}

export function ChipMenu({
  items,
  label,
  className,
  children,
  width = 240,
  up = false,
  bar = false,
  bare = false,
  ref,
}: {
  items: MenuItem[];
  label?: string;
  className?: string;
  children: (open: boolean) => ReactNode;
  width?: number;
  /** The menu opens above the chip (a chip at the bottom of the screen). */
  up?: boolean;
  /** The denser tint of the bars (the phone's tab bar, beside it). */
  bar?: boolean;
  /** No glass at rest (the chip is opaque, the avatar): it grows out of the chip when the menu opens. */
  bare?: boolean;
  /** `open()`: from a keyboard shortcut. */
  ref?: Ref<ChipMenuHandle>;
}) {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const open = phase === 'open';
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLDivElement | null>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const shadowShape = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const shadowClip = useRef<HTMLDivElement>(null);
  const shadowColumn = useRef<HTMLDivElement>(null);
  const shadowPanel = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [listH, setListH] = useState<number | null>(null);

  // The geometry: the chip's size (measured), the menu as wide as `width` (and always clearly wider than the chip, for
  // the hollow curve), as high as its rows, right-aligned under the chip.
  const menuW = size ? Math.max(width, size.w + 40) : width;
  const menuH = listH ?? items.length * ROW + PAD * 2;
  const W = menuW + ROOM * 2;
  const H = (size?.h ?? 0) + GAP + menuH + ROOM * 2;
  const box: Box | null = size ? { cx0: ROOM + menuW - size.w, cx1: ROOM + menuW, top: ROOM, ch: size.h, mx0: ROOM, my0: ROOM + size.h + GAP, my1: ROOM + size.h + GAP + menuH } : null;
  /** The chip's top in the glass layer (the layer is mirrored when the menu opens upwards). */
  const chipTop = box ? (up ? H - box.top - box.ch : box.top) : 0;
  const glass = useLiquidGlass<HTMLDivElement>({
    bezel: 14,
    strength: 9,
    // A little more frost than the bare chip: the menu's text stays legible over the page.
    blur: 3,
    lens: () => (box ? { x: box.cx0, y: chipTop, w: box.cx1 - box.cx0, h: box.ch, r: box.ch / 2 } : null),
    lensKey: box ? `${box.cx0}-${box.ch}-${chipTop}` : '',
  });

  // The chip's size, then (once the list exists, it needs the chip's) the list's height.
  const sized = size !== null;
  useLayoutEffect(() => {
    const b = button.current;
    if (!b) return;
    const measure = () => {
      setSize((s) => (s && s.w === b.offsetWidth && s.h === b.offsetHeight ? s : { w: b.offsetWidth, h: b.offsetHeight }));
      if (rows.current) setListH(rows.current.offsetHeight || null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    if (rows.current) ro.observe(rows.current);
    return () => ro.disconnect();
  }, [sized]);

  const els = () => [shell.current, shadow.current, shadowShape.current, shade.current, light.current, tint.current, list.current, column.current, panel.current, sheen.current, shadowClip.current, shadowColumn.current, shadowPanel.current];

  /** Every layer at rest at `q` (0: the chip alone, 1: open). */
  const settle = useCallback(
    (q: number) => {
      if (!box) return;
      const l = layers(box, W, H, q, up);
      const b = bounds(box, H, q, up);
      const [sl, sh, ss, rs, rl, tn, li, co, pa, sn, sc, scol, span] = els();
      if (!sl || !sh || !ss || !rs || !rl) return;
      if (sc) sc.style.clipPath = l.shadow;
      sl.style.clipPath = ss.style.clipPath = l.glass;
      sh.style.clipPath = l.shadow;
      rs.style.clipPath = l.shade;
      rl.style.clipPath = l.light;
      Object.assign(rl.style, b.light);
      if (sn) Object.assign(sn.style, b.box);
      if (tn) tn.style.opacity = String(q);
      if (li) {
        li.style.opacity = String(q);
        li.style.clipPath = l.glass;
      }
      if (co && pa) {
        const [c, p] = frost(box, H, q, up);
        Object.assign(co.style, c);
        Object.assign(pa.style, p);
        if (scol && span) {
          Object.assign(scol.style, c);
          Object.assign(span.style, p);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the box is derived from size and items
    [size?.w, size?.h, menuW, menuH, up],
  );

  // At rest (and after a resize), the outline of the current phase.
  useLayoutEffect(() => {
    if (phase !== 'closing') settle(open ? 1 : 0);
  }, [settle, phase, open]);

  /** Plays the outline from q(t): opening on the spring, closing on a smooth curve. */
  const play = useCallback(
    (opening: boolean) => {
      if (!box) return;
      const all = els();
      for (const el of all) el?.getAnimations().forEach((a) => a.cancel());
      if (reducedMotion()) {
        settle(opening ? 1 : 0);
        if (!opening) setPhase('closed');
        return;
      }
      const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const qs = opening ? SPRING.frames.map(({ p }) => (p > 1 ? 1 + (p - 1) * 0.5 : p)) : Array.from({ length: Math.ceil(CLOSE_MS / FRAME) + 1 }, (_, i) => 1 - ease(Math.min(1, (i * FRAME) / CLOSE_MS)));
      const duration = opening ? SPRING.ms : CLOSE_MS;
      const opts = { duration, easing: 'linear', fill: 'forwards' as const };
      const [sl, sh, ss, rs, rl, tn, li, co, pa, sn, sc, scol, span] = all;
      const outlines = qs.map((q) => layers(box, W, H, q, up));
      const spans = qs.map((q) => bounds(box, H, q, up));
      const pieces = co && pa ? qs.map((q) => frost(box, H, q, up)) : [];
      const anims = [
        sl?.animate(outlines.map((o) => ({ clipPath: o.glass })), opts),
        ss?.animate(outlines.map((o) => ({ clipPath: o.glass })), opts),
        sh?.animate(outlines.map((o) => ({ clipPath: o.shadow })), opts),
        rs?.animate(outlines.map((o) => ({ clipPath: o.shade })), opts),
        // The rim's light and the sheen spread over the whole glass: one piece, no ring left around the chip.
        rl?.animate(outlines.map((o, i) => ({ clipPath: o.light, ...spans[i]!.light })), opts),
        sn?.animate(spans.map((b) => b.box), opts),
        sc?.animate(outlines.map((o) => ({ clipPath: o.shadow })), opts),
        scol?.animate(pieces.map((f) => f[0]!), opts),
        span?.animate(pieces.map((f) => f[1]!), opts),
        co?.animate(pieces.map((f) => f[0]!), opts),
        pa?.animate(pieces.map((f) => f[1]!), opts),
        // The menu's tint comes with the glass; its items once the glass is mostly out, and they leave first.
        tn?.animate(qs.map((q) => ({ opacity: Math.max(0, Math.min(1, q)) })), opts),
        // (clipped by the same outline: they never show outside the glass; closing, they leave in the first 90 ms,
        // before the glass narrows under them)
        // Opening, they show once the glass is (nearly) as wide as the menu — on the furthest it has gone, so the
        // spring's bounce never dims them again.
        li?.animate(
          qs.map((_, i) => {
            const far = Math.max(...qs.slice(0, i + 1));
            const k = opening ? Math.max(0, Math.min(1, (far - 0.9) / 0.1)) : Math.max(0, 1 - (i * FRAME) / 90);
            return { opacity: k, clipPath: outlines[i]!.glass };
          }),
          opts,
        ),
      ];
      const last = anims.find(Boolean);
      if (last)
        last.onfinish = () => {
          settle(opening ? 1 : 0);
          for (const a of anims) a?.cancel();
          if (!opening) setPhase('closed');
        };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as settle
    [settle],
  );

  // Started from the click (the layers are always there): the glass is moving at the next frame.
  const close = useCallback(() => {
    setPhase((p) => (p === 'open' ? 'closing' : p));
    play(false);
  }, [play]);
  const toggle = () => {
    if (open) return close();
    setPhase('open');
    play(true);
  };

  // A shortcut asks for the menu (Ctrl K for the quick add): it opens, if it is not already.
  useImperativeHandle(ref, () => ({
    open: () => {
      if (open) return;
      setPhase('open');
      play(true);
    },
  }));

  // Outside click and Escape close it (Escape gives the focus back to the chip).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        button.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  // The glass layer, from the chip: the chip sits at the layer's top right (box.cx1 = ROOM + menuW), bottom right when
  // the menu opens upwards.
  const place = box && size ? { left: size.w - box.cx1, top: -chipTop, width: W, height: H, ...(bare && phase === 'closed' && { visibility: 'hidden' as const }) } : undefined;
  return (
    <div ref={wrap} className="relative z-40 shrink-0">
      {place && (
        <>
          {/* (WebKit blurs this one as a square: hidden there, see above.) */}
          <div ref={shadow} aria-hidden style={WEBKIT ? { ...place, display: 'none' } : place} className="pointer-events-none absolute">
            <div className="rail-shadow absolute inset-0">
              <div ref={shadowShape} className="absolute inset-0 bg-current" />
            </div>
          </div>
          {/* WebKit: the shadow and the frost, under the clipped tint (see above). */}
          {WEBKIT && (
            <div aria-hidden style={place} className="pointer-events-none absolute">
              {/* The shadow: the pieces' box-shadows, seen only outside the outline. */}
              <div ref={shadowClip} className="absolute inset-0">
                <div ref={shadowColumn} className="chip-shadow absolute" />
                <div ref={shadowPanel} className="chip-shadow absolute" />
              </div>
              <div ref={column} className="chip-frost absolute" />
              <div ref={panel} className="chip-frost absolute" />
            </div>
          )}
          <div
            ref={(el) => {
              shell.current = el;
              glass(el);
            }}
            aria-hidden
            style={{ ...place, ...(bar && { background: 'var(--glass-bar)' }), ...(WEBKIT && { backdropFilter: 'none', WebkitBackdropFilter: 'none' }) }}
            className="rail-glass pointer-events-none absolute"
          >
            <div ref={sheen} className="rail-sheen absolute" style={{ left: box!.cx0, top: chipTop, width: box!.cx1 - box!.cx0, height: box!.ch }} />
            {/* The menu's denser tint (legible over the page), over the whole glass, chip included: one even piece. */}
            <div ref={tint} className="chip-menu-tint absolute inset-0" style={{ opacity: 0 }} />
          </div>
          <div ref={shade} aria-hidden style={place} className="pointer-events-none absolute bg-(--glass-rim-shade)" />
          <div ref={light} aria-hidden style={{ ...place, backgroundPosition: `${box!.cx0}px ${chipTop}px`, backgroundSize: `${box!.cx1 - box!.cx0}px ${box!.ch}px` }} className="chip-rim pointer-events-none absolute" />
        </>
      )}
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={toggle} className={cn('relative', className)}>
        {children(open)}
      </button>
      {/* Always there (measured), inert while closed. */}
      {place && box && (
        <div ref={list} role="presentation" inert={phase === 'closed'} aria-hidden={phase === 'closed' || undefined} style={{ ...place, position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
          {/* Only the rows take clicks: the layer's box also covers the chip, which must stay clickable. */}
          <div ref={rows} style={{ position: 'absolute', left: box.mx0, top: up ? H - box.my1 : box.my0, width: menuW, pointerEvents: phase === 'closed' ? 'none' : 'auto' }}>
            <MenuList items={items} onClose={close} autoFocus={open} />
          </div>
        </div>
      )}
    </div>
  );
}

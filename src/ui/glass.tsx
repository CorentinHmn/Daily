/**
 * Liquid glass: the backdrop seen through an element is refracted at its rim, like through a thick convex glass.
 *
 * How: a displacement map (R = x shift, G = y shift, 128 = none) is drawn for the element's rounded rectangle: zero in
 * the middle, growing towards the edge along the inward normal. An SVG filter blurs the backdrop slightly, displaces
 * it with that map, then saturates it; the element uses it as `backdrop-filter: url(#…)`. This only renders in
 * Chromium (Benchmark › « Le Liquid Glass avec réfraction ne marche qu'en Chromium ») — which is exactly the desktop
 * app (Electron). Elsewhere, and with reduced transparency, `.liquid` keeps a frosted blur.
 *
 * Maps are drawn at half resolution (smooth gradients, the filter scales them up), cached by size, and the filters
 * live in one hidden <svg> in <body>.
 */
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from './cn';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const refractionSupported: boolean =
  typeof navigator !== 'undefined' &&
  /Chrome\//.test(navigator.userAgent) &&
  typeof matchMedia === 'function' &&
  !matchMedia('(prefers-reduced-transparency: reduce)').matches;

let defs: SVGDefsElement | null = null;
function filterDefs(): SVGDefsElement {
  if (defs?.isConnected) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

/** Signed distance to a rounded rectangle centred in (w, h), negative inside, + outward normal. */
function roundedRectField(px: number, py: number, w: number, h: number, r: number): { d: number; nx: number; ny: number } {
  const cx = w / 2;
  const cy = h / 2;
  const qx = Math.abs(px - cx) - (cx - r);
  const qy = Math.abs(py - cy) - (cy - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const outside = Math.hypot(ox, oy);
  const d = outside + Math.min(Math.max(qx, qy), 0) - r;
  let nx: number;
  let ny: number;
  if (qx > 0 && qy > 0 && outside > 0) {
    nx = ox / outside;
    ny = oy / outside;
  } else if (qx > qy) {
    nx = 1;
    ny = 0;
  } else {
    nx = 0;
    ny = 1;
  }
  return { d, nx: px < cx ? -nx : nx, ny: py < cy ? -ny : ny };
}

type Field = (x: number, y: number) => { dx: number; dy: number };

function drawMap(w: number, h: number, field: Field): string {
  const k = 0.5; // half resolution
  const cw = Math.max(2, Math.round(w * k));
  const ch = Math.max(2, Math.round(h * k));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(cw, ch);
  const px = img.data;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const { dx, dy } = field((i + 0.5) / k, (j + 0.5) / k);
      const o = (j * cw + i) * 4;
      px[o] = Math.round(128 + dx * 127);
      px[o + 1] = Math.round(128 + dy * 127);
      px[o + 2] = 128;
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Convex rim: content near the edge is pulled from deeper inside (magnified, bent), the centre stays still. */
function lensField(w: number, h: number, r: number, bezel: number): Field {
  return (x, y) => {
    const { d, nx, ny } = roundedRectField(x, y, w, h, r);
    const depth = -d;
    if (depth <= 0 || depth >= bezel) return { dx: 0, dy: 0 };
    const m = Math.pow(1 - depth / bezel, 2.2);
    return { dx: -nx * m, dy: -ny * m };
  };
}

interface FilterSpec {
  key: string;
  w: number;
  h: number;
  map: () => string;
  scale: number;
  blur: number;
  saturate: number;
}

const filters = new Map<string, { el: SVGFilterElement; used: number }>();

function ensureFilter(spec: FilterSpec): string {
  const id = `lg-${spec.key}`;
  const hit = filters.get(id);
  if (hit) {
    hit.used = performance.now();
    return id;
  }
  const f = document.createElementNS(SVG_NS, 'filter');
  f.setAttribute('id', id);
  f.setAttribute('x', '0');
  f.setAttribute('y', '0');
  f.setAttribute('width', String(spec.w));
  f.setAttribute('height', String(spec.h));
  f.setAttribute('filterUnits', 'userSpaceOnUse');
  f.setAttribute('primitiveUnits', 'userSpaceOnUse');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  f.innerHTML = `
    <feGaussianBlur in="SourceGraphic" stdDeviation="${spec.blur}" edgeMode="duplicate" result="soft"/>
    <feImage href="${spec.map()}" x="0" y="0" width="${spec.w}" height="${spec.h}" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="soft" in2="map" scale="${spec.scale}" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feColorMatrix in="bent" type="saturate" values="${spec.saturate}"/>`;
  filterDefs().appendChild(f);
  filters.set(id, { el: f, used: performance.now() });
  // Keep the 48 most recent filters (sizes change while the window is resized).
  if (filters.size > 48) {
    const oldest = [...filters.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, filters.size - 48);
    for (const [k, v] of oldest) {
      v.el.remove();
      filters.delete(k);
    }
  }
  return id;
}

export interface LiquidOptions {
  /** Depth of the refracting rim, px. */
  bezel?: number;
  /** Largest shift of the backdrop at the very edge, px. */
  strength?: number;
  /** Frost of the backdrop, px (SVG stdDeviation). */
  blur?: number;
  saturate?: number;
}

/**
 * Turns an element into liquid glass: measures it (border-radius read from CSS), builds its filter and sets
 * `backdrop-filter: url(#…)`. Returns a callback ref to put on the element (which should carry the `.liquid` class);
 * it works for elements mounted later (popovers, dialogs).
 */
export function useLiquidGlass<T extends HTMLElement>({ bezel = 18, strength = 14, blur = 1.6, saturate = 1.7 }: LiquidOptions = {}): (el: T | null) => void {
  const node = useRef<T | null>(null);
  const last = useRef<T | null>(null);
  const [version, setVersion] = useState(0);
  // Merged ref callbacks are new functions on every render: React detaches (null) then re-attaches the same element.
  // Only a different element re-runs the effect.
  const setRef = useCallback((el: T | null) => {
    node.current = el;
    if (el && el !== last.current) {
      last.current = el;
      setVersion((v) => v + 1);
    }
  }, []);
  useLayoutEffect(() => {
    const el = node.current;
    if (!el || !refractionSupported) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w < 8 || h < 8) return;
      const css = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const r = Math.min(css, w / 2, h / 2);
      const b = Math.min(bezel, Math.min(w, h) / 2);
      const id = ensureFilter({
        key: `${w}x${h}-r${Math.round(r)}-b${Math.round(b)}-s${strength}-f${blur}-c${saturate}`.replace(/\./g, '_'),
        w,
        h,
        map: () => drawMap(w, h, lensField(w, h, r, b)),
        scale: strength * 2,
        blur,
        saturate,
      });
      el.style.backdropFilter = `url(#${id})`;
      el.dataset.refract = '';
    };
    apply();
    const ro = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(apply);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [version, bezel, strength, blur, saturate]);
  return setRef;
}

/** A liquid-glass block. `strong` = more opaque tint, for text-heavy surfaces (dialogs, menus). */
export function Liquid({
  children,
  className,
  strong,
  glass,
  style,
  ref: outer,
  ...rest
}: { children?: ReactNode; className?: string; strong?: boolean; glass?: LiquidOptions; style?: CSSProperties; ref?: Ref<HTMLDivElement> } & HTMLAttributes<HTMLDivElement>) {
  const glassRef = useLiquidGlass<HTMLDivElement>(glass);
  return (
    <div
      ref={(el) => {
        glassRef(el);
        if (typeof outer === 'function') outer(el);
        else if (outer) outer.current = el;
      }}
      className={cn('liquid', strong && 'liquid-strong', className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The desktop bezel (Figma « Device » ring between the window edge and the screen): a thick glass ring over the
 * blurred wallpaper. Its map bends the wallpaper at the outer edge (inwards) and at the inner edge (outwards).
 */
export function useBezelGlass<T extends HTMLElement>({ inset, outerRadius, innerRadius, enabled }: { inset: number; outerRadius: number; innerRadius: number; enabled: boolean }): (el: T | null) => void {
  const node = useRef<T | null>(null);
  const last = useRef<T | null>(null);
  const [version, setVersion] = useState(0);
  // Merged ref callbacks are new functions on every render: React detaches (null) then re-attaches the same element.
  // Only a different element re-runs the effect.
  const setRef = useCallback((el: T | null) => {
    node.current = el;
    if (el && el !== last.current) {
      last.current = el;
      setVersion((v) => v + 1);
    }
  }, []);
  useLayoutEffect(() => {
    const el = node.current;
    if (!el || !refractionSupported || !enabled) {
      if (el) el.style.backdropFilter = '';
      return;
    }
    let timer = 0;
    const apply = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w < 100 || h < 100) return;
      const half = inset / 2;
      const field: Field = (x, y) => {
        const outer = roundedRectField(x, y, w, h, outerRadius);
        const inner = roundedRectField(x - inset, y - inset, w - inset * 2, h - inset * 2, innerRadius);
        const dOut = -outer.d; // depth from the outer edge
        const dIn = inner.d; // distance outside the screen
        if (dOut <= 0 || dIn <= 0) return { dx: 0, dy: 0 };
        if (dOut < dIn) {
          const m = Math.pow(Math.max(0, 1 - dOut / half), 2);
          return { dx: -outer.nx * m, dy: -outer.ny * m };
        }
        const m = Math.pow(Math.max(0, 1 - dIn / half), 2);
        return { dx: inner.nx * m, dy: inner.ny * m };
      };
      const id = ensureFilter({ key: `bezel-${w}x${h}`, w, h, map: () => drawMap(w, h, field), scale: 22, blur: 2, saturate: 1.5 });
      el.style.backdropFilter = `url(#${id})`;
    };
    apply();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [version, inset, outerRadius, innerRadius, enabled]);
  return setRef;
}

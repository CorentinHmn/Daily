/**
 * JS access to the Halo tokens. The values live ONLY in src/styles/tokens.css; this module reads them from the
 * computed styles (same approach as `map-style.ts` in the Halo Guide). Use it for Mapbox, deck.gl and Three.js.
 */

const cache = new Map<string, string>();

/** Raw value of a CSS custom property declared in tokens.css (e.g. `--color-map-water`). */
export function cssVar(name: `--${string}`): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) throw new Error(`Unknown design token ${name} (is src/styles/app.css loaded?)`);
  cache.set(name, value);
  return value;
}

/** Milliseconds from a duration token (`320ms` → 320). */
export function cssMs(name: `--${string}`): number {
  const v = cssVar(name);
  return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
}

/** Pixels from a length token (`18px` → 18). */
export function cssPx(name: `--${string}`): number {
  return parseFloat(cssVar(name));
}

/** Cubic-bezier control points from an easing token. */
export function cssBezier(name: `--${string}`): [number, number, number, number] {
  const m = cssVar(name).match(/cubic-bezier\(([^)]+)\)/);
  if (!m?.[1]) return [0, 0, 1, 1];
  const [a = 0, b = 0, c = 1, d = 1] = m[1].split(',').map(Number);
  return [a, b, c, d];
}

/**
 * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or `rgb(r g b / a)` → [r, g, b, a255] (deck.gl, Three.js).
 * The production CSS minifier rewrites `rgb(… / a)` as 8-digit hex and `#ffffff` as `#fff`: every form is accepted.
 */
export function toRgba(color: string, alpha?: number): [number, number, number, number] {
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
    const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, Math.round((alpha ?? a) * 255)];
  }
  const rgb = color.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)/);
  if (rgb) {
    const a = alpha ?? (rgb[4] !== undefined ? Number(rgb[4]) : 1);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Math.round(a * 255)];
  }
  throw new Error(`Unsupported color token value: ${color}`);
}

export function clearTokenCache(): void {
  cache.clear();
}

/**
 * The liquid bubble of the navigation (phone tab bar, desktop rail): a spring sampled once into keyframes (60 per
 * second), that Web Animations then plays on the compositor, so the bubble keeps moving while the new screen renders
 * on the main thread. Slightly underdamped (ζ ≈ 0.6): a small overshoot, then it settles.
 */
export const SPRING = (() => {
  const k = 380;
  const c = 24;
  const dt = 1 / 240;
  const out: { p: number; v: number }[] = [{ p: 0, v: 0 }];
  let p = 0;
  let v = 0;
  for (let i = 1; i < 240 * 1.5; i++) {
    v += (-k * (p - 1) - c * v) * dt;
    p += v * dt;
    if (i % 4 === 0) out.push({ p, v });
    if (Math.abs(p - 1) < 0.0015 && Math.abs(v) < 0.02 && i % 4 === 0) break;
  }
  out.push({ p: 1, v: 0 });
  return { frames: out, ms: ((out.length - 1) * 1000) / 60 };
})();

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** translateX / translateY in px of a running transform (0 when none). */
export const currentShift = (el: HTMLElement, axis: 'x' | 'y' = 'x') => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrixReadOnly(t);
  return axis === 'x' ? m.m41 : m.m42;
};

/**
 * Keyframes moving a bubble by `d` px along an axis back to its place: the faster it travels, the more it stretches
 * along and thins across (`size` = its new length along the axis, `from` = its old one).
 */
export function travel(d: number, axis: 'x' | 'y', from: number, size: number): Keyframe[] {
  return SPRING.frames.map(({ p, v }) => {
    const grow = (from + (size - from) * p) / size;
    const stretch = Math.min(0.15, Math.abs(d * v) / 6000);
    const along = grow * (1 + stretch);
    const across = 1 - stretch * 0.45;
    return axis === 'x' ? { transform: `translateX(${d * (1 - p)}px) scale(${along}, ${across})` } : { transform: `translateY(${d * (1 - p)}px) scale(${across}, ${along})` };
  });
}

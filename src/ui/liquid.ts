import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
/** How much a bubble moving `d` px stretches at spring speed `v` (0 at rest, 0.15 at most). */
export const stretchAt = (d: number, v: number) => Math.min(0.15, Math.abs(d * v) / 6000);

export function travel(d: number, axis: 'x' | 'y', from: number, size: number): Keyframe[] {
  return SPRING.frames.map(({ p, v }) => {
    const grow = (from + (size - from) * p) / size;
    const stretch = stretchAt(d, v);
    const along = grow * (1 + stretch);
    const across = 1 - stretch * 0.45;
    return axis === 'x' ? { transform: `translateX(${d * (1 - p)}px) scale(${along}, ${across})` } : { transform: `translateY(${d * (1 - p)}px) scale(${across}, ${along})` };
  });
}

/**
 * The liquid bubble under the active item of a bar (segmented controls, person filter): one absolutely placed element
 * that travels from item to item with the spring above. The bubble's parent must be positioned (`.liquid` is); put
 * `bubble` on the bubble and `item(key)` on each item; `count` = number of items (a bar that appears or changes
 * gets its bubble placed again).
 */
export function useLiquidBubble<K>(shown: K, count: number) {
  const bubble = useRef<HTMLSpanElement>(null);
  const items = useRef(new Map<K, HTMLElement>());
  const placed = useRef(false);

  const place = useCallback(() => {
    const b = bubble.current;
    const el = items.current.get(shown);
    if (!b || !el) return null;
    b.style.left = `${el.offsetLeft}px`;
    b.style.top = `${el.offsetTop}px`;
    b.style.width = `${el.offsetWidth}px`;
    b.style.height = `${el.offsetHeight}px`;
    return { left: el.offsetLeft, width: el.offsetWidth };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- count: the items changed, place again
  }, [shown, count]);

  useLayoutEffect(() => {
    const b = bubble.current;
    const parent = b?.parentElement;
    if (!b || !parent) return;
    // Where the bubble is seen now (mid-flight included), before moving it.
    const seen = b.getBoundingClientRect();
    const fromCenter = seen.left - parent.getBoundingClientRect().left + seen.width / 2;
    b.getAnimations().forEach((a) => a.cancel());
    const to = place();
    if (!to) return;
    const first = !placed.current;
    placed.current = true;
    if (first || !seen.width || reducedMotion()) return;
    const dx = fromCenter - (to.left + to.width / 2);
    if (Math.abs(dx) > 0.5) b.animate(travel(dx, 'x', seen.width, to.width), { duration: SPRING.ms, easing: 'linear' });
  }, [place]);

  // Resized (fonts loaded, window, label change): the bubble follows its item, without animation.
  useEffect(() => {
    const parent = bubble.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => place());
    ro.observe(parent);
    return () => ro.disconnect();
  }, [place]);

  const item = useCallback(
    (key: K) => (el: HTMLElement | null) => {
      if (el) items.current.set(key, el);
      else items.current.delete(key);
    },
    [],
  );
  return { bubble, item };
}

/**
 * The picked value shows at once, and `commit` runs two frames later: the bubble is already moving on the compositor
 * when the (possibly heavy) new content renders.
 */
export function useDeferredPick<T>(value: T, commit: (v: T) => void) {
  const [pending, setPending] = useState<{ v: T; from: T } | null>(null);
  const shown = pending && Object.is(pending.from, value) ? pending.v : value;
  const pick = (v: T) => {
    if (Object.is(v, value)) return commit(v);
    setPending({ v, from: value });
    requestAnimationFrame(() => requestAnimationFrame(() => commit(v)));
  };
  return { shown, pick };
}

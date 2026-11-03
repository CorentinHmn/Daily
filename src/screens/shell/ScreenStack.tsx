/**
 * The screens of the shell (computer and phone), kept alive like the tabs of an iOS app: each one is rendered once —
 * the ones not seen yet in the background, as soon as the app is idle (React's Activity) — and only hidden while
 * another is on view. A change of tab never has to build a screen any more while the old one has already gone: the
 * old one faded out, then the page stayed empty while the new one was built and painted (about 0.1 s on an iPhone,
 * more on a slower phone), then the new one faded in.
 * Now (phases in ScreenFrame): the old one starts leaving at once (`out`, 140 ms, on the compositor); meanwhile the new
 * one is shown invisible and held (`next`), the time to lay it out; it comes in (`on`) 100 ms after the old one
 * started leaving, as it is nearly gone — or as soon as it is ready, on a slow phone.
 * Phone: the new screen starts at the top of the page, the old one stays where it is seen as it leaves.
 */
import { Activity, createElement, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactElement } from 'react';
import { cn } from '../../ui/cn';
import { reducedMotion } from '../../ui/liquid';
import { cssMs } from '../../theme/tokens';
import { ScreenFrame, type ScreenPhase } from './ScreenFrame';
import { usePageScroll } from './scroll';

interface Stack<K> {
  /** On view, its entrance playing or done. */
  on: K | null;
  /** To come in: hidden one frame more (so the old one starts leaving first), then shown invisible (`ready`). */
  next: K | null;
  ready: boolean;
  /** Leaving. */
  out: K[];
}

export function ScreenStack<K extends string>({
  active,
  screens,
  className,
  frameClassName,
}: {
  active: K;
  screens: Record<K, ComponentType>;
  className?: string;
  frameClassName?: string;
}) {
  const { element: page } = usePageScroll();
  const keys = Object.keys(screens) as K[];
  // Made once: a change of phase renders the frames again, never the screens.
  const elements = useMemo(() => new Map<K, ReactElement>((Object.keys(screens) as K[]).map((k) => [k, createElement(screens[k])])), [screens]);
  const [stack, setStack] = useState<Stack<K>>({ on: null, next: active, ready: false, out: [] });
  // Another tab: the one on view starts leaving at once, the new one comes next (instead of a next one that never
  // came in; back to one still leaving: it comes in again).
  if (active !== (stack.next ?? stack.on)) {
    setStack((s) => ({ on: null, next: active, ready: false, out: [...s.out.filter((k) => k !== active), ...(s.on !== null && s.on !== active ? [s.on] : [])] }));
  }

  const frames = useRef(new Map<K, HTMLDivElement>());
  const register = useCallback((k: K, el: HTMLDivElement | null) => {
    if (el) frames.current.set(k, el);
    else frames.current.delete(k);
  }, []);
  // Phone: how far each screen on view is moved to stay where it was seen once the page went back to the top.
  const shifts = useRef(new Map<K, number>());
  const shift = useCallback((k: K, y: number) => {
    const el = frames.current.get(k);
    if (y) shifts.current.set(k, y);
    else shifts.current.delete(k);
    if (el) el.style.translate = y ? `0 ${y}px` : '';
  }, []);
  // When the old screen started leaving: the new one comes in 100 ms after, as it is nearly gone.
  const since = useRef(0);

  // A new screen to come: the old ones leave from where they are seen, the page goes back to the top for it; it is
  // shown (invisible) one frame later, once the old one's exit has started on the compositor.
  useLayoutEffect(() => {
    const next = stack.next;
    if (next === null) return;
    const top = page?.scrollTop ?? 0;
    if (page && top) {
      for (const k of stack.out) shift(k, (shifts.current.get(k) ?? 0) - top);
      page.scrollTo({ top: 0 });
    }
    since.current = stack.out.length ? performance.now() : 0;
    const id = requestAnimationFrame(() => setStack((s) => (s.next === next ? { ...s, ready: true } : s)));
    return () => cancelAnimationFrame(id);
    // Each time another screen is to come in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack.next]);

  // Shown invisible: laid out in the frame to come (the long one), then in.
  useLayoutEffect(() => {
    const next = stack.next;
    if (next === null || !stack.ready) return;
    shift(next, 0);
    const enter = () => setStack((s) => (s.next === next ? { on: next, next: null, ready: false, out: s.out } : s));
    let timer = 0;
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        const wait = since.current && !reducedMotion() ? cssMs('--v-duree-courte') * 0.7 - (performance.now() - since.current) : 0;
        if (wait > 0) timer = window.setTimeout(enter, wait);
        else enter();
      });
    });
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, [stack.next, stack.ready, shift]);

  const left = useCallback(
    (k: K) => {
      shift(k, 0);
      setStack((s) => ({ ...s, out: s.out.filter((x) => x !== k) }));
    },
    [shift],
  );

  const phase = (k: K): ScreenPhase => (k === stack.on ? 'on' : k === stack.next && stack.ready ? 'next' : stack.out.includes(k) ? 'out' : 'hidden');
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)]', className)}>
      {keys.map((k) => (
        <Activity key={k} mode={phase(k) === 'hidden' ? 'hidden' : 'visible'}>
          <ScreenFrame id={k} phase={phase(k)} onLeft={left} register={register} className={frameClassName}>
            {elements.get(k)}
          </ScreenFrame>
        </Activity>
      ))}
    </div>
  );
}

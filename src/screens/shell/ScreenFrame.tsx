/**
 * The frame of one screen in ScreenStack: its phase as data attributes, read by app.css.
 * - `next`: shown but invisible and held at the start of its entrance (`data-preparing`), the time it takes to lay it
 *   out, while the old screen stays on view.
 * - `on`: on view; its entrance plays: it slides into place as its pieces fade in, one card after the other.
 * - `out`: leaving (`data-leaving`): it slides up a little as its pieces fade out, then `onLeft` hides it.
 * Everything is a CSS animation of transform or opacity, played by the compositor. The fades are on each glass surface
 * and text of the frame, never on the frame itself: a frame with opacity < 1 would be a backdrop root, its glass clear
 * until the end.
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../ui/cn';
import { ScreenContext } from './screen';

export type ScreenPhase = 'next' | 'on' | 'out' | 'hidden';

export function ScreenFrame<K extends string>({
  id,
  phase,
  onLeft,
  register,
  className,
  children,
}: {
  id: K;
  phase: ScreenPhase;
  onLeft: (id: K) => void;
  register: (id: K, el: HTMLDivElement | null) => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      register(id, el);
    },
    [id, register],
  );

  // Leaving: hidden once its slide (as long as its pieces' fade) is over.
  useEffect(() => {
    if (phase !== 'out') return;
    const slide = ref.current?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'screen-out');
    if (!slide) return onLeft(id);
    let back = false;
    slide.finished.then(() => !back && onLeft(id), () => {});
    return () => {
      back = true;
    };
  }, [phase, id, onLeft]);

  return (
    <ScreenContext.Provider value={phase === 'on'}>
      <div
        ref={setRef}
        data-screen=""
        data-preparing={phase === 'next' ? '' : undefined}
        data-leaving={phase === 'out' ? '' : undefined}
        // Only the screen on view takes taps and focus (the old one is still fading out, the new one invisible).
        inert={phase !== 'on'}
        className={cn('[grid-area:1/1]', className)}
      >
        {children}
      </div>
    </ScreenContext.Provider>
  );
}

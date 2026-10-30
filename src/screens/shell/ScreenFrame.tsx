/**
 * The frame of a screen in the shell (computer and phone), inside AnimatePresence (mode « wait »): the old screen slides
 * up a little as its pieces fade out, then the new one slides into place as its pieces fade in, one card after the
 * other. Everything is a CSS animation of transform or opacity (app.css, « screen-in », « glass-in »…), played by the
 * compositor: a JS-driven slide (Motion's `y`) stuttered while the new screen was being rendered, above all on a phone.
 * The fades are on each glass surface and text of the frame, never on the frame itself: a frame with opacity < 1 would
 * be a backdrop root, its glass clear until the end.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePresence } from 'motion/react';
import { releaseEntrance } from '../../theme/motion';
import { usePageScroll } from './scroll';

export function ScreenFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [present, safeToRemove] = usePresence();
  const { element: page } = usePageScroll();
  const frame = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    releaseEntrance(el);
  }, []);

  // Phone: the page scrolls as a whole; the new screen starts at its top (the old one left where it was).
  useLayoutEffect(() => {
    page?.scrollTo({ top: 0 });
    // Once, as the screen arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving: removed once its slide (as long as its pieces' fade) is over.
  useEffect(() => {
    if (present) return;
    const slide = ref.current?.getAnimations().find((a) => (a as CSSAnimation).animationName === 'screen-out');
    if (!slide) return safeToRemove?.();
    let back = false;
    slide.finished.then(() => !back && safeToRemove?.(), () => {});
    return () => {
      back = true;
    };
  }, [present, safeToRemove]);

  return (
    <div ref={frame} data-screen="" data-entering="" data-leaving={present ? undefined : ''} className={className}>
      {children}
    </div>
  );
}

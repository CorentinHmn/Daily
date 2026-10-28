/**
 * Media queries as hooks. Mobile = below 1200 px (Halo Guide › Grille : « rail en barre basse » ; moved from 768 so
 * tablets get the one-column layout: the desktop one needs about 1200 px), the same limit as Tailwind's `md` (tokens.css › --breakpoint-md;
 * the CSS side uses `max-md:`).
 */
import { useSyncExternalStore } from 'react';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const MOBILE_QUERY = '(max-width: 1199.98px)';

export function useIsMobile(): boolean {
  return useMedia(MOBILE_QUERY);
}

/** Finger rather than mouse: no hover, bigger targets. */
export function useCoarsePointer(): boolean {
  return useMedia('(pointer: coarse)');
}

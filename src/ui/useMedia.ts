/**
 * Media queries as hooks. Mobile = below 768 px (Halo Guide › Grille : « < 768 : rail en barre basse »), the same
 * limit as Tailwind's `md` (the CSS side uses `max-md:`).
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

export const MOBILE_QUERY = '(max-width: 767.98px)';

export function useIsMobile(): boolean {
  return useMedia(MOBILE_QUERY);
}

/** Finger rather than mouse: no hover, bigger targets. */
export function useCoarsePointer(): boolean {
  return useMedia('(pointer: coarse)');
}

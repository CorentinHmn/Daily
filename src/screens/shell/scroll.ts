/** The scrolling page of the mobile shell: screens read whether it is scrolled (compact header) and scroll it. */
import { createContext, useContext } from 'react';

export interface PageScroll {
  /** The page has scrolled past the large title. */
  scrolled: boolean;
  /** The scrolling element (null on desktop, where panels scroll on their own). */
  element: HTMLElement | null;
}

export const PageScrollContext = createContext<PageScroll>({ scrolled: false, element: null });

export function usePageScroll(): PageScroll {
  return useContext(PageScrollContext);
}

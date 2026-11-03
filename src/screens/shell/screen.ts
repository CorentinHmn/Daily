/**
 * Whether the screen around is the one on view (ScreenStack keeps the others alive, hidden). What a screen puts in
 * <body> through a portal (the phone's compact title bar, the rest timer) only shows for the one on view.
 */
import { createContext, useContext } from 'react';

export const ScreenContext = createContext(true);

export function useScreenCurrent(): boolean {
  return useContext(ScreenContext);
}

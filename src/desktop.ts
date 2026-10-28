/** Desktop shell bridge (electron/preload.ts). Undefined in a normal browser. */
import { useSyncExternalStore } from 'react';

export type DesktopBridge = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => boolean;
  onMaximizedChange: (listener: (maximized: boolean) => void) => () => void;
  /** Saves a JSON export through the native save dialog. Resolves to the file path, or null when cancelled. */
  saveFile: (fileName: string, content: string) => Promise<string | null>;
};

export const desktop: DesktopBridge | undefined = (window as { desktop?: DesktopBridge }).desktop;

const noop = () => () => {};

export function useMaximized(): boolean {
  return useSyncExternalStore(desktop?.onMaximizedChange ?? noop, () => desktop?.isMaximized() ?? false);
}

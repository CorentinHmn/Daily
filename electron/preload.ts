/**
 * Preload (sandboxed): flags the document as running in the desktop shell and exposes the window controls and the
 * JSON export. The window is frameless and transparent so the page draws its own frame.
 */
import { contextBridge, ipcRenderer } from 'electron';

const listeners = new Set<(maximized: boolean) => void>();
let maximized = false;

// The preload runs before <html> exists: flag the document as soon as it does (before the app's scripts run).
function flagDocument(): void {
  const root = document.documentElement;
  root.dataset.shell = 'desktop';
  if (maximized) root.dataset.maximized = '';
  else delete root.dataset.maximized;
}
if (document.documentElement) flagDocument();
else window.addEventListener('DOMContentLoaded', flagDocument, { once: true });

ipcRenderer.on('window:state', (_event, state: { maximized: boolean }) => {
  maximized = state.maximized;
  if (document.documentElement) flagDocument();
  for (const l of listeners) l(maximized);
});

// Liquid-glass bezel: wallpaper and window position as CSS variables (see .app-frame in app.css).
let glass: string | null = null; // blob: URL of the wallpaper
let glassStamp: number | null = null;
let place: { x: number; y: number; width: number; height: number } | null = null;
function applyGlass(): void {
  const root = document.documentElement;
  if (!root) return;
  if (glass) {
    root.dataset.glass = '';
    root.style.setProperty('--wallpaper', `url("${glass}")`);
  } else {
    delete root.dataset.glass;
    root.style.removeProperty('--wallpaper');
  }
  if (place) {
    root.style.setProperty('--win-x', `${place.x}px`);
    root.style.setProperty('--win-y', `${place.y}px`);
    root.style.setProperty('--display-w', `${place.width}px`);
    root.style.setProperty('--display-h', `${place.height}px`);
  }
}
ipcRenderer.on('window:glass', (_event, state: { wallpaper: { mtime: number; bytes: Uint8Array; type: string } | null }) => {
  const w = state.wallpaper;
  if ((w?.mtime ?? null) === glassStamp) return;
  if (glass) URL.revokeObjectURL(glass);
  glass = w ? URL.createObjectURL(new Blob([new Uint8Array(w.bytes)], { type: w.type })) : null;
  glassStamp = w?.mtime ?? null;
  applyGlass();
});
ipcRenderer.on('window:place', (_event, state: { x: number; y: number; width: number; height: number }) => {
  place = state;
  applyGlass();
});

contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => maximized,
  onMaximizedChange: (listener: (maximized: boolean) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  saveFile: (fileName: string, content: string) => ipcRenderer.invoke('file:save', String(fileName), String(content)) as Promise<string | null>,
});

/**
 * Desktop shell (Electron). Loads the single-file app (dist/index.html, file://).
 * Window: frameless and transparent — the page draws the Figma « Device » frame itself (liquid-glass bezel over the
 * blurred wallpaper, rounded corners, blue light bar) and the rail's dots are the window controls
 * (close / minimize / maximize). Dev: DESKTOP_DEV_URL points to the Vite dev server (npm run desktop:dev).
 */
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, screen, session, shell } from 'electron';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEV_URL = process.env.DESKTOP_DEV_URL;
const INDEX = join(__dirname, '..', 'dist', 'index.html');
const PRELOAD = join(__dirname, 'preload.cjs');
const ICON = join(__dirname, '..', 'build', 'icon.ico');

/**
 * Liquid-glass bezel: like Windows 11 « Mica », the frame shows the user's desktop wallpaper, blurred, aligned under
 * the window (Windows' own acrylic keeps the window rectangle, square corners). Read once, and again when it changes.
 */
const WALLPAPER = join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
let wallpaper: { mtime: number; bytes: Uint8Array; type: string } | null = null;
function readWallpaper(): typeof wallpaper {
  try {
    const mtime = statSync(WALLPAPER).mtimeMs;
    if (wallpaper?.mtime !== mtime) {
      const data = readFileSync(WALLPAPER);
      wallpaper = { mtime, bytes: new Uint8Array(data), type: data[0] === 0x89 ? 'image/png' : 'image/jpeg' };
    }
    return wallpaper;
  } catch {
    return null; // solid-colour desktop: the bezel stays a plain translucent grey
  }
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 972,
    minWidth: 1280,
    minHeight: 800,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'Cadence',
    icon: ICON,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: PRELOAD, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());

  // Maximized / full screen → no bezel, square corners (the page reads data-maximized).
  const sendState = () => win.webContents.send('window:state', { maximized: win.isMaximized() || win.isFullScreen() });
  for (const e of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const) win.on(e as 'maximize', sendState);

  // Position of the window on its display: the page aligns the blurred wallpaper under the bezel.
  const sendPlace = () => {
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b).bounds;
    win.webContents.send('window:place', { x: b.x - d.x, y: b.y - d.y, width: d.width, height: d.height });
  };
  const sendGlass = () => win.webContents.send('window:glass', { wallpaper: readWallpaper() });
  for (const e of ['move', 'resize', 'maximize', 'unmaximize'] as const) win.on(e as 'move', sendPlace);
  win.on('focus', sendGlass);
  win.webContents.on('did-finish-load', () => {
    sendState();
    sendGlass();
    sendPlace();
  });

  // Links open in the default browser; the app never navigates away from itself.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file:');
    if (!allowed) event.preventDefault();
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(INDEX);
  return win;
}

ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('window:toggle-maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

// Data export (JSON) through the native save dialog.
ipcMain.handle('file:save', async (e, fileName: string, content: string) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: join(app.getPath('documents'), fileName), filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (canceled || !filePath) return null;
  writeFileSync(filePath, content, 'utf8');
  return filePath;
});

// One instance only: a second click on the icon brings the open window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let main: BrowserWindow | null = null;
  app.on('second-instance', () => {
    if (!main) return;
    if (main.isMinimized()) main.restore();
    main.focus();
  });
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'light'; // native dialogs follow the app's default Day theme
    if (process.platform === 'win32') app.setAppUserModelId('fr.corentin.cadence');
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    main = createMainWindow();
    main.on('closed', () => {
      main = null;
    });
  });
  app.on('window-all-closed', () => app.quit());
}

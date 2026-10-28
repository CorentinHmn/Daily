/**
 * Desktop tooling (Electron).
 *   tsx scripts/desktop.ts main     → bundles electron/main.ts + preload.ts → dist-electron/*.cjs
 *   tsx scripts/desktop.ts package  → Windows installer (NSIS) → release/
 *   tsx scripts/desktop.ts install  → runs the installer silently (shortcuts « Cadence » on the desktop and in
 *                                     the Start menu), then starts the app
 *   tsx scripts/desktop.ts dev      → Vite dev server + Electron window on it
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const APP_EXE = 'Cadence.exe';
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
const installer = join('release', `Cadence-Setup-${version}.exe`);
const installedExe = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Cadence', APP_EXE);

async function bundleMain(): Promise<void> {
  await build({
    entryPoints: { main: 'electron/main.ts', preload: 'electron/preload.ts' },
    outdir: 'dist-electron',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    logLevel: 'info',
  });
}

function appRunning(): boolean {
  return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${APP_EXE}`, '/NH'], { encoding: 'utf8' }).includes(APP_EXE);
}

/** The installer cannot replace a running app: it is closed first. */
function closeApp(): void {
  if (!appRunning()) return;
  execFileSync('taskkill', ['/IM', APP_EXE, '/F'], { stdio: 'ignore' });
  execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800']);
}

/**
 * electron-builder renames `win-unpacked.tmp` right after writing the executable; drive E: keeps a lock on the fresh
 * .exe (antivirus scan) and the rename fails with EPERM. Packaging in the system temp dir, then copying the installer
 * to release/, avoids it (same fix as the Tournoi poker project).
 */
async function packageWindows(): Promise<void> {
  const { build: builder } = await import('electron-builder');
  const out = join(tmpdir(), 'cadence-build');
  rmSync(out, { recursive: true, force: true });
  await builder({ win: ['nsis'], config: { directories: { output: out } } });
  mkdirSync('release', { recursive: true });
  for (const f of readdirSync(out)) if (/\.(exe|blockmap)$/.test(f)) cpSync(join(out, f), join('release', f));
  console.log(`Installateur : ${installer}`);
}

function install(): void {
  if (!existsSync(installer)) throw new Error(`Installateur introuvable : ${installer} (lancez npm run desktop:build)`);
  closeApp();
  // /S = silent; per-user install (no admin rights), shortcuts created by the installer.
  execFileSync(installer, ['/S'], { stdio: 'inherit' });
  if (!existsSync(installedExe)) throw new Error(`Installation introuvable : ${installedExe}`);
  spawn(installedExe, [], { detached: true, stdio: 'ignore' }).unref();
  console.log(`Installé : ${installedExe}`);
}

const command = process.argv[2];
if (command === 'main') {
  await bundleMain();
} else if (command === 'package') {
  await packageWindows();
} else if (command === 'install') {
  install();
} else if (command === 'dev') {
  await bundleMain();
  const { createServer } = await import('vite');
  const server = await createServer({ server: { port: 5321, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite dev server did not start');
  const electronBin = (await import('electron')).default as unknown as string;
  const child = spawn(electronBin, ['.'], { stdio: 'inherit', env: { ...process.env, DESKTOP_DEV_URL: url } });
  child.on('exit', async (code) => {
    await server.close();
    process.exit(code ?? 0);
  });
} else {
  console.error('usage: tsx scripts/desktop.ts <main|package|install|dev>');
  process.exit(1);
}

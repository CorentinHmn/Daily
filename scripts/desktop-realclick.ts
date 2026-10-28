/**
 * REAL mouse and keyboard test of the packaged app: Playwright's clicks go through the page and ignore Windows'
 * hit-testing of drag regions, so they cannot catch a window that refuses clicks. Here clicks and keystrokes are sent
 * by Windows itself (SendInput through PowerShell) at screen coordinates. Then the app is started again on the same
 * profile to check that what was typed was saved.
 * Run after `npm run desktop:build`, with nobody using the PC: npx tsx scripts/desktop-realclick.ts [--dev]
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dev = process.argv.includes('--dev');
const exe = join(tmpdir(), 'cadence-build', 'win-unpacked', 'Cadence.exe');
const profile = join(tmpdir(), 'cadence-realclick-profile');
rmSync(profile, { recursive: true, force: true });

// windowsHide: a visible PowerShell console would take the focus and receive the keystrokes.
const ps = (script: string) => execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true });
const USER32 = `Add-Type -Name U -Namespace W -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e); [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'; [W.U]::SetProcessDPIAware() | Out-Null;`;
const realClick = (x: number, y: number) => ps(`${USER32} [W.U]::SetCursorPos(${x},${y}); Start-Sleep -Milliseconds 120; [W.U]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 60; [W.U]::mouse_event(4,0,0,0,0)`);
/** Keystrokes through Windows, ONLY if the app is the window in front (never type into another window). */
const realType = (text: string) => {
  const out = ps(
    `Add-Type -AssemblyName System.Windows.Forms; Add-Type -Name G -Namespace W4 -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(System.IntPtr h, System.Text.StringBuilder s, int n);'; $sb = New-Object System.Text.StringBuilder 256; [W4.G]::GetWindowText([W4.G]::GetForegroundWindow(), $sb, 256) | Out-Null; if ($sb.ToString() -like '*Cadence*') { [System.Windows.Forms.SendKeys]::SendWait('${text}'); 'OK' } else { 'SKIP ' + $sb.ToString() }`,
  ).trim();
  if (out !== 'OK') throw new Error(`frappe annulée : la fenêtre au premier plan n’est pas l’app (${out})`);
};

async function launch(): Promise<{ app: ElectronApplication; win: Page }> {
  const app = dev ? await electron.launch({ args: ['.', `--user-data-dir=${profile}`] }) : await electron.launch({ executablePath: exe, args: [`--user-data-dir=${profile}`] });
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1500);
  return { app, win };
}

const { app, win } = await launch();
// Another window at the same place would catch the real clicks: stay on top.
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0]!;
  w.setAlwaysOnTop(true);
  w.focus();
});
process.on('uncaughtException', async (e) => {
  console.error(e);
  await win.screenshot({ path: join(tmpdir(), 'cadence-realclick-failure.png') }).catch(() => undefined);
  console.error(`Capture : ${join(tmpdir(), 'cadence-realclick-failure.png')}`);
  await app.close().catch(() => undefined);
  process.exit(1);
});

/** Screen (physical pixel) position of the centre of an element. */
const screenPoint = async (selector: string) => {
  const r = await win.locator(selector).first().boundingBox();
  if (!r) throw new Error(`introuvable : ${selector}`);
  return app.evaluate(({ BrowserWindow, screen }, p) => {
    const w = BrowserWindow.getAllWindows()[0]!;
    const c = w.getContentBounds();
    return screen.dipToScreenPoint({ x: Math.round(c.x + p.x), y: Math.round(c.y + p.y) });
  }, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
};
const realAt = async (selector: string, wait = 600) => {
  const pt = await screenPoint(selector);
  realClick(pt.x, pt.y);
  await win.waitForTimeout(wait);
};
const results: string[] = [];
const report = (line: string) => {
  console.log(line);
  results.push(line);
};
const title = async () => (await win.locator('h1').first().innerText()).trim();

// 0. A first real click on the dialog title brings the window to the front.
await realAt('[role="dialog"] h2', 400);
// 1. Welcome: « Commencer » (example data).
await realAt('[role="dialog"] button:has-text("Commencer")', 1200);
report(`bienvenue, bouton Commencer : ${(await win.locator('[role="dialog"]').count()) === 0 ? 'OK' : 'ÉCHEC'}`);
// 2. Rail buttons.
await realAt('nav [aria-label="Semaine"]', 900);
const t1 = await title();
await realAt('nav [aria-label="Courses"]', 900);
const t2 = await title();
await realAt(`nav [aria-label="Aujourd'hui"]`, 900);
const t3 = await title();
report(`boutons du rail (Semaine, Courses, Aujourd'hui) : ${t1 === 'Semaine' && t2 === 'Courses' && t3 === "Aujourd'hui" ? 'OK' : `ÉCHEC (${t1} / ${t2} / ${t3})`}`);
// 3. Type a task in the quick field + Entrée.
await realAt(`input[aria-label="Nouvelle tâche pour aujourd'hui"]`, 300);
realType('Aspirateur salon{ENTER}');
await win.waitForTimeout(700);
const added = await win.locator('main').getByText('Aspirateur salon', { exact: true }).count();
report(`saisie d'une tâche au clavier : ${added > 0 ? 'OK' : 'ÉCHEC'}`);
// 4. Tick it.
await realAt('[role="checkbox"][aria-label="Cocher « Aspirateur salon »"]', 600);
const ticked = await win.locator('[role="checkbox"][aria-label="Décocher « Aspirateur salon »"]').getAttribute('aria-checked');
report(`cocher la tâche : ${ticked === 'true' ? 'OK' : 'ÉCHEC'}`);
// 5. Quick add menu (+), closed with Échap.
await realAt('nav [aria-label="Ajouter"]', 600);
const menu = await win.locator('[role="menu"]').count();
realType('{ESC}');
await win.waitForTimeout(500);
report(`menu + (ajout rapide) : ${menu > 0 && (await win.locator('[role="menu"]').count()) === 0 ? 'OK' : 'ÉCHEC'}`);
// 6. Drag the window by the empty space of the header.
const handle = await screenPoint('main header > div.app-drag');
const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
ps(`${USER32} [W.U]::SetCursorPos(${handle.x},${handle.y}); Start-Sleep -Milliseconds 150; [W.U]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 150; for ($i = 1; $i -le 10; $i++) { [W.U]::SetCursorPos(${handle.x} + $i * 12, ${handle.y} + $i * 4); Start-Sleep -Milliseconds 30 }; Start-Sleep -Milliseconds 150; [W.U]::mouse_event(4,0,0,0,0)`);
await win.waitForTimeout(500);
const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
report(`déplacement par l'en-tête : ${after.x !== before.x || after.y !== before.y ? `OK (${before.x},${before.y} → ${after.x},${after.y})` : 'ÉCHEC'}`);
// 7. Green dot = maximize, then restore.
await realAt('[aria-label="Fenêtre"] [aria-label="Agrandir"]', 900);
const maximized = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized());
await realAt('[aria-label="Fenêtre"] [aria-label="Restaurer"]', 900);
const restored = !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized()));
report(`pastille verte (agrandir puis restaurer) : ${maximized && restored ? 'OK' : `ÉCHEC (${maximized}, ${restored})`}`);
// 8. Red dot = close.
const red = await screenPoint('[aria-label="Fenêtre"] [aria-label="Fermer"]');
const closed = app.waitForEvent('close', { timeout: 4000 }).then(
  () => true,
  () => false,
);
realClick(red.x, red.y);
report(`pastille rouge (fermer) : ${(await closed) ? 'OK' : 'ÉCHEC'}`);
await app.close().catch(() => undefined);

// 9. Saved: start again on the same profile.
const again = await launch();
const kept = await again.win.locator('main').getByText('Aspirateur salon', { exact: true }).count();
const keptTicked = await again.win.locator('[role="checkbox"][aria-label="Décocher « Aspirateur salon »"]').count();
report(`sauvegarde après fermeture (tâche + coche retrouvées) : ${kept > 0 && keptTicked > 0 ? 'OK' : `ÉCHEC (${kept}, ${keptTicked})`}`);
await again.app.close().catch(() => undefined);
rmSync(profile, { recursive: true, force: true });
console.log(results.some((r) => r.includes('ÉCHEC')) ? '\nAu moins un échec.' : '\nTout est OK.');

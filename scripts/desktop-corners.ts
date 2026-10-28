/**
 * Checks on the REAL screen that the corners of the window stay transparent (outside the rounded frame), with and
 * without a dialog (its scrim once covered the whole window rectangle), and after focus loss, minimize → restore,
 * maximize → restore. Reads the screen (CopyFromScreen), never moves the mouse; reference = the same pixels once the
 * window is closed. Run after `npm run desktop:build`: npx tsx scripts/desktop-corners.ts [--dev]
 */
import { _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Bounds = { x: number; y: number; width: number; height: number };

const dev = process.argv.includes('--dev');
const exe = join(tmpdir(), 'cadence-build', 'win-unpacked', 'Cadence.exe');
const profile = join(tmpdir(), 'cadence-corners-profile');
const outDir = process.env.CORNERS_DIR ?? tmpdir();
rmSync(profile, { recursive: true, force: true });

/** Screen colour at the 4 corners of the window rectangle, 3 and 6 px inside; the region is also saved to a PNG. */
function cornerPixels(file: string, b: Bounds, scale: number): number[][] {
  const x = Math.round(b.x * scale);
  const y = Math.round(b.y * scale);
  const w = Math.round(b.width * scale);
  const h = Math.round(b.height * scale);
  const pts: [number, number][] = [];
  for (const d of [3, 6]) pts.push([d, d], [d, h - 1 - d], [w - 1 - d, h - 1 - d], [w - 1 - d, d]);
  const read = pts.map(([px, py]) => `$c = $bmp.GetPixel(${px},${py}); "$($c.R) $($c.G) $($c.B)"`).join('; ');
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    `Add-Type -Name D -Namespace W7 -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'`,
    '[W7.D]::SetProcessDPIAware() | Out-Null',
    `$bmp = New-Object System.Drawing.Bitmap ${w},${h}`,
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    `$g.CopyFromScreen(${x}, ${y}, 0, 0, $bmp.Size)`,
    `$bmp.Save('${file}')`,
    read,
    '$g.Dispose(); $bmp.Dispose()',
  ].join('; ');
  return execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true })
    .trim()
    .split('\n')
    .map((l) => l.trim().split(' ').map(Number));
}

const app = dev ? await electron.launch({ args: ['.', `--user-data-dir=${profile}`] }) : await electron.launch({ executablePath: exe, args: [`--user-data-dir=${profile}`] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(1500);
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0]!;
  w.setAlwaysOnTop(true);
  w.setBounds({ x: 60, y: 40, width: 1440, height: 972 });
});
await win.waitForTimeout(600);

const state = () =>
  app.evaluate(({ BrowserWindow, screen }) => {
    const b = BrowserWindow.getAllWindows()[0]!.getBounds();
    return { b, scale: screen.getDisplayMatching(b).scaleFactor };
  });
const windowCall = (code: string) => app.evaluate(({ BrowserWindow }, c) => new Function('w', c)(BrowserWindow.getAllWindows()[0]!), code);

const shots: { label: string; px: number[][] }[] = [];
let last: { b: Bounds; scale: number } | null = null;
const step = async (label: string, wait = 1200) => {
  await win.waitForTimeout(wait);
  last = await state();
  shots.push({ label, px: cornerPixels(join(outDir, `corners-${shots.length + 1}.png`), last.b, last.scale) });
};

await step('au lancement, dialogue de bienvenue ouvert');
await windowCall('w.blur()');
await step('après perte du focus');
await windowCall('w.minimize(); setTimeout(() => w.restore(), 700)');
await step('après réduire puis restaurer', 2000);
await windowCall('w.maximize(); setTimeout(() => w.unmaximize(), 900)');
await step('après agrandir puis restaurer', 2200);
await win.getByRole('button', { name: 'Commencer' }).click();
await step('sans dialogue');
await win.keyboard.press('Control+n');
await step('dialogue « Nouvelle tâche » ouvert');
await app.close();
rmSync(profile, { recursive: true, force: true });

// Reference: the same pixels once the window is gone (what is behind it).
await new Promise((r) => setTimeout(r, 800));
const ref = cornerPixels(join(outDir, 'corners-reference.png'), last!.b, last!.scale);
const names = ['haut gauche', 'bas gauche', 'bas droite', 'haut droite'];
let failed = false;
for (const { label, px } of shots) {
  const bad = px.map((c, k) => (c.some((v, j) => Math.abs(v - ref[k]![j]!) > 16) ? `${names[k % 4]} ${c.join(',')} au lieu de ${ref[k]!.join(',')}` : null)).filter(Boolean);
  if (bad.length) failed = true;
  console.log(`${label} : ${bad.length ? `ÉCHEC (${bad.join(' ; ')})` : 'OK'}`);
}
console.log(failed ? 'Au moins un coin opaque.' : 'Coins transparents partout.');

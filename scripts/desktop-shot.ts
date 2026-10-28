/**
 * Captures the desktop window (Electron on dist/ + dist-electron/) with a fresh profile: frame, liquid-glass bezel
 * over the wallpaper, and the first screens. Playwright only reads the page here (no clicks through Windows).
 * Run after `npm run build && npx tsx scripts/desktop.ts main`: npx tsx scripts/desktop-shot.ts → docs/review/desktop-*.png
 */
import { _electron as electron } from '@playwright/test';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = join(tmpdir(), 'cadence-shot-profile');
rmSync(profile, { recursive: true, force: true });
const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(1500);
const state = await win.evaluate(() => {
  const root = document.documentElement;
  const bezel = document.querySelector('.app-bezel') as HTMLElement | null;
  return { shell: root.dataset.shell, glass: 'glass' in root.dataset, bezelFilter: bezel?.style.backdropFilter ?? null, rail: (document.querySelector('nav') as HTMLElement).style.backdropFilter };
});
console.log(JSON.stringify(state));
await win.screenshot({ path: 'docs/review/desktop-01-bienvenue.png' });
await win.getByRole('button', { name: 'Commencer' }).click();
await win.waitForTimeout(1600);
await win.screenshot({ path: 'docs/review/desktop-02-aujourdhui.png' });
await win.locator('nav [aria-label="Semaine"]').click();
await win.waitForTimeout(1300);
await win.screenshot({ path: 'docs/review/desktop-03-semaine.png' });
await app.close();
rmSync(profile, { recursive: true, force: true });

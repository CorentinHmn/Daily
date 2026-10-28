/**
 * Screenshots of every screen at the window size (1440 × 972 minus the bezel = 1411 × 943), for the visual review.
 * Run: npx tsx scripts/shoot.ts [url] [night]   (default url: the built dist/index.html) → docs/review/*.png
 * Starts with the example data (welcome dialog), then walks through the menus, views and main dialogs.
 */
import { chromium, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) ?? pathToFileURL(resolve('dist/index.html')).href;
const theme = args.includes('night') ? 'night' : 'day';
mkdirSync('docs/review', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1411, height: 943 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Commencer' }).click();
if (theme === 'night') {
  await page.getByRole('button', { name: /Corentin/ }).click();
  await page.getByRole('menuitem', { name: 'Passer en sombre' }).click();
}

async function shot(name: string, p: Page = page) {
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `docs/review/${theme}-${name}.png` });
  console.log(`docs/review/${theme}-${name}.png`);
}
const nav = (label: string) => page.locator(`nav [aria-label="${label}"]`).click();

await shot('01-aujourdhui');
await nav('Semaine');
await shot('02-semaine');
await page.getByRole('radio', { name: 'Semaine type' }).click();
await shot('03-semaine-type');
await nav('Sport');
await shot('04-salle');
await page.getByRole('button', { name: 'Démarrer la séance' }).click();
await page.getByRole('checkbox', { name: 'Valider la série 1' }).first().click();
await page.getByRole('checkbox', { name: 'Valider la série 2' }).first().click();
await shot('05-seance');
await page.getByRole('button', { name: 'Terminer' }).click();
await shot('06-fin-seance');
await page.getByRole('button', { name: 'Continuer la séance' }).click();
await page.getByRole('button', { name: 'Abandonner' }).click();
await page.getByRole('radio', { name: 'Running' }).click();
await shot('07-running');
await nav('Objectifs');
await shot('08-objectifs');
await nav('Courses');
await shot('09-courses');
await nav("Aujourd'hui");
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await shot('10-ajout-rapide');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Tâche' }).first().click();
await shot('11-dialogue-tache');
await page.keyboard.press('Escape');
await browser.close();
console.log(errors.length ? `Errors:\n${errors.join('\n')}` : 'No page error');

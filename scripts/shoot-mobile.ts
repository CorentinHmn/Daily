/**
 * Phone screenshots in Playwright's WebKit (the engine of Safari on iPhone: no SVG refraction there, frosted glass
 * only), iPhone 15 size (393 × 852, × 3, touch). Starts with the example data, then every menu and the main views.
 * Run: npx tsx scripts/shoot-mobile.ts [url] [night]   (default url: the built dist/index.html) → docs/review/mobile-*.png
 */
import { devices, webkit, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) ?? pathToFileURL(resolve('dist/index.html')).href;
const theme = args.includes('night') ? 'night' : 'day';
mkdirSync('docs/review', { recursive: true });
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 15'] });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
await shot('00-bienvenue');
await page.getByRole('button', { name: 'Commencer' }).tap();
if (theme === 'night') {
  await page.getByRole('button', { name: /, menu$/ }).tap();
  await page.getByRole('menuitem', { name: 'Passer en sombre' }).tap();
}

async function shot(name: string, p: Page = page, fullPage = false) {
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `docs/review/mobile-${theme}-${name}.png`, fullPage });
  console.log(`docs/review/mobile-${theme}-${name}.png`);
}
const tab = async (label: string) => {
  await page.locator(`nav [aria-label="${label}"]`).tap();
  await page.waitForTimeout(500);
};
const scroll = async (y: number) => {
  await page.locator('main').evaluate((el, top) => el.scrollTo({ top }), y);
  await page.waitForTimeout(500);
};

await shot('01-aujourdhui');
await scroll(700);
await shot('02-aujourdhui-bas');
await tab('Semaine');
await shot('03-semaine');
await scroll(900);
await shot('04-semaine-defile');
await tab('Sport');
await shot('05-salle');
await page.getByRole('button', { name: /Démarrer/ }).first().tap();
await page.getByRole('checkbox', { name: 'Valider la série 1' }).first().tap();
await shot('06-seance');
await page.getByRole('button', { name: 'Abandonner' }).tap();
await page.getByRole('radio', { name: 'Running' }).tap();
await shot('07-running');
await tab('Objectifs');
await shot('08-objectifs');
await tab('Courses');
await shot('09-courses');
await page.getByRole('button', { name: 'Ajouter', exact: true }).last().tap();
await shot('10-ajout-rapide');
await page.getByRole('menuitem', { name: 'Tâche' }).tap();
await shot('11-dialogue-tache');
await browser.close();
console.log(errors.length ? `Errors:\n${errors.join('\n')}` : 'No page error');

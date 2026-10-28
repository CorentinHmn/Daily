/**
 * Screenshots of the household features (two people, person filter, settings › Foyer, Compte et partage), desktop
 * (Edge) and phone (WebKit, iPhone 15). Run: npm run build && npx tsx scripts/shoot-household.ts → docs/review/foyer-*.png
 */
import { chromium, devices, webkit, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = process.argv[2] ?? pathToFileURL(resolve('dist/index.html')).href;

async function scenario(page: Page, tag: string, tap: boolean) {
  const click = (l: ReturnType<Page['locator']>) => (tap ? l.tap() : l.click());
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(600);
  await click(page.getByRole('button', { name: 'Commencer' }));
  await page.waitForTimeout(400);
  await click(page.getByRole('button', { name: tap ? /, menu$/ : /Corentin/ }).first());
  await click(page.getByRole('menuitem', { name: 'Paramètres' }));
  await page.getByLabel('Prénom de la personne à ajouter').fill('Léa');
  await click(page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/review/foyer-${tag}-parametres.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/review/foyer-${tag}-aujourdhui.png` });
  await click(page.getByRole('button', { name: tap ? /, menu$/ : /Corentin/ }).first());
  await click(page.getByRole('menuitem', { name: 'Compte et partage' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/review/foyer-${tag}-compte.png` });
  console.log(`docs/review/foyer-${tag}-*.png`);
}

const edge = await chromium.launch({ channel: 'msedge', headless: true });
await scenario(await edge.newPage({ viewport: { width: 1411, height: 943 } }), 'bureau', false);
await edge.close();
const wk = await webkit.launch();
await scenario(await (await wk.newContext({ ...devices['iPhone 15'] })).newPage(), 'iphone', true);
await wk.close();

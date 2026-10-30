/**
 * End-to-end test against the real Supabase project: two people, two browsers (PC and iPhone sizes).
 *  1. Alex creates an account, then the household (« Ma semaine »), and reads the invite code;
 *  2. Sam opens the invite link on a phone, creates an account, lands in the household;
 *  3. Alex adds a shopping item → Sam sees it live; Sam ticks it → Alex is told « Sam a coché … »;
 *  4. reload keeps Sam signed in; Alex signs out, then back in, and finds the household.
 * Run: npm run build && npx vite preview --port 4320 &  then  npx tsx scripts/e2e.ts [base-url]
 * The test accounts (cadence-e2e-…@example.com) are left in the project: delete them afterwards (see the end).
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { exampleData } from '../src/domain/seed';

const base = process.argv[2] ?? 'http://localhost:4320';
const stamp = Date.now().toString(36);
const password = `Test-${stamp}-pw`;
const alex = { name: 'Alex', email: `cadence-e2e-${stamp}-a@example.com` };
const sam = { name: 'Sam', email: `cadence-e2e-${stamp}-b@example.com` };
const lou = { name: 'Lou', email: `cadence-e2e-${stamp}-c@example.com` };
const max = { name: 'Max', email: `cadence-e2e-${stamp}-d@example.com` };
const item = `Lait e2e ${stamp}`;

const errors: string[] = [];
const results: string[] = [];
let failed = false;

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push(`✔ ${label}`);
  } catch (e) {
    failed = true;
    results.push(`✘ ${label}\n    ${String(e).split('\n')[0]}`);
    throw e;
  }
}

function watch(page: Page, who: string) {
  page.on('pageerror', (e) => errors.push(`${who}: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${who}: ${m.text()}`);
  });
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  }
}

async function createAccount(page: Page, who: { name: string; email: string }) {
  await page.getByRole('radio', { name: 'Créer un compte' }).click();
  await page.getByLabel('Prénom').fill(who.name);
  await page.getByLabel('Adresse e-mail').fill(who.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

/** Aujourd'hui's title: a greeting with the person's name (« Bonjour, Alex »; the household setup says « Bonjour Alex »). */
const TODAY = /^Bon(jour|soir), /;

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: new RegExp(`^${name}`) });

async function openShopping(page: Page) {
  await nav(page, 'Courses').click();
  await page.getByRole('heading', { name: 'Courses' }).waitFor();
}

const browser = await launch();
const pc = await browser.newContext({ viewport: { width: 1411, height: 943 }, locale: 'fr-FR' });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const a = await pc.newPage();
const b = await phone.newPage();
watch(a, 'Alex');
watch(b, 'Sam');
let code = '';

try {
  await step("Alex : l'appli s'ouvre sur la connexion", async () => {
    await a.goto(base);
    await a.getByRole('button', { name: 'Se connecter' }).waitFor();
  });

  await step('Alex : création de compte', async () => {
    await createAccount(a, alex);
    await a.getByRole('heading', { name: `Bonjour ${alex.name}` }).waitFor({ timeout: 20_000 });
  });

  await step('Alex : création du foyer « Ma semaine »', async () => {
    await a.getByRole('button', { name: 'Créer le foyer' }).click();
    await a.getByRole('heading', { name: TODAY }).waitFor({ timeout: 20_000 });
  });

  await step("Alex : code d'invitation dans Foyer et compte", async () => {
    await a.getByRole('button', { name: new RegExp(alex.name) }).first().click();
    await a.getByRole('menuitem', { name: 'Foyer et compte' }).click();
    const dialog = a.getByRole('dialog', { name: 'Foyer et compte' });
    await dialog.waitFor();
    code = (await dialog.locator('.tnum').first().innerText()).replace(/\W/g, '');
    if (code.length !== 8) throw new Error(`code lu : « ${code} »`);
    await dialog.getByText('À jour').waitFor({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await dialog.waitFor({ state: 'detached' });
  });

  await step("Sam : le lien d'invitation ouvre la création de compte", async () => {
    await b.goto(`${base}/?invite=${code}`);
    await b.getByText('Tu es invité·e à rejoindre un foyer').waitFor();
    if (b.url().includes('invite=')) throw new Error("le code est resté dans l'adresse");
  });

  await step('Sam : compte créé, code déjà rempli, foyer rejoint', async () => {
    await createAccount(b, sam);
    await b.getByRole('heading', { name: `Bonjour ${sam.name}` }).waitFor({ timeout: 20_000 });
    const filled = (await b.getByLabel('Code du foyer').inputValue()).replace(/\W/g, '');
    if (filled !== code) throw new Error(`code prérempli : « ${filled} »`);
    await b.getByRole('button', { name: 'Rejoindre le foyer' }).click();
    await b.getByRole('heading', { name: TODAY }).waitFor({ timeout: 20_000 });
  });

  await step('Sam : la semaine type du foyer est là', async () => {
    await nav(b, 'Semaine').click();
    await b.getByRole('heading', { name: 'Semaine' }).waitFor();
    await b.getByText('Batch cooking').first().waitFor({ timeout: 10_000 });
  });

  await step('Alex ajoute un article → Sam le voit en direct', async () => {
    await openShopping(a);
    await openShopping(b);
    await a.getByLabel('Ajouter un article').fill(item);
    await a.getByLabel('Ajouter un article').press('Enter');
    await b.getByText(item).first().waitFor({ timeout: 15_000 });
  });

  await step('Sam coche → Alex est prévenu', async () => {
    await b.getByRole('checkbox', { name: `Cocher ${item}` }).click();
    await a.getByText(`${sam.name} a coché « ${item} »`).waitFor({ timeout: 15_000 });
    await a.getByRole('checkbox', { name: `Remettre ${item}` }).waitFor({ timeout: 5_000 });
  });

  await step('Sam : après rechargement, toujours connectée avec les données', async () => {
    await b.reload();
    await b.getByRole('heading', { name: 'Courses' }).or(b.getByRole('heading', { name: TODAY })).first().waitFor({ timeout: 15_000 });
    await openShopping(b);
    await b.getByText(item).first().waitFor({ timeout: 10_000 });
  });

  await step("Alex : supprimer une tâche depuis son menu n'ouvre aucune fenêtre", async () => {
    await nav(a, "Aujourd'hui").click();
    await a.getByRole('heading', { name: TODAY }).waitFor();
    const actions = a.getByRole('button', { name: /^Actions de « / }).first();
    const title = (await actions.getAttribute('aria-label'))!.replace(/^Actions de « (.*) »$/, '$1');
    await actions.click();
    await a.getByRole('menuitem', { name: 'Supprimer' }).click();
    await a.getByText(`« ${title} » supprimée`).waitFor({ timeout: 5_000 });
    await a.waitForTimeout(600);
    if (await a.getByRole('dialog').count()) throw new Error(`une fenêtre s'est ouverte : ${await a.getByRole('dialog').first().getAttribute('aria-label')}`);
  });

  await step('Alex : déconnexion puis reconnexion, le foyer revient', async () => {
    await a.getByRole('button', { name: new RegExp(alex.name) }).first().click();
    await a.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await a.getByRole('button', { name: 'Se connecter' }).waitFor({ timeout: 10_000 });
    const left = await a.evaluate(() => localStorage.getItem('cadence.data.v1') ?? '');
    if (left.includes('e2e')) throw new Error("les données sont restées sur l'appareil");
    await a.getByLabel('Adresse e-mail').fill(alex.email);
    await a.getByLabel('Mot de passe', { exact: true }).fill(password);
    await a.getByRole('button', { name: 'Se connecter' }).click();
    await a.getByRole('heading', { name: TODAY }).waitFor({ timeout: 20_000 });
    await openShopping(a);
    await a.getByText(item).first().waitFor({ timeout: 10_000 });
  });

  await step("Données saisies dans l'ancienne version : proposées à la création du foyer", async () => {
    // As the first version left it on the device: its data saved before the page starts.
    const ctx = await browser.newContext({ viewport: { width: 1411, height: 943 } });
    await ctx.addInitScript((json) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('cadence.data.v1', json);
    }, JSON.stringify(exampleData('Lou')));
    const c = await ctx.newPage();
    watch(c, 'Lou');
    await c.goto(base);
    await createAccount(c, lou);
    await c.getByRole('heading', { name: `Bonjour ${lou.name}` }).waitFor({ timeout: 20_000 });
    const device = c.getByRole('radio', { name: /Cet appareil/ });
    if ((await device.getAttribute('aria-checked')) !== 'true') throw new Error('« Cet appareil » non proposé par défaut');
    await c.getByRole('button', { name: 'Créer le foyer' }).click();
    await c.getByRole('heading', { name: TODAY }).waitFor({ timeout: 20_000 });
    await openShopping(c);
    await c.getByText('Épinards frais').first().waitFor({ timeout: 10_000 });
    // The copy set aside goes once the household holds the data (after the first upload).
    await c.waitForFunction(() => !localStorage.getItem('cadence.legacy'), null, { timeout: 30_000 });
  });

  await step('Foyer « Vide » : aucune tâche, aucun programme, aucune liste', async () => {
    const d = await (await browser.newContext({ viewport: { width: 1411, height: 943 } })).newPage();
    watch(d, 'Max');
    await d.goto(base);
    await createAccount(d, max);
    await d.getByRole('heading', { name: `Bonjour ${max.name}` }).waitFor({ timeout: 20_000 });
    await d.getByRole('radio', { name: /^Vide/ }).click();
    await d.getByRole('button', { name: 'Créer le foyer' }).click();
    await d.getByRole('heading', { name: TODAY }).waitFor({ timeout: 20_000 });
    await d.getByText("Rien de prévu aujourd'hui").waitFor({ timeout: 5_000 });
    if (process.env.SHOTS) await d.screenshot({ path: `${process.env.SHOTS}/vide-aujourdhui.png` });
    await nav(d, 'Sport').click();
    await d.getByText('Aucun programme').first().waitFor({ timeout: 5_000 });
    await openShopping(d);
    await d.getByText('Aucune liste').first().waitFor({ timeout: 5_000 });
    if (process.env.SHOTS) await d.screenshot({ path: `${process.env.SHOTS}/vide-courses.png` });
  });

  await step('Mauvais mot de passe : message en français', async () => {
    const c = await (await browser.newContext()).newPage();
    await c.goto(base);
    await c.getByLabel('Adresse e-mail').fill(alex.email);
    await c.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
    await c.getByRole('button', { name: 'Se connecter' }).click();
    await c.getByText('E-mail ou mot de passe incorrect.').waitFor({ timeout: 10_000 });
  });
} catch {
  // reported below
} finally {
  if (process.env.SHOTS) {
    await a.screenshot({ path: `${process.env.SHOTS}/e2e-pc.png` }).catch(() => undefined);
    await b.screenshot({ path: `${process.env.SHOTS}/e2e-phone.png` }).catch(() => undefined);
  }
  await browser.close();
}

console.log(results.join('\n'));
const real = errors.filter((e) => !/Failed to load resource.*(400|401|409)/.test(e));
if (real.length) console.log(`\nErreurs de console :\n${real.join('\n')}`);
console.log(`\nComptes de test : ${alex.email}, ${sam.email}, ${lou.email}, ${max.email}`);
console.log(`À supprimer : delete from public.households h using public.household_members m join auth.users u on u.id = m.user_id where m.household_id = h.id and u.email like 'cadence-e2e-%@example.com'; delete from auth.users where email like 'cadence-e2e-%@example.com';`);
process.exit(failed || real.length ? 1 : 0);

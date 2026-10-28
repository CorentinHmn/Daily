/**
 * Visual review: screenshots of every screen, view and dialog on several screen sizes (light and dark), plus automatic
 * checks — page wider than the screen, text cut without « … », small touch targets on phones, console errors.
 * Uses a throwaway account (cadence-e2e-shoot-…@example.com, household « Un exemple »): delete it afterwards (same
 * request as scripts/e2e.ts).
 * Run: npm run build && npx vite preview --port 4320 &  then  npx tsx scripts/shoot.ts [base-url] [out-dir] [only]
 * `only` = comma-separated size names (pc-xl,pc,laptop,laptop-s,tablet-l,tablet,phone,phone-s,dark,dialogs,auth).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4320';
const out = process.argv[3] ?? 'test-results/shots';
const only = process.argv[4]?.split(',');
const want = (k: string) => !only || only.includes(k);
mkdirSync(out, { recursive: true });

const stamp = Date.now().toString(36);
const account = { name: 'Corentin', email: `cadence-e2e-shoot-${stamp}@example.com`, password: `Shoot-${stamp}-pw` };

type Size = { name: string; width: number; height: number; phone?: boolean };
const SIZES: Size[] = [
  { name: 'pc-xl', width: 1920, height: 1080 },
  { name: 'pc', width: 1440, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'laptop-s', width: 1280, height: 720 },
  { name: 'tablet-l', width: 1180, height: 820 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844, phone: true },
  { name: 'phone-s', width: 375, height: 667, phone: true },
];

const report: string[] = [];
const errors: string[] = [];

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  }
}

async function contextFor(b: Browser, s: Size, storageState?: Awaited<ReturnType<BrowserContext['storageState']>>) {
  const c = await b.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.phone ? 2 : 1, isMobile: !!s.phone, hasTouch: !!s.phone, locale: 'fr-FR', storageState });
  // tsx keeps function names with a __name() helper, also inside page.evaluate callbacks.
  await c.addInitScript({ content: 'window.__name = (f) => f;' });
  return c;
}

function watch(page: Page, who: string) {
  page.on('pageerror', (e) => errors.push(`${who}: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${who}: ${m.text()}`);
  });
}

/** Layout checks in the page: wider than the screen, text cut without ellipsis, truncated text, small touch targets. */
async function check(page: Page, label: string, phone: boolean) {
  const r = await page.evaluate((phone) => {
    const vw = window.innerWidth;
    const out: string[] = [];
    const name = (el: Element) => {
      const t = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).trim().replace(/\s+/g, ' ');
      return t.slice(0, 50);
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };
    if (document.documentElement.scrollWidth > vw + 1) out.push(`PAGE plus large que l'écran (${document.documentElement.scrollWidth} > ${vw})`);
    const all = [...document.querySelectorAll('body *')].filter(visible);
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1 && !inScroller(el) && el.children.length === 0) out.push(`DÉBORDE à droite : « ${name(el)} » (${Math.round(rect.right)} > ${vw})`);
    }
    for (const el of all) {
      const he = el as HTMLElement;
      if (!he.innerText || el.children.length > 0) continue;
      const st = getComputedStyle(el);
      if (he.scrollWidth > he.clientWidth + 1 && (st.overflowX === 'hidden' || st.overflowX === 'clip')) {
        out.push(`${st.textOverflow === 'ellipsis' ? 'TRONQUÉ (…)' : 'COUPÉ sans …'} : « ${name(el)} »`);
      }
    }
    if (phone) {
      const targets = [...document.querySelectorAll('button, a[href], [role="checkbox"], [role="radio"], input, select, textarea')].filter(visible);
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.width < 32 || r.height < 32) out.push(`CIBLE PETITE ${Math.round(r.width)}×${Math.round(r.height)} : « ${name(el)} »`);
      }
    }
    return [...new Set(out)];
  }, phone);
  if (r.length) report.push(`\n## ${label}\n${r.map((x) => `- ${x}`).join('\n')}`);
}

async function shot(page: Page, file: string, label: string, phone: boolean) {
  await page.waitForTimeout(450);
  await check(page, label, phone);
  if (!phone) {
    await page.screenshot({ path: `${out}/${file}.png` });
    return;
  }
  // The phone page scrolls inside <main>: one picture per screen height (3 at most).
  const main = page.locator('main').first();
  const total = (await main.count()) ? await main.evaluate((m) => m.scrollHeight - m.clientHeight) : 0;
  const step = (page.viewportSize()?.height ?? 800) - 160;
  for (let i = 0, y = 0; i < 3; i++, y += step) {
    if (total > 0) await main.evaluate((m, y) => m.scrollTo({ top: y }), Math.min(y, total));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${file}${i ? `-${i + 1}` : ''}.png` });
    if (y >= total) break;
  }
  if (total > 0) await main.evaluate((m) => m.scrollTo({ top: 0 }));
}

const HEADING: Record<string, string> = { "Aujourd'hui": "Aujourd'hui", Semaine: 'Semaine', Sport: 'Sport', Objectifs: 'Objectifs', Courses: 'Courses' };
/** A menu of the rail / tab bar, once the previous screen has left (its header, chip included, fades out). */
const nav = (page: Page, name: string) => ({
  click: async () => {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('heading', { name: HEADING[name], exact: true }).waitFor();
    await page.waitForTimeout(400);
  },
});
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

async function screens(page: Page, s: Size, prefix: string) {
  const p = !!s.phone;
  await nav(page, "Aujourd'hui").click();
  await shot(page, `${prefix}-01-aujourdhui`, `${prefix} Aujourd'hui`, p);
  await nav(page, 'Semaine').click();
  await radio(page, 'Agenda').click();
  await shot(page, `${prefix}-02-semaine`, `${prefix} Semaine › Agenda`, p);
  await radio(page, 'Semaine type').click();
  await shot(page, `${prefix}-03-semaine-type`, `${prefix} Semaine › Semaine type`, p);
  await radio(page, 'Agenda').click();
  await nav(page, 'Sport').click();
  await radio(page, 'Salle').click();
  await shot(page, `${prefix}-04-salle`, `${prefix} Sport › Salle`, p);
  await radio(page, 'Running').click();
  await shot(page, `${prefix}-05-running`, `${prefix} Sport › Running`, p);
  await radio(page, 'Salle').click();
  await nav(page, 'Objectifs').click();
  for (const [i, period] of (['Semaine', 'Mois', 'Année'] as const).entries()) {
    await radio(page, period).click();
    await shot(page, `${prefix}-0${6 + i}-objectifs-${period.toLowerCase()}`, `${prefix} Objectifs › ${period}`, p);
  }
  await radio(page, 'Semaine').click();
  await nav(page, 'Courses').click();
  await shot(page, `${prefix}-09-courses`, `${prefix} Courses`, p);
  await nav(page, "Aujourd'hui").click();
}

async function userMenu(page: Page, item: string) {
  await page.getByRole('button', { name: /Corentin/ }).first().click();
  await page.getByRole('menuitem', { name: item }).click();
}

async function closeDialog(page: Page) {
  const d = page.getByRole('dialog').last();
  const close = d.getByRole('button', { name: /^(Fermer|Annuler)$/ }).first();
  if (await close.count()) await close.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
}

async function dialogs(page: Page, s: Size) {
  const p = !!s.phone;
  const pre = `${s.name}-dialog`;
  // Ctrl K = the + button (rail on a computer, next to the tab bar on a phone).
  const quick = async (item: string) => {
    await page.keyboard.press('Control+k');
    await page.getByRole('menuitem', { name: item }).click();
  };
  await page.keyboard.press('Control+k');
  await shot(page, `${pre}-00-ajout-rapide`, `${pre} Ajout rapide`, p);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  for (const [i, item] of (['Tâche', 'Routine de la semaine type', 'Article de courses', 'Sortie running', 'Objectif'] as const).entries()) {
    await quick(item);
    await shot(page, `${pre}-0${i + 1}-${item.split(' ')[0]!.toLowerCase()}`, `${pre} ${item}`, p);
    await closeDialog(page);
  }
  // An existing task (edit), an existing routine.
  await page.getByRole('button', { name: /^Actions de « / }).first().click();
  await page.getByRole('menuitem', { name: 'Modifier' }).click();
  await shot(page, `${pre}-06-modifier-tache`, `${pre} Modifier une tâche`, p);
  await closeDialog(page);
  await userMenu(page, 'Paramètres');
  await shot(page, `${pre}-07-parametres`, `${pre} Paramètres`, p);
  await closeDialog(page);
  await userMenu(page, 'Foyer et compte');
  await shot(page, `${pre}-08-foyer`, `${pre} Foyer et compte`, p);
  await closeDialog(page);
  // Habit (Objectifs), programme (Salle).
  await nav(page, 'Objectifs').click();
  const habit = page.getByRole('button', { name: 'Nouvelle habitude' }).first();
  if (await habit.count()) {
    await habit.click();
    await shot(page, `${pre}-09-habitude`, `${pre} Habitude`, p);
    await closeDialog(page);
  } else report.push(`\n## ${pre}\n- (bouton d'ajout d'habitude introuvable par son nom)`);
  await nav(page, 'Sport').click();
  // Live session: start, tick a set (rest timer), finish dialog, then abandon.
  await page.getByRole('button', { name: /^Démarrer/ }).first().click();
  await page.waitForTimeout(400);
  await shot(page, `${pre}-10-seance`, `${pre} Séance en direct`, p);
  const set = page.getByRole('checkbox').first();
  if (await set.count()) {
    await set.click();
    await shot(page, `${pre}-11-repos`, `${pre} Minuteur de repos`, p);
  }
  const finish = page.getByRole('button', { name: /^Terminer/ }).first();
  if (await finish.count()) {
    await finish.click();
    await shot(page, `${pre}-12-fin-seance`, `${pre} Fin de séance`, p);
    await closeDialog(page);
  }
  const abandon = page.getByRole('button', { name: /Abandonner/ }).first();
  if (await abandon.count()) {
    await abandon.click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Abandonner/ });
    if (await confirm.count()) await confirm.click();
  }
  await nav(page, "Aujourd'hui").click();
}

const browser = await launch();
try {
  // ── Account, household setup and sign-in screens (one context, resized).
  const ctx = await contextFor(browser, SIZES[1]!);
  const page = await ctx.newPage();
  watch(page, 'setup');
  await page.goto(base);
  await page.getByRole('button', { name: 'Se connecter' }).waitFor();
  if (want('auth')) {
    for (const s of SIZES) {
      await page.setViewportSize({ width: s.width, height: s.height });
      await shot(page, `${s.name}-auth-1-connexion`, `${s.name} Connexion`, !!s.phone);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await radio(page, 'Créer un compte').click();
    await shot(page, `phone-s-auth-2-creer`, 'phone-s Créer un compte', true);
    await radio(page, 'Connexion').click();
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await shot(page, `phone-s-auth-3-oubli`, 'phone-s Mot de passe oublié', true);
    await page.getByRole('button', { name: 'Retour à la connexion' }).first().click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await radio(page, 'Créer un compte').click();
  await page.getByLabel('Prénom').fill(account.name);
  await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.getByRole('heading', { name: `Bonjour ${account.name}` }).waitFor({ timeout: 20_000 });
  if (want('auth')) {
    for (const s of SIZES) {
      await page.setViewportSize({ width: s.width, height: s.height });
      await shot(page, `${s.name}-auth-4-foyer`, `${s.name} Création du foyer`, !!s.phone);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole('radio', { name: /^Un exemple/ }).click();
  await page.getByRole('button', { name: 'Créer le foyer' }).click();
  await page.getByRole('heading', { name: "Aujourd'hui" }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3000); // first upload
  const state = await ctx.storageState();
  await ctx.close();

  for (const s of SIZES.filter((x) => want(x.name))) {
    const c = await contextFor(browser, s, state);
    const p = await c.newPage();
    watch(p, s.name);
    await p.goto(base);
    await p.getByRole('heading', { name: "Aujourd'hui" }).waitFor({ timeout: 20_000 });
    await screens(p, s, `${s.name}-day`);
    if (want('dialogs') && (s.name === 'pc' || s.name === 'phone' || s.name === 'laptop')) await dialogs(p, s);
    if (want('dark') && (s.name === 'pc' || s.name === 'phone')) {
      await userMenu(p, 'Passer en sombre');
      await screens(p, s, `${s.name}-night`);
      await userMenu(p, 'Passer en clair');
    }
    await c.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${out}/report.md`, `# Contrôles automatiques\n${report.join('\n')}\n\n# Erreurs de console\n${errors.join('\n') || '(aucune)'}\n`);
console.log(`Captures et rapport : ${out}/ (report.md)\nCompte de test : ${account.email}`);

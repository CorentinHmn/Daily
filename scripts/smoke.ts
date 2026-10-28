/**
 * Functional smoke test of the built app (dist/index.html) in Edge: the links between screens and the main forms.
 * Run: npm run build && npx tsx scripts/smoke.ts
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1411, height: 943 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(resolve('dist/index.html')).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole('radio', { name: /Partir de ma semaine/ }).click();
await page.getByRole('button', { name: 'Commencer' }).click();

const results: string[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  const line = `${label} : ${ok ? 'OK' : `ÉCHEC ${detail}`}`;
  console.log(line);
  results.push(line);
};
const nav = async (label: string) => {
  await page.locator(`nav [aria-label="${label}"]`).click();
  await page.waitForTimeout(600);
};
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('cadence.data.v1') ?? '{}'));
const today = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// Agenda: a sport task today linked to Push, then a session finished → the task is ticked.
await page.waitForTimeout(600);
await page.keyboard.press('Control+n');
await page.locator('#task-title').fill('Séance Push du jour');
await page.getByRole('radio', { name: 'Salle de sport' }).click();
await page.locator('#task-program').click();
await page.getByRole('option', { name: 'Push' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.waitForTimeout(400);
check('tâche créée au clavier (Ctrl N)', (await page.locator('main').getByText('Séance Push du jour').count()) > 0);
await nav('Sport');
await page.locator('main').getByRole('button', { name: /^Push/ }).click();
await page.getByRole('button', { name: 'Démarrer la séance' }).click();
await page.getByRole('checkbox', { name: 'Valider la série 1' }).first().click();
check('minuteur de repos lancé', (await page.getByRole('timer').count()) > 0);
await page.getByRole('button', { name: 'Terminer' }).click();
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.waitForTimeout(600);
let d = await data();
check('séance enregistrée', d.sessions.length === 1 && d.active === null);
check('fin de séance → tâche de salle cochée', d.tasks.some((t: { title: string; done: boolean }) => t.title === 'Séance Push du jour' && t.done));

// Running: log a run today.
await page.getByRole('radio', { name: 'Running' }).click();
await page.locator('#run-dist').fill('7,4');
await page.locator('#run-time').fill('41:30');
check('allure calculée', (await page.getByText('5:36 /km').count()) > 0);
await page.getByRole('button', { name: 'Ajouter la sortie' }).click();
await page.waitForTimeout(500);
d = await data();
check('sortie enregistrée', d.runs.length === 1 && d.runs[0].distanceKm === 7.4 && Math.abs(d.runs[0].durationMin - 41.5) < 0.01);

// Shopping: add with quantity and aisle, complete the list.
await nav('Courses');
await page.getByLabel('Ajouter un article').fill('2 avocats');
await page.keyboard.press('Enter');
await page.getByLabel('Ajouter un article').fill('Lait');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
d = await data();
const items = d.lists[0].items as { name: string; qty?: string; rayon: string }[];
check('article avec quantité et rayon', items.some((i) => i.name === 'Avocats' && i.qty === '2' && i.rayon === 'fruits') && items.some((i) => i.name === 'Lait' && i.rayon === 'frais'), JSON.stringify(items));
await page.getByRole('checkbox', { name: 'Cocher Avocats' }).click();
await page.getByRole('checkbox', { name: 'Cocher Lait' }).click();
await page.waitForTimeout(300);
check('liste terminée → message', (await page.getByText('Liste « Supermarché » terminée').count()) > 0);

// Goals: an auto goal on km, a list goal; habit created and ticked.
await nav('Objectifs');
await page.getByRole('button', { name: 'Nouvel objectif', exact: true }).click();
await page.locator('#goal-title').fill('Courir 20 km');
await page.getByRole('radio', { name: 'Kilomètres courus' }).click();
await page.getByLabel('cible', { exact: true }).fill('20');
await page.getByLabel('cible', { exact: true }).blur();
await page.getByRole('dialog').getByRole('button', { name: 'Créer', exact: true }).click();
await page.waitForTimeout(300);
check('objectif automatique calculé (7,4 / 20 km)', (await page.getByText('7,4').count()) > 0);
await page.getByRole('button', { name: 'Nouvelle habitude' }).click();
await page.locator('#habit-title').fill('Méditer 10 min');
await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('checkbox', { name: /Méditer 10 min, / }).nth(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1).click();
await page.waitForTimeout(400);
d = await data();
check('habitude cochée aujourd’hui', d.habits[0]?.checks.includes(today));

// Semaine type: a new routine appears in this week's agenda (if its day is today or later).
await nav('Semaine');
await page.getByRole('radio', { name: 'Semaine type' }).click();
const before = (await data()).routines.length;
await page.getByRole('button', { name: 'Routine' }).last().click();
await page.locator('#routine-title').fill('Arroser les plantes');
await page.getByRole('button', { name: 'Ajouter à la semaine type' }).click();
await page.waitForTimeout(500);
d = await data();
check('routine ajoutée et reportée dans l’agenda', d.routines.length === before + 1 && d.tasks.some((t: { title: string }) => t.title === 'Arroser les plantes'));

// Foyer: a second person, a task for her, the person filter, the account dialog (no e-mail is sent).
await nav("Aujourd'hui");
await page.getByRole('button', { name: /Corentin/ }).first().click();
await page.getByRole('menuitem', { name: 'Paramètres' }).click();
await page.getByLabel('Prénom de la personne à ajouter').fill('Léa');
await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('sélecteur de personne affiché', (await page.getByRole('radiogroup', { name: 'Personne' }).count()) > 0);
await page.keyboard.press('Control+n');
await page.locator('#task-title').fill('Arroser les tomates');
await page.getByRole('dialog').getByRole('radio', { name: 'Léa' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.waitForTimeout(500);
d = await data();
const lea = d.members.find((m: { name: string }) => m.name === 'Léa');
check('tâche attribuée à Léa', d.tasks.some((t: { title: string; assignee?: string }) => t.title === 'Arroser les tomates' && t.assignee === lea?.id));
const person = page.getByRole('radiogroup', { name: 'Personne' });
await person.getByRole('radio', { name: /Corentin/ }).click();
await page.waitForTimeout(300);
const hiddenForMe = (await page.locator('main').getByText('Arroser les tomates').count()) === 0;
await person.getByRole('radio', { name: 'Léa' }).click();
await page.waitForTimeout(300);
const shownForLea = (await page.locator('main').getByText('Arroser les tomates').count()) > 0;
check('filtre par personne (Corentin la cache, Léa la montre)', hiddenForMe && shownForLea);
await person.getByRole('radio', { name: 'Tous' }).click();
await page.getByRole('button', { name: /Corentin/ }).first().click();
await page.getByRole('menuitem', { name: 'Compte et partage' }).click();
const send = page.getByRole('button', { name: 'Recevoir un code' });
const disabledEmpty = await send.isDisabled();
await page.locator('#acc-email').fill('exemple@cadence.test');
check('dialogue de compte (bouton actif seulement avec une adresse)', disabledEmpty && !(await send.isDisabled()));
await page.keyboard.press('Escape');

await browser.close();
check('aucune erreur de page', errors.length === 0, errors.join(' | '));
console.log(results.some((r) => r.includes('ÉCHEC')) ? '\nAu moins un échec.' : '\nTout est OK.');

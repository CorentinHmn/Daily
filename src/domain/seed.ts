/**
 * Household creation. Three starts (+ import):
 *  - « modèle »: a semaine type and three gym programmes to adjust, an empty shopping list, common items for the quick
 *    add; no history.
 *  - « exemple »: the same + a believable history built around today's date (sessions, runs, goals, habits, a
 *    filled list), to explore every screen. Marked as an example; Settings › « Repartir de zéro » removes it.
 *  - « vide »: nothing at all.
 */
import { addDays, todayIso, weekStart, weekdayIndex, type ISODate } from '../lib/dates';
import { uid } from '../lib/format';
import { guessRayon } from './catalog';
import type { AppData, ExerciseTemplate, FrequentItem, GymSession, Habit, Program, Routine, Run, ShopItem, Task } from './types';
import { normalizeData } from './people';

const ex = (name: string, sets: number, reps: number, weight: number, restSec = 90): ExerciseTemplate => ({ id: uid(), name, sets, reps, weight, restSec });

export function templatePrograms(): Program[] {
  return [
    {
      id: 'push',
      name: 'Push',
      exercises: [ex('Développé couché', 4, 8, 60, 120), ex('Développé incliné haltères', 3, 10, 22), ex('Développé militaire', 3, 8, 35, 120), ex('Élévations latérales', 3, 12, 8, 60), ex('Dips', 3, 10, 0), ex('Extension triceps à la poulie', 3, 12, 20, 60)],
    },
    {
      id: 'pull',
      name: 'Pull',
      exercises: [ex('Tractions', 4, 6, 0, 120), ex('Rowing barre', 4, 8, 50, 120), ex('Tirage vertical', 3, 10, 45), ex('Face pull', 3, 15, 15, 60), ex('Curl biceps', 3, 10, 12, 60), ex('Curl marteau', 3, 12, 10, 60)],
    },
    {
      id: 'jambes',
      name: 'Jambes',
      exercises: [ex('Squat', 4, 6, 80, 150), ex('Soulevé de terre roumain', 3, 8, 70, 120), ex('Presse à cuisses', 3, 10, 140), ex('Fentes marchées', 3, 10, 16), ex('Leg curl', 3, 12, 35, 60), ex('Mollets debout', 4, 15, 40, 45)],
    },
  ];
}

export function templateRoutines(): Routine[] {
  const r = (weekday: number, category: Routine['category'], title: string, time?: string, durationMin?: number, programId?: string): Routine => ({ id: uid(), weekday, category, title, time, durationMin, programId });
  return [
    r(0, 'sport', 'Séance Push', '18:30', 75, 'push'),
    r(1, 'running', 'Footing 6 km', '07:00', 40),
    r(2, 'lessive', 'Lessive', '19:30', 20),
    r(2, 'menage', 'Cuisine et salle de bain', '20:00', 45),
    r(3, 'sport', 'Séance Pull', '18:30', 75, 'pull'),
    r(4, 'sport', 'Séance Jambes', '18:00', 75, 'jambes'),
    r(5, 'running', 'Sortie longue', '09:00', 70),
    r(5, 'courses', 'Courses de la semaine', '11:00', 60),
    r(5, 'menage', 'Ménage complet', '15:00', 90),
    r(6, 'cuisine', 'Batch cooking', '17:00', 120),
    r(6, 'admin', 'Préparer la semaine', '20:30', 20),
  ];
}

const COMMON_ITEMS = ['Bananes', 'Pommes', 'Tomates', 'Salade', 'Oignons', 'Pain', 'Lait', 'Œufs', 'Skyr', 'Fromage râpé', 'Beurre', 'Poulet', 'Steak haché', 'Saumon', 'Pâtes', 'Riz', "Flocons d'avoine", 'Café', 'Huile d’olive', 'Eau pétillante', 'Papier toilette', 'Liquide vaisselle', 'Dentifrice'];

export function commonFrequent(): Record<string, FrequentItem> {
  const out: Record<string, FrequentItem> = {};
  COMMON_ITEMS.forEach((name, i) => {
    out[name.toLowerCase()] = { name, rayon: guessRayon(name), count: Math.max(1, 8 - Math.floor(i / 3)) };
  });
  return out;
}

export function emptyData(): AppData {
  return {
    version: 1,
    onboarded: false,
    settings: { name: '', theme: 'night' },
    members: [],
    tasks: [],
    routines: [],
    generatedWeeks: [],
    programs: [],
    sessions: [],
    active: null,
    runs: [],
    goals: [],
    habits: [],
    lists: [],
    activeListId: null,
    frequent: {},
  };
}

/**
 * Tasks of a week from the semaine type. Their id is made of the routine and the date, so two devices filling the
 * same week (household shared online) produce the same tasks instead of duplicates.
 */
export function tasksFromRoutines(routines: Routine[], monday: ISODate, onlyFrom?: ISODate): Task[] {
  return routines
    .map((r) => ({ r, date: addDays(monday, r.weekday) }))
    .filter(({ date }) => !onlyFrom || date >= onlyFrom)
    .map(({ r, date }) => ({ id: `${r.id}@${date}`, title: r.title, category: r.category, date, time: r.time, durationMin: r.durationMin, done: false, routineId: r.id, programId: r.programId, assignee: r.assignee }));
}

export function modelData(name: string): AppData {
  const listId = uid();
  return normalizeData({
    ...emptyData(),
    onboarded: true,
    settings: { name, theme: 'night' },
    routines: templateRoutines(),
    programs: templatePrograms(),
    lists: [{ id: listId, name: 'Supermarché', items: [] }],
    activeListId: listId,
    frequent: commonFrequent(),
  });
}

/** Empty start: no semaine type, no programme, no list — everything is added by hand. */
export function blankData(name: string): AppData {
  return normalizeData({ ...emptyData(), onboarded: true, settings: { name, theme: 'night' } });
}

/** Deterministic pseudo-random numbers (same example every time for a given day). */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

export function exampleData(name: string, today = todayIso()): AppData {
  const base = modelData(name);
  const rand = rng(Number(today.replace(/-/g, '')));
  const monday = weekStart(today);
  const todayIdx = weekdayIndex(today);

  // ── Agenda: this week from the semaine type, done up to yesterday (one miss), + two one-off tasks.
  const tasks: Task[] = tasksFromRoutines(base.routines, monday).map((t) => {
    const idx = weekdayIndex(t.date);
    return { ...t, done: idx < todayIdx && !(idx === 2 && t.category === 'menage') };
  });
  tasks.push({ id: uid(), title: 'Dentiste', category: 'rdv', date: addDays(monday, Math.min(6, todayIdx + 1)), time: '09:15', durationMin: 45, done: false });
  tasks.push({ id: uid(), title: 'Payer le loyer', category: 'admin', date: addDays(monday, Math.max(0, todayIdx - 1)), done: true });

  // ── Gym: Push / Pull / Jambes on their days for 8 weeks (a few skipped), with slowly rising loads.
  const sessions: GymSession[] = [];
  const days: [number, string][] = [
    [0, 'push'],
    [3, 'pull'],
    [4, 'jambes'],
  ];
  for (let w = 8; w >= 0; w--) {
    const wMonday = addDays(monday, -7 * w);
    for (const [wd, pid] of days) {
      const date = addDays(wMonday, wd);
      if (date >= today) continue;
      if (w > 0 && rand() < 0.18) continue;
      const p = base.programs.find((x) => x.id === pid)!;
      const progress = 1 - w * 0.012;
      const start = new Date(`${date}T18:${String(10 + Math.floor(rand() * 30)).padStart(2, '0')}:00`).getTime();
      sessions.push({
        id: uid(),
        programId: p.id,
        programName: p.name,
        date,
        startedAt: start,
        endedAt: start + (58 + Math.floor(rand() * 25)) * 60_000,
        exercises: p.exercises.map((e) => ({
          exerciseId: e.id,
          name: e.name,
          restSec: e.restSec,
          sets: Array.from({ length: e.sets }, (_, i) => ({ reps: e.reps - (i === e.sets - 1 && rand() < 0.4 ? 1 : 0), weight: Math.round(e.weight * progress * 2) / 2, done: true })),
        })),
      });
    }
  }

  // ── Running: Tuesday footing + Saturday long run, 10 weeks, distances building up.
  const runs: Run[] = [];
  for (let w = 10; w >= 0; w--) {
    const wMonday = addDays(monday, -7 * w);
    const tue = addDays(wMonday, 1);
    const sat = addDays(wMonday, 5);
    if (tue < today && !(w > 0 && rand() < 0.15)) {
      const d = Math.round((5 + rand() * 2) * 10) / 10;
      runs.push({ id: uid(), date: tue, distanceKm: d, durationMin: Math.round(d * (5.6 + rand() * 0.4)), feeling: 3 + Math.floor(rand() * 2) });
    }
    if (sat < today && !(w > 0 && rand() < 0.2)) {
      const d = Math.round((8 + (10 - w) * 0.55 + rand() * 1.5) * 10) / 10;
      runs.push({ id: uid(), date: sat, distanceKm: d, durationMin: Math.round(d * (5.8 + rand() * 0.5)), feeling: 2 + Math.floor(rand() * 3) });
    }
  }

  // ── Goals.
  const step = (label: string, done: boolean) => ({ id: uid(), label, done });
  const goals: AppData['goals'] = [
    { id: uid(), title: '3 séances de salle', period: 'semaine', kind: 'auto', source: 'seances', target: 3, value: 0, steps: [], icon: 'dumbbell' },
    { id: uid(), title: '15 km de course à pied', period: 'semaine', kind: 'auto', source: 'km', target: 15, value: 0, steps: [], icon: 'footprints' },
    { id: uid(), title: 'Cocher 12 tâches', period: 'semaine', kind: 'auto', source: 'taches', target: 12, value: 0, steps: [], icon: 'target' },
    { id: uid(), title: 'Courir 60 km', period: 'mois', kind: 'auto', source: 'km', target: 60, value: 0, steps: [], icon: 'footprints' },
    { id: uid(), title: 'Ranger le garage', period: 'mois', kind: 'liste', target: 0, value: 0, steps: [step('Trier les cartons', true), step('Donner les vêtements', true), step('Installer les étagères', false), step('Déposer le reste en déchetterie', false)], icon: 'home' },
    { id: uid(), title: 'Lire 12 livres', period: 'annee', kind: 'compteur', target: 12, value: 9, steps: [], icon: 'book' },
    { id: uid(), title: 'Semi-marathon', period: 'annee', kind: 'liste', target: 0, value: 0, steps: [step("S'inscrire", true), step("Suivre un plan d'entraînement de 10 semaines", true), step('Courir 15 km d’une traite', false), step('Finir sous les 2 h', false)], icon: 'trophy' },
  ];

  // ── Habits, done most days of this week.
  const checksFor = (days: number[], miss: number[]): ISODate[] => {
    const out: ISODate[] = [];
    for (let i = 1; i <= 20; i++) {
      const d = addDays(today, -i);
      if (days.includes(weekdayIndex(d)) && !miss.includes(i)) out.push(d);
    }
    return out;
  };
  const all = [0, 1, 2, 3, 4, 5, 6];
  const habits: Habit[] = [
    { id: uid(), title: "Boire 1,5 L d'eau", icon: 'droplets', days: all, checks: [today, ...checksFor(all, [3, 9])] },
    { id: uid(), title: "10 min d'étirements", icon: 'stretch', days: all, checks: checksFor(all, [2, 5, 6, 11]) },
    { id: uid(), title: 'Au lit avant 23 h', icon: 'moon', days: [6, 0, 1, 2, 3], checks: checksFor([6, 0, 1, 2, 3], [4]) },
    { id: uid(), title: '20 pages de lecture', icon: 'book', days: all, checks: checksFor(all, [1, 7, 8]) },
  ];

  // ── Shopping list.
  const item = (name: string, qty?: string, checked = false): ShopItem => ({ id: uid(), name, qty, rayon: guessRayon(name), checked });
  const listId = base.activeListId!;
  const lists = [
    { id: listId, name: 'Supermarché', items: [item('Bananes', '6'), item('Épinards frais'), item('Tomates cerises'), item('Poulet', '1 kg'), item('Skyr', '4'), item('Œufs', '12', true), item("Flocons d'avoine"), item('Riz basmati', undefined, true), item("Lait d'avoine", '2'), item('Café'), item('Papier toilette'), item('Liquide vaisselle')] },
    { id: uid(), name: 'Pharmacie', items: [item('Magnésium'), item('Pansements')] },
  ];

  tasks.sort((a, b) => (a.date === b.date ? (a.time ?? '99').localeCompare(b.time ?? '99') : a.date.localeCompare(b.date)));
  const me = base.settings.meId;
  const mine = <T extends object>(x: T): T => ({ ...x, owner: me });
  return {
    ...base,
    tasks: tasks.map((t) => (t.category === 'sport' || t.category === 'running' ? { ...t, assignee: me } : t)),
    generatedWeeks: [monday],
    sessions: sessions.map(mine),
    runs: runs.map(mine),
    goals: goals.map(mine),
    habits: habits.map(mine),
    lists,
  };
}

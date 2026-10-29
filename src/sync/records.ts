/**
 * AppData ⇄ records of the `records` table (one row per object, keyed by collection + id). Pure functions, tested in
 * records.test.ts.
 *  - shopping lists are split: the list (without its items) and each item (with its listId), so two people ticking
 *    items of the same list at the same time do not overwrite each other;
 *  - generatedWeeks become « weeks » records, so a device does not refill a week the other one already filled;
 *  - the household's settings (prefs) are one record;
 *  - settings (this device's name, theme, me) and the session in progress stay on the device.
 */
import type { AppData, FrequentItem, GoalStep, HouseholdPrefs, Member, ShopItem, ShopList, Task } from '../domain/types';

export type Collection = 'members' | 'tasks' | 'routines' | 'weeks' | 'programs' | 'sessions' | 'runs' | 'goals' | 'habits' | 'lists' | 'items' | 'frequent' | 'prefs';

export interface Rec {
  collection: Collection;
  id: string;
  data: unknown;
  /** JSON of data, to compare */
  json: string;
}

export type Flat = Map<string, Rec>;

export const keyOf = (collection: string, id: string) => `${collection}/${id}`;

export function flatten(d: AppData): Flat {
  const m: Flat = new Map();
  const put = (collection: Collection, id: string, data: unknown) => m.set(keyOf(collection, id), { collection, id, data, json: JSON.stringify(data) });
  for (const x of d.members) put('members', x.id, x);
  for (const x of d.tasks) put('tasks', x.id, x);
  for (const x of d.routines) put('routines', x.id, x);
  for (const w of d.generatedWeeks) put('weeks', w, { monday: w });
  for (const x of d.programs) put('programs', x.id, x);
  for (const x of d.sessions) put('sessions', x.id, x);
  for (const x of d.runs) put('runs', x.id, x);
  for (const x of d.goals) put('goals', x.id, x);
  for (const x of d.habits) put('habits', x.id, x);
  for (const l of d.lists) {
    put('lists', l.id, { id: l.id, name: l.name });
    for (const it of l.items) put('items', it.id, { ...it, listId: l.id });
  }
  for (const [k, v] of Object.entries(d.frequent)) put('frequent', k, v);
  if (d.prefs && Object.keys(d.prefs).length) put('prefs', 'foyer', d.prefs);
  return m;
}

export interface Change {
  collection: Collection;
  id: string;
  /** null = deleted */
  data: unknown | null;
}

/** What changed from `prev` to `next` (added or modified objects, deleted ones). */
export function diff(prev: Flat, next: Flat): Change[] {
  const out: Change[] = [];
  for (const [k, r] of next) if (prev.get(k)?.json !== r.json) out.push({ collection: r.collection, id: r.id, data: r.data });
  for (const [k, r] of prev) if (!next.has(k)) out.push({ collection: r.collection, id: r.id, data: null });
  return out;
}

const sortTasks = (t: Task[]) => [...t].sort((a, b) => (a.date === b.date ? (a.time ?? '99:99').localeCompare(b.time ?? '99:99') : a.date.localeCompare(b.date)));

/** Rebuilds the synced part of AppData from records; device-only fields come from `base`. */
export function unflatten(base: AppData, flat: Flat): AppData {
  const of = <T>(c: Collection): T[] => [...flat.values()].filter((r) => r.collection === c).map((r) => r.data as T);
  const items = of<ShopItem & { listId: string }>('items');
  const lists: ShopList[] = of<{ id: string; name: string }>('lists').map((l) => ({
    id: l.id,
    name: l.name,
    items: items
      .filter((i) => i.listId === l.id)
      .map((i) => {
        const it: ShopItem & { listId?: string } = { ...i };
        delete it.listId;
        return it;
      }),
  }));
  const frequent: Record<string, FrequentItem> = {};
  for (const r of flat.values()) if (r.collection === 'frequent') frequent[r.id] = r.data as FrequentItem;
  return {
    ...base,
    members: of<Member>('members'),
    tasks: sortTasks(of<Task>('tasks')),
    routines: of('routines'),
    generatedWeeks: of<{ monday: string }>('weeks')
      .map((w) => w.monday)
      .sort(),
    programs: of('programs'),
    sessions: of<AppData['sessions'][number]>('sessions').sort((a, b) => a.startedAt - b.startedAt),
    runs: of<AppData['runs'][number]>('runs').sort((a, b) => a.date.localeCompare(b.date)),
    goals: of<AppData['goals'][number] & { steps: GoalStep[] }>('goals'),
    habits: of('habits'),
    lists,
    activeListId: lists.some((l) => l.id === base.activeListId) ? base.activeListId : (lists[0]?.id ?? null),
    frequent,
    prefs: flat.get(keyOf('prefs', 'foyer'))?.data as HouseholdPrefs | undefined,
  };
}

export interface Row {
  collection: Collection;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
  updated_by: string | null;
}

/** Applies rows from the server to a flat map; keys in `skip` (local changes not sent yet) are left alone. */
export function applyRows(flat: Flat, rows: Row[], skip: Set<string> = new Set()): boolean {
  let changed = false;
  for (const r of rows) {
    const k = keyOf(r.collection, r.id);
    if (skip.has(k)) continue;
    if (r.deleted) {
      if (flat.delete(k)) changed = true;
      continue;
    }
    const json = JSON.stringify(r.data);
    if (flat.get(k)?.json === json) continue;
    flat.set(k, { collection: r.collection, id: r.id, data: r.data, json });
    changed = true;
  }
  return changed;
}

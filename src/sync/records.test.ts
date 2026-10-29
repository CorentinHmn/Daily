import { describe, expect, it } from 'vitest';
import { applyRows, diff, flatten, keyOf, unflatten, type Row } from './records';
import { exampleData, tasksFromRoutines } from '../domain/seed';

const data = exampleData('Corentin', '2026-10-25');

describe('records', () => {
  it('rebuilds the same data from its records', () => {
    const back = unflatten({ ...data, members: [], tasks: [], lists: [], frequent: {} }, flatten(data));
    for (const k of ['members', 'tasks', 'routines', 'generatedWeeks', 'programs', 'sessions', 'runs', 'goals', 'habits', 'lists', 'frequent'] as const) {
      expect(back[k], k).toEqual(data[k]);
    }
  });

  it("the household's settings travel as one record", () => {
    const withPrefs = { ...data, prefs: { tabIcons: { today: 'sunrise' } } };
    expect(unflatten({ ...data, prefs: undefined }, flatten(withPrefs)).prefs).toEqual(withPrefs.prefs);
    expect(diff(flatten(data), flatten(withPrefs))).toEqual([{ collection: 'prefs', id: 'foyer', data: withPrefs.prefs }]);
    expect(diff(flatten(withPrefs), flatten({ ...withPrefs, prefs: {} }))).toEqual([{ collection: 'prefs', id: 'foyer', data: null }]);
  });

  it('ticking one shopping item changes one record only', () => {
    const list = data.lists[0]!;
    const next = { ...data, lists: [{ ...list, items: list.items.map((i, n) => (n === 0 ? { ...i, checked: !i.checked } : i)) }, ...data.lists.slice(1)] };
    const changes = diff(flatten(data), flatten(next));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ collection: 'items', id: list.items[0]!.id });
  });

  it('a deleted task becomes a deletion', () => {
    const next = { ...data, tasks: data.tasks.slice(1) };
    expect(diff(flatten(data), flatten(next))).toEqual([{ collection: 'tasks', id: data.tasks[0]!.id, data: null }]);
  });

  it('applies server rows, but never over a local change not sent yet', () => {
    const flat = flatten(data);
    const t0 = data.tasks[0]!;
    const t1 = data.tasks[1]!;
    const row = (id: string, d: unknown, deleted = false): Row => ({ collection: 'tasks', id, data: d, deleted, updated_at: '2026-10-25T10:00:00Z', updated_by: null });
    expect(applyRows(flat, [row(t0.id, t0)])).toBe(false); // identical
    expect(applyRows(flat, [row(t0.id, { ...t0, done: !t0.done })], new Set([keyOf('tasks', t0.id)]))).toBe(false); // pending locally
    expect(applyRows(flat, [row(t1.id, null, true)])).toBe(true);
    expect(flat.has(keyOf('tasks', t1.id))).toBe(false);
  });

  it('two devices filling the same week create the same tasks', () => {
    const a = tasksFromRoutines(data.routines, '2026-10-26').map((t) => t.id);
    const b = tasksFromRoutines(data.routines, '2026-10-26').map((t) => t.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

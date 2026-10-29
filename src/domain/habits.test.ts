import { describe, expect, it } from 'vitest';
import { habitChecks, habitEntries, habitPeople, keepPeople, withHabitCheck, withHabitPeople } from './people';
import { habitStreak } from './stats';
import { mergeHabit } from '../sync/records';
import { NOUS, type Habit, type Member } from './types';

const members: Member[] = [
  { id: 'a', name: 'Corentin', hue: 'warm' },
  { id: 'b', name: 'Louise', hue: 'violet' },
  { id: 'c', name: 'Léa', hue: 'green' },
];
const habit = (h: Partial<Habit>): Habit => ({ id: 'h', title: 'Eau', icon: 'droplets', days: [0, 1, 2, 3, 4, 5, 6], checks: [], ...h });

describe('habits for several people', () => {
  it('one person keeps `checks`; several or the household tick their own', () => {
    const one = withHabitCheck(habit({ owner: 'a' }), '2026-10-29', 'a');
    expect(one.checks).toEqual(['2026-10-29']);
    const two = withHabitCheck(habit({ owner: NOUS, owners: ['a', 'b'] }), '2026-10-29', 'b');
    expect([habitChecks(two, 'a'), habitChecks(two, 'b')]).toEqual([[], ['2026-10-29']]);
    expect(habitChecks(withHabitCheck(two, '2026-10-29', 'b'), 'b')).toEqual([]);
  });

  it('who it is for, and one line per person under each filter', () => {
    const shared = habit({ id: 's', owner: NOUS, owners: ['a', 'b'] });
    const all = habit({ id: 'n', owner: NOUS });
    const mine = habit({ id: 'm', owner: 'c' });
    expect(habitPeople(shared, members)).toEqual(['a', 'b']);
    expect(habitPeople(all, members)).toEqual(['a', 'b', 'c']);
    const line = (person: string | null) => habitEntries([shared, all, mine], members, person).map((e) => `${e.habit.id}${e.who}`);
    expect(line(null)).toEqual(['sa', 'sb', 'na', 'nb', 'nc', 'mc']);
    expect(line('b')).toEqual(['sb', 'nb']);
  });

  it('sharing a habit keeps its person’s ticks (and not the others’), and back', () => {
    const shared = withHabitPeople(habit({ owner: 'a', checks: ['2026-10-28'] }), NOUS, ['a', 'b']);
    expect([habitChecks(shared, 'a'), habitChecks(shared, 'b')]).toEqual([['2026-10-28'], []]);
    const ticked = withHabitCheck(shared, '2026-10-29', 'b');
    const back = withHabitPeople(ticked, 'b', undefined);
    expect(back.checks).toEqual(['2026-10-29']);
    expect(habitStreak(back, habitChecks(back, 'b'), '2026-10-29')).toBe(1);
  });

  it('a habit from before keeps its ticks for everyone until each ticks their own', () => {
    const old = habit({ owner: NOUS, checks: ['2026-10-28'] });
    expect(habitChecks(old, 'b')).toEqual(['2026-10-28']);
    expect(habitChecks(withHabitCheck(old, '2026-10-29', 'a'), 'a')).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('a new start hands the generated person’s ticks to this device’s person', () => {
    const d = { members: [], settings: { meId: 'gen' }, tasks: [], routines: [], programs: [], sessions: [], runs: [], goals: [], habits: [habit({ owner: NOUS, owners: ['gen', 'b'], checksBy: { gen: ['2026-10-29'], b: [] } })] };
    const h = keepPeople(d as never, members, 'a').habits[0]!;
    expect(h.owners).toEqual(['a', 'b']);
    expect(h.checksBy).toEqual({ b: [], a: ['2026-10-29'] });
  });

  it('two people ticking the same habit at once both keep their tick', () => {
    const base = habit({ owner: NOUS, owners: ['a', 'b'], checksBy: { a: [], b: [] } });
    const here = withHabitCheck(base, '2026-10-29', 'a');
    const there = withHabitCheck(base, '2026-10-29', 'b');
    const merged = mergeHabit(there, { ...here, title: 'Eau (1,5 L)' }, base);
    expect(merged.title).toBe('Eau (1,5 L)');
    expect([habitChecks(merged, 'a'), habitChecks(merged, 'b')]).toEqual([['2026-10-29'], ['2026-10-29']]);
    // An untick here wins over the server's older tick.
    const undone = withHabitCheck(here, '2026-10-29', 'a');
    expect(habitChecks(mergeHabit(here, undone, here), 'a')).toEqual([]);
  });
});

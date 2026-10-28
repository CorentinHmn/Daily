import { describe, expect, it } from 'vitest';
import { normalizeData, concerns, ownedBy } from './people';
import { exampleData } from './seed';
import { NOUS, type AppData } from './types';

describe('household', () => {
  it('data saved before the household (no members) gets this device’s person and owners', () => {
    const legacy = exampleData('Corentin', '2026-10-25') as AppData & { members?: unknown };
    const old = JSON.parse(JSON.stringify({ ...legacy, members: undefined, settings: { name: 'Corentin', theme: 'day' } })) as AppData;
    for (const x of [...old.sessions, ...old.runs, ...old.habits, ...old.goals, ...old.programs]) delete (x as { owner?: string }).owner;
    for (const t of old.tasks) delete t.assignee;
    const d = normalizeData(old);
    expect(d.members).toHaveLength(1);
    expect(d.members[0]!.name).toBe('Corentin');
    const me = d.settings.meId;
    expect(me).toBe(d.members[0]!.id);
    expect(d.sessions.every((s) => s.owner === me)).toBe(true);
    expect(d.tasks.filter((t) => t.category === 'sport').every((t) => t.assignee === me)).toBe(true);
    expect(d.tasks.filter((t) => t.category === 'menage').every((t) => !t.assignee)).toBe(true);
  });

  it('household tasks concern everyone, personal ones their person', () => {
    expect(concerns(undefined, 'a')).toBe(true);
    expect(concerns(NOUS, 'a')).toBe(true);
    expect(concerns('b', 'a')).toBe(false);
    expect(concerns('b', null)).toBe(true);
    expect(ownedBy('a', 'a')).toBe(true);
    expect(ownedBy('b', 'a')).toBe(false);
  });
});

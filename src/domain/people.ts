/**
 * The household's people: who does a task (assignee) and whose a habit, a programme, a session, a run or a goal is
 * (owner). Undefined or NOUS = the whole household. The person filter of the screens: null = everyone.
 */
import { uid } from '../lib/format';
import type { ISODate } from '../lib/dates';
import { NOUS, type AppData, type Habit, type Member, type MemberHue } from './types';

export const MEMBER_HUES: MemberHue[] = ['warm', 'violet', 'green', 'blue'];

/** A task assigned to the household is everyone's. */
export function concerns(assignee: string | undefined, person: string | null): boolean {
  return !person || !assignee || assignee === NOUS || assignee === person;
}

/** Own items (habits, sport, goals): items without owner are the household's. */
export function ownedBy(owner: string | undefined, person: string | null): boolean {
  return !person || !owner || owner === NOUS || owner === person;
}

/** The people a goal is for: one, several (`owners`), or none = the whole household. */
export function goalOwners(g: { owner?: string; owners?: string[] }): string[] {
  if (g.owners?.length) return g.owners;
  return !g.owner || g.owner === NOUS ? [] : [g.owner];
}

/** A goal shows under a person's filter when it is theirs, shared with them, or the household's. */
export function goalFor(g: { owner?: string; owners?: string[] }, person: string | null): boolean {
  const owners = goalOwners(g);
  return !person || owners.length === 0 || owners.includes(person);
}

/**
 * Habits are one, several (`owners`) or all the household's people (same fields as goals), but each person ticks their
 * own: a habit for one person keeps its dates in `checks`, a habit for several in `checksBy` (person → dates).
 */
const habitAlone = (h: Habit) => !!h.owner && h.owner !== NOUS;

/** The people a habit is for (the household = all its people). */
export function habitPeople(h: Habit, members: Member[]): string[] {
  const owners = goalOwners(h);
  return owners.length ? owners : members.map((m) => m.id);
}

/** The dates `who` did the habit (`checks`, before a habit could be shared: everyone's until they tick their own). */
export function habitChecks(h: Habit, who: string): ISODate[] {
  return habitAlone(h) ? h.checks : (h.checksBy?.[who] ?? h.checks);
}

/** The habit with `who`'s tick of `date` turned on or off. */
export function withHabitCheck(h: Habit, date: ISODate, who: string): Habit {
  const flip = (dates: ISODate[]) => (dates.includes(date) ? dates.filter((c) => c !== date) : [...dates, date]);
  if (habitAlone(h)) return { ...h, checks: flip(h.checks) };
  return { ...h, checksBy: { ...h.checksBy, [who]: flip(habitChecks(h, who)) } };
}

/** The habit for other people, each keeping their ticks (one person's become theirs when it is shared, and back). */
export function withHabitPeople(h: Habit, owner: string, owners: string[] | undefined): Habit {
  const alone = owner !== NOUS;
  if (habitAlone(h) && !alone) return { ...h, owner, owners, checks: [], checksBy: { ...h.checksBy, [h.owner!]: h.checks } };
  if (!habitAlone(h) && alone) return { ...h, owner, owners, checks: habitChecks(h, owner) };
  return { ...h, owner, owners };
}

/** One line per habit and person (all of them, or the filtered one): each ticks their own. */
export function habitEntries(habits: Habit[], members: Member[], person: string | null): { habit: Habit; who: string }[] {
  return habits.flatMap((habit) =>
    habitPeople(habit, members)
      .filter((who) => !person || who === person)
      .map((who) => ({ habit, who })),
  );
}

export function memberOf(members: Member[], id: string | undefined): Member | undefined {
  return id && id !== NOUS ? members.find((m) => m.id === id) : undefined;
}

export function newMember(name: string, members: Member[]): Member {
  const used = new Set(members.map((m) => m.hue));
  return { id: `m-${uid()}`, name: name.trim() || 'Moi', hue: MEMBER_HUES.find((h) => !used.has(h)) ?? 'blue' };
}

/**
 * Brings saved or imported data to the current shape: a household of at least one person (this device's), owners on
 * personal items (sport and running tasks assigned to that person, other tasks to the household).
 */
export function normalizeData(d: AppData): AppData {
  let members = Array.isArray(d.members) ? d.members : [];
  let meId = d.settings.meId;
  if (members.length === 0) {
    const me = newMember(d.settings.name || 'Moi', []);
    me.hue = 'warm';
    members = [me];
    meId = me.id;
  }
  if (!meId || !members.some((m) => m.id === meId)) meId = members[0]!.id;
  const personal = (c: string) => c === 'sport' || c === 'running';
  const own = <T extends { owner?: string }>(x: T): T => (x.owner ? x : { ...x, owner: meId });
  const needsOwners = !Array.isArray(d.members) || d.members.length === 0;
  if (!needsOwners) return { ...d, members, settings: { ...d.settings, meId } };
  return {
    ...d,
    members,
    settings: { ...d.settings, meId },
    tasks: d.tasks.map((t) => (t.assignee || !personal(t.category) ? t : { ...t, assignee: meId })),
    routines: d.routines.map((r) => (r.assignee || !personal(r.category) ? r : { ...r, assignee: meId })),
    habits: d.habits.map(own),
    programs: d.programs.map(own),
    sessions: d.sessions.map(own),
    runs: d.runs.map(own),
    goals: d.goals.map(own),
  };
}

/**
 * Data built for a new person (start again, example) handed to the household's existing people: this device's person
 * takes over everything the generated one owned or was assigned, so accounts stay linked to their person.
 */
export function keepPeople(d: AppData, members: Member[], meId: string | undefined): AppData {
  const gen = d.settings.meId;
  if (!members.length || !meId || !members.some((m) => m.id === meId)) return d;
  const owner = <T extends { owner?: string }>(x: T): T => (x.owner === gen ? { ...x, owner: meId } : x);
  const owners = <T extends { owner?: string; owners?: string[] }>(x: T): T => (x.owners ? { ...owner(x), owners: x.owners.map((o) => (o === gen ? meId : o)) } : owner(x));
  const assignee = <T extends { assignee?: string }>(x: T): T => (x.assignee === gen ? { ...x, assignee: meId } : x);
  return {
    ...d,
    members,
    settings: { ...d.settings, meId, name: members.find((m) => m.id === meId)?.name ?? d.settings.name },
    tasks: d.tasks.map(assignee),
    routines: d.routines.map(assignee),
    habits: d.habits.map((h) => {
      const x = owners(h);
      if (!h.checksBy || !gen || !(gen in h.checksBy)) return x;
      const { [gen]: mine, ...rest } = h.checksBy;
      return { ...x, checksBy: { ...rest, [meId]: mine ?? [] } };
    }),
    programs: d.programs.map(owner),
    sessions: d.sessions.map(owner),
    runs: d.runs.map(owner),
    goals: d.goals.map(owners),
  };
}

/**
 * The household's people: who does a task (assignee) and whose a habit, a programme, a session, a run or a goal is
 * (owner). Undefined or NOUS = the whole household. The person filter of the screens: null = everyone.
 */
import { uid } from '../lib/format';
import { NOUS, type AppData, type Member, type MemberHue } from './types';

export const MEMBER_HUES: MemberHue[] = ['warm', 'violet', 'green', 'blue'];

/** A task assigned to the household is everyone's. */
export function concerns(assignee: string | undefined, person: string | null): boolean {
  return !person || !assignee || assignee === NOUS || assignee === person;
}

/** Own items (habits, sport, goals): items without owner are the household's. */
export function ownedBy(owner: string | undefined, person: string | null): boolean {
  return !person || !owner || owner === NOUS || owner === person;
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
  const assignee = <T extends { assignee?: string }>(x: T): T => (x.assignee === gen ? { ...x, assignee: meId } : x);
  return {
    ...d,
    members,
    settings: { ...d.settings, meId, name: members.find((m) => m.id === meId)?.name ?? d.settings.name },
    tasks: d.tasks.map(assignee),
    routines: d.routines.map(assignee),
    habits: d.habits.map(owner),
    programs: d.programs.map(owner),
    sessions: d.sessions.map(owner),
    runs: d.runs.map(owner),
    goals: d.goals.map(owner),
  };
}

/** Derived numbers: goal progress, weekly volumes, streaks. Pure functions of AppData. */
import { addDays, daysBetween, monthEnd, monthStart, toIso, todayIso, weekStart, weekdayIndex, yearEnd, yearStart, type ISODate } from '../lib/dates';
import { NOUS, type AppData, type Goal, type GoalPeriod, type GymSession, type Habit, type Run, type Task } from './types';
import { concerns, goalOwners } from './people';


export function periodRange(period: GoalPeriod, today = todayIso()): { from: ISODate; to: ISODate } {
  if (period === 'semaine') {
    const from = weekStart(today);
    return { from, to: addDays(from, 6) };
  }
  if (period === 'mois') return { from: monthStart(today), to: monthEnd(today) };
  return { from: yearStart(today), to: yearEnd(today) };
}

const inRange = (d: ISODate, r: { from: ISODate; to: ISODate }) => d >= r.from && d <= r.to;

export function sessionVolume(s: GymSession): number {
  return s.exercises.reduce((sum, e) => sum + e.sets.reduce((a, set) => a + (set.done ? set.reps * set.weight : 0), 0), 0);
}

export function sessionMinutes(s: GymSession): number {
  return Math.max(1, Math.round((s.endedAt - s.startedAt) / 60_000));
}

export function runsIn(runs: Run[], r: { from: ISODate; to: ISODate }): Run[] {
  return runs.filter((x) => inRange(x.date, r));
}

export function sessionsIn(sessions: GymSession[], r: { from: ISODate; to: ISODate }): GymSession[] {
  return sessions.filter((x) => inRange(x.date, r));
}

export function kmIn(runs: Run[], r: { from: ISODate; to: ISODate }): number {
  return runsIn(runs, r).reduce((s, x) => s + x.distanceKm, 0);
}

export function tasksDoneIn(tasks: Task[], r: { from: ISODate; to: ISODate }): number {
  return tasks.filter((t) => t.done && inRange(t.date, r)).length;
}

/** Current value and target of a goal (auto goals read the app's data). */
export function goalProgress(goal: Goal, data: Pick<AppData, 'runs' | 'sessions' | 'tasks'>, today = todayIso()): { value: number; target: number; ratio: number } {
  if (goal.kind === 'liste') {
    const target = goal.steps.length;
    const value = goal.steps.filter((s) => s.done).length;
    return { value, target, ratio: target ? value / target : 0 };
  }
  let value = goal.value;
  if (goal.kind === 'auto') {
    const r = periodRange(goal.period, today);
    // A personal goal counts its people's sessions, runs and tasks (with the household's sessions and runs); a shared
    // one (NOUS) counts the household's.
    const who = goalOwners(goal);
    const theirs = (owner?: string) => !who.length || !owner || owner === NOUS || who.includes(owner);
    const sessions = data.sessions.filter((x) => theirs(x.owner));
    // A run made together counts for each of its people.
    const runs = data.runs.filter((x) => !who.length || goalOwners(x).length === 0 || goalOwners(x).some((o) => who.includes(o)));
    const tasks = who.length ? data.tasks.filter((t) => t.assignee && who.includes(t.assignee)) : data.tasks;
    if (goal.source === 'seances') value = sessionsIn(sessions, r).length;
    else if (goal.source === 'km') value = Math.round(kmIn(runs, r) * 10) / 10;
    else if (goal.source === 'sorties') value = runsIn(runs, r).length;
    else if (goal.source === 'taches') value = tasksDoneIn(tasks, r);
  }
  const target = Math.max(1, goal.target);
  return { value, target, ratio: Math.min(1, value / target) };
}

/** On track, done, or behind the pace of the period (progress < 75 % of the elapsed share, after a first quarter). */
export function goalStatus(goal: Goal, ratio: number, today = todayIso()): 'atteint' | 'en-cours' | 'en-retard' {
  if (ratio >= 1) return 'atteint';
  const r = periodRange(goal.period, today);
  const total = daysBetween(r.from, r.to) + 1;
  const elapsed = (daysBetween(r.from, today) + 1) / total;
  if (elapsed > 0.25 && ratio < elapsed * 0.75) return 'en-retard';
  return 'en-cours';
}

export function habitDueOn(h: Habit, iso: ISODate): boolean {
  return h.days.includes(weekdayIndex(iso));
}

/** Consecutive due days done (`checks`: one person's, see people.ts › habitChecks), counting back from today (today
 * counts only once done). */
export function habitStreak(h: Habit, checks: ISODate[], today = todayIso()): number {
  const done = new Set(checks);
  let n = 0;
  let d = today;
  if (!done.has(d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (habitDueOn(h, d)) {
      if (!done.has(d)) break;
      n++;
    }
    d = addDays(d, -1);
  }
  return n;
}

/** Last `count` weeks (oldest first): Monday + value. */
export function weeklySeries(count: number, value: (from: ISODate, to: ISODate) => number, today = todayIso()): { week: ISODate; value: number }[] {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => {
    const from = addDays(current, (i - count + 1) * 7);
    return { week: from, value: value(from, addDays(from, 6)) };
  });
}

/** Last `count` months (oldest first): first day of the month + value. */
export function monthlySeries(count: number, value: (from: ISODate, to: ISODate) => number, today = todayIso()): { month: ISODate; value: number }[] {
  const [y, m] = today.split('-').map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const from = toIso(new Date(y, m - 1 + i - count + 1, 1));
    return { month: from, value: value(from, monthEnd(from)) };
  });
}

/**
 * Next gym session: the first unticked gym task from today, else the next gym routine of the semaine type (weeks
 * not opened yet have no tasks). Returns its date, time and programme (by id, or by name found in the title).
 */
export function nextGymSession(data: Pick<AppData, 'tasks' | 'routines' | 'programs'>, today = todayIso(), person: string | null = null): { date: ISODate; time?: string; programId?: string } | null {
  const byName = (title: string) => data.programs.find((p) => title.toLowerCase().includes(p.name.toLowerCase()))?.id;
  const task = data.tasks.find((t) => t.category === 'sport' && !t.done && t.date >= today && concerns(t.assignee, person));
  if (task) return { date: task.date, time: task.time, programId: task.programId ?? byName(task.title) };
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const r = data.routines.filter((x) => x.category === 'sport' && x.weekday === weekdayIndex(date) && concerns(x.assignee, person)).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0];
    if (r && !data.tasks.some((t) => t.routineId === r.id && t.date === date)) return { date, time: r.time, programId: r.programId ?? byName(r.title) };
  }
  return null;
}

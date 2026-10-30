/**
 * App state (zustand): the household's data (online in Supabase, see sync/; kept in localStorage so the app opens
 * instantly and works offline) and the UI state (menu, dialogs, toasts, rest timer).
 *
 * Links between screens:
 *  - the semaine type (routines) fills each new week; editing a routine updates its future, unchecked tasks;
 *  - finishing a gym session ticks that day's gym task, logging a run ticks that day's running task, completing the
 *    shopping list ticks today's shopping task;
 *  - « auto » goals read sessions, runs and ticked tasks (domain/stats.ts).
 */
import { create } from 'zustand';
import { addDays, todayIso, weekStart, weekdayIndex, type ISODate } from '../lib/dates';
import { normalize, uid } from '../lib/format';
import { guessRayon } from '../domain/catalog';
import { blankData, emptyData, exampleData, modelData, tasksFromRoutines } from '../domain/seed';
import { keepPeople, newMember, normalizeData, withHabitCheck, withHabitPeople } from '../domain/people';
import { NOUS, type AppData, type BackdropId, type CategoryId, type Goal, type GoalPeriod, type Habit, type Member, type Program, type RayonId, type Routine, type Run, type ShopItem, type Task, type ThemeName } from '../domain/types';
import type { ToastItem } from '../ui/overlays';

export type View = 'today' | 'week' | 'sport' | 'goals' | 'shopping';
/** Screens shared by the whole household: no person filter there. */
export const SHARED_VIEWS: readonly View[] = ['shopping'];
export type StartMode = 'modele' | 'exemple' | 'vide';

export type DialogState =
  | { kind: 'task'; id?: string; date?: ISODate; category?: CategoryId }
  | { kind: 'routine'; id?: string; weekday?: number }
  | { kind: 'goal'; id?: string; period?: GoalPeriod }
  | { kind: 'habit'; id?: string }
  | { kind: 'run'; id?: string; date?: ISODate }
  | { kind: 'program'; id?: string }
  | { kind: 'item' }
  | { kind: 'finish-session' }
  | { kind: 'settings' }
  | { kind: 'account' };

const STORAGE_KEY = 'cadence.data.v1';

/** Set once the smoked-glass look became the default (30/10/2026): until then every device was on « day ». */
const LOOK_KEY = 'cadence.look';

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && parsed.version === 1) {
        let d = { ...emptyData(), ...parsed };
        // Once per device: the new look, whatever the theme was (« day » was everyone's default, rarely a choice).
        if (localStorage.getItem(LOOK_KEY) !== 'verre') {
          d = { ...d, settings: { ...d.settings, theme: 'night' } };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
          localStorage.setItem(LOOK_KEY, 'verre');
        }
        return d.onboarded ? normalizeData(d) : d;
      }
    }
    localStorage.setItem(LOOK_KEY, 'verre');
  } catch {
    // corrupted or blocked storage: start fresh (the household's data comes back from the server)
  }
  return emptyData();
}

interface UiState {
  view: View;
  weekOffset: number;
  weekMode: 'agenda' | 'type';
  sportView: 'salle' | 'running';
  programId: string | null;
  goalPeriod: GoalPeriod;
  /** person filter of the screens (member id), null = everyone */
  person: string | null;
  dialog: DialogState | null;
  toasts: ToastItem[];
  rest: { endsAt: number; total: number; label: string } | null;
}

interface Actions {
  navigate: (view: View) => void;
  set: (patch: Partial<UiState>) => void;
  openDialog: (d: DialogState) => void;
  closeDialog: () => void;
  toast: (t: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  /** Replaces the data, keeping a snapshot for « Annuler ». */
  mutate: (fn: (d: AppData) => AppData) => void;
  undoable: (title: string, fn: (d: AppData) => AppData) => void;

  start: (mode: StartMode, name: string) => void;
  /** Forgets this device's copy of the data (sign-out). The theme stays. */
  reset: () => void;
  ensureWeek: (monday: ISODate) => void;
  setTheme: (theme: ThemeName) => void;
  /** This person's background photo (kept on their member: their other devices follow). */
  setBackdrop: (id: BackdropId) => void;
  /** How clear this person's glass is, 0 … 100 (on their member, like the photo). */
  setGlass: (level: number) => void;
  /** the household's icon for a tab (null = the default one) */
  setTabIcon: (tab: View, icon: string | null) => void;
  setName: (name: string) => void;
  saveMember: (m: Member) => void;
  addMember: (name: string) => string;
  removeMember: (id: string) => void;
  importData: (json: string) => boolean;

  saveTask: (t: Omit<Task, 'id' | 'done'> & { id?: string }) => void;
  toggleTask: (id: string) => void;
  moveTask: (id: string, date: ISODate) => void;
  deleteTask: (id: string) => void;

  saveRoutine: (r: Omit<Routine, 'id'> & { id?: string }) => void;
  moveRoutine: (id: string, weekday: number) => void;
  deleteRoutine: (id: string) => void;

  saveProgram: (p: Program) => void;
  deleteProgram: (id: string) => void;
  startSession: (programId: string) => void;
  updateSet: (ex: number, set: number, patch: { reps?: number; weight?: number }) => void;
  toggleSet: (ex: number, set: number) => void;
  addSet: (ex: number) => void;
  finishSession: (keepLoads: boolean) => void;
  cancelSession: () => void;

  saveRun: (r: Omit<Run, 'id'> & { id?: string }) => void;
  deleteRun: (id: string) => void;

  saveGoal: (g: Omit<Goal, 'id'> & { id?: string }) => void;
  deleteGoal: (id: string) => void;
  bumpGoal: (id: string, delta: number) => void;
  toggleGoalStep: (goalId: string, stepId: string) => void;

  saveHabit: (h: Omit<Habit, 'id' | 'checks'> & { id?: string }) => void;
  deleteHabit: (id: string) => void;
  /** `who`: whose tick (a habit for several people has one per person). */
  toggleHabit: (id: string, date: ISODate, who: string) => void;

  addList: (name: string) => void;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  setActiveList: (id: string) => void;
  addItem: (name: string, qty?: string, rayon?: RayonId) => void;
  updateItem: (id: string, patch: Partial<Omit<ShopItem, 'id'>>) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  /** forget a frequent item (key = normalized name) */
  removeFrequent: (key: string) => void;
  clearChecked: () => void;
}

export type AppState = UiState & { data: AppData } & Actions;

/** Ticks the first unticked task of a category on a date (link from Sport / Courses to the agenda). */
function tickFirst(tasks: Task[], date: ISODate, category: CategoryId, programId?: string): { tasks: Task[]; ticked: Task | null } {
  const candidates = tasks.filter((t) => t.date === date && t.category === category && !t.done);
  const hit = candidates.find((t) => programId && t.programId === programId) ?? candidates[0];
  if (!hit) return { tasks, ticked: null };
  return { tasks: tasks.map((t) => (t.id === hit.id ? { ...t, done: true } : t)), ticked: hit };
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.date === b.date ? (a.time ?? '99:99').localeCompare(b.time ?? '99:99') : a.date.localeCompare(b.date)));
}

export const useApp = create<AppState>()((set, get) => {
  const data = load();
  const mutate = (fn: (d: AppData) => AppData) => set((s) => ({ data: fn(s.data) }));
  const toast: Actions['toast'] = (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
  };
  const undoable: Actions['undoable'] = (title, fn) => {
    const before = get().data;
    mutate(fn);
    toast({ tone: 'info', title, action: { label: 'Annuler', onClick: () => set({ data: before }) } });
  };
  const activeList = (d: AppData) => d.lists.find((l) => l.id === d.activeListId) ?? d.lists[0];
  const mapActiveList = (d: AppData, fn: (items: ShopItem[]) => ShopItem[]): AppData => {
    const list = activeList(d);
    if (!list) return d;
    return { ...d, lists: d.lists.map((l) => (l.id === list.id ? { ...l, items: fn(l.items) } : l)) };
  };

  return {
    data,
    view: 'today',
    weekOffset: 0,
    weekMode: 'agenda',
    sportView: 'salle',
    programId: data.programs[0]?.id ?? null,
    goalPeriod: 'semaine',
    person: data.members.length > 1 ? (data.settings.meId ?? null) : null,
    dialog: null,
    toasts: [],
    rest: null,

    navigate: (view) => set({ view }),
    set: (patch) => set(patch),
    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),
    toast,
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    mutate,
    undoable,

    start: (mode, name) => {
      const prev = get().data;
      let d = mode === 'exemple' ? exampleData(name) : mode === 'vide' ? blankData(name) : modelData(name);
      if (mode === 'modele') {
        const monday = weekStart(todayIso());
        d.tasks = tasksFromRoutines(d.routines, monday, todayIso());
        d.generatedWeeks = [monday];
      }
      // Starting again in a household: same people (their accounts stay linked), this device's person keeps « moi ».
      d = keepPeople(d, prev.members, prev.settings.meId);
      d = { ...d, settings: { ...d.settings, theme: prev.settings.theme } };
      set({ data: d, dialog: null, view: 'today', programId: d.programs[0]?.id ?? null, person: d.members.length > 1 ? (d.settings.meId ?? null) : null });
    },

    reset: () => {
      const theme = get().data.settings.theme;
      const d = emptyData();
      set({ data: { ...d, settings: { ...d.settings, theme } }, view: 'today', dialog: null, person: null, programId: null, rest: null, toasts: [] });
      // Gone from the device at once (not after the usual short delay): the tab may be closed right after.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // blocked storage holds nothing
      }
    },

    ensureWeek: (monday) => {
      const d = get().data;
      if (!d.onboarded || d.generatedWeeks.includes(monday) || monday < weekStart(todayIso())) return;
      mutate((x) => ({ ...x, tasks: sortTasks([...x.tasks, ...tasksFromRoutines(x.routines, monday)]), generatedWeeks: [...x.generatedWeeks, monday] }));
    },

    setTheme: (theme) => mutate((d) => ({ ...d, settings: { ...d.settings, theme } })),
    setBackdrop: (id) => mutate((d) => ({ ...d, members: d.members.map((m) => (m.id === d.settings.meId ? { ...m, backdrop: id } : m)) })),
    setGlass: (level) => mutate((d) => ({ ...d, members: d.members.map((m) => (m.id === d.settings.meId ? { ...m, glass: Math.round(Math.max(0, Math.min(100, level))) } : m)) })),
    setTabIcon: (tab, icon) =>
      mutate((d) => {
        const tabIcons = { ...d.prefs?.tabIcons };
        if (icon) tabIcons[tab] = icon;
        else delete tabIcons[tab];
        return { ...d, prefs: { ...d.prefs, tabIcons } };
      }),
    setName: (name) => mutate((d) => ({ ...d, settings: { ...d.settings, name }, members: d.members.map((m) => (m.id === d.settings.meId ? { ...m, name: name.trim() || m.name } : m)) })),
    saveMember: (m) => mutate((d) => ({ ...d, members: d.members.map((x) => (x.id === m.id ? m : x)), settings: m.id === d.settings.meId ? { ...d.settings, name: m.name } : d.settings })),
    addMember: (name) => {
      const m = newMember(name, get().data.members);
      mutate((d) => ({ ...d, members: [...d.members, m] }));
      return m.id;
    },
    removeMember: (id) => {
      const m = get().data.members.find((x) => x.id === id);
      if (!m || id === get().data.settings.meId) return;
      if (get().person === id) set({ person: null });
      // What was theirs goes back to the household.
      undoable(`${m.name} retiré du foyer`, (d) => ({
        ...d,
        members: d.members.filter((x) => x.id !== id),
        tasks: d.tasks.map((t) => (t.assignee === id ? { ...t, assignee: NOUS } : t)),
        routines: d.routines.map((r) => (r.assignee === id ? { ...r, assignee: NOUS } : r)),
      }));
    },
    importData: (json) => {
      try {
        const parsed = JSON.parse(json) as AppData;
        if (parsed?.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.lists)) return false;
        set({ data: normalizeData({ ...emptyData(), ...parsed, onboarded: true }) });
        return true;
      } catch {
        return false;
      }
    },

    // ── Agenda
    saveTask: (t) =>
      mutate((d) => {
        if (t.id) return { ...d, tasks: sortTasks(d.tasks.map((x) => (x.id === t.id ? { ...x, ...t, id: x.id } : x))) };
        return { ...d, tasks: sortTasks([...d.tasks, { ...t, id: uid(), done: false }]) };
      }),
    toggleTask: (id) => mutate((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
    moveTask: (id, date) => mutate((d) => ({ ...d, tasks: sortTasks(d.tasks.map((t) => (t.id === id ? { ...t, date } : t))) })),
    deleteTask: (id) => {
      const t = get().data.tasks.find((x) => x.id === id);
      undoable(`« ${t?.title ?? 'Tâche'} » supprimée`, (d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }));
    },

    // ── Semaine type: the future, unticked tasks of a routine follow it.
    saveRoutine: (r) =>
      mutate((d) => {
        const today = todayIso();
        if (r.id) {
          const routines = d.routines.map((x) => (x.id === r.id ? { ...x, ...r, id: x.id } : x));
          const tasks = d.tasks.map((t) => {
            if (t.routineId !== r.id || t.done || t.date < today) return t;
            const date = addDays(weekStart(t.date), r.weekday);
            return { ...t, title: r.title, category: r.category, time: r.time, durationMin: r.durationMin, programId: r.programId, date: date < today ? t.date : date };
          });
          return { ...d, routines, tasks: sortTasks(tasks) };
        }
        const routine: Routine = { ...r, id: uid() };
        const added = d.generatedWeeks.flatMap((monday) => tasksFromRoutines([routine], monday, today));
        return { ...d, routines: [...d.routines, routine], tasks: sortTasks([...d.tasks, ...added]) };
      }),
    moveRoutine: (id, weekday) => {
      const r = get().data.routines.find((x) => x.id === id);
      if (r) get().saveRoutine({ ...r, weekday });
    },
    deleteRoutine: (id) => {
      const r = get().data.routines.find((x) => x.id === id);
      const today = todayIso();
      undoable(`« ${r?.title ?? 'Routine'} » retirée de la semaine type`, (d) => ({
        ...d,
        routines: d.routines.filter((x) => x.id !== id),
        tasks: d.tasks.filter((t) => !(t.routineId === id && !t.done && t.date >= today)),
      }));
    },

    // ── Salle
    saveProgram: (p) =>
      mutate((d) => ({ ...d, programs: d.programs.some((x) => x.id === p.id) ? d.programs.map((x) => (x.id === p.id ? p : x)) : [...d.programs, { ...p, owner: p.owner ?? d.settings.meId }] })),
    deleteProgram: (id) => {
      const p = get().data.programs.find((x) => x.id === id);
      undoable(`Programme « ${p?.name ?? ''} » supprimé`, (d) => ({ ...d, programs: d.programs.filter((x) => x.id !== id) }));
      const next = get().data.programs[0]?.id ?? null;
      set({ programId: next });
    },
    startSession: (programId) => {
      const p = get().data.programs.find((x) => x.id === programId);
      if (!p || get().data.active) return;
      mutate((d) => ({
        ...d,
        active: {
          programId: p.id,
          programName: p.name,
          date: todayIso(),
          startedAt: Date.now(),
          exercises: p.exercises.map((e) => ({ exerciseId: e.id, name: e.name, restSec: e.restSec, sets: Array.from({ length: e.sets }, () => ({ reps: e.reps, weight: e.weight, done: false })) })),
        },
      }));
      set({ view: 'sport', sportView: 'salle', programId: p.id });
    },
    updateSet: (ei, si, patch) =>
      mutate((d) => {
        if (!d.active) return d;
        const exercises = d.active.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }));
        return { ...d, active: { ...d.active, exercises } };
      }),
    toggleSet: (ei, si) => {
      const a = get().data.active;
      const ex = a?.exercises[ei];
      const set0 = ex?.sets[si];
      if (!a || !ex || !set0) return;
      mutate((d) => {
        if (!d.active) return d;
        const exercises = d.active.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, done: !s.done } : s)) }));
        return { ...d, active: { ...d.active, exercises } };
      });
      // A set just done starts the rest timer (not after the very last set of the session).
      const last = ei === a.exercises.length - 1 && si === ex.sets.length - 1;
      if (!set0.done && !last && ex.restSec > 0) set({ rest: { endsAt: Date.now() + ex.restSec * 1000, total: ex.restSec, label: ex.name } });
      if (set0.done) set({ rest: null });
    },
    addSet: (ei) =>
      mutate((d) => {
        if (!d.active) return d;
        const exercises = d.active.exercises.map((e, i) => {
          if (i !== ei) return e;
          const last = e.sets[e.sets.length - 1] ?? { reps: 10, weight: 0, done: false };
          return { ...e, sets: [...e.sets, { reps: last.reps, weight: last.weight, done: false }] };
        });
        return { ...d, active: { ...d.active, exercises } };
      }),
    finishSession: (keepLoads) => {
      const a = get().data.active;
      if (!a) return;
      let ticked: Task | null = null;
      mutate((d) => {
        const session = { ...a, id: uid(), endedAt: Date.now(), owner: d.settings.meId };
        const programs = keepLoads
          ? d.programs.map((p) =>
              p.id !== a.programId
                ? p
                : {
                    ...p,
                    exercises: p.exercises.map((e) => {
                      const log = a.exercises.find((x) => x.exerciseId === e.id);
                      const done = log?.sets.filter((s) => s.done) ?? [];
                      const top = done[done.length - 1];
                      return top ? { ...e, weight: top.weight, reps: top.reps } : e;
                    }),
                  },
            )
          : d.programs;
        const linked = tickFirst(d.tasks, a.date, 'sport', a.programId);
        ticked = linked.ticked;
        return { ...d, active: null, sessions: [...d.sessions, session], programs, tasks: linked.tasks };
      });
      set({ rest: null, dialog: null });
      toast({ tone: 'success', title: `Séance ${a.programName} enregistrée`, text: ticked ? `« ${(ticked as Task).title} » est cochée dans l'agenda.` : undefined });
    },
    cancelSession: () => {
      const before = get().data;
      mutate((d) => ({ ...d, active: null }));
      set({ rest: null });
      toast({ tone: 'info', title: 'Séance abandonnée', action: { label: 'Annuler', onClick: () => set({ data: before }) } });
    },

    // ── Running
    saveRun: (r) => {
      let ticked: Task | null = null;
      mutate((d) => {
        if (r.id) return { ...d, runs: d.runs.map((x) => (x.id === r.id ? { ...x, ...r, id: x.id } : x)) };
        const linked = tickFirst(d.tasks, r.date, 'running');
        ticked = linked.ticked;
        return { ...d, runs: [...d.runs, { ...r, id: uid(), owner: r.owner ?? d.settings.meId }].sort((a, b) => a.date.localeCompare(b.date)), tasks: linked.tasks };
      });
      if (!r.id) toast({ tone: 'success', title: 'Sortie enregistrée', text: ticked ? `« ${(ticked as Task).title} » est cochée dans l'agenda.` : undefined });
    },
    deleteRun: (id) => undoable('Sortie supprimée', (d) => ({ ...d, runs: d.runs.filter((x) => x.id !== id) })),

    // ── Objectifs
    saveGoal: (g) =>
      mutate((d) => {
        if (g.id) return { ...d, goals: d.goals.map((x) => (x.id === g.id ? { ...x, ...g, id: x.id } : x)) };
        return { ...d, goals: [...d.goals, { ...g, id: uid(), owner: g.owner ?? d.settings.meId }] };
      }),
    deleteGoal: (id) => {
      const g = get().data.goals.find((x) => x.id === id);
      undoable(`Objectif « ${g?.title ?? ''} » supprimé`, (d) => ({ ...d, goals: d.goals.filter((x) => x.id !== id) }));
    },
    bumpGoal: (id, delta) => mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, value: Math.max(0, g.value + delta) } : g)) })),
    toggleGoalStep: (goalId, stepId) =>
      mutate((d) => ({ ...d, goals: d.goals.map((g) => (g.id !== goalId ? g : { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) })) })),

    saveHabit: (h) =>
      mutate((d) => {
        const { id, owner = d.settings.meId ?? NOUS, owners, ...rest } = h;
        if (id) return { ...d, habits: d.habits.map((x) => (x.id === id ? { ...withHabitPeople(x, owner, owners), ...rest } : x)) };
        return { ...d, habits: [...d.habits, { ...rest, id: uid(), checks: [], owner, owners }] };
      }),
    deleteHabit: (id) => {
      const h = get().data.habits.find((x) => x.id === id);
      undoable(`Habitude « ${h?.title ?? ''} » supprimée`, (d) => ({ ...d, habits: d.habits.filter((x) => x.id !== id) }));
    },
    toggleHabit: (id, date, who) => mutate((d) => ({ ...d, habits: d.habits.map((h) => (h.id !== id ? h : withHabitCheck(h, date, who))) })),

    // ── Courses
    addList: (name) => {
      const id = uid();
      mutate((d) => ({ ...d, lists: [...d.lists, { id, name, items: [] }], activeListId: id }));
    },
    renameList: (id, name) => mutate((d) => ({ ...d, lists: d.lists.map((l) => (l.id === id ? { ...l, name } : l)) })),
    deleteList: (id) => {
      const l = get().data.lists.find((x) => x.id === id);
      undoable(`Liste « ${l?.name ?? ''} » supprimée`, (d) => {
        const lists = d.lists.filter((x) => x.id !== id);
        return { ...d, lists, activeListId: d.activeListId === id ? (lists[0]?.id ?? null) : d.activeListId };
      });
    },
    setActiveList: (id) => mutate((d) => ({ ...d, activeListId: id })),
    addItem: (name, qty, rayon) => {
      const clean = name.trim();
      if (!clean) return;
      mutate((d) => {
        let target = d;
        if (!activeList(d)) {
          const id = uid();
          target = { ...d, lists: [{ id, name: 'Supermarché', items: [] }], activeListId: id };
        }
        const key = normalize(clean);
        const known = target.frequent[key];
        const r = rayon ?? known?.rayon ?? guessRayon(clean);
        const existing = activeList(target)!.items.find((i) => normalize(i.name) === key);
        const withItem = mapActiveList(target, (items) =>
          existing ? items.map((i) => (i.id === existing.id ? { ...i, checked: false, qty: qty || i.qty } : i)) : [...items, { id: uid(), name: clean, qty: qty || undefined, rayon: r, checked: false }],
        );
        return { ...withItem, frequent: { ...target.frequent, [key]: { name: known?.name ?? clean, rayon: r, count: (known?.count ?? 0) + 1 } } };
      });
    },
    updateItem: (id, patch) =>
      mutate((d) => {
        const next = mapActiveList(d, (items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
        if (patch.rayon) {
          const it = activeList(next)?.items.find((i) => i.id === id);
          if (it) {
            const key = normalize(it.name);
            const known = next.frequent[key];
            return { ...next, frequent: { ...next.frequent, [key]: { name: known?.name ?? it.name, count: known?.count ?? 1, rayon: patch.rayon } } };
          }
        }
        return next;
      }),
    toggleItem: (id) => {
      mutate((d) => mapActiveList(d, (items) => items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))));
      const list = activeList(get().data);
      if (list && list.items.length > 0 && list.items.every((i) => i.checked)) {
        let ticked: Task | null = null;
        mutate((d) => {
          const linked = tickFirst(d.tasks, todayIso(), 'courses');
          ticked = linked.ticked;
          return { ...d, tasks: linked.tasks };
        });
        toast({ tone: 'success', title: `Liste « ${list.name} » terminée`, text: ticked ? `« ${(ticked as Task).title} » est cochée dans l'agenda.` : undefined });
      }
    },
    deleteItem: (id) => mutate((d) => mapActiveList(d, (items) => items.filter((i) => i.id !== id))),
    removeFrequent: (key) => {
      const f = get().data.frequent[key];
      if (!f) return;
      undoable(`« ${f.name} » retiré des articles fréquents`, (d) => {
        const frequent = { ...d.frequent };
        delete frequent[key];
        return { ...d, frequent };
      });
    },
    clearChecked: () => {
      const n = activeList(get().data)?.items.filter((i) => i.checked).length ?? 0;
      if (n) undoable(`${n} article${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''} de la liste`, (d) => mapActiveList(d, (items) => items.filter((i) => !i.checked)));
    },
  };
});

// Saved shortly after every change.
let saveTimer = 0;
useApp.subscribe((s, prev) => {
  if (s.data === prev.data) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s.data));
    } catch {
      useApp.getState().toast({ tone: 'danger', title: 'Sauvegarde impossible', text: "Le stockage local est plein ou bloqué. Exporte tes données depuis les paramètres." });
    }
  }, 250);
});
window.addEventListener('beforeunload', () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(useApp.getState().data));
  } catch {
    // nothing more to do while closing
  }
});

/** Today's weekday helper for screens. */
export const todayIndex = () => weekdayIndex(todayIso());

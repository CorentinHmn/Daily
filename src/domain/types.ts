import type { ISODate } from '../lib/dates';

/** A person of the household (« foyer »). Each device knows which one it is (Settings.meId). */
export type MemberHue = 'warm' | 'violet' | 'green' | 'blue';
export interface Member {
  id: string;
  name: string;
  hue: MemberHue;
  /** profile photo: a small square JPEG as a data URL (synced with the member, no file storage) */
  photo?: string;
}
/** Assignee meaning « the whole household ». */
export const NOUS = 'nous';

/** Kinds of « grandes tâches » of the week (icon + label in categories.ts). */
export type CategoryId = 'perso' | 'sport' | 'running' | 'menage' | 'courses' | 'lessive' | 'cuisine' | 'admin' | 'rdv' | 'bienetre';

/** A task of the agenda, on one day. Tasks made from the semaine type keep the id of their routine. */
export interface Task {
  id: string;
  title: string;
  category: CategoryId;
  date: ISODate;
  /** « 18:30 », optional */
  time?: string;
  durationMin?: number;
  done: boolean;
  routineId?: string;
  /** gym tasks: the programme to start */
  programId?: string;
  note?: string;
  /** who does it: a member id, or NOUS / undefined = the household */
  assignee?: string;
}

/** A line of the semaine type: every week, the same task on the same weekday (0 = lundi). */
export interface Routine {
  id: string;
  title: string;
  category: CategoryId;
  weekday: number;
  time?: string;
  durationMin?: number;
  programId?: string;
  assignee?: string;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets: number;
  reps: number;
  /** kg, 0 = poids du corps */
  weight: number;
  restSec: number;
}

export interface Program {
  id: string;
  name: string;
  exercises: ExerciseTemplate[];
  owner?: string;
}

export interface SetLog {
  reps: number;
  weight: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  restSec: number;
  sets: SetLog[];
}

export interface GymSession {
  id: string;
  programId: string;
  programName: string;
  date: ISODate;
  startedAt: number;
  endedAt: number;
  exercises: ExerciseLog[];
  owner?: string;
}

/** The session in progress (kept when the app is closed). */
export interface ActiveSession {
  programId: string;
  programName: string;
  date: ISODate;
  startedAt: number;
  exercises: ExerciseLog[];
}

export interface Run {
  id: string;
  date: ISODate;
  distanceKm: number;
  durationMin: number;
  /** 1 (dur) … 5 (facile) */
  feeling?: number;
  note?: string;
  owner?: string;
}

export type GoalPeriod = 'semaine' | 'mois' | 'annee';
/** auto = computed from the app (séances, km…), compteur = +1 by hand, liste = sub-steps to tick. */
export type GoalKind = 'auto' | 'compteur' | 'liste';
export type GoalSource = 'seances' | 'km' | 'sorties' | 'taches';
export type GoalIcon = 'target' | 'dumbbell' | 'footprints' | 'book' | 'home' | 'trophy' | 'heart' | 'wallet' | 'sprout' | 'mountain';

export interface GoalStep {
  id: string;
  label: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  period: GoalPeriod;
  kind: GoalKind;
  source?: GoalSource;
  target: number;
  value: number;
  steps: GoalStep[];
  icon: GoalIcon;
  /** a member id, or NOUS for a shared goal */
  owner?: string;
  /** several people (not the whole household): their ids; `owner` is then NOUS */
  owners?: string[];
}

export type HabitIcon = 'droplets' | 'stretch' | 'moon' | 'leaf' | 'book' | 'brain' | 'sun' | 'pill' | 'phone' | 'walk';

export interface Habit {
  id: string;
  title: string;
  icon: HabitIcon;
  /** weekdays when it applies (0 = lundi) */
  days: number[];
  /** dates when it was done */
  checks: ISODate[];
  owner?: string;
}

export type RayonId = 'fruits' | 'boulangerie' | 'frais' | 'viandes' | 'epicerie' | 'surgeles' | 'boissons' | 'hygiene' | 'maison' | 'autre';

export interface ShopItem {
  id: string;
  name: string;
  qty?: string;
  rayon: RayonId;
  checked: boolean;
}

export interface ShopList {
  id: string;
  name: string;
  items: ShopItem[];
}

export interface FrequentItem {
  name: string;
  rayon: RayonId;
  count: number;
}

export type ThemeName = 'day' | 'night';

export interface Settings {
  name: string;
  theme: ThemeName;
  /** the member this device belongs to (never synced) */
  meId?: string;
}

export interface AppData {
  version: 1;
  onboarded: boolean;
  settings: Settings;
  members: Member[];
  tasks: Task[];
  routines: Routine[];
  /** Mondays of the weeks already filled from the semaine type */
  generatedWeeks: ISODate[];
  programs: Program[];
  sessions: GymSession[];
  active: ActiveSession | null;
  runs: Run[];
  goals: Goal[];
  habits: Habit[];
  lists: ShopList[];
  activeListId: string | null;
  frequent: Record<string, FrequentItem>;
}

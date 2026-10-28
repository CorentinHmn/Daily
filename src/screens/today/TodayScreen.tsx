/**
 * Aujourd'hui: the day at a glance. KPI row (label + value), the day's tasks and habits, the next gym session
 * (NotchCard, the only one of the screen), the week at a glance with its « grandes tâches », the shopping list and
 * the goals of the moment.
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Dumbbell, ListChecks, Plus, ShoppingCart, Target } from 'lucide-react';
import { useApp } from '../../store/app';
import { CATEGORIES, CATEGORY_ORDER, GOAL_ICONS, HABIT_ICONS, guessCategory } from '../../domain/catalog';
import { goalProgress, goalStatus, habitDueOn, kmIn, nextGymSession, sessionsIn } from '../../domain/stats';
import type { Habit, Task } from '../../domain/types';
import { concerns, ownedBy } from '../../domain/people';
import { DAY_SHORT, addDays, capitalize, fromIso, longDate, relativeDay, todayIso, weekDays, weekStart } from '../../lib/dates';
import { kg, num } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, EmptyState, ICON_STROKE, IconBox, Panel, PanelHeader, ProgressBar } from '../../ui/atoms';
import { KpiCard } from '../../ui/charts';
import { NotchCard } from '../../ui/notch';
import { TextInput } from '../../ui/forms';
import { revealVariants } from '../../theme/motion';
import { PageHeader } from '../shell/PageHeader';
import { TaskRow } from '../common/TaskRow';

export function TodayScreen() {
  const data = useApp((s) => s.data);
  const person = useApp((s) => s.person);
  const today = todayIso();
  const monday = weekStart(today);
  const week = { from: monday, to: addDays(monday, 6) };
  const mine = data.tasks.filter((t) => concerns(t.assignee, person));
  const tasks = mine.filter((t) => t.date === today).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  const overdue = mine.filter((t) => !t.done && t.date < today && t.date >= monday);
  const habits = data.habits.filter((h) => habitDueOn(h, today) && ownedBy(h.owner, person));
  const habitsDone = habits.filter((h) => h.checks.includes(today)).length;
  const sessions = sessionsIn(data.sessions.filter((x) => ownedBy(x.owner, person)), week).length;
  const sessionGoal = data.goals.find((g) => g.kind === 'auto' && g.source === 'seances' && g.period === 'semaine' && ownedBy(g.owner, person))?.target ?? mine.filter((t) => t.category === 'sport' && t.date >= week.from && t.date <= week.to).length;
  const reveal = revealVariants();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Aujourd'hui" />
      <motion.div initial="hidden" animate="show" className="grid shrink-0 grid-cols-4 gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:gap-3 max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none]">
        {[
          <KpiCard key="t" label="Tâches du jour" value={tasks.filter((t) => t.done).length} of={tasks.length} active />,
          <KpiCard key="h" label="Habitudes du jour" value={habitsDone} of={habits.length} />,
          <KpiCard key="s" label="Séances cette semaine" value={sessions} of={sessionGoal || undefined} onClick={() => useApp.getState().set({ view: 'sport', sportView: 'salle' })} />,
          <KpiCard key="r" label="Course à pied cette semaine" value={Math.round(kmIn(data.runs.filter((x) => ownedBy(x.owner, person)), week) * 10) / 10} decimals={1} suffix="km" onClick={() => useApp.getState().set({ view: 'sport', sportView: 'running' })} />,
        ].map((card, i) => (
          <motion.div key={i} variants={reveal} custom={i} className="flex min-w-0 flex-col max-md:w-[44%] max-md:shrink-0 max-md:snap-start [&>*]:flex-1">
            {card}
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,380px)_minmax(0,330px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} custom={2} className="flex min-h-0 flex-col">
          <DayPanel tasks={tasks} overdue={overdue} habits={habits} />
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={3} className="flex min-h-0 flex-col gap-4">
          <NextSession />
          <WeekGlance />
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={4} className="flex min-h-0 flex-col gap-4">
          <ShoppingGlance />
          <GoalsGlance />
        </motion.div>
      </div>
    </div>
  );
}

function DayPanel({ tasks, overdue, habits }: { tasks: Task[]; overdue: Task[]; habits: Habit[] }) {
  const today = todayIso();
  const [draft, setDraft] = useState('');
  const app = useApp.getState();
  const done = tasks.filter((t) => t.done).length;
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    app.saveTask({ title, category: guessCategory(title), date: today });
    setDraft('');
  };
  return (
    <Panel className="flex-1">
      <PanelHeader title={capitalize(longDate(today))} icon={ListChecks} count={tasks.length ? `${done} / ${tasks.length}` : undefined}>
        <Button variant="ghost" size="s" icon={Plus} aria-label="Nouvelle tâche" onClick={() => app.openDialog({ kind: 'task', date: today })}>
          <span className="max-md:hidden">Tâche</span>
        </Button>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-2">
        {tasks.length === 0 && overdue.length === 0 ? (
          <EmptyState icon={Check} title="Rien de prévu aujourd'hui" text="Ajoute une tâche ci-dessous, ou prépare ta semaine type dans Semaine." />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {tasks.map((t) => (
              <li key={t.id}>
                <TaskRow task={t} />
              </li>
            ))}
          </ul>
        )}
        {overdue.length > 0 && (
          <div className="mt-3">
            <p className="px-2.5 pb-1 text-label-s text-text-warn">À rattraper cette semaine</p>
            <ul className="flex flex-col gap-0.5">
              {overdue.map((t) => (
                <li key={t.id}>
                  <TaskRow task={t} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {habits.length > 0 && (
          <div className="mt-4 border-t border-border-subtle px-2.5 pt-4">
            <p className="mb-2.5 text-label-m text-text-primary">Habitudes</p>
            <div className="flex flex-wrap gap-2">
              {habits.map((h) => {
                const on = h.checks.includes(today);
                const Icon = HABIT_ICONS[h.icon].icon;
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => app.toggleHabit(h.id, today)}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-1.5 text-label-s transition-[background-color,border-color,color] duration-(--v-duree-courte)',
                      on ? 'border-signal-default/40 bg-signal-soft text-text-signal' : 'border-border-default bg-bg-card/70 text-text-secondary hover:border-border-strong hover:text-text-primary',
                    )}
                  >
                    <span className={cn('inline-flex size-7 items-center justify-center rounded-full transition-colors', on ? 'bg-signal-default text-text-on-accent' : 'bg-bg-raised text-text-secondary')}>
                      {on ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Icon size={14} strokeWidth={ICON_STROKE} aria-hidden />}
                    </span>
                    {h.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border-subtle p-3">
        <TextInput
          icon={Plus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Ajouter une tâche pour aujourd'hui"
          aria-label="Nouvelle tâche pour aujourd'hui"
        />
      </div>
    </Panel>
  );
}

/** Next gym session of the agenda (or the session in progress), in the NotchCard. */
function NextSession() {
  const data = useApp((s) => s.data);
  const app = useApp.getState();
  const today = todayIso();
  const person = useApp((s) => s.person);
  const next = nextGymSession(data, today, person);
  const program = data.programs.find((p) => p.id === (data.active ? data.active.programId : next?.programId));
  const go = () => app.set({ view: 'sport', sportView: 'salle', programId: program?.id ?? app.programId });

  if (!program) {
    return (
      <NotchCard onAction={go} actionLabel="Ouvrir Sport" className="h-[300px] shrink-0">
        <EmptyState icon={Dumbbell} title="Aucune séance prévue" text="Ajoute une séance de salle à ta semaine type pour la voir ici." className="h-full" />
      </NotchCard>
    );
  }
  const when = data.active ? 'En cours' : next ? `${capitalize(relativeDay(next.date))}${next.time ? ` à ${next.time}` : ''}` : '';
  const volume = program.exercises.reduce((s, e) => s + e.sets * e.reps * e.weight, 0);
  return (
    <NotchCard onAction={go} actionLabel={`Ouvrir la séance ${program.name}`} className="h-[300px] shrink-0">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center gap-3 pr-12">
          <IconBox icon={Dumbbell} tone={data.active ? 'accent' : 'soft'} size="l" />
          <div className="min-w-0">
            <p className="truncate text-title-l text-text-primary">{program.name}</p>
            <p className={cn('text-label-s', data.active ? 'text-text-accent' : 'text-text-secondary')}>{when}</p>
          </div>
        </div>
        <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {program.exercises.slice(0, 4).map((e) => (
            <li key={e.id} className="inset-tile flex items-center gap-3 rounded-md px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-body-s text-text-primary">{e.name}</span>
              <span className="tnum text-label-s text-text-secondary">
                {e.sets} × {e.reps}
              </span>
              <span className="tnum w-14 text-right text-label-s text-text-primary">{e.weight ? kg(e.weight) : 'PDC'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-caption text-text-secondary">
            {program.exercises.length} exercices, {kg(volume)} soulevés
          </span>
          {data.active ? (
            <Button size="s" icon={ArrowRight} onClick={go}>
              Reprendre
            </Button>
          ) : (
            <Button size="s" onClick={() => app.startSession(program.id)}>
              Démarrer
            </Button>
          )}
        </div>
      </div>
    </NotchCard>
  );
}

/** The week at a glance: 7 days with their progress, and the « grandes tâches » (categories) ticked / planned. */
function WeekGlance() {
  const all = useApp((s) => s.data.tasks);
  const person = useApp((s) => s.person);
  const tasks = all.filter((t) => concerns(t.assignee, person));
  const today = todayIso();
  const monday = weekStart(today);
  const days = weekDays(monday);
  const weekTasks = tasks.filter((t) => t.date >= monday && t.date <= days[6]!);
  const big = useMemo(
    () =>
      CATEGORY_ORDER.filter((c) => c !== 'perso' && c !== 'rdv')
        .map((c) => ({ c, total: weekTasks.filter((t) => t.category === c).length, done: weekTasks.filter((t) => t.category === c && t.done).length }))
        .filter((x) => x.total > 0),
    [weekTasks],
  );
  const app = useApp.getState();
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Ma semaine">
        <Button variant="ghost" size="s" trailingIcon={ArrowRight} onClick={() => app.set({ view: 'week', weekOffset: 0, weekMode: 'agenda' })}>
          Agenda
        </Button>
      </PanelHeader>
      <div className="grid grid-cols-7 gap-1.5 px-4 pt-2">
        {days.map((d, i) => {
          const list = weekTasks.filter((t) => t.date === d);
          const ratio = list.length ? list.filter((t) => t.done).length / list.length : 0;
          const isToday = d === today;
          return (
            <button key={d} type="button" onClick={() => app.set({ view: 'week', weekOffset: 0, weekMode: 'agenda' })} className="group/day flex flex-col items-center gap-1.5" title={`${DAY_SHORT[i]} ${fromIso(d).getDate()} : ${list.filter((t) => t.done).length} / ${list.length}`}>
              <span className={cn('relative flex h-16 w-full max-w-9 items-end overflow-hidden rounded-full border', isToday ? 'border-border-accent bg-accent-soft' : 'border-border-subtle bg-bg-card/60')}>
                <motion.span className={cn('w-full rounded-full', ratio >= 1 ? 'bg-signal-default' : isToday ? 'bg-accent-default' : 'bg-route-rest/60')} initial={{ height: 0 }} animate={{ height: `${Math.max(list.length ? 8 : 0, ratio * 100)}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.04, ease: [0.16, 1, 0.3, 1] }} />
              </span>
              <span className={cn('text-caption', isToday ? 'text-text-accent' : 'text-text-muted')}>{DAY_SHORT[i]}</span>
            </button>
          );
        })}
      </div>
      <ul className="mt-3 grid min-h-0 grid-cols-2 gap-1.5 overflow-y-auto px-4 pb-4">
        {big.map(({ c, done, total }) => {
          const cat = CATEGORIES[c];
          const complete = done >= total;
          return (
            <li key={c} className="inset-tile flex items-center gap-2 rounded-md px-2.5 py-1.5">
              <cat.icon size={15} strokeWidth={ICON_STROKE} aria-hidden className={complete ? 'text-text-signal' : 'text-text-secondary'} />
              <span className="min-w-0 flex-1 truncate text-label-s text-text-primary">{cat.label}</span>
              <span className={cn('tnum text-label-s', complete ? 'text-text-signal' : 'text-text-secondary')}>
                {done}/{total}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ShoppingGlance() {
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0]);
  const app = useApp.getState();
  const [draft, setDraft] = useState('');
  const todo = list?.items.filter((i) => !i.checked) ?? [];
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title={list?.name ?? 'Courses'} icon={ShoppingCart} count={list ? `${todo.length}` : undefined}>
        <Button variant="ghost" size="s" trailingIcon={ArrowRight} onClick={() => app.navigate('shopping')}>
          Liste
        </Button>
      </PanelHeader>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-1">
        {todo.length === 0 && <li className="px-2 py-3 text-body-s text-text-secondary">La liste est vide.</li>}
        {todo.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg-card/60">
            <CheckCircle checked={i.checked} onChange={() => app.toggleItem(i.id)} label={`Cocher ${i.name}`} size="s" />
            <span className="min-w-0 flex-1 truncate text-body-s text-text-primary">{i.name}</span>
            {i.qty && <span className="tnum text-caption text-text-secondary">{i.qty}</span>}
          </li>
        ))}
      </ul>
      <div className="shrink-0 p-3">
        <TextInput
          icon={Plus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              app.addItem(draft);
              setDraft('');
            }
          }}
          placeholder="Ajouter un article"
          aria-label="Ajouter un article à la liste"
        />
      </div>
    </Panel>
  );
}

function GoalsGlance() {
  const data = useApp((s) => s.data);
  const app = useApp.getState();
  const person = useApp((s) => s.person);
  const mine = data.goals.filter((g) => ownedBy(g.owner, person));
  const goals = mine
    .map((g) => ({ g, p: goalProgress(g, data) }))
    .filter(({ p }) => p.ratio < 1)
    .sort((a, b) => (a.g.period === b.g.period ? b.p.ratio - a.p.ratio : ['semaine', 'mois', 'annee'].indexOf(a.g.period) - ['semaine', 'mois', 'annee'].indexOf(b.g.period)))
    .slice(0, 3);
  return (
    <Panel className="shrink-0">
      <PanelHeader title="Objectifs" icon={Target}>
        <Button variant="ghost" size="s" trailingIcon={ArrowRight} onClick={() => app.navigate('goals')}>
          Tous
        </Button>
      </PanelHeader>
      <ul className="flex flex-col gap-3 px-5 pt-2 pb-5">
        {goals.length === 0 && <li className="text-body-s text-text-secondary">{mine.length ? 'Tous tes objectifs en cours sont atteints.' : 'Aucun objectif pour le moment.'}</li>}
        {goals.map(({ g, p }) => {
          const Icon = GOAL_ICONS[g.icon];
          const status = goalStatus(g, p.ratio);
          return (
            <li key={g.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Icon size={15} strokeWidth={ICON_STROKE} aria-hidden className="text-text-secondary" />
                <span className="min-w-0 flex-1 truncate text-label-m text-text-primary">{g.title}</span>
                <span className="tnum text-label-s text-text-secondary">
                  {num(p.value, Number.isInteger(p.value) ? 0 : 1)} / {num(p.target)}
                </span>
              </div>
              <ProgressBar value={p.ratio} tone={status === 'en-retard' ? 'warn' : 'accent'} label={g.title} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}


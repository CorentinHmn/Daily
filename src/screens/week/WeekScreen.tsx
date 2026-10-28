/**
 * Semaine: the agenda of the week (7 columns, drag & drop between days) and the semaine type that fills every new
 * week (Agenda | Semaine type in the header, Halo SegmentedControl). The strip on top shows the « grandes tâches »
 * of the week (ticked / planned per category).
 */
import { useEffect, useState, type DragEvent } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Plus, Repeat } from 'lucide-react';
import { useApp } from '../../store/app';
import { CATEGORIES, CATEGORY_ORDER } from '../../domain/catalog';
import type { Routine, Task } from '../../domain/types';
import { DAY_LONG, DAY_SHORT, addDays, capitalize, fromIso, todayIso, weekDays, weekRangeLabel, weekStart } from '../../lib/dates';
import { duration, percent } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, ICON_STROKE, IconButton, ProgressBar } from '../../ui/atoms';
import { SegmentedControl } from '../../ui/navigation';
import { revealVariants } from '../../theme/motion';
import { useIsMobile } from '../../ui/useMedia';
import { AssigneeBadge } from '../../ui/people';
import { concerns } from '../../domain/people';
import { useLiquidGlass } from '../../ui/glass';
import { usePageScroll } from '../shell/scroll';
import { PageHeader } from '../shell/PageHeader';

export function WeekScreen() {
  const mode = useApp((s) => s.weekMode);
  const offset = useApp((s) => s.weekOffset);
  const app = useApp.getState();
  const monday = addDays(weekStart(todayIso()), offset * 7);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Semaine">
        {mode === 'agenda' && (
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Semaine précédente" variant="ghost" size="s" onClick={() => app.set({ weekOffset: offset - 1 })} />
            <button type="button" onClick={() => app.set({ weekOffset: 0 })} className={cn('tnum min-w-[150px] rounded-full px-3 py-2 text-center text-label-m transition-colors hover:bg-bg-card/70', offset === 0 ? 'text-text-primary' : 'text-text-accent')} title="Revenir à cette semaine">
              {offset === 0 ? 'Cette semaine' : weekRangeLabel(monday)}
            </button>
            <IconButton icon={ChevronRight} label="Semaine suivante" variant="ghost" size="s" onClick={() => app.set({ weekOffset: offset + 1 })} />
          </div>
        )}
        <SegmentedControl
          label="Vue"
          value={mode}
          onChange={(v) => app.set({ weekMode: v })}
          options={[
            { value: 'agenda', label: 'Agenda' },
            { value: 'type', label: 'Semaine type' },
          ]}
        />
      </PageHeader>
      {mode === 'agenda' ? <Agenda monday={monday} /> : <TemplateWeek />}
    </div>
  );
}

function Agenda({ monday }: { monday: string }) {
  const all = useApp((s) => s.data.tasks);
  const person = useApp((s) => s.person);
  const tasks = all.filter((t) => concerns(t.assignee, person));
  const generated = useApp((s) => s.data.generatedWeeks.includes(monday));
  const days = weekDays(monday);
  const weekTasks = tasks.filter((t) => t.date >= monday && t.date <= days[6]!);
  const done = weekTasks.filter((t) => t.done).length;
  // Opening a future week fills it from the semaine type.
  useEffect(() => {
    if (!generated) useApp.getState().ensureWeek(monday);
  }, [generated, monday]);
  const big = CATEGORY_ORDER.map((c) => ({ c, total: weekTasks.filter((t) => t.category === c).length, done: weekTasks.filter((t) => t.category === c && t.done).length })).filter((x) => x.total > 0);
  const reveal = revealVariants();
  const mobile = useIsMobile();
  return (
    <>
      <motion.div initial="hidden" animate="show" variants={reveal} className="glass-panel flex shrink-0 items-center gap-5 rounded-xl px-5 py-3 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:px-4">
        <div className="flex w-[190px] shrink-0 flex-col gap-1.5 max-md:w-full">
          <div className="flex items-center justify-between">
            <span className="text-label-m text-text-primary">Semaine accomplie</span>
            <span className="tnum text-label-m text-text-accent">{percent(weekTasks.length ? done / weekTasks.length : 0)}</span>
          </div>
          <ProgressBar value={weekTasks.length ? done / weekTasks.length : 0} label="Semaine accomplie" />
        </div>
        <div className="h-8 w-px shrink-0 bg-border-default max-md:hidden" />
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]">
          {big.map(({ c, done: d, total }) => {
            const cat = CATEGORIES[c];
            const complete = d >= total;
            return (
              <li key={c} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border pr-2.5 pl-2 text-label-s', complete ? 'border-signal-default/30 bg-signal-soft text-text-signal' : 'border-border-subtle bg-bg-card/70 text-text-secondary')}>
                <cat.icon size={15} strokeWidth={ICON_STROKE} aria-hidden />
                <span className={complete ? undefined : 'text-text-primary'}>{cat.label}</span>
                <span className="tnum">
                  {d}/{total}
                </span>
              </li>
            );
          })}
        </ul>
      </motion.div>
      {mobile && <WeekStrip days={days} tasks={weekTasks} />}
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-7 gap-3 pb-1 max-md:mt-3 max-md:grid-cols-1">
        {days.map((d, i) => (
          <motion.div key={d} initial="hidden" animate="show" variants={reveal} custom={i + 1} className="flex min-h-0 min-w-0 flex-col">
            <DayColumn date={d} index={i} tasks={weekTasks.filter((t) => t.date === d)} />
          </motion.div>
        ))}
      </div>
    </>
  );
}

function useDrop(onDrop: (id: string) => void, type: string) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(type)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) setOver(false);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(type);
        if (id) onDrop(id);
      },
    },
  };
}

function DayColumn({ date, index, tasks }: { date: string; index: number; tasks: Task[] }) {
  const app = useApp.getState();
  const today = todayIso();
  const isToday = date === today;
  const past = date < today;
  const done = tasks.filter((t) => t.done).length;
  const drop = useDrop((id) => app.moveTask(id, date), 'text/cadence-task');
  return (
    <section
      id={`day-${date}`}
      aria-label={`${DAY_LONG[index]} ${fromIso(date).getDate()}`}
      {...drop.props}
      className={cn(
        'glass-panel flex min-h-0 flex-1 flex-col rounded-xl transition-[border-color,box-shadow]',
        isToday && '!border-border-accent !shadow-[0_0_0_1px_var(--color-border-accent),var(--glass-shadow)]',
        drop.over && '!border-border-accent !bg-accent-soft',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn('tnum inline-flex size-9 items-center justify-center rounded-full text-title-s', isToday ? 'bg-accent-default text-text-on-accent drop-shadow-glow-accent' : past ? 'text-text-muted' : 'text-text-primary')}>{fromIso(date).getDate()}</span>
        <span className={cn('text-label-m', isToday ? 'text-text-accent' : past ? 'text-text-muted' : 'text-text-secondary')}>{DAY_SHORT[index]}</span>
        {tasks.length > 0 && (
          <span className={cn('tnum ml-auto text-caption', done === tasks.length ? 'text-text-signal' : 'text-text-muted')}>
            {done}/{tasks.length}
          </span>
        )}
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <WeekTaskCard task={t} />
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => app.openDialog({ kind: 'task', date })} className="m-2 mt-0 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md text-label-s text-text-muted transition-colors hover:bg-bg-card/70 hover:text-text-accent">
        <Plus size={15} strokeWidth={ICON_STROKE} aria-hidden />
        Ajouter
      </button>
    </section>
  );
}

function WeekTaskCard({ task }: { task: Task }) {
  const app = useApp.getState();
  const cat = CATEGORIES[task.category];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/cadence-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => app.openDialog({ kind: 'task', id: task.id })}
      title={task.title}
      className={cn('group/card flex cursor-grab flex-col gap-1.5 rounded-lg border px-2.5 py-2 transition-[background-color,border-color,opacity] duration-(--v-duree-courte) active:cursor-grabbing', task.done ? 'border-transparent bg-bg-card/35' : 'border-border-subtle bg-bg-card/75 hover:border-border-strong hover:bg-bg-card')}
    >
      <div className="flex items-start gap-2">
        <CheckCircle checked={task.done} onChange={() => app.toggleTask(task.id)} label={task.done ? `Décocher « ${task.title} »` : `Cocher « ${task.title} »`} size="s" className="mt-px" />
        <span className={cn('line-clamp-2 min-w-0 flex-1 text-label-s', task.done ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary')}>{task.title}</span>
      </div>
      <div className="flex items-center gap-1.5 pl-7 text-caption text-text-muted">
        <cat.icon size={13} strokeWidth={ICON_STROKE} aria-hidden />
        {task.time && <span className="tnum">{task.time}</span>}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {task.routineId && <Repeat size={11} strokeWidth={ICON_STROKE} aria-label="Vient de la semaine type" />}
          <AssigneeBadge assignee={task.assignee} />
        </span>
      </div>
    </div>
  );
}

function TemplateWeek() {
  const allRoutines = useApp((s) => s.data.routines);
  const person = useApp((s) => s.person);
  const routines = allRoutines.filter((r) => concerns(r.assignee, person));
  const reveal = revealVariants();
  const total = routines.reduce((s, r) => s + (r.durationMin ?? 0), 0);
  return (
    <>
      <motion.div initial="hidden" animate="show" variants={reveal} className="glass-panel flex shrink-0 items-center gap-4 rounded-xl px-5 py-3 max-md:flex-wrap max-md:px-4">
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-text-accent">
          <Repeat size={18} strokeWidth={ICON_STROKE} />
        </span>
        <p className="min-w-0 flex-1 text-body-s text-text-secondary max-md:basis-[calc(100%-52px)]">Chaque nouvelle semaine reprend ces routines dans l'agenda. Les modifier met à jour les tâches à venir, jamais celles déjà cochées.</p>
        <span className="tnum shrink-0 text-label-m text-text-primary">{routines.length} routines</span>
        <span className="tnum shrink-0 text-label-m text-text-secondary">{duration(total)} par semaine</span>
      </motion.div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-7 gap-3 pb-1 max-md:mt-3 max-md:grid-cols-1">
        {DAY_LONG.map((_, i) => (
          <motion.div key={i} initial="hidden" animate="show" variants={reveal} custom={i + 1} className="flex min-h-0 min-w-0 flex-col">
            <TemplateColumn weekday={i} routines={routines.filter((r) => r.weekday === i).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))} />
          </motion.div>
        ))}
      </div>
    </>
  );
}

function TemplateColumn({ weekday, routines }: { weekday: number; routines: Routine[] }) {
  const app = useApp.getState();
  const drop = useDrop((id) => app.moveRoutine(id, weekday), 'text/cadence-routine');
  return (
    <section aria-label={DAY_LONG[weekday]} {...drop.props} className={cn('glass-panel flex min-h-0 flex-1 flex-col rounded-xl transition-[border-color]', drop.over && '!border-border-accent !bg-accent-soft')}>
      <header className="flex items-center px-3.5 pt-3.5 pb-2">
        <span className="text-title-s text-text-primary">{capitalize(DAY_LONG[weekday] ?? '')}</span>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {routines.map((r) => {
          const cat = CATEGORIES[r.category];
          return (
            <li key={r.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/cadence-routine', r.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => app.openDialog({ kind: 'routine', id: r.id })}
                className="flex w-full cursor-grab flex-col gap-1.5 rounded-lg border border-border-subtle bg-bg-card/75 px-2.5 py-2 text-left transition-[background-color,border-color] hover:border-border-strong hover:bg-bg-card active:cursor-grabbing"
              >
                <span className="flex items-start gap-2">
                  <cat.icon size={15} strokeWidth={ICON_STROKE} aria-hidden className="mt-0.5 shrink-0 text-text-accent" />
                  <span className="line-clamp-2 min-w-0 flex-1 text-label-s text-text-primary">{r.title}</span>
                  <AssigneeBadge assignee={r.assignee} />
                </span>
                {(r.time || r.durationMin) && (
                  <span className="flex items-center gap-1.5 pl-[23px] text-caption text-text-muted">
                    <Clock size={12} strokeWidth={ICON_STROKE} aria-hidden />
                    <span className="tnum">
                      {r.time ?? ''}
                      {r.time && r.durationMin ? ', ' : ''}
                      {r.durationMin ? duration(r.durationMin) : ''}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" size="s" icon={Plus} className="m-2 mt-0" onClick={() => app.openDialog({ kind: 'routine', weekday })}>
        Routine
      </Button>
    </section>
  );
}

/** Phone: the 7 days in a glass strip that sticks under the title bar; a tap scrolls to the day. */
function WeekStrip({ days, tasks }: { days: string[]; tasks: Task[] }) {
  const { element } = usePageScroll();
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 16, strength: 10 });
  const today = todayIso();
  const go = (d: string) => {
    const target = document.getElementById(`day-${d}`);
    if (!element || !target) return;
    const top = target.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop - 128;
    element.scrollTo({ top, behavior: 'smooth' });
  };
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+58px)] z-20 mt-3">
      <div ref={glass} className="liquid liquid-bar grid grid-cols-7 gap-1 rounded-2xl p-1.5">
        {days.map((d, i) => {
          const list = tasks.filter((t) => t.date === d);
          const done = list.filter((t) => t.done).length;
          const isToday = d === today;
          const complete = list.length > 0 && done === list.length;
          return (
            <button key={d} type="button" onClick={() => go(d)} aria-label={`${DAY_LONG[i]} ${fromIso(d).getDate()} : ${done} sur ${list.length}`} className={cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors', isToday ? 'bg-accent-default text-text-on-accent' : 'text-text-secondary active:bg-bg-card/70')}>
              <span className="text-[10px] leading-tight font-medium">{DAY_SHORT[i]}</span>
              <span className="tnum text-label-m">{fromIso(d).getDate()}</span>
              <span aria-hidden className={cn('size-1.5 rounded-full', !list.length ? 'bg-transparent' : complete ? (isToday ? 'bg-text-on-accent' : 'bg-signal-default') : isToday ? 'bg-text-on-accent/50' : 'bg-border-strong')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

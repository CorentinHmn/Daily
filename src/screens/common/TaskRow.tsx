/**
 * A task of the agenda (Aujourd'hui, Semaine): tick, category icon, title, time; a contextual action for linked
 * categories (start the gym session, log the run, open the list) and a menu (modifier, déplacer, supprimer).
 */
import { ArrowRight, CalendarArrowUp, EllipsisVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { useApp } from '../../store/app';
import { CATEGORIES } from '../../domain/catalog';
import type { Task } from '../../domain/types';
import { addDays, todayIso } from '../../lib/dates';
import { duration } from '../../lib/format';
import { cn } from '../../ui/cn';
import { CheckCircle, ICON_STROKE, IconBox } from '../../ui/atoms';
import { MenuButton } from '../../ui/overlays';
import { AssigneeBadge } from '../../ui/people';

export function TaskRow({ task, dense, draggable }: { task: Task; dense?: boolean; draggable?: boolean }) {
  const app = useApp.getState();
  const hasSession = useApp((s) => !!s.data.active);
  const cat = CATEGORIES[task.category];
  const today = todayIso();
  const link = !task.done && task.date <= addDays(today, 0) ? linkFor(task, hasSession) : null;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/cadence-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => app.openDialog({ kind: 'task', id: task.id })}
      className={cn(
        'group/task relative flex cursor-pointer items-center gap-3 rounded-lg border border-transparent transition-[background-color,border-color] duration-(--v-duree-courte) hover:border-border-subtle hover:bg-bg-card/70',
        dense ? 'px-2 py-1.5' : 'px-2.5 py-2',
        draggable && 'active:cursor-grabbing',
      )}
    >
      <CheckCircle burst checked={task.done} onChange={() => app.toggleTask(task.id)} label={task.done ? `Décocher « ${task.title} »` : `Cocher « ${task.title} »`} size={dense ? 's' : 'm'} />
      {!dense && <IconBox icon={cat.icon} tone={task.done ? 'raised' : 'glass'} size="s" className="max-md:hidden" />}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-label-m transition-colors', task.done ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary')}>{task.title}</p>
        {!dense && (
          <p className="truncate text-caption text-text-secondary">
            {cat.label}
            {task.durationMin ? `, ${duration(task.durationMin)}` : ''}
          </p>
        )}
      </div>
      {link && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            link.run();
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-label-s text-text-accent opacity-0 transition-[opacity,background-color,color] group-hover/task:opacity-100 pointer-coarse:size-8 pointer-coarse:justify-center pointer-coarse:px-0 pointer-coarse:opacity-100 hover:bg-accent-default hover:text-text-on-accent focus-visible:opacity-100"
        >
          <link.icon size={14} strokeWidth={ICON_STROKE} aria-hidden />
          <span className="pointer-coarse:sr-only">{link.label}</span>
        </button>
      )}
      <AssigneeBadge assignee={task.assignee} />
      {task.time && <span className={cn('tnum shrink-0 text-label-s', task.done ? 'text-text-muted' : 'text-text-secondary')}>{task.time}</span>}
      <MenuButton
        width={220}
        items={[
          { label: 'Modifier', icon: Pencil, onSelect: () => app.openDialog({ kind: 'task', id: task.id }) },
          { label: task.date < today ? "Reporter à aujourd'hui" : 'Reporter au lendemain', icon: CalendarArrowUp, onSelect: () => app.moveTask(task.id, task.date < today ? today : addDays(task.date, 1)) },
          { label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => app.deleteTask(task.id) },
        ]}
      >
        {({ ref, toggle, open }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Actions de « ${task.title} »`}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-[opacity,background-color] hover:bg-bg-hover hover:text-text-primary', open ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100')}
          >
            <EllipsisVertical size={16} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        )}
      </MenuButton>
    </div>
  );
}

function linkFor(task: Task, hasSession: boolean): { label: string; icon: typeof Play; run: () => void } | null {
  const app = useApp.getState();
  if (task.category === 'sport') {
    if (hasSession) return { label: 'Reprendre', icon: ArrowRight, run: () => app.set({ view: 'sport', sportView: 'salle' }) };
    const pid = task.programId ?? app.data.programs.find((p) => task.title.toLowerCase().includes(p.name.toLowerCase()))?.id;
    if (pid) return { label: 'Démarrer', icon: Play, run: () => app.startSession(pid) };
    return { label: 'Ouvrir', icon: ArrowRight, run: () => app.set({ view: 'sport', sportView: 'salle' }) };
  }
  if (task.category === 'running') return { label: 'Saisir', icon: Pencil, run: () => app.openDialog({ kind: 'run', date: task.date }) };
  if (task.category === 'courses') return { label: 'La liste', icon: ArrowRight, run: () => app.navigate('shopping') };
  return null;
}

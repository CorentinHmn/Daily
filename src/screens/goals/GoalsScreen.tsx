/**
 * Objectifs: goals of the period (Semaine | Mois | Année) as cards — auto goals read Sport and the agenda, counters
 * go up by hand, lists are sub-steps to tick — and the habits of the week (one tick per day).
 */
import { motion } from 'motion/react';
import { Check, EllipsisVertical, Flame, Link2, Minus, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useApp } from '../../store/app';
import { GOAL_ICONS, GOAL_SOURCES, HABIT_ICONS, PERIOD_LABEL } from '../../domain/catalog';
import type { Goal, GoalPeriod } from '../../domain/types';
import { goalProgress, goalStatus, habitDueOn, habitStreak } from '../../domain/stats';
import { DAY_LETTER, DAY_LONG, fromIso, todayIso, weekDays, weekStart } from '../../lib/dates';
import { num } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, EmptyState, ICON_STROKE, IconBox, IconButton, Panel, PanelHeader, ProgressBar, StatusBadge } from '../../ui/atoms';
import { SegmentedControl } from '../../ui/navigation';
import { MenuButton } from '../../ui/overlays';
import { revealVariants } from '../../theme/motion';
import { PageHeader } from '../shell/PageHeader';
import { useIsMobile } from '../../ui/useMedia';
import { AssigneeBadge } from '../../ui/people';
import { ownedBy } from '../../domain/people';

const TITLES: Record<GoalPeriod, string> = { semaine: 'Objectifs de la semaine', mois: 'Objectifs du mois', annee: "Objectifs de l'année" };
const SHORT_TITLES: Record<GoalPeriod, string> = { semaine: 'Cette semaine', mois: 'Ce mois-ci', annee: 'Cette année' };

export function GoalsScreen() {
  const period = useApp((s) => s.goalPeriod);
  const data = useApp((s) => s.data);
  const app = useApp.getState();
  const person = useApp((s) => s.person);
  const goals = data.goals.filter((g) => g.period === period && ownedBy(g.owner, person)).map((g) => ({ g, p: goalProgress(g, data) }));
  const reached = goals.filter(({ p }) => p.ratio >= 1).length;
  const reveal = revealVariants();
  const mobile = useIsMobile();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Objectifs">
        <SegmentedControl label="Période" value={period} onChange={(v) => app.set({ goalPeriod: v })} options={(['semaine', 'mois', 'annee'] as const).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
      </PageHeader>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} className="flex min-h-0 flex-col">
          <Panel className="flex-1">
            <PanelHeader title={mobile ? SHORT_TITLES[period] : TITLES[period]} icon={Target} count={goals.length ? `${reached} / ${goals.length} atteints` : undefined}>
              <Button variant="soft" size="s" icon={Plus} aria-label="Nouvel objectif" onClick={() => app.openDialog({ kind: 'goal', period })}>
                <span className="max-md:hidden">Objectif</span>
              </Button>
            </PanelHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
              {goals.length === 0 ? (
                <EmptyState icon={Target} title="Aucun objectif pour cette période" text="Un objectif peut se calculer tout seul (séances, kilomètres, tâches), se compter à la main ou se découper en étapes." action={<Button icon={Plus} onClick={() => app.openDialog({ kind: 'goal', period })}>Créer un objectif</Button>} className="h-full" />
              ) : (
                <motion.ul initial="hidden" animate="show" className="columns-2 gap-3 max-md:columns-1">
                  {goals.map(({ g }, i) => (
                    <motion.li key={g.id} variants={reveal} custom={i} className="mb-3 break-inside-avoid">
                      <GoalCard goal={g} />
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </div>
          </Panel>
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={1} className="flex min-h-0 flex-col">
          <Habits />
        </motion.div>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const data = useApp((s) => s.data);
  const app = useApp.getState();
  const p = goalProgress(goal, data);
  const status = goalStatus(goal, p.ratio);
  const Icon = GOAL_ICONS[goal.icon];
  const unit = goal.kind === 'auto' && goal.source ? GOAL_SOURCES[goal.source].unit(p.target) : goal.kind === 'liste' ? (p.target > 1 ? 'étapes' : 'étape') : '';
  return (
    <article className={cn('inset-tile group/goal flex flex-col gap-3 rounded-xl p-4 transition-[border-color]', status === 'atteint' && 'border-signal-default/35')}>
      <div className="flex items-start gap-3">
        <IconBox icon={Icon} tone={status === 'atteint' ? 'signal' : 'soft'} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="flex items-center gap-2 text-title-s text-text-primary">
            <span className="min-w-0">{goal.title}</span>
            <AssigneeBadge assignee={goal.owner} />
          </h3>
          {goal.kind === 'auto' && goal.source && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-caption text-text-secondary">
              <Link2 size={12} strokeWidth={ICON_STROKE} aria-hidden />
              {GOAL_SOURCES[goal.source].label}
            </p>
          )}
        </div>
        <MenuButton
          items={[
            { label: 'Modifier', icon: Pencil, onSelect: () => app.openDialog({ kind: 'goal', id: goal.id }) },
            { label: 'Supprimer', icon: Trash2, tone: 'danger', onSelect: () => app.deleteGoal(goal.id) },
          ]}
        >
          {({ ref, toggle }) => <IconButton ref={ref} icon={EllipsisVertical} label={`Actions de « ${goal.title} »`} variant="ghost" size="xs" onClick={toggle} />}
        </MenuButton>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="tnum text-data-m text-text-primary">
          {num(p.value, Number.isInteger(p.value) ? 0 : 1)}
          <span className="text-body-s text-text-secondary">
            {' '}
            / {num(p.target)} {unit}
          </span>
        </p>
        <StatusBadge tone={status === 'atteint' ? 'signal' : status === 'en-retard' ? 'warn' : 'accent'}>{status === 'atteint' ? 'Atteint' : status === 'en-retard' ? 'En retard' : 'En cours'}</StatusBadge>
      </div>
      <ProgressBar value={p.ratio} tone={status === 'atteint' ? 'signal' : status === 'en-retard' ? 'warn' : 'accent'} label={goal.title} />
      {goal.kind === 'compteur' && (
        <div className="flex items-center gap-2">
          <IconButton icon={Minus} label="Retirer 1" variant="raised" size="s" onClick={() => app.bumpGoal(goal.id, -1)} disabled={goal.value <= 0} />
          <Button variant="soft" size="s" icon={Plus} className="flex-1" onClick={() => app.bumpGoal(goal.id, 1)}>
            Ajouter 1
          </Button>
        </div>
      )}
      {goal.kind === 'liste' && (
        <ul className="flex flex-col gap-1">
          {goal.steps.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-bg-card/60">
                <CheckCircle checked={s.done} onChange={() => app.toggleGoalStep(goal.id, s.id)} label={s.label} size="s" />
                <span className={cn('text-body-s', s.done ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary')}>{s.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Habits() {
  const allHabits = useApp((s) => s.data.habits);
  const person = useApp((s) => s.person);
  const habits = allHabits.filter((h) => ownedBy(h.owner, person));
  const app = useApp.getState();
  const today = todayIso();
  const days = weekDays(weekStart(today));
  return (
    <Panel className="flex-1">
      <PanelHeader title="Habitudes" icon={Flame}>
        <IconButton icon={Plus} label="Nouvelle habitude" variant="ghost" size="s" onClick={() => app.openDialog({ kind: 'habit' })} />
      </PanelHeader>
      {habits.length === 0 ? (
        <EmptyState icon={Flame} title="Aucune habitude suivie" text="Une habitude, c'est une case à cocher chaque jour : boire de l'eau, s'étirer, lire." action={<Button size="s" icon={Plus} onClick={() => app.openDialog({ kind: 'habit' })}>Ajouter</Button>} className="flex-1" />
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-2 pb-4">
          {habits.map((h) => {
            const Icon = HABIT_ICONS[h.icon].icon;
            const streak = habitStreak(h, today);
            return (
              <li key={h.id} className="inset-tile flex flex-col gap-3 rounded-xl px-3.5 py-3">
                <button type="button" onClick={() => app.openDialog({ kind: 'habit', id: h.id })} className="flex min-w-0 items-center gap-2.5 text-left" title="Modifier l'habitude">
                  <IconBox icon={Icon} tone="glass" size="s" />
                  <span className="min-w-0 flex-1 truncate text-label-m text-text-primary">{h.title}</span>
                  <AssigneeBadge assignee={h.owner} />
                  {streak > 0 ? (
                    <span className="tnum inline-flex shrink-0 items-center gap-1 text-label-s text-text-warn" title={`Série de ${streak} jour${streak > 1 ? 's' : ''}`}>
                      <Flame size={14} strokeWidth={ICON_STROKE} aria-hidden />
                      {streak} j
                    </span>
                  ) : (
                    <span className="shrink-0 text-caption text-text-muted">Pas de série</span>
                  )}
                </button>
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((d, i) => {
                    const due = habitDueOn(h, d);
                    const on = h.checks.includes(d);
                    const future = d > today;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${h.title}, ${DAY_LONG[i]} ${fromIso(d).getDate()}`}
                        disabled={future || !due}
                        onClick={() => app.toggleHabit(h.id, d)}
                        className={cn(
                          'mx-auto inline-flex size-8 items-center justify-center rounded-full border text-caption transition-[background-color,border-color,transform] duration-(--v-duree-courte) active:scale-90 disabled:cursor-not-allowed',
                          !due
                            ? 'border-transparent text-text-disabled'
                            : on
                              ? 'border-signal-default bg-signal-default text-text-on-accent'
                              : future
                                ? 'border-dashed border-border-default text-text-muted'
                                : d === today
                                  ? 'border-border-accent bg-accent-soft text-text-accent hover:border-signal-default'
                                  : 'border-border-strong bg-bg-card/70 text-text-secondary hover:border-signal-default',
                        )}
                      >
                        {on ? <Check size={14} strokeWidth={3} aria-hidden /> : DAY_LETTER[i]}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

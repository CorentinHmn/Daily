/**
 * Salle: programmes (left), the selected programme's exercises, editable (middle), history and weekly volume (right).
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, CalendarDays, ChevronDown, Dumbbell, EllipsisVertical, History, Pencil, Play, Plus, Timer, Trash2 } from 'lucide-react';
import { useApp } from '../../store/app';
import { goalFor, ownedBy } from '../../domain/people';
import type { ExerciseTemplate, Program } from '../../domain/types';
import { periodRange, sessionMinutes, sessionVolume, sessionsIn, weeklySeries } from '../../domain/stats';
import { fromIso, shortDate, todayIso } from '../../lib/dates';
import { clock, duration, kg, tonnes, uid } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, EmptyState, ICON_STROKE, IconBox, IconButton, Panel, PanelHeader } from '../../ui/atoms';
import { KpiCard, WeekBars, doneTrend, trendOf } from '../../ui/charts';
import { NumberStepper, TextInput } from '../../ui/forms';
import { MenuButton } from '../../ui/overlays';
import { revealVariants } from '../../theme/motion';

export function GymView() {
  const all = useApp((s) => s.data);
  const person = useApp((s) => s.person);
  // The selected person's programmes and sessions (all of them with « Tous »).
  const data = { ...all, sessions: all.sessions.filter((x) => ownedBy(x.owner, person)), programs: all.programs.filter((x) => ownedBy(x.owner, person)), goals: all.goals.filter((x) => goalFor(x, person)) };
  const selected = useApp((s) => s.programId);
  const app = useApp.getState();
  const today = todayIso();
  const week = periodRange('semaine', today);
  const month = periodRange('mois', today);
  const thisWeek = sessionsIn(data.sessions, week);
  const goal = data.goals.find((g) => g.kind === 'auto' && g.source === 'seances' && g.period === 'semaine')?.target;
  const recent = [...data.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const avg = recent.slice(0, 10).reduce((s, x) => s + sessionMinutes(x), 0) / Math.max(1, Math.min(10, recent.length));
  const program = data.programs.find((p) => p.id === selected) ?? data.programs[0];
  const reveal = revealVariants();
  // The last 8 weeks (this one last): sessions and volume, for the curves and the change from last week.
  const counts = weeklySeries(8, (from, to) => sessionsIn(data.sessions, { from, to }).length, today).map((w) => w.value);
  const volumes = weeklySeries(8, (from, to) => sessionsIn(data.sessions, { from, to }).reduce((s, x) => s + sessionVolume(x), 0), today);
  const volume = volumes.map((w) => w.value);
  const kpis = [
    <KpiCard key="a" label="Séances cette semaine" value={thisWeek.length} of={goal} icon={CalendarCheck} tint="accent" trend={goal ? doneTrend(thisWeek.length, goal) : undefined} spark={counts} />,
    <KpiCard key="b" label="Séances ce mois" value={sessionsIn(data.sessions, month).length} icon={CalendarDays} tint="violet" />,
    <KpiCard key="c" label="Volume cette semaine" value={Math.round(volume[7] ?? 0)} suffix="kg" icon={Dumbbell} tint="warn" trend={trendOf(volume[7] ?? 0, volume[6] ?? 0)} spark={volume} />,
    <KpiCard key="d" label="Durée moyenne" value={Math.round(avg)} suffix="min" icon={Timer} tint="signal" />,
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div initial="hidden" animate="show" className="grid shrink-0 grid-cols-4 gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:gap-3 max-md:overflow-x-auto max-md:-my-4 max-md:px-4 max-md:py-4 max-md:[scrollbar-width:none]">
        {kpis.map((k, i) => (
          <motion.div key={i} variants={reveal} custom={i} className="flex min-w-0 flex-col max-md:w-[44%] max-md:shrink-0 max-md:snap-start [&>*]:flex-1">
            {k}
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,260px)_minmax(400px,1fr)_minmax(0,320px)] 2xl:grid-cols-[minmax(0,280px)_minmax(400px,1fr)_minmax(0,340px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} custom={2} className="flex min-h-0 flex-col">
          <Panel className="flex-1">
            <PanelHeader title="Programmes" icon={Dumbbell}>
              <IconButton icon={Plus} label="Nouveau programme" variant="ghost" size="s" onClick={() => app.openDialog({ kind: 'program' })} />
            </PanelHeader>
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2 pb-3">
              {data.programs.map((p) => {
                const on = p.id === program?.id;
                const last = recent.find((s) => s.programId === p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => app.set({ programId: p.id })}
                      aria-current={on || undefined}
                      className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color]', on ? 'border-border-accent bg-accent-soft' : 'border-transparent hover:border-border-subtle hover:bg-bg-card/70')}
                    >
                      <IconBox icon={Dumbbell} tone={on ? 'accent' : 'glass'} size="s" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label-m text-text-primary">{p.name}</span>
                        <span className="block truncate text-caption text-text-secondary">{last ? `Dernière fois le ${shortDate(last.date)}` : `${p.exercises.length} exercices`}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {data.programs.length === 0 && <EmptyState icon={Dumbbell} title="Aucun programme" text="Crée ton premier programme pour lancer une séance." />}
            </ul>
          </Panel>
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={3} className="flex min-h-0 flex-col">
          {program ? <ProgramPanel program={program} /> : <Panel className="flex-1" />}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={4} className="flex min-h-0 flex-col gap-4">
          <Panel className="shrink-0">
            <PanelHeader title="Volume par semaine" />
            <div className="px-5 pt-2 pb-4">
              <WeekBars
                height={130}
                labels
                format={tonnes}
                data={volumes.map((w) => ({ label: `${fromIso(w.week).getDate()}`, value: w.value }))}
              />
            </div>
          </Panel>
          <Panel className="min-h-0 flex-1">
            <PanelHeader title="Historique" icon={History} />
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1 pb-3">
              {recent.length === 0 && <li className="px-2 py-3 text-body-s text-text-secondary">Tes séances terminées apparaîtront ici.</li>}
              {recent.slice(0, 30).map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-card/60">
                  <span className="tnum w-14 shrink-0 text-label-s text-text-secondary">{shortDate(s.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-label-m text-text-primary">{s.programName}</span>
                  <span className="tnum text-caption text-text-secondary">{duration(sessionMinutes(s))}</span>
                  <span className="tnum w-16 text-right text-label-s text-text-primary">{kg(Math.round(sessionVolume(s)))}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function ProgramPanel({ program }: { program: Program }) {
  const app = useApp.getState();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const save = (exercises: ExerciseTemplate[]) => app.saveProgram({ ...program, exercises });
  const update = (id: string, patch: Partial<ExerciseTemplate>) => save(program.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const nextTask = useApp((s) => s.data.tasks.find((t) => t.category === 'sport' && !t.done && t.date >= todayIso() && (t.programId === program.id || t.title.toLowerCase().includes(program.name.toLowerCase()))));
  const minutes = program.exercises.reduce((s, e) => s + e.sets * (0.8 + e.restSec / 60), 0);
  return (
    <Panel className="flex-1">
      <PanelHeader title={program.name}>
        <MenuButton
          items={[
            { label: 'Renommer', icon: Pencil, onSelect: () => app.openDialog({ kind: 'program', id: program.id }) },
            { label: 'Supprimer le programme', icon: Trash2, tone: 'danger', onSelect: () => app.deleteProgram(program.id) },
          ]}
        >
          {({ ref, toggle }) => <IconButton ref={ref} icon={EllipsisVertical} label="Actions du programme" variant="ghost" size="s" onClick={toggle} />}
        </MenuButton>
        <Button icon={Play} onClick={() => app.startSession(program.id)} disabled={program.exercises.length === 0}>
          <span className="max-md:hidden">Démarrer la séance</span>
          <span className="md:hidden">Démarrer</span>
        </Button>
      </PanelHeader>
      <p className="px-5 pt-1 text-body-s text-text-secondary">
        {program.exercises.length} exercices, environ {duration(Math.round(minutes / 5) * 5)}
        {nextTask ? `. Prévue ${nextTask.date === todayIso() ? "aujourd'hui" : `le ${shortDate(nextTask.date)}`}${nextTask.time ? ` à ${nextTask.time}` : ''}.` : '.'}
      </p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_48px_48px_72px_56px_28px] items-center gap-2 border-b border-border-subtle px-5 pb-2 text-label-s text-text-muted max-md:grid-cols-[minmax(0,1fr)_36px_36px_60px_20px] max-md:px-4">
        <span>Exercice</span>
        <span className="text-right">Séries</span>
        <span className="text-right">Rép.</span>
        <span className="text-right">Charge</span>
        <span className="text-right max-md:hidden">Repos</span>
        <span />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {program.exercises.map((e) => {
          const expanded = open === e.id;
          return (
            <li key={e.id} className={cn('rounded-lg transition-colors', expanded && 'bg-bg-card/70')}>
              <button type="button" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded} className="grid w-full grid-cols-[minmax(0,1fr)_48px_48px_72px_56px_28px] items-center gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-bg-card/60 max-md:grid-cols-[minmax(0,1fr)_36px_36px_60px_20px] max-md:py-3">
                <span className="truncate text-label-m text-text-primary">{e.name}</span>
                <span className="tnum text-right text-body-s text-text-primary">{e.sets}</span>
                <span className="tnum text-right text-body-s text-text-primary">{e.reps}</span>
                <span className="tnum text-right text-body-s text-text-primary">{e.weight ? kg(e.weight) : 'PDC'}</span>
                <span className="tnum text-right text-body-s text-text-secondary max-md:hidden">{clock(e.restSec)}</span>
                <ChevronDown size={16} strokeWidth={ICON_STROKE} aria-hidden className={cn('justify-self-end text-text-muted transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] items-end gap-2 px-2 pt-1 pb-3 max-md:grid-cols-2 max-md:[&>*:first-child]:col-span-2">
                  <label className="flex min-w-0 flex-col gap-1 text-caption text-text-secondary">
                    Nom
                    <TextInput value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })} aria-label="Nom de l'exercice" />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-text-secondary">
                    Séries
                    <NumberStepper label="séries" value={e.sets} min={1} max={12} onChange={(v) => update(e.id, { sets: v })} />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-text-secondary">
                    Répétitions
                    <NumberStepper label="répétitions" value={e.reps} min={1} max={100} onChange={(v) => update(e.id, { reps: v })} />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-text-secondary">
                    Charge
                    <NumberStepper label="charge" value={e.weight} step={2.5} max={500} decimals={1} suffix="kg" onChange={(v) => update(e.id, { weight: v })} />
                  </label>
                  <label className="flex flex-col gap-1 text-caption text-text-secondary">
                    Repos
                    <NumberStepper label="repos" value={e.restSec} step={15} max={600} suffix="s" onChange={(v) => update(e.id, { restSec: v })} />
                  </label>
                  <IconButton icon={Trash2} label={`Retirer ${e.name}`} variant="danger" size="s" onClick={() => save(program.exercises.filter((x) => x.id !== e.id))} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="shrink-0 border-t border-border-subtle p-3">
        <TextInput
          icon={Plus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              const ex = { id: uid(), name: draft.trim(), sets: 3, reps: 10, weight: 0, restSec: 90 };
              save([...program.exercises, ex]);
              setOpen(ex.id);
              setDraft('');
            }
          }}
          placeholder="Ajouter un exercice"
          aria-label="Ajouter un exercice au programme"
        />
      </div>
    </Panel>
  );
}


/** Every dialog of the app, driven by `dialog` in the store. */
import { useState, type ReactNode } from 'react';
import { CalendarDays, Dumbbell, Flag, Footprints, ListPlus, Plus, Repeat, Target, Trash2, Flame, X } from 'lucide-react';
import { useApp, type DialogState } from '../../store/app';
import { CATEGORIES, CATEGORY_ORDER, GOAL_ICONS, GOAL_SOURCES, HABIT_ICONS, PERIOD_LABEL, guessCategory } from '../../domain/catalog';
import { NOUS, type CategoryId, type GoalIcon, type GoalKind, type GoalPeriod, type GoalSource, type GoalStep, type HabitIcon } from '../../domain/types';
import { PeopleChips, WhoChips } from '../../ui/people';
import { goalOwners } from '../../domain/people';
import { sessionVolume } from '../../domain/stats';
import { addDays, todayIso, weekStart, weekdayIndex } from '../../lib/dates';
import { duration, kg, uid } from '../../lib/format';
import { Button, ICON_STROKE, IconButton } from '../../ui/atoms';
import { cn } from '../../ui/cn';
import { ChoiceChips, DayPicker, Field, NumberStepper, Select, TextArea, TextInput, Toggle } from '../../ui/forms';
import { Dialog } from '../../ui/overlays';
import { DateField, TimeField } from '../../ui/pickers';
import { useNow } from '../../ui/useNow';
import { RunForm } from '../sport/RunView';
import { parseItem } from '../shopping/ShoppingScreen';
import { SettingsDialog } from './SettingsDialog';
import { AccountDialog } from './AccountDialog';

export function Dialogs() {
  const dialog = useApp((s) => s.dialog);
  const close = useApp((s) => s.closeDialog);
  const key = dialog ? JSON.stringify(dialog) : 'none';
  return (
    <>
      <TaskDialog key={`t${key}`} dialog={dialog?.kind === 'task' ? dialog : null} onClose={close} />
      <RoutineDialog key={`r${key}`} dialog={dialog?.kind === 'routine' ? dialog : null} onClose={close} />
      <GoalDialog key={`g${key}`} dialog={dialog?.kind === 'goal' ? dialog : null} onClose={close} />
      <HabitDialog key={`h${key}`} dialog={dialog?.kind === 'habit' ? dialog : null} onClose={close} />
      <RunDialog dialog={dialog?.kind === 'run' ? dialog : null} onClose={close} />
      <ProgramDialog key={`p${key}`} dialog={dialog?.kind === 'program' ? dialog : null} onClose={close} />
      <ItemDialog key={`i${key}`} open={dialog?.kind === 'item'} onClose={close} />
      <FinishDialog open={dialog?.kind === 'finish-session'} onClose={close} />
      <SettingsDialog open={dialog?.kind === 'settings'} onClose={close} />
      <AccountDialog open={dialog?.kind === 'account'} onClose={close} />
    </>
  );
}

const categoryOptions = CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORIES[c].label, icon: CATEGORIES[c].icon }));

function Footer({ onDelete, deleteLabel = 'Supprimer', onCancel, submitLabel, disabled }: { onDelete?: () => void; deleteLabel?: string; onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <>
      {onDelete && (
        <Button variant="ghost" icon={Trash2} className="mr-auto text-text-danger! hover:bg-danger-soft hover:text-text-danger!" onClick={onDelete}>
          {deleteLabel}
        </Button>
      )}
      <Button variant="secondary" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" form="dialog-form" disabled={disabled}>
        {submitLabel}
      </Button>
    </>
  );
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      id="dialog-form"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

// ── Tâche ────────────────────────────────────────────────────────────────────

function TaskDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'task' }> | null; onClose: () => void }) {
  const app = useApp.getState();
  const task = dialog?.id ? app.data.tasks.find((t) => t.id === dialog.id) : undefined;
  const [title, setTitle] = useState(task?.title ?? '');
  const [category, setCategory] = useState<CategoryId>(task?.category ?? dialog?.category ?? 'perso');
  const [touchedCat, setTouchedCat] = useState(!!task);
  const [date, setDate] = useState(task?.date ?? dialog?.date ?? todayIso());
  const [time, setTime] = useState(task?.time ?? '');
  const [minutes, setMinutes] = useState(task?.durationMin ?? 0);
  const [programId, setProgramId] = useState(task?.programId);
  const [note, setNote] = useState(task?.note ?? '');
  const meId = app.data.settings.meId;
  const several = app.data.members.length > 1;
  const [assignee, setAssignee] = useState<string>(task?.assignee ?? (dialog?.category === 'sport' || dialog?.category === 'running' ? (meId ?? NOUS) : NOUS));
  // A new task can go on several days of the date's week, or every week on those days (semaine type).
  const [days, setDays] = useState<number[]>([weekdayIndex(date)]);
  const [weekly, setWeekly] = useState(false);
  const monday = weekStart(date);
  const pickDays = (next: number[]) => {
    setDays(next);
    if (next[0] !== undefined && !next.includes(weekdayIndex(date))) setDate(addDays(monday, next[0]));
  };
  const pickDate = (iso: string) => {
    const wd = weekdayIndex(iso);
    setDate(iso);
    setDays((p) => (p.length > 1 ? (p.includes(wd) ? p : [...p, wd].sort()) : [wd]));
  };
  const programs = app.data.programs;
  const valid = !!title.trim() && (!!task || days.length > 0);
  return (
    <Dialog open={!!dialog && !(dialog.id && !task)} onClose={onClose} title={task ? 'Modifier la tâche' : 'Nouvelle tâche'} icon={CalendarDays} footer={<Footer onCancel={onClose} submitLabel={task ? 'Enregistrer' : weekly ? 'Ajouter à la semaine type' : 'Ajouter'} disabled={!valid} onDelete={task ? () => (app.deleteTask(task.id), onClose()) : undefined} />}>
      <Form
        onSubmit={() => {
          if (!valid) return;
          const base = { title: title.trim(), category, time: time || undefined, durationMin: minutes || undefined, programId: category === 'sport' ? programId : undefined, assignee };
          if (task) app.saveTask({ ...base, id: task.id, date, note: note.trim() || undefined, routineId: task.routineId });
          else if (weekly) for (const d of days) app.saveRoutine({ ...base, weekday: d });
          else for (const d of days) app.saveTask({ ...base, date: addDays(monday, d), note: note.trim() || undefined });
          onClose();
        }}
      >
        <Field label="Titre" htmlFor="task-title">
          <TextInput
            id="task-title"
            data-autofocus={task ? undefined : ''}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!touchedCat) setCategory(guessCategory(e.target.value));
            }}
            placeholder="ex. Aspirateur et serpillère"
          />
        </Field>
        {several && (
          <Field label="Qui ?">
            <WhoChips value={assignee} onChange={setAssignee} allowNous={true} />
          </Field>
        )}
        <Field label="Catégorie">
          <ChoiceChips label="Catégorie" value={category} onChange={(v) => (setCategory(v), setTouchedCat(true))} options={categoryOptions} />
        </Field>
        {category === 'sport' && programs.length > 0 && (
          <Field label="Programme de salle" htmlFor="task-program">
            <Select id="task-program" value={programId} onChange={setProgramId} placeholder="Aucun" options={programs.map((p) => ({ value: p.id, label: p.name, icon: Dumbbell }))} />
          </Field>
        )}
        {!task && (
          <Field label="Jours" help={weekly ? "Chaque semaine, à partir d'aujourd'hui" : days.length > 1 ? `${days.length} tâches cette semaine-là` : undefined}>
            <div className="flex flex-col gap-3">
              <DayPicker multiple value={days} onChange={pickDays} />
              <Toggle checked={weekly} onChange={setWeekly} label="Chaque semaine" description="L'ajouter à la semaine type" />
            </div>
          </Field>
        )}
        <div className={cn('grid gap-3', weekly ? 'grid-cols-2 max-md:grid-cols-1' : 'grid-cols-3 max-md:grid-cols-2 max-md:[&>*:first-child]:col-span-2')}>
          {!weekly && (
            <Field label="Jour" htmlFor="task-date">
              <DateField id="task-date" label="Jour" value={date} onChange={pickDate} />
            </Field>
          )}
          <Field label="Heure" htmlFor="task-time" help="Facultatif">
            <TimeField id="task-time" value={time} onChange={setTime} />
          </Field>
          <Field label="Durée" help={minutes ? duration(minutes) : 'Facultatif'}>
            <NumberStepper label="durée en minutes" value={minutes} step={5} max={600} suffix="min" onChange={setMinutes} />
          </Field>
        </div>
        {!weekly && (
          <Field label="Note" htmlFor="task-note">
            <TextArea id="task-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Un détail à ne pas oublier" />
          </Field>
        )}
        {task?.routineId && (
          <p className="flex items-center gap-2 text-caption text-text-secondary">
            <Repeat size={13} strokeWidth={ICON_STROKE} aria-hidden />
            Cette tâche vient de la semaine type : la modifier ici ne change que ce jour.
          </p>
        )}
      </Form>
    </Dialog>
  );
}

// ── Routine (semaine type) ───────────────────────────────────────────────────

function RoutineDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'routine' }> | null; onClose: () => void }) {
  const app = useApp.getState();
  const routine = dialog?.id ? app.data.routines.find((r) => r.id === dialog.id) : undefined;
  const [title, setTitle] = useState(routine?.title ?? '');
  const [category, setCategory] = useState<CategoryId>(routine?.category ?? 'menage');
  const [touchedCat, setTouchedCat] = useState(!!routine);
  const [days, setDays] = useState<number[]>([routine?.weekday ?? dialog?.weekday ?? weekdayIndex(todayIso())]);
  const [time, setTime] = useState(routine?.time ?? '');
  const [minutes, setMinutes] = useState(routine?.durationMin ?? 0);
  const [programId, setProgramId] = useState(routine?.programId);
  const programs = app.data.programs;
  const several = app.data.members.length > 1;
  const [assignee, setAssignee] = useState<string>(routine?.assignee ?? NOUS);
  return (
    <Dialog open={!!dialog && !(dialog.id && !routine)} onClose={onClose} title={routine ? 'Modifier la routine' : 'Nouvelle routine'} icon={Repeat} footer={<Footer onCancel={onClose} submitLabel={routine ? 'Enregistrer' : 'Ajouter à la semaine type'} disabled={!title.trim() || !days.length} deleteLabel="Retirer" onDelete={routine ? () => (app.deleteRoutine(routine.id), onClose()) : undefined} />}>
      <Form
        onSubmit={() => {
          if (!title.trim() || !days.length) return;
          const base = { title: title.trim(), category, time: time || undefined, durationMin: minutes || undefined, programId: category === 'sport' ? programId : undefined, assignee };
          // One routine per day: an edited routine keeps its day if still ticked, the other days get their own copy.
          const [first, ...rest] = routine && days.includes(routine.weekday) ? [routine.weekday, ...days.filter((d) => d !== routine.weekday)] : days;
          app.saveRoutine({ ...base, id: routine?.id, weekday: first! });
          for (const d of rest) app.saveRoutine({ ...base, weekday: d });
          onClose();
        }}
      >
        <Field label="Titre" htmlFor="routine-title">
          <TextInput
            id="routine-title"
            data-autofocus={routine ? undefined : ''}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!touchedCat) setCategory(guessCategory(e.target.value));
            }}
            placeholder="ex. Ménage complet"
          />
        </Field>
        {several && (
          <Field label="Qui ?">
            <WhoChips value={assignee} onChange={setAssignee} allowNous={true} />
          </Field>
        )}
        <Field label="Catégorie">
          <ChoiceChips label="Catégorie" value={category} onChange={(v) => (setCategory(v), setTouchedCat(true))} options={categoryOptions} />
        </Field>
        {category === 'sport' && programs.length > 0 && (
          <Field label="Programme de salle" htmlFor="routine-program">
            <Select id="routine-program" value={programId} onChange={setProgramId} placeholder="Aucun" options={programs.map((p) => ({ value: p.id, label: p.name, icon: Dumbbell }))} />
          </Field>
        )}
        <Field label="Jours de la semaine" help={days.length > 1 ? `${days.length} routines, une par jour` : undefined}>
          <DayPicker multiple value={days} onChange={setDays} />
        </Field>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="Heure" htmlFor="routine-time" help="Facultatif">
            <TimeField id="routine-time" value={time} onChange={setTime} />
          </Field>
          <Field label="Durée" help={minutes ? duration(minutes) : 'Facultatif'}>
            <NumberStepper label="durée en minutes" value={minutes} step={5} max={600} suffix="min" onChange={setMinutes} />
          </Field>
        </div>
      </Form>
    </Dialog>
  );
}

// ── Objectif ─────────────────────────────────────────────────────────────────

function GoalDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'goal' }> | null; onClose: () => void }) {
  const app = useApp.getState();
  const goal = dialog?.id ? app.data.goals.find((g) => g.id === dialog.id) : undefined;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [period, setPeriod] = useState<GoalPeriod>(goal?.period ?? dialog?.period ?? app.goalPeriod);
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'auto');
  const [source, setSource] = useState<GoalSource>(goal?.source ?? 'seances');
  const [target, setTarget] = useState(goal?.target ?? 3);
  const [value, setValue] = useState(goal?.value ?? 0);
  const [steps, setSteps] = useState<GoalStep[]>(goal?.steps ?? []);
  const [stepDraft, setStepDraft] = useState('');
  const [icon, setIcon] = useState<GoalIcon>(goal?.icon ?? 'target');
  const several = app.data.members.length > 1;
  const memberIds = app.data.members.map((m) => m.id);
  const [people, setPeople] = useState<string[]>(() => {
    const owners = goal ? goalOwners(goal) : app.data.settings.meId ? [app.data.settings.meId] : [];
    return owners.length ? owners : memberIds;
  });
  const valid = title.trim() && (kind !== 'liste' || steps.length > 0 || stepDraft.trim());
  return (
    <Dialog open={!!dialog} onClose={onClose} title={goal ? "Modifier l'objectif" : 'Nouvel objectif'} icon={Target} width="m" footer={<Footer onCancel={onClose} submitLabel={goal ? 'Enregistrer' : 'Créer'} disabled={!valid} onDelete={goal ? () => (app.deleteGoal(goal.id), onClose()) : undefined} />}>
      <Form
        onSubmit={() => {
          if (!valid) return;
          const allSteps = stepDraft.trim() ? [...steps, { id: uid(), label: stepDraft.trim(), done: false }] : steps;
          // One person = owner; everyone = the household (NOUS); some of them = owners, with NOUS as owner.
          const mine = people.filter((id) => memberIds.includes(id));
          const owner = mine.length === 1 ? mine[0]! : NOUS;
          const owners = mine.length > 1 && mine.length < memberIds.length ? mine : undefined;
          app.saveGoal({ id: goal?.id, title: title.trim(), period, kind, source: kind === 'auto' ? source : undefined, target: kind === 'liste' ? allSteps.length : target, value, steps: kind === 'liste' ? allSteps : [], icon, owner, owners });
          onClose();
        }}
      >
        <Field label="Objectif" htmlFor="goal-title">
          <TextInput id="goal-title" data-autofocus={goal ? undefined : ''} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Courir 40 km" />
        </Field>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="Période">
            <ChoiceChips label="Période" value={period} onChange={setPeriod} options={(['semaine', 'mois', 'annee'] as const).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          </Field>
          <Field label="Suivi">
            <ChoiceChips
              label="Suivi"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'auto', label: 'Automatique' },
                { value: 'compteur', label: 'Compteur' },
                { value: 'liste', label: 'Étapes' },
              ]}
            />
          </Field>
        </div>
        {kind === 'auto' && (
          <>
            <Field label="Calculé à partir de">
              <ChoiceChips label="Source" value={source} onChange={setSource} options={(Object.keys(GOAL_SOURCES) as GoalSource[]).map((s) => ({ value: s, label: GOAL_SOURCES[s].label }))} />
            </Field>
            <Field label="Cible" help={GOAL_SOURCES[source].unit(target)}>
              <NumberStepper label="cible" value={target} min={1} max={5000} onChange={setTarget} className="max-w-[200px]" />
            </Field>
          </>
        )}
        {kind === 'compteur' && (
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <Field label="Cible">
              <NumberStepper label="cible" value={target} min={1} max={10000} onChange={setTarget} />
            </Field>
            <Field label="Déjà fait">
              <NumberStepper label="déjà fait" value={value} min={0} max={10000} onChange={setValue} />
            </Field>
          </div>
        )}
        {kind === 'liste' && (
          <Field label="Étapes">
            <ul className="flex flex-col gap-1.5">
              {steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="tnum w-5 text-center text-label-s text-text-muted">{i + 1}</span>
                  <TextInput value={s.label} onChange={(e) => setSteps(steps.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))} aria-label={`Étape ${i + 1}`} />
                  <IconButton icon={X} label="Retirer l'étape" variant="ghost" size="s" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} />
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="w-5" />
                <TextInput
                  icon={Plus}
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && stepDraft.trim()) {
                      e.preventDefault();
                      setSteps([...steps, { id: uid(), label: stepDraft.trim(), done: false }]);
                      setStepDraft('');
                    }
                  }}
                  placeholder="Ajouter une étape (Entrée)"
                  aria-label="Nouvelle étape"
                />
                <span className="w-9" />
              </li>
            </ul>
          </Field>
        )}
        {several && (
          <Field label="Pour qui ?" help={people.length > 1 ? 'Objectif commun : il additionne ce que chacun fait' : undefined}>
            <PeopleChips value={people} onChange={setPeople} />
          </Field>
        )}
        <Field label="Icône">
          <ChoiceChips label="Icône" iconOnly value={icon} onChange={setIcon} options={(Object.keys(GOAL_ICONS) as GoalIcon[]).map((k) => ({ value: k, label: k, icon: GOAL_ICONS[k] }))} />
        </Field>
      </Form>
    </Dialog>
  );
}

// ── Habitude ─────────────────────────────────────────────────────────────────

function HabitDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'habit' }> | null; onClose: () => void }) {
  const app = useApp.getState();
  const habit = dialog?.id ? app.data.habits.find((h) => h.id === dialog.id) : undefined;
  const [title, setTitle] = useState(habit?.title ?? '');
  const [icon, setIcon] = useState<HabitIcon>(habit?.icon ?? 'droplets');
  const [days, setDays] = useState<number[]>(habit?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const several = app.data.members.length > 1;
  const [owner, setOwner] = useState<string>(habit?.owner ?? app.data.settings.meId ?? NOUS);
  return (
    <Dialog open={!!dialog} onClose={onClose} title={habit ? "Modifier l'habitude" : 'Nouvelle habitude'} icon={Flame} footer={<Footer onCancel={onClose} submitLabel={habit ? 'Enregistrer' : 'Ajouter'} disabled={!title.trim() || days.length === 0} onDelete={habit ? () => (app.deleteHabit(habit.id), onClose()) : undefined} />}>
      <Form
        onSubmit={() => {
          if (!title.trim() || !days.length) return;
          app.saveHabit({ id: habit?.id, title: title.trim(), icon, days, owner });
          onClose();
        }}
      >
        <Field label="Habitude" htmlFor="habit-title">
          <TextInput id="habit-title" data-autofocus={habit ? undefined : ''} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. 10 min de méditation" />
        </Field>
        <Field label="Icône">
          <ChoiceChips label="Icône" iconOnly value={icon} onChange={setIcon} options={(Object.keys(HABIT_ICONS) as HabitIcon[]).map((k) => ({ value: k, label: HABIT_ICONS[k].label, icon: HABIT_ICONS[k].icon }))} />
        </Field>
        {several && (
          <Field label="Pour qui ?">
            <WhoChips value={owner} onChange={setOwner} allowNous={false} />
          </Field>
        )}
        <Field label="Jours">
          <div className="flex flex-wrap items-center gap-3">
            <DayPicker multiple value={days} onChange={setDays} />
            <div className="flex gap-1.5">
              <Button variant="ghost" size="s" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
                Tous
              </Button>
              <Button variant="ghost" size="s" onClick={() => setDays([0, 1, 2, 3, 4])}>
                En semaine
              </Button>
            </div>
          </div>
        </Field>
      </Form>
    </Dialog>
  );
}

// ── Sortie running ───────────────────────────────────────────────────────────

function RunDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'run' }> | null; onClose: () => void }) {
  const run = useApp((s) => (dialog?.id ? s.data.runs.find((r) => r.id === dialog.id) : undefined));
  return (
    <Dialog open={!!dialog} onClose={onClose} title={run ? 'Modifier la sortie' : 'Nouvelle sortie'} icon={Footprints}>
      {dialog && <RunForm key={dialog.id ?? 'new'} run={run} date={dialog.date} onSaved={onClose} />}
    </Dialog>
  );
}

// ── Programme ────────────────────────────────────────────────────────────────

function ProgramDialog({ dialog, onClose }: { dialog: Extract<DialogState, { kind: 'program' }> | null; onClose: () => void }) {
  const app = useApp.getState();
  const program = dialog?.id ? app.data.programs.find((p) => p.id === dialog.id) : undefined;
  const [name, setName] = useState(program?.name ?? '');
  const [copyFrom, setCopyFrom] = useState<string | undefined>(undefined);
  const several = app.data.members.length > 1;
  const [owner, setOwner] = useState<string>(program?.owner ?? app.data.settings.meId ?? NOUS);
  return (
    <Dialog open={!!dialog} onClose={onClose} title={program ? 'Renommer le programme' : 'Nouveau programme'} icon={Dumbbell} width="s" footer={<Footer onCancel={onClose} submitLabel={program ? 'Enregistrer' : 'Créer'} disabled={!name.trim()} />}>
      <Form
        onSubmit={() => {
          if (!name.trim()) return;
          if (program) app.saveProgram({ ...program, name: name.trim(), owner });
          else {
            const source = app.data.programs.find((p) => p.id === copyFrom);
            const id = uid();
            app.saveProgram({ id, name: name.trim(), exercises: source ? source.exercises.map((e) => ({ ...e, id: uid() })) : [], owner });
            app.set({ programId: id });
          }
          onClose();
        }}
      >
        <Field label="Nom" htmlFor="program-name">
          <TextInput id="program-name" data-autofocus={program ? undefined : ''} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Haut du corps" />
        </Field>
        {several && (
          <Field label="Pour qui ?">
            <WhoChips value={owner} onChange={setOwner} allowNous={false} />
          </Field>
        )}

        {!program && app.data.programs.length > 0 && (
          <Field label="Partir d'un programme existant" help="Facultatif : ses exercices sont copiés.">
            <Select value={copyFrom} onChange={setCopyFrom} placeholder="Programme vide" options={app.data.programs.map((p) => ({ value: p.id, label: p.name, icon: Dumbbell }))} />
          </Field>
        )}
      </Form>
    </Dialog>
  );
}

// ── Article de courses ───────────────────────────────────────────────────────

function ItemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp.getState();
  const lists = app.data.lists;
  const [text, setText] = useState('');
  const [listId, setListId] = useState(app.data.activeListId ?? lists[0]?.id);
  const [added, setAdded] = useState<string[]>([]);
  const add = () => {
    if (!text.trim()) return;
    if (listId) app.setActiveList(listId);
    const p = parseItem(text);
    app.addItem(p.name, p.qty);
    setAdded([...added, p.name]);
    setText('');
  };
  return (
    <Dialog open={open} onClose={onClose} title="Ajouter aux courses" icon={ListPlus} width="s" footer={<Button onClick={onClose}>Terminé</Button>}>
      <div className="flex flex-col gap-4">
        {lists.length > 1 && (
          <Field label="Liste">
            <ChoiceChips label="Liste" value={listId ?? ''} onChange={setListId} options={lists.map((l) => ({ value: l.id, label: l.name }))} />
          </Field>
        )}
        <Field label="Article" help="Entrée pour ajouter, puis le suivant.">
          <TextInput
            data-autofocus=""
            icon={Plus}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="ex. 6 œufs"
          />
        </Field>
        {added.length > 0 && <p className="text-body-s text-text-signal">Ajouté : {added.join(', ')}</p>}
      </div>
    </Dialog>
  );
}

// ── Fin de séance ────────────────────────────────────────────────────────────

function FinishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const active = useApp((s) => s.data.active);
  const app = useApp.getState();
  const [keep, setKeep] = useState(true);
  const now = useNow();
  if (!active) return <Dialog open={false} onClose={onClose} title="" />;
  const sets = active.exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.done).length;
  const minutes = (now - active.startedAt) / 60_000;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Terminer la séance ${active.programName}\u00a0?`}
      icon={Flag}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Continuer la séance
          </Button>
          <Button onClick={() => app.finishSession(keep)} disabled={done === 0}>
            Enregistrer la séance
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-3">
          {[
            ['Durée', duration(minutes)],
            ['Séries faites', `${done} / ${sets.length}`],
            ['Volume', kg(Math.round(sessionVolume({ ...active, id: '', endedAt: now })))],
          ].map(([l, v]) => (
            <div key={l} className="inset-tile rounded-lg px-3 py-2.5">
              <dt className="text-label-s text-text-secondary">{l}</dt>
              <dd className="tnum text-data-m text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
        {done === 0 && <p className="text-body-s text-text-warn">Aucune série validée : coche au moins une série pour enregistrer la séance.</p>}
        <Toggle checked={keep} onChange={setKeep} label="Garder ces charges pour la prochaine fois" description="Les charges et répétitions de ta dernière série deviennent celles du programme." />
      </div>
    </Dialog>
  );
}

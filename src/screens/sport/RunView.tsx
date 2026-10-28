/**
 * Running: distance per week (curve that draws itself), records, the form to log a run and the list of runs.
 * Logging a run ticks that day's running task of the agenda.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { Footprints, Gauge, Mountain, Trash2, Trophy } from 'lucide-react';
import { useApp } from '../../store/app';
import { ownedBy } from '../../domain/people';
import type { Run } from '../../domain/types';
import { kmIn, periodRange, runsIn, weeklySeries } from '../../domain/stats';
import { addDays, fromIso, shortDate, todayIso } from '../../lib/dates';
import { duration, durationInput, km, num, pace, parseDuration } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, IconBox, IconButton, Panel, PanelHeader } from '../../ui/atoms';
import { AreaCurve, KpiCard, KpiText } from '../../ui/charts';
import { ChoiceChips, Field, TextInput } from '../../ui/forms';
import { revealVariants } from '../../theme/motion';

export function RunView() {
  const allRuns = useApp((s) => s.data.runs);
  const person = useApp((s) => s.person);
  const runs = allRuns.filter((x) => ownedBy(x.owner, person));
  const app = useApp.getState();
  const today = todayIso();
  const week = periodRange('semaine', today);
  const month = periodRange('mois', today);
  const year = periodRange('annee', today);
  const last30 = runsIn(runs, { from: addDays(today, -29), to: today });
  const avgPace = last30.reduce((s, r) => s + r.durationMin, 0) / Math.max(0.1, last30.reduce((s, r) => s + r.distanceKm, 0));
  const longest = runs.reduce((m, r) => Math.max(m, r.distanceKm), 0);
  const fastest = runs.filter((r) => r.distanceKm >= 3).reduce((m, r) => Math.min(m, r.durationMin / r.distanceKm), Infinity);
  const series = weeklySeries(12, (from, to) => Math.round(kmIn(runs, { from, to }) * 10) / 10, today).map((w) => ({ label: `${fromIso(w.week).getDate()}/${fromIso(w.week).getMonth() + 1}`, value: w.value }));
  const reveal = revealVariants();
  const kpis = [
    <KpiCard key="a" label="Distance cette semaine" value={Math.round(kmIn(runs, week) * 10) / 10} decimals={1} suffix="km" active />,
    <KpiCard key="b" label="Distance ce mois" value={Math.round(kmIn(runs, month) * 10) / 10} decimals={1} suffix="km" />,
    <KpiText key="c" label="Allure moyenne sur 30 jours" value={last30.length ? pace(avgPace) : '–'} />,
    <KpiCard key="d" label="Sortie la plus longue" value={Math.round(longest * 10) / 10} decimals={1} suffix="km" />,
  ];
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div initial="hidden" animate="show" className="grid shrink-0 grid-cols-4 gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:gap-3 max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none]">
        {kpis.map((k, i) => (
          <motion.div key={i} variants={reveal} custom={i} className="flex min-w-0 flex-col max-md:w-[44%] max-md:shrink-0 max-md:snap-start [&>*]:flex-1">
            {k}
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} custom={2} className="flex min-h-0 flex-col">
          <Panel className="flex-1">
            <PanelHeader title="Kilomètres par semaine" icon={Footprints} />
            <div className="min-h-0 flex-1 px-5 pt-2 pb-4 max-md:h-[230px] max-md:flex-none max-md:px-3"> 
              <AreaCurve data={series} format={km} />
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-3 px-5 pb-5 max-md:grid-cols-1 max-md:gap-2 max-md:px-4 max-md:pb-4">
              <Stat icon={Footprints} label="Sorties ce mois" value={String(runsIn(runs, month).length)} />
              <Stat icon={Mountain} label="Total de l'année" value={km(kmIn(runs, year))} />
              <Stat icon={Trophy} label="Meilleure allure" value={Number.isFinite(fastest) ? pace(fastest) : '–'} />
            </div>
          </Panel>
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={3} className="flex min-h-0 flex-col gap-4">
          <Panel className="shrink-0">
            <PanelHeader title="Nouvelle sortie" icon={Gauge} />
            <div className="px-5 pt-2 pb-5">
              <RunForm onSaved={() => undefined} compact />
            </div>
          </Panel>
          <Panel className="min-h-0 flex-1">
            <PanelHeader title="Sorties" count={runs.length} />
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1 pb-3">
              {sorted.length === 0 && <li className="px-2 py-3 text-body-s text-text-secondary">Tes sorties apparaîtront ici.</li>}
              {sorted.slice(0, 60).map((r) => (
                <li key={r.id} className="group/run flex items-center gap-3 rounded-md px-2 py-2 hover:bg-bg-card/60">
                  <button type="button" onClick={() => app.openDialog({ kind: 'run', id: r.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="tnum w-14 shrink-0 text-label-s text-text-secondary">{shortDate(r.date)}</span>
                    <span className="tnum min-w-0 flex-1 truncate text-label-m text-text-primary">{km(r.distanceKm)}</span>
                    <span className="tnum text-caption text-text-secondary">{duration(r.durationMin)}</span>
                    <span className="tnum w-20 text-right text-label-s text-text-primary">{pace(r.durationMin / r.distanceKm)}</span>
                  </button>
                  <IconButton icon={Trash2} label="Supprimer la sortie" variant="danger" size="xs" className="opacity-0 group-hover/run:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-70" onClick={() => app.deleteRun(r.id)} />
                </li>
              ))}
            </ul>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: typeof Footprints; label: string; value: string }) {
  return (
    <div className="inset-tile flex items-center gap-3 rounded-lg px-3 py-2.5">
      <IconBox icon={icon} tone="glass" size="s" />
      <div className="min-w-0">
        <p className="truncate text-label-s text-text-secondary">{label}</p>
        <p className="tnum truncate text-data-m text-text-primary">{value}</p>
      </div>
    </div>
  );
}

const FEELINGS = [
  { value: '5', label: 'Facile' },
  { value: '3', label: 'Correct' },
  { value: '1', label: 'Difficile' },
] as const;

/** Date, distance, time, feeling; shows the pace live. Used in Running and in the run dialog. */
export function RunForm({ run, date, onSaved, compact }: { run?: Run; date?: string; onSaved: () => void; compact?: boolean }) {
  const app = useApp.getState();
  const [day, setDay] = useState(run?.date ?? date ?? todayIso());
  const [dist, setDist] = useState(run ? num(run.distanceKm, 1) : '');
  const [time, setTime] = useState(run ? durationInput(run.durationMin) : '');
  const [feeling, setFeeling] = useState<string>(String(run?.feeling ?? 3));
  const [tried, setTried] = useState(false);
  const d = parseFloat(dist.replace(',', '.'));
  const m = parseDuration(time);
  const valid = Number.isFinite(d) && d > 0 && m !== null && m > 0;
  const submit = () => {
    setTried(true);
    if (!valid) return;
    app.saveRun({ id: run?.id, date: day, distanceKm: Math.round(d * 100) / 100, durationMin: Math.round(m! * 100) / 100, feeling: Number(feeling) });
    if (!run) {
      setDist('');
      setTime('');
      setTried(false);
    }
    onSaved();
  };
  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={cn('grid gap-3', compact ? 'grid-cols-[1.2fr_0.8fr_1fr] max-md:grid-cols-2 max-md:[&>*:first-child]:col-span-2' : 'grid-cols-3 max-md:grid-cols-2 max-md:[&>*:first-child]:col-span-2')}>
        <Field label="Date" htmlFor="run-date">
          <TextInput id="run-date" type="date" value={day} max={todayIso()} onChange={(e) => setDay(e.target.value || todayIso())} />
        </Field>
        <Field label="Distance" htmlFor="run-dist" error={tried && !(Number.isFinite(d) && d > 0) ? 'En km, ex. 8,5' : null}>
          <TextInput id="run-dist" inputMode="decimal" placeholder="8,5" value={dist} onChange={(e) => setDist(e.target.value)} invalid={tried && !(Number.isFinite(d) && d > 0)} trailing={<span className="text-caption text-text-muted">km</span>} />
        </Field>
        <Field label="Durée" htmlFor="run-time" error={tried && !(m && m > 0) ? 'ex. 48:30' : null}>
          <TextInput id="run-time" placeholder="48:30" value={time} onChange={(e) => setTime(e.target.value)} invalid={tried && !(m && m > 0)} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ChoiceChips label="Ressenti" value={feeling as '5' | '3' | '1'} onChange={setFeeling} options={FEELINGS.map((f) => ({ value: f.value, label: f.label }))} />
        <span className="tnum shrink-0 text-label-m text-text-secondary">
          Allure <span className="text-text-primary">{valid ? pace(m! / d) : '–'}</span>
        </span>
      </div>
      <Button type="submit" icon={Footprints} className={compact ? 'w-full' : undefined}>
        {run ? 'Enregistrer' : 'Ajouter la sortie'}
      </Button>
    </form>
  );
}

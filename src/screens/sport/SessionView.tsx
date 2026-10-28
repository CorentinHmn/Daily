/**
 * The gym session in progress: one card per exercise, each set with its reps / load and a tick; ticking a set starts
 * the rest timer (floating liquid-glass pill). On the right: elapsed time, progress, and what was lifted last time.
 */
import { useEffect } from 'react';
import { useNow } from '../../ui/useNow';
import { useIsMobile } from '../../ui/useMedia';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Flag, History, Plus, SkipForward, Timer, X } from 'lucide-react';
import { useApp } from '../../store/app';
import { ownedBy } from '../../domain/people';
import { sessionVolume } from '../../domain/stats';
import { shortDate } from '../../lib/dates';
import { clock, kg } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, ICON_STROKE, Panel, PanelHeader } from '../../ui/atoms';
import { NumberStepper } from '../../ui/forms';
import { Ring } from '../../ui/charts';
import { useLiquidGlass } from '../../ui/glass';
import { revealVariants } from '../../theme/motion';

export function SessionView() {
  const active = useApp((s) => s.data.active)!;
  const all = useApp((s) => s.data.sessions);
  const meId = useApp((s) => s.data.settings.meId);
  // « La dernière fois » = my own previous session of this programme.
  const sessions = all.filter((x) => ownedBy(x.owner, meId ?? null));
  const app = useApp.getState();
  const now = useNow();
  const sets = active.exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.done).length;
  const elapsed = (now - active.startedAt) / 1000;
  const previous = [...sessions].filter((s) => s.programId === active.programId).sort((a, b) => b.startedAt - a.startedAt)[0];
  const volume = sessionVolume({ ...active, id: '', endedAt: now });
  const reveal = revealVariants();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(440px,1fr)_minmax(0,340px)] gap-4 pb-1 max-md:grid-cols-1">
        <div className="relative flex min-h-0 flex-col">
        <motion.ul initial="hidden" animate="show" className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 pb-24">
          {active.exercises.map((e, ei) => {
            const allDone = e.sets.every((s) => s.done);
            return (
              <motion.li key={e.exerciseId + ei} variants={reveal} custom={ei} className={cn('glass-panel rounded-xl px-5 py-4 transition-[border-color]', allDone && 'border-signal-default/40')}>
                <div className="mb-2 flex items-center gap-3">
                  <span className={cn('tnum inline-flex size-7 items-center justify-center rounded-full text-label-s', allDone ? 'bg-signal-default text-text-on-accent' : 'bg-accent-soft text-text-accent')}>{allDone ? <Check size={14} strokeWidth={2.5} aria-hidden /> : ei + 1}</span>
                  <h3 className="min-w-0 flex-1 truncate text-title-s text-text-primary">{e.name}</h3>
                  <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
                    <Timer size={13} strokeWidth={ICON_STROKE} aria-hidden />
                    Repos {clock(e.restSec)}
                  </span>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,150px)_minmax(0,170px)_1fr] items-center gap-x-3 gap-y-1.5 max-md:grid-cols-[20px_minmax(0,1fr)_minmax(0,1.2fr)_auto] max-md:gap-x-2">
                  <span className="text-caption text-text-muted">
                    <span className="max-md:hidden">Série</span>
                    <span className="md:hidden">N°</span>
                  </span>
                  <span className="text-caption text-text-muted">Répétitions</span>
                  <span className="text-caption text-text-muted">Charge</span>
                  <span />
                  {e.sets.map((s, si) => (
                    <SetRow key={si} index={si} reps={s.reps} weight={s.weight} done={s.done} onReps={(v) => app.updateSet(ei, si, { reps: v })} onWeight={(v) => app.updateSet(ei, si, { weight: v })} onToggle={() => app.toggleSet(ei, si)} />
                  ))}
                </div>
                <button type="button" onClick={() => app.addSet(ei)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-label-s text-text-muted transition-colors hover:bg-bg-card/70 hover:text-text-accent">
                  <Plus size={14} strokeWidth={ICON_STROKE} aria-hidden />
                  Série
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
        <RestTimer />
        </div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={1} className="flex min-h-0 flex-col gap-4 max-md:contents">
          <Panel className="shrink-0 max-md:order-first">
            <PanelHeader title={`Séance ${active.programName}`} />
            <div className="flex items-center gap-5 px-5 pt-2 pb-5">
              <Ring value={sets.length ? done / sets.length : 0} size={112} stroke={9}>
                <span className="tnum text-data-m text-text-primary">{clock(elapsed)}</span>
                <span className="text-caption text-text-secondary">écoulé</span>
              </Ring>
              <dl className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <dt className="text-label-s text-text-secondary">Séries faites</dt>
                  <dd className="tnum text-data-m text-text-primary">
                    {done} / {sets.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-label-s text-text-secondary">Volume</dt>
                  <dd className="tnum text-data-m text-text-primary">{kg(Math.round(volume))}</dd>
                </div>
              </dl>
            </div>
            <div className="flex gap-2 border-t border-border-subtle px-5 py-4">
              <Button variant="ghost" icon={X} onClick={() => app.cancelSession()}>
                Abandonner
              </Button>
              <Button icon={Flag} className="flex-1" onClick={() => app.openDialog({ kind: 'finish-session' })}>
                Terminer
              </Button>
            </div>
          </Panel>
          <Panel className="min-h-0 flex-1 max-md:order-last">
            <PanelHeader title="La dernière fois" icon={History} count={previous ? shortDate(previous.date) : undefined} />
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-1 pb-3">
              {!previous && <li className="px-2 py-3 text-body-s text-text-secondary">Première séance de ce programme : pas encore de point de comparaison.</li>}
              {previous?.exercises.map((e) => {
                const top = e.sets.filter((s) => s.done).sort((a, b) => b.weight - a.weight)[0];
                return (
                  <li key={e.exerciseId} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-body-s text-text-primary">{e.name}</span>
                    <span className="tnum text-label-s text-text-secondary">
                      {e.sets.filter((s) => s.done).length} × {top?.reps ?? 0}
                    </span>
                    <span className="tnum w-16 text-right text-label-s text-text-primary">{top?.weight ? kg(top.weight) : 'PDC'}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function SetRow({ index, reps, weight, done, onReps, onWeight, onToggle }: { index: number; reps: number; weight: number; done: boolean; onReps: (v: number) => void; onWeight: (v: number) => void; onToggle: () => void }) {
  return (
    <>
      <span className={cn('tnum text-label-m', done ? 'text-text-signal' : 'text-text-secondary')}>{index + 1}</span>
      <NumberStepper label={`répétitions série ${index + 1}`} value={reps} min={0} max={100} onChange={onReps} className={cn('h-9 max-md:h-11', done && 'opacity-70')} />
      <NumberStepper label={`charge série ${index + 1}`} value={weight} step={2.5} max={500} decimals={1} suffix="kg" onChange={onWeight} className={cn('h-9 max-md:h-11', done && 'opacity-70')} />
      <div className="flex justify-end">
        <CheckCircle checked={done} onChange={onToggle} label={done ? `Annuler la série ${index + 1}` : `Valider la série ${index + 1}`} />
      </div>
    </>
  );
}

/** Rest countdown in liquid glass: floating at the bottom of the exercises; on a phone, just above the tab bar. */
function RestTimer() {
  const rest = useApp((s) => s.rest);
  const mobile = useIsMobile();
  const app = useApp.getState();
  const now = useNow(250);
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 22, strength: 16 });
  const left = rest ? (rest.endsAt - now) / 1000 : 0;
  useEffect(() => {
    if (rest && left <= -1.2) app.set({ rest: null });
  }, [rest, left, app]);
  const timer = (
    <AnimatePresence>
      {rest && (
        <motion.div
          initial={{ y: 40, opacity: mobile ? 0 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: mobile ? 0 : 1 }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
          className={mobile ? 'pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 flex justify-center px-3' : 'pointer-events-none absolute inset-x-0 bottom-4 flex justify-center'}
        >
          <div ref={glass} role="timer" aria-live="off" className={cn('liquid pointer-events-auto flex items-center gap-4 rounded-full py-2 pr-2 pl-2.5', mobile && 'liquid-bar gap-2.5')}>
            <Ring value={Math.max(0, left) / rest.total} size={52} stroke={5} tone={left <= 0 ? 'signal' : 'accent'}>
              <Timer size={16} strokeWidth={ICON_STROKE} aria-hidden className={left <= 0 ? 'text-text-signal' : 'text-text-accent'} />
            </Ring>
            <div className="min-w-[150px] max-md:min-w-[64px]">
              <p className="tnum text-data-m text-text-primary">{left > 0 ? clock(left) : 'Go !'}</p>
              <p className="max-w-[180px] truncate text-caption text-text-secondary max-md:hidden">Repos après {rest.label}</p>
            </div>
            <Button variant="secondary" size="s" onClick={() => app.set({ rest: { ...rest, endsAt: rest.endsAt + 15_000, total: rest.total + 15 } })}>
              +15 s
            </Button>
            <Button variant="secondary" size="s" icon={SkipForward} onClick={() => app.set({ rest: null })}>
              Passer
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  // On a phone the page scrolls inside a transformed parent: `fixed` needs the body.
  return mobile ? createPortal(timer, document.body) : timer;
}


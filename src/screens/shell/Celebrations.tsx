/**
 * Congratulations: when the day's tasks are all ticked (from the moment the last one is) and when a goal reaches
 * 100 %, a liquid-glass card comes out at the top with a burst, then goes away by itself (a tap closes it sooner).
 * It watches the data, so it also fires when the other person ticks the last task; not while the app is still
 * catching up with the household (on opening, nothing old is celebrated).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { PartyPopper, Trophy, type LucideIcon } from 'lucide-react';
import { useApp } from '../../store/app';
import { useSync } from '../../sync/sync';
import { concerns, goalFor } from '../../domain/people';
import { goalProgress } from '../../domain/stats';
import { todayIso } from '../../lib/dates';
import { ICON_STROKE } from '../../ui/atoms';
import { burst } from '../../ui/burst';
import { SPRING, reducedMotion } from '../../ui/liquid';

interface Cheer {
  id: number;
  icon: LucideIcon;
  title: string;
  text: string;
}

const SHOW_MS = 3800;

/** The card's way in: from 70 %, on the bars' spring (its overshoot halved). */
const IN = SPRING.frames.map(({ p }) => `translateY(${((1 - Math.min(1, p)) * -14).toFixed(2)}px) scale(${(0.7 + 0.3 * (p > 1 ? 1 + (p - 1) * 0.5 : p)).toFixed(4)})`);

export function Celebrations() {
  const data = useApp((s) => s.data);
  const caughtUp = useSync((s) => s.caughtUp);
  const [queue, setQueue] = useState<Cheer[]>([]);
  const seen = useRef<{ day: string; dayDone: boolean; reached: Set<string> } | null>(null);
  const wasCaughtUp = useRef(false);
  const next = useRef(1);
  const shift = useCallback(() => setQueue((q) => q.slice(1)), []);

  // What is done now, for this device's person (their tasks and the household's; their goals and the shared ones).
  const me = data.settings.meId ?? null;
  const today = todayIso();
  const mine = data.tasks.filter((t) => t.date === today && concerns(t.assignee, me));
  const dayDone = mine.length >= 2 && mine.every((t) => t.done);
  const reached = data.goals.filter((g) => goalFor(g, me) && goalProgress(g, data).ratio >= 1);
  const reachedKey = reached.map((g) => g.id).join(',');

  useEffect(() => {
    const now = { day: today, dayDone, reached: new Set(reached.map((g) => g.id)) };
    const before = seen.current;
    seen.current = now;
    // Until the household's data is here (and at that moment), only the baseline is taken.
    const ready = caughtUp && wasCaughtUp.current;
    wasCaughtUp.current = caughtUp;
    if (!ready || !before) return;
    const cheers: Cheer[] = [];
    if (dayDone && !(before.day === today && before.dayDone)) cheers.push({ id: next.current++, icon: PartyPopper, title: 'Journée bouclée\u202f!', text: `Les ${mine.length} tâches d'aujourd'hui sont faites. Bravo\u202f!` });
    for (const g of reached) if (!before.reached.has(g.id)) cheers.push({ id: next.current++, icon: Trophy, title: 'Objectif atteint\u202f!', text: `« ${g.title} » : c'est fait, bravo\u202f!` });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a reaction to a change of the data, shown once
    if (cheers.length) setQueue((q) => [...q, ...cheers]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by what is done, not by every data object
  }, [caughtUp, today, dayDone, reachedKey]);

  const current = queue[0];
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-[1340] flex justify-center px-4">
      <AnimatePresence>{current && <CheerCard key={current.id} cheer={current} onDone={shift} />}</AnimatePresence>
    </div>,
    document.body,
  );
}

function CheerCard({ cheer, onDone }: { cheer: Cheer; onDone: () => void }) {
  const badge = useRef<HTMLSpanElement>(null);
  const still = reducedMotion();
  // Burst out of the badge as the card lands, then leave by itself.
  useLayoutEffect(() => {
    const t = window.setTimeout(() => {
      if (!badge.current) return;
      burst(badge.current, { count: 14, reach: 34 });
      burst(badge.current, { color: 'var(--color-accent-default)', count: 8, reach: 26, ring: false });
    }, 160);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const Icon = cheer.icon;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      onClick={onDone}
      initial={still ? { opacity: 0 } : { opacity: 0, transform: IN[0] }}
      animate={still ? { opacity: 1 } : { opacity: 1, transform: IN, transition: { transform: { duration: SPRING.ms / 1000, ease: 'linear' }, opacity: { duration: 0.12 } } }}
      exit={{ opacity: 0, transform: 'translateY(-10px) scale(0.94)', transition: { duration: 0.22, ease: [0.5, 0, 0.9, 0.6] } }}
      className="liquid liquid-strong pointer-events-auto flex w-[min(100%,380px)] cursor-pointer items-center gap-4 rounded-2xl py-3.5 pr-5 pl-3.5"
    >
      <span ref={badge} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-signal-default text-text-on-accent shadow-hairline-top">
        <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-title-s text-text-primary">{cheer.title}</span>
        <span className="block text-body-s text-text-secondary">{cheer.text}</span>
      </span>
    </motion.div>
  );
}

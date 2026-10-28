/**
 * Shell. Desktop app: .app-frame is the Figma « Device » frame (1440 × 972, radius 48) whose bezel is liquid glass
 * over the blurred wallpaper; .app-window is the screen (radius 34) with the aurora behind the frosted panels. The
 * rail's dots are the window controls. Rail = Aujourd'hui, Semaine, Sport, Objectifs, Courses; + = quick add.
 * Phone (below 768 px): MobileShell, the same menus in a floating tab bar.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, CalendarRange, Dumbbell, Footprints, ListPlus, ShoppingCart, Sun, Target, Repeat } from 'lucide-react';
import { desktop, useMaximized } from './desktop';
import { useApp, type View } from './store/app';
import { todayIso, weekStart } from './lib/dates';
import { NavRail, type NavItem } from './ui/navigation';
import { Menu, ToastStack } from './ui/overlays';
import { useBezelGlass } from './ui/glass';
import { motionTokens } from './theme/motion';
import { TodayScreen } from './screens/today/TodayScreen';
import { WeekScreen } from './screens/week/WeekScreen';
import { SportScreen } from './screens/sport/SportScreen';
import { GoalsScreen } from './screens/goals/GoalsScreen';
import { ShoppingScreen } from './screens/shopping/ShoppingScreen';
import { Dialogs } from './screens/dialogs/Dialogs';
import { MobileShell } from './screens/shell/MobileShell';
import { useIsMobile } from './ui/useMedia';
import { initSync } from './sync/sync';

const SCREENS: Record<View, ComponentType> = {
  today: TodayScreen,
  week: WeekScreen,
  sport: SportScreen,
  goals: GoalsScreen,
  shopping: ShoppingScreen,
};

export function App() {
  const view = useApp((s) => s.view);
  const navigate = useApp((s) => s.navigate);
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const theme = useApp((s) => s.data.settings.theme);
  const onboarded = useApp((s) => s.data.onboarded);
  const remaining = useApp((s) => {
    const list = s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0];
    return list ? list.items.filter((i) => !i.checked).length : 0;
  });
  const sessionLive = useApp((s) => !!s.data.active);
  const maximized = useMaximized();
  const bezel = useBezelGlass<HTMLDivElement>({ inset: 14.5, outerRadius: 48, innerRadius: 34, enabled: !!desktop && !maximized });
  const today = useToday();
  const mobile = useIsMobile();
  const [quickAdd, setQuickAdd] = useState(false);
  const fab = useRef<HTMLButtonElement | null>(null);
  useShortcuts(useCallback(() => setQuickAdd(true), []));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Status bar / browser chrome colour of the phone follows the app's theme, not the system's.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = theme === 'night' ? '#0e1014' : '#eef1f5';
      meta.removeAttribute('media');
    }
  }, [theme]);

  // Household sync (Supabase): resumes the session and the household of this device, if any.
  useEffect(() => {
    void initSync();
  }, []);

  // A new week is filled from the semaine type as soon as it starts.
  useEffect(() => {
    if (onboarded) useApp.getState().ensureWeek(weekStart(today));
  }, [today, onboarded]);

  const nav: NavItem<View>[] = [
    { id: 'today', label: "Aujourd'hui", icon: Sun },
    { id: 'week', label: 'Semaine', icon: CalendarRange },
    { id: 'sport', label: 'Sport', icon: Dumbbell, live: sessionLive && view !== 'sport' },
    { id: 'goals', label: 'Objectifs', icon: Target },
    { id: 'shopping', label: 'Courses', icon: ShoppingCart, badge: remaining ? String(remaining) : undefined },
  ];

  const bridge = desktop;
  const windowControls = bridge && {
    maximized,
    onClose: () => bridge.close(),
    onMinimize: () => bridge.minimize(),
    onToggleMaximize: () => bridge.toggleMaximize(),
  };
  const Screen = SCREENS[view];
  const t = motionTokens();
  const open = useApp.getState().openDialog;

  const overlays = (
    <>
      <Menu
        open={quickAdd}
        anchor={fab}
        onClose={() => setQuickAdd(false)}
        align={mobile ? 'end' : 'start'}
        width={250}
        items={[
          { label: 'Tâche', icon: CalendarDays, hint: mobile ? undefined : 'Ctrl N', onSelect: () => open({ kind: 'task', date: todayIso() }) },
          { label: 'Routine de la semaine type', icon: Repeat, onSelect: () => open({ kind: 'routine' }) },
          { label: 'Article de courses', icon: ListPlus, onSelect: () => open({ kind: 'item' }) },
          { label: 'Sortie running', icon: Footprints, onSelect: () => open({ kind: 'run' }) },
          { label: 'Objectif', icon: Target, onSelect: () => open({ kind: 'goal' }) },
        ]}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <Dialogs />
    </>
  );
  const setFab = (el: HTMLButtonElement | null) => {
    fab.current = el;
  };

  if (mobile) {
    return (
      <>
        <MobileShell items={nav} active={view} onNavigate={navigate} onFab={() => setQuickAdd((o) => !o)} fabRef={setFab} screenKey={`${view}-${today}`}>
          <Screen />
        </MobileShell>
        {overlays}
      </>
    );
  }

  return (
    <div className="app-frame h-full">
      <div ref={bezel} aria-hidden className="app-bezel" />
      <span aria-hidden className="app-frame-light" />
      {/* Window drag handles: the four edges of the bezel. Nothing clickable inside (a drag region swallows every
          click within it on Windows). */}
      <span aria-hidden className="app-drag-edge app-drag-edge-top" />
      <span aria-hidden className="app-drag-edge app-drag-edge-bottom" />
      <span aria-hidden className="app-drag-edge app-drag-edge-left" />
      <span aria-hidden className="app-drag-edge app-drag-edge-right" />
      <div className="app-window relative flex h-full gap-5 p-(--layout-margin)">
        <div aria-hidden className="aurora">
          <i />
          <i />
          <i />
          <i />
          <b />
        </div>
        <NavRail items={nav} active={view} onNavigate={navigate} onLogo={() => navigate('today')} onFab={() => setQuickAdd((o) => !o)} fabLabel="Ajouter" fabRef={setFab} windowControls={windowControls} />
        <main className="relative z-10 flex min-w-0 flex-1 flex-col pr-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${view}-${today}`}
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: t.medium, ease: t.entry } }}
              exit={{ opacity: 0, transition: { duration: t.short, ease: t.exit } }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {overlays}
    </div>
  );
}

/** Today's date, refreshed every minute (the app can stay open over midnight). */
function useToday(): string {
  const [today, setToday] = useState(todayIso());
  useEffect(() => {
    const id = window.setInterval(() => setToday(todayIso()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

/** Ctrl+N = new task, Ctrl+K = quick add, Alt+1…5 = menus. */
function useShortcuts(openQuickAdd: () => void) {
  useEffect(() => {
    const order: View[] = ['today', 'week', 'sport', 'goals', 'shopping'];
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        app.openDialog({ kind: 'task', date: todayIso() });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openQuickAdd();
      } else if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        app.navigate(order[Number(e.key) - 1]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd]);
}

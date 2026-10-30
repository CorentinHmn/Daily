/**
 * Shell. Signed out: the sign-in screen; signed in without a household: its setup (AuthScreens.tsx). Then the app:
 * on a computer, .app-window with the photo behind the glass, the top bar (+ = quick add, Paramètres, theme, user chip),
 * the slim rail on the left (Aujourd'hui, Semaine, Sport, Objectifs, Courses); on a phone or a tablet (below 1200 px),
 * MobileShell, the same menus in a floating tab bar.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, Footprints, ListPlus, Target, Repeat } from 'lucide-react';
import { tabIcon } from './domain/catalog';
import { useApp, type View } from './store/app';
import { todayIso, weekStart } from './lib/dates';
import { NavRail, readRailOpen, saveRailOpen, type NavItem } from './ui/navigation';
import { ToastStack, type MenuItem } from './ui/overlays';
import type { ChipMenuHandle } from './ui/chipMenu';
import { motionTokens } from './theme/motion';
import { TodayScreen } from './screens/today/TodayScreen';
import { WeekScreen } from './screens/week/WeekScreen';
import { SportScreen } from './screens/sport/SportScreen';
import { GoalsScreen } from './screens/goals/GoalsScreen';
import { ShoppingScreen } from './screens/shopping/ShoppingScreen';
import { Dialogs } from './screens/dialogs/Dialogs';
import { MobileShell } from './screens/shell/MobileShell';
import { TopBar } from './screens/shell/TopBar';
import { Celebrations } from './screens/shell/Celebrations';
import { useIsMobile } from './ui/useMedia';
import { Backdrop, GLASS_DEFAULT, applyBackdrop, applyGlass } from './ui/backdrop';
import { initSync, useSync, type SyncStatus } from './sync/sync';
import { HouseholdSetup, RecoveryScreen, SignInScreen, Splash, Unreachable } from './screens/auth/AuthScreens';

const SCREENS: Record<View, ComponentType> = {
  today: TodayScreen,
  week: WeekScreen,
  sport: SportScreen,
  goals: GoalsScreen,
  shopping: ShoppingScreen,
};

const IN_APP: SyncStatus[] = ['connecting', 'synced', 'syncing', 'offline', 'error'];

export function App() {
  const status = useSync((s) => s.status);
  const theme = useApp((s) => s.data.settings.theme);
  // The background photo this person chose (on their member: the same on all their devices; none yet = the default).
  // Signed out, this device's last one stays (main.tsx).
  const me = useApp((s) => s.data.members.find((m) => m.id === s.data.settings.meId));
  const backdrop = me ? (me.backdrop ?? 'dusk') : undefined;
  useEffect(() => {
    if (backdrop) applyBackdrop(backdrop);
  }, [backdrop]);
  const glass = me ? (me.glass ?? GLASS_DEFAULT) : undefined;
  useEffect(() => {
    if (glass !== undefined) applyGlass(glass);
  }, [glass]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Status bar / browser chrome colour of the phone follows the app's theme, not the system's.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = theme === 'night' ? '#5f605b' : '#d3d4d1';
      meta.removeAttribute('media');
    }
  }, [theme]);

  // Session, then the household of this account (online, kept on the device).
  useEffect(() => {
    void initSync();
  }, []);

  if (status === 'loading') return <Splash />;
  if (status === 'signed-out') return <SignInScreen />;
  if (status === 'recovery') return <RecoveryScreen />;
  if (status === 'no-household') return <HouseholdSetup />;
  if (status === 'unreachable') return <Unreachable />;
  return IN_APP.includes(status) ? <Workspace /> : <Splash />;
}

function Workspace() {
  const view = useApp((s) => s.view);
  const navigate = useApp((s) => s.navigate);
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const onboarded = useApp((s) => s.data.onboarded);
  const caughtUp = useSync((s) => s.caughtUp);
  const remaining = useApp((s) => {
    const list = s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0];
    return list ? list.items.filter((i) => !i.checked).length : 0;
  });
  const sessionLive = useApp((s) => !!s.data.active);
  const today = useToday();
  const mobile = useIsMobile();
  // Ctrl K opens the quick add (the +, in the top bar or beside the tab bar, that grows into its menu).
  const quickAdd = useRef<ChipMenuHandle>(null);
  const [railOpen, setRailOpen] = useState(readRailOpen);
  useShortcuts(useCallback(() => quickAdd.current?.open(), []));

  // A new week is filled from the semaine type as soon as it starts — once the household's latest data is here, so a
  // device back from offline does not refill (and untick) a week the other one already filled.
  useEffect(() => {
    if (onboarded && caughtUp) useApp.getState().ensureWeek(weekStart(today));
  }, [today, onboarded, caughtUp]);

  // The tabs' icons are the household's choice (Paramètres > Onglets).
  const prefs = useApp((s) => s.data.prefs);
  const nav: NavItem<View>[] = [
    { id: 'today', label: "Aujourd'hui", icon: tabIcon('today', prefs) },
    { id: 'week', label: 'Semaine', icon: tabIcon('week', prefs) },
    { id: 'sport', label: 'Sport', icon: tabIcon('sport', prefs), live: sessionLive && view !== 'sport' },
    { id: 'goals', label: 'Objectifs', icon: tabIcon('goals', prefs) },
    { id: 'shopping', label: 'Courses', icon: tabIcon('shopping', prefs), badge: remaining ? String(remaining) : undefined },
  ];

  const Screen = SCREENS[view];
  const t = motionTokens();
  const open = useApp.getState().openDialog;

  const adds: MenuItem[] = [
    { label: 'Tâche', icon: CalendarDays, hint: mobile ? undefined : 'Ctrl N', onSelect: () => open({ kind: 'task', date: todayIso() }) },
    { label: 'Routine de la semaine type', icon: Repeat, onSelect: () => open({ kind: 'routine' }) },
    { label: 'Article de courses', icon: ListPlus, onSelect: () => open({ kind: 'item' }) },
    { label: 'Sortie running', icon: Footprints, onSelect: () => open({ kind: 'run' }) },
    { label: 'Objectif', icon: Target, onSelect: () => open({ kind: 'goal' }) },
  ];

  const overlays = (
    <>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <Celebrations />
      <Dialogs />
    </>
  );

  if (mobile) {
    return (
      <>
        <MobileShell items={nav} active={view} onNavigate={navigate} adds={adds} addRef={quickAdd} screenKey={`${view}-${today}`}>
          <Screen />
        </MobileShell>
        {overlays}
      </>
    );
  }

  return (
    <div className="h-full">
      <div className="app-window relative flex h-full flex-col gap-3 p-(--layout-margin) pt-3.5">
        <Backdrop />
        <TopBar
          railOpen={railOpen}
          onRail={() => {
            saveRailOpen(!railOpen);
            setRailOpen(!railOpen);
          }}
          adds={adds}
          addRef={quickAdd}
        />
        <div className="flex min-h-0 flex-1 gap-5">
          <div className="flex shrink-0 flex-col justify-center pb-(--layout-topbar)">
            <NavRail items={nav} active={view} onNavigate={navigate} open={railOpen} />
          </div>
          <main className="relative z-10 flex min-w-0 flex-1 flex-col pr-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${today}`}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ y: 8 }}
                animate={{ y: 0, transition: { duration: t.medium, ease: t.entry } }}
                exit={{ y: 0, transition: { duration: 0 } }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
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

/**
 * PageHeader (Shell 71:294): the page title = the name of the active menu, alone (Heading/Page, no eyebrow, no
 * subtitle); actions on the right; the user chip (liquid glass) opens Paramètres, the theme and the export.
 * Phone: the large title and the avatar on one line, the actions under it; once the page scrolls past the title, a
 * compact glass bar keeps the title at the top (iOS large-title behaviour).
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Download, LogOut, Moon, Settings, Sun, Users } from 'lucide-react';
import { signOut, useSync } from '../../sync/sync';
import { cn } from '../../ui/cn';
import { useApp } from '../../store/app';
import { Avatar, ICON_STROKE } from '../../ui/atoms';
import { useLiquidGlass } from '../../ui/glass';
import { ChipMenu } from '../../ui/chipMenu';
import { useIsMobile } from '../../ui/useMedia';
import { motionTokens } from '../../theme/motion';
import { exportData } from '../dialogs/SettingsDialog';
import { PersonSwitcher } from '../../ui/people';
import { usePageScroll } from './scroll';

/** `people` = show the person filter (hidden on shared screens such as Courses). */
export function PageHeader({ title, children, people = true }: { title: string; children?: ReactNode; people?: boolean }) {
  const mobile = useIsMobile();
  const several = useApp((s) => s.data.members.length > 1);
  if (mobile) {
    return (
      <>
        <header className="flex shrink-0 flex-col gap-3 pb-4">
          <div className="flex min-h-14 items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-heading-page text-text-primary">{title}</h1>
            <UserChip compact />
          </div>
          {(children || (people && several)) && (
            <div className="flex flex-wrap items-center gap-2">
              {people && <PersonSwitcher />}
              {children}
            </div>
          )}
        </header>
        <CompactBar title={title} />
      </>
    );
  }
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 pl-1">
      <h1 className="shrink-0 text-heading-page text-text-primary">{title}</h1>
      <div aria-hidden className="h-full min-w-6 flex-1" />
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
      {people && <PersonSwitcher />}
      <UserChip />
    </header>
  );
}

/** Title bar shown once the large title has scrolled away (portalled: a transformed parent would trap `fixed`). */
function CompactBar({ title }: { title: string }) {
  const { scrolled } = usePageScroll();
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 16, strength: 10 });
  const t = motionTokens();
  return createPortal(
    <AnimatePresence>
      {scrolled && (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: t.short * 1.5, ease: t.entry } }}
          exit={{ y: -12, opacity: 0, transition: { duration: t.short, ease: t.exit } }}
          className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto max-w-[744px] px-3 pt-[calc(env(safe-area-inset-top)+6px)]"
        >
          <div ref={glass} className="liquid liquid-bar pointer-events-auto flex h-11 items-center justify-center rounded-full px-5">
            <span className="truncate text-title-s text-text-primary">{title}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** The user's chip: liquid glass that grows into its menu (ChipMenu), the sync dot on the avatar above its rim. */
function UserChip({ compact }: { compact?: boolean }) {
  const name = useApp((s) => s.data.settings.name);
  const theme = useApp((s) => s.data.settings.theme);
  const app = useApp.getState();
  const hue = useApp((s) => s.data.members.find((m) => m.id === s.data.settings.meId)?.hue ?? 'warm');
  const photo = useApp((s) => s.data.members.find((m) => m.id === s.data.settings.meId)?.photo);
  return (
    <ChipMenu
      label={compact ? `${name || 'Moi'}, menu` : undefined}
      className={compact ? 'inline-flex size-12 items-center justify-center rounded-full' : 'flex h-[52px] items-center gap-3 rounded-full py-1 pr-1.5 pl-4 text-left'}
      width={240}
      items={[
        { label: 'Foyer et compte', icon: Users, onSelect: () => app.openDialog({ kind: 'account' }) },
        { label: 'Paramètres', icon: Settings, onSelect: () => app.openDialog({ kind: 'settings' }) },
        { label: theme === 'day' ? 'Passer en sombre' : 'Passer en clair', icon: theme === 'day' ? Moon : Sun, onSelect: () => app.setTheme(theme === 'day' ? 'night' : 'day') },
        { label: 'Exporter mes données', icon: Download, onSelect: () => void exportData() },
        { label: 'Se déconnecter', icon: LogOut, onSelect: () => void signOut() },
      ]}
    >
      {(open) => (
        <>
          {!compact && (
            <>
              <span className="flex flex-col">
                <span className="text-label-m text-text-primary">{name || 'Moi'}</span>
              </span>
              <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden className={cn('text-text-muted transition-transform duration-(--v-duree-moyenne)', open && 'rotate-180')} />
            </>
          )}
          <span className="relative">
            <Avatar name={name || 'Moi'} hue={hue} photo={photo} />
            <SyncDot />
          </span>
        </>
      )}
    </ChipMenu>
  );
}

/** Sync state on the avatar: green = up to date, blue breathing = sending, amber = offline or error. */
function SyncDot() {
  const status = useSync((s) => s.status);
  if (!['connecting', 'synced', 'syncing', 'offline', 'error'].includes(status)) return null;
  const label = status === 'synced' ? 'Synchronisé' : status === 'offline' ? 'Hors ligne' : status === 'error' ? 'Erreur de synchronisation' : 'Synchronisation…';
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-bg-card',
        status === 'synced' && 'bg-signal-default',
        (status === 'syncing' || status === 'connecting') && 'live-halo bg-accent-default text-accent-default',
        (status === 'offline' || status === 'error') && 'bg-warn-default',
      )}
    />
  );
}

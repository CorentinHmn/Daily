/**
 * The user's chip (top bar on a computer, beside the title on a phone): liquid glass that grows into its menu
 * (ChipMenu: Foyer et compte, Paramètres, theme, export, sign-out), the sync dot on the avatar.
 */
import { ChevronDown, Download, LogOut, Moon, Settings, Sun, Users } from 'lucide-react';
import { signOut, useSync } from '../../sync/sync';
import { cn } from '../../ui/cn';
import { useApp } from '../../store/app';
import { Avatar, ICON_STROKE } from '../../ui/atoms';
import { ChipMenu } from '../../ui/chipMenu';
import { exportData } from '../dialogs/SettingsDialog';

/** The user's chip: liquid glass that grows into its menu (ChipMenu), the sync dot on the avatar above its rim. */
export function UserChip({ compact }: { compact?: boolean }) {
  const name = useApp((s) => s.data.settings.name);
  const theme = useApp((s) => s.data.settings.theme);
  const app = useApp.getState();
  const hue = useApp((s) => s.data.members.find((m) => m.id === s.data.settings.meId)?.hue ?? 'warm');
  const photo = useApp((s) => s.data.members.find((m) => m.id === s.data.settings.meId)?.photo);
  return (
    <ChipMenu
      label={compact ? `${name || 'Moi'}, menu` : undefined}
      className={compact ? 'inline-flex size-12 items-center justify-center rounded-full md:size-11' : 'flex h-[52px] items-center gap-3 rounded-full py-1 pr-1.5 pl-4 text-left'}
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
      className={cn(
        'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-bg-card',
        status === 'synced' && 'bg-signal-default',
        (status === 'syncing' || status === 'connecting') && 'live-halo bg-accent-default text-accent-default',
        (status === 'offline' || status === 'error') && 'bg-warn-default',
      )}
    />
  );
}

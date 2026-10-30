/**
 * Top bar of the computer (the glass dashboard's): round glass buttons on the left (Cadence = Aujourd'hui, open or
 * fold the rail), the person filter in the middle (screens of one person or everyone), on the right the quick add
 * (+, Ctrl K: it grows into its menu, as the user chip), Paramètres, the theme and the user chip with its menu.
 */
import type { Ref } from 'react';
import { Moon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sun } from 'lucide-react';
import { SHARED_VIEWS, useApp } from '../../store/app';
import { ICON_STROKE, IconButton, Logo } from '../../ui/atoms';
import { ChipMenu, type ChipMenuHandle } from '../../ui/chipMenu';
import type { MenuItem } from '../../ui/overlays';
import { PersonSwitcher } from '../../ui/people';
import { UserChip } from './UserChip';

export function TopBar({ railOpen, onRail, adds, addRef }: { railOpen: boolean; onRail: () => void; adds: MenuItem[]; addRef: Ref<ChipMenuHandle> }) {
  const theme = useApp((s) => s.data.settings.theme);
  const people = useApp((s) => !SHARED_VIEWS.includes(s.view));
  const app = useApp.getState();
  return (
    <div className="relative z-30 grid h-(--layout-topbar) shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => app.navigate('today')} aria-label="Cadence, aujourd'hui" className="inline-flex rounded-full transition-transform duration-(--v-duree-courte) active:scale-95">
          <Logo size={44} />
        </button>
        <IconButton icon={railOpen ? PanelLeftClose : PanelLeftOpen} label={railOpen ? 'Réduire le menu' : 'Déplier le menu'} aria-expanded={railOpen} variant="glass" onClick={onRail} />
      </div>
      <div className="flex justify-center">{people && <PersonSwitcher />}</div>
      <div className="flex items-center justify-end gap-2.5">
        <ChipMenu ref={addRef} items={adds} label="Ajouter" width={250} className="inline-flex size-11 items-center justify-center rounded-full text-text-primary transition-transform duration-(--v-duree-courte) active:scale-95">
          {() => <Plus size={20} strokeWidth={ICON_STROKE} aria-hidden />}
        </ChipMenu>
        <IconButton icon={Settings} label="Paramètres" variant="glass" onClick={() => app.openDialog({ kind: 'settings' })} />
        <IconButton icon={theme === 'day' ? Moon : Sun} label={theme === 'day' ? 'Passer en sombre' : 'Passer en clair'} variant="glass" onClick={() => app.setTheme(theme === 'day' ? 'night' : 'day')} />
        <UserChip compact />
      </div>
    </div>
  );
}

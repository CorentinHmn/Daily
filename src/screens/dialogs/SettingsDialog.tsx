/** Paramètres (from the user chip): name, theme, data (export, import, start again). */
import { useRef, useState } from 'react';
import { Camera, Download, Eraser, Moon, Plus, RefreshCw, RotateCcw, Settings, Sun, Trash2, Upload, Users, X } from 'lucide-react';
import { relinkMe, useSync } from '../../sync/sync';
import { MEMBER_HUES } from '../../domain/people';
import type { Member, MemberHue } from '../../domain/types';
import { squarePhoto } from '../../lib/image';
import { Avatar, IconButton } from '../../ui/atoms';
import { cn } from '../../ui/cn';
import { useApp, type StartMode } from '../../store/app';
import { shortDate, todayIso } from '../../lib/dates';
import { Button } from '../../ui/atoms';
import { ChoiceChips, Field, TextInput } from '../../ui/forms';
import { ConfirmDialog, Dialog } from '../../ui/overlays';

/**
 * Drops the offline copy of the app (service worker and its caches) and reloads from the site: the latest version,
 * whatever an installed iPhone app had kept. The data stay (local copy and send queue are in localStorage).
 */
export async function forceUpdate(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } finally {
    window.location.reload();
  }
}

export async function exportData(): Promise<void> {
  const app = useApp.getState();
  const json = JSON.stringify(app.data, null, 2);
  const name = `cadence-${todayIso()}.json`;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  app.toast({ tone: 'success', title: 'Données exportées', text: name });
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.data.settings);
  const app = useApp.getState();
  const household = useSync((s) => s.household);
  const email = useSync((s) => s.email);
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<StartMode | null>(null);
  return (
    <>
      <Dialog open={open && !confirm} onClose={onClose} title="Paramètres" icon={Settings} footer={<Button onClick={onClose}>Fermer</Button>}>
        <div className="flex flex-col gap-5">
          <Household />
          <Field label="Apparence">
            <ChoiceChips
              label="Apparence"
              value={settings.theme}
              onChange={(v) => app.setTheme(v)}
              options={[
                { value: 'day', label: 'Clair', icon: Sun },
                { value: 'night', label: 'Sombre', icon: Moon },
              ]}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <p className="text-label-s text-text-secondary">Partage en ligne</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="soft" size="s" icon={Users} onClick={() => app.openDialog({ kind: 'account' })}>
                Foyer et compte
              </Button>
              <span className="min-w-0 truncate text-body-s text-text-secondary">{household ? `« ${household.name} », ${email}` : email}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-label-s text-text-secondary">Données</p>
            <p className="text-body-s text-text-secondary">Tout est enregistré en ligne dans votre foyer, au fil de l'eau, et gardé sur cet appareil pour marcher hors ligne. Un export te sert de sauvegarde. Tout vider, repartir de la semaine de départ, l'exemple ou un import changent les données du foyer pour vous deux.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button variant="secondary" size="s" icon={Download} onClick={() => void exportData()}>
                Exporter
              </Button>
              <Button variant="secondary" size="s" icon={Upload} onClick={() => file.current?.click()}>
                Importer
              </Button>
              <Button variant="ghost" size="s" icon={Eraser} className="text-text-danger! hover:bg-danger-soft" onClick={() => setConfirm('vide')}>
                Tout vider
              </Button>
              <Button variant="ghost" size="s" icon={RotateCcw} onClick={() => setConfirm('modele')}>
                Semaine de départ
              </Button>
              <Button variant="ghost" size="s" onClick={() => setConfirm('exemple')}>
                Recharger l'exemple
              </Button>
            </div>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const ok = app.importData(await f.text());
                app.toast(ok ? { tone: 'success', title: 'Données importées', text: f.name } : { tone: 'danger', title: 'Import impossible', text: "Ce fichier n'est pas un export de Cadence." });
                // The file brings its own people: this account becomes the file's « moi ».
                if (ok) await relinkMe().catch(() => undefined);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-label-s text-text-secondary">Version</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="tnum text-body-s text-text-secondary">
                {__APP_VERSION__}, du {shortDate(__APP_BUILT__.slice(0, 10))} à {new Date(__APP_BUILT__).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Button variant="secondary" size="s" icon={RefreshCw} onClick={() => void forceUpdate()}>
                Charger la dernière version
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={CONFIRM[confirm ?? 'modele'].title}
        text={CONFIRM[confirm ?? 'modele'].text}
        confirmLabel={CONFIRM[confirm ?? 'modele'].label}
        onConfirm={() => {
          app.start(confirm ?? 'modele', settings.name);
          onClose();
        }}
      />
    </>
  );
}

const CONFIRM: Record<StartMode, { title: string; text: string; label: string }> = {
  vide: {
    title: 'Tout vider\u00a0?',
    text: 'Les tâches, la semaine type, les programmes, séances, sorties, objectifs, habitudes et listes du foyer seront effacés, pour vous deux. Les personnes restent. Exporte avant si tu veux garder une copie.',
    label: 'Tout vider',
  },
  modele: {
    title: 'Repartir de la semaine de départ\u00a0?',
    text: 'Les tâches, séances, sorties, objectifs, habitudes et listes du foyer seront effacés, pour vous deux. La semaine type et les programmes de salle de départ sont recréés ; les personnes restent.',
    label: 'Tout effacer',
  },
  exemple: {
    title: "Recharger l'exemple\u00a0?",
    text: "Les données du foyer seront remplacées par l'exemple (historique de séances, sorties, objectifs), pour vous deux. Exporte-les avant si tu veux les garder.",
    label: "Charger l'exemple",
  },
};

const HUE_LABEL: Record<MemberHue, string> = { warm: 'Cuivre', violet: 'Violet', green: 'Vert', blue: 'Bleu' };

/** The household's people: first name and avatar colour; add someone (to assign tasks before they join). */
/** The person's avatar: a tap chooses a photo (cropped square), the small × takes it off. */
function PhotoButton({ member: m }: { member: Member }) {
  const app = useApp.getState();
  return (
    <span className="group/photo relative shrink-0">
      <label className="relative block cursor-pointer rounded-full focus-within:shadow-(--shadow-focus-ring)" title={m.photo ? 'Changer la photo' : 'Ajouter une photo'}>
        <Avatar name={m.name || '?'} hue={m.hue} photo={m.photo} size="s" />
        <span aria-hidden className="absolute inset-0 inline-flex items-center justify-center rounded-full bg-[rgb(14_16_20/0.45)] text-text-on-accent opacity-0 transition-opacity group-hover/photo:opacity-100 pointer-coarse:hidden">
          <Camera size={14} strokeWidth={2} />
        </span>
        <input
          type="file"
          accept="image/*"
          aria-label={m.photo ? `Changer la photo de ${m.name}` : `Ajouter une photo à ${m.name}`}
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              app.saveMember({ ...m, photo: await squarePhoto(f) });
            } catch {
              app.toast({ tone: 'danger', title: 'Photo illisible', text: 'Essaie avec une photo JPEG ou PNG.' });
            }
          }}
        />
      </label>
      {!m.photo && (
        <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-1 inline-flex size-[18px] items-center justify-center rounded-full border border-border-default bg-bg-card text-text-secondary">
          <Camera size={10} strokeWidth={2} />
        </span>
      )}
      {m.photo && (
        <button type="button" aria-label={`Retirer la photo de ${m.name}`} title="Retirer la photo" onClick={() => app.saveMember({ ...m, photo: undefined })} className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center pointer-coarse:size-6 justify-center rounded-full border border-border-default bg-bg-card text-text-secondary shadow-sm hover:text-text-danger">
          <X size={11} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}

function Household() {
  const members = useApp((s) => s.data.members);
  const meId = useApp((s) => s.data.settings.meId);
  const app = useApp.getState();
  const [draft, setDraft] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label-s text-text-secondary">Foyer</p>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <PhotoButton member={m} />
            <TextInput value={m.name} onChange={(e) => app.saveMember({ ...m, name: e.target.value })} aria-label={m.id === meId ? 'Mon prénom' : `Prénom de ${m.name}`} className="flex-1" />
            <div role="radiogroup" aria-label={`Couleur de ${m.name}`} className="flex shrink-0 gap-1">
              {MEMBER_HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={m.hue === h}
                  aria-label={HUE_LABEL[h]}
                  title={HUE_LABEL[h]}
                  onClick={() => app.saveMember({ ...m, hue: h })}
                  className={cn('rounded-full p-0.5 transition-shadow', m.hue === h && 'shadow-[0_0_0_2px_var(--color-border-accent)]')}
                >
                  <Avatar name="" hue={h} size="xs" className="size-6 border-0" />
                </button>
              ))}
            </div>
            {m.id === meId ? (
              <span className="w-9 shrink-0 text-center text-caption text-text-muted">moi</span>
            ) : (
              <IconButton icon={Trash2} label={`Retirer ${m.name} du foyer`} variant="danger" size="s" onClick={() => app.removeMember(m.id)} />
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          app.addMember(draft);
          // From two people on, the screens show this device's person by default.
          if (members.length === 1) app.set({ person: meId ?? null });
          setDraft('');
        }}
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ajouter une personne, ex. Léa" aria-label="Prénom de la personne à ajouter" className="flex-1" />
        <Button type="submit" variant="secondary" icon={Plus} disabled={!draft.trim()}>
          Ajouter
        </Button>
      </form>
      <p className="text-caption text-text-muted">Chaque tâche, routine, habitude, programme ou objectif peut ensuite être attribué à l'une ou l'autre personne, ou à vous deux.</p>
    </div>
  );
}

/** Paramètres (from the user chip): name, theme, data (export, import, start again). */
import { useRef, useState } from 'react';
import { Download, Eraser, Moon, Plus, RotateCcw, Settings, Sun, Trash2, Upload, Users } from 'lucide-react';
import { relinkMe, useSync } from '../../sync/sync';
import { MEMBER_HUES } from '../../domain/people';
import type { MemberHue } from '../../domain/types';
import { Avatar, IconButton } from '../../ui/atoms';
import { cn } from '../../ui/cn';
import { useApp, type StartMode } from '../../store/app';
import { todayIso } from '../../lib/dates';
import { Button } from '../../ui/atoms';
import { ChoiceChips, Field, TextInput } from '../../ui/forms';
import { ConfirmDialog, Dialog } from '../../ui/overlays';

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
            <Avatar name={m.name || '?'} hue={m.hue} size="s" />
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

/**
 * Foyer et compte: the household (name, sync status), its invite code and link to send to the other person, the people
 * and whether each one has an account, then this account (e-mail, password, sign out).
 */
import { useState } from 'react';
import { Check, CloudOff, Copy, Lock, LogOut, Pencil, Share2, Users } from 'lucide-react';
import { useApp } from '../../store/app';
import { changePassword, formatCode, inviteLink, renameHousehold, signOut, useSync } from '../../sync/sync';
import { Avatar, Button, ICON_STROKE, IconButton, StatusBadge } from '../../ui/atoms';
import { Field, TextInput } from '../../ui/forms';
import { Dialog } from '../../ui/overlays';
import { frenchError } from '../auth/AuthScreens';

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Foyer et compte" icon={Users} width="m">
      <Account />
    </Dialog>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(frenchError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Account() {
  const { status, household, email, linked, pending, error } = useSync();
  const members = useApp((s) => s.data.members);
  const meId = useApp((s) => s.data.settings.meId);
  const tone = status === 'synced' ? 'signal' : status === 'offline' || status === 'error' ? 'warn' : 'accent';
  const label = status === 'synced' ? 'À jour' : status === 'syncing' || status === 'connecting' ? 'Synchronisation…' : status === 'offline' ? `Hors ligne${pending ? `, ${pending} modification${pending > 1 ? 's' : ''} en attente` : ''}` : 'Erreur de synchronisation';
  const alone = Object.keys(linked).length < 2;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <HouseholdName name={household?.name ?? ''} />
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      {status === 'error' && error && <p className="text-caption text-text-danger">{error}</p>}
      {household && <Invite code={household.invite_code} highlight={alone} />}
      <div className="flex flex-col gap-2">
        <p className="text-label-s text-text-secondary">Personnes</p>
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg px-1 py-1">
              <Avatar name={m.name} hue={m.hue} size="s" />
              <span className="min-w-0 flex-1 truncate text-label-m text-text-primary">
                {m.name}
                {m.id === meId ? ' (moi)' : ''}
              </span>
              {linked[m.id] ? <StatusBadge tone="signal">Compte relié</StatusBadge> : <StatusBadge tone="neutral">Pas encore de compte</StatusBadge>}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
        <p className="text-label-s text-text-secondary">Mon compte</p>
        <p className="truncate text-body-s text-text-primary">{email}</p>
        <PasswordChange />
        <div className="flex items-center gap-2">
          {status === 'offline' && (
            <span className="inline-flex items-center gap-1.5 text-caption text-text-warn">
              <CloudOff size={14} strokeWidth={ICON_STROKE} aria-hidden />
              Les modifications partiront au retour du réseau.
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function HouseholdName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { busy, error, run } = useAction();
  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-title-m text-text-primary">{name}</p>
        <IconButton
          icon={Pencil}
          label="Renommer le foyer"
          variant="ghost"
          size="xs"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        />
      </div>
    );
  }
  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await renameHousehold(draft.trim() || name);
          setEditing(false);
        });
      }}
    >
      <div className="flex gap-2">
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Nom du foyer" className="flex-1" autoFocus />
        <Button type="submit" size="s" disabled={busy}>
          OK
        </Button>
      </div>
      {error && <p className="text-caption text-text-danger">{error}</p>}
    </form>
  );
}

/** The code, and the link that opens the sign-up with the code filled in (shared by the phone's share sheet). */
function Invite({ code, highlight }: { code: string; highlight: boolean }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const pretty = formatCode(code);
  const link = inviteLink(code);
  const text = `Rejoins notre foyer sur Cadence : ${link} (code ${pretty})`;
  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? pretty : text);
    } catch {
      // copying is a convenience; the code stays visible
    }
    setCopied(what);
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Cadence', text: 'Rejoins notre foyer sur Cadence', url: link });
    } catch {
      // closed without sharing
    }
  };
  return (
    <div className={highlight ? 'flex flex-col gap-2 rounded-xl border border-border-accent bg-accent-soft p-4' : 'inset-tile flex flex-col gap-2 rounded-xl p-4'}>
      <p className="text-label-s text-text-secondary">Code d'invitation</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="tnum text-data-l tracking-[0.08em] text-text-primary">{pretty}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="s" icon={copied === 'code' ? Check : Copy} onClick={() => void copy('code')}>
            {copied === 'code' ? 'Copié' : 'Code'}
          </Button>
          {typeof navigator.share === 'function' ? (
            <Button size="s" icon={Share2} onClick={() => void share()}>
              Envoyer le lien
            </Button>
          ) : (
            <Button size="s" icon={copied === 'link' ? Check : Copy} onClick={() => void copy('link')}>
              {copied === 'link' ? 'Lien copié' : 'Copier le lien'}
            </Button>
          )}
        </div>
      </div>
      <p className="text-caption text-text-secondary">
        {highlight ? "Envoie ce lien à l'autre personne : elle crée son compte et arrive directement dans votre foyer." : 'Le lien ouvre la création de compte avec le code déjà rempli.'}
      </p>
    </div>
  );
}

function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const { busy, error, run } = useAction();
  if (!open) {
    return (
      <Button variant="secondary" size="s" icon={done ? Check : Lock} className="self-start" onClick={() => (setOpen(true), setDone(false))}>
        {done ? 'Mot de passe changé' : 'Changer de mot de passe'}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await changePassword(password);
          setPassword('');
          setOpen(false);
          setDone(true);
        });
      }}
    >
      <Field label="Nouveau mot de passe" htmlFor="acc-new-pw" error={error} help="Au moins 8 caractères.">
        <TextInput id="acc-new-pw" type="password" icon={Lock} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" size="s" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" size="s" disabled={busy || password.length < 8}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="s"
      icon={LogOut}
      className="ml-auto"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
      }}
    >
      Se déconnecter
    </Button>
  );
}

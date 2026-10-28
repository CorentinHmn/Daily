/**
 * Compte et partage: sign in with a 6-digit e-mail code, create the household (this device's data goes online) or
 * join one with its invite code, follow it on a new device; then the invite code, the people and the sync status.
 */
import { useState } from 'react';
import { Check, CloudOff, Copy, Home, KeyRound, LogOut, Mail, RefreshCw, Users } from 'lucide-react';
import { useApp } from '../../store/app';
import { adoptHousehold, createHousehold, joinHousehold, sendCode, signOut, useSync, verifyCode } from '../../sync/sync';
import { cn } from '../../ui/cn';
import { Avatar, Button, ICON_STROKE, StatusBadge } from '../../ui/atoms';
import { Field, TextInput } from '../../ui/forms';
import { Dialog } from '../../ui/overlays';

const formatCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useSync((s) => s.status);
  return (
    <Dialog open={open} onClose={onClose} title="Compte et partage" icon={Users} width="m">
      {status === 'off' && <p>Cette version de l'app n'est pas reliée à un service en ligne.</p>}
      {status === 'signed-out' && <SignIn />}
      {status === 'no-household' && <NoHousehold />}
      {status === 'to-adopt' && <Adopt />}
      {['connecting', 'synced', 'syncing', 'offline', 'error'].includes(status) && <Connected />}
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

function frenchError(m: string): string {
  if (/token has expired|invalid/i.test(m) && /otp|token/i.test(m)) return 'Code incorrect ou expiré. Redemande un code.';
  if (/rate limit|too many|security purposes/i.test(m)) return "Trop de demandes d'affilée : attends une minute avant de redemander un code.";
  if (/failed to fetch|network/i.test(m)) return 'Pas de connexion à Internet.';
  return m;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-4">
      <p>Avec un compte, vos données sont partagées en direct entre vos téléphones et le PC. Pas de mot de passe : un code arrive par e-mail à chaque nouvel appareil.</p>
      {!sent ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await sendCode(email);
              setSent(true);
            });
          }}
        >
          <Field label="Adresse e-mail" htmlFor="acc-email" error={error}>
            <TextInput id="acc-email" data-autofocus="" type="email" autoComplete="email" inputMode="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
          </Field>
          <Button type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}>
            {busy ? 'Envoi…' : 'Recevoir un code'}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verifyCode(email, code));
          }}
        >
          <Field label={`Code reçu à ${email}`} htmlFor="acc-code" error={error} help="Le code à 6 chiffres de l'e-mail Cadence. Pense à regarder dans les indésirables.">
            <TextInput id="acc-code" data-autofocus="" inputMode="numeric" autoComplete="one-time-code" icon={KeyRound} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" className="tnum" />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSent(false)}>
              Changer d'adresse
            </Button>
            <Button type="submit" className="flex-1" disabled={busy || code.length !== 6}>
              {busy ? 'Vérification…' : 'Valider'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function NoHousehold() {
  const meName = useApp((s) => s.data.settings.name);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('Notre foyer');
  const [code, setCode] = useState('');
  const [first, setFirst] = useState('');
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Foyer" className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
        {[
          { v: 'create' as const, icon: Home, t: 'Créer notre foyer', d: 'Les données de cet appareil partent en ligne.' },
          { v: 'join' as const, icon: KeyRound, t: "J'ai un code", d: "Rejoindre le foyer de quelqu'un." },
        ].map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} onClick={() => setMode(o.v)} className={cn('flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors', mode === o.v ? 'border-border-accent bg-accent-soft' : 'border-border-default bg-bg-card/60 hover:border-border-strong')}>
            <span className="flex items-center gap-2 text-title-s text-text-primary">
              <o.icon size={18} strokeWidth={ICON_STROKE} aria-hidden className={mode === o.v ? 'text-text-accent' : 'text-text-secondary'} />
              {o.t}
            </span>
            <span className="text-body-s text-text-secondary">{o.d}</span>
          </button>
        ))}
      </div>
      {mode === 'create' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => createHousehold(name));
          }}
        >
          <Field label="Nom du foyer" htmlFor="acc-house" error={error}>
            <TextInput id="acc-house" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" icon={Home} disabled={busy}>
            {busy ? 'Création…' : `Créer le foyer de ${meName || 'moi'}`}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => joinHousehold(code, first));
          }}
        >
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <Field label="Code du foyer" htmlFor="acc-join">
              <TextInput id="acc-join" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-1234" className="tnum" autoCapitalize="characters" />
            </Field>
            <Field label="Ton prénom" htmlFor="acc-first">
              <TextInput id="acc-first" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Léa" autoComplete="given-name" />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-caption text-text-danger">
              {error}
            </p>
          )}
          <p className="text-caption text-text-secondary">Les données de cet appareil seront remplacées par celles du foyer.</p>
          <Button type="submit" icon={KeyRound} disabled={busy || code.replace(/\W/g, '').length < 8 || !first.trim()}>
            {busy ? 'Connexion au foyer…' : 'Rejoindre le foyer'}
          </Button>
        </form>
      )}
    </div>
  );
}

function Adopt() {
  const household = useSync((s) => s.household);
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-4">
      <p>
        Ce compte fait partie du foyer « {household?.name} ». Sur cet appareil, les données locales vont être remplacées par celles du foyer, à jour.
      </p>
      {error && (
        <p role="alert" className="text-caption text-text-danger">
          {error}
        </p>
      )}
      <Button icon={RefreshCw} disabled={busy} onClick={() => void run(adoptHousehold)}>
        {busy ? 'Récupération…' : 'Retrouver mon foyer'}
      </Button>
    </div>
  );
}

function Connected() {
  const { status, household, email, linked, pending, error } = useSync();
  const members = useApp((s) => s.data.members);
  const meId = useApp((s) => s.data.settings.meId);
  const [copied, setCopied] = useState(false);
  const { busy, run } = useAction();
  const code = household ? formatCode(household.invite_code) : '';
  const tone = status === 'synced' ? 'signal' : status === 'offline' || status === 'error' ? 'warn' : 'accent';
  const label = status === 'synced' ? 'À jour' : status === 'syncing' || status === 'connecting' ? 'Synchronisation…' : status === 'offline' ? `Hors ligne${pending ? `, ${pending} modification${pending > 1 ? 's' : ''} en attente` : ''}` : 'Erreur de synchronisation';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-title-m text-text-primary">{household?.name}</p>
          <p className="truncate text-body-s text-text-secondary">{email}</p>
        </div>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      {status === 'error' && error && <p className="text-caption text-text-danger">{error}</p>}
      <div className="inset-tile flex flex-col gap-2 rounded-xl p-4">
        <p className="text-label-s text-text-secondary">Code d'invitation</p>
        <div className="flex items-center gap-3">
          <span className="tnum text-data-l tracking-[0.08em] text-text-primary">{code}</span>
          <Button
            variant="secondary"
            size="s"
            icon={copied ? Check : Copy}
            className="ml-auto"
            onClick={async () => {
              const text = `Rejoins notre foyer sur Cadence avec le code ${code}`;
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                // copying is a convenience; the code stays visible
              }
              setCopied(true);
            }}
          >
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
        <p className="text-caption text-text-secondary">À donner à l'autre personne du foyer : dans Compte et partage, elle choisit « J'ai un code » et saisit son prénom.</p>
      </div>
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
      <div className="flex items-center gap-2 border-t border-border-subtle pt-4">
        {status === 'offline' && (
          <span className="inline-flex items-center gap-1.5 text-caption text-text-warn">
            <CloudOff size={14} strokeWidth={ICON_STROKE} aria-hidden />
            Les modifications partiront au retour du réseau.
          </span>
        )}
        <Button variant="ghost" size="s" icon={LogOut} className="ml-auto" disabled={busy} onClick={() => void run(signOut)}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}

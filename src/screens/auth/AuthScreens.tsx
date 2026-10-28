/**
 * Before the app: sign in (or create an account, or reset the password), then the household (create it or join it with
 * its code). Same Halo look as the app: the aurora behind one liquid-glass card, the logo on top.
 */
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, FileUp, Home, KeyRound, Lock, LogOut, Mail, RefreshCw, Repeat, Sparkles, User, WifiOff } from 'lucide-react';
import { useApp } from '../../store/app';
import { clearInvite, createHousehold, finishRecovery, joinHousehold, pendingInvite, requestPasswordReset, retry, signIn, signOut, signUp, useSync } from '../../sync/sync';
import { cn } from '../../ui/cn';
import { Button, ICON_STROKE, Logo } from '../../ui/atoms';
import { Field, TextInput } from '../../ui/forms';
import { Liquid } from '../../ui/glass';
import { SegmentedControl } from '../../ui/navigation';
import { motionTokens } from '../../theme/motion';

// ── Layout ──────────────────────────────────────────────────────────────────

function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const t = motionTokens();
  return (
    <div className="relative h-dvh overflow-y-auto overscroll-y-contain">
      <div aria-hidden className="aurora" style={{ position: 'fixed' }}>
        <i />
        <i />
        <i />
        <i />
        <b />
      </div>
      <div className="relative z-10 flex min-h-full items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { duration: t.medium, ease: t.entry } }} className={cn('w-full', wide ? 'max-w-[560px]' : 'max-w-[440px]')}>
          <Liquid strong glass={{ bezel: 28, strength: 14 }} className="rounded-2xl p-8 max-md:p-6">
            {children}
          </Liquid>
        </motion.div>
      </div>
    </div>
  );
}

function Brand({ title, text }: { title: string; text?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      <Logo size={64} />
      <h1 className="text-heading-page text-text-primary">{title}</h1>
      {text && <p className="text-body-s text-text-secondary">{text}</p>}
    </div>
  );
}

/** While the session is read (a fraction of a second): the logo alone. */
export function Splash() {
  return (
    <div className="relative grid h-dvh place-items-center">
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
        <i />
        <b />
      </div>
      <div role="status" aria-label="Chargement de Cadence" className="relative z-10 animate-pulse">
        <Logo size={72} />
      </div>
    </div>
  );
}

export function Unreachable() {
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout>
      <Brand title="Pas de connexion" text="Cadence n'arrive pas à joindre le serveur pour récupérer votre foyer. Vérifie le réseau, puis réessaie." />
      <div className="flex flex-col gap-2">
        <Button
          icon={RefreshCw}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await retry();
            setBusy(false);
          }}
        >
          {busy ? 'Connexion…' : 'Réessayer'}
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </AuthLayout>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  return { busy, error, setError, run };
}

export function frenchError(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(m)) return "Ce compte n'est pas encore confirmé : clique sur le lien reçu par e-mail, ou utilise « Mot de passe oublié ».";
  if (m === 'exists' || /already (been )?registered|already exists/i.test(m)) return 'Un compte existe déjà avec cette adresse : connecte-toi, ou utilise « Mot de passe oublié ».';
  if (m === 'weak_password' || /password should|weak password/i.test(m)) return 'Mot de passe trop faible : au moins 8 caractères.';
  if (m === 'invalid_email' || /invalid.*email|email.*invalid/i.test(m)) return 'Adresse e-mail invalide.';
  if (/different from the old/i.test(m)) return "Choisis un mot de passe différent de l'ancien.";
  if (/rate limit|too many|security purposes/i.test(m)) return "Trop de demandes d'affilée : attends une minute avant de réessayer.";
  if (/failed to fetch|network|load failed/i.test(m)) return 'Pas de connexion à Internet.';
  if (/failed to send a request|functions/i.test(m)) return 'Le service de création de compte ne répond pas. Réessaie dans un instant.';
  return m;
}

const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

function PasswordInput({ id, value, onChange, autoComplete, placeholder, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <TextInput
      id={id}
      type={show ? 'text' : 'password'}
      icon={Lock}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      autoFocus={autoFocus}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} title={show ? 'Masquer' : 'Afficher'} className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text-primary">
          {show ? <EyeOff size={16} strokeWidth={ICON_STROKE} aria-hidden /> : <Eye size={16} strokeWidth={ICON_STROKE} aria-hidden />}
        </button>
      }
    />
  );
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-caption text-text-danger">
      {error}
    </p>
  );
}

// ── Sign in / create an account / forgotten password ────────────────────────

type Mode = 'signin' | 'signup' | 'forgot';

export function SignInScreen() {
  const invite = pendingInvite();
  const notice = useSync((s) => s.notice);
  const [mode, setMode] = useState<Mode>(invite ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, setError, run } = useAction();
  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(false);
  };

  if (mode === 'forgot') {
    return (
      <AuthLayout>
        <Brand title="Mot de passe oublié" text="Indique l'adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de passe." />
        {sent ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="inset-tile rounded-xl p-4 text-body-s text-text-primary">
              E-mail envoyé à <strong className="font-medium">{email.trim()}</strong>. Ouvre le lien qu'il contient (pense aux indésirables), puis choisis ton nouveau mot de passe.
            </p>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => switchTo('signin')}>
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <Form onSubmit={() => void run(async () => (await requestPasswordReset(email), setSent(true)))}>
            <Field label="Adresse e-mail" htmlFor="auth-email">
              <TextInput id="auth-email" type="email" autoComplete="email" inputMode="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" autoFocus />
            </Field>
            <ErrorLine error={error} />
            <Button type="submit" disabled={busy || !emailOk(email)}>
              {busy ? 'Envoi…' : 'Recevoir le lien'}
            </Button>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => switchTo('signin')}>
              Retour à la connexion
            </Button>
          </Form>
        )}
      </AuthLayout>
    );
  }

  const signup = mode === 'signup';
  const canSubmit = emailOk(email) && password.length >= (signup ? 8 : 1) && (!signup || firstName.trim().length > 0);
  return (
    <AuthLayout>
      <Brand
        title="Cadence"
        text={invite ? 'Tu es invité·e à rejoindre un foyer. Crée ton compte (ou connecte-toi), le code est déjà prêt.' : 'La semaine type, le sport, les objectifs et les courses, à deux.'}
      />
      <div className="mb-5 flex justify-center">
        <SegmentedControl
          label="Compte"
          value={mode}
          onChange={switchTo}
          options={[
            { value: 'signin', label: 'Connexion' },
            { value: 'signup', label: 'Créer un compte' },
          ]}
        />
      </div>
      {notice && !error && <p className="mb-4 text-caption text-text-warn">{notice}</p>}
      <Form onSubmit={() => void run(() => (signup ? signUp(firstName, email, password) : signIn(email, password)))}>
        {signup && (
          <Field label="Prénom" htmlFor="auth-first">
            <TextInput id="auth-first" autoComplete="given-name" icon={User} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ton prénom" />
          </Field>
        )}
        <Field label="Adresse e-mail" htmlFor="auth-email">
          <TextInput id="auth-email" type="email" autoComplete={signup ? 'email' : 'username'} inputMode="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
        </Field>
        <Field label="Mot de passe" htmlFor="auth-password" help={signup ? 'Au moins 8 caractères.' : undefined}>
          <PasswordInput id="auth-password" value={password} onChange={setPassword} autoComplete={signup ? 'new-password' : 'current-password'} />
        </Field>
        <ErrorLine error={error} />
        <Button type="submit" disabled={busy || !canSubmit}>
          {busy ? (signup ? 'Création du compte…' : 'Connexion…') : signup ? 'Créer mon compte' : 'Se connecter'}
        </Button>
        {!signup && (
          <button type="button" onClick={() => switchTo('forgot')} className="self-center rounded-full px-2 py-1 text-label-s text-text-accent hover:underline">
            Mot de passe oublié ?
          </button>
        )}
      </Form>
    </AuthLayout>
  );
}

/** Came back from the reset e-mail: the session is open, a new password is chosen. */
export function RecoveryScreen() {
  const email = useSync((s) => s.email);
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  return (
    <AuthLayout>
      <Brand title="Nouveau mot de passe" text={email ? `Pour le compte ${email}.` : undefined} />
      <Form onSubmit={() => void run(() => finishRecovery(password))}>
        <Field label="Nouveau mot de passe" htmlFor="auth-new" help="Au moins 8 caractères.">
          <PasswordInput id="auth-new" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
        </Field>
        <ErrorLine error={error} />
        <Button type="submit" disabled={busy || password.length < 8}>
          {busy ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </Button>
      </Form>
    </AuthLayout>
  );
}

// ── Household: create it, or join it with its code ──────────────────────────

type Start = 'modele' | 'exemple' | 'import';

function ChoiceCard({ on, onClick, icon: Icon, title, text }: { on: boolean; onClick: () => void; icon: typeof Home; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow]',
        on ? 'border-border-accent bg-accent-soft shadow-[0_0_0_1px_var(--color-border-accent)]' : 'border-border-default bg-bg-card/60 hover:border-border-strong',
      )}
    >
      <span className="flex items-center gap-2 text-title-s text-text-primary">
        <Icon size={18} strokeWidth={ICON_STROKE} aria-hidden className={on ? 'text-text-accent' : 'text-text-secondary'} />
        {title}
      </span>
      <span className="text-body-s text-text-secondary">{text}</span>
    </button>
  );
}

export function HouseholdSetup() {
  const { email, firstName } = useSync();
  const invite = pendingInvite();
  const [mode, setMode] = useState<'create' | 'join'>(invite ? 'join' : 'create');
  const [name, setName] = useState(firstName);
  const [house, setHouse] = useState('Notre foyer');
  const [start, setStart] = useState<Start>('modele');
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState(invite ? `${invite.slice(0, 4)}-${invite.slice(4)}` : '');
  const fileInput = useRef<HTMLInputElement>(null);
  const { busy, error, setError, run } = useAction();

  const create = () =>
    run(async () => {
      const app = useApp.getState();
      if (start === 'import') {
        if (!file || !app.importData(await file.text())) throw new Error("Ce fichier n'est pas un export de Cadence (Paramètres › Exporter, dans l'app PC).");
        if (name.trim()) app.setName(name.trim());
      } else {
        app.start(start, name.trim() || 'Moi');
      }
      await createHousehold(house.trim() || 'Notre foyer');
      clearInvite();
    });

  const join = () =>
    run(async () => {
      await joinHousehold(code, name.trim());
      clearInvite();
    });

  return (
    <AuthLayout wide>
      <Brand title={firstName ? `Bonjour ${firstName}` : 'Votre foyer'} text="Cadence se partage à deux : crée votre foyer, ou rejoins celui de l'autre avec son code d'invitation." />
      <div role="radiogroup" aria-label="Foyer" className="mb-5 grid grid-cols-2 gap-2 max-md:grid-cols-1">
        <ChoiceCard on={mode === 'create'} onClick={() => (setMode('create'), setError(null))} icon={Home} title="Créer notre foyer" text="Tu invites ensuite l'autre personne." />
        <ChoiceCard on={mode === 'join'} onClick={() => (setMode('join'), setError(null))} icon={KeyRound} title="J'ai un code" text="Rejoindre le foyer de quelqu'un." />
      </div>

      {mode === 'create' ? (
        <Form onSubmit={() => void create()}>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <Field label="Ton prénom" htmlFor="house-first">
              <TextInput id="house-first" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corentin" />
            </Field>
            <Field label="Nom du foyer" htmlFor="house-name">
              <TextInput id="house-name" value={house} onChange={(e) => setHouse(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-label-s text-text-secondary">Pour commencer</p>
            <div role="radiogroup" aria-label="Pour commencer" className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
              <ChoiceCard on={start === 'modele'} onClick={() => setStart('modele')} icon={Repeat} title="Ma semaine" text="Une semaine type et trois programmes de salle à adapter." />
              <ChoiceCard on={start === 'exemple'} onClick={() => setStart('exemple')} icon={Sparkles} title="Un exemple" text="Deux mois d'historique fictif pour voir chaque écran rempli." />
              <ChoiceCard
                on={start === 'import'}
                onClick={() => {
                  setStart('import');
                  if (!file) fileInput.current?.click();
                }}
                icon={FileUp}
                title="Mes données"
                text={file ? file.name : "Un export de l'app PC (fichier .json)."}
              />
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  setFile(f);
                  setStart('import');
                }
              }}
            />
          </div>
          <ErrorLine error={error} />
          <Button type="submit" icon={Home} disabled={busy || !name.trim() || (start === 'import' && !file)}>
            {busy ? 'Création du foyer…' : 'Créer le foyer'}
          </Button>
        </Form>
      ) : (
        <Form onSubmit={() => void join()}>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            <Field label="Code du foyer" htmlFor="house-code">
              <TextInput id="house-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-1234" className="tnum" autoCapitalize="characters" autoComplete="off" />
            </Field>
            <Field label="Ton prénom" htmlFor="house-join-first">
              <TextInput id="house-join-first" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Léa" />
            </Field>
          </div>
          <p className="text-caption text-text-secondary">Le code est dans Cadence, chez l'autre personne : menu du compte › Foyer et compte. Si une personne de ton prénom existe déjà dans le foyer, tu la reprends avec ses tâches.</p>
          <ErrorLine error={error} />
          <Button type="submit" icon={KeyRound} disabled={busy || code.replace(/\W/g, '').length < 8 || !name.trim()}>
            {busy ? 'Connexion au foyer…' : 'Rejoindre le foyer'}
          </Button>
        </Form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        <span className="min-w-0 flex-1 truncate text-caption text-text-muted">{email}</span>
        <Button variant="ghost" size="s" icon={LogOut} onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
      {!navigator.onLine && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-caption text-text-warn">
          <WifiOff size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Hors ligne : il faut du réseau pour créer ou rejoindre le foyer.
        </p>
      )}
    </AuthLayout>
  );
}

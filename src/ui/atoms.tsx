/**
 * Halo atoms (Components 12:112, 66:343): IconButton, Button, StatusBadge, IconBox, ProgressBar, Avatar, Logo, Panel,
 * CheckCircle, EmptyState. Every colour, radius and spacing comes from tokens.css through Tailwind utilities.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { motion } from 'motion/react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { burst } from './burst';
import { initials as toInitials } from '../lib/format';

export const ICON_STROKE = 1.75; // Halo: Lucide, stroke 1,75

type IconButtonVariant = 'raised' | 'glass' | 'accent' | 'ghost' | 'danger';

const iconButtonVariant: Record<IconButtonVariant, string> = {
  raised: 'bg-bg-raised border border-border-default text-text-primary hover:bg-bg-hover disabled:text-text-disabled disabled:hover:bg-bg-raised',
  glass: 'liquid text-text-primary hover:bg-bg-card/70',
  accent: 'bg-accent-default text-text-on-accent drop-shadow-glow-accent hover:bg-accent-glow',
  ghost: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:hover:bg-transparent',
  danger: 'text-text-secondary hover:bg-danger-soft hover:text-text-danger disabled:text-text-disabled',
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'raised',
  size = 'm',
  className,
  ...rest
}: {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: 'xs' | 's' | 'm' | 'l';
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-(--v-duree-courte) active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'xs' ? 'size-8' : size === 's' ? 'size-9' : size === 'm' ? 'size-11' : 'size-14',
        iconButtonVariant[variant],
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'xs' ? 16 : size === 's' ? 18 : size === 'm' ? 20 : 24} strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-accent-default text-text-on-accent drop-shadow-glow-accent hover:bg-accent-glow disabled:bg-bg-disabled disabled:text-text-disabled disabled:drop-shadow-none',
  secondary:
    'bg-bg-card/70 border border-border-default text-text-primary hover:bg-bg-card hover:border-border-strong disabled:bg-bg-disabled disabled:border-border-subtle disabled:text-text-disabled',
  ghost: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:text-text-disabled disabled:bg-transparent',
  soft: 'bg-accent-soft text-text-accent hover:bg-accent-default hover:text-text-on-accent disabled:bg-bg-disabled disabled:text-text-disabled',
  danger: 'bg-danger-default text-text-on-accent hover:brightness-110 disabled:bg-bg-disabled disabled:text-text-disabled',
};

export function Button({
  variant = 'primary',
  size = 'm',
  icon: Icon,
  trailingIcon: Trailing,
  children,
  className,
  ...rest
}: { variant?: ButtonVariant; size?: 's' | 'm'; icon?: LucideIcon; trailingIcon?: LucideIcon; children: ReactNode; ref?: Ref<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-label-m whitespace-nowrap transition-[background-color,color,border-color,transform,filter] duration-(--v-duree-courte) active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100',
        size === 's' ? 'h-9 px-3.5' : 'h-11 px-5',
        buttonVariant[variant],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 's' ? 16 : 18} strokeWidth={ICON_STROKE} aria-hidden />}
      {children}
      {Trailing && <Trailing size={16} strokeWidth={ICON_STROKE} aria-hidden />}
    </button>
  );
}

export type Tone = 'accent' | 'signal' | 'warn' | 'danger' | 'neutral';

export const toneClass: Record<Tone, { bg: string; fg: string; dot: string; border: string }> = {
  accent: { bg: 'bg-accent-soft', fg: 'text-text-accent', dot: 'bg-accent-default', border: 'border-accent-default' },
  signal: { bg: 'bg-signal-soft', fg: 'text-text-signal', dot: 'bg-signal-default', border: 'border-signal-default' },
  warn: { bg: 'bg-warn-soft', fg: 'text-text-warn', dot: 'bg-warn-default', border: 'border-warn-default' },
  danger: { bg: 'bg-danger-soft', fg: 'text-text-danger', dot: 'bg-danger-default', border: 'border-danger-default' },
  neutral: { bg: 'bg-bg-raised', fg: 'text-text-secondary', dot: 'bg-text-muted', border: 'border-border-strong' },
};

/** Status = colour + text, never colour alone. */
export function StatusBadge({ tone = 'accent', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = toneClass[tone];
  return (
    <span className={cn('inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-label-s whitespace-nowrap', t.bg, t.fg, className)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />
      <span className="truncate">{children}</span>
    </span>
  );
}

const avatarGradient = {
  blue: 'bg-(image:--gradient-avatar-blue)',
  warm: 'bg-(image:--gradient-avatar-warm)',
  green: 'bg-(image:--gradient-avatar-green)',
  violet: 'bg-(image:--gradient-avatar-violet)',
} as const;

/** Initials on the person's gradient, or their photo. `chip`: the user chip's (the whole chip, a fine light ring). */
export function Avatar({ name, hue = 'warm', size = 'm', photo, className }: { name: string; hue?: keyof typeof avatarGradient; size?: 'xs' | 's' | 'm' | 'chip'; photo?: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={photo ? { backgroundImage: `url(${photo})` } : undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-cover bg-center font-medium text-text-on-accent',
        !photo && avatarGradient[hue],
        // The edge is a ring outside the picture (box-shadow), never a translucent border over it: a clean circle.
        size === 'xs' ? 'size-5 text-[8px] shadow-[0_0_0_1px_var(--avatar-edge)]' : size === 's' ? 'size-8 text-caption shadow-[0_0_0_2px_var(--avatar-edge)]' : size === 'chip' ? 'size-11 text-label-m shadow-[0_0_0_1.5px_var(--avatar-ring),0_6px_16px_-6px_rgb(0_0_0/0.45)]' : 'size-11 text-label-m shadow-[0_0_0_2px_var(--avatar-edge)]',
        className,
      )}
    >
      {name && !photo ? toInitials(name) : null}
    </span>
  );
}

/** Cadence logo: the app icon (the blue C and its mint dot on a light glass tile), public/logo/cadence-tile.png. */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return <img src="/logo/cadence-tile.png" alt="" aria-hidden width={size} height={size} draggable={false} className={cn('shrink-0 rounded-[22.5%] shadow-[0_6px_18px_-8px_rgb(0_0_0/0.45)] select-none', className)} style={{ width: size, height: size }} />;
}

/** Square icon holder of list items and card headers. */
export function IconBox({ icon: Icon, tone = 'raised', size = 'm', className }: { icon: LucideIcon; tone?: 'raised' | 'accent' | 'soft' | 'signal' | 'warn' | 'danger' | 'glass'; size?: 's' | 'm' | 'l'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-(--v-duree-courte)',
        size === 's' ? 'size-7 rounded-sm' : size === 'm' ? 'size-9 rounded-md' : 'size-11 rounded-lg',
        tone === 'raised' && 'bg-bg-raised text-text-secondary',
        tone === 'glass' && 'border border-border-subtle bg-bg-card/80 text-text-secondary',
        tone === 'accent' && 'bg-accent-default text-text-on-accent',
        tone === 'soft' && 'bg-accent-soft text-text-accent',
        tone === 'signal' && 'bg-signal-soft text-text-signal',
        tone === 'warn' && 'bg-warn-soft text-text-warn',
        tone === 'danger' && 'bg-danger-soft text-text-danger',
        className,
      )}
    >
      <Icon size={size === 's' ? 15 : size === 'm' ? 18 : 20} strokeWidth={ICON_STROKE} />
    </span>
  );
}

/** Progress (ProgressBar 68:259): width = value. */
export function ProgressBar({ value, tone = 'accent', className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-bg-hover', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-(--v-duree-longue) ease-(--v-courbe-expo)', toneClass[tone].dot)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/** Panel (radius 2xl) in frosted glass over the photo. */
export function Panel({ className, children, ref, ...rest }: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }) {
  return (
    <section ref={ref} className={cn('glass-panel flex min-h-0 flex-col rounded-2xl', className)} {...rest}>
      {children}
    </section>
  );
}

/** Block title (casse normale, Title/S) + right actions. */
export function PanelHeader({ title, icon: Icon, children, className, count }: { title: ReactNode; icon?: LucideIcon; children?: ReactNode; className?: string; count?: ReactNode }) {
  return (
    <header className={cn('flex min-h-14 shrink-0 items-center gap-3 px-5 pt-3', className)}>
      {Icon && <IconBox icon={Icon} tone="glass" size="s" />}
      <h2 className="min-w-0 truncate text-title-s text-text-primary">{title}</h2>
      {count !== undefined && <span className="tnum shrink-0 rounded-full bg-bg-raised px-2 py-0.5 text-caption whitespace-nowrap text-text-secondary">{count}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{children}</div>
    </header>
  );
}

/**
 * Round tick of a task / item (Checkbox, task variant). Done = signal (Halo: green = success), with a spring tick;
 * `burst` = green streaks shoot out of it when it gets ticked (tasks).
 */
export function CheckCircle({ checked, onChange, label, size = 'm', className, burst: celebrate }: { checked: boolean; onChange: () => void; label: string; size?: 's' | 'm'; className?: string; burst?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (celebrate && !checked) burst(e.currentTarget);
        onChange();
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-(--v-duree-courte) active:scale-90 pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:rounded-full pointer-coarse:before:content-[\'\']',
        size === 's' ? 'size-5' : 'size-6',
        checked ? 'border-signal-default bg-signal-default text-text-on-accent' : 'border-border-strong bg-bg-card/70 text-transparent hover:border-signal-default',
        className,
      )}
    >
      <motion.span initial={false} animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }} transition={{ type: 'spring', bounce: 0.45, duration: 0.35 }} className="inline-flex">
        <Check size={size === 's' ? 12 : 14} strokeWidth={3} aria-hidden />
      </motion.span>
    </button>
  );
}

/** Empty state (Assets › State/Empty): icon, a real sentence, an optional action. */
export function EmptyState({ icon: Icon, title, text, action, className }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-8 text-center', className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-border-subtle bg-bg-card/80 text-text-muted">
        <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden />
      </span>
      <div className="flex max-w-[340px] flex-col gap-1">
        <p className="text-title-s text-text-primary">{title}</p>
        {text && <p className="text-body-s text-text-secondary">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border-default bg-bg-card px-1.5 font-sans text-caption text-text-secondary">{children}</kbd>;
}

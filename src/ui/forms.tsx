/**
 * Halo forms (Components 67:300): Field, TextInput, TextArea, Select, ChoiceChips, DayPicker, NumberStepper, Toggle.
 * Field = bg/raised, border/default, radius 12, height 40 (size/control-md), focus = border/accent + soft ring.
 */
import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Check, ChevronDown, Minus, Plus, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { ICON_STROKE } from './atoms';
import { Popover } from './popover';
import { DAY_LETTER, DAY_LONG } from '../lib/dates';
import { SPRING, reducedMotion, travel } from './liquid';

export const fieldShell =
  'flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-md border border-border-default bg-bg-card/70 px-3 text-body-s text-text-primary transition-[border-color,box-shadow,background-color] duration-(--v-duree-courte) hover:border-border-strong focus-within:border-border-accent focus-within:bg-bg-card focus-within:shadow-field-focus';

export function Field({ label, help, error, children, className, htmlFor }: { label: string; help?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-label-s text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-caption text-text-danger">
          {error}
        </p>
      ) : help ? (
        <p className="text-caption text-text-muted">{help}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, invalid, icon: Icon, trailing, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: LucideIcon; trailing?: ReactNode }) {
  return (
    <div className={cn(fieldShell, invalid && 'border-danger-default hover:border-danger-default', rest.disabled && 'opacity-60', className)}>
      {Icon && <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-text-muted" />}
      <input
        type="text"
        aria-invalid={invalid || undefined}
        className="h-10 w-full min-w-0 bg-transparent text-body-s text-text-primary outline-none placeholder:text-text-muted focus-visible:shadow-none disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:opacity-60"
        {...rest}
      />
      {trailing}
    </div>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[76px] w-full min-w-0 resize-y rounded-md border border-border-default bg-bg-card/70 px-3 py-2.5 text-body-s text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-(--v-duree-courte) placeholder:text-text-muted hover:border-border-strong focus:border-border-accent focus:bg-bg-card focus:shadow-field-focus focus-visible:shadow-field-focus',
        className,
      )}
      {...rest}
    />
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** Single choice in a liquid-glass menu. Keyboard: ↑ ↓ Enter Esc. */
export function Select<T extends string>({ value, options, onChange, placeholder = 'Choisir', id, label, className }: { value: T | undefined; options: Option<T>[]; onChange: (v: T) => void; placeholder?: string; id?: string; label?: string; className?: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);
  const pick = (o: Option<T>) => {
    onChange(o.value);
    setOpen(false);
    anchor.current?.focus();
  };
  const CurrentIcon = current?.icon;
  return (
    <>
      <button
        ref={anchor}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          } else if (open && e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (open && e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (open && e.key === 'Enter') {
            e.preventDefault();
            const o = options[active];
            if (o) pick(o);
          }
        }}
        className={cn(fieldShell, 'cursor-pointer text-left focus-visible:border-border-accent focus-visible:shadow-field-focus', open && 'border-border-accent bg-bg-card shadow-field-focus', className)}
      >
        {CurrentIcon && <CurrentIcon size={16} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-text-secondary" />}
        <span className={cn('min-w-0 flex-1 truncate py-2', current ? 'text-text-primary' : 'text-text-muted')}>{current?.label ?? placeholder}</span>
        <ChevronDown size={16} strokeWidth={ICON_STROKE} aria-hidden className={cn('shrink-0 text-text-muted transition-transform duration-(--v-duree-courte)', open && 'rotate-180')} />
      </button>
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} maxHeight={300}>
        <ul id={listId} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto p-1.5">
          {options.map((o, i) => {
            const Icon = o.icon;
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-body-s transition-colors', i === active && 'bg-bg-card/80', selected ? 'text-text-accent' : 'text-text-primary')}
              >
                {Icon && <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden className={selected ? undefined : 'text-text-secondary'} />}
                <span className="flex-1 truncate">{o.label}</span>
                {selected && <Check size={16} strokeWidth={ICON_STROKE} aria-hidden />}
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}

/** A few visible choices as chips (radio group): categories, periods, icons. */
export function ChoiceChips<T extends string>({ options, value, onChange, label, iconOnly }: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string; iconOnly?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border text-label-s transition-[background-color,border-color,color] duration-(--v-duree-courte)',
              iconOnly ? 'w-9 justify-center' : 'px-3.5',
              active ? 'border-border-accent bg-accent-soft text-text-accent' : 'border-border-default bg-bg-card/70 text-text-secondary hover:border-border-strong hover:text-text-primary',
            )}
          >
            {Icon && <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden />}
            {!iconOnly && o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Weekday picker: L M M J V S D. `multiple` = habits (several days), otherwise one day (routines). */
export function DayPicker({ value, onChange, multiple }: { value: number[]; onChange: (days: number[]) => void; multiple?: boolean }) {
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label="Jours" className="flex gap-1.5">
      {DAY_LETTER.map((letter, i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            aria-label={DAY_LONG[i]}
            title={DAY_LONG[i]}
            onClick={() => onChange(multiple ? (on ? value.filter((d) => d !== i) : [...value, i].sort()) : [i])}
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-full border text-label-m transition-[background-color,border-color,color] duration-(--v-duree-courte)',
              on ? 'border-accent-default bg-accent-default text-text-on-accent' : 'border-border-default bg-bg-card/70 text-text-secondary hover:border-border-strong hover:text-text-primary',
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

/** Number with − / + (sets, reps, kg, targets). */
export function NumberStepper({ value, onChange, step = 1, min = 0, max = 9999, label, suffix, decimals = 0, className }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label: string; suffix?: string; decimals?: number; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const shown = draft ?? (decimals ? value.toFixed(decimals).replace('.', ',') : String(value)).replace(/,0+$/, '');
  return (
    <div className={cn('flex h-10 items-center rounded-md border border-border-default bg-bg-card/70 transition-colors focus-within:border-border-accent focus-within:shadow-field-focus', className)}>
      <button type="button" aria-label={`Diminuer ${label}`} onClick={() => onChange(clamp(value - step))} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text-primary disabled:text-text-disabled" disabled={value <= min}>
        <Minus size={14} strokeWidth={2} aria-hidden />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const v = parseFloat(draft.replace(',', '.'));
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
            setDraft(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="tnum w-full min-w-0 bg-transparent text-center text-label-m text-text-primary outline-none focus-visible:shadow-none"
      />
      {suffix && <span className="shrink-0 pr-1 text-caption text-text-muted">{suffix}</span>}
      <button type="button" aria-label={`Augmenter ${label}`} onClick={() => onChange(clamp(value + step))} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text-primary disabled:text-text-disabled" disabled={value >= max}>
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

/** On/off switch (Toggle 67:263, Anim · Interrupteur: spring). */
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  // The knob slides with the bars' liquid spring (Web Animations), from where it was to where it now sits.
  const knob = useRef<HTMLSpanElement>(null);
  const was = useRef<number | null>(null);
  useLayoutEffect(() => {
    const k = knob.current;
    if (!k) return;
    const x = k.offsetLeft;
    const from = was.current;
    was.current = x;
    if (from === null || from === x || reducedMotion()) return;
    k.getAnimations().forEach((a) => a.cancel());
    k.animate(travel(from - x, 'x', k.offsetWidth, k.offsetWidth), { duration: SPRING.ms, easing: 'linear' });
  }, [checked]);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-label-m text-text-primary">{label}</span>
        {description && <span className="block text-caption text-text-secondary">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-(--v-duree-courte)', checked ? 'bg-accent-default' : 'bg-bg-hover')}
      >
        <span ref={knob} className={cn('size-6 rounded-full bg-bg-card shadow-[0_1px_3px_rgb(14_16_20/0.25)] will-change-transform', checked && 'ml-auto')} />
      </button>
    </label>
  );
}

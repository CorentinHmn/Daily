/**
 * Date and time fields with the app's own pickers (instead of the browser's grey ones): a field like the others that
 * opens a liquid-glass popover, the chosen value in the blue bubble, the Halo type scale. Keyboard: the field opens
 * with Enter / ↓; in the picker, arrows move, Enter picks, Esc closes.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from './cn';
import { Button, ICON_STROKE, IconButton } from './atoms';
import { fieldShell } from './forms';
import { Popover } from './popover';
import { DAY_LETTER, DAY_SHORT, addDays, capitalize, fromIso, longDate, monthEnd, monthLabel, monthStart, shortDate, todayIso, weekStart, weekdayIndex, type ISODate } from '../lib/dates';

const two = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => two(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => two(i * 5));

/** The field that opens a picker (same look as TextInput / Select). */
function PickerField({ id, open, icon: Icon, text, empty, label, onOpen, anchor }: { id?: string; open: boolean; icon: typeof Clock; text: string; empty: boolean; label: string; onOpen: () => void; anchor: RefObject<HTMLButtonElement | null> }) {
  return (
    <button
      ref={anchor}
      id={id}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`${label} : ${text}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!open && e.key === 'ArrowDown') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(fieldShell, 'cursor-pointer text-left focus-visible:border-border-accent focus-visible:shadow-field-focus', open && 'border-border-accent bg-bg-card shadow-field-focus')}
    >
      <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-text-secondary" />
      <span className={cn('tnum min-w-0 flex-1 truncate py-2', empty ? 'text-text-muted' : 'text-text-primary')}>{text}</span>
      <ChevronDown size={16} strokeWidth={ICON_STROKE} aria-hidden className={cn('shrink-0 text-text-muted transition-transform duration-(--v-duree-courte)', open && 'rotate-180')} />
    </button>
  );
}

// ── Heure ────────────────────────────────────────────────────────────────────

/** A column of the time picker (hours or minutes), scrolled to its value when it opens. */
function TimeColumn({ label, items, value, near, onPick }: { label: string; items: string[]; value: string | undefined; near: string; onPick: (v: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = list.current;
    // Centred on the value, or with no value yet on `near` (the current time).
    const on = el?.querySelector<HTMLElement>(`[data-v="${value ?? near}"]`);
    if (el && on) el.scrollTop = on.offsetTop - (el.clientHeight - on.offsetHeight) / 2;
    // Only when it opens: afterwards the list stays where the person scrolled it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (e: KeyboardEvent, step: number) => {
    e.preventDefault();
    const i = value === undefined ? (step > 0 ? -1 : items.length) : items.indexOf(value);
    const next = items[Math.max(0, Math.min(items.length - 1, i + step))];
    if (next === undefined) return;
    onPick(next);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };
  return (
    <div className="flex min-w-0 flex-col">
      <p className="px-2 pb-1 text-center text-caption text-text-muted">{label}</p>
      <div
        ref={list}
        role="listbox"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') move(e, 1);
          else if (e.key === 'ArrowUp') move(e, -1);
        }}
        className="flex h-[216px] snap-y flex-col gap-0.5 overflow-y-auto overscroll-contain px-1 [scrollbar-width:none]"
      >
        {items.map((v) => {
          const on = v === value;
          return (
            <button
              key={v}
              data-v={v}
              type="button"
              role="option"
              aria-selected={on}
              tabIndex={on || (value === undefined && v === items[0]) ? 0 : -1}
              onClick={() => onPick(v)}
              className={cn(
                'tnum flex h-9 shrink-0 snap-center items-center justify-center rounded-full text-label-m transition-colors duration-(--v-duree-courte)',
                on ? 'bg-accent-default text-text-on-accent shadow-hairline-top' : value === undefined && v === near ? 'text-text-accent hover:bg-bg-card/80' : 'text-text-primary hover:bg-bg-card/80',
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Time of day, « 18:30 », or '' (none, when `clearable`): hours and minutes (by 5) in two columns. */
export function TimeField({ value, onChange, id, label = 'Heure', clearable = true }: { value: string; onChange: (v: string) => void; id?: string; label?: string; clearable?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [h, m] = value ? (value.split(':') as [string, string]) : [undefined, undefined];
  // A time typed elsewhere (not on the 5-minute grid) keeps its minute in the list.
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;
  const now = new Date();
  const close = () => {
    setOpen(false);
    anchor.current?.focus();
  };
  return (
    <>
      <PickerField id={id} anchor={anchor} open={open} icon={Clock} text={value || 'Aucune'} empty={!value} label={label} onOpen={() => setOpen((o) => !o)} />
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} width={232} maxHeight={330} role="dialog" label={`Choisir : ${label.toLowerCase()}`}>
        <div className="grid grid-cols-2 gap-1 p-2 pb-1">
          <TimeColumn label="Heures" items={HOURS} value={h} near={two(now.getHours())} onPick={(v) => onChange(`${v}:${m ?? '00'}`)} />
          <TimeColumn
            label="Minutes"
            items={minutes}
            value={m}
            near={two(Math.floor(now.getMinutes() / 5) * 5)}
            onPick={(v) => {
              onChange(`${h ?? two(new Date().getHours())}:${v}`);
              close();
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-1.5 border-t border-border-subtle p-2">
          {clearable && value && (
            <Button
              variant="ghost"
              size="s"
              className="mr-auto"
              onClick={() => {
                onChange('');
                close();
              }}
            >
              Effacer
            </Button>
          )}
          <Button size="s" onClick={close}>
            OK
          </Button>
        </div>
      </Popover>
    </>
  );
}

// ── Date ─────────────────────────────────────────────────────────────────────

/** The month's calendar: six weeks (a steady height), today circled, the chosen day in the blue bubble. */
function Calendar({ value, max, onPick }: { value: ISODate; max?: ISODate; onPick: (iso: ISODate) => void }) {
  const today = todayIso();
  const [month, setMonth] = useState(monthStart(value || today));
  const [focus, setFocus] = useState<ISODate>(value || today);
  const grid = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);
  const first = weekStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const shift = (n: number) => {
    const d = fromIso(month);
    d.setMonth(d.getMonth() + n);
    return monthStart(`${d.getFullYear()}-${two(d.getMonth() + 1)}-01`);
  };
  const go = (iso: ISODate) => {
    if (max && iso > max) return;
    keyboard.current = true;
    setFocus(iso);
    if (iso < month || iso > monthEnd(month)) setMonth(monthStart(iso));
  };
  useLayoutEffect(() => {
    if (!keyboard.current) return;
    keyboard.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, month]);
  const nextBlocked = !!max && shift(1) > max;
  return (
    <div className="p-3 pb-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton icon={ChevronLeft} label="Mois précédent" variant="ghost" size="s" onClick={() => setMonth(shift(-1))} />
        <p className="text-title-s text-text-primary">{capitalize(monthLabel(month))}</p>
        <IconButton icon={ChevronRight} label="Mois suivant" variant="ghost" size="s" disabled={nextBlocked} onClick={() => setMonth(shift(1))} />
      </div>
      <div aria-hidden className="grid grid-cols-7 pb-1">
        {DAY_LETTER.map((l, i) => (
          <span key={i} className="text-center text-caption text-text-muted">
            {l}
          </span>
        ))}
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={capitalize(monthLabel(month))}
        onKeyDown={(e) => {
          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
          if (step) {
            e.preventDefault();
            go(addDays(focus, step));
          } else if (e.key === 'PageUp' || e.key === 'PageDown') {
            e.preventDefault();
            const d = fromIso(focus);
            d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1));
            go(`${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`);
          }
        }}
        className="grid grid-cols-7 gap-y-0.5"
      >
        {days.map((d) => {
          const inMonth = d >= month && d <= monthEnd(month);
          const on = d === value;
          const isToday = d === today;
          const blocked = !!max && d > max;
          return (
            <button
              key={d}
              type="button"
              data-day={d}
              role="gridcell"
              aria-selected={on}
              aria-label={`${longDate(d)} ${fromIso(d).getFullYear()}`}
              aria-current={isToday ? 'date' : undefined}
              disabled={blocked}
              tabIndex={d === focus ? 0 : -1}
              onClick={() => onPick(d)}
              className={cn(
                'tnum mx-auto inline-flex size-9 items-center justify-center rounded-full text-label-m transition-colors duration-(--v-duree-courte) disabled:cursor-not-allowed disabled:opacity-30',
                on ? 'bg-accent-default text-text-on-accent shadow-hairline-top' : isToday ? 'text-text-accent ring-1 ring-border-accent ring-inset' : inMonth ? 'text-text-primary' : 'text-text-muted/60',
                !on && !blocked && 'hover:bg-bg-card/80',
              )}
            >
              {fromIso(d).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A day: the month's calendar in a popover; `max` = the last day that can be picked (a run is never in the future). */
export function DateField({ value, onChange, id, max, label = 'Date' }: { value: ISODate; onChange: (iso: ISODate) => void; id?: string; max?: ISODate; label?: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const today = todayIso();
  // « Jeu 29 oct. » (+ the year when it is not this one): short enough for a third of a dialog row.
  const text = value ? `${DAY_SHORT[weekdayIndex(value)]} ${shortDate(value)}` : 'Choisir';
  const pick = (iso: ISODate) => {
    onChange(iso);
    setOpen(false);
    anchor.current?.focus();
  };
  return (
    <>
      <PickerField id={id} anchor={anchor} open={open} icon={CalendarDays} text={text} empty={!value} label={label} onOpen={() => setOpen((o) => !o)} />
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} width={300} maxHeight={420} role="dialog" label={`Choisir : ${label.toLowerCase()}`}>
        <Calendar value={value} max={max} onPick={pick} />
        <div className="flex items-center justify-end gap-1.5 border-t border-border-subtle p-2">
          <Button variant="ghost" size="s" disabled={!!max && today > max} onClick={() => pick(today)}>
            Aujourd'hui
          </Button>
        </div>
      </Popover>
    </>
  );
}

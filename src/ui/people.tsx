/**
 * Household UI: who does a task (avatar badge), the person filter of the screens (glass pill of avatars), the « Qui ? »
 * choice of the dialogs. Everything stays hidden while the household has a single person.
 */
import { Users } from 'lucide-react';
import { useApp } from '../store/app';
import { NOUS } from '../domain/types';
import { memberOf } from '../domain/people';
import { cn } from './cn';
import { Avatar, ICON_STROKE } from './atoms';
import { useLiquidGlass } from './glass';
import { useDeferredPick, useLiquidBubble } from './liquid';

/** Avatar of the person in charge, or two stacked avatars for the household. Null when there is only one person. */
export function AssigneeBadge({ assignee, people, className }: { assignee?: string; people?: string[]; className?: string }) {
  const members = useApp((s) => s.data.members);
  if (members.length < 2) return null;
  const several = people?.length ? members.filter((x) => people.includes(x.id)) : [];
  if (several.length > 1) {
    return (
      <span role="img" aria-label={`Pour ${several.map((x) => x.name).join(' et ')}`} className={cn('inline-flex shrink-0 -space-x-1.5', className)}>
        {several.map((x) => (
          <Avatar key={x.id} name={x.name} hue={x.hue} photo={x.photo} size="xs" />
        ))}
      </span>
    );
  }
  const m = memberOf(members, several[0]?.id ?? assignee);
  if (m) {
    return (
      <span role="img" aria-label={`Pour ${m.name}`} className={cn('inline-flex shrink-0', className)}>
        <Avatar name={m.name} hue={m.hue} photo={m.photo} size="xs" />
      </span>
    );
  }
  return (
    <span role="img" aria-label="Pour le foyer" className={cn('inline-flex shrink-0 -space-x-1.5', className)}>
      {members.slice(0, 2).map((x) => (
        <Avatar key={x.id} name={x.name} hue={x.hue} photo={x.photo} size="xs" />
      ))}
    </span>
  );
}

/** Person filter of the screens (header): Tous + one avatar per person. */
export function PersonSwitcher({ className }: { className?: string }) {
  const members = useApp((s) => s.data.members);
  const person = useApp((s) => s.person);
  const meId = useApp((s) => s.data.settings.meId);
  const glass = useLiquidGlass<HTMLSpanElement>({ bezel: 12, strength: 8 });
  // The liquid bubble of the bars; every screen re-filters, so the change follows two frames later.
  const { shown, pick: set } = useDeferredPick<string | null>(person, (p) => useApp.getState().set({ person: p }));
  const { bubble, item, shell } = useLiquidBubble<string | null>(shown, members.length);
  if (members.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Personne" className={cn('relative inline-flex items-center gap-1 rounded-full p-1', className)}>
      {/* The glass, a layer behind the bubble: its rim never crosses the blue, and it stretches with the overshoot. */}
      <span
        ref={(el) => {
          shell(el);
          glass(el);
        }}
        aria-hidden
        className="liquid pointer-events-none absolute inset-0 rounded-full"
      />
      <span ref={bubble} aria-hidden className="absolute rounded-full bg-accent-default shadow-hairline-top will-change-transform" />
      <button
        ref={item(null)}
        type="button"
        role="radio"
        aria-checked={shown === null}
        onClick={() => set(null)}
        className={cn('relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-label-s transition-colors duration-200', shown === null ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:text-text-primary')}
      >
        <Users size={15} strokeWidth={ICON_STROKE} aria-hidden />
        Tous
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          ref={item(m.id)}
          type="button"
          role="radio"
          aria-checked={shown === m.id}
          aria-label={m.id === meId ? `${m.name} (moi)` : m.name}
          onClick={() => set(m.id)}
          className={cn('relative inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-1 text-label-s transition-colors duration-200', shown === m.id ? 'text-text-on-accent delay-75' : 'text-text-secondary hover:text-text-primary')}
        >
          <Avatar name={m.name} hue={m.hue} photo={m.photo} size="xs" className="size-7 text-[10px]" />
          <span className="max-w-[90px] truncate">{m.name}</span>
        </button>
      ))}
    </div>
  );
}

/** « Pour qui ? » with several choices (goals): one chip per person, at least one stays ticked. */
export function PeopleChips({ value, onChange, label = 'Pour qui ?' }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const members = useApp((s) => s.data.members);
  if (members.length < 2) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => {
              const next = on ? value.filter((x) => x !== m.id) : [...value, m.id];
              if (next.length) onChange(members.map((x) => x.id).filter((id) => next.includes(id)));
            }}
            className={cn('inline-flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-label-s transition-[background-color,border-color,color]', on ? 'border-border-accent bg-accent-soft text-text-accent' : 'border-border-default bg-bg-card/70 text-text-secondary hover:border-border-strong hover:text-text-primary')}
          >
            <Avatar name={m.name} hue={m.hue} photo={m.photo} size="xs" className="size-6" />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

/** « Qui ? » in the dialogs: the household (when allowed) and each person. */
export function WhoChips({ value, onChange, allowNous = true, label = 'Qui ?' }: { value: string | undefined; onChange: (v: string) => void; allowNous?: boolean; label?: string }) {
  const members = useApp((s) => s.data.members);
  if (members.length < 2) return null;
  const current = value ?? (allowNous ? NOUS : undefined);
  const options = [...(allowNous ? [{ id: NOUS, name: 'Nous deux' }] : []), ...members.map((m) => ({ id: m.id, name: m.name }))];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === current;
        const m = memberOf(members, o.id);
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn('inline-flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-label-s transition-[background-color,border-color,color]', on ? 'border-border-accent bg-accent-soft text-text-accent' : 'border-border-default bg-bg-card/70 text-text-secondary hover:border-border-strong hover:text-text-primary')}
          >
            {m ? (
              <Avatar name={m.name} hue={m.hue} photo={m.photo} size="xs" className="size-6" />
            ) : (
              <span className="inline-flex -space-x-1.5">
                {members.slice(0, 2).map((x) => (
                  <Avatar key={x.id} name={x.name} hue={x.hue} photo={x.photo} size="xs" />
                ))}
              </span>
            )}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

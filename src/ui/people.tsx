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

/** Avatar of the person in charge, or two stacked avatars for the household. Null when there is only one person. */
export function AssigneeBadge({ assignee, className }: { assignee?: string; className?: string }) {
  const members = useApp((s) => s.data.members);
  if (members.length < 2) return null;
  const m = memberOf(members, assignee);
  if (m) {
    return (
      <span title={`Pour ${m.name}`} className={cn('inline-flex shrink-0', className)}>
        <Avatar name={m.name} hue={m.hue} size="xs" />
      </span>
    );
  }
  return (
    <span title="Pour le foyer" className={cn('inline-flex shrink-0 -space-x-1.5', className)}>
      {members.slice(0, 2).map((x) => (
        <Avatar key={x.id} name={x.name} hue={x.hue} size="xs" />
      ))}
    </span>
  );
}

/** Person filter of the screens (header): Tous + one avatar per person. */
export function PersonSwitcher({ className }: { className?: string }) {
  const members = useApp((s) => s.data.members);
  const person = useApp((s) => s.person);
  const meId = useApp((s) => s.data.settings.meId);
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 12, strength: 8 });
  if (members.length < 2) return null;
  const set = (p: string | null) => useApp.getState().set({ person: p });
  return (
    <div ref={glass} role="radiogroup" aria-label="Personne" className={cn('liquid inline-flex items-center gap-1 rounded-full p-1', className)}>
      <button
        type="button"
        role="radio"
        aria-checked={person === null}
        onClick={() => set(null)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-label-s transition-colors', person === null ? 'bg-accent-default text-text-on-accent' : 'text-text-secondary hover:text-text-primary')}
      >
        <Users size={15} strokeWidth={ICON_STROKE} aria-hidden />
        Tous
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={person === m.id}
          aria-label={m.id === meId ? `${m.name} (moi)` : m.name}
          title={m.name}
          onClick={() => set(m.id)}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-1 text-label-s transition-colors', person === m.id ? 'bg-accent-default text-text-on-accent' : 'text-text-secondary hover:text-text-primary')}
        >
          <Avatar name={m.name} hue={m.hue} size="xs" className="size-7 text-[10px]" />
          <span className="max-w-[90px] truncate">{m.name}</span>
        </button>
      ))}
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
              <Avatar name={m.name} hue={m.hue} size="xs" className="size-6" />
            ) : (
              <span className="inline-flex -space-x-1.5">
                {members.slice(0, 2).map((x) => (
                  <Avatar key={x.id} name={x.name} hue={x.hue} size="xs" />
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

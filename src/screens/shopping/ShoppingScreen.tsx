/**
 * Courses, in two moments:
 *  - between two shops, the lists « de base » (core): what is bought every time, by aisle, without ticks (left: the
 *    lists, middle: the one chosen, right: the frequent items and the history);
 *  - a shopping session (« Lancer les courses », dialog TripDialog): the core list chosen, the items not needed this
 *    time left out, items added for this time only; then the items ticked in the shop, by aisle in shop order, a
 *    stopwatch running; « Terminer » keeps it in the history (time, what was taken) and ticks today's shopping task.
 * The aisle is guessed from the name (« 2 avocats » → 2 × avocats in Fruits et légumes).
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Copy, EllipsisVertical, Flag, History, Pencil, Play, Plus, ShoppingBasket, ShoppingCart, Sparkles, Timer, Trash2, X } from 'lucide-react';
import { runningTrip, useApp } from '../../store/app';
import { RAYONS, RAYON_ORDER, guessRayon } from '../../domain/catalog';
import type { RayonId, ShopItem, ShopTrip, TripItem } from '../../domain/types';
import { clock, duration, normalize } from '../../lib/format';
import { relativeDay, toIso } from '../../lib/dates';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, EmptyState, ICON_STROKE, IconBox, IconButton, Panel, PanelHeader } from '../../ui/atoms';
import { Ring } from '../../ui/charts';
import { ChoiceChips, Field, NumberStepper, TextInput } from '../../ui/forms';
import { Popover } from '../../ui/popover';
import { Menu, MenuButton } from '../../ui/overlays';
import { useNow } from '../../ui/useNow';
import { revealVariants } from '../../theme/motion';
import { PageHeader } from '../shell/PageHeader';

/** « 2 avocats », « 500 g de farine », « Poulet 1 kg » → name + quantity. */
export function parseItem(text: string): { name: string; qty?: string } {
  const t = text.trim().replace(/\s+/g, ' ');
  const lead = t.match(/^(\d+(?:[.,]\d+)?\s?(?:kg|g|l|cl|ml|x)?)\s+(?:de |d')?(.+)$/i);
  if (lead) return { qty: lead[1]!.replace(/\s/g, ' '), name: cap(lead[2]!) };
  const trail = t.match(/^(.+?)\s+(?:x\s?)?(\d+(?:[.,]\d+)?\s?(?:kg|g|l|cl|ml)?)$/i);
  if (trail) return { name: cap(trail[1]!), qty: trail[2] };
  return { name: cap(t) };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ShoppingScreen() {
  const lists = useApp((s) => s.data.lists);
  const trip = useApp((s) => runningTrip(s.data));
  const app = useApp.getState();
  const reveal = revealVariants();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Courses" subtitle={trip ? `Session en cours · ${trip.listName}` : 'Tes listes de base et tes sessions de courses'}>
        {!trip && (
          <Button icon={Play} onClick={() => app.openDialog({ kind: 'trip' })}>
            Lancer les courses
          </Button>
        )}
      </PageHeader>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,250px)_minmax(340px,1fr)_minmax(0,320px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} className="flex min-h-0 flex-col">
          {trip ? <TripCard trip={trip} /> : <Lists />}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={1} className="flex min-h-0 flex-col">
          {trip ? <TripPanel trip={trip} /> : lists.length ? <CorePanel /> : <Panel className="flex-1"><EmptyState icon={ShoppingBasket} title="Aucune liste" text="Crée une liste de base : ce que tu prends à chaque fois." /></Panel>}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={2} className="flex min-h-0 flex-col gap-4">
          <Frequent />
          <TripHistory />
        </motion.div>
      </div>
    </div>
  );
}

/** The items as text, by aisle (to paste in a message). */
async function copyItems(title: string, items: { name: string; qty?: string; rayon: RayonId }[]) {
  const text = [
    title,
    ...RAYON_ORDER.flatMap((r) => {
      const of = items.filter((i) => i.rayon === r);
      return of.length ? ['', RAYONS[r].label, ...of.map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ''}`)] : [];
    }),
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  useApp.getState().toast({ tone: 'success', title: 'Liste copiée', text: 'Colle-la dans un message pour l’avoir sur ton téléphone.' });
}

function Lists() {
  const lists = useApp((s) => s.data.lists);
  const activeId = useApp((s) => s.data.activeListId) ?? lists[0]?.id;
  const app = useApp.getState();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  return (
    <Panel className="flex-1">
      <PanelHeader title="Listes de base">
        <IconButton icon={Plus} label="Nouvelle liste de base" variant="ghost" size="s" onClick={() => setAdding(true)} />
      </PanelHeader>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2 pb-3 max-md:flex-row max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&>li]:w-[210px] max-md:[&>li]:shrink-0">
        {lists.map((l) => {
          const on = l.id === activeId;
          if (renaming?.id === l.id) {
            return (
              <li key={l.id}>
                <TextInput
                  autoFocus
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: l.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renaming.name.trim()) {
                      app.renameList(l.id, renaming.name.trim());
                      setRenaming(null);
                    } else if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={() => {
                    if (renaming.name.trim()) app.renameList(l.id, renaming.name.trim());
                    setRenaming(null);
                  }}
                  aria-label="Nouveau nom de la liste"
                />
              </li>
            );
          }
          return (
            <li key={l.id} className="group/list relative">
              <button type="button" onClick={() => app.setActiveList(l.id)} aria-current={on || undefined} className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 pr-10 text-left transition-[background-color,border-color]', on ? 'border-border-accent bg-accent-soft' : 'border-transparent hover:border-border-subtle hover:bg-bg-card/70')}>
                <IconBox icon={ShoppingBasket} tone={on ? 'accent' : 'glass'} size="s" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label-m text-text-primary">{l.name}</span>
                  <span className="block text-caption text-text-secondary">{l.items.length ? `${l.items.length} article${l.items.length > 1 ? 's' : ''}` : 'Vide'}</span>
                </span>
              </button>
              <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
                <MenuButton
                  items={[
                    { label: 'Renommer', icon: Pencil, onSelect: () => setRenaming({ id: l.id, name: l.name }) },
                    { label: 'Supprimer la liste', icon: Trash2, tone: 'danger', onSelect: () => app.deleteList(l.id) },
                  ]}
                >
                  {({ ref, toggle, open }) => <IconButton ref={ref} icon={EllipsisVertical} label={`Actions de la liste ${l.name}`} variant="ghost" size="xs" className={open ? '' : 'opacity-0 group-hover/list:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'} onClick={toggle} />}
                </MenuButton>
              </div>
            </li>
          );
        })}
        {adding && (
          <li>
            <TextInput
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  app.addList(name.trim());
                  setName('');
                  setAdding(false);
                } else if (e.key === 'Escape') setAdding(false);
              }}
              onBlur={() => setAdding(false)}
              placeholder="Nom de la liste"
              aria-label="Nom de la nouvelle liste"
            />
          </li>
        )}
      </ul>
    </Panel>
  );
}

/** The field to add an item, with the aisle it would go in. */
function AddField({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string, qty?: string) => void }) {
  const frequent = useApp((s) => s.data.frequent);
  const [draft, setDraft] = useState('');
  const parsed = draft.trim() ? parseItem(draft) : null;
  const rayon: RayonId | null = parsed ? (frequent[normalize(parsed.name)]?.rayon ?? guessRayon(parsed.name)) : null;
  return (
    <TextInput
      icon={Plus}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && parsed) {
          onAdd(parsed.name, parsed.qty);
          setDraft('');
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      trailing={
        rayon && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg-raised px-2 py-1 text-caption text-text-secondary">
            {(() => {
              const R = RAYONS[rayon].icon;
              return <R size={12} strokeWidth={ICON_STROKE} aria-hidden />;
            })()}
            {RAYONS[rayon].label}
          </span>
        )
      }
    />
  );
}

/** Items by aisle, in shop order. */
function ByAisle<T extends { id: string; rayon: RayonId }>({ items, row }: { items: T[]; row: (i: T) => React.ReactNode }) {
  return RAYON_ORDER.map((r) => {
    const of = items.filter((i) => i.rayon === r);
    if (!of.length) return null;
    const R = RAYONS[r];
    return (
      <section key={r} className="mb-3">
        <h3 className="flex items-center gap-2 px-2 pb-1 text-label-s text-text-secondary">
          <R.icon size={14} strokeWidth={ICON_STROKE} aria-hidden />
          {R.label}
          <span className="tnum text-text-muted">{of.length}</span>
        </h3>
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>{of.map(row)}</AnimatePresence>
        </ul>
      </section>
    );
  });
}

/** A core list: what is bought every time (no ticks: they belong to a session). */
function CorePanel() {
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0])!;
  const app = useApp.getState();
  return (
    <Panel className="flex-1">
      <PanelHeader title={list.name} count={`${list.items.length} article${list.items.length > 1 ? 's' : ''}`}>
        <IconButton icon={Copy} label="Copier la liste" variant="ghost" size="s" onClick={() => void copyItems(list.name, list.items)} disabled={!list.items.length} />
      </PanelHeader>
      <div className="px-4 pt-2">
        <AddField label="Ajouter un article" placeholder="Ajouter un article, ex. 2 avocats" onAdd={(n, q) => app.addItem(n, q)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {list.items.length === 0 && <EmptyState icon={ShoppingBasket} title="Liste vide" text="Ce que tu prends à chaque fois : tape un article ci-dessus ou pioche dans tes articles fréquents." />}
        <ByAisle items={list.items} row={(i) => <ItemRow key={i.id} item={i} onUpdate={(p) => app.updateItem(i.id, p)} onDelete={() => app.deleteItem(i.id)} />} />
      </div>
    </Panel>
  );
}

/** The session running: its items to tick, by aisle; what is in the cart below. */
function TripPanel({ trip }: { trip: ShopTrip }) {
  const app = useApp.getState();
  const todo = trip.items.filter((i) => !i.checked);
  const inCart = trip.items.filter((i) => i.checked);
  const row = (i: TripItem) => <ItemRow key={i.id} item={i} onToggle={() => app.toggleTripItem(i.id)} onUpdate={(p) => app.updateTripItem(i.id, p)} onDelete={() => app.deleteTripItem(i.id)} />;
  return (
    <Panel className="flex-1">
      <PanelHeader title={trip.listName} count={`${todo.length} à prendre`}>
        <IconButton icon={Copy} label="Copier ce qu'il reste à prendre" variant="ghost" size="s" onClick={() => void copyItems(trip.listName, todo)} disabled={!todo.length} />
      </PanelHeader>
      <div className="px-4 pt-2">
        <AddField label="Ajouter pour cette fois" placeholder="Ajouter pour cette fois, ex. 6 œufs" onAdd={(n, q) => app.addTripItem(n, q)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {trip.items.length === 0 && <EmptyState icon={ShoppingCart} title="Rien à prendre" text="Ajoute un article ci-dessus." />}
        {todo.length === 0 && trip.items.length > 0 && <p className="px-2 pb-3 text-body-s text-text-signal">Tout est dans le panier : tu peux terminer les courses.</p>}
        <ByAisle items={todo} row={row} />
        {inCart.length > 0 && (
          <section className="mt-2 border-t border-border-subtle pt-3">
            <h3 className="flex items-center gap-2 px-2 pb-1 text-label-s text-text-signal">
              <ShoppingCart size={14} strokeWidth={ICON_STROKE} aria-hidden />
              Dans le panier
              <span className="tnum">{inCart.length}</span>
            </h3>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>{inCart.map(row)}</AnimatePresence>
            </ul>
          </section>
        )}
      </div>
    </Panel>
  );
}

/** « 12:05 » under an hour, « 1 h 05 » after. */
function elapsed(ms: number): string {
  return ms < 3_600_000 ? clock(ms / 1000) : duration(ms / 60000);
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** The session running: the cart, the stopwatch, the way out. */
function TripCard({ trip }: { trip: ShopTrip }) {
  const app = useApp.getState();
  const now = useNow(1000);
  const total = trip.items.length;
  const done = trip.items.filter((i) => i.checked).length;
  const all = total > 0 && done === total;
  return (
    <Panel className="shrink-0">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          <Ring value={total ? done / total : 0} size={88} stroke={8} tone={all ? 'signal' : 'accent'}>
            <ShoppingCart size={20} strokeWidth={ICON_STROKE} aria-hidden className={all ? 'text-text-signal' : 'text-text-accent'} />
          </Ring>
          <div className="min-w-0">
            <p className="text-label-s text-text-secondary">Dans le panier</p>
            <p className="tnum text-data-l text-text-primary">
              {done}
              <span className="text-title-m text-text-muted"> / {total}</span>
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-body-s text-text-secondary">
          <Timer size={16} strokeWidth={ICON_STROKE} aria-hidden className="text-text-accent" />
          <span className="tnum text-label-m text-text-primary" aria-label={`Durée : ${duration((now - trip.startedAt) / 60000)}`}>
            {elapsed(Math.max(0, now - trip.startedAt))}
          </span>
          depuis {hhmm(trip.startedAt)}
        </p>
        <Button icon={Flag} variant={all ? 'primary' : 'secondary'} onClick={() => app.endTrip()}>
          Terminer les courses
        </Button>
        <Button variant="ghost" size="s" className="self-center" onClick={() => app.cancelTrip()}>
          Annuler la session
        </Button>
      </div>
    </Panel>
  );
}

/** The sessions ended: when, which list, how long, what was taken (and what was not). */
function TripHistory() {
  const trips = useApp((s) => s.data.trips);
  const app = useApp.getState();
  const [open, setOpen] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const ended = trips.filter((t) => t.endedAt).sort((a, b) => b.startedAt - a.startedAt);
  const shown = more ? ended : ended.slice(0, 8);
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Historique" icon={History} count={ended.length || undefined} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3">
        {ended.length === 0 && <p className="px-1 py-2 text-body-s text-text-secondary">Tes sessions terminées apparaîtront ici, avec leur durée et ce que tu as pris.</p>}
        <ul className="flex flex-col gap-1">
          {shown.map((t) => {
            const taken = t.items.filter((i) => i.checked);
            const left = t.items.filter((i) => !i.checked);
            const on = open === t.id;
            const day = relativeDay(toIso(new Date(t.startedAt)));
            return (
              <li key={t.id} className={cn('rounded-lg border transition-[background-color,border-color]', on ? 'border-border-subtle bg-bg-card/50' : 'border-transparent')}>
                <button type="button" onClick={() => setOpen(on ? null : t.id)} aria-expanded={on} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-bg-card/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-m text-text-primary">
                      {day.charAt(0).toUpperCase() + day.slice(1)} · {t.listName}
                    </span>
                    <span className="tnum block text-caption text-text-secondary">
                      à {hhmm(t.startedAt)} · {duration(Math.max(1, (t.endedAt! - t.startedAt) / 60000))}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-label-s text-text-secondary">
                    {taken.length}/{t.items.length}
                  </span>
                  <ChevronDown size={16} strokeWidth={ICON_STROKE} aria-hidden className={cn('shrink-0 text-text-muted transition-transform', on && 'rotate-180')} />
                </button>
                {on && (
                  <div className="flex flex-col gap-2.5 px-2.5 pb-3">
                    {taken.length > 0 && (
                      <div>
                        <p className="pb-1 text-caption text-text-signal">Pris</p>
                        <p className="text-body-s text-text-primary">{taken.map((i) => (i.qty ? `${i.name} (${i.qty})` : i.name)).join(', ')}</p>
                      </div>
                    )}
                    {left.length > 0 && (
                      <div>
                        <p className="pb-1 text-caption text-text-muted">Pas pris</p>
                        <p className="text-body-s text-text-secondary">{left.map((i) => i.name).join(', ')}</p>
                      </div>
                    )}
                    <Button variant="ghost" size="s" icon={Trash2} className="self-start text-text-danger! hover:bg-danger-soft" onClick={() => app.deleteTrip(t.id)}>
                      Retirer de l'historique
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {ended.length > shown.length && (
          <Button variant="ghost" size="s" className="mt-1 self-start" onClick={() => setMore(true)}>
            Voir les {ended.length - shown.length} plus anciennes
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** An item: ticked in a session (`onToggle`), or of a core list (no tick). */
function ItemRow({ item, onToggle, onUpdate, onDelete }: { item: ShopItem | TripItem; onToggle?: () => void; onUpdate: (patch: { qty?: string; rayon?: RayonId }) => void; onDelete: () => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const R = RAYONS[item.rayon];
  const checked = !!onToggle && item.checked;
  return (
    <motion.li layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="group/item">
      <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg-card/60">
        {onToggle && <CheckCircle checked={checked} onChange={onToggle} label={checked ? `Remettre ${item.name}` : `Cocher ${item.name}`} />}
        <span className={cn('min-w-0 flex-1 truncate text-body-m', checked ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary')}>{item.name}</span>
        {'extra' in item && item.extra && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-caption text-text-accent">En plus</span>}
        <QtyButton item={item} onChange={(qty) => onUpdate({ qty })} />
        <button ref={anchor} type="button" onClick={() => setOpen(true)} aria-label={`Rayon de ${item.name} : ${R.label}`} className="inline-flex size-8 items-center justify-center rounded-full text-text-muted opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-bg-hover hover:text-text-primary focus-visible:opacity-100 pointer-coarse:opacity-70">
          <R.icon size={15} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <IconButton icon={X} label={`Retirer ${item.name}`} variant="danger" size="xs" className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-70" onClick={onDelete} />
      </div>
      <Menu open={open} anchor={anchor} onClose={() => setOpen(false)} width={220} items={RAYON_ORDER.map((r) => ({ label: RAYONS[r].label, icon: RAYONS[r].icon, onSelect: () => onUpdate({ rayon: r }) }))} />
    </motion.li>
  );
}

const UNITS = [
  { value: 'u', label: 'u', step: 1, start: 1 },
  { value: 'g', label: 'g', step: 50, start: 500 },
  { value: 'kg', label: 'kg', step: 0.5, start: 1 },
  { value: 'ml', label: 'ml', step: 50, start: 500 },
  { value: 'cl', label: 'cl', step: 5, start: 25 },
  { value: 'L', label: 'L', step: 0.5, start: 1 },
] as const;
type Unit = (typeof UNITS)[number]['value'];

/** « 500 g » → 500 + g, « 2 » or « 2x » → 2 + u (pieces), « 1,5 l » → 1.5 + L. */
export function splitQty(qty?: string): { amount: number; unit: Unit } | null {
  const m = qty?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml|x|u)?$/i);
  if (!m) return null;
  const raw = (m[2] ?? 'u').toLowerCase();
  const unit: Unit = raw === 'x' || raw === 'u' ? 'u' : raw === 'l' ? 'L' : (raw as Unit);
  return { amount: parseFloat(m[1]!.replace(',', '.')), unit };
}

export function joinQty(amount: number, unit: Unit): string | undefined {
  if (!(amount > 0)) return undefined;
  const n = String(Math.round(amount * 100) / 100).replace('.', ',');
  return unit === 'u' ? n : `${n} ${unit}`;
}

/** The quantity of an item (or « Qté » on hover): opens the quantity and its unit, chosen like the aisle. */
function QtyButton({ item, onChange }: { item: { name: string; qty?: string }; onChange: (qty: string | undefined) => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = splitQty(item.qty);
  const amount = parsed?.amount ?? 0;
  const unit = parsed?.unit ?? 'u';
  const def = UNITS.find((u) => u.value === unit)!;
  const set = (a: number, u: Unit) => onChange(joinQty(a, u));
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={item.qty ? `Quantité de ${item.name} : ${item.qty}` : `Choisir la quantité de ${item.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'tnum inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-label-s transition-[background-color,color,opacity]',
          item.qty ? 'bg-bg-raised text-text-secondary hover:bg-bg-hover hover:text-text-primary' : 'border border-dashed border-border-default text-text-muted opacity-0 group-hover/item:opacity-100 hover:text-text-primary focus-visible:opacity-100 pointer-coarse:opacity-70',
          open && 'opacity-100',
        )}
      >
        {item.qty ?? 'Qté'}
      </button>
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} width={336} align="end" role="dialog" label={`Quantité de ${item.name}`}>
        <div className="flex flex-col gap-3 p-3.5">
          <Field label="Quantité">
            <NumberStepper label={`quantité de ${item.name}`} value={amount} step={def.step} max={9999} decimals={def.step < 1 ? 1 : 0} suffix={unit === 'u' ? undefined : unit} onChange={(a) => set(a, unit)} />
          </Field>
          <Field label="Unité">
            <ChoiceChips label="Unité" value={unit} onChange={(u) => set(u === unit ? amount : (UNITS.find((x) => x.value === u)!.start), u)} options={UNITS.map((u) => ({ value: u.value, label: u.label }))} />
          </Field>
          {item.qty && (
            <Button variant="ghost" size="s" className="self-start" onClick={() => (onChange(undefined), setOpen(false))}>
              Sans quantité
            </Button>
          )}
        </div>
      </Popover>
    </>
  );
}

/** Long press (380 ms without moving) on a frequent item, then drag it onto the bin to forget it. */
const HOLD_MS = 380;

interface Drag {
  key: string;
  name: string;
  rayon: RayonId;
  x: number;
  y: number;
  over: boolean;
}

/** The items added most often, one click to add them (to the session running, else to the core list shown). */
function Frequent() {
  const frequent = useApp((s) => s.data.frequent);
  const trip = useApp((s) => runningTrip(s.data));
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0]);
  const app = useApp.getState();
  const [drag, setDrag] = useState<Drag | null>(null);
  const bin = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const onList = new Set((trip ? trip.items.filter((i) => !i.checked) : (list?.items ?? [])).map((i) => normalize(i.name)));
  const items = Object.entries(frequent)
    .filter(([k]) => !onList.has(k))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 24);

  const press = (e: React.PointerEvent, key: string, name: string, rayon: RayonId) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let holding = false;
    dragged.current = false;
    const overBin = (x: number, y: number) => {
      const r = bin.current?.getBoundingClientRect();
      return !!r && x > r.left - 16 && x < r.right + 16 && y > r.top - 16 && y < r.bottom + 16;
    };
    const timer = window.setTimeout(() => {
      holding = true;
      dragged.current = true;
      navigator.vibrate?.(12);
      setDrag({ key, name, rayon, x: start.x, y: start.y, over: false });
    }, HOLD_MS);
    const move = (ev: PointerEvent) => {
      if (!holding) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) stop();
        return;
      }
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY, over: overBin(ev.clientX, ev.clientY) } : d));
    };
    // While dragging, the finger must not scroll the page (non-passive listener, cancels the pan).
    const block = (ev: TouchEvent) => {
      if (holding) ev.preventDefault();
    };
    const up = (ev: PointerEvent) => {
      if (holding && overBin(ev.clientX, ev.clientY)) app.removeFrequent(key);
      stop();
    };
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('touchmove', block);
      setDrag(null);
      // The click that may follow the release must not add the item; a later click must.
      window.setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('touchmove', block, { passive: false });
  };

  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Articles fréquents" icon={Sparkles} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        {items.length === 0 ? (
          <p className="px-1 text-body-s text-text-secondary">Les articles que tu ajoutes souvent apparaîtront ici.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {items.map(([k, f]) => {
                const R = RAYONS[f.rayon];
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onPointerDown={(e) => press(e, k, f.name, f.rayon)}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        if (dragged.current) {
                          dragged.current = false;
                          return;
                        }
                        if (trip) app.addTripItem(f.name);
                        else app.addItem(f.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Delete' || e.key === 'Backspace') app.removeFrequent(k);
                      }}
                      aria-label={`Ajouter ${f.name}`}
                      aria-keyshortcuts="Delete"
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-full border border-border-default bg-bg-card/70 pr-3.5 pl-2.5 text-label-s text-text-primary transition-[background-color,border-color,transform,opacity] select-none [-webkit-touch-callout:none] hover:border-border-accent hover:bg-accent-soft active:scale-95',
                        drag?.key === k && 'opacity-30',
                      )}
                    >
                      <R.icon size={14} strokeWidth={ICON_STROKE} aria-hidden className="text-text-secondary" />
                      {f.name}
                      <Plus size={13} strokeWidth={2} aria-hidden className="text-text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 px-1 text-caption text-text-muted">Maintiens un article pour le glisser dans la poubelle.</p>
          </>
        )}
      </div>
      {createPortal(
        <AnimatePresence>
          {drag && (
            <>
              <motion.div
                key="bin"
                ref={bin}
                initial={{ opacity: 0, y: 16, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%', scale: drag.over ? 1.12 : 1 }}
                exit={{ opacity: 0, y: 16, x: '-50%' }}
                transition={{ duration: 0.18 }}
                style={{ position: 'fixed' }}
                className={cn(
                  'bottom-10 left-1/2 z-[1350] flex items-center gap-2.5 rounded-full border px-5 py-3.5 text-label-m shadow-[0_12px_32px_rgb(14_16_20/0.18)] backdrop-blur-md max-md:bottom-[calc(env(safe-area-inset-bottom)+104px)]',
                  drag.over ? 'border-danger-default bg-danger-default text-text-on-accent' : 'border-border-default bg-bg-card/90 text-text-danger',
                )}
              >
                <Trash2 size={20} strokeWidth={ICON_STROKE} aria-hidden />
                {drag.over ? 'Lâche pour retirer' : 'Glisse ici pour retirer'}
              </motion.div>
              <div
                key="ghost"
                aria-hidden
                style={{ position: 'fixed', left: drag.x, top: drag.y }}
                className="pointer-events-none z-[1360] inline-flex h-9 -translate-x-1/2 -translate-y-1/2 scale-110 items-center gap-2 rounded-full border border-border-accent bg-bg-card pr-3.5 pl-2.5 text-label-s text-text-primary shadow-[0_10px_28px_rgb(14_16_20/0.22)]"
              >
                {(() => {
                  const R = RAYONS[drag.rayon];
                  return <R.icon size={14} strokeWidth={ICON_STROKE} aria-hidden className="text-text-secondary" />;
                })()}
                {drag.name}
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Panel>
  );
}

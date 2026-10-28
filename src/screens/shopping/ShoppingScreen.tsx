/**
 * Courses: the lists (left), the active list sorted by aisle in shop order (middle; the aisle is guessed from the
 * name, « 2 avocats » → 2 × avocats in Fruits et légumes), the cart progress and the frequent items to add in one
 * click (right). Completing the list ticks today's shopping task.
 */
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, EllipsisVertical, ListX, Pencil, Plus, ShoppingBasket, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../../store/app';
import { RAYONS, RAYON_ORDER, guessRayon } from '../../domain/catalog';
import type { RayonId, ShopItem } from '../../domain/types';
import { normalize } from '../../lib/format';
import { cn } from '../../ui/cn';
import { Button, CheckCircle, EmptyState, ICON_STROKE, IconBox, IconButton, Panel, PanelHeader } from '../../ui/atoms';
import { Ring } from '../../ui/charts';
import { TextInput } from '../../ui/forms';
import { Menu, MenuButton } from '../../ui/overlays';
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
  const activeId = useApp((s) => s.data.activeListId);
  const list = lists.find((l) => l.id === activeId) ?? lists[0];
  const app = useApp.getState();
  const reveal = revealVariants();
  const copy = async () => {
    if (!list) return;
    const text = [
      list.name,
      ...RAYON_ORDER.flatMap((r) => {
        const items = list.items.filter((i) => i.rayon === r && !i.checked);
        return items.length ? ['', RAYONS[r].label, ...items.map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ''}`)] : [];
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
    app.toast({ tone: 'success', title: 'Liste copiée', text: 'Colle-la dans un message pour l’avoir sur ton téléphone.' });
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Courses" people={false}>
        <Button variant="secondary" icon={Copy} onClick={() => void copy()} disabled={!list || list.items.every((i) => i.checked)}>
          <span className="max-md:hidden">Copier la liste</span>
          <span className="md:hidden">Copier</span>
        </Button>
      </PageHeader>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,250px)_minmax(340px,1fr)_minmax(0,320px)] gap-4 pb-1 max-md:grid-cols-1">
        <motion.div initial="hidden" animate="show" variants={reveal} className="flex min-h-0 flex-col">
          <Lists />
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={1} className="flex min-h-0 flex-col">
          {list ? <ListPanel /> : <Panel className="flex-1"><EmptyState icon={ShoppingCart} title="Aucune liste" text="Crée une liste pour commencer." /></Panel>}
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={reveal} custom={2} className="flex min-h-0 flex-col gap-4">
          <CartPanel />
          <Frequent />
        </motion.div>
      </div>
    </div>
  );
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
      <PanelHeader title="Listes">
        <IconButton icon={Plus} label="Nouvelle liste" variant="ghost" size="s" onClick={() => setAdding(true)} />
      </PanelHeader>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2 pb-3 max-md:flex-row max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&>li]:w-[210px] max-md:[&>li]:shrink-0">
        {lists.map((l) => {
          const on = l.id === activeId;
          const left = l.items.filter((i) => !i.checked).length;
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
                  <span className="block text-caption text-text-secondary">{left ? `${left} article${left > 1 ? 's' : ''} à prendre` : 'Rien à prendre'}</span>
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

function ListPanel() {
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0])!;
  const frequent = useApp((s) => s.data.frequent);
  const app = useApp.getState();
  const [draft, setDraft] = useState('');
  const parsed = draft.trim() ? parseItem(draft) : null;
  const rayon: RayonId | null = parsed ? (frequent[normalize(parsed.name)]?.rayon ?? guessRayon(parsed.name)) : null;
  const todo = list.items.filter((i) => !i.checked);
  const inCart = list.items.filter((i) => i.checked);
  const add = () => {
    if (!parsed) return;
    app.addItem(parsed.name, parsed.qty);
    setDraft('');
  };
  return (
    <Panel className="flex-1">
      <PanelHeader title={list.name} count={`${todo.length} à prendre`}>
        <Button variant="ghost" size="s" icon={ListX} aria-label="Retirer les cochés" title="Retirer les cochés" onClick={() => app.clearChecked()} disabled={inCart.length === 0}>
          <span className="max-xl:hidden">Retirer les cochés</span>
        </Button>
      </PanelHeader>
      <div className="px-4 pt-2">
        <TextInput
          icon={Plus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Ajouter un article, ex. 2 avocats"
          aria-label="Ajouter un article"
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
        {list.items.length === 0 && <EmptyState icon={ShoppingCart} title="Liste vide" text="Tape un article ci-dessus ou pioche dans tes articles fréquents." />}
        {RAYON_ORDER.map((r) => {
          const items = todo.filter((i) => i.rayon === r);
          if (!items.length) return null;
          const R = RAYONS[r];
          return (
            <section key={r} className="mb-3">
              <h3 className="flex items-center gap-2 px-2 pb-1 text-label-s text-text-secondary">
                <R.icon size={14} strokeWidth={ICON_STROKE} aria-hidden />
                {R.label}
                <span className="tnum text-text-muted">{items.length}</span>
              </h3>
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {items.map((i) => (
                    <ItemRow key={i.id} item={i} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          );
        })}
        {inCart.length > 0 && (
          <section className="mt-2 border-t border-border-subtle pt-3">
            <h3 className="flex items-center gap-2 px-2 pb-1 text-label-s text-text-signal">
              <ShoppingCart size={14} strokeWidth={ICON_STROKE} aria-hidden />
              Dans le panier
              <span className="tnum">{inCart.length}</span>
            </h3>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {inCart.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}
      </div>
    </Panel>
  );
}

function ItemRow({ item }: { item: ShopItem }) {
  const app = useApp.getState();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const R = RAYONS[item.rayon];
  return (
    <motion.li layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="group/item">
      <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg-card/60">
        <CheckCircle checked={item.checked} onChange={() => app.toggleItem(item.id)} label={item.checked ? `Remettre ${item.name}` : `Cocher ${item.name}`} />
        <span className={cn('min-w-0 flex-1 truncate text-body-m', item.checked ? 'text-text-muted line-through decoration-text-muted/60' : 'text-text-primary')}>{item.name}</span>
        {item.qty && <span className="tnum rounded-full bg-bg-raised px-2 py-0.5 text-label-s text-text-secondary">{item.qty}</span>}
        <button ref={anchor} type="button" onClick={() => setOpen(true)} aria-label={`Rayon de ${item.name} : ${R.label}`} title={`Rayon : ${R.label}`} className="inline-flex size-8 items-center justify-center rounded-full text-text-muted opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-bg-hover hover:text-text-primary focus-visible:opacity-100 pointer-coarse:opacity-70">
          <R.icon size={15} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <IconButton icon={X} label={`Retirer ${item.name}`} variant="danger" size="xs" className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-70" onClick={() => app.deleteItem(item.id)} />
      </div>
      <Menu
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        width={220}
        items={RAYON_ORDER.map((r) => ({ label: RAYONS[r].label, icon: RAYONS[r].icon, onSelect: () => app.updateItem(item.id, { rayon: r }) }))}
      />
    </motion.li>
  );
}

function CartPanel() {
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0]);
  const total = list?.items.length ?? 0;
  const done = list?.items.filter((i) => i.checked).length ?? 0;
  return (
    <Panel className="shrink-0">
      <div className="flex items-center gap-5 p-5">
        <Ring value={total ? done / total : 0} size={96} stroke={9} tone={total && done === total ? 'signal' : 'accent'}>
          <ShoppingCart size={22} strokeWidth={ICON_STROKE} aria-hidden className={total && done === total ? 'text-text-signal' : 'text-text-accent'} />
        </Ring>
        <div>
          <p className="text-label-s text-text-secondary">Dans le panier</p>
          <p className="tnum text-data-l text-text-primary">
            {done}
            <span className="text-title-m text-text-muted"> / {total}</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

function Frequent() {
  const frequent = useApp((s) => s.data.frequent);
  const list = useApp((s) => s.data.lists.find((l) => l.id === s.data.activeListId) ?? s.data.lists[0]);
  const app = useApp.getState();
  const onList = new Set(list?.items.filter((i) => !i.checked).map((i) => normalize(i.name)));
  const items = Object.entries(frequent)
    .filter(([k]) => !onList.has(k))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 24);
  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Articles fréquents" icon={Sparkles} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        {items.length === 0 ? (
          <p className="px-1 text-body-s text-text-secondary">Les articles que tu ajoutes souvent apparaîtront ici.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {items.map(([k, f]) => {
              const R = RAYONS[f.rayon];
              return (
                <li key={k}>
                  <button type="button" onClick={() => app.addItem(f.name)} className="inline-flex h-9 items-center gap-2 rounded-full border border-border-default bg-bg-card/70 pr-3.5 pl-2.5 text-label-s text-text-primary transition-[background-color,border-color,transform] hover:border-border-accent hover:bg-accent-soft active:scale-95">
                    <R.icon size={14} strokeWidth={ICON_STROKE} aria-hidden className="text-text-secondary" />
                    {f.name}
                    <Plus size={13} strokeWidth={2} aria-hidden className="text-text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

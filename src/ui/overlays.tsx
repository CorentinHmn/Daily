/**
 * Halo overlays (Components 68:302) in liquid glass: Dialog on overlay/scrim, ConfirmDialog, Toast stack, Menu.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Button, ICON_STROKE, IconButton } from './atoms';
import { Popover } from './popover';
import { useLiquidGlass } from './glass';
import { motionTokens } from '../theme/motion';

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'm',
  icon: Icon,
  dismissible = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: 's' | 'm' | 'l';
  icon?: LucideIcon;
  /** false = no close button, Escape and the scrim do nothing (first-launch choice). */
  dismissible?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 24, strength: 18, blur: 10 });
  // Read onClose through a ref so the focus effect runs only when the dialog opens.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const p = panel.current;
      // The marked field first (a new item's title). Otherwise the first control, except on a touch screen where
      // focusing a field opens the keyboard: there the dialog itself takes the focus (Paramètres, an existing task).
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const first = p?.querySelector<HTMLElement>('[data-autofocus]') ?? (touch ? p : p?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])'));
      first?.focus({ preventScroll: true });
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-popover]')) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);
  const t = motionTokens();
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="dialog" className="fixed inset-0 z-[1300] flex items-center justify-center p-8 max-md:items-end max-md:p-2 max-md:pb-[calc(env(safe-area-inset-bottom)+8px)]">
          {/* The scrim fades on its own layer: around the dialog, a fade would make its glass clear until opaque. */}
          <motion.div
            aria-hidden
            className="app-scrim absolute inset-0 bg-overlay-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: t.short } }}
            exit={{ opacity: 0, transition: { duration: t.short, ease: t.exit } }}
            onMouseDown={() => onClose()}
          />
          <motion.div
            ref={(el) => {
              panel.current = el;
              glass(el);
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cn(
              'liquid liquid-dialog relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl outline-none focus-visible:shadow-none max-md:max-h-[88dvh]',
              width === 's' && 'max-w-[440px]',
              width === 'm' && 'max-w-[560px]',
              width === 'l' && 'max-w-[760px]',
            )}
            initial={{ y: t.translation, scale: 0.97 }}
            animate={{ y: 0, scale: 1, transition: { duration: t.medium, ease: t.entry } }}
            exit={{ y: t.translation, scale: 0.97, transition: { duration: t.short, ease: t.exit } }}
          >
            <div className="flex items-center gap-3 px-6 pt-5 pb-3">
              {Icon && (
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-text-accent">
                  <Icon size={20} strokeWidth={ICON_STROKE} />
                </span>
              )}
              <h2 className="min-w-0 flex-1 text-title-m text-text-primary">{title}</h2>
              {dismissible && <IconButton icon={X} label="Fermer" variant="ghost" size="s" onClick={onClose} data-close="" />}
            </div>
            {children && <div className="min-h-0 overflow-y-auto px-6 pt-1 pb-5 text-body-m text-text-secondary">{children}</div>}
            {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle px-6 py-4 max-md:px-4 max-md:[&>*]:flex-1">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void };
}

const toastTone: Record<ToastTone, { bar: string; icon: LucideIcon; iconBox: string }> = {
  info: { bar: 'bg-accent-default', icon: Info, iconBox: 'bg-accent-soft text-text-accent' },
  success: { bar: 'bg-signal-default', icon: Check, iconBox: 'bg-signal-soft text-text-signal' },
  warning: { bar: 'bg-warn-default', icon: TriangleAlert, iconBox: 'bg-warn-soft text-text-warn' },
  danger: { bar: 'bg-danger-default', icon: TriangleAlert, iconBox: 'bg-danger-soft text-text-danger' },
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 14, strength: 10, blur: 8 });
  const [hover, setHover] = useState(false);
  const tone = toastTone[toast.tone];
  const Icon = tone.icon;
  // Disappears after 5 s (8 s with an action), paused while hovered.
  useEffect(() => {
    if (hover) return;
    const t = window.setTimeout(() => onDismiss(toast.id), toast.action ? 8000 : 5000);
    return () => window.clearTimeout(t);
  }, [hover, toast.id, toast.action, onDismiss]);
  const m = motionTokens();
  return (
    <motion.div
      layout
      // Slides in and out without a fade (a fading glass turns clear before it is opaque).
      initial={{ y: m.translation * 2, scale: 0.96 }}
      animate={{ y: 0, scale: 1, transition: { duration: m.medium, ease: m.entry } }}
      exit={{ x: '115%', transition: { duration: 0.2, ease: m.exit } }}
      className="pointer-events-auto"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={glass} role="status" className="liquid liquid-strong relative flex items-center gap-3 overflow-hidden rounded-xl py-3 pr-3 pl-4">
        <span aria-hidden className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r-full', tone.bar)} />
        <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full', tone.iconBox)}>
          <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-m text-text-primary">{toast.title}</p>
          {toast.text && <p className="line-clamp-2 text-caption text-text-secondary">{toast.text}</p>}
        </div>
        {toast.action && (
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1.5 text-label-s text-text-accent transition-colors hover:bg-accent-soft"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
        <IconButton icon={X} label="Masquer la notification" size="xs" variant="ghost" onClick={() => onDismiss(toast.id)} />
      </div>
    </motion.div>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed right-8 bottom-8 z-[1400] flex w-[380px] flex-col gap-2.5 max-md:inset-x-3 max-md:mx-auto max-md:max-w-[560px] max-md:bottom-[calc(env(safe-area-inset-bottom)+86px)] max-md:w-auto">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/** Yes / no question before an irreversible action (UX rule: confirm before delete). */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      width="s"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={tone}
            data-autofocus=""
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text}
    </Dialog>
  );
}

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: 'danger';
  disabled?: boolean;
  hint?: string;
}

/** The items of a menu (MenuItem 67:300), keyboard ↑ ↓ Enter; shown by Menu, or inside a glass that grows into it. */
export function MenuList({ items, onClose, autoFocus = true }: { items: MenuItem[]; onClose: () => void; autoFocus?: boolean }) {
  const [active, setActive] = useState(0);
  // More items below the fold: the bottom fades out, so the list reads as scrollable rather than cut.
  const [more, setMore] = useState(false);
  return (
    <ul
      className={cn('min-h-0 overflow-y-auto overscroll-contain p-1.5 outline-none', more && '[mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]')}
      tabIndex={-1}
      ref={(el) => {
        // Focused when it appears, for ↑ ↓ Enter.
        if (autoFocus && el && el !== document.activeElement && !el.contains(document.activeElement)) el.focus();
        if (el) setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
      }}
      onScroll={(e) => {
        const el = e.currentTarget;
        setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive((i) => (i + 1) % items.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive((i) => (i - 1 + items.length) % items.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const it = items[active];
          if (it && !it.disabled) {
            it.onSelect();
            onClose();
          }
        }
      }}
    >
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <li key={it.label} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                it.onSelect();
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body-s transition-colors duration-(--v-duree-courte) disabled:cursor-not-allowed disabled:text-text-disabled',
                i === active && 'bg-bg-card/80',
                it.tone === 'danger' ? 'text-text-danger' : 'text-text-primary',
              )}
            >
              {Icon && <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden className={it.tone === 'danger' ? undefined : 'text-text-secondary'} />}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-caption text-text-muted">{it.hint}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Contextual menu (Menu / MenuItem 67:300) opened from a trigger; keyboard ↑ ↓ Enter Esc. */
export function Menu({ items, anchor, open, onClose, width = 230, align = 'end' }: { items: MenuItem[]; anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; width?: number; align?: 'start' | 'end' }) {
  return (
    // Tall enough for every item (36 px each + padding); the popover still shrinks to the room on screen, then the list
    // scrolls instead of cutting its last items.
    <Popover open={open} anchor={anchor} onClose={onClose} width={width} align={align} role="menu" maxHeight={items.length * 36 + 14}>
      <MenuList items={items} onClose={onClose} />
    </Popover>
  );
}

/** A trigger button + its menu. */
export function MenuButton({ items, children, align = 'end', width }: { items: MenuItem[]; children: (props: { ref: RefObject<HTMLButtonElement | null>; open: boolean; toggle: () => void }) => ReactNode; align?: 'start' | 'end'; width?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      {children({ ref, open, toggle: () => setOpen((o) => !o) })}
      <Menu items={items} anchor={ref} open={open} onClose={() => setOpen(false)} align={align} width={width} />
    </>
  );
}

/**
 * PageHeader (Shell 71:294): the page title (the menu's name; on Aujourd'hui, a greeting with the user's name) over a
 * short line on what the page holds, as on the glass dashboard; the page's actions on the right.
 * Computer: the person filter and the user chip live in the top bar (TopBar.tsx).
 * Phone: the large title and the avatar on one line, the person filter and the actions under it; once the page
 * scrolls past the title, a compact glass bar keeps the title at the top (iOS large-title behaviour).
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { SHARED_VIEWS, useApp } from '../../store/app';
import { useLiquidGlass } from '../../ui/glass';
import { useIsMobile } from '../../ui/useMedia';
import { motionTokens } from '../../theme/motion';
import { PersonSwitcher } from '../../ui/people';
import { usePageScroll } from './scroll';
import { UserChip } from './UserChip';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  const mobile = useIsMobile();
  const people = useApp((s) => s.data.members.length > 1 && !SHARED_VIEWS.includes(s.view));
  if (mobile) {
    return (
      <>
        <header className="flex shrink-0 flex-col gap-3 pb-4">
          <div className="flex min-h-14 items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-heading-page text-text-primary [text-shadow:var(--title-shadow)]">{title}</h1>
              {subtitle && <p className="line-clamp-2 text-body-s text-text-secondary [text-shadow:var(--title-shadow)]">{subtitle}</p>}
            </div>
            <UserChip compact />
          </div>
          {(children || people) && (
            <div className="flex flex-wrap items-center gap-2">
              {people && <PersonSwitcher />}
              {children}
            </div>
          )}
        </header>
        <CompactBar title={title} />
      </>
    );
  }
  return (
    <header className="flex min-h-[76px] shrink-0 items-center gap-4 pb-3 pl-1">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-heading-page text-text-primary [text-shadow:var(--title-shadow)]">{title}</h1>
        {subtitle && <p className="truncate text-body-s text-text-secondary [text-shadow:var(--title-shadow)]">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </header>
  );
}

/** Title bar shown once the large title has scrolled away (portalled: a transformed parent would trap `fixed`). */
function CompactBar({ title }: { title: string }) {
  const { scrolled } = usePageScroll();
  const glass = useLiquidGlass<HTMLDivElement>({ bezel: 16, strength: 10 });
  const t = motionTokens();
  return createPortal(
    <AnimatePresence>
      {scrolled && (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: t.short * 1.5, ease: t.entry } }}
          exit={{ y: -12, opacity: 0, transition: { duration: t.short, ease: t.exit } }}
          className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto max-w-[744px] px-3 pt-[calc(env(safe-area-inset-top)+6px)]"
        >
          <div ref={glass} className="liquid liquid-bar pointer-events-auto flex h-11 items-center justify-center rounded-full px-5">
            <span className="truncate text-title-s text-text-primary">{title}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The frame of a screen in the shell (computer and phone), inside AnimatePresence: the new screen slides up a little as
 * its pieces fade in, the old one slides up and fades out. The fades are CSS animations on each glass surface and text
 * of the frame (app.css, « glass-in » / « glass-out »), never on the frame itself: a frame with opacity < 1 would be a
 * backdrop root, its glass clear until the end.
 */
import type { ReactNode } from 'react';
import { motion, useIsPresent } from 'motion/react';
import { motionTokens } from '../../theme/motion';

export function ScreenFrame({ children, className }: { children: ReactNode; className?: string }) {
  const present = useIsPresent();
  const t = motionTokens();
  return (
    <motion.div
      data-screen=""
      data-leaving={present ? undefined : ''}
      className={className}
      initial={{ y: 10 }}
      animate={{ y: 0, transition: { duration: t.medium * 1.25, ease: t.entry } }}
      // As long as the pieces' fade-out (glass-out, 140 ms).
      exit={{ y: -6, transition: { duration: t.short, ease: t.exit } }}
    >
      {children}
    </motion.div>
  );
}

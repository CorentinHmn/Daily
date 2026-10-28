/**
 * Motion presets (Halo Guide « motion-presets.ts »), fed by the motion tokens of tokens.css.
 * Reduced motion is handled in CSS (tokens shrink) and here through `useReducedMotion` in components.
 */
import type { Transition, Variants } from 'motion/react';
import { cssBezier, cssMs, cssPx, cssVar } from './tokens';

export function motionTokens() {
  return {
    short: cssMs('--v-duree-courte') / 1000,
    medium: cssMs('--v-duree-moyenne') / 1000,
    count: cssMs('--v-duree-compteur'),
    translation: cssPx('--v-translation'),
    blur: cssPx('--v-flou-entree'),
    staggerWord: cssMs('--v-decalage-mot') / 1000,
    staggerCard: cssMs('--v-decalage-carte') / 1000,
    delayScale: parseFloat(cssVar('--v-echelle-retard')),
    bounce: parseFloat(cssVar('--v-rebond')),
    entry: cssBezier('--v-courbe-entree'),
    exit: cssBezier('--v-courbe-sortie'),
    move: cssBezier('--v-courbe-deplacement'),
    expo: cssBezier('--v-courbe-expo'),
  };
}

/** Cards / panels: y 18 → 0, opacity 0 → 1, blur 10 → 0, 320 ms easing/entry, stagger/card. */
export function revealVariants(): Variants {
  const t = motionTokens();
  return {
    hidden: { opacity: 0, y: t.translation, filter: `blur(${t.blur}px)` },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: t.medium, ease: t.entry, delay: i * t.staggerCard * t.delayScale },
      // A leftover `filter` makes the wrapper a backdrop root: the glass inside would stop seeing the page behind.
      transitionEnd: { filter: 'none' },
    }),
    exit: { opacity: 0, transition: { duration: t.short, ease: t.exit } },
  };
}

/** Shell + rail: fade + x −12 → 0. */
export function shellVariants(): Variants {
  const t = motionTokens();
  return {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { duration: t.medium, ease: t.entry } },
  };
}

/** Word-by-word blur-in (stagger/word). */
export function wordVariants(): Variants {
  const t = motionTokens();
  return {
    hidden: { opacity: 0, y: 6, filter: `blur(${t.blur}px)` },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: t.medium, ease: t.entry, delay: i * t.staggerWord * t.delayScale },
    }),
  };
}

export function springGesture(): Transition {
  return { type: 'spring', bounce: motionTokens().bounce };
}

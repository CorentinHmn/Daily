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

/**
 * Cards / panels: y 18 → 0, easing/entry, stagger/card. No fade nor blur here: a wrapper with opacity < 1 or a filter
 * is a backdrop root, the glass inside stops seeing the page behind (it showed clear, then frosted once opaque). The
 * fade is on the card's pieces (app.css), delayed by --ri as the slide.
 */
export function revealVariants(): Variants {
  const t = motionTokens();
  return {
    // --ri: the card's place, which delays the fade of its pieces (app.css) as much as its slide.
    hidden: (i: number = 0) => ({ y: t.translation, '--ri': i * t.delayScale }),
    show: (i: number = 0) => ({
      y: 0,
      '--ri': i * t.delayScale,
      transition: { duration: t.medium * 1.3, ease: t.entry, delay: i * t.staggerCard * t.delayScale },
    }),
    exit: { y: 0, transition: { duration: 0 } },
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

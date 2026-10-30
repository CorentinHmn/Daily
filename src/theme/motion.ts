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
 * Cards / panels, one after the other: only `--ri`, the card's place, which delays the fade of its pieces (app.css,
 * « glass-in », stagger/card). The fade and the slide of the screen are CSS animations, played by the compositor: a
 * slide driven from here (Motion's `y`, on the main thread) stuttered while the new screen was being rendered. No fade
 * nor filter on the card itself either: a wrapper with opacity < 1 or a filter is a backdrop root, the glass inside
 * stops seeing the page behind (it showed clear, then frosted once opaque).
 */
export function revealVariants(): Variants {
  const scale = parseFloat(cssVar('--v-echelle-retard'));
  return {
    hidden: (i: number = 0) => ({ '--ri': i * scale }),
    show: (i: number = 0) => ({ '--ri': i * scale, transition: { duration: 0 } }),
  };
}

/**
 * Ref for an element rendered with `data-entering=""`: its CSS entrance and its pieces' (app.css) are held at their
 * start until it has been painted once, then released. Its first frame (style, layout, paint of a whole screen or view)
 * is a long one, and animations started before it would show already halfway, in a jump. React sets the attribute at
 * insertion only (the same value on every render), so it never comes back once removed here.
 */
export function releaseEntrance(el: HTMLElement | null) {
  if (el) requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute('data-entering')));
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

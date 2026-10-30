/**
 * Each person's look, kept on their member (it follows them on all their devices), applied as CSS variables on <html>:
 * - the photo behind the glass (.photo-backdrop, app.css), under the theme's veil, among ten themes (Paramètres › Fond
 *   d'écran). Free photos from Unsplash, toned down for the glass (public/backdrop/: wide 2048, mid 1280, tall 900 for
 *   portrait screens, thumb 320 × 200);
 * - how clear the glass is (Paramètres › Transparence du verre), within bounds: never opaque, never bare.
 */
import type { BackdropId } from '../domain/types';

export const BACKDROPS: readonly { id: BackdropId; label: string; color: string; position: string }[] = [
  { id: 'dusk', label: 'Crépuscule', color: '#817d77', position: '50% 62%' },
  { id: 'mountain', label: 'Montagne', color: '#69696b', position: '50% 40%' },
  { id: 'ocean', label: 'Océan', color: '#4c6b7d', position: '50% 50%' },
  { id: 'forest', label: 'Forêt', color: '#565751', position: '50% 50%' },
  { id: 'city', label: 'Ville', color: '#686662', position: '50% 45%' },
  { id: 'desert', label: 'Désert', color: '#4b322d', position: '50% 60%' },
  { id: 'aurora', label: 'Aurore boréale', color: '#254f4b', position: '50% 50%' },
  { id: 'lake', label: 'Lac', color: '#7d848b', position: '50% 55%' },
  { id: 'stars', label: 'Étoiles', color: '#504037', position: '50% 45%' },
  { id: 'fields', label: 'Campagne', color: '#7c6642', position: '50% 60%' },
];

/** The last photo shown on this device: the sign-in screens and the first frame use it. */
const KEY = 'cadence.backdrop';

export function savedBackdrop(): BackdropId | undefined {
  try {
    const id = localStorage.getItem(KEY);
    return BACKDROPS.some((b) => b.id === id) ? (id as BackdropId) : undefined;
  } catch {
    return undefined;
  }
}

/** Shows a photo (unknown or none: the default) and keeps it as this device's last one. */
export function applyBackdrop(id: BackdropId | undefined) {
  const b = BACKDROPS.find((x) => x.id === id) ?? BACKDROPS[0]!;
  const root = document.documentElement.style;
  for (const size of ['wide', 'mid', 'tall'] as const) root.setProperty(`--backdrop-${size}`, `url('/backdrop/${b.id}-${size}.webp')`);
  root.setProperty('--backdrop-position', b.position);
  root.setProperty('--backdrop-base', b.color);
  try {
    localStorage.setItem(KEY, b.id);
  } catch {
    // Private window: the default next time.
  }
}

/**
 * The glass setting: 0 = densest, 50 = as designed, 100 = clearest. It scales the tints' opacity (tokens.css):
 * ×1.8 at 0 (the night panels from 33 % to 59 %, the bars capped at 95 %), ×0.55 at 100 (33 % → 18 %: the frost
 * still carries the text). Text-heavy surfaces (dialogs, menus) take half of the change.
 */
export const GLASS_DEFAULT = 50;
const GLASS_KEY = 'cadence.glass';

export function glassFactor(level: number): number {
  const v = Math.max(0, Math.min(100, level));
  return v <= 50 ? 1 + ((50 - v) / 50) * 0.8 : 1 - ((v - 50) / 50) * 0.45;
}

export function savedGlass(): number | undefined {
  try {
    const v = Number(localStorage.getItem(GLASS_KEY));
    return localStorage.getItem(GLASS_KEY) !== null && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Sets the glass's density (none: as designed) and keeps it as this device's last one. */
export function applyGlass(level: number | undefined) {
  const k = glassFactor(level ?? GLASS_DEFAULT);
  const root = document.documentElement.style;
  root.setProperty('--glass-k', k.toFixed(3));
  root.setProperty('--glass-ks', (1 + (k - 1) * 0.5).toFixed(3));
  try {
    localStorage.setItem(GLASS_KEY, String(level ?? GLASS_DEFAULT));
  } catch {
    // Private window: the default next time.
  }
}

export function backdropThumb(id: BackdropId): string {
  return `/backdrop/${id}-thumb.webp`;
}

/** The photo itself. `fixed`: pinned to the screen. */
export function Backdrop({ fixed }: { fixed?: boolean }) {
  return <div aria-hidden className="photo-backdrop" style={fixed ? { position: 'fixed' } : undefined} />;
}

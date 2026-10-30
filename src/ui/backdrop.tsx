/**
 * The photo behind the glass (.photo-backdrop, app.css), under the theme's veil, chosen by each person among ten themes
 * (Paramètres › Fond d'écran, kept on their member: it follows them on all their devices). Free photos from Unsplash,
 * toned down for the glass (public/backdrop/: wide 2048, mid 1280, tall 900 for portrait screens, thumb 320 × 200).
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

export function backdropThumb(id: BackdropId): string {
  return `/backdrop/${id}-thumb.webp`;
}

/** The photo itself. `fixed`: pinned to the screen. */
export function Backdrop({ fixed }: { fixed?: boolean }) {
  return <div aria-hidden className="photo-backdrop" style={fixed ? { position: 'fixed' } : undefined} />;
}

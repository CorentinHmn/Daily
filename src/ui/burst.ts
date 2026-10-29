/**
 * Bursts of light: little streaks and dots that shoot out of an element (a ticked task, a celebration) and fade, with
 * a soft ring. Drawn in a fixed layer in <body>, so a scrolling list never cuts them; played by Web Animations, each
 * piece removed when it ends. Nothing with reduced motion.
 */
import { reducedMotion } from './liquid';

export function burst(from: Element, { color = 'var(--color-signal-default)', count = 10, reach = 18, ring = true }: { color?: string; count?: number; reach?: number; ring?: boolean } = {}): void {
  if (reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, width: '0', height: '0', zIndex: '1400', pointerEvents: 'none' });
  document.body.appendChild(layer);
  const start = Math.min(r.width, r.height) / 2;
  const pieces: Animation[] = [];
  const piece = (css: Partial<CSSStyleDeclaration>, frames: Keyframe[], duration: number) => {
    const el = document.createElement('span');
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', background: color, borderRadius: '9999px', ...css });
    layer.appendChild(el);
    pieces.push(el.animate(frames, { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }));
  };
  if (ring) {
    const s = start * 2;
    piece(
      { width: `${s}px`, height: `${s}px`, background: 'transparent', border: `2px solid ${color}` },
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.55 },
        { transform: 'translate(-50%, -50%) scale(1.9)', opacity: 0 },
      ],
      520,
    );
  }
  for (let i = 0; i < count; i++) {
    // Evenly around, a little shaken; streaks and dots in turn, each its own length and speed.
    const angle = (i / count) * 360 + (Math.random() - 0.5) * 22;
    const far = start + reach * (0.75 + Math.random() * 0.5);
    const streak = i % 2 === 0;
    piece(
      streak ? { width: '7px', height: '2.5px' } : { width: '4px', height: '4px' },
      [
        { transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${start}px) scale(1)`, opacity: 1 },
        { offset: 0.7, opacity: 0.9 },
        { transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${far}px) scale(${streak ? 0.4 : 0.2})`, opacity: 0 },
      ],
      460 + Math.random() * 180,
    );
  }
  void Promise.all(pieces.map((a) => a.finished.catch(() => undefined))).then(() => layer.remove());
}

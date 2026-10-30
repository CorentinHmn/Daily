/** The photo behind the glass (.photo-backdrop, app.css), under the theme's veil. `fixed`: pinned to the screen. */
export function Backdrop({ fixed }: { fixed?: boolean }) {
  return <div aria-hidden className="photo-backdrop" style={fixed ? { position: 'fixed' } : undefined} />;
}

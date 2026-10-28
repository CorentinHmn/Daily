/**
 * Renders build/logo.svg to PNGs (Edge headless) and packs them into build/icon.ico (PNG-compressed ICO entries,
 * supported by Windows since Vista). The .ico is the icon of the desktop / Start menu shortcuts.
 * Also the phone icons (public/): iOS fills transparency with black, so the disc sits on an opaque square of light
 * aurora (apple-touch-icon 180, manifest 192 / 512).
 * Run: npx tsx scripts/make-icon.ts
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('build/logo.svg', 'utf8');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const pngs: Buffer[] = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`);
  pngs.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
for (const [size, file] of [
  [180, 'public/apple-touch-icon.png'],
  [192, 'public/icon-192.png'],
  [512, 'public/icon-512.png'],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  const disc = Math.round(size * 0.7);
  await page.setContent(
    `<html><body style="margin:0"><div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:radial-gradient(70% 60% at 20% 10%, #c9defb, transparent 70%),radial-gradient(60% 60% at 90% 90%, #b7d6ff, transparent 70%),#eef1f5">${svg.replace('<svg ', `<svg style="display:block;width:${disc}px;height:${disc}px;filter:drop-shadow(0 ${size / 40}px ${size / 16}px rgb(41 112 214 / 0.35))" `)}</div></body></html>`,
  );
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
const entries: Buffer[] = [];
let offset = 6 + 16 * sizes.length;
sizes.forEach((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0);
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(pngs[i]!.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i]!.length;
  entries.push(e);
});
writeFileSync('build/icon.ico', Buffer.concat([header, ...entries, ...pngs]));
writeFileSync('build/icon-256.png', pngs[pngs.length - 1]!);
console.log(`build/icon.ico (${sizes.join(', ')} px)`);

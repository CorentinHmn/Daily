// Inlines the favicon in the single-file build (Vite leaves it as a separate file) and reports the size.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
const icon = `data:image/svg+xml;base64,${readFileSync('build/logo.svg').toString('base64')}`;
const html = readFileSync('dist/index.html', 'utf8').replace(/(<link rel="icon" type="image\/svg\+xml" href=")[^"]+(")/, `$1${icon}$2`);
if (!html.includes(icon)) throw new Error('Favicon not inlined');
writeFileSync('dist/index.html', html);
console.log(`\n✔ dist/index.html (${Math.round(statSync('dist/index.html').size / 1024)} KB)`);

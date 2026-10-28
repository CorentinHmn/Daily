/**
 * Publishes the web build on Vercel without a remote build (Build Output API v3: .vercel/output/static + config.json),
 * so Vercel never has to install Electron & co. Long cache for hashed assets, none for the service worker.
 * Run: npm run deploy  (= build:web + this script). Needs `npx vercel login` once and the folder linked (.vercel/).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

rmSync('.vercel/output', { recursive: true, force: true });
mkdirSync('.vercel/output/static', { recursive: true });
cpSync('dist-web', '.vercel/output/static', { recursive: true });
writeFileSync(
  '.vercel/output/config.json',
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(sw\\.js|registerSW\\.js|manifest\\.webmanifest|index\\.html)', headers: { 'cache-control': 'public, max-age=0, must-revalidate' }, continue: true },
        { src: '/assets/(.*)', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
const out = execFileSync('npx', ['vercel', 'deploy', '--prebuilt', '--prod', '--yes'], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'inherit'] });
console.log(out.trim());

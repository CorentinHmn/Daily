# Cadence

La semaine type, le sport, les objectifs et les courses au même endroit, à deux.

- Appli web React + Vite + TypeScript (design system Halo, verre liquide), installable sur l'écran d'accueil de
  l'iPhone (PWA, marche hors ligne).
- Comptes et données partagées en direct : Supabase (Auth, Postgres avec RLS, Realtime, fonction Edge `signup`).
- Hébergement : Vercel, déployé à chaque push sur `main`.

```bash
npm install
npm run dev          # http://localhost:5320
npm run build        # dist/
npx vitest run       # tests unitaires
```

Mise en ligne, partage du foyer et sécurité : [`docs/mise-en-ligne.md`](docs/mise-en-ligne.md). Historique :
[`PROGRESS.md`](PROGRESS.md).

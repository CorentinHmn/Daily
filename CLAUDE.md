# Cadence

App de bureau (Electron) pour standardiser sa semaine : agenda alimenté par une semaine type, salle de sport (programmes, séance en direct, historique), running, objectifs et habitudes, listes de courses. Design system imposé : **Halo** en mode **clair** (voir `docs/design-system.md`). Interface en français.

## Reprendre
1. Lire `PROGRESS.md` (état, reste à faire).
2. Preview : config `cadence-dev` (port 5320) dans `.claude/launch.json` (aussi dans `E:\Claude\.claude\launch.json`).
3. Vérifier : `npx tsc -b --noEmit`, `npx eslint .`, `npm run build && npx tsx scripts/smoke.ts` (liens entre écrans), `npx tsx scripts/shoot.ts [url] [night]` (captures dans `docs/review/`).
4. App installée : `Mettre à jour l'application.cmd` (build + réinstallation, les données restent dans le profil Electron).
5. En ligne : Supabase `dyqqvtpdttwzwkxtpzfp` (`.env`), Vercel projet « cadence » → `Mettre en ligne.cmd` ; mode d'emploi et sécurité dans `docs/mise-en-ligne.md`. Tests : `npx vitest run`.

## Structure
- `src/domain/` : types, catalogue (catégories, rayons, icônes, devinettes), statistiques, données d'exemple.
- `src/store/app.ts` : zustand ; données sauvegardées dans `localStorage` (`cadence.data.v1`) ; liens séance → agenda, sortie → agenda, liste terminée → agenda ; semaine type → semaines à venir.
- `src/ui/` : composants Halo ; `glass.tsx` = liquid glass (réfraction SVG en `backdrop-filter: url()`).
- `src/screens/` : today, week, sport (GymView, SessionView, RunView), goals, shopping, dialogs, shell.
- `electron/` : fenêtre sans cadre transparente, pastilles du rail = fermer / réduire / agrandir, fond d'écran Windows flouté sous le cadre.

## Pièges connus
- Classes `.liquid*` dans `@layer components` : hors couche, elles écrasaient `absolute` des utilitaires.
- Les popovers doivent passer au-dessus des dialogues (`z-[1350]` > `z-[1300]`).
- Un ancêtre avec `opacity < 1` ou `filter` coupe le verre de ses descendants (backdrop root) : ne pas mettre de flou d'entrée sur un conteneur de verre.
- Electron ne gère pas `window.prompt` : saisie en ligne.
- Mobile (< 768 px, `useIsMobile`, CSS `max-md:`) : toute la page défile dans `MobileShell` ; un `fixed` dans un écran est piégé par le parent animé (transform) → le porter dans `<body>` (barre compacte, minuteur). Aperçu iPhone : config `cadence-lan` (port 5330) ou `Aperçu iPhone.cmd`. Plan mobile / Supabase : `C:\Users\coren\.claude\plans\linked-plotting-cocoa.md`.
- Tout élément `fixed inset-0` dans `<body>` (voile de dialogue…) peint les coins carrés de la fenêtre transparente : le limiter à l'écran (`.app-scrim`). Vérifier avec `scripts/desktop-corners.ts` (lit l'écran réel, sans souris).
- Fenêtre sans cadre : zones `app-drag` seulement sur des éléments vides ; tester avec `scripts/desktop-realclick.ts` (vrais clics Windows), PC libre uniquement.

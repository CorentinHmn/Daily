# Cadence

Appli web (Vercel + Supabase) pour standardiser sa semaine, à deux : agenda alimenté par une semaine type, salle de
sport (programmes, séance en direct, historique), running, objectifs et habitudes, listes de courses. Connexion
obligatoire (e-mail + mot de passe), puis un foyer partagé (créé, ou rejoint avec son code d'invitation). Design system
imposé : **Halo** en mode **clair** (voir `docs/design-system.md`). Interface en français.

Branche `main` = l'appli en ligne. Branche `original` = l'ancienne version de bureau (Electron), gardée pour référence.

## Reprendre
1. Lire `PROGRESS.md` (état, reste à faire).
2. `npm install`, puis `npm run dev` (port 5320, config `cadence-dev` dans `.claude/launch.json`). L'appli parle au
   vrai Supabase (URL et clé publique par défaut dans `src/sync/client.ts`).
3. Vérifier : `npx tsc -b --noEmit`, `npx eslint .`, `npx vitest run`, puis de bout en bout :
   `npm run build && npx vite preview --port 4320` et `npx tsx scripts/e2e.ts` (3 comptes de test, 13 étapes ;
   supprimer ensuite les comptes `cadence-e2e-%@example.com`, requête affichée à la fin).
4. Mise en ligne : chaque push sur `main` est déployé par Vercel (projet relié au repo GitHub, réglages dans
   `vercel.json`, aucune variable à saisir). Mode d'emploi et sécurité : `docs/mise-en-ligne.md`.

## Structure
- `src/domain/` : types, catalogue (catégories, rayons, icônes, devinettes), statistiques, données d'exemple, personnes.
- `src/store/app.ts` : zustand ; copie locale dans `localStorage` (`cadence.data.v1`) pour ouvrir vite et marcher hors
  ligne ; liens séance → agenda, sortie → agenda, liste terminée → agenda ; semaine type → semaines à venir.
- `src/sync/` : `client.ts` (Supabase), `records.ts` (données ⇄ lignes `records`, testé), `sync.ts` (compte, foyer,
  file d'envoi hors ligne, Realtime, lien d'invitation `?invite=CODE`).
- `src/screens/auth/AuthScreens.tsx` : connexion, création de compte, mot de passe oublié, création / accès au foyer.
- `src/ui/` : composants Halo ; `glass.tsx` = liquid glass (réfraction SVG en `backdrop-filter: url()`, Chromium).
- `src/screens/` : today, week, sport (GymView, SessionView, RunView), goals, shopping, dialogs, shell.
- `supabase/` : migrations (schéma appliqué au projet `dyqqvtpdttwzwkxtpzfp`) et fonction Edge `signup`.

## Supabase (projet `dyqqvtpdttwzwkxtpzfp`, outils MCP Supabase)
- Tables `households`, `household_members`, `records` (un objet de l'appli par ligne, jsonb, suppression = `deleted`),
  RLS réservée aux membres du foyer ; RPC `create_household`, `join_household`, `claim_member` ; Realtime sur `records`.
- Fonction Edge `signup` (verify_jwt = false) : crée le compte déjà confirmé (pas d'e-mail de confirmation à attendre).
  Après modification de `supabase/functions/signup/index.ts`, la redéployer (MCP `deploy_edge_function`).

## Pièges connus
- Classes `.liquid*` dans `@layer components` : hors couche, elles écrasaient `absolute` des utilitaires. `.aurora` est
  hors couche : pour la fixer, `style={{ position: 'fixed' }}` (une classe `fixed` perd).
- Les popovers doivent passer au-dessus des dialogues (`z-[1350]` > `z-[1300]`). Échap ne ferme pas un dialogue tant
  qu'un popover est encore dans la page (y compris pendant ses 140 ms de sortie).
- Un ancêtre avec `opacity < 1` ou `filter` coupe le verre de ses descendants (backdrop root) : ne pas mettre de flou
  d'entrée sur un conteneur de verre.
- Mobile (< 768 px, `useIsMobile`, CSS `max-md:`) : toute la page défile dans `MobileShell` ; un `fixed` dans un écran
  est piégé par le parent animé (transform) → le porter dans `<body>` (barre compacte, minuteur).
- La semaine type ne remplit une nouvelle semaine qu'après un premier rattrapage réussi (`caughtUp`) : sinon un
  appareil revenu hors ligne pouvait recréer (et décocher) des tâches déjà cochées par l'autre.
- Toute donnée remplacée depuis le serveur passe par `replaceData()` (sync.ts), sinon elle repartirait dans la file
  d'envoi.
- Flux d'auth « implicit » (pas PKCE) : le lien de réinitialisation s'ouvre souvent dans Safari et non dans l'appli
  installée sur l'écran d'accueil ; PKCE exigerait le même navigateur.

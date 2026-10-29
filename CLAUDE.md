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
   `npm run build && npx vite preview --port 4320` et `npx tsx scripts/e2e.ts` (4 comptes de test, 15 étapes ;
   supprimer ensuite les comptes `cadence-e2e-%@example.com`, requête affichée à la fin). Revue visuelle :
   `npx tsx scripts/shoot.ts [url] [dossier] [tailles]` (captures de chaque écran, vue et fenêtre sur 8 tailles,
   clair / sombre, + rapport : débordements, textes coupés, petites cibles tactiles, erreurs console).
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
  Réglages du foyer (icônes des onglets…) : une ligne `prefs` / `foyer` (`AppData.prefs`) ; un nouveau type de ligne
  demande d'élargir la contrainte `records_collection_check` (migration `reglages_du_foyer`).
- Fonction Edge `signup` (verify_jwt = false) : crée le compte déjà confirmé (pas d'e-mail de confirmation à attendre).
  Après modification de `supabase/functions/signup/index.ts`, la redéployer (MCP `deploy_edge_function`).

## Pièges connus
- Classes `.liquid*` dans `@layer components` : hors couche, elles écrasaient `absolute` des utilitaires. `.aurora` est
  hors couche : pour la fixer, `style={{ position: 'fixed' }}` (une classe `fixed` perd).
- Les popovers doivent passer au-dessus des dialogues (`z-[1350]` > `z-[1300]`). Échap ne ferme pas un dialogue tant
  qu'un popover est encore dans la page (y compris pendant ses 140 ms de sortie).
- Un ancêtre avec `opacity < 1` ou `filter` coupe le verre de ses descendants (backdrop root) : ne pas mettre de flou
  d'entrée sur un conteneur de verre.
- Mise en page téléphone **sous 1200 px** (`--breakpoint-md: 75rem` dans tokens.css, `MOBILE_QUERY` dans
  useMedia.ts, et les deux `@media` d'app.css : les trois ensemble) : téléphones, tablettes portrait et paysage. La
  mise en page bureau (rail, 3 colonnes, semaine sur 7 colonnes) a besoin d'environ 1200 px ; sur tablette la colonne
  reste à 720 px, centrée.
- Grilles bureau : la colonne principale (fluide) a un vrai minimum (`minmax(300px,1fr)`…), les colonnes de côté
  `minmax(0,Npx)` cèdent d'abord. Avec `minmax(0,1fr)` la colonne principale tombait à 0 (les côtés prennent leur
  maximum avant que le `fr` se partage le reste).
- Mobile (`useIsMobile`, CSS `max-md:`) : toute la page défile dans `MobileShell` ; un `fixed` dans un écran
  est piégé par le parent animé (transform) → le porter dans `<body>` (barre compacte, minuteur).
- La semaine type ne remplit une nouvelle semaine qu'après un premier rattrapage réussi (`caughtUp`) : sinon un
  appareil revenu hors ligne pouvait recréer (et décocher) des tâches déjà cochées par l'autre.
- Toute donnée remplacée depuis le serveur passe par `replaceData()` (sync.ts), sinon elle repartirait dans la file
  d'envoi.
- Dialogues : seul un champ marqué `data-autofocus` (titre d'un nouvel élément) prend le focus ; sur écran tactile,
  sinon c'est le dialogue (pas de clavier qui surgit pour lire les Paramètres ou ouvrir une tâche existante).
- Bouton `ghost` + couleur : le gris du variant passe après dans la feuille de style, d'où `text-text-danger!`.
- Les popovers (menus, listes) sont dans `<body>` mais React fait remonter leurs clics aux ancêtres du bouton qui les
  ouvre : `popover.tsx` arrête la propagation (sinon « Supprimer » dans le menu d'une tâche ouvrait aussi la tâche).
- Bulles (barre du téléphone, rail du bureau, SegmentedControl, filtre des personnes, interrupteur) : Web Animations sur des images-clés de ressort
  (`src/ui/liquid.ts`), pas de `layout` / `layoutId` Motion (ils mesuraient la barre à chaque rendu et se figeaient
  pendant le rendu du nouvel écran) ; `useLiquidBubble` + `useDeferredPick` : le changement part deux images après le clic.
  Le verre de ces barres est un calque derrière la bulle (`shell`), pas le conteneur : son liseré ne barre plus le bleu,
  et `follow()` l'étire quand le rebond du ressort porterait la bulle hors du verre (première / dernière entrée).
- Rail du bureau : ouvert (icônes + noms, `--layout-rail-open`) ou replié (`--layout-rail`), choix gardé sur
  l'appareil (`cadence.rail`, ouvert d'office à partir de 1440 px). Sa largeur suit le ressort des bulles (moitié du
  rebond) et la page suit ; la bulle est une pilule (`inset-x-6`) qui suit la largeur des lignes. Son verre est un
  calque aussi large que le rail ouvert, découpé par un clip-path `path()` animé ; ombre (copie floutée, découpée hors
  du contour) et liseré (anneau entre le contour et le contour décalé) sont aussi des clip-paths, avec les mêmes
  images-clés échantillonnées à 60 i/s : rien ne peut se décaler (un `d` SVG animé à part laissait voir une tache
  noire). Pendant le mouvement, la réfraction SVG laisse place au même givre en CSS (`paused` de `useLiquidGlass`).
  Replié, la vague sort avec le nom à chaque changement d'onglet (et au survol de l'onglet actif) ; ouvert, pas de
  vague. La vague ne peut pas vivre dans le `<nav>` : un `backdrop-filter` ancêtre la couperait.
- Pastille du profil (`src/ui/chipMenu.tsx`) : même technique que le rail (calque de verre plus grand que la pastille,
  clip-path animé pastille → pastille + menu, ombre et liseré sur le même tracé, réfraction gardée sur la pastille par
  l'option `lens` de `useLiquidGlass`) ; la liste est toujours montée (mesurée, `inert` fermée) et découpée par le même
  contour ; il descend d'abord à la largeur de la pastille puis s'élargit (sinon un angle vif au raccord), les entrées
  n'apparaissent qu'une fois le verre presque ouvert et partent les premières. Les autres panneaux (`popover.tsx`)
  naissent de leur bouton par une mise à l'échelle sur le même ressort, sans réfraction SVG (refiltrer le fond à
  chaque image saccadait le calendrier).
- Éclats (`src/ui/burst.ts`, case d'une tâche, félicitations) : calque fixe dans `<body>`. Félicitations
  (`Celebrations.tsx`) : journée bouclée, objectif atteint, seulement après le rattrapage du foyer.
- Pas d'attribut `title` (infobulles du navigateur) : `aria-label` pour les lecteurs d'écran.
- Heure et date : `TimeField` / `DateField` (`src/ui/pickers.tsx`), jamais `<input type="time|date">` (sélecteurs gris
  du navigateur).
- Habitudes : une, plusieurs (`owners`, `owner` = NOUS) ou toutes les personnes, comme les objectifs, mais chacun coche
  la sienne : une habitude d'une seule personne garde ses dates dans `checks`, à plusieurs dans `checksBy` (personne →
  dates) ; toujours passer par `habitChecks` / `withHabitCheck` / `withHabitPeople` / `habitEntries` (people.ts). Une
  coche locale non envoyée et celle de l'autre arrivée entre-temps sont fusionnées (`mergeHabit`, base gardée dans la
  file d'envoi), pas écrasées.
- Sorties running : une personne ou plusieurs qui ont couru ensemble (`owners`, `owner` = NOUS), une seule ligne qui
  compte pour chacune (filtre `goalFor`, distances, objectifs « km » / « sorties » de chacun ; une fois pour le foyer).
- Photo de profil : `Member.photo`, JPEG carré de 160 px en data URL (quelques Ko), synchronisé avec la personne.
- Flux d'auth « implicit » (pas PKCE) : le lien de réinitialisation s'ouvre souvent dans Safari et non dans l'appli
  installée sur l'écran d'accueil ; PKCE exigerait le même navigateur.

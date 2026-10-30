# Cadence

Appli web (Vercel + Supabase) pour standardiser sa semaine, à deux : agenda alimenté par une semaine type, salle de
sport (programmes, séance en direct, historique), running, objectifs et habitudes, listes de courses. Connexion
obligatoire (e-mail + mot de passe), puis un foyer partagé (créé, ou rejoint avec son code d'invitation). Design system
**Halo**, habillé en « Glassy Dashboard » depuis le 30/10/2026 : verre fumé sur une photo de crépuscule, texte blanc,
barre du haut à pastilles, rail fin centré (thème sombre par défaut, clair en option ; voir `docs/design-system.md`).
Interface en français.

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
- `docs/style-guide/` : le style de l'appli expliqué pour le réutiliser (GUIDE.md, captures, séquences d'animation).
- `supabase/` : migrations (schéma appliqué au projet `dyqqvtpdttwzwkxtpzfp`) et fonction Edge `signup`.

## Supabase (projet `dyqqvtpdttwzwkxtpzfp`, outils MCP Supabase)
- Tables `households`, `household_members`, `records` (un objet de l'appli par ligne, jsonb, suppression = `deleted`),
  RLS réservée aux membres du foyer ; RPC `create_household`, `join_household`, `claim_member` ; Realtime sur `records`.
  Réglages du foyer (icônes des onglets…) : une ligne `prefs` / `foyer` (`AppData.prefs`) ; un nouveau type de ligne
  demande d'élargir la contrainte `records_collection_check` (migration `reglages_du_foyer`).
- Fonction Edge `signup` (verify_jwt = false) : crée le compte déjà confirmé (pas d'e-mail de confirmation à attendre).
  Après modification de `supabase/functions/signup/index.ts`, la redéployer (MCP `deploy_edge_function`).

## Pièges connus
- Classes `.liquid*` dans `@layer components` : hors couche, elles écrasaient `absolute` des utilitaires. Le fond photo
  (`.photo-backdrop`, composant `Backdrop`) est hors couche : pour le fixer, `<Backdrop fixed />` (une classe `fixed`
  perd). Voile par thème (`--backdrop-veil`).
- Fond d'écran : 10 photos (`BACKDROPS`, src/ui/backdrop.tsx ; `public/backdrop/<id>-wide|mid|tall|thumb.webp`), choix
  de chacun sur sa personne (`Member.backdrop`, synchronisé : le même sur ses appareils), Paramètres › Fond d'écran.
  `applyBackdrop()` pose des variables CSS sur `<html>` et garde le dernier sur l'appareil (`cadence.backdrop`, écrans
  de connexion). Pas de pré-cache (2 Mo) : le service worker garde chaque photo une fois affichée.
- Transparence du verre (Paramètres, curseur 0–100, 50 = d'origine, `Member.glass`) : `applyGlass()` pose `--glass-k`
  (panneaux, barres, verre clair : ×1,8 … ×0,55) et `--glass-ks` (fenêtres, menus : moitié de l'effet) sur `<html>` ;
  les teintes sont `rgb(… / min(0.95, a * var(--glass-k, 1)))` (tokens.css, app.css). Toute nouvelle teinte de verre
  doit suivre ce modèle.
- Un commentaire CSS fermé trop tôt casse toute la feuille sans bruit côté serveur de dev (il sert l'ancienne) :
  après une modif de CSS, vérifier `npm run build` (erreur « Invalid declaration »).
- Service worker : la page (navigation) en réseau d'abord (`NetworkFirst`, copie `pages` pour le hors-ligne), jamais
  pré-cachée : sinon une ouverture montrait l'ancienne version jusqu'au rechargement suivant.
- Avatars : bord = anneau `box-shadow` (`--avatar-edge`), jamais une bordure translucide (cercle flou) ; la pastille du
  profil (`ChipMenu bare`) n'a pas de verre au repos. Badges opaques (`--badge-bg` / `--badge-ink`).
- Icônes : `/icons/cadence-*.png` (index.html, manifeste) ; les anciennes adresses (`/favicon.ico`, `/logo.svg`,
  `/apple-touch-icon.png`) servent aussi le nouveau logo, car favoris et onglets gardent une icône par adresse.
- Thème : `night` = verre fumé (défaut), `day` = clair. Chaque appareil passe une fois en `night` (`cadence.look` =
  `verre` dans `load()`, store/app.ts) ; ensuite le choix du menu est gardé. Toute surface du thème sombre est un voile
  (blanc ou gris translucide), jamais une couleur opaque : un fond opaque passe par `--glass-solid`.
- Bulle de navigation (rail, barre du téléphone, SegmentedControl, filtre des personnes) : `bg-nav-active` +
  `text-text-on-nav` (blanc / encre sombre en verre fumé, bleu / blanc en clair), pas `bg-accent-default`.
- Les popovers doivent passer au-dessus des dialogues (`z-[1350]` > `z-[1300]`). Échap ne ferme pas un dialogue tant
  qu'un popover est encore dans la page (y compris pendant ses 140 ms de sortie).
- Un ancêtre avec `opacity < 1` ou `filter` coupe le verre de ses descendants (backdrop root) : pas de fondu ni de flou
  sur un élément de verre ou un de ses parents (il paraissait clair puis givré une fois opaque). Entrées et changements
  d'écran = glissements (`revealVariants`, écrans, semaine, fenêtres, menus, notifications) ; le voile des fenêtres fond
  sur son propre calque, à côté du panneau. Changement d'écran (`ScreenFrame.tsx`, dans AnimatePresence) : l'ancien
  glisse un peu vers le haut et ses pièces fondent (`[data-leaving]` → `screen-out` + `glass-out`, 140 ms), puis le
  nouveau glisse à sa place et ses pièces fondent en cascade (`screen-in` + `glass-in`, retard `--ri` posé par
  `revealVariants`) : surfaces de verre, titres et boutons d'en-tête dans `<main>`, pièces d'un `.fade-pieces`
  (verre, bulle et boutons d'un SegmentedControl ou du filtre), chacun lui-même, jamais un conteneur. Le filtre des
  personnes de la barre du haut reste en place sur Courses et fond (`hidden`, `.fade-pieces`).
- Transitions d'écran et de vue : **animations CSS de `transform` / `opacity` seulement** (jouées par le compositeur),
  jamais `y` / `x` de Motion (calculés en JavaScript image par image : ils saccadaient pendant le rendu du nouvel
  écran, surtout au téléphone). Si Motion reste, `transform: 'translateY(…)'` (Web Animations, ex. la barre compacte).
  Un écran ou une vue qui arrive porte `data-entering=""` + `ref={releaseEntrance}` (motion.ts) : ses animations
  restent à leur début jusqu'à sa première image peinte (sinon elles apparaissaient déjà à moitié). Au téléphone,
  l'ancien écran part là où il était défilé ; le nouveau remonte en haut en arrivant (`ScreenFrame`).
- `el.getAnimations().forEach(a => a.cancel())` annule aussi les animations CSS (fondu d'entrée de l'écran) : pour ne
  stopper que les mouvements lancés par `el.animate`, `stopMoves(el)` (liquid.ts). La bulle d'un SegmentedControl
  apparaissait blanche avant tout le reste.
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
- Bureau : barre du haut (`TopBar.tsx` : logo, ouvrir / replier le rail, filtre des personnes au centre, +, Paramètres,
  thème, pastille du profil) puis rail + page. Titre de page + sous-titre (`PageHeader`) ; Aujourd'hui salue
  (« Bonjour, Corentin », « Bonsoir » dès 18 h) : les scripts attendent `/^Bon(jour|soir), /`, pas « Aujourd'hui ».
- Rail du bureau : pilule fine centrée verticalement, les 5 onglets seulement ; ouvert (icônes + noms,
  `--layout-rail-open`) ou replié (`--layout-rail`, défaut), état tenu par App (bouton de la barre du haut), gardé sur
  l'appareil (`cadence.rail`). Sa largeur suit le ressort des bulles (moitié du rebond) et la page suit ; la bulle est
  une pilule (`inset-x-2`) qui suit la largeur des lignes ; replié, survoler un autre onglet montre son nom (`.rail-tip`). Son verre est un
  calque aussi large que le rail ouvert, découpé par un clip-path `path()` animé ; ombre (copie floutée, découpée hors
  du contour) et liseré (anneau entre le contour et le contour décalé) sont aussi des clip-paths, avec les mêmes
  images-clés échantillonnées à 60 i/s : rien ne peut se décaler (un `d` SVG animé à part laissait voir une tache
  noire). Pendant le mouvement, la réfraction SVG laisse place au même givre en CSS (`paused` de `useLiquidGlass`).
  Replié, la vague sort avec le nom à chaque changement d'onglet (et au survol de l'onglet actif) ; ouvert, pas de
  vague. La vague ne peut pas vivre dans le `<nav>` : un `backdrop-filter` ancêtre la couperait.
- WebKit (Safari sur Mac, tous les navigateurs de l'iPhone) ne découpe pas un `backdrop-filter` par un `clip-path` :
  un calque de verre découpé montrait toute sa boîte givrée (un « carré discret » autour du menu du profil). Là
  (`webkitBackdrop`, glass.tsx), le givre vient de boîtes arrondies (`.chip-frost` : colonne de la pastille + panneau du
  menu ; la boîte du rail ; deux boîtes autour de l'encoche de la NotchCard), la teinte, le liseré et l'ombre gardent
  le clip-path ; et l'ombre floutée (calque `filter` + clip-path dedans, que WebKit floute comme une boîte : ombre
  carrée) y devient les `box-shadow` de deux boîtes arrondies (colonne + menu, `.chip-shadow`) dans un calque découpé
  à l'extérieur du contour (une seule boîte aux bornes de la forme laissait une traîne rectangulaire à côté de la
  pastille). Chromium ne montre aucun de ces défauts, même avec un user-agent d'iPhone : vérifier dans le **vrai
  WebKit** de Playwright, installé à part : `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx playwright install webkit` puis
  `npx playwright install-deps webkit`, et `webkit.launch()` avec le même `PLAYWRIGHT_BROWSERS_PATH` ; comparer capture
  fermée / ouverte (différence de pixels) plutôt qu'à l'œil.
  Détecter le **moteur**, pas le nom du navigateur : Chrome sur iPad se présente en « Chrome/… » de Mac
  (sites pour ordinateur) mais c'est WebKit (`navigator.vendor` Apple, `-webkit-touch-callout`). Tester ce chemin dans
  Chromium avec un `userAgent` d'iPhone, ou en forçant `navigator.vendor` à « Apple Computer, Inc. ».
- Barre d'état de l'iPhone : `black-translucent`, l'appli dessine dessous (fond photo, `--status-scrim` pour l'heure) ;
  l'ancien bandeau uni flou venait du style `default`. Changer ce réglage peut demander de réinstaller l'appli sur
  l'écran d'accueil.
- Logo : `public/logo/cadence-tile.png` (icône d'appli, `Logo` dans atoms.tsx), `cadence-mark.png` (le C seul,
  transparent), icônes PWA et favicon recomposées depuis la planche de l'utilisateur (C détouré sur tuile claire).
- Pastilles qui deviennent leur menu (`src/ui/chipMenu.tsx`) : profil, et le + de l'ajout rapide (barre du haut ;
  au téléphone, vers le haut : `up`, teinte des barres : `bar`) ; Ctrl K passe par `ref.open()`. Même technique que le rail (calque de verre plus grand que la pastille,
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

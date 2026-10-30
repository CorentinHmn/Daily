# Cadence — avancement

## Session 1 (24–25/10/2026) — V1.0.0 installée
- Figma Halo inventorié (13 pages, 34 cadres, détail dans `docs/design-system.md`). « Atelier » n'a qu'un cadre sombre ; le clair vient de la page transfers (cadres « Clair ») et du mode Day.
- Écrans : Aujourd'hui, Semaine (Agenda | Semaine type, glisser-déposer entre jours), Sport (Salle : programmes éditables, séance en direct avec minuteur de repos ; Running : saisie, allure, courbe 12 semaines), Objectifs (Semaine | Mois | Année ; automatiques, compteurs, étapes ; habitudes de la semaine), Courses (listes, rayons devinés, quantités, articles fréquents, copie de la liste).
- Ajout rapide : bouton + du rail (Ctrl K), nouvelle tâche Ctrl N, menus Alt 1…5.
- Liquid glass réel (réfraction SVG) sur rail, en-tête, menus, dialogues, toasts, minuteur, encoche et cadre de fenêtre ; verre dépoli sur les panneaux, fond Aurora.
- Premier lancement : choix « exemple » (historique fictif de 2 mois, marqué comme tel) ou « partir de ma semaine » ; Paramètres › Repartir de zéro / Recharger l'exemple / Exporter / Importer ; thème sombre en option.
- Vérifié : `tsc`, `eslint`, `scripts/smoke.ts` (12/12 OK), `scripts/desktop-realclick.ts` en vrais clics Windows (9/9 OK : bienvenue, rail, saisie clavier, coche, menu +, déplacement, agrandir/restaurer, fermer, sauvegarde après relance), captures clair et sombre dans `docs/review/`.
- Installé : `%LOCALAPPDATA%\Programs\Cadence\Cadence.exe`, raccourcis **Cadence** sur le Bureau et dans le menu Démarrer. Installateur : `release/Cadence-Setup-1.0.0.exe`.

## Session 2 (25/10/2026) — coins carrés corrigés
- Retour utilisateur : « le carré est buggé » (carré gris autour du coin arrondi de la fenêtre). Cause : le voile des dialogues (`fixed inset-0`, dans `<body>`) couvrait tout le rectangle de la fenêtre transparente, coins compris. Corrigé : `.app-scrim` limité à l'écran (inset = bezel, rayon 34 ; plein écran quand la fenêtre est agrandie).
- Nouveau test `scripts/desktop-corners.ts` : lit l'écran réel aux 4 coins (dialogue ouvert / fermé, perte de focus, réduire, agrandir) et compare à l'arrière-plan une fois la fenêtre fermée → 6/6 OK. Smoke 12/12 OK. Réinstallée.

## Session 3 (25/10/2026) — lot 1 du plan mobile : version iPhone
- Plan validé : `C:\Users\coren\.claude\plans\linked-plotting-cocoa.md` (lot 1 version mobile + aperçu Wi-Fi ; lot 2 gestes / feuilles / mode magasin / séance mobile / transitions / palette Ctrl K ; lot 3 foyer à deux + Supabase + Vercel « quand il dit go »). Choix de l'utilisateur : iPhone tous les deux, tout partagé avec « qui fait quoi », aperçu par le Wi-Fi.
- Fait : `MobileShell` (sous 768 px : grand titre qui se replie en barre compacte, barre d'onglets flottante en verre dont l'onglet actif s'élargit avec son nom, bouton + rond), écrans sur une colonne par `max-md:` (KPI en carrousel, Semaine = bande des 7 jours collante + jours à la verticale, listes de courses en pastilles), dialogues ancrés en bas, notifications et minuteur de repos au-dessus de la barre, actions visibles au doigt (`pointer-coarse:`), champs en 16 px (sinon iOS zoome), zones sûres, manifeste + icônes iPhone (`public/`), verre iPhone (flou plus dense, liseré de lentille) car WebKit n'a pas la réfraction SVG.
- Vérifié : `scripts/smoke.ts` 12/12 (bureau), captures bureau inchangées, `scripts/shoot-mobile.ts` (WebKit Playwright, iPhone 15) sans erreur. ⚠ Le WebKit de Windows annonce `backdrop-filter` mais ne floute pas : les captures mobiles montrent le verre sans flou (pire cas) ; le vrai rendu se juge sur l'iPhone.
- Aperçu : `Aperçu iPhone.cmd` ou config `cadence-lan` (port 5330) → `http://192.168.1.11:5330`, QR code `docs/qr-iphone.png`. Pare-feu : règle entrante Node déjà autorisée (profil Public).

## Session 4 (25/10/2026) — lot 3 : foyer à deux en ligne (V1.1.0)
- Supabase « cadence » (`dyqqvtpdttwzwkxtpzfp`, Paris, gratuit) : `households`, `household_members`, `records` (jsonb par objet, suppression = `deleted`), RLS membres seulement, RPC `create_household` / `join_household` / `claim_member`, Realtime sur `records`. Test RLS à 3 comptes simulés OK (13 vérifications), annulé.
- Foyer local : `members`, `assignee` (tâches, routines : personne ou « Nous deux »), `owner` (habitudes, programmes, séances, sorties, objectifs), filtre « Tous / … » dans l'en-tête, avatars, « Qui ? » dans les dialogues, Paramètres › Foyer ; migration des données existantes (`normalizeData`).
- Synchro (`src/sync/`) : diff par enregistrement → file d'envoi gardée hors ligne → upsert ; Realtime + rattrapage ; jamais d'écrasement d'un changement local non envoyé ; tâches de la semaine type à id déterministe (pas de doublon) ; message « Léa a coché … ». Connexion par code e-mail (Compte et partage).
- Web : `npm run build:web` (sans fichier unique, service worker vite-plugin-pwa) ; `Mettre en ligne.cmd` = build + Vercel en Build Output API (pas de build distant). En ligne : https://cadence-khaki-two.vercel.app (public ; un alias manuel `cadence-foyer.vercel.app` était protégé par Vercel, retiré).
- Vérifié : vitest 7/7 (aller-retour des données, coche = 1 enregistrement, pas de doublons, migration), smoke bureau 16/16, captures foyer bureau + iPhone, parcours iPhone sur le site en ligne sans erreur. App PC 1.1.0 réinstallée.
- **Reste côté utilisateur** : modèles d'e-mail Supabase « Magic Link » et « Confirm signup » avec `{{ .Token }}` (voir `docs/mise-en-ligne.md`), puis créer le foyer depuis le PC. Le test de bout en bout à deux appareils reste à faire avec lui (je ne crée pas de vrais comptes).

## Session 5 (28/10/2026) — V2.0.0 : appli web, GitHub + Vercel + Supabase, connexion dès l'ouverture
- Demande : refaire l'appli à l'identique (ou mieux), code sur GitHub (`CorentinHmn/Daily`), Vercel relié au repo,
  backend Supabase, identifiant dès le début, utilisable à deux sur le site.
- Repris tel quel : tous les écrans, le design Halo, le verre liquide, la version iPhone, le moteur de synchro (file
  d'envoi hors ligne, Realtime, pas d'écrasement d'un changement non envoyé), le schéma Supabase existant.
- Retiré : Electron, build fichier unique, scripts Windows (Edge, `.cmd`), captures de l'ancienne version (toujours sur
  la branche `original`).
- Nouveau :
  - connexion obligatoire : e-mail + mot de passe ; création de compte instantanée par la fonction Edge `signup`
    (compte confirmé d'office : l'envoi d'e-mails gratuit de Supabase est lent et limité) ; mot de passe oublié (lien
    par e-mail → nouveau mot de passe) ; changement de mot de passe dans Foyer et compte ;
  - après connexion : créer le foyer (prénom, nom, « Ma semaine », « Un exemple » ou **« Mes données »** = import d'un
    export de l'app PC) ou le rejoindre avec le code ; un appareil déjà membre récupère le foyer tout seul ;
  - **lien d'invitation** `https://…/?invite=CODE` (bouton « Envoyer le lien » / « Copier le lien ») : la personne
    invitée arrive sur la création de compte, puis sur « Rejoindre » avec le code déjà rempli ;
  - déconnexion (menu du compte) : la copie locale est effacée de l'appareil ;
  - « Repartir de zéro » / « Recharger l'exemple » gardent les personnes du foyer (avant : nouveaux identifiants →
    comptes déliés) ; après un import, ce compte reprend le « moi » du fichier (`claim_member`) ;
  - données saisies dans l'ancienne version du site sur un appareil (locales, jamais en ligne) : mises de côté
    (`cadence.legacy`) au lieu d'être effacées, et proposées (« Cet appareil ») à la création du foyer ;
  - corrections de synchro : la semaine type ne remplit une semaine qu'après rattrapage ; « Léa a coché … » nomme
    aussi une personne arrivée depuis l'ouverture (avant : « Ton foyer a coché … »).
- Vérifié : `tsc`, `eslint`, vitest 8/8, `scripts/e2e.ts` 13/13 contre le vrai Supabase (PC + iPhone, 3 comptes :
  création, invitation par lien, ajout en direct, coche + notification, rechargement, déconnexion / reconnexion,
  reprise des données de l'ancienne version, mauvais mot de passe), puis comptes et foyers de test supprimés.
- Vercel : projet « cadence » relié au repo par l'utilisateur ; premier déploiement GitHub le 28/10 (même adresse
  https://cadence-khaki-two.vercel.app). Captures PC et iPhone conformes à l'original.
- Retours : carte de connexion fixée en haut (elle remontait en passant sur « Créer un compte ») ; « Mot de passe
  oublié » bloqué (Site URL = localhost, puis limite de 2 e-mails/heure) → ancien compte vide supprimé à sa demande,
  il le recrée avec « Créer un compte ».
- Comptes de Corentin et Louise créés côté serveur à sa demande (mots de passe donnés dans la conversation, à changer
  dans Foyer et compte). Foyer « Corentin et Louise » créé par lui.
- Retours : départ **« Vide »** à la création du foyer et **« Tout vider »** dans Paramètres (« Repartir de zéro »
  devient « Semaine de départ ») ; supprimer une tâche depuis son menu ouvrait une fenêtre « Nouvelle tâche » (clic
  du menu remonté à la ligne, bug déjà présent dans l'app PC) → corrigé ; « Aucun objectif pour le moment » au lieu
  de « Tous tes objectifs sont atteints » quand il n'y en a aucun. e2e 15/15.
- Audit visuel (`scripts/shoot.ts`, 8 tailles, clair / sombre, toutes les fenêtres) puis corrections :
  - tablette (768–1200 px) : la colonne des tâches d'Aujourd'hui tombait à 0 de large, la semaine en 7 colonnes était
    illisible, l'avatar sortait de l'écran → mise en page téléphone sous 1200 px (colonne centrée de 720 px) ;
  - grilles bureau : colonne principale avec un minimum (Aujourd'hui, Courses, Objectifs, Salle, Running, séance) ;
    noms d'exercices entiers à 1280 px (colonnes de chiffres resserrées) ; colonnes équilibrées en très grand écran ;
  - séance sur téléphone : « SérieRépétitions » collés → « N° » ; sélecteurs de 44 px ; cases rondes avec une zone
    tactile de 40 px ;
  - « ? » seul en début de ligne (espace insécable) ; boutons des dialogues sur toute la largeur au téléphone ; plus
    de clavier qui surgit en ouvrant Paramètres ou une tâche existante ; « Supprimer » enfin rouge ; « Tout vider » en
    rouge ; « Retirer les cochés » ne déborde plus.
  - Rien à corriger : console sans erreur, aucune page plus large que l'écran, mode sombre propre.
- **Reste côté utilisateur** : régler l'URL du site dans Supabase (pour « Mot de passe oublié »), créer son compte et
  le foyer, inviter Léa (voir `docs/mise-en-ligne.md`).

## Session 6 (29/10/2026) — rail du bureau dépliable
- Demande : le rail était le seul élément plus lent que les autres (vague comprise) ; un rail qui se déplie et se
  replie, ressort adapté, plus de vague puisque le rail ouvert est plus large.
- Fait : rail ouvert (icônes + noms, 208 px, `--layout-rail-open`) ou replié (96 px) par le bouton « Réduire » /
  « Déplier le menu » au-dessus de Paramètres ; choix gardé sur l'appareil (`cadence.rail`), ouvert d'office à partir
  de 1440 px de large. La largeur suit le même ressort que toutes les bulles (567 ms, moitié du rebond) et la page
  suit ; les noms apparaissent comme celui de la barre du téléphone et partent en 90 ms. Bulle bleue = pilule sous
  l'icône et le nom (cercle replié), même ressort que les autres barres. Badge des courses en bout de ligne une fois
  ouvert. Plus de vague : plus d'attente de 1,1 s ni de reflux, plus de clip-path animé à chaque changement d'onglet.
  Pendant l'ouverture, la réfraction SVG laisse place au même givre en CSS (option `paused` de `useLiquidGlass`).
- Vérifié : `tsc`, `eslint`, vitest 13/13, e2e 15/15, captures pc-xl / pc / laptop / laptop-s (clair + sombre) sans
  débordement ni erreur console, images de l'animation figées à 50 / 120 / 200 / 300 / 450 ms. Comptes de test
  supprimés.
- Retour : la vague doit rester quand le rail est replié → remise telle quelle (même forme, même tenue du nom de
  1,1 s, survol de l'onglet actif), reflux en 300 ms comme le menu du profil (380 avant), réfraction SVG en pause
  pendant la vague (le verre refiltré à chaque image la ralentissait). Rail ouvert : pas de vague.

- Habitudes pour une ou plusieurs personnes (« Pour qui ? » à cases multiples, comme les objectifs) ; chacun coche la
  sienne (choix de l'utilisateur) : une ligne par habitude et par personne dans Aujourd'hui et Objectifs (avatar avec
  le filtre « Tous »), séries et compteur par personne. Partager une habitude garde les coches de sa personne ; deux
  coches simultanées (même hors ligne) sont fusionnées. Vérifié : 6 tests unitaires, parcours navigateur à deux
  appareils (l'un hors ligne coche Louise pendant que l'autre décoche Corentin → les deux gardés), e2e 15/15.

- Sorties running : « Qui a couru ? » à cases multiples (formulaire de Running et fenêtre de la sortie) ; une sortie à
  deux compte pour chacun (filtre, distances de la semaine / du mois, objectifs km et sorties), une fois pour le foyer ;
  avatars dans la liste avec le filtre « Tous ». Vérifié : test unitaire, parcours navigateur (1440, 1280, téléphone),
  e2e 15/15.

## Session 7 (30/10/2026) — habillage « Glassy Dashboard »
- Demande : ressembler le plus possible à la vidéo « Glassy Dashboard V5 » (4 captures), en gardant le fonctionnement
  et le verre liquide.
- Fait : fond photo (vallée au crépuscule, Unsplash, 3 tailles WebP de 30 à 70 Ko, en cache hors ligne) à la place de
  l'aurora ; thème sombre = verre fumé gris neutre, texte blanc, et thème par défaut (chaque appareil y passe une fois,
  le clair reste au menu et dans Paramètres) ; barre du haut sur ordinateur (logo, rail, filtre des personnes au
  centre, +, Paramètres, thème, avatar) ; rail = pilule fine centrée avec les 5 onglets, bulle blanche, étiquette au
  survol, toujours dépliable ; titres + sous-titres, « Bonjour / Bonsoir, Corentin » sur Aujourd'hui ; KPI à icône
  teintée, pastille d'évolution et petite courbe (Aujourd'hui : 7 jours ; Salle, Running : 8 semaines) ; barres en verre
  avec la barre du moment en bleu ; bulles blanches partout (segmentés, filtre, barre du téléphone).
- Scripts : `shoot.ts` et `e2e.ts` attendent la salutation au lieu de « Aujourd'hui » ; `shoot.ts` capture le verre fumé
  puis le clair (`light`).
- Vérifié : `tsc`, `eslint`, vitest 20/20, e2e 15/15, `shoot.ts` sur les 8 tailles (aucun débordement, aucune erreur
  console ; sous-titres raccourcis pour le téléphone ; les autres remarques du rapport existaient avant). Comptes de
  test supprimés. Passé par la branche `glassy-dashboard`, puis mis sur `main` à la demande de l'utilisateur.

## Session 7 bis (30/10/2026) — retours sur l'iPhone, nouveau logo
- Le + (barre du haut, et au téléphone à côté de la barre d'onglets) devient son menu comme la pastille du profil
  (vers le haut au téléphone) ; Ctrl K l'ouvre.
- « Carré discret » autour du menu du profil sur l'iPhone : WebKit ne découpe pas le flou d'un calque par son
  clip-path ; le givre y vient maintenant de boîtes arrondies (pastilles et rail).
- Haut de l'écran au téléphone : plus d'ombre floue sous les titres ; l'appli passe sous la barre d'état (plus de
  bandeau flou), avec une ombre douce pour l'heure ; avatar du profil net (anneau fin, point de synchro cerclé).
- Nouveau logo (planche de l'utilisateur) : C détouré, tuile recomposée, icônes de l'écran d'accueil, favicon.
- Champ rempli automatiquement par le navigateur (e-mail enregistré) : plus de rectangle bleu pâle, le champ garde le
  verre et l'encre du thème (`:-webkit-autofill` / `:autofill`, app.css).
- Vérifié : tsc, eslint, vitest 20/20, e2e 15/15, captures pc + téléphone + fenêtres sans erreur console ; comptes de
  test supprimés.
- Retour : le carré givré restait sur l'iPad (Chrome) : Chrome iPad se présente comme un Chrome de Mac, la détection
  par le nom ratait WebKit. Détection par le moteur (vendor Apple / touch callout) ; même correctif pour la carte à
  encoche (séance) ; la réfraction SVG n'est plus tentée sur iPad. Ligne vide sous « Aucun programme » au téléphone
  retirée.
- Retour : en changeant d'écran, le verre passait très transparent puis opaque (fondu d'opacité sur un parent : plus de
  flou le temps du fondu). Plus aucun fondu sur le verre : écrans, cartes, semaine, fenêtres, menus, notifications,
  barre compacte, connexion glissent. Verre un peu plus transparent (panneaux 0,33, téléphone 0,42). Le + ouvert ne
  montre plus son rond : reflet, liseré et teinte couvrent toute la forme ; la croix pivote en × à l'ouverture.

- Retour : ombre carrée autour des menus sur l'iPhone et l'iPad. C'était l'ombre (calque flouté découpé par
  clip-path : WebKit floute toute la boîte), invisible dans Chromium même avec le chemin WebKit forcé. WebKit : ombre
  = box-shadow d'une boîte arrondie qui suit la forme (menus, rail).
- Retour : une traîne rectangulaire restait à côté des pastilles ouvertes (profil, +) sur l'iPhone : l'ombre WebKit
  était une seule boîte aux bornes de la forme. Elle vient maintenant de deux boîtes (colonne + menu) découpées à
  l'extérieur du contour. Reproduit puis vérifié dans le vrai WebKit (Playwright) : avant, zone assombrie uniforme
  au-dessus / à côté ; après, seule l'ombre douce sous le bord du menu.
- Fond d'écran au choix de chacun : 10 photos à thèmes (Paramètres › Fond d'écran), synchronisé sur la personne.
- Icônes : favicon.ico (Vercel et navigateurs le demandent), liens d'icônes versionnés `?v=2` (caches).

- Curseur « Transparence du verre » dans Paramètres (propre à chacun, synchronisé ; bornes ×1,8 dense … ×0,55
  transparent, fenêtres et menus à moitié), vérifié dans Chromium et le vrai WebKit (couleurs calculées 59 % / 33 % /
  18 % pour les panneaux sombres).
- Favori toujours avec l'ancien logo : l'ancienne icône vivait à `/logo.svg`, supprimée (l'adresse renvoyait la page).
  `/logo.svg` sert maintenant le nouveau logo, et les icônes ont de nouvelles adresses (`/icons/`).

- Retours : changement d'onglet de nouveau en fondu (sur chaque carte de verre, sans perdre le flou) ; avatars nets
  (anneau extérieur, plus de verre derrière la photo du profil) ; « Visit » sur Vercel : la page vient toujours du
  réseau (service worker en réseau d'abord) ; vague du rail : au premier / dernier onglet elle rejoint le haut / bas du
  rail au lieu de déborder, arrondis réduits près des coins ; badge des Courses opaque, qui suit la fin du nom sorti.

- Audit des changements d'onglet : l'ancien écran disparaissait d'un coup, les boutons d'en-tête surgissaient, toutes
  les cartes fondaient ensemble, le filtre des personnes disparaissait net sur Courses. Maintenant : fondu de sortie
  (140 ms), entrée en cascade, en-têtes compris, filtre qui fond en place. Mesuré image par image (opacités) ; e2e 15/15.

## Reste à faire / idées
1. Retours de l'utilisateur après usage réel (sa vraie semaine type, ses programmes).
2. Rappels avant une tâche à heure fixe (notifications web push ; sur iPhone, iOS 16.4+ et appli installée sur
   l'écran d'accueil) : non fait.
3. Tests unitaires du domaine (`stats.ts`, `catalog.ts › guessRayon / guessCategory`, `format.ts › parseDuration`).

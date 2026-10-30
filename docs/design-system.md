# Design system : Halo (Figma `fSjgllFeQ6Bwt2w3YOpWRX`)

Inventaire fait par script le 24/10/2026 (`figma.root.children`, une page par appel) : **15 onglets = 13 pages + 2 séparateurs vides** (`———`), **34 cadres** capturés.

| Page | Id | Cadres | Ce qu'on en a pris |
|---|---|---|---|
| Benchmark | 0:1 | Benchmark / Root (9 sections) | Effets signature : verre dépoli, « Liquid Glass avec réfraction (filtre SVG) ne marche qu'en Chromium » → c'est notre cas (Electron), bordure-reflet, halo live, NumberFlow |
| Components | 11:4 | Components / Root (Icônes, Atomes, Molécules, Organismes, Actions, Formulaires, Overlays, Data & carte, Shell) | NavRail, PageHeader, KPICard (libellé + valeur), SegmentedControl, Button, IconButton, StatusBadge, Toast, Dialog, Menu, Toggle, ProgressBar, ShipmentCard (carte à encoche) |
| Assets | 36:2 | Assets / Root (12 sections) | Background/Aurora + DotGrid (fond sous le verre), Chart/Bars, Chart/Area, Chart/Ring, Health/ActivityRings, State/Empty |
| Animations | 76:2 | 15 cadres « Anim · … » | Entrée des KPI, compteur, courbe qui se dessine, interrupteur (ressort), toast, halo live |
| Dashboard | 11:5 | Scene, Chorégraphie | Grille 1408 × 940, chorégraphie d'entrée (320 ms, décalage 60 ms) |
| Explorations | 24:2 | Passeport produit, Déclinaisons, Globe zoomé | — |
| Flux de fabrication | 53:2 | Scene, Carte · Scene | — |
| Foundations | 11:3 | Foundations / Root (couleur, typo, dimensions, effets, motion) | Rayons 28 / 16–20 / full, Poppins, tokens de mouvement |
| **Atelier** | 74:378 | **1 seul cadre « Atelier · Scene », en sombre** | Pas de version claire dans cette page |
| transfers | 117:1317 | Composants locaux, Contrôles, Risques, **Contrôles · Clair**, **Risques · Clair** | Référence du mode clair (cadres « Clair » + mode **Day** de `App / Color`) |
| Interventions | 78:2 | Scene | — |
| Qualité | 81:2 | Scene | — |
| Guide & Ressources | 11:7 | Guide / Root (HALO.md, règles d'écriture, Do/Don't, grille, QA) | Règles appliquées ci-dessous |

⚠ L'utilisateur pensait trouver des versions claires dans « Atelier » : la page n'a qu'un cadre sombre. Les versions claires sont dans la page **transfers** et dans le mode **Day** des variables (53 variables, valeurs identiques à celles relues pour ToW le 22/10). Le HALO.md dit encore « pas de mode clair » : on suit la demande de l'utilisateur (clair), le sombre reste en option dans Paramètres.

## Verre fumé « Glassy Dashboard » (30/10/2026)
Demande : ressembler le plus possible à la vidéo « Glassy Dashboard V5 » (code.xr) en gardant le fonctionnement et le
verre liquide. Ce qui en est repris :
- **Fond** : une photo (vallée au crépuscule, Michael Hull, Unsplash `vuWB5mGu5wE`, licence Unsplash), désaturée et aux
  tons resserrés (ombres levées, hautes lumières baissées) comme le salon brumeux de la vidéo ; `public/backdrop/`
  (2560, 1600, portrait), voile plus sombre en haut pour les titres blancs.
- **Thème sombre par défaut = verre fumé** : panneaux gris neutre translucide (`--glass-panel`, flou 30, saturation
  1,15), liseré blanc 13 %, texte blanc 100 / 76 / 60 %, tuiles et contrôles = voiles de blanc. Le clair reste au menu
  (même photo sous un voile blanc).
- **Barre du haut** : boutons ronds en verre (logo, rail ; +, Paramètres, thème), pastilles des personnes au centre,
  avatar à droite avec le point de synchro.
- **Rail** : pilule fine centrée à gauche, chaque icône dans un rond léger, onglet actif = rond blanc à icône sombre ;
  survol = nom dans une petite étiquette sombre ; la vague garde le nom de l'onglet actif.
- **Bulles** blanches (rail, segmenté type « Week / Month / Year », filtre, barre du téléphone).
- **KPI** : carré d'icône teinté (bleu, ambre, vert, violet), pastille d'évolution en haut à droite (vert ↗ / rouge ↘ /
  gris), libellé, valeur, petite courbe des dernières semaines (ou des 7 derniers jours).
- **Barres** : voiles de verre en dégradé, la barre du moment en bleu lumineux.
- **Titres** : nom du menu + une ligne de sous-titre ; Aujourd'hui = « Bonjour, Corentin ». Pas d'ombre sous les
  titres (elle les rendait flous sur l'iPhone).
- **Ajout rapide** : le + (barre du haut ; au téléphone, à côté de la barre d'onglets) devient son menu en une pièce
  de verre, comme la pastille du profil (vers le haut au téléphone).

## Fonds d'écran (30/10/2026)
Chacun choisit le sien (Paramètres › Fond d'écran), parmi 10 photos libres d'Unsplash, désaturées un peu et aux tons
resserrés pour le verre : Crépuscule (Michael Hull, `vuWB5mGu5wE`, par défaut), Montagne (Sven Scheuermeier,
`VNseEaTt9w4`), Océan (Tim Marshall, `yEOCA6oiVqg`), Forêt (Vadim Sherbakov, `NQSWvyVRIJk`), Ville (Hide Obara,
`2p1HOcpi14U`), Désert (Tim de Groot, `yNGQ830uFB4`), Aurore boréale (Marcelo Quinan, `R3pUGn5YiTg`), Lac (Ales Krivec,
`HkTMcmlMOUQ`), Étoiles (Greg Rakozy, `oMpAz-DN-9I`), Campagne (Kenneth Thewissen, `D76DklsG-5U`).

## Logo (30/10/2026)
Planche fournie par l'utilisateur : un « C » en ruban bleu translucide et une pastille menthe, sur une tuile de verre
clair (version principale), plus des variantes claire, sombre et monochrome. Le C est détouré (fond clair estimé puis
retiré, couleurs restituées) dans `public/logo/cadence-mark.png`, recomposé sur une tuile claire (`cadence-tile.png`,
coins à 22,5 %, liseré blanc) ; icônes de l'écran d'accueil pleines (iOS arrondit lui-même), version « maskable » avec
marge, favicon 64 px.

## Règles appliquées (HALO.md + Guide)
- Titre de page = nom du menu (Aujourd'hui : la salutation), avec une ligne de sous-titre depuis le verre fumé.
- Carte KPI = un libellé + une valeur (NumberFlow, chiffres tabulaires), + icône, évolution et courbe depuis le verre fumé.
- Une seule lumière : élément actif du rail, bouton principal (1 à 2 halos par écran).
- Vert (signal) = succès / coché uniquement. Statut = couleur + texte (+ icône).
- Rayons : panneaux 28, internes 16–20, boutons ronds.
- Verre seulement au-dessus d'un fond chargé : la photo sert de fond chargé (l'Aurora + trame de points avant le 30/10).
- Une NotchCard par écran maximum, sur un objet (la prochaine séance de salle).
- Formats français : « 12,4 km », « 72 % », « 1 h 05 », « 24 oct. ».
- Mouvement : entrée 320 ms (0.2, 0.9, 0.25, 1), sortie 140 ms, décalage 60 ms, version réduite.

## Liquid glass (src/ui/glass.tsx)
Carte de déplacement dessinée pour le rectangle arrondi de chaque élément (R = décalage x, G = décalage y), filtre SVG `feGaussianBlur → feDisplacementMap → saturate`, appliqué en `backdrop-filter: url(#…)`. Rail, contrôles segmentés, puce utilisateur, menus, dialogues, toasts, minuteur de repos, bouton de l'encoche, et le cadre de la fenêtre (anneau de verre sur le fond d'écran flouté). Repli : verre dépoli classique hors Chromium ou avec « transparence réduite ».

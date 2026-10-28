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

## Règles appliquées (HALO.md + Guide)
- Titre de page = nom du menu, seul, sans sur-titre ni sous-titre en fragments « · ».
- Carte KPI = un libellé + une valeur (NumberFlow, chiffres tabulaires).
- Une seule lumière : élément actif du rail, bouton principal, KPI actif (1 à 2 halos par écran).
- Vert (signal) = succès / coché uniquement. Statut = couleur + texte (+ icône).
- Rayons : panneaux 28, internes 16–20, boutons ronds.
- Verre seulement au-dessus d'un fond chargé : le fond Aurora + trame de points sert de fond chargé.
- Une NotchCard par écran maximum, sur un objet (la prochaine séance de salle).
- Formats français : « 12,4 km », « 72 % », « 1 h 05 », « 24 oct. ».
- Mouvement : entrée 320 ms (0.2, 0.9, 0.25, 1), sortie 140 ms, décalage 60 ms, version réduite.

## Liquid glass (src/ui/glass.tsx)
Carte de déplacement dessinée pour le rectangle arrondi de chaque élément (R = décalage x, G = décalage y), filtre SVG `feGaussianBlur → feDisplacementMap → saturate`, appliqué en `backdrop-filter: url(#…)`. Rail, contrôles segmentés, puce utilisateur, menus, dialogues, toasts, minuteur de repos, bouton de l'encoche, et le cadre de la fenêtre (anneau de verre sur le fond d'écran flouté). Repli : verre dépoli classique hors Chromium ou avec « transparence réduite ».

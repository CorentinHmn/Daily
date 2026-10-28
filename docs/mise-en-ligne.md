# Cadence en ligne : mode d'emploi

- Code : GitHub `CorentinHmn/Daily`, branche `main` (l'ancienne appli de bureau reste sur la branche `original`).
- Site : Vercel, relié au repo : chaque push sur `main` publie une nouvelle version (réglages dans `vercel.json`,
  aucune variable d'environnement à saisir : l'URL Supabase et sa clé publique sont dans `src/sync/client.ts`).
- Base et comptes : Supabase, projet « cadence » (`dyqqvtpdttwzwkxtpzfp`, organisation Abyss, Paris), offre gratuite.

## 1. Une seule fois : relier Vercel au repo (2 minutes)
D'abord, sur GitHub : repo `Daily` › Settings › General › **Default branch** › choisir `main` (sinon Vercel publierait
la branche `original`, l'ancienne appli de bureau).

Puis, au choix :
- **Garder l'adresse actuelle** (cadence-khaki-two.vercel.app) : vercel.com › projet **cadence** › Settings › Git ›
  **Connect Git Repository** › GitHub › `CorentinHmn/Daily`. Puis Settings › Git › Production Branch = `main`.
- **Ou un nouveau projet** : https://vercel.com/new › Import Git Repository › `CorentinHmn/Daily` › Deploy (Vercel lit
  `vercel.json` : Vite, `npm run build`, dossier `dist`).

Si Vercel ne voit pas le repo : « Adjust GitHub App Permissions » et autoriser `Daily`.

## 2. Une seule fois : l'adresse du site dans Supabase (pour « Mot de passe oublié »)
https://supabase.com/dashboard/project/dyqqvtpdttwzwkxtpzfp/auth/url-configuration
- **Site URL** : l'adresse Vercel du site (ex. `https://cadence-khaki-two.vercel.app`).
- **Redirect URLs** : ajouter `https://<adresse-du-site>/**`.

Sans ce réglage, le lien de réinitialisation renvoie vers `localhost` (page qui ne charge pas). Le service d'e-mails
gratuit de Supabase n'envoie que 2 e-mails par heure pour tout le projet : au-delà, « Limite d'e-mails atteinte ». Le reste (connexion, création de compte, foyer)
marche sans. Les comptes sont créés déjà confirmés (fonction Edge `signup`) : aucun e-mail à attendre.

## 3. Corentin
1. Ouvrir le site › **Créer un compte** (prénom, `corentinhamon@outlook.fr`, mot de passe) : connecté aussitôt.
   (L'ancien compte, vide, a été supprimé le 28/10 : il était bloqué faute de réglage de l'étape 2.)
2. **Créer notre foyer** : prénom, nom du foyer, puis « Ma semaine » (semaine type de départ), « Un exemple », ou
   **« Mes données »** pour reprendre l'appli PC (dans l'appli PC : menu du compte › Exporter mes données → fichier
   `.json`).
3. Menu du compte (avatar) › **Foyer et compte** › **Envoyer le lien** (iPhone) ou **Copier le lien** (PC).

## 4. Léa
1. Ouvrir le lien reçu : la création de compte s'affiche (prénom, e-mail, mot de passe).
2. Le code du foyer est déjà rempli › **Rejoindre le foyer**. Si une personne « Léa » existait déjà dans le foyer, elle
   la reprend avec ses tâches.

Sans le lien : Créer un compte › « J'ai un code » › code ABCD-1234 (visible dans Foyer et compte chez Corentin).

## iPhone : l'installer comme une appli
Safari › le site › Partager › **Sur l'écran d'accueil**, puis ouvrir Cadence depuis l'icône et se connecter une fois
(l'appli installée a son propre stockage, séparé de Safari). Elle s'ouvre ensuite même hors ligne ; les modifications
partent au retour du réseau.

## Ce qui est partagé
Tout (agenda, semaine type, sport, objectifs, habitudes, courses), en direct. Chaque tâche ou routine dit qui la fait
(une personne ou « Nous deux ») ; habitudes, programmes, séances, sorties et objectifs ont une propriétaire. Le
sélecteur « Tous / Corentin / … » en haut des écrans filtre. Le thème et la séance en cours restent propres à chaque
appareil. « Repartir de zéro », « Recharger l'exemple » et « Importer » (Paramètres) changent les données du foyer
pour les deux.

## Sécurité
- RLS sur `households`, `household_members`, `records` : lecture et écriture réservées aux membres du foyer ; ni un
  autre compte ni un visiteur non connecté ne lit quoi que ce soit (testé le 25/10/2026 à 3 comptes simulés).
- `create_household`, `join_household`, `claim_member` en SECURITY DEFINER (voulu : elles inscrivent le membre et
  vérifient elles-mêmes code, foyer unique, identité non prise). Un foyer se rejoint uniquement avec son code.
- Fonction Edge `signup` publique : elle crée un compte confirmé sans vérifier l'adresse. Un compte seul n'ouvre rien
  (aucun foyer sans code). Pour fermer les inscriptions plus tard : supprimer la fonction, ou la limiter (liste
  d'adresses autorisées).
- Seule la clé publique (publishable) est dans l'appli ; la clé secrète ne sert que dans la fonction Edge (côté
  Supabase).
- Déconnexion : la copie locale des données est effacée de l'appareil.

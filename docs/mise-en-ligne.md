# Cadence en ligne : mode d'emploi

- App web : https://cadence-khaki-two.vercel.app (projet Vercel « cadence », compte corentinhmn).
- Base : Supabase, projet « cadence » (`dyqqvtpdttwzwkxtpzfp`, organisation Abyss, Paris), offre gratuite.
- Publier une nouvelle version web : `Mettre en ligne.cmd`. App PC : `Mettre à jour l'application.cmd`.

## 1. Une seule fois : recevoir un code plutôt qu'un lien (2 minutes, tableau de bord Supabase)
Supabase envoie un lien par défaut ; l'app attend un code à 6 chiffres. Dans
https://supabase.com/dashboard/project/dyqqvtpdttwzwkxtpzfp/auth/templates, pour les deux modèles **Magic Link** et
**Confirm signup** :
- Sujet : `Ton code Cadence : {{ .Token }}`
- Contenu :

```html
<h2>Ton code Cadence</h2>
<p>Saisis ce code dans l'app :</p>
<p style="font-size:28px;font-weight:600;letter-spacing:6px">{{ .Token }}</p>
<p>Il expire dans une heure. Si tu n'as rien demandé, ignore cet e-mail.</p>
```

Le service d'e-mail gratuit de Supabase n'envoie que quelques e-mails par heure : si un code n'arrive pas, attendre un
peu avant d'en redemander un (une fois connecté, chaque appareil le reste).

## 2. Corentin, sur le PC (là où sont les vraies données)
1. Paramètres › Foyer : ajouter la deuxième personne (son prénom) si on veut déjà lui attribuer des tâches.
2. Menu du compte › **Compte et partage** › e-mail › code reçu › **Créer notre foyer** : toutes les données du PC
   partent en ligne.
3. Le code d'invitation (ABCD-1234) s'affiche dans Compte et partage, avec un bouton Copier.

## 3. Sur chaque iPhone
1. Ouvrir https://cadence-khaki-two.vercel.app dans **Safari** › Partager › **Sur l'écran d'accueil**, puis ouvrir
   Cadence depuis l'icône (l'app installée a son propre stockage, séparé de Safari).
2. Corentin : Compte et partage › même e-mail › code › **Retrouver mon foyer**.
3. Elle : écran de bienvenue › **J'ai un code de foyer** (ou Compte et partage) › son e-mail › code › **J'ai un code**
   › code du foyer + son prénom. Si une personne de ce prénom existait déjà dans le foyer, elle la reprend avec ses
   tâches.

## Ce qui est partagé
Tout (agenda, semaine type, sport, objectifs, habitudes, courses). Chaque tâche ou routine dit qui la fait (une
personne ou « Nous deux ») ; habitudes, programmes, séances, sorties et objectifs ont une propriétaire. Le sélecteur
« Tous / Corentin / … » en haut des écrans filtre. Le thème, le prénom affiché et la séance en cours restent propres
à chaque appareil.

## Sécurité (vérifiée le 25/10/2026)
- RLS sur `households`, `household_members`, `records` : lecture et écriture réservées aux membres du foyer ; ni un
  autre compte ni un visiteur non connecté ne lit quoi que ce soit (test SQL à 3 comptes simulés, annulé ensuite).
- Fonctions `create_household`, `join_household`, `claim_member` en SECURITY DEFINER (signalées par les conseils
  Supabase, voulu : elles inscrivent le membre et vérifient elles-mêmes code, foyer unique, identité non prise).
- Seule la clé publique (publishable) est dans l'app.

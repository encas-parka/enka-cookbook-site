# Spec — Click-through fixes Phase 1 (écritures, realtime multi-user, erreur visiteur)

**Status:** ready-for-agent

> Source : click-through SPA PocketBase (07-10, PB dev réinitialisé par le pipeline,
> verdict 86/86) — preuves détaillées dans `.scratch/tracker/clickthrough-checklist.md`
> (marqueurs `[!]`, `[~]` et annotations inline). Synthèse de session du 12-10.

## Problem Statement

Depuis la migration Appwrite → PocketBase, le click-through de la SPA sur un PB dev
frais révèle des flux cœur cassés ou fragiles :

- **Écritures rejetées (400)** : création produit, création achat (y compris avec
  création implicite du produit), modification produit (« Record not found in Dexie »),
  prêt lié à un event (sync `event_materiel`), création de document event — y compris
  par le créateur de l'event lui-même.
- **Visibilité / temps réel entre users** : l'invité d'un RSVP ne voit jamais l'event
  sur son dashboard (incohérence `contributors`/`guestUsers`) ; les modifications de
  teamdocs ne se propagent pas entre deux users sur la même page d'édition ; les
  documents liés par tag créés par un user sont invisibles pour un participant.
- **Échecs mal gérés** : un visiteur sur une URL protégée tombe sur des pages vides
  sans feedback, avec crash Svelte (`effect_update_depth_exceeded`) sur l'édition de
  recette ; la perte du serveur PocketBase est invisible (seul le hors-ligne internet
  s'affiche) ; un loan en échec pollue l'affichage d'autres pages jusqu'au refresh.
- **Cycle auth/cache** : login sur une session au cache IndexedDB résiduel ne charge
  pas les events sans Ctrl-R (race soupçonnée).

Conséquence : l'app n'est pas déployable en l'état (1.8 bloqué). Le « pipeline vert
86/86 » n'a validé que la fidélité d'import, jamais les write paths runtime via l'app.

## Solution

Corriger les régressions par diagnostic de cause racine, à la couche du défaut
(règles API PB, hooks JSVM, payloads client, lifecycle auth/stores, guards), puis
valider par re-click-through ciblé. Le critère de sortie de Phase 1 devient
**click-through vert**, pas verdict pipeline. Les décisions produit (cluster D) et
les améliorations UX profondes restent backloggées pour la Phase 2 SvelteKit.

## User Stories

1. En tant qu'organisateur d'event, je veux créer un produit depuis la page products
   de mon event, afin de planifier les achats de l'équipe.
2. En tant qu'organisateur, je veux que la validation rapide d'un achat crée
   implicitement le produit s'il n'existe pas, afin que la saisie reste fluide.
3. En tant qu'utilisateur, je veux modifier le store et les specs d'un produit
   existant, afin de corriger une erreur sans recréer le record.
4. En tant que membre d'équipe, je veux créer un prêt de materiel lié à un event sans
   faux conflit de disponibilité, afin de réserver de façon fiable.
5. En tant que membre d'équipe, je veux que les listes de materiel d'event reflètent
   un prêt créé ou modifié sans refresh manuel, afin que toute l'équipe voie le même plan.
6. En tant que créateur d'event, je veux créer des documents liés à mon event, afin
   que l'équipe partage les documents spécifiques à l'event.
7. En tant que participant d'event, je veux voir les documents liés par tag créés par
   les autres participants, afin d'accéder à tout le matériel de l'event.
8. En tant qu'invité d'un RSVP, je veux que l'event accepté apparaisse immédiatement
   sur mon dashboard (y compris après reload), afin de commencer à planifier.
9. En tant qu'éditeur de teamdoc, je veux voir les modifications sauvegardées des
   autres users sans quitter la page, afin de ne pas écraser leur travail.
10. En tant que visiteur non authentifié, je veux être redirigé avec un message clair
    quand j'ouvre une URL protégée, afin de comprendre pourquoi je ne peux pas y accéder.
11. En tant que visiteur, je veux que les pages protégées échouent proprement (ni
    loading infini, ni crash), afin de pouvoir naviguer ailleurs.
12. En tant qu'utilisateur logué, je veux une alerte visible quand le serveur
    PocketBase est injoignable, afin de savoir pourquoi les données ne se
    synchronisent pas (distinct de la perte de ma propre connexion internet).
13. En tant qu'utilisateur me connectant sur une session au cache résiduel, je veux
    que mes données soient chargées immédiatement, afin de ne pas devoir recharger
    manuellement la page.
14. En tant qu'organisateur, je veux que la création de deux events successifs ne
    duplique jamais un event, afin que le planning reste propre même sur connexion fragile.
15. En tant que visiteur, je veux que les recettes en brouillon n'apparaissent pas
    dans la liste publique, afin que le contenu non finalisé ne soit pas exposé.
16. En tant que mainteneur préparant le déploiement, je veux un click-through vert
    comme critère de sortie de Phase 1, afin que « pipeline vert » ne donne plus une
    fausse confiance sur les write paths runtime.

## Implementation Decisions

- **Diagnostic commun d'abord** pour le cluster écritures : comparer règles create
  PB / hooks JSVM / champs requis vs payloads client sur les collections en échec ;
  corriger à la couche du défaut, pas de contournement client aveugle. La cause
  racine est documentée dans chaque ticket.
- **Édition produit** : le chemin update de la sync collection doit retrouver le
  contrat offline-first d'avant migration (rattacher localement ou créer avant
  update) — rétablir la sémantique d'upsert perdue.
- **RSVP** : une source unique de vérité pour « events visibles par moi » ;
  l'écriture d'invitation doit atterrir dans le champ réellement filtré par le
  dashboard (l'écart observé `contributors` ok / `guestUsers` absent oriente le diag).
- **Realtime teamdocs** : propagation du contenu par abonnement par document (même
  approche que les locks, déjà realtime) ou resync au focus en repli ; ne pas casser
  le realtime des locks.
- **Gestion visiteur** : guards centralisant redirect + feedback ; aucun fetch de
  données protégées avant résolution du guard — élimine le crash d'effet à la racine
  plutôt que d'en masquer le symptôme.
- **Connectivité** : réutiliser le signal de déconnexion PB existant (débounce ~3 s)
  pour un statut visible distinct du hors-ligne navigateur.
- **Disponibilité loan** : conflits calculés sur des données fraîchement
  synchronisées ; l'état d'échec reste scopé au modal, jamais diffusé aux autres pages.
- **Double-création event** : durcissement conditionnel à l'investigation — le test
  click-through n'a pas été décisif ; garde d'idempotence si le code confirme l'exposition.

## Testing Decisions

- Un bon test n'affirme que du comportement externe (record créé et visible pour le
  bon user, erreur surfaced à l'utilisateur), jamais les internals.
- **Seam 1 — probes HTTP contre PB dev** (le plus haut) : règles API, hooks JSVM,
  payloads. Prior art : probes T18 du pipeline de migration.
- **Seam 2 — vitest au seam store/service, client PB stubbé** : upsert produit,
  calcul de conflits loan, filtre drafts, logique guards. Prior art : suites
  existantes (~104 tests) et stub client PB des tests.
- **Acceptance manuelle** : click-through checklist par cluster ; deux navigateurs
  pour les flux multi-users. La checklist est la porte d'intégration.

## Out of Scope

- Mise à jour des dépendances (protocole dédié déjà engagé ; ordre convenu :
  cluster écritures → deps → reste).
- Mécanique 1.8 : Dockerfiles, Traefik, SMTP, backups, upgrade PB.
- Cluster D (décisions produit) : UIs de suppression event/teamdoc, slugs de
  recettes, sécurisation serveur des drafts, interface de statut de recette.
- Les 5 améliorations Phase 2 : redirect auth vers dashboard, share links générés à
  la création d'event, autofocus/keyboard sur `recipe.plates`, permissions
  recette-liée-à-event, page dédiée de création d'emprunt.
- Hugo removal, og:image recettes, PWA / `version.json`.
- Flux invité-sans-compte (`AcceptInvite` supprimé, refonte HOOK-6 produit).

## Further Notes

- **Critère de sortie Phase 1 = click-through vert** (le verdict pipeline 86/86 ne
  couvre que l'import, pas les write paths runtime) — à graver dans
  `backlog.md`/`AGENTS.md` (ticket 12).
- Un teamdocs prod rejeté à l'import (contenu > 5000 chars) reste un delta produit
  hors périmètre.
- Mode d'implémentation : frontier ticket par ticket ; `/diagnosing-bugs` sur les
  tickets diagnosis-heavy (01, 03, 04, 06, 07) ; sous-agents d'implémentation
  orchestrés, scopes d'écriture disjoints garantis par les edges de blocage.

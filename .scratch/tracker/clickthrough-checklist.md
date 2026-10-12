# Checklist click-through — SPA PocketBase (dev local)

> Consolidé depuis : backlog `!` click-through · run audit-fixes § journal T18 ·
> handoff `handoff-clickthrough-26-10-07.md` (résidus). À cocher direct dans ce
> fichier. Cible : dev 8090 **réinitialisé par le pipeline** (voir prérequis).
> Les flux marqués **[probe-OK]** sont déjà couverts par sondes HTTP (T18) —
> le click-through vérifie l'UI, pas la ré-verification des règles.

## 0. Prérequis (une fois, avant de cocher quoi que ce soit)

- [ ] Migration rejouée sur le dev : PB dev **arrêté**, puis
      `bun run scripts_dev/migrate.ts --pb-bin=pocketbase/pocketbase --pb-dir=pocketbase/pb_data --content-synced --yes`
      → verdict VERT attendu (86/86, dont `timestamps.sample`).
- [ ] `bun run dev:pb` relancé (8090 healthy).
- [ ] Hugo lancé (`hugo server -D`, 1313) — assets/images via le proxy Vite.
- [ ] SPA lancée (`cd svelte-app && bun run dev`, 5173).
- [ ] **IndexedDB vidée** : DevTools → Application → IndexedDB → supprimer
      `EnkaDB` (sinon fantômes de l'ancien dataset : ids T17 ≠ ids hash15).
- [ ] Mot de passe posé pour `ghald@riseup.net` via Admin UI
      (`http://localhost:8090/_/`) — l'import régénère des mots de passe
      aléatoires pour tous les users (by design).
- [ ] SMTP non configuré en dev : les emails ne partiront PAS — les flux
      d'invitation se testent jusqu'au toast (comportement attendu).

## 1. Auth & cache

- [ ] Login `ghald@riseup.net` (le nouveau mot de passe) → atterrissage events.
- [ ] Aucune donnée fantôme : les events affichés = ceux de la base fraîche
      (les 6 noms dupliqués d'origine Appwrite, ex. `concert 2908` ×3, sont
      **dans la source** — pas un bug, cf. backlog).
- [ ] Logout → retour écran public, purge des caches.
- [ ] Login avec un 2e compte (créé via l'UI ou reset via Admin UI) → aucune
      donnée du compte précédent (T11).

## 2. Visiteur (non logué)

- [ ] Liste recettes publique lisible, 0 erreur console (T14).
- [ ] Aucune route auth-requise accessible.

## 3. Events

- [ ] Création event (EventCreatePage) : sélection teams, dates meals →
      JSON `date` dérivé, description, minContrib ; EventCard correcte après save.
- [ ] **Créer 2 events successifs → vérifier qu'ils ne se dupliquent pas**
      (le bug replay offline-first est backloggé — si reproduit : note la séquence).
- [ ] Édition event (EventEditPage) : save sans `DataCloneError` (fix P2 —
      régression possible si un write path a été retouché).
- [ ] RSVP : inviter un participant connu → bandeau `EventInvitationAlert` →
      accept/decline → statut contributor mis à jour.
- [ ] Todos de l'event (champ `events.todos` — la collection `event_todos` est
      dormante, ne pas s'attendre à une UI dédiée).
- [ ] Suppression event → cascade (products/purchases/event_materiel liés).

## 4. Products / purchases (ta zone à problèmes — tester en premier après events)

- [ ] Page products d'un event : liste rendue sans erreur console (fix P1 —
      `safeJsonParse` natif/legacy).
- [ ] Création produit : `updatedBy` posé ; `store`/`specs` éditables et
      re-rendus correctement (json natif).
- [ ] Création achat : dates `orderDate`/`deliveryDate` préremplies
      (toInputDate — le helper couvre loans/purchases).
- [ ] Calcul des besoins (needs) par date range.
- [ ] Édition + suppression produit/achat.

## 5. Recettes

- [ ] Liste recettes : 456 ; ingredients visibles sur les pages recette
      (fix P1-ingrédients : lecteur `ref || uuid`), astuces rendues en texte
      (pas de JSON brut — fix `parseAstuces`), préparation alternative OK.
- [ ] Création recette : sans id custom (statut private).
- [ ] Édition recette avec `permissionWrite` via PermissionsManager ; save ne
      purge pas `publishedAt`.
- [ ] Mode duplication.
- [ ] Images : rendues via le proxy Hugo (si images cassées → noter, c'est le
      chantier Hugo removal, pas un bug bloquant).

## 6. Materiel & loans

- [ ] Création/édition materiel (équipe).
- [ ] Suppression materiel : autorisée si membre de l'équipe (deleteRules
      team-scopées plan A — `createdBy` vide est normal, cf. structural check).
- [ ] Loan : création (`createdBy` écrit), dates via toInputDate.

## 7. Teamdocs + documents liés par tag

- [ ] Création teamdoc **sans eventId** (débloqué par la règle T10), list,
      édition, suppression.
- [ ] Bloc « documents liés par tag » sur les 4 pages événement (tags
      `materiel`/`produit`/`recette`/`tache` — run 26-10-07).
- [ ] Consommation des tags json sans erreur (référence du json natif).

## 8. Invitations & partage

- [ ] Share link event : création depuis l'UI → ouverture du lien (redeem) →
      join-event → l'event apparaît. **[probe-OK : 200, useCount, expiry,
      maxUses — tester le parcours UI complet]**
- [ ] Invitation email (send-emails) : toast ok:false attendu sans SMTP ;
      les invitations restent posées.
- [ ] Invitation team (invite-to-team) : ajout d'un membre existant → toast
      succès, roles préservés (vue TeamsManagement).
- [ ] ⚠️ Flux invité-sans-compte : HORS périmètre (`AcceptInvite` stubbé,
      refonte HOOK-6 produit) — ne pas le compter comme régression.

## 9. Locks & temps réel

- [ ] Même recette ouverte dans 2 navigateurs → badge lock + `userName`
      affiché ; expiration respectée ; reprise après release (fix P3 — règle
      takeover `userId || "" || expiresAt < now`).
- [ ] Realtime : modifier un event dans le navigateur A → visible sans reload
      dans le navigateur B (SSE).
- [ ] Resync : couper dev:pb → StatusBar « Connexion perdue » (~3 s) ; relancer
      → « connected » + resync silencieux ; cacher/rouvrir l'onglet → resync
      sans flash de loading (T15).
- [ ] Topic custom `user_<id>` : modifier les membres d'une team depuis B →
      A rattrape ses events sans reload (F5 — jamais prouvé bout-en-bout).

## 10. PWA / build (à la release seulement)

- [ ] `bun run build` (0 erreur) — si tu bumpes `version.json` : max 3 entrées,
      le modal de mise à jour SW s'affiche au reload.

## Non-bugs — ne pas les compter comme régressions

- Events dupliqués (6 noms, 9 copies) : **dans la source Appwrite**, backloggé
  (prévention création multiple + option garde transform pour 1.8).
- `event_todos` / `notifications` : collections dormantes (C3).
- Checkbox « Envoyer un email aux membres » : sans effet (C5).
- `AcceptInvite` : stubbé (HOOK-6).
- « 19 catégories » vs 60 rows : 19 `category` + 41 `equipment_tag` (expliqué).
- og:image recettes cassées : produit, backlog (chantier Hugo removal).

## Problèmes constatés (à remplir pendant la session)

Format : page / action / attendu vs obtenu / console (copier l'erreur exacte).

1.
2.
3.

# Checklist click-through — SPA PocketBase (dev local)

> Consolidé depuis : backlog `!` click-through · run audit-fixes § journal T18 ·
> handoff `handoff-clickthrough-26-10-07.md` (résidus). À cocher direct dans ce
> fichier. Cible : dev 8090 **réinitialisé par le pipeline** (voir prérequis).
> Les flux marqués **[probe-OK]** sont déjà couverts par sondes HTTP (T18) —
> le click-through vérifie l'UI, pas la ré-verification des règles.

## 0. Prérequis (une fois, avant de cocher quoi que ce soit)

- [x] Migration rejouée sur le dev : PB dev **arrêté**, puis
      `bun run scripts_dev/migrate.ts --pb-bin=pocketbase/pocketbase --pb-dir=pocketbase/pb_data --content-synced --yes`
      → verdict VERT attendu (86/86, dont `timestamps.sample`).
- [x] `bun run dev:pb` relancé (8090 healthy).
- [x] Hugo lancé (`hugo server -D`, 1313) — assets/images via le proxy Vite.
- [x] SPA lancée (`cd svelte-app && bun run dev`, 5173).
- [x] **IndexedDB vidée** : DevTools → Application → IndexedDB → supprimer
      `EnkaDB` (sinon fantômes de l'ancien dataset : ids T17 ≠ ids hash15).
- [x] Mot de passe posé pour `ghald@riseup.net` via Admin UI
      (`http://localhost:8090/_/`) — l'import régénère des mots de passe
      aléatoires pour tous les users (by design).
- [ ] SMTP non configuré en dev : les emails ne partiront PAS — les flux
      d'invitation se testent jusqu'au toast (comportement attendu).

## 1. Auth & cache

- [x] Login `ghald@riseup.net` (le nouveau mot de passe) → atterrissage events.
- [x] Aucune donnée fantôme : les events affichés = ceux de la base fraîche
      (les 6 noms dupliqués d'origine Appwrite, ex. `concert 2908` ×3, sont
      **dans la source** — pas un bug, cf. backlog).
- [x] Logout → retour écran public, purge des caches.
- [x] Login avec un 2e compte (créé via l'UI ou reset via Admin UI) → aucune
      donnée du compte précédent (T11).

## 2. Visiteur (non logué)

- [x] Liste recettes publique lisible, 0 erreur console (T14).
- [x] Aucune route auth-requise accessible.
> mais les tentative d'aller sur l'url d'un event ne redirige pas vers le dashboard: page vide (headerbar only), pas de toast error.
> page materiel et loan ok, redirigé vers dashboard, mais peut etre qu'un toast error ou autre feedback serait bienvenu
> sur les page `recipe/<id>/edit` → page vide, puis après un moment toast error "vous devez etre connecté"., loading infini, multiple erreur console `updated at:
    #addToQueue http://localhost:5173/src/lib/services/toast.service.svelte.ts:176
    create http://localhost:5173/src/lib/services/toast.service.svelte.ts:46
    error http://localhost:5173/src/lib/services/toast.service.svelte.ts:253
    RecipeEditPage http://localhost:5173/src/lib/routes/RecipeEditPage.svelte:253
    alternate http://localhost:5173/src/App.svelte:186
    alternate http://localhost:5173/src/App.svelte:186
    App http://localhost:5173/src/App.svelte:192
    initializeApp http://localhost:5173/src/App.svelte:47` et `Uncaught Svelte error: effect_update_depth_exceeded`/ Il faut gerer proprement cette sutuation.
> Verifier si d'autre page auth request peuvent etre concerné.

## 3. Events

- [x] Création event (EventCreatePage) : sélection teams, dates meals →
      JSON `date` dérivé, description, minContrib ; EventCard correcte après save.
- [x] **Créer 2 events successifs → vérifier qu'ils ne se dupliquent pas**
      (le bug replay offline-first est backloggé — si reproduit : note la séquence).
 > ok, mais le bug etait lié à des probleme de connexion, le test n'est pas decisif. Investiguer le code et verifier si possibilité/nécessité de renforcer.
- [x] Édition event (EventEditPage) : save sans `DataCloneError` (fix P2 —
      régression possible si un write path a été retouché).
- [!] RSVP : inviter un participant connu → bandeau `EventInvitationAlert` →
      accept/decline → statut contributor mis à jour.
 > `[pb-sync] realtime UPDATE events/6yqeqvd8wl2sn7r pb-collection.ts:278:13
 [pb-sync] update events/6yqeqvd8wl2sn7r pb-collection.ts:382:12
 [EventsStore] Événement mis à jour: 6yqeqvd8wl2sn7r EventsStore.svelte.ts:522:11
 [EventsStore] Invitation: 1 email(s), 0 team(s) → event 6yqeqvd8wl2sn7r EventsStore.svelte.ts:760:12
 [EventsStore] Emails envoyés : 0/1 (1 échec(s))` → l'invité est affiché comme "invité", mais celui-ci n'a pas le nouvel event affiché sur son dashboard, y compris apres un ctrl-R ou ctrl-maj-r. Event testé `Créer 2 events successifs` id:`6yqeqvd8wl2sn7r`, invitant 'qaldek', invité 'ghald'. console pb:  'ghald' apparait dans events.contributors , mais pas dans events.guestUsers.
- [x] Todos de l'event (champ `events.todos` — la collection `event_todos` est
      dormante, ne pas s'attendre à une UI dédiée).
> taches crée. Recorded dans events.todos (testé sur event `click-throught pb 1` id:`wqw07qq9ziy9kpw`)
- [?] Suppression event → cascade (products/purchases/event_materiel liés).
 > il n'y a actuellement pas d'interface ui pour la suppression des event. Feature a évaluer.

## 4. Products / purchases (ta zone à problèmes — tester en premier après events)

- [x] Page products d'un event : liste rendue sans erreur console (fix P1 —
      `safeJsonParse` natif/legacy).
- [!] Création produit : `updatedBy` posé ; `store`/`specs` éditables et
      re-rendus correctement (json natif).
 > Création de produit via le modal lié à handleOpenAddProductModal / AddProductModal echoue. Erreur console: `POST
 http://localhost:8090/api/collections/products/records
 [HTTP/1.1 400 Bad Request 2ms]
 Error creating product: ClientResponseError 400: Failed to create record.
     ClientResponseError http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:4
     send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1162
     promise callback*send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1161
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:543
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:606
     create http://localhost:5173/src/lib/db-sync/pb-collection.ts:336
     createProduct http://localhost:5173/src/lib/stores/ProductsStore.svelte.ts:1336
     handleSubmit http://localhost:5173/src/lib/components/eventProducts/AddProductModal.svelte:144
     submit http://localhost:5173/src/lib/components/eventProducts/AddProductModal.svelte:607`
 > Creation d'un purchases (censé créer le product si il n'existe pas) échoue: alert `Erreur lors de la validation rapide: Failed to create record.`. Console: `POST
 http://localhost:8090/api/collections/purchases/records
 [HTTP/1.1 400 Bad Request 1ms]
 [ProductsTable] Erreur validation rapide: ClientResponseError 400: Failed to create record.
     ClientResponseError http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:4
     send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1162
     promise callback*send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1161
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:543
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:606
     create http://localhost:5173/src/lib/db-sync/pb-collection.ts:336
     createPurchase http://localhost:5173/src/lib/stores/ProductsStore.svelte.ts:1305
     handleQuickValidation http://localhost:5173/src/lib/routes/EventProductsPage.svelte:540
     click_4 http://localhost:5173/src/lib/components/eventProducts/ProductCard.svelte:790`.
  > La modification de product est aussi impossible: `[ProductModalState] Error: [pb-sync] Record cannelle_qq9ziy9kpw not found in Dexie (products)
      update http://localhost:5173/src/lib/db-sync/pb-collection.ts:360
      updateProductBatch http://localhost:5173/src/lib/stores/ProductsStore.svelte.ts:1386
      updateStore http://localhost:5173/src/lib/stores/ProductModalState.svelte.ts:486
      withLoading http://localhost:5173/src/lib/stores/ProductModalState.svelte.ts:580
      updateStore http://localhost:5173/src/lib/stores/ProductModalState.svelte.ts:483
      handleUpdateStore http://localhost:5173/src/lib/components/eventProducts/StoreManager.svelte:46
      onkeydown http://localhost:5173/src/lib/components/eventProducts/StoreManager.svelte:105`
   Le mécanisme d'upsert n'a pas l'air implementé.
- [!] Création achat : dates `orderDate`/`deliveryDate` préremplies
      (toInputDate — le helper couvre loans/purchases).
 > pre-remplissage ok, mais creation impossible.
- [ ] Calcul des besoins (needs) par date range.
- [ ] Édition + suppression produit/achat.

## 5. Recettes

- [x] Liste recettes : 456 ; ingredients visibles sur les pages recette
      (fix P1-ingrédients : lecteur `ref || uuid`), astuces rendues en texte
      (pas de JSON brut — fix `parseAstuces`), préparation alternative OK.
- [~] Création recette : sans id custom (statut private).
 > mais les id sont des id par defaut PB. Evaluer l'interet de reprendre la logique de slug utilisé avec appwrite pour les id pocketbase (avantage: url plus lisible.) Le status est "public" par defaut. Par d'interface ui pour changer cela. Si nous voulons reprendre la logique de l'app appwrite, alors le status 'public' est ok pour le moment, mais en revanche, en tant que 'draft', les recettes ne devrait pas etre affiché pour les user non-auth (pas forcément besoin de sécurisé cela coté serveur, c'est surtout d'un point de vue ux/ui: le site ne doit afficher les brouillons que pour les auth, du moins dans la page de liste recipes. Si un user non-auth va directement sur l'url, c'est ok.)
- [x] Édition recette avec `permissionWrite` via PermissionsManager ; save ne
      purge pas `publishedAt`.
- [x] Mode duplication.
- [x] Images : rendues via le proxy Hugo (si images cassées → noter, c'est le
      chantier Hugo removal, pas un bug bloquant).
 > ok pour les asset logo

## 6. Materiel & loans

- [x] Création/édition materiel (équipe).
- [x] Suppression materiel : autorisée si membre de l'équipe (deleteRules
      team-scopées plan A — `createdBy` vide est normal, cf. structural check).
- [!] Loan : création (`createdBy` écrit), dates via toInputDate.
 > Erreur lors de la creation / modification d'un loan lorsque lié à un event (testé avec l'event 'clock-throught pb 1'): `POST
 http://localhost:8090/api/collections/event_materiel/records
 [HTTP/1.1 400 Bad Request 2ms]
 [EventMaterielStore] syncFromLoan error: ClientResponseError 400: Failed to create record.
     ClientResponseError http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:4
     send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1162
     promise callback*send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1161
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:543
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:606
     create http://localhost:5173/src/lib/db-sync/pb-collection.ts:336
     addItem http://localhost:5173/src/lib/stores/EventMaterielStore.svelte.ts:163
     addHeaderWithAllocation http://localhost:5173/src/lib/stores/EventMaterielStore.svelte.ts:196
     syncFromLoan http://localhost:5173/src/lib/stores/EventMaterielStore.svelte.ts:626
     updateLoan http://localhost:5173/src/lib/stores/MaterielStore.svelte.ts:422
     doSubmit http://localhost:5173/src/lib/components/teamMatos/CreateLoanModal.svelte:580
     handleSubmit http://localhost:5173/src/lib/components/teamMatos/CreateLoanModal.svelte:527`; modal affiche des conflits de disponibilité, incohérent puis page `loan/<id>` vide avec juste l'alert error `Failed to create record.` (idem sur page `materiel/<id>`, et ce y compris pour une autre teams → obligation de rafraichir la page pour retablir l'affichage). Après rafraichissement de la page: la reservation a en fait été correctement crée/modifié...
  > Pour la creation de loans sans event lié: juste un toast warn indiquant un probleme de disponibilité suspect, a priori faux.

## 7. Teamdocs + documents liés par tag

- [~] Création teamdoc **sans eventId** (débloqué par la règle T10), list,
      édition, suppression.
 > il n'y a pas d'ui pour supprimer un doc. Feature à évaluer.
 > Creation et édition ok, mais probleme realtime entre users: le realtime fonctionne bien pour le lock, mais les modification de userA ne sont pas visible par userB s'il est aussi sur `editdocument/<id> (il doit repasser par le dashboard et revenir sur le doc pour voir les modification. Risque d'ecrasement des modification de userA par userB)
- [!] Bloc « documents liés par tag » sur les 4 pages événement (tags
      `materiel`/`produit`/`recette`/`tache` — run 26-10-07).
 > aussi pb de realtime ? D'autorisation de lecture ?. test: un document 'products' crée par userA n'est pas visible par userB lorsqu'il va sur l'event, y compris apres un ctrl-R de la page. En fait, l'userB, qui pourtant à crée l'event (click-throught pb 1), ne peut pas crée de doc event. `POST
 http://localhost:8090/api/collections/teamdocs/records
 [HTTP/1.1 400 Bad Request 1ms]
 [EventDocumentCreatePage] Erreur: ClientResponseError 400: Failed to create record.
     ClientResponseError http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:4
     send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1162
     promise callback*send http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:1161
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:543
     create http://localhost:5173/node_modules/.vite/deps/pocketbase.js?v=32faa99f:606
     create http://localhost:5173/src/lib/db-sync/pb-collection.ts:336
     createEventDocument http://localhost:5173/src/lib/stores/TeamdocsStore.svelte.ts:241
     handleCreate http://localhost:5173/src/lib/routes/EventDocumentCreatePage.svelte:161`
- [ ] Consommation des tags json sans erreur (référence du json natif).

## 8. Invitations & partage

- [x] Share link event : création depuis l'UI → ouverture du lien (redeem) →
      join-event → l'event apparaît. **[probe-OK : 200, useCount, expiry,
      maxUses — tester le parcours UI complet]**
- [x] Invitation email (send-emails) : toast ok:false attendu sans SMTP ;
      les invitations restent posées.
- [ ] Invitation team (invite-to-team) : ajout d'un membre existant → toast
      succès, roles préservés (vue TeamsManagement).
- [ ] ⚠️ Flux invité-sans-compte : HORS périmètre (`AcceptInvite` stubbé,
      refonte HOOK-6 produit) — ne pas le compter comme régression.

## 9. Locks & temps réel

- [x] Même recette ouverte dans 2 navigateurs → badge lock + `userName`
      affiché ; expiration respectée ; reprise après release (fix P3 — règle
      takeover `userId || "" || expiresAt < now`).
- [x] Realtime : modifier un event dans le navigateur A → visible sans reload
      dans le navigateur B (SSE).
- [!] Resync : couper dev:pb → StatusBar « Connexion perdue » (~3 s) ; relancer
      → « connected » + resync silencieux ; cacher/rouvrir l'onglet → resync
      sans flash de loading (T15).
 > pas d'alert/toast en cas de perte du serveur pb. Seul le "hors-ligne", en cas de coupure internet, s'affiche, avec resynced ok.
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

1. A la connexion user sur une session navigateur peut etre pas complement propre en indexedDb: les event n'ont pas été chargé immédiatement, il a fallu un crtl-R. Race condition, ou bien lié à l'indexedDb ? Il faudrait renforcé la protection de l'indexedDb clean lors de l'arrivé sur le site d'un utilisateur non authentifé. Et si risque de race condition, investiguer les causes possibles.




## Autres améliorations à réflechir pour des futur ticket, probablement lors de la migration vers sveltekit.

1. Lors de l'authentification, redirection vers le dashboard plutot que de rester sur la page home.
2. Les liens de partages sur les page event/<id> devrait etre généré à la creation de l'event, et donc toujours exister.
3. `event/<id>` → l'input de modification /home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/svelte-app/src/lib/components/eventEdit/EventMealCard.svelte `recipe.plates` devrait etre auto-focus (si crée pas de bug svelte), avec touche 'enter' qui valide, et 'esc' qui annule.
4. `recipe/<id>/edit` : dans les permissions, il faudra a terme permettre de lier la recette à un evenement (a venir, auquel l'user participe),  afin que tous les particpants de l'evenement aquiert des droit en ecriture dessus. Peut etre complexe a implementer.
5. `loans/<id>` : la creation d'emprunt devrait peut etre s'effectuer sur une page dédié plutot que dans un modal. Reflexion ui/ux a avoir.

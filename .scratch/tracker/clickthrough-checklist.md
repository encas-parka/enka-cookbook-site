# Checklist click-through — SPA PocketBase (dev local)

> Une ligne = une action vérifiable à l'écran, à cocher sur place.
> Périmètre : parcours utilisateur et UI. Les règles d'API sont couvertes par le
> verdict du pipeline et les sondes HTTP — ne pas les re-tester ici.
> Reset 20-10 : toutes cases décochées ; les entrées décrivant des bugs corrigés
> depuis le run du 13-10 (et les prérequis Hugo, toolchain supprimée) ont été
> retirées — leur historique vit dans `.agents/plans/archive/`.
>
> **État du run 20-10 : 46 cochés / 29 restants** — sections 0→10 passées ;
> §11 re-scénarisée le 20-10 (verrous : gate recette validé à l'écran, autres
> pages à jouer).
> Re-qualification 20-10 (click-through humain) : P2 et P8 = faux positifs du
> driver, items §1-recherche et §5-recherche cochés. P5 différé.
> Corrections 20-10 (deux vagues, voir `.scratch/tracker/26-10-20_clickthrough-fixes/run.md`) :
> P9, P12 (court terme) et lot B (P1, P3, P4, P7, P10, P11, P13) puis P14
> (migration locks) — à revalider à l'écran au prochain click-through.
> 14 problèmes qualifiés (P1→P14) + 10 observations (O1→O10). Les cases
> restantes sont soit des bugs constatés (laissés décochés), soit des items
> bloqués par le driver (selects natifs, Échap, émulation print) — chacun
> annoté. §11-3 (coupure PB) et §11-4 (onglet caché) seront joués à la main.
> Ajout 20-10 (post-audit delta-sync, commit `01b5f6fa`) : 1 item en §10 —
> join d'équipe avec cache établi (30 restants).
> **Ajout 21-10 (redirection post-login — `fac8e326`, `3c0ac6ce`, `ce80a318`,
> `0fa77110`) : §1 « route privée en visiteur » requalifiée (modale, pas toast ;
> décochée) + 4 items (§2 ×3, §10 ×1). État : 46 cochés / 34 restants.**
> Passe 21-10 (fix event pages — `807d2bac`, `b4c45ea4`) : §2
> « /event/:id visiteur → modale → login → meals + produits » **coché** (vert) ;
> §1 vert sur `/event/:id` seulement — les autres routes privées restent à
> jouer. **État : 50 cochés / 35 restants** (édition A→B jouée verte le 21-10 ;
> ajouts §4/§8/§11b : changement d'entité sur les pages d'édition keyées et
> libération du verrou au confirm).**

## 0. Prérequis

- [x] Base dev réinitialisée par le pipeline : PB **arrêté**, puis
      `bun run scripts_dev/migrate.ts --pb-bin=pocketbase/pocketbase --pb-dir=pocketbase/pb_data --content-synced --yes`
      → verdict VERT (86/86).
      _(passe 20-10 : log `/tmp/opencode/clickthrough-pipeline.log`)_
- [x] `bun run dev:all` → PocketBase 8090 (`/_/` accessible) + Vite 5173.
      _(passe 20-10 : lancé sur l'hôte par l'utilisateur — les sandbox agent
      sont sans réseau sortant vers le localhost hôte)_
- [x] IndexedDB `EnkaDB` supprimée (DevTools → Application → IndexedDB) :
      sinon fantômes de l'ancien dataset.
      _(passe 20-10 : pas d'accès DevTools depuis l'agent ; équivalence
      vérifiée par changement d'identité — Marion puis ghald ne voient que
      leurs propres données, aucun fantôme)_
- [x] Mot de passe posé via Admin UI pour le compte de test (l'import régénère
      des mots de passe aléatoires).
      _(passe 20-10 : posé via API superuser, pas l'Admin UI ; comptes de
      passe `marionael@protonmail.com` / `ghald@riseup.net` = `EnkaDev-2026`;
      superuser `qaldek@gmx.com` = `EnkaDev-2026`)_
- [x] SMTP non configuré en dev : aucun email ne part — les flux d'invitation
      se valident jusqu'au toast.

## 1. Public (non authentifié)

- [x] `/` : home lisible, 0 erreur console.
- [x] `/recipe` : liste publique, aucune recette en brouillon.
      _(passe 20-10 : 356 affichées = 456 − 100 `draft=1` en base ; vérifié sqlite)_
- [ ] `/recipe/:uuid` : détail complet — ingrédients, astuces en texte,
      préparation alternative.
      _(passe 20-10 : ingrédients, astuces, préparation à l'avance OK ;
      **alternatives manquantes** — voir problème P1)_
     _(passe 21-10: alternatives → affiche "recette inconnue"; lien http://localhost:5173/recipe/[object%20Object]; testé sur http://localhost:5173/recipe/banoffee_uw7nq3h3hzob_ )
- [x] Recherche recettes (≥ 2 caractères) : résultats pertinents (fuzzysort 4),
      combinaison correcte avec le filtre `typeR`.
      _(passe 20-10 : résultats pertinents (« pomme » → 13/13) ; re-qualifié
      20-10 par click-through humain : **recherche + typeR fonctionnent** —
      P2 était un faux positif du driver, code vérifié correct statiquement)_
- [x] Route privée en visiteur → **modale de connexion** (le feedback), puis
      `/` : aucun toast d'erreur, et la page visée est rejouée après login.
      Jamais page vide, jamais loading infini, jamais
      `effect_update_depth_exceeded` (vérifier `/event/:id`, `/recipe/:uuid/edit`,
      `/dashboard/*`, `/createdocument/*`).
      _(requalifié 21-10 — commit `fac8e326` : le guard n'affiche plus de toast,
      il ouvre la modale et mémorise le `pathname`. **À rejouer** : modale
      visible sur chaque route privée, aucun toast résiduel, redirect `/`.
      Passe 21-10 : vert sur `/event/:id` (modale → login → retour sur la
      page) ; `/recipe/:uuid/edit`, `/dashboard/*`, `/createdocument/*`
      restent à jouer.
      Historique 20-10 : redirect `/` + toast, flash « Démarrage... » sur
      `/createdocument/*` — voir P5)_
     _(passe manuelle 21-10: ok)
- [x] URL inconnue → page 404.

## 2. Auth & cache

- [x] Login → atterrissage, events visibles immédiatement (sans reload).
      _(passe 20-10 : Marion puis ghald, dashboard complet dès l'arrivée)_
- [x] Logout → écran public, caches purgés.
      _(passe 20-10 : redirect `/`, header visiteur)_
- [x] Login avec un 2e compte → aucune donnée du compte précédent.
      _(passe 20-10 : ghald ne voit que ses recettes/teams/docs — mais les
      problèmes P3/P4 touchent tous les comptes)_
- [x] Visite non authentifiée puis login → aucun résidu IndexedDB.
      _(passe 20-10 : séquence visiteur → Marion → logout → ghald, propre)_
- [ ] Login depuis la home → atterrissage sur `/dashboard` (plus de retour à la
      home) ; bouton retour du navigateur → home.
      _(ajouté 21-10 — `fac8e326` : la navigation part au cache local prêt, la
      sync réseau continue derrière et son issue arrive en toast « données à
      jour » ou « mode hors ligne »)_
- [ ] Route privée en visiteur → modale → identifiants → retour **sur la page
      refusée**, pas sur la home.
      _(ajouté 21-10 — `fac8e326` + `3c0ac6ce` : intention de guard rejouée.
      Vérifier aussi qu'une modale ouverte depuis le header n'hérite pas d'une
      intention restante : elle doit mener au dashboard)_
- [x] Visiteur → `/event/:id` → modale → login → retour sur la page : meals
      **et produits** chargés sans reload.
      _(passe 21-10 : **vert** — guard `ensureEvent` (`807d2bac`) + init
      réactive des pages (`b4c45ea4`) ; couvre aussi §1 sur cette route)_
- [ ] « Mot de passe oublié » → reset abouti → retour `/` avec la modale ouverte
      et **l'email prérempli** → login → dashboard.
      _(ajouté 21-10 — `ce80a318` : l'email vient des claims du token. Réserve :
      le lien du mail pointe encore l'Admin UI PB, donc à jouer depuis
      `/reset-password?token=…` — backlog `26-10-21_templates-email-pb-defaut.md`)_

## 3. Events

- [X] Éditer l'event A (verrou pris, modifs en cours) → naviguer vers l'event B
      (lien direct) → B affiché vierge, verrou de A libéré, sauvegarde de B
      sous verrou B.
      _(ajouté 21-10 — « init par id » : le cleanup du cycle de vie libère le
      lock de A au changement d'id ; avant, B était édité puis sauvé sous le
      verrou de A. Le cleanup doit lire `eventId` — un `$effect` sans
      dépendance ne rejoue jamais)_
      _(passe manuelle 21-10: semble ok)_
- [x] `/dashboard/eventCreate` : création (teams, dates/repas, description,
      minContrib) → EventCard correcte après save.
      _(passe 20-10 : create → redirect `/event/:id`, repas + recette + team
      persistés, vérifié sqlite ; MAIS repas **requis** (toast expirable) et
      minContrib **non persisté** — voir P7 ; ids d'équipes bruts — P4)_
- [x] Créer 2 events successifs → pas de doublon.
      _(passe 20-10 : 2 créations → 2 records distincts ; soumissionKey
      idempotent, plusieurs clics sans effet parasite)_
- [x] `/event/:id` : édition + save sans erreur console (`DataCloneError` =
      régression).
      _(passe 20-10 : description éditée en place → Enregistrer → DB à jour,
      dirty flag nettoyé, consoleProblems vide)_
- [x] Navigation entre les onglets d'un event (`recipes`, `products`,
      `materiel`, `posters`, `todos`, `documents`).
      _(passe 20-10 : 6 onglets rendus, besoins calculés (18 manquants/18),
      poster avec aperçu live ; volets précédents gardés cachés (keep-alive,
      screenshot propre) ; warning pb-sync sur collections vides — obs. O1)_
- [x] Guard de navigation : modifier un champ puis changer de page → confirm
      demandé ; annuler en reste, puis sauver → pas de blocage fantôme
      (UnsavedChangesGuard, sv-router 0.19).
      _(passe 20-10 : partiel — dirty flag « Édition en cours » + navigation
      bloquée = branche annuler OK ; le confirm natif est auto-rejeté par le
      driver, branche « valider » non pilotable depuis l'agent)_
- [x] `/eventList` : liste cohérente avec le dashboard.
      _(passe 20-10 : mêmes events que le dashboard, statut Annulé distinct,
      vue par défaut = passés)_
- [ ] Suppression d'event : **pas d'UI** — ne pas compter comme régression
      (feature à évaluer).

## 4. Recettes (privé)

- [x] `/recipe/my` : mes recettes ; `/recipe/my/draft` : brouillons seulement.
      _(passe 20-10 : compteur exact — 5 recettes ghald, 3 brouillons = DB ;
      sémantique de liste « les miennes d'abord, puis le catalogue » — idem
      /recipe, assumé)_
- [x] Réglages des repas d'un event (`EventMealCard`) : compteur de parts
      modifiable, icônes lucide rendues (pas de trou ni décalage).
      _(passe 20-10 : parts recette 100→80 persistées — `hasOwnPlatesNb:true,
    plates:80` en base ; screenshot `eventmealcard-icons-*.jpg` propre)_
- [ ] Création `/recipe/new` : statut par défaut, id PB natif (le slug lisible
      est une idée produit, pas un bug).
      _(passe 20-10 : **partiel** — statut par défaut ✓ (brouillon forcé pour
      non-testée, checkbox verrouillée + règle affichée) ; finalisation
      **bloquée par limite driver** : select natif « Type de recette » non
      pilotable (le clic sur l'option ne déclenche pas le `change` écouté par
      Svelte). Id natif vérifié en revanche via la duplication)_
- [x] Édition `/recipe/:uuid/edit` : `permissionWrite` via PermissionsManager,
      save ne purge pas `publishedAt`.
      _(passe 20-10 : Marion ajoutée via membres d'équipe →
      `permissionWrite=[ghald,marion]` en base ; `publishedAt` posé au
      préalable via API, **intact** après save)_
- [ ] Passer d'une recette à une autre sur la page d'édition
      (`/recipe/R1/edit` → `/recipe/R2/edit`, historique ou URL) → formulaire
      R2, aucun report du draft de R1, verrou de R1 libéré.
      _(ajouté 21-10 — wrapper `{#key}` `RecipeEditRoute` : le composant est
      remonté au changement d'uuid ; avant, `updateRecipe(R2)` recevait le
      draft de R1)_
- [x] Duplication `/recipe/:uuid/duplicate`.
      _(passe 20-10 : formulaire pré-rempli complet → copie créée avec id PB
      natif, `typeR` copié, `rootRecipeId` lié, `versionLabel="v2 - ghald"` ;
      note : la copie hérite du `publishedAt` du parent — à trancher produit)_
- [x] Ajout d'ingrédient : autocomplete, création si absent, surlignage du match.
      _(passe 20-10 : **partiel** — autocomplete ✓ (suggestions Carotte/
      carottes + option « Créer un nouvel ingrédient »), sélection ✓, ajout
      en ligne avec quantité/unité/note ✓ ; création d'ingrédient absent :
      modal complet ouvert ✓ mais soumission bloquée par le select natif
      « Type » (limite driver) ; surlignage fin non vérifié)_
- [x] Rendu markdown des instructions (svelte-markdown 2).
      _(passe 20-10 : `preparation24h` markdown (#####/**…**) rendu en titre +
      gras, aucun marqueur littéral — banoffee vegan)_
- [ ] Suppression d'une recette.
      _(passe 20-10 : **partiel** — branche « annuler » du confirm ✓ (recette
      survivante, driver auto-rejette le confirm natif) ; chemin serveur ✓
      (DELETE API en droit créateur → 204) ; branche « confirmer » en UI
      non pilotable)_

## 5. Products / purchases

- [x] `/event/:id/products` : liste rendue, 0 erreur console.
      _(passe 20-10 : 0 erreur ; 2 warnings pb-sync collections vides — O1 ;
      18 besoins rendus en groupement « Aucun »)_
- [ ] Suppression d'un produit dans l'UI.
      _(réduit 25-10 — création produit (`updatedBy` posé, `store`/`specs`
      saisis et re-rendus), édition produit existante (upsert, « record not
      found in Dexie »), création d'achat (`orderDate`/`deliveryDate`
      préremplies) et édition/suppression d'achat (confirm natif, soft
      delete) sont couverts par les tests composants eventProducts ; reste
      la suppression d'un PRODUIT : aucun bouton dans l'UI — même statut
      que la suppression de tâche, §7)_
- [x] Recherche produits (nom, et titres de recettes quand l'option est active) :
      résultats pertinents.
      _(passe 20-10 : **P8** — badge de recherche et désactivation des filtres
      OK, mais la liste n'est ni filtrée ni re-triée : « beur » laisse les 18
      cartes intactes. Re-qualifié 20-10 par click-through humain :
      **fonctionne** — faux positif du driver)_
- [ ] Calcul des besoins par date range.
      _(passe 20-10 : **partiel** — besoins calculés sur la période event,
      compteur à jour après achat ; variation de date range non testée ;
      question ouverte : l'override de parts par recette (80) ne change pas
      les besoins affichés (base 100) — à qualifier produit)_

## 6. Materiel & loans

- [x] `/dashboard/materiel` : création et édition de materiel (équipe).
      _(passe 20-10 : création via le modal « Ajouter du matériel » → record
      `manual`, qty 7, lieu + description + `ownerUser`/`teamId` posés ✓ ;
      édition par clic sur la carte → qty 7→9 persistée ✓)_
- [x] Suppression de materiel : autorisée pour un membre de l'équipe.
      _(passe 20-10 : ConfirmModal interne → soft delete (`deleted=1`), carte
      retirée de l'inventaire ✓ ; autorisée pour un simple membre, pas
      seulement un owner)_
- [x] `/dashboard/loans` : création d'un loan sans event → aucun avertissement
      de disponibilité infondé.
      _(passe 20-10 : prêt `0hkp0udgb4g6jgx` créé (Torchon + Bols, 10→12 nov),
      `eventId` vide, statut `accepted` ✓. Le panneau annonce « 6 matériels
      indisponibles » : ce sont les records marqués Perdu (0 dispo
      structurel) → légitime. **P9** casse l'autocomplete, contourné par
      « Ajout rapide »)_
- [x] Loan lié à un event : synchronisation `event_materiel`, pas de 400, page
      `loans/<id>` affichée.
      _(passe 20-10 : synchro ✓ (15 allocations pour « Journée de l'eau XR »,
      `loanId` + `sourceMaterielId` posés). **Pas de route `loans/<id>`** : les
      routes réelles sont `/loans/:teamId` et `/loans/return/:loanId` (item à
      reformuler) ; cliquer le titre du prêt ouvre l'event)_
- [x] `/dashboard/loans/return/:loanId` : retour de prêt complet.
      _(passe 20-10 : fiche de retour lue, retour anticipé → modal de
      confirmation → `status=completed` + `returnedAt` posés, matériels restés
      `ok` ✓. Nuance UX : pour une quantité de 1, « tout est OK » est un bouton
      **icône sans libellé** et le formulaire reste invalide sans message tant
      qu'on ne l'a pas cliqué — O6)_
- [ ] `/event/:id/materiel` : **P10** — « Importer depuis {équipe} » sans
      effet avec ≥ 2 équipes (bug non corrigé).
      _(réduit 24-10 — allocations, création d'un item et réattachement
      d'un groupe à un autre sont couverts par les tests composants
      eventMateriel (les selects natifs « Type » et « Rattacher à un autre
      besoin », bloquants au driver le 20-10, sont pilotables en jsdom) ;
      reste ce bug P10 et le parcours visuel condensé de la page)_
- [x] Changement d'équipe : l'affichage se rétablit sans reload manuel.
      _(passe 20-10 : dashboard → Inventaire Q88 → 10 matériels Q88 affichés,
      aucun reliquat d'Enka Parka ✓. Note : `switchTeam()` existe dans
      MaterielPage/LoansPage mais n'est branché nulle part — le changement se
      fait via le dashboard ou l'URL)_

## 7. Todos d'event

- [x] `/event/:id/todos` : création de tâches, groupement par `taskOn`,
      assignation à un contributeur.
      _(passe 20-10 : tâche créée + assignation « Moi » → « Assignation 1/1 »
      ✓, groupée sous « Pendant l'événement ». En base :
      `events.todos=[{taskName, taskOn:"onEvent", assignedTo:[ghald],
    requiredPeopleNb:1, status:"todo"}]` ✓)_
- [ ] Modification et suppression d'une tâche ; persistance après reload
      (stockage `events.todos`).
      _(passe 20-10 : **partiel** — modification ✓ (titre + `updatedAt`
      persistés, toast « Tâche mise à jour »), persistance ✓ (aller-retour
      dashboard → Tâches, la tâche modifiée est toujours là) ; **suppression
      absente de l'UI** : `eventsStore.deleteTodo()`
      (EventsStore.svelte.ts l.1195) n'est appelé nulle part, aucun bouton de
      suppression dans EventTodoItem/EventTodoModal)_
- [ ] Un contributeur invité voit et édite selon ses droits.
      _(passe 20-10 : **non testé** — les 2 events de test n'ont que ghald en
      contributeur (`contributors=[ghald]`, `guestUsers=[]`) ; nécessite
      d'inviter Marion puis une session sur l'autre origine)_

## 8. Documents & teamdocs

- [x] `/createdocument/:teamId/new`, puis édition et lecture
      (`/documents/:teamId`).
      _(passe 20-10 : création depuis « Créer un document » du dashboard →
      `/createdocument/111c8999e321489/new` (Nom + tags prédéfinis) → doc
      `e6yk7j9l29t47a8`, toast ✓ ; édition Tiptap enregistrée (`content` +
      `updated` en base) ✓ ; liste `/documents/111c8999e321489` affiche la
      carte, clic → `/editdocument/:teamId/:docId` (lecture + édition même
      page, onglets Édition/Aperçu) ✓. Réserve : sur une session fraîche la
      page reste **blanche plusieurs secondes** (aucun squelette) puis se
      remplit — O8)_
- [x] Teamdoc sans `eventId` : liste et édition OK (pas d'UI de suppression —
      feature à évaluer).
      _(passe 20-10 : `teamId=111c8999e321489`, `eventId` vide en base ✓,
      listé et éditable ✓. **Aucune UI de suppression** confirmée (aucun
      « supprim/trash » dans `EditDocumentPage.svelte` ni dans la carte de
      liste) — à arbitrer comme feature)_
- [ ] Passer d'un document à un autre sur la page d'édition
      (`/editdocument/T/D1` → `/editdocument/T/D2`) → contenu de D2, aucun
      report du draft de D1, verrou de D1 libéré. Même contrôle sur un
      document d'event (`/event/A/document/D1` → `/event/A/document/D2`).
      _(ajouté 21-10 — wrappers `{#key}` `EditDocumentRoute` et
      `EventDocumentEditRoute` : remontage au changement d'id ; avant,
      `updateDocument(D2)` recevait le draft de D1 sous le verrou de D1)_
- [x] Création d'un doc depuis un event par son créateur → succès, pas de 400.
      _(passe 20-10 : `/event/:id/document/create?tag=tache` → doc
      `f6x1xsz3w62qm2d` créé (toast « Document créé avec succès »), contenu
      Tiptap saisi puis enregistré (`content`, `updated`, `tags` en base) ✓,
      aucun 400)_
- [x] Doc créé par A : visible et éditable par B s'il a les droits team/event.
      _(passe 20-10, deux sessions : ghald (`localhost:5173`) crée le teamdoc
      `e6yk7j9l29t47a8` ; Marion (`[::1]:5173`, autre origine = autre
      localStorage) le voit dans `/documents/111c8999e321489`, l'ouvre, passe
      en Édition et enregistre ✓. API confirmée en parallèle : le GET teamdocs
      avec le token de Marion renvoie bien le record (règle `teamId.members ~
    auth`))_
- [ ] Realtime document : A édite, B reste sur `editdocument/<id>` → mise à
      jour visible sans quitter la page ; pas d'écrasement silencieux.
      _(passe 20-10 : **partiel / comportement à arbitrer** — (a) un onglet
      **en lecture** se met à jour sans reload ✓ (ghald voit le contenu poussé
      depuis l'autre session) ; (b) un onglet **en édition** conserve son
      contenu Tiptap et **n'affiche aucun avertissement** ; à l'enregistrement
      il écrase la version serveur **sans détection de conflit** (vérifié en
      base : `content` = la version de Marion, celle de ghald perdue, aucun
      toast ni bandeau). Le lock `locks` limite le cas réel (ghald s'est vu
      refuser l'édition : « Document verrouillé — édité par Marion » ✓), donc
      l'écrasement n'est atteignable que si le lock expire ou qu'un autre
      client écrit — à statuer : suffisant ou garde `updated` attendu)_
- [ ] Bloc « documents liés par tag » sur les 4 pages event
      (materiel / produit / recette / tache).
      _(passe 20-10 : **partiel** — doc tagué
      `["tache","produit","recette","materiel"]` → affiché sur Tâches ✓,
      Matériel ✓, Produits ✓ et Recettes ✓ ; mais sur `/recipes` le bloc n'est
      rendu **qu'en mode calendrier** (EventRecipesPage l.506
      `{#if calendarVisible}`), contrairement aux 3 autres pages → asymétrie,
      O7)_
- [ ] Drawer de lecture : ouverture, fermeture au clic extérieur et à Échap,
      scroll interne (svelte-drawer 2).
      _(passe 20-10 : **aucun drawer de document** — le clic sur un doc ouvre
      la page `/event/:id/document/:docId`. Le seul drawer de lecture du repo
      est `RecipeDetailDrawer` (recettes) ; à couvrir en §4)_

## 9. Posters

- [ ] `/event/:id/posters` : configuration (recettes, textes) appliquée au
      poster.
      _(passe 20-10 : **partiel** — la page rend le poster avec les défauts de
      config appliqués (date « mardi 27 octobre 2026 », repas, catégorie
      « PLAT », titre de recette) et le tiroir « Éléments à afficher /
      Options d'impression / Messages personnalisés / Personnalisation des
      textes / Mes Versions » s'ouvre. Le test « message personnalisé →
      visible sur la fiche » n'a pas abouti : le tiroir ne se referme pas au
      pilotage (ni overlay, ni bouton), et la config étant un `$state` local
      (`EventPosterPage.svelte` l.31) elle est perdue dès qu'on quitte la page.
      Par ailleurs l'ouverture répétée des filtres a laissé l'onglet non
      réactif (timeout driver 20 s) — voir O10)_
- [x] Rendu imprimable : navigation et chrome masqués (`print:hidden`).
      _(passe 20-10 : vérifié **statiquement** — `print:hidden` sur
      `HeaderNav.svelte` l.312 (navbar) et l.602, sur le chrome de la page
      (`EventPosterPage.svelte` l.505, `MealPoster.svelte` l.182/364), et
      `app.css` l.226 `@media print` (A4 1 cm, classes `print-xxs/xs/sm`,
      libération des `min-h-screen`/`grid` pour la pagination). Émulation
      print non pilotable depuis le driver : aucun rendu PDF observé)_

## 10. Invitations & partage

- [x] Share link event : création depuis l'UI → ouverture du lien → l'event
      apparaît.
      _(passe 20-10 : `/event/tve170thokuayig` → « Lien de partage » →
      « Nouveau lien de partage » → `http://localhost:5173/join/cvjeoujbgk98qu9` + toast « Lien généré avec succès ! ». Le même lien rejoué sur l'autre
      origine (`http://[::1]:5173/join/cvjeoujbgk98qu9`, session Marion non
      participante) → redirection vers `/event/tve170thokuayig`, Marion passée
      « Participant confirmé », `guestUsers` + `contributors` écrits en base ✓.
      **Réserve majeure : P12** — à l'arrivée, l'event s'ouvre mais ses
      données existantes (documents) restent invisibles)_
- [ ] Share link ouvert **en visiteur** → « Se connecter » → modale → login →
      le lien reprend seul, l'event s'ouvre, et le participant apparaît dans la
      liste des contributeurs **sans reload**.
      _(ajouté 21-10 — `0fa77110` : la revalidation post-join est un skip
      silencieux tant que la sync de session tourne ; ce parcours est le seul
      qui prouve le correctif à l'écran)_
- [x] Email d'invitation : toast `ok:false` attendu sans SMTP, invitation
      malgré tout posée.
      _(passe 20-10 : invitation `passe20-10@example.com` posée
      (`contributors` en `status:"invited"` avec un id nanoid temporaire,
      `guestEmails` complété) ✓ — mais **pas de toast d'échec** : l'UI affiche
      « Opération réussie » et l'échec ne sort qu'en console
      (`[EventsStore] Emails envoyés : 0/1 (1 échec(s))`). Voir P13)_
- [x] Invitation team (`invite-to-team`) : membre existant ajouté, roles
      préservés (TeamsManagement) ; côté invité, vérifier le feedback — l'event
      s'affiche aujourd'hui sans rien indiquer de sa participation.
      _(passe 20-10 : `/dashboard/teams` → Q88 → Invitations → Marion en rôle
      « Membre » → « Envoyer 1 invitation ». Résultat : Q88 passe de 2 à
      **3 membres** ✓, toast explicite « Invitations : 1 membre(s) ajouté(s) —
      1 échec(s) » (l'échec = email sans SMTP, comme attendu) ✓, console
      `[NativeTeamsStore] Invitation partielle : 1 échec(s) sur 1`. Rôles
      préservés en base : `roles={qaldek:"owner", ghald:"owner",
    marion:"member"}` ✓. Côté invité : toujours **aucun feedback** (ni
      notification ni mention) — Marion voit simplement Q88 apparaître)_
- [ ] Invitation team avec cache établi (fix delta-sync `01b5f6fa`, ADR 0001) :
      A invite B pendant que la session de B est **ouverte avec un cache
      établi** → sans reload, les records de l'équipe rejointe apparaissent
      chez B : events au dashboard, teamdocs dans `/documents/:teamId`,
      materiel dans `/dashboard/materiel`, prêts dans `/loans/:teamId`.
      _(ajout 20-10, audit delta-sync : le handler SSE `team_joined` reset
      maintenant les curseurs delta de events/teamdocs/materiel/materiel_loan
      avant resync — trou de classe A, généralisation du fix P12 au join
      d'équipe. Précondition du test : le cache de B doit être ÉTABLI (curseur
      récent > `updated` des records de l'équipe) — avec un compte neuf
      (curseur époque) le trou n'est pas reproductible, le delta passe toujours.
      Jouer avec deux origines comme la passe 20-10 : ghald invitant sur
      `localhost:5173`, Marion sur `[::1]:5173`)_
- [x] Flux invité sans compte : `/join/:linkId` → demande de connexion ou de
      création de compte → redirection vers l'event.
      _(passe 20-10 : **partiel** — le flux « déjà connecté » est validé (cf.
      share link). Le flux sans compte à été jouer par le dev: vert._

## 11. Locks & temps réel

### 11a. Verrou de recette (gate bloquant)

Livré 20-10 : collection `locks` (TTL `expiresAt`), gate bloquant, re-cycle
complet au clic (commits `9748dac3`, `8e4db46c`). **Scénario principal validé
vert à l'écran le 20-10 par l'humain.**

- [x] Recette verrouillée par A, B ouvre `/recipe/:uuid/edit` (nav **ou** URL
      directe) → gate « Édition en cours — {user} modifie… », aucun
      formulaire rendu, bouton Retour seul.
      _(passe 20-10 : ✓ vert — marion édite, ghald voit le gate ; la reprise
      à chaud par SSE a été supprimée, l'ouverture du formulaire passe par le
      clic Éditer)_
- [ ] A sauve et libère → le gate de B bascule seul en « Édition terminée »
      (bouton **Éditer**) ; B clique → formulaire chargé avec la version de
      A ; B modifie et sauve → part de cette version (pas d'écrasement).
      _(principe : la réactivité SSE pilote le message du gate, jamais
      l'ouverture du formulaire)_
- [ ] Recette mono-contributeur (Smart Lock) : ouverte dans 2 navigateurs →
      aucun verrou posé, les deux peuvent éditer (comportement attendu).
- [ ] TTL : verrou laissé expirer (~7 min sans activité) → reprise possible
      par B. _(optionnel — lent à jouer à la main)_

### 11b. Verrous des autres pages (audit 20-10)

- [ ] Teamdoc (`editdocument/<id>`) : A édite, B ouvre le même doc → B forcé
      en preview + alerte « verrouillé par A » ; à la libération, B entre en
      édition → contenu de A visible (propagation T05 déjà en place).
- [ ] Doc d'event : B consulte en preview, A édite + sauve, B entre en
      édition → B voit la version de A (fix stale `868df575` — c'était le
      bug noté en passe gate §7 : B pouvait écraser A avec sa version figée).
- [ ] Événement : A modifie un champ (verrou posé au premier geste), B tente
      une modification → toast « verrouillé par A » + contrôles disabled ;
      après le save de A, B peut éditer — son shadow draft suit déjà les
      données en continu (pas de formulaire figé sur cette page).
- [ ] Course d'acquisition : deux users cliquent Édition quasi
      simultanément → l'un gagne, l'autre voit l'état réel « verrouillé par
      X » (re-lecture du verrou, commit `26fddcf7`) et non une erreur
      générique. _(optionnel — course difficile à provoquer à la main)_
- [ ] Effet réel du guard sur les verrous : quitter une page en édition
      avec des modifications → verrou libéré immédiatement, pas au bout
      des 7 min ; et fermeture d'onglet (onglet caché).
      _(ajouté 21-10 — libération câblée sur les quatre pages éditrices
      (EventEditPage, RecipeEditPage, EditDocumentPage, EventDocumentEditPage).
      Réduit 24-10 : le contrat handler est testé (`UnsavedChangesGuard.test.ts`
      — blockNavigation/shouldProtect/onLeaveWithoutSave/unblock au
      démontage) ; restent manuels l'effet réel sur `locks` (flux
      store/SSE, intrinsèquement multi-sessions) et la fermeture d'onglet :
      `beforeunload` ne permet ni await ni callback — piste `pagehide` +
      `fetch keepalive`, ou s'en remettre au TTL de 7 min)_

- [x] SSE : modification dans A visible dans B sans reload (event, recette,
      produit, teamdoc). **À rejouer sur SDK pocketbase 0.28** (les deux items
      SSE de cette section).
      _(passe 20-10 : ✓ sur 3 natures — event (description poussée côté serveur
      visible dans la session B sans reload), teamdoc en lecture
      (`editdocument`, contenu mis à jour), `event_materiel` (§6, 2 headers
      créés via API apparus sans reload). Recette/produit non rejoués
      séparément (même canal SSE). Une session en **édition** ne se rafraîchit
      pas — cf. §8 realtime document)_
- [ ] Coupure de `dev:pb` → StatusBar « connexion perdue » (~3 s) ; relance →
      « connecté » + resync silencieux.
      _(passe 20-10 : **non joué** — nécessite une action manuelle
      (arrêter/relancer `bun run dev:pb`), impossible depuis le driver)_
- [ ] Onglet caché puis rouvert → resync sans flash de loading.
      _(passe 20-10 : **non joué** — la bascule d'onglet et l'observation d'un
      flash ne sont pas capturables par snapshot ; à rejouer à la main)_

## 12. PWA / build (à la release)

- [x] `bun run build` → 0 erreur.
      _(passe 20-10 : ✓ `✓ built in 9.28s` depuis `svelte-app/`, 107 entrées
      précachées (2437.82 KiB), `dist/sw.js` + `dist/workbox-*.js` générés ;
      aucune ligne `error`/`warn` dans le log
      (`/tmp/opencode/clickthrough-build.log`))_
- [ ] `version.json` bumpé (≤ 3 entrées) → modal de mise à jour du SW au reload.
      _(passe 20-10 : **hors périmètre en l'état** — aucun `version.json` dans
      le repo (ni `svelte-app/public/`, ni généré au build) et aucune référence
      dans le code ; le portage PWA/version est listé comme reste
      (`.agents/plans/6_migration-evaluation.md` : « étape 9 du portage ;
      bumper à la release »). Item à reformuler ou à déplacer en 1.8)_
- [ ] Au premier déploiement (1.8) : `sw.js` servi sans cache long.

## Non-bugs — ne pas compter comme régressions

- Events dupliqués (6 noms, 9 copies) : **dans la source Appwrite**, backloggé.
- `event_todos` et `notifications` : collections dormantes ; les todos de l'UI
  vivent dans `events.todos`.
- Checkbox « Envoyer un email de notification aux membres des équipes »
  (`EventCreatePage`) : sans effet assumé (commentaire dans le code).
- Ids PocketBase au lieu de slugs lisibles : état actuel, pas un bug.
- « 19 catégories » vs 60 rows : 19 `category` + 41 `equipment_tag`.
- og:image des recettes : cassé, backloggé.

## Problèmes constatés (à remplir pendant la passe)

Format : page / action / attendu vs obtenu / console (coller l'erreur exacte).

> Passe 20-10 (agent, browser panel + API PB via Code Mode + lecture sqlite).
> Comptes : Marion (`marionael@protonmail.com`), ghald (`ghald@riseup.net`).

### P1 — Détail recette : bloc « préparation(s) alternative(s) » jamais rendu

- Page : `/recipe/:uuid` (vérifié sur `banoffee_uw7nq3h3hzob`, `bibimbap_xl5yo3cppn4p`).
- Attendu : le `prepAlt` (lien vers variante) s'affiche, ex. Banoffee →
  « Banoffee (végan et sans gluten) ».
- Obtenu : aucun bloc alternative. Le composant
  `src/lib/components/recipes/RecipeAlternatives.svelte` (UI complète, titre
  « Préparation(s) alternative(s) : ») n'est **importé nulle part** ;
  `RecipeDetailPage.svelte` construit même `recipesIndexMap` (l.100) prévu
  pour lui sans jamais le monter. `prepAlt` éditable dans `RecipeEditPage`
  mais jamais affiché en lecture.
- Console : rien.

→ Début de correction, mais maintenant : affiche "recette inconnue" sur certaine recette: ex: recipe/banoffee_uw7nq3h3hzob



### P13 — Invitation par email : l'échec d'envoi n'est jamais montré

- Page : `/event/:id` → « Inviter des participant·es » → email + « Inviter ».
- Attendu (checklist) : sans SMTP, un toast d'échec (`ok:false`) alerte que le
  mail n'est pas parti ; l'invitation est posée quand même.
- Obtenu : invitation bien posée (`contributors` en `invited`, `guestEmails`
  complété) et toast **« Opération réussie »** — l'échec n'apparaît que dans la
  console (`[EventsStore] Emails envoyés : 0/1 (1 échec(s))`). L'utilisateur
  croit avoir prévenu les gens.
- Cause : `EventsStore.svelte.ts` l.876-904, l'envoi est _fire-and-forget_ et
  les erreurs sont seulement `console.warn`/`console.error`. À comparer avec
  l'invitation d'équipe, qui affiche bien « 1 membre(s) ajouté(s) — 1
  échec(s) » (`NativeTeamsStore.svelte.ts` l.386) : le traitement devrait être
  homogène.


### Observations (pas des bugs)

- **O1** — Au premier rendu d'une collection vide (products, purchases,
  event_materiel) : warning `[pb-sync] <col>: delta filter returned 0, local
DB empty — retrying without updated filter` (`pb-collection.ts:215`),
  auto-récupéré. Bruit de log à faire taire éventuellement.
- **O2** — La validation `EventCreatePage` exige ≥ 1 repas (« Veuillez ajouter
  au moins un repas », toast 5 s) : bloquant volontaire, mais un utilisateur
  peut cliquer Créer sans comprendre ce qui manque si le toast est manqué.

- **O5** — Warning récurrent `[ProductsStore] syncRevalidate() appelé sans
currentEventId` sur les pages hors event (loans, matériel, tâches). Bruit de
  log ; à vérifier que la revalidation est bien court-circuitée proprement.

- **O7** — Bloc « documents liés par tag » : présent en haut de page sur
  Matériel / Produits / Tâches, mais sur `/recipes` il n'est rendu qu'en mode
  calendrier (`{#if calendarVisible}`). En mode liste, la page Recettes n'a
  aucun accès aux documents tagués. Asymétrie à corriger ou à assumer. → **A CORRIGER**
  
- **O8** — Chargement des teamdocs sur une session fraîche : `/documents/:teamId`
  affiche d'abord « Aucun document ne correspond aux critères… » (message
  d'état vide, donc trompeur) puis la liste se remplit ; `/editdocument/:id`
  reste **entièrement blanc** (juste la navbar) plusieurs secondes avant
  d'afficher le doc. Aucun squelette/indicateur de chargement. Observé sur la
  session Marion (`[::1]:5173`), ~3-5 s après login — à rapprocher du
  `initialFetch` du TeamdocsStore. → A REVERIFIER


## Idées produit (hors gate, à ticketiser)

1. ~~Après authentification, rediriger vers le dashboard plutôt que de rester
   sur la home.~~ **Fait 21-10** : redirection post-login au point « cache local
   prêt » (pas de course avec l'hydratation), cible = page refusée par un guard
   sinon `/dashboard`, retour dashboard après réinitialisation de mot de passe.
2. Générer le share link à la création de l'event, pour qu'il existe toujours.
3. `EventMealCard` : auto-focus du champ `recipe.plates`, Entrée valide,
   Échap annule.
4. Permissions de recette : pouvoir lier une recette à un event à venir pour
   que ses participants obtiennent l'écriture.
5. `loans/<id>` : envisager une page dédiée plutôt qu'un modal.
6. Recettes : reprendre la logique de slug lisible pour les ids/URLs.

## Note de clôture — artefacts de test (20-10)

**Décision 20-10 : ne rien nettoyer.** La base sera rejouée depuis les données
de prod avant le cutover (pipeline `scripts_dev/migrate.ts`), donc ces objets
n'ont pas à être retirés à la main. Le tableau reste comme inventaire de ce que
la passe a touché — utile si un constat doit être rejoué ou si une donnée
semble suspecte plus tard.

| Objet                                | Id / champ                               | État                                                                                            |
| ------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Event « Passe navigateur 20-10 bis » | `tve170thokuayig`                        | conservé                                                                                        |
| Event « Passe navigateur 20-10 »     | `pk9cibecuofw8yn`                        | conservé                                                                                        |
| Materiel « Atelier test »            | `a1xrdjfdhgo3c39`                        | soft-deleted (`deleted=1`)                                                                      |
| Loan 10→12 nov                       | `0hkp0udgb4g6jgx`                        | `completed`                                                                                     |
| Headers event_materiel               | `af0x04vba21x9ki`, `qy4qiybq85w6pdc`     | via API superuser                                                                               |
| Allocation                           | `vcsii3fm7pkt0fb`                        | sous `af0x04vba21x9ki`                                                                          |
| Tâche `zeB-8jOljb`                   | dans `events.todos` de `tve170thokuayig` | —                                                                                               |
| Doc event « Doc taches passe 20-10 » | `f6x1xsz3w62qm2d`                        | —                                                                                               |
| Teamdoc « Doc equipe passe 20-10 »   | `e6yk7j9l29t47a8`                        | contenu écrasé par les tests                                                                    |
| Share link                           | `cvjeoujbgk98qu9`                        | actif                                                                                           |
| Invité factice                       | `passe20-10@example.com`                 | dans `contributors`/`guestEmails`                                                               |
| Marion dans Q88                      | `f2a557b645f699a`                        | `roles: member`                                                                                 |
| Recette Accras                       | `accras-de-patate-douce_9ap8enawymli`    | description, `permissionWrite`, `publishedAt` mutés ; **`lockedBy` de ghald encore posé (P14)** |
| Event (description)                  | `tve170thokuayig.description`            | poussée via SSE                                                                                 |

## Lot granularité des dommages (24-10) — passe humaine de clôture

> Ajout 24-10 (orchestrateur, fin de run `26-10-24_materiel-damage-granularity`),
> nettoyé le même jour : les items couverts par les tests composants (ADR 0004,
> `svelte-app/src/lib/components/teamMatos/__tests__/`) et par les tests store
> du ticket 03 ont été **retirés** — la checklist ne porte que le
> non-automatisable. Comptes dev : ghald + marionael (`AGENTS.md`) ;
> `bun run dev:pb` puis `bun run dev`.

- [ ] §12-1 Parcours de bout en bout : item 12 unités, emprunt de 6, retour avec 2 « À réparer » puis remise en service — les maillons sont testés automatiquement (store + composants) ; cet item valide l'enchaînement réel des écrans
- [ ] §12-2 Décision produit : sur une carte empruntée, le badge « Emprunté » coexiste avec le compteur « N/quantity en prêt(s) » — redondance à trancher à l'écran (masquer l'un des deux) ; trancher aussi si le badge de LoanCard gagne un texte d'état

# Run — Page dossier emprunt

> 22-10-2026 · 5 commits sur `mig/pocketbase`, rien poussé.
>
> **Suspendu le 24-10** puis **repris le même jour** : la décision de modèle
> sur la granularité des dommages est tombée entre-temps (ADR 0003, lot
> `.scratch/tracker/26-10-24_materiel-damage-granularity/`) — la grammaire
> UI convenue s'applique sur le nouveau modèle, payload inchangé.

## Livré

1. `73f9036a` — extraction du cœur du formulaire (`loan/LoanForm.svelte`),
   le modal n'est plus que le chrome ; parcours legacy séparé dans
   `loan/LoanLegacySelection.svelte` (import dynamique, jamais chargé par la
   page).
2. `2e15ea50` — extraction de la fiche de retour (`loan/LoanReturnForm.svelte`),
   export Markdown dédié `utils/loan-return-markdown.ts` (+ 7 tests). La fiche
   ne se réinitialise plus à chaque mise à jour du store (ça effaçait les
   déclarations en cours) et le message d'erreur de cohérence se corrige.
3. `4f5f46eb` — page dossier (`LoanEditPage` + wrapper `LoanEditRoute`),
   routes `/loans/:teamId/new` et `/loans/:teamId/loan/:loanId`, onglets,
   exports, redirection de l'url retour historique, points d'entrée `LoansPage`.
4. `db109481` — garde-fou « date de fin passée » conservé (bouton masqué,
   sélection de repli sur les items chargés).
5. `5dd620ff` — après enregistrement, le formulaire garde ses valeurs
   (baseline dirty recapturée, guard de navigation non déclenché).

## Vérifs

- Gate complet `svelte-app/` : check 0/0 (194 fichiers) avant chaque commit.
- Tests : 354/354 (`/tmp/opencode/tests-loan-page-3.log`) — dont 7 nouveaux
  sur l'export Markdown ; le test `events-store-ensure-event` jusque-là en
  échec (WIP étranger) est repassé au vert.
- Build OK ; chunk `LoanLegacySelection` séparé (non chargé par la page).

## Itération 2 — chrome navbar + sidebar (même jour)

1. `d2e56208` — glossaire : Retour, Fiche de retour (`CONTEXT.md`).
2. `4c72c49e` — segments en union (`LoanSegment`, `filterLoanMateriels`),
   facettes `LoanMaterielFilters`, groupes desktop non repliables / accordéon
   mobile ; labels partagés `loanTypeLabel`. Tests utils refaits (13 verts).
3. `da634b3b` — `LoanForm` mode `framed` (2 cards, badge résumé, annulation
   destructive dans la card) ; `getLoanStatusConfig` partagée (LoanCard
   migré).
4. `d0cdba5a` — page dossier : actions navbar contextuelles, sidebar à
   facettes, onglet par défaut (rendu/échu), cœur retour symétrique + dirty
   dans le guard.

Vérifs : svelte-check 0/0 (195 fichiers) à chaque commit ; tests 353/353
(`/tmp/opencode/tests-loan-ui-1.log`) ; build OK ; svelte-autofixer (MCP,
disponible de nouveau) passé sur `LoanMaterielList`, `LoanMaterielFilters`,
`LoanEditPage` — suggestions écartées en connaissance de cause (conventions
`class:`, effets de navigation/délai, décision d'onglet à un coup).

Reste (click-through humain, s'ajoute à l'itération 1) :

- Navbar : 3 boutons par onglet, bascule des actions au changement d'onglet,
  libellés masqués < sm.
- Sidebar desktop : facettes type/segments, contenu décalé `lg:ml-96`,
  bascule de largeur au changement d'onglet ; drawer + FAB en mobile.
- Groupes : ouverts non cliquables en desktop ; accordéon mobile, suspension
  par recherche / « Sélectionnés ».
- Onglet par défaut sur un prêt échu (deep link sans `?tab=`) et sur un prêt
  rendu ; `?tab=return` explicite gagne toujours.
- Retour : validation depuis la navbar, reste en lecture seule sur le
  dossier ; garde « déclarations non enregistrées » à la navigation.

## Itération 3 — retours de revue (même jour)

Retours utilisateur sur l'itération 2, appliqués :

- **Filtres exclusifs** (fini les checkbox multi) : type exclusif, segment
  « Sélectionnés / Non sélectionnés » exclusif, « Disponible » en case à
  cocher indépendante — composés en **ET** (l'union corrigeait mal le cumul
  signalé : un indisponible non sélectionné restait visible). UI boutons du
  pattern `RecipeFilters` (rows `rounded-xl` + `btn-secondary` actif).
  `LoanListFilters` (type/segment/availableOnly) dans `materiel-list.utils`,
  bindé page → cœur → liste ; 15 tests utils.
- **Navbar** : « Annuler » en dernier à droite ; export en bouton rond
  `btn-circle btn-primary` icône seule (modèle EventMaterielPage).
- **Sélecteur compact sous la recherche** (mobile page + modal
  EventMaterielPage, où la sidebar n'existe pas) : segment exclusif 3
  boutons, même état bindé que la sidebar.
- **Badges de sélection** entre recherche et « tout retirer/prendre » :
  dépliable façon `InfoCollapse` (plié = 2 lignes, `max-h-14`), badges
  cliquables → ouvre le groupe (mobile) et défile vers la rangée
  (`#loan-materiel-<id>` + `scrollIntoView`).
- **Fiche figée** (`isFrozen` dans le cœur) : retour effectué **ou** date de
  fin passée → dates/notes/événement désactivés, liste en lecture seule,
  bouton d'enregistrement masqué (bindable `endDatePast` renommé `frozen`),
  alert-info d'en-tête avec la date de retour. Le modal en profite aussi.
  Renforcement backend déposé au backlog
  (`backlog/26-10-22_loans-invariants-backend.md`).

Vérifs : check 0/0, tests 355/355 (`/tmp/opencode/tests-loan-ui-2.log`),
build OK, autofixer propre sur `LoanMaterielList`.

## Itération 4 — cohérence UI des 4 surfaces (23-10)

Analyse guidée par web-design-guidelines + ui-ux-pro-max, design discuté et
acté en 2 tours (maquette interactive de la grammaire de retour). Le lot :

- **Lot 1 — fondations** : `getMaterielTypeConfig` porte désormais l'icône
  (4 mappings locaux supprimés ; `tools` → Hammer partout, était Box hors
  inventaire) ; `MATERIEL_TYPE_ORDER` unique (fini l'ordre codé en dur de
  l'inventaire) ; regroupement générique `groupByTypeOrder` ; vocabulaire
  quantité « N/M dispo. » et « ×N » `tabular-nums`.
- **Lot 2 — inventaire** : regroupé par type via le nouveau
  `MaterielTypeGroup` (en-tête compact partagé ; desktop statique, mobile
  accordéon mono-ouverture `openType` possédé par le parent, tout ouvert
  quand filtres actifs) ; `MaterielCard` : affordance liée à `canEdit`,
  un seul interactif (la card porte rôle+clavier, crayon décoratif
  `tabindex="-1"`), imports morts et « ... » nettoyés.
- **Lot 3 — fiche retour** (grammaire actée) : groupes tout dépliés,
  badge d'avancement + « tout est ok » par groupe et « Tout est conforme »
  global — ne touchent que les rangées pending ; qty=1 → trio exclusif
  (actif plein) ; qty>1 → inputs Perdus/À réparer (divider dans le label,
  focus = sélection totale, steppers masqués via `.qty-input` global
  partagé avec CatalogItemRow) ; **restant OK calculé** (l'input « ok »
  supprimé : cohérence garantie, la validation ne porte plus que sur
  « chaque matériel est déclaré » — l'état d'erreur global disparaît) ;
  retour anticipé → `ConfirmModal` (fini le modal artisanal « Bizarre ! ») ;
  colonne de lecture `max-w-3xl` ; `mb-6` résiduel retiré.
- **Lot 4 — fiche figée** : items groupés par type sur `LoanItemReadRow`
  (icône colorée attenuée, « ×N »), même anatomie que le retour read-only.

Grammaire d'icônes actée : pastille colorée = en-têtes de groupe + cards
inventaire ; icône colorée attenuée = rangées de lecture ; pas d'icône =
rangées de sélection (`CatalogItemRow`).

Vérifs : check 0/0 (197 fichiers), tests 358/358
(`/tmp/opencode/tests-loan-ui-3.log`), build OK, autofixer propre sur les
nouveaux composants. Commits : `3bca5989`, `e3c31cb6`, `92f7e05b`,
`44ce7852`. Backlog libellés mis à jour (ordre+icônes réglés, vocabulaire
emprunt restant).

## Itération 5 — la fiche retour fait vérifier (23-10)

Retour utilisateur : la fiche doit **inciter à vérifier**, pas permettre un
« oui oui » expéditif. Ajustements en deux tours de discussion :

- Bouton global « Tout est conforme » **supprimé** (commenté puis retiré) ;
- Le badge « ×N OK » calculé remplacé par un **bouton Ok manuel** dont le
  label « Ok ×N » annonce ce qu'on atteste, recalculé en direct ; toute
  édition d'input décoche ; N = 0 (tout perdu/cassé) → Ok désactivé, les
  valeurs saisies sont la déclaration ; inputs toujours visibles ;
- Trio qty=1 **toggle** (recliquer la valeur active la démarque — sinon Ok
  disabled verrouillerait la rangée perdue) ; même modèle d'état que les
  inputs (`okChecked` + valeurs, plus de champ `state`) ;
- « tout est ok » de groupe passe en **ConfirmModal** (« Vous confirmez
  avoir vérifié qu'il ne manque rien dans le groupe « X » ? » /
  « Non, pas vraiment » / « Oui ») et n'atteste que les non déclarées ;
- Ajustements UI utilisateur : pastille type masquée en mobile sur les
  cards, groupes adoucis `bg-base-200/60`, ×N côté nom, inputs `w-8`,
  grille 2-3 colonnes du figé (+ fix typo `grid-col-s-1`), retrait des
  `badge-sm`/`input-sm` — **convention à discuter et documenter dans
  `docs/`** (à venir).

Vérifs : check 0/0, tests 358/358 (`/tmp/opencode/tests-loan-ui-4.log`),
build OK. Commits : `81d4d649`, `8f661094`.

## Itération 6 — grammaire « Un problème / Ok » (24-10, après le lot granularité)

Le modèle de stock a changé sous la fiche (statut supprimé, `repairQuantity`,
retour qui décrémente les manquants — ADR 0003) ; les libellés « Manquant(s) »
étaient déjà passés. La grammaire actée en discussion s'applique telle quelle :

- au repos, une rangée = deux gestes : « Un problème » (outline warning) et
  « Ok ×N » (atteste le cas nominal), **Ok en bout de lecture** ;
- « Un problème » ouvre un **panneau pleine largeur sous la ligne** (nouveau
  slot `details` de `LoanItemReadRow`) : champs Manquants / À réparer en
  grille 2 colonnes, **bascules** pour une quantité de 1 ;
- **les valeurs font foi** : la rangée est déclarée dès qu'une valeur est
  saisie — pas d'attestation supplémentaire à donner sur une ligne abîmée ;
  « retirer le problème » / « annuler » remet à zéro ;
- lien « **préciser dans les notes** » (visible seulement une valeur saisie)
  : fait défiler jusqu'au champ notes et y place le curseur ; les notes
  restent optionnelles ;
- le trio qty=1 et les inputs toujours visibles disparaissent ; le
  raccourci de groupe ne change pas (ConfirmModal, épargne les problèmes
  déclarés, referme les panneaux ouverts) ;
- débordement mobile réglé par construction : plus aucun cluster fixe dans
  la ligne ;
- **en-tête guide** (`alert alert-soft alert-info`, idiome existant) : la
  grammaire en une ligne avant la liste ; la phrase du bas, devenue
  redondante, se réduit au compteur (« N matériel(s) reste(nt) à
  déclarer »).

Vérifs : check 0/0 (198 fichiers), build OK ; suite complète 382/383 — le
seul échec (`events-store-ensure-event`, cache chaud) est un flake de
pollution inter-fichiers, **vert isolé** (5/5), entrée backlog dédiée
(`backlog/26-10-24_events-ensure-event-flaky.md`). Log
`/tmp/opencode/tests-loan-ui-5.log`.

## Reste (click-through humain)

- Parcours création → dossier → onglet Retour → export .md.
- Parcours modification depuis la liste, garde « modifications non
  sauvegardées » (quitter sans enregistrer).
- Parcours import depuis un événement (modal, `EventMaterielPage`) — doit
  rester inchangé.
- Ancre sticky de la recherche dans la page (prop `stickyTopClass="top-12"`),
  navbar qui se masque au scroll.
- Réservation à date de fin passée : onglet Réservation figé, pas de bouton
  Enregistrer.

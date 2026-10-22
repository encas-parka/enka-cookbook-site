# Run — Page dossier emprunt

> 22-10-2026 · 5 commits sur `mig/pocketbase`, rien poussé.

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

# Spéc — Page dossier emprunt (création / modification / retour)

> Lot livré le 22-10-2026 sur `mig/pocketbase` — commits `73f9036a`, `2e15ea50`, `4f5f46eb`, `db109481`, `5dd620ff`.

## Demande

Revoir l'organisation Matériel / Emprunts / Retour : seule la création
d'emprunt vivait encore dans un modal. Créer une **page** de
création/modification d'emprunt qui permette de **basculer vers la fiche
retour** et son **export Markdown**. Le modal existant ne doit pas être
supprimé. La page ne porte pas les composants du parcours legacy
(`QuickMaterielSelectionModal`, `AutocompleteInput`).

## Organisation cible

| Url | Écran |
| --- | --- |
| `/dashboard/loans/:teamId` | Liste des réservations (inchangée) |
| `/dashboard/loans/:teamId/new` | Création d'une réservation |
| `/dashboard/loans/:teamId/loan/:loanId` | Dossier emprunt : onglets **Réservation** / **Fiche de retour**, export Markdown |
| `/dashboard/loans/return/:loanId` | Url historique → redirection vers l'onglet Retour du dossier |
| `/dashboard/materiel/:teamId` | Inventaire (inchangé) |

- Le modal (`CreateLoanModal`) reste câblé pour le flux **import depuis un
  événement** (`EventMaterielPage`) ; `LoansPage` bascule ses points d'entrée
  (créer, modifier, fiche retour) vers la page.
- La page ne passe jamais `selectionMode: "legacy"` : le chunk legacy n'est
  jamais chargé depuis la page (import dynamique dans le cœur).

## Architecture

- `teamMatos/loan/LoanForm.svelte` — cœur métier sans chrome (dates, événement
  lié, sélection matériel, conflits, submit). API : `submit()` / `reset()` /
  `cancelReservation()` ; bindables `valid` / `busy` / `summary` /
  `existingLoanStatus` / `endDatePast` / `dirty` ; prop `stickyTopClass`
  (ancrage sticky selon l'enveloppe).
- `teamMatos/loan/LoanLegacySelection.svelte` — parcours legacy (autocomplétion
  + ajout rapide), chargé à la demande seulement si `selectionMode: "legacy"`.
- `teamMatos/CreateLoanModal.svelte` — chrome modal autour du cœur.
- `teamMatos/loan/LoanReturnForm.svelte` — fiche de retour sans chrome (état
  par matériel, notes, retour anticipé, export Markdown de la fiche).
- `utils/loan-return-markdown.ts` — export Markdown **de l'état déclaré**
  (pertes/cassures en cours de saisie, pas seulement l'état persisté) + tests.
- `routes/LoanEditPage.svelte` + `routes/LoanEditRoute.svelte` — la page et son
  wrapper `{#key}` (sv-router réutilise le composant entre urls du même motif).

## Décisions notables

- Le garde-fou « date de fin passée » du modal (bouton d'enregistrement masqué,
  matériels figés) est conservé et porté par le cœur (`endDatePast`) ;
  `currentSelection()` retombe sur les items chargés si la liste n'est pas
  montée.
- Après un enregistrement en édition, le formulaire garde ses valeurs et la
  baseline « dirty » est recapturée (le reset d'origine aurait vidé la page et
  re-déclenché le guard de navigation).
- La fiche de retour n'est plus une page : son url historique redirige vers le
  dossier (compat liens/bookmarks).

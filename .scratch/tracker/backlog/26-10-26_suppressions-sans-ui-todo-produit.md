> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: produit · Urgence: conditional · Source: passes click-through 20-10 + run tests composants (lots 4a/6) · Ancre: `eventsStore.deleteTodo()` (`EventsStore.svelte.ts` l.1341, zéro appelant) ; suppression produit : aucun bouton dans l'UI produit (seul l'achat se supprime, soft delete)

# Suppressions sans UI : tâche d'event et produit

**Constat** — deux entités n'ont aucun chemin de suppression dans l'UI, alors
que le store (tâche) ou le métier (produit) le prévoient :

- **Tâche d'event** : `eventsStore.deleteTodo()` existe mais n'est appelé
  nulle part ; aucun bouton dans `EventTodoItem`/`EventTodoModal`. La liste
  ne peut que grossir (le statut « done » est l'unique issue).
- **Produit** : aucun `deleteProduct` ni bouton ; l'édition produit ne couvre
  que la création/édition, l'achat seul se supprime (soft delete
  `status: "deleted"`).

**Impact** — données orphelines accumulées (tâches terminées à jamais,
produits créés par erreur non retirables) ; contrats de store à moitié
câblés, trompeurs pour les maintenants.

**Reco** — décision produit d'abord : faut-il une UI de suppression
(confirm `ConfirmModal`, soft delete côté produit par cohérence avec
l'achat), ou assume-t-on l'absence (retirer alors `deleteTodo` du store) ?
Le run tests composants a épinglé ces absences (clauses restantes des items
§5 et §7 de la checklist click-through) ; toute UI ajoutée devra passer par
l'ADR 0004 (tests composants) avant le click-through.

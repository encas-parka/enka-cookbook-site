> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: tests composants eventMateriel (lot 3, découvert en testant) · Ancre: `svelte-app/src/lib/stores/EventMaterielStore.svelte.ts:627` (`reattachAndCleanup`, re-vérification après `linkToHeader`)

# Course dans `reattachAndCleanup` : la branche « orphelin » est sensible au timing

**Constat** — lors du réattachement d'une allocation vers un autre besoin, la
re-vérification « après le link » (`remainingAllocations`, l.627-629) lit
`#itemsList` (bridge liveQuery asynchrone) immédiatement après l'`await` du
`linkToHeader`. La branche orphelin (suppression de l'ancien besoin à
quantité égale + toast) est donc **sensible au timing** : observée passante
puis non passante sur deux runs du même scénario (mesuré, lot 3). Le test
composant (`EventMaterielModal.test`) n'épingle que le cas déterministe
(quantité différente → survie de l'ancien besoin).

**Impact** — à quantité égale, l'ancien besoin est parfois supprimé, parfois
pas, selon la course bridge/continuation : comportement non déterministe côté
utilisateur (toast fantôme ou besoin résiduel).

**Reco** — attendre explicitement la propagation du bridge avant la
re-vérification (await sur la mise à jour de `#itemsList`, ou relecture
serveur), plutôt que lire le cache asynchrone juste après le link. Puis
ajouter le test de la branche orphelin (quantité égale → ancien besoin
supprimé + toast), aujourd'hui non épinglé pour cette raison.

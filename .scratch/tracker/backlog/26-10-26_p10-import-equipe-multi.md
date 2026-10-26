> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: passe click-through 20-10 (item P10 checklist §6, clause conservée à la réduction du 24-10) · Ancre: import de membres depuis une équipe sur la page matériel d'event (contrôle « Importer depuis {équipe} »)

# « Importer depuis {équipe} » sans effet dès que l'event a ≥ 2 équipes

**Constat** — sur la page matériel d'un event relié à plusieurs équipes, le
contrôle « Importer depuis {équipe} » n'importe rien dès que l'event porte
≥ 2 équipes (repro 20-10, item P10 de la checklist). Avec une seule équipe,
l'import fonctionne — le chemin mono-équipe est probablement présumé par le
code (sélection implicite de la première/unique équipe).

**Impact** — le propriétaire d'un event multi-équipes ne peut pas amorcer son
matériel depuis ses équipes : la fonctionnalité est morte dans le cas où elle
a le plus de valeur. La clause bug bloque le retrait complet de l'item §6 de
la checklist (réduit le 24-10, clause conservée).

**Reco** — qualifier d'abord : retrouver le handler de l'import dans
`EventMaterielPage`/`EventMaterielStore`, vérifier la sélection d'équipe
(source unique vs boucle sur `event.teams`). Puis fix + clause de checklist
retirée après nouvelle passe click-through de la page (deux équipes réelles
en base de test).

# 03: Primitive upsert de la couche de synchronisation

**What to build:** la couche de synchronisation expose l'upsert (créer-ou-mettre-à-jour à id stable) à l'unité et en lot : quand l'appelant ne sait pas si le record existe déjà côté serveur, la primitive décide (mise à jour si présent, création sinon), avec miroir local et annulation optimiste. La documentation décrit le code réel.

**Blocked by:** 01 (contraintes d'id posées).

**Status:** ready-for-agent

- [ ] Upsert de lot disponible (mise à jour si l'id existe, création sinon) + variante groupée + sucre unitaire via lot d'une opération
- [ ] Typage de l'id client sur les créations de lot corrigé (parité avec la création unitaire)
- [ ] Annulation optimiste sur échec (restauration des instantanés, suppression des lignes neuves orphelines)
- [ ] Documentation nettoyée des sections héritées d'un autre projet ; seuls les comportements réels sont décrits
- [ ] Tests traversant la couture (upsert unitaire + lot, miroir local, rollback), suivant le modèle d'intégration du projet frère

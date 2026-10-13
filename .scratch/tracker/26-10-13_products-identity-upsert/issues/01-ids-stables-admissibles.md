# 01: Ids produits stables et admissibles

**What to build:** les ids sémantiques des produits (dérivés du nom et de l'événement) sont acceptés par la base comme ids définitifs, et le nom de produit est requis. Concrètement, créer un produit avec son id calculé fonctionne, y compris avec un achat lié dessus, sans erreur de validation.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Les quatre migrations de contraintes générées via console sont versionnées ensemble (ids : longueur min abaissée, motif élargi au tiret-bas, nom requis)
- [ ] Une sonde prouve qu'une création avec id sémantique passe et qu'une relation d'achat vers cet id est acceptée
- [ ] Le pipeline d'import reste vert (ids déterministes admissibles, nom aligné sur le requis, caractéristiques préservées)
- [ ] Zéro ligne existante violant le requis (vérifié : aucune dans les données actuelles, donc sans backfill)

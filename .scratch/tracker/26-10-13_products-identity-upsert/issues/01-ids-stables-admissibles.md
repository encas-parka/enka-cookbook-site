# 01: Ids produits stables et admissibles

**What to build:** les ids sémantiques des produits (dérivés du nom et de l'événement) sont acceptés par la base comme ids définitifs, et le nom de produit est requis. Concrètement, créer un produit avec son id calculé fonctionne, y compris avec un achat lié dessus, sans erreur de validation.

**Blocked by:** None (can start immediately).

**Status:** done (13-10 — implementer ticket 01, commits d9346b68 + 061cb1cc)

- [x] Les quatre migrations de contraintes générées via console sont versionnées ensemble (ids : longueur min abaissée, motif élargi au tiret-bas, nom requis)
  → Les 4 console (`1791887561`/`1791908969`/`1791910787`/`1791915239`) committées ensemble avec une **5e migration manuelle** portant le nom requis (`1791920000_products_productname_required.js`, seul le flag required change). Le lot console ne portait pas le requis : venu en migration séparée, modèle `1791700000`. Chaîne rejouée verte sur pb_data vierge : 29 migrations, état final `products.id` = min 11 / max 40 / `^[a-z0-9_-]+$` + `productName` required (mesuré sqlite).
- [x] Une sonde prouve qu'une création avec id sémantique passe et qu'une relation d'achat vers cet id est acceptée
  → `scripts_dev/probe-t11-products-semantic-id.ts`, 4/4 verdicts vert (log `/tmp/orchestrate/probe-t11-semantic-id.log`) : create id=`sel_qq9ziy9kpw` → 200 stocké verbatim ; achat `products:[sel_qq9ziy9kpw]` → 200 ; contre-épreuves 400 attendues (id 10 caractères → `validation_min_text_constraint`, productName vide → `validation_required`). Sonde contre instance jetable (copie `.backup` du pb_data, `PB_URL_OVERRIDE` :8091) — le kill du PB du `dev:all` user est refusé sandbox.
- [x] Le pipeline d'import reste vert (ids déterministes admissibles, nom aligné sur le requis, caractéristiques préservées)
  → `3-import-pb.ts --upsert` exit 0 sur la copie (log `/tmp/orchestrate/import-upsert-t11.log`) : products 982 patched / 0 failed, purchases 955 / 0. Ids déterministes hash15 (15 car., `[a-z0-9]`) admissibles sous min 11 ; corpus source n'écrit jamais productName vide. Seul fail : teamdocs −1, écart connu et verdicté (`content > 5000 chars`, préexistant).
- [x] Zéro ligne existante violant le requis (vérifié : aucune dans les données actuelles, donc sans backfill)
  → Mesuré sqlite sur pb_data dev : 0/993 produits à productName vide → pas de backfill.

# T6 — Client : payloads de création conformes (A2 recette-id, C4, B6, A3, C9, B4)

**Sources** : schema-client §4 (A2, A3, B6), §1 (C4, C9, C12), §6 (B4 teamdocs) · bugs connus #3
**Prérequis** : T3 (locks.userName existe — les payloads locks redeviennent valides)

## Objectif

Tous les flux de création passent (recette, produit manuel, loan, teamdoc) : ids et champs conformes au schéma réel.

## Constats → fixes

- **A2** : `routes/RecipeCreatePage.svelte:188-191` pose `recipe.id = generateSlugUuid35(...)` (~35 chars) → 400. `stores/RecipesStore.svelte.ts:625` (`data.id || crypto.randomUUID()`) tout aussi invalide. → **ne jamais poser d'id** : PB génère. Le slug custom disparaît (les recettes importées gardent leurs ids legacy — aucun changement d'URL à craindre sur la branche).
- **C4** : `RecipesStore.svelte.ts:630` : fallback `status: data.status || "active"` → `"private"` (`"active"` ∉ enum public/private/deleted).
- **B6** : `routes/RecipeEditPage.ts:217` (`normalizeRecipeForSave`) renvoie `publishedAt: null` → retirer du normalize, ne setter que lors du publish (trouver le flux publish ; grep `publishedAt`).
- **A3** : `stores/ProductsStore.svelte.ts:1221` : `updatedBy: globalState.userName` → `globalState.userId` (relation→users).
- **C9** : `stores/MaterielStore.svelte.ts:402-419` (`createLoan`) : ajouter `borrowerUser: globalState.userId` (sinon l'emprunteur ne voit pas son loan via les rules `borrowerUser = auth || ownerId.members ~`).
- **B4** : `stores/TeamdocsStore.svelte.ts:194-204` : retirer `createdBy` du payload create (champ **volontairement absent** du schéma — drop explicite 1700000029, décision enveloppe).
- **C12** : PAS de fix — `expand: "members,createdBy"` sur teams redevient valide depuis T3 (createdBy existe ; empty = pas d'expand, sans erreur).

## Méthode suggérée

1. Pour chaque flux, simuler curl le payload EXACT post-fix contre la dev DB → 200 attendus : create recette sans id (status private) ; create produit avec updatedBy=userId ; create loan avec borrowerUser ; create teamdoc sans createdBy.
2. `bun run check` au canon.
3. Écarts `pb.d.ts` documentés en T3 (journal run.md) : corriger les types client concernés par tes changements si nécessaire (mineur, pas de refactor).

## Critères

- [ ] Aucun id custom posé à la création de recette (grep vert sur generateSlugUuid35/`recipe.id =`)
- [ ] Sondes curl des 4 flux créations → 200 (loggées dans run.md)
- [ ] `publishedAt` préservé au save (flux publish identifié et intact)
- [ ] `updatedBy` = userId ; `borrowerUser` set ; teamdoc sans createdBy
- [ ] `bun run check` au canon ; run.md amendé (journal T6)

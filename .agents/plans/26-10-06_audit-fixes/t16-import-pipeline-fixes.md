# T16 — Pipeline d'import : corriger transforms, import, post-traitement, validation

**Sources** : import-pipeline §6 (plan de fix Lots 1, 2, 5) et §4 (mappings dispo) ; synthèse Lot 2
**Prérequis** : aucun backend obligatoire (dry-run des transforms sans PB) — l'exécution du re-import complet est T17

## Objectif

Corriger le défaut de contrat unique de la Phase C : `createdBy`/`permissionWrite`/`rootRecipeId`/`created` vides sur 372 recettes importées. Les fixes sont des scripts (`scripts_dev/`), validables par dry-run.

## Fixes (lots 1, 2, 5 du plan §6)

1. **2b L105** : `created: fm.date || ""` → `fm.createdAt || fm.date || fm.publishDate || ""` (`createdAt` présent 372/372, vraie date ; `date` = timestamp de sync).
2. **2b L117-121** : refIds canoniques — `createdBy`/`permissionWrite` retournent `"aw_" + id` (contrat `refToPb` de 3-import). Ceinture de sécurité : dans 3-import, après import users, alias `refToPb.set(appwriteId, pbId)` sans préfixe. Les deux, documenté.
3. **2b L186-189** : inclure les orphelins en sortie (push après les v2, `rootRecipeId` retiré) — ne jamais dropper silencieusement.
4. **2-transform L543-547** : `updatedBy` résolu par email **OU nom** (lookup name insensible à la casse) — gain 239/261.
5. **3-import** : après création d'une recette à ID forcé, `refToPb.set(record.id, result.id)` (self-map) → les 19 `rootRecipeId` (dirName) se résolvent.
6. **4-fix-timestamps L185** : ne JAMAIS écrire `""` — `if (!created && updated_ts) → UPDATE created = updated_ts` ; normaliser au format PB (`T` → espace, `+00:00` → `Z`).
7. **validate-migration.ts** : contrôles de non-régression PAR CHAMP — compter `createdBy`/`permissionWrite`/`rootRecipeId` non vides attendus depuis `pb-import/recipes.json` et les exiger en DB ; vérifier users attendus (33) vs importés (32 — `public` silencieux) et faire échouer.

## Validation (dry-run, sans écrire en DB)

- 2b sur le contenu `content/recipe/` actuel → inspecter la sortie JSON : `created` peuplé (échantillon + comptage), refIds préfixés `aw_`, 0 orphelin droppé.
- 2-transform : `updatedBy` résolu sur ~239 lignes (comptage sortie).
- 4-fix-timestamps / 3-import / validate : logique relue + testée en unitaire si faisable sans PB ; sinon marquer `[!]` « validation complète = T17 ».
- **Aucune exécution contre pb_data** (ni cleanup, ni import) — T17.

## Notes

- Les numéros de ligne du rapport peuvent avoir dérivé : grep les motifs (`fm.date`, `resolve(`, `""`), ne pas faire confiance aveuglément.
- Images (`img`) : hors périmètre (décision produit Phase 2 — deferred).
- Ne PAS lancer `1-export-appwrite.ts` ici (T17) — mais VÉRIFIER la présence des creds Appwrite dans l'environnement (variables d'env ou config locale — signaler présence/absence dans run.md, JAMAIS les valeurs).

## Critères

- [x] 7 fixes appliqués (grep de preuve par motif)
- [x] Dry-run 2b : `created` peuplé + refIds `aw_` + 0 orphelin droppé (comptages loggés)
- [x] Dry-run 2-transform : comptage `updatedBy` résolus (167/167 des produits importés — l'attendu ~239 comptait l'export entier, voir journal T16)
- [x] validate-migration : contrôles par champ en place (logique) ; creds Appwrite présence/absence signalée
- [x] Aucune écriture DB ; run.md amendé (journal T16)

# PRD: Migration vers une collection unifiée d’ingrédients et stabilisation slug+UUID (version amendée)

## 1. Introduction
Ce document décrit la migration vers une convention de slug immuable combinant le titre et un UUID pour les collections ingrédients et recettes, l’implémentation d’index globaux pour la résolution par slug et UUID, et les adaptations nécessaires des layouts, du CMS sveltia, ainsi que les scripts de migration et de “recanonisation”. Il complète la migration “ingmerged” et consolide les liens internes (y compris événements et alternatives de préparation).

## 2. Objectifs
- Rendre les slugs stables dans le temps grâce à un suffixe UUID, tout en autorisant les changements de titre sans casser la résolution.
- Mettre en place des index globaux (bySlug/byUUID) pour ingrédients et recettes.
- Introduire un fallback de résolution via UUID dans les layouts.
- Aligner la configuration sveltia CMS pour stocker des slugs comme clés de relation et gérer correctement les champs `uuid`.
- Outiller la migration et la “recanonisation” pour garder les références cohérentes même après renommages.

## 3. Périmètre
- Collections ciblées: ingrédients et recettes.
- Layouts Hugo concernés: recettes, événements, exports, et partials de fonctions.
- CMS sveltia: champs `slug`, `uuid`, relations.
- Scripts: migration des recettes vers références par slug+UUID, vérifications CI, et “recanonisation”.

## 4. Plan de migration
### Phase 1 — Préparation
- Introduire la convention de `slug` immuable pour ingrédients et recettes.
- Ajouter un champ `uuid` hidden dans les deux collections (ingrédients: `{{uuid_short}}`; recettes: `{{uuid}}`).
- Mettre à jour les relations dans sveltia CMS pour stocker `slug` comme `value_fields`.
- Créer/mettre à jour les partials d'index globaux (ingrédients et recettes) avec `bySlug` et `byUUID`; ajouter `byAllergen` pour les ingrédients.
- Préparer les snippets de fallback et résolution côté layouts.
- **[TERMINÉ]** Partials d'index créés:
  - `hugo-cookbook-theme/layouts/partials/functions/ingredients-index.html`: index global ingrédients (bySlug, byUUID, byAllergen)
  - `hugo-cookbook-theme/layouts/partials/functions/recettes-index.html`: index global recettes (bySlugRecette, byUUIDRecette)
  - `hugo-cookbook-theme/layouts/partials/functions/extract-uuid-from-slug.html`: helper d'extraction UUID depuis slug

### Phase 2 — Exécution
- Exécuter le script de migration des recettes pour transformer les ingrédients référencés:
  - Ancien modèle (groupé par type et title) -> Nouveau modèle (liste à plat, champ `ingredient` = slug avec UUID).
- Mettre à jour les layouts pour utiliser les index et le fallback UUID via `partialCached`.
- Aligner les exports/JSON et événements pour exposer/consommer `slug` et `uuid`.
- **[PARTIELLEMENT TERMINÉ]** Implémentations réalisées:
  - **[TERMINÉ]** Layout `recettes/list.html`: intégration complète de l'index avec résolution slug+UUID pour tous les types d'ingrédients
  - **[TERMINÉ]** Layout `_default/recettes.html`: résolution ingrédients via index, fallback UUID, alertes allergènes via `byAllergen`
  - **[TERMINÉ]** Partial `ing4recettes.html`: adapté pour recevoir les métadonnées complètes depuis l'index, gestion des allergènes et conversion d'unités
  - **[TERMINÉ]** Partial `ingredients-types-rename-short.html`: déjà aligné sur les types CMS
  - **[TERMINÉ]** Partial `allergenesIng.html`: adapté pour utiliser l'index global des ingrédients
- **[PARTIELLEMENT TERMINÉ]** Layouts à modifier:
  - `hugo-cookbook-theme/layouts/_default/recettes.html`: **[TERMINÉ]** résolution ingrédients via index, fallback UUID, groupement par type, alertes allergènes
  - `hugo-cookbook-theme/layouts/recettes/list.html`: **[TERMINÉ]** filtrages via index (slug+UUID)
  - `hugo-cookbook-theme/layouts/evenements/single.html`: basculer références title→slug, fallback UUID
  - `hugo-cookbook-theme/layouts/evenements/single.ingredients.html`: source de vérité via slug, affichage meta indexée
  - `hugo-cookbook-theme/layouts/evenements/single.json.json`: exporter slug+uuid+title (a refléchir plus tard)

### Phase 3 — Validation
- Lancer la CI de cohérence:
  - Vérification des références ingrédients/recettes via `bySlug` puis fallback `byUUID`.
  - Rapport des références non résolues (mode strict).
- Exécuter la “recanonisation” sur un échantillon, puis globalement si OK.
- Valider manuellement quelques pages (recettes, événements) avec anciennes et nouvelles références.

## 5. Spécifications techniques
### 5.1 Convention slug immuable (ingrédients et recettes)
- Ingrédients:
  - slug: `{{title}}_{{field.uuid}}`
  - fields: `uuid` (hidden, default: `{{uuid_short}}`)
  - Relations recettes vers ingrédients: `value_fields: ["slug"]` pour stocker le slug complet.
- Recettes:
  - slug: `{{title}}_{{field.uuid}}`
  - path: `{{slug}}/index`
  - fields: `uuid` (hidden, default: `{{uuid}}`)
  - Tous les liens internes (ex: `prepAlt`, événements) utilisent ce slug.
- Principe: le titre peut changer sans casser la résolution, grâce au suffixe UUID. La résolution utilisera d’abord `bySlug`, puis fallback `byUUID`.

### 5.2 Index globaux et fallback UUID
- Partial `functions/ingredients-index.html` (utiliser `partialCached`):
  - bySlug: slug → meta { page, slug, uuid, title, type, allergenes, … }
  - byUUID: uuid → meta
  - byAllergen: allergene → [slug]
  - **[TERMINÉ]** Implémenté, retourne dict structuré { bySlug, byUUID, byAllergen }
- Partial `functions/recettes-index.html` (nouveau):
  - bySlugRecette: slug → page/meta
  - byUUIDRecette: uuid → page/meta
  - **[TERMINÉ]** Implémenté, retourne dict structuré { bySlugRecette, byUUIDRecette }
- Helper `functions/extract-uuid-from-slug.html`:
  - Extrait UUID depuis slug (après dernier “_”)
  - **[TERMINÉ]** Implémenté, utilisé pour fallback UUID
- Résolution standard:
  - Ingrédient référencé dans une recette:
    - d’abord `bySlug[slug]`
    - sinon extraire `uuid` (après le dernier “_”), chercher `byUUID[uuid]`
  - Recette référencée (prepAlt, événements):
    - d’abord `bySlugRecette[slug]`
    - sinon extraire `uuid`, chercher `byUUIDRecette[uuid]`

### 5.3 Modèle de données cible (ingrédients)
- types: `frais, legumes, lof, sucres, epices, sec, animaux, autres`
- allergenes: liste standardisée CMS exacte:
  - `Produit laitier, Gluten, Crustacé, Oeuf, Poisson, Viande, Porc, Arachides, Soja, Fruits à coque, Céleri, Moutarde, Sésame, Sulfites, Lupin, Mollusque`
- saisons: `[printemps, ete, automne, hiver]`
- `pFrais`, `pSurgel`: booléens
- slug: `{{title}}_{{field.uuid}}`
- uuid: hidden (`{{uuid_short}}`)

### 5.4 Modèle de données cible (recettes)
- slug: `{{title}}_{{field.uuid}}`
- uuid: hidden (`{{uuid}}`)
- Relations:
  - Le champ relation “all ing file” doit stocker les slugs d’ingrédients: `value_fields: ["slug"]`.
  - Si d’autres relations vers recettes existent (ex: `prepAlt`), configurer pour stocker le slug (et prévoir fallback UUID dans la résolution côté layouts).

### 5.5 Index globale des ingrédients (partial recommandé)
- Implémenter `bySlug`, `byUUID`, `byAllergen` comme décrit ci-dessus.
- Utiliser `partialCached` pour éviter les recomputations.

### 5.6 Groupement par type côté template
- S’appuyer sur l’index ingrédients pour grouper par type, alimenter les affichages listant des ingrédients par type.

### 5.7 Alertes allergènes par recette
- Utiliser `byAllergen` et/ou `meta.allergenes` depuis `ingredients-index`.
- Lors du rendu d’une recette, consolider les allergènes à partir de ses ingrédients résolus.

## 6. Modifications des layouts et partials (impacts réels)
- `hugo-cookbook-theme/layouts/_default/recettes.html`:
  - Utiliser `partialCached "functions/ingredients-index.html" .` pour charger l'index.
  - Résolution des ingrédients par slug, fallback UUID via `extract-uuid-from-slug.html`.
  - Groupement par type via meta résolue, alertes allergènes via `byAllergen`.
  - **[TERMINÉ]** Layout adapté pour consommer l'index avec résolution complète et gestion d'erreurs.
- `hugo-cookbook-theme/layouts/recettes/list.html`:
  - Filtrages par type ou catégories en résolvant via l'index (slug+UUID).
  - **[TERMINÉ]** Index intégré dans la logique de filtrage avec fallback UUID pour tous les types d'ingrédients.
- `hugo-cookbook-theme/layouts/evenements/single.html`:
  - Si des références à des recettes/ingrédients se font par `title`, basculer sur `slug`; ajouter fallback UUID pour compatibilité.
  - **[À FAIRE]** Détecter et migrer les références legacy.
- `hugo-cookbook-theme/layouts/evenements/single.ingredients.html`:
  - Table/JS: source de vérité via slug; afficher `title/type/allergenes` depuis meta indexée.
  - **[À FAIRE]** Aligner la source de données sur l’index.
- `hugo-cookbook-theme/layouts/evenements/single.json.json`:
  - Exporter `slug` et `uuid` pour stabilité, en plus de `title`.
  - **[À FAIRE]** Ajouter les champs slug/uuid dans l’export JSON.
- Partials:
  - `functions/ingredients-index.html`: **[TERMINÉ]** ajouter `byUUID`, `byAllergen`.
  - `functions/recettes-index.html`: **[TERMINÉ]** créer `bySlugRecette`/`byUUIDRecette`.
  - `functions/extract-uuid-from-slug.html`: **[TERMINÉ]** helper pour fallback UUID.
  - `functions/ing4recettes.html`: **[TERMINÉ]** adapté pour accepter meta complet depuis l'index, avec gestion des allergènes et conversion d'unités.
  - `functions/ingredients-types-rename-short.html`: **[TERMINÉ]** déjà aligné sur types CMS.
  - `functions/allergenesIng.html`: **[À FAIRE]** remplacer/adapter vers l'index global.

## 7. Configuration Sveltia CMS (fork de decap cms)
- Ingrédients:
  - slug: `{{title}}_{{field.uuid}}`
  - Champ `uuid`: `widget: hidden`, `default: "{{uuid_short}}"`
  - Listes contrôlées: `types`, `allergenes`, `saisons`
- Recettes:
  - slug: `{{title}}_{{field.uuid}}`
  - path: `{{slug}}/index`
  - Champ `uuid`: `widget: hidden`, `default: "{{uuid}}"`
  - Relations:
    - Recette → Ingrédients: `value_fields: ["slug"]`
    - Recette → Recette (si applicable, ex: `prepAlt`): `value_fields: ["slug"]`
- Impacts “événements”:
  - Les événements référencent des recettes/ingrédients via slug.
  - S’assurer que les widgets relationnels ou champs texte stockent bien les slugs, et que le fallback UUID est géré côté Hugo.

## 8. Scripts de migration
### 8.1 Correction de clés legacy
- Si besoin, corriger la clé “allergenes” dans les fichiers d’ingrédients pour correspondre à la liste standardisée.

### 8.2 Migration atomique des recettes (Python ≥ 3.10)
- Indexer les ingrédients depuis `content/ingredients`:
  - map “title normalisé” → ensemble de slugs possibles (pour migration initiale).
  - map `slug` → `uuid`.
- Transformation:
  - Ancien: groupé par type et title.
  - Nouveau: liste à plat:
    - `ingredients: [ { ingredient: "<slug-ingredient-avec-uuid>", quantite, unit, commentaire } ]`
- Validation:
  - Résolution stricte avec arrêt si introuvable; log détaillé.
- Rapport:
  - Fichiers modifiés, entrées introuvables, collisions.
- Post-migration:
  - Script de “recanonisation” des slugs ingrédients dans les recettes:
    - Si un titre d’ingrédient a changé, extraire l’UUID du slug stocké en recette, retrouver le slug canonique actuel, et le remplacer.

## 9. Exemples concrets (snippets Hugo)
- Index ingrédients:
  - Voir snippet “Index ingrédients” fourni (bySlug, byUUID, byAllergen).
- Index recettes:
  - Voir snippet “Index recettes” fourni (bySlug, byUUID).
- Résolution d’un ingrédient dans `recettes.html`:
  - Voir snippet “Résolution d’un ingrédient dans recettes.html”.

## 10. Tests et validation
- Unitaires de templates: tester la résolution via slug et fallback UUID.
- Tests de bout en bout: navigation entre recettes, événements avec références mixtes.
- Validation manuelle: affichage d’allergènes et groupements par type.

## 11. Risques et mitigations
- Références legacy par `title` non résolues: détectées par CI, migration/“recanonisation” en sortie.
- Collisions de titres: l’UUID évite toute ambiguïté.
- Performance: usage de `partialCached` pour les index.

## 12. Checklist d'exécution
- Mettre à jour la config Sveltia CMS (slug/uuid/relations).
- **[TERMINÉ]** Déployer les partials d'index et helper extract-uuid.
- **[PARTIELLEMENT TERMINÉ]** Déployer les layouts avec fallback UUID et intégration des index:
  - **[TERMINÉ]** Layouts recettes (list et single)
  - **[TERMINÉ]** Partial ing4recettes adapté
  - **[TERMINÉ]** Partial allergenesIng.html adapté
  - **[À FAIRE]** Layouts événements (single, single.ingredients) - adaptés mais non testables
  - **[A VOIR PLUS TARD]** Layout événements single.json.json - créé
- Lancer le script de migration des recettes.
- Lancer les vérifications CI.
- Lancer la "recanonisation" si nécessaire.
- Revue manuelle et validation.

## 14. État actuel et contraintes

### 14.1 Contrainte technique majeure
Les layouts et partials ont été adaptés pour utiliser la résolution par slug+UUID avec fallback, **mais le contenu des recettes et ingrédients n'a pas encore été migré**. Par conséquent:

- Les layouts recettes (`list.html` et `_default/recettes.html`) ne peuvent pas fonctionner correctement car les ingrédients référencés dans les recettes utilisent encore l'ancien format (titre au lieu de slug+UUID)
- Les layouts événements (`single.html` et `single.ingredients.html`) ont été adaptés mais ne peuvent pas être testés tant que les recettes ne sont pas migrées
- Les index globaux fonctionnent mais retournent des données incomplètes ou incohérentes

### 14.2 Prérequis pour la validation
Avant de pouvoir valider les layouts adaptés, il est impératif de:
1. **Migrer le contenu des ingrédients** pour ajouter le champ `uuid` avec `{{uuid_short}}`
2. **Migrer le contenu des recettes** pour:
   - Ajouter le champ `uuid` avec `{{uuid}}`
   - Transformer les références d'ingrédients du format groupé par type vers le format plat avec slugs
3. **Mettre à jour la configuration sveltia CMS** pour générer les slugs avec UUID

### 14.3 Prochaines étapes prioritaires
1. Développer et exécuter le script de migration du contenu
2. Mettre à jour la configuration sveltia CMS
3. Une fois le contenu migré, tester et valider les layouts
4. Procéder à la recanonisation si nécessaire

## 13. Annexes
### 13.1 Snippets d’index et de fallback
- Index ingrédients (bySlug/byUUID/byAllergen)
- Index recettes (bySlug/byUUID)
- Résolution d’ingrédients dans recettes (fallback UUID)

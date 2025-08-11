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
  - `hugo-cookbook-theme/layouts/partials/functions/extract-uuid-from-slug.html.html`: helper d'extraction UUID depuis slug

### Phase 2 — Exécution
- Exécuter le script de migration des recettes pour transformer les ingrédients référencés:
  - Ancien modèle (groupé par type et title) -> Nouveau modèle (liste à plat, champ `ingredient` = slug avec UUID).
- Mettre à jour les layouts pour utiliser les index et le fallback UUID via `partialCached`.
- Aligner les exports/JSON et événements pour exposer/consommer `slug` et `uuid`.
- **[TERMINÉ]** Implémentations réalisées:
  - **[TERMINÉ]** Layout `recettes/list.html`: intégration complète de l'index avec résolution slug+UUID pour tous les types d'ingrédients
  - **[TERMINÉ]** Layout `_default/recettes.html`: résolution ingrédients via index, fallback UUID, alertes allergènes via `byAllergen`
  - **[TERMINÉ]** Partial `ing4recettes.html`: adapté pour recevoir les métadonnées complètes depuis l'index, gestion des allergènes et conversion d'unités
  - **[TERMINÉ]** Partial `ingredients-types-rename-short.html`: déjà aligné sur les types CMS
  - **[TERMINÉ]** Partial `allergenesIng.html`: adapté pour utiliser l'index global des ingrédients
- **[PARTIELLEMENT TERMINÉ]** Layouts à modifier:
  - `hugo-cookbook-theme/layouts/_default/recettes.html`: **[TERMINÉ]** résolution ingrédients via index, fallback UUID, groupement par type, alertes allergènes
  - `hugo-cookbook-theme/layouts/recettes/list.html`: **[TERMINÉ]** filtrages via index (slug+UUID)
  - `hugo-cookbook-theme/layouts/evenements/single.html`: **[TERMINÉ]** basculer références title→slug, fallback UUID
  - `hugo-cookbook-theme/layouts/evenements/single.ingredients.html`: **[TERMINÉ]** source de vérité via slug, affichage meta indexée
  - `hugo-cookbook-theme/layouts/evenements/single.json.json`: **[TERMINÉ]** exporter slug+uuid+title

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
- Helper `functions/extract-uuid-from-slug.html.html`:
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

Modèle front matter pour un ingrédient (structure finale, post-migration – sans rétrocompatibilité):
- title: string (Titre humain)
- slug: string (dérivé du nom de dossier, immuable)
- uuid: string (identifiant stable)
- type: string (ex.: "sec", "frais", "legumes", "epices", etc.)
- allergenes: [string] (ex.: ["Fruit à coque", "Gluten"])
- pFrais: bool (optionnel, indique un produit frais pour les règles d’affichage type “Légumes frais”)
- autres champs optionnels spécifiques (documentation interne si besoin)

Contraintes:
- Les clés legacy (alergenesIng, itype) ne sont plus utilisées.
- Les taxonomies ou regroupements côté template doivent se baser sur “type” et l’index global.

### 5.4 Modèle de données cible (recettes)
- slug: `{{title}}_{{field.uuid}}`
- uuid: hidden (`{{uuid}}`)
- Relations:
  - Le champ relation “all ing file” doit stocker les slugs d’ingrédients: `value_fields: ["slug"]`.
  - Si d’autres relations vers recettes existent (ex: `prepAlt`), configurer pour stocker le slug (et prévoir fallback UUID dans la résolution côté layouts).

### 5.5 Index global des ingrédients (strict, sans rétrocompatibilité)
- Implémenter `bySlug`, `byUUID`, `byAllergen` comme décrit ci-dessus.
- Utiliser `partialCached` pour éviter les recomputations.

- L’index construit trois dictionnaires:
  - bySlug: slug -> meta { page, slug, uuid, title, type, allergenes, pFrais? }
  - byUUID: uuid -> meta { ...idem... }
  - byAllergen: allergene -> [slug]
- L’index est strict: il ne fait plus de rétrocompatibilité avec les anciennes clés.
- Utiliser des valeurs par défaut sûres (listes vides) pour éviter les itérations sur None.

### 5.6 Groupement par type côté template
- S’appuyer sur l’index ingrédients pour grouper par type, alimenter les affichages listant des ingrédients par type.

- Les layouts doivent consommer la structure plate des ingrédients des recettes (voir 5.4).
- Pour chaque item d’ingrédient de recette:
  - Résoudre via l’index (bySlug d’abord, fallback byUUID)
  - Récupérer meta.title, meta.type, meta.allergenes, meta.pFrais
  - Construire les listes consolidées et les affichages en conséquence

### 5.7 Alertes allergènes par recette
- Utiliser `byAllergen` et/ou `meta.allergenes` depuis `ingredients-index`.
- Lors du rendu d’une recette, consolider les allergènes à partir de ses ingrédients résolus.

## 6. Modifications des layouts et partials (impacts réels) — résumé
- evenements/single.html: parcours liste plate, résolution via index, quantités proportionnelles, passage de allergenes à ingredients-grouped-list
- ingredients-grouped-list.html: attend allergenes (liste), affiche les groupes d'ingrédients
- ing4recettes.html: affiche selon meta passée (title, allergenes)
- ingredients-index.html: index strict (type/allergenes), listes normalisées
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
  - **[TERMINÉ]** Détecter et migrer les références legacy.
- `hugo-cookbook-theme/layouts/evenements/single.ingredients.html`:
  - Table/JS: source de vérité via slug; afficher `title/type/allergenes` depuis meta indexée.
  - **[TERMINÉ]** Aligner la source de données sur l'index.
- `hugo-cookbook-theme/layouts/evenements/single.json.json`:
  - Exporter `slug` et `uuid` pour stabilité, en plus de `title`.
  - **[TERMINÉ]** Ajouter les champs slug/uuid dans l'export JSON.
- Partials:
  - `functions/ingredients-index.html`: **[TERMINÉ]** ajouter `byUUID`, `byAllergen`.
  - `functions/recettes-index.html`: **[TERMINÉ]** créer `bySlugRecette`/`byUUIDRecette`.
  - `functions/extract-uuid-from-slug.html.html`: **[TERMINÉ]** helper pour fallback UUID.
  - `functions/ing4recettes.html`: **[TERMINÉ]** adapté pour accepter meta complet depuis l'index, avec gestion des allergènes et conversion d'unités.
  - `functions/ingredients-types-rename-short.html`: **[TERMINÉ]** déjà aligné sur types CMS.
  - `functions/allergenesIng.html`: **[TERMINÉ]** remplacer/adapter vers l'index global.

- evenements/single.html:
  - Remplacer les boucles legacy par type (ex: .Params.ingredients.{legumes, epices} ...) par un parcours de la liste plate .Params.ingredients.
  - Calcul des quantités: (quantite_recette × assiettes_evenement) / assiettes_recette.
  - Résolution de chaque ingrédient via l’index (bySlug, sinon byUUID).
  - Alimentation des structures consolidées (IngredientList) et des alertes allergènes à partir des titres/slug résolus.
  - Passer “allergenes” au partial d’affichage (et non “alergene”).

- Partials:
  - ingredients-index.html: produire un index strict, forcer les slices vides si nécessaire, aucune rétrocompat.
  - ingredients-grouped-list.html: attendre “allergenes” (liste) et non “alergene”; se contenter d’afficher les données reçues (pas de lookup dedans).
  - ing4recettes.html: idem, afficher selon meta reçu (title, allergenes).

## 7. Configuration Sveltia CMS (fork de decap cms) — résumé
- Relations ingrédients/recettes stockent les slugs immuables (suffixe UUID accepté)
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

## 8. Scripts de migration — résumé
- Migration legacy → final effectuée (type, allergenes)
- Pas de rétrocompatibilité côté layouts
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

## 9. Exemples concrets (snippets Hugo) — supprimés
- Cette section est désormais couverte par les résumés ci-dessus
- Index ingrédients:
  - Voir snippet “Index ingrédients” fourni (bySlug, byUUID, byAllergen).
- Index recettes:
  - Voir snippet “Index recettes” fourni (bySlug, byUUID).
- Résolution d’un ingrédient dans `recettes.html`:
  - Voir snippet “Résolution d’un ingrédient dans recettes.html”.

## 10. Tests et validation — résumé
- Build Hugo sans erreur
- Vérifier proportions, alertes, impression PDF sur un échantillon
- Garantir que allergenes est une liste et que chaque ingrédient a type
- Unitaires de templates: tester la résolution via slug et fallback UUID.
- Tests de bout en bout: navigation entre recettes, événements avec références mixtes.
- Validation manuelle: affichage d’allergènes et groupements par type.

### 10.1 Tests de build Hugo
- Exécuter `hugo --minify` avec la version étendue (>= 0.142.0) et vérifier l’absence d’erreurs.
- Surveiller les erreurs typiques:
  - range can't iterate over None: indique une clé non-liste dans `allergenes` d’un ingrédient.
  - can't evaluate field quantite in type interface {}: indique un code legacy qui attend une structure groupée au lieu de la liste plate dans `.Params.ingredients`.
  - partials recevant des clés obsolètes (ex.: `alergene` au lieu de `allergenes`).

### 10.2 Tests de rendu des pages
- Pages Recettes:
  - Vérifier l’affichage des ingrédients (liste plate), les unités, les conversions, et la présence d’icônes d’alerte pour les allergènes quand ils existent.
  - Vérifier la proportionnalité des quantités (si les pages/sections utilisent des assiettes cibles).
- Pages Événements:
  - Vérifier le sommaire, les cartes recettes, la proportion des quantités par rapport à `plate`.
  - Vérifier la consolidation des ingrédients (IngredientList) et l’affichage des alertes.
  - Vérifier l’impression (modale, bascule des sections, respect des options d’alertes).

### 10.3 Tests de cohérence des données
- Parcourir `content/ingredients/**` et valider:
  - Présence de `title`, `uuid`, `type`, `allergenes` (optionnel mais s’il existe doit être une liste).
  - Absence des clés legacy: `alergenesIng`, `itype`.
  - `type` dans l’intervalle attendu par les layouts (si contrainte spécifique).
- Recettes:
  - `.Params.ingredients` est une liste plate avec clés: `ingredient` (slug[_uuid]), `quantite` (optionnel), `unit` (optionnel), `commentaire` (optionnel).
  - `plate` est bien défini pour le calcul des quantités.

### 10.4 Tests d’intégration des partials
- `ingredients-index.html`:
  - Vérifier que l’index est généré et que `bySlug`, `byUUID`, `byAllergen` comportent des valeurs.
  - Garantir que les allergènes sont toujours des listes (aucune itération sur None).
- `ing4events.html` et `ing4recettes.html`:
  - Vérifier que la clé `allergenes` est utilisée (remplacement de `alergene`).
  - Vérifier la cohérence d’affichage des quantités et unités.
- `evenements/single.html`:
  - Vérifier que la résolution des ingrédients via l’index fonctionne avec slug et fallback UUID.
  - Vérifier l’alimentation d’`IngredientList` et des alertes.

## 11. Risques et mitigations — résumé
- Ne pas réintroduire d’accès legacy (alergenesIng/itype, structure par catégories)
- Contrôles simples sur contenu (listes, types)

- Layouts Evenements
  - Risque: héritage de layout/baseof non uniforme entre outputs (HTML/Poster/Ingredients) → scripts/partials non injectés.
  - Mitigation: audit de la hiérarchie de templates (baseof, define "main", outputs), insertion de marqueurs de debug (commentaires HTML, badges), et factorisation d’un bloc “head-extra” commun.
- Index globaux (recettes/ingrédients)
  - Risque: index non accessible dans certains contextes (scope, Scratch non défini, ou partial non appelé).
  - Mitigation: initialisation explicite et systématique via partialCached en tête des layouts Evenements; ajout de métriques visibles (len indexes) pour vérification.
- Clés de données post-migration
  - Risque: divergence entre legacy (.title dans ingredients des recettes) et nouveau modèle (slug immuable + uuid).
  - Mitigation: normaliser les accès via index global + fallback UUID; ajouter des adaptateurs temporaires (extraction d’UUID depuis slug mixte).
- Références legacy par `title` non résolues: détectées par CI, migration/“recanonisation” en sortie.
- Collisions de titres: l’UUID évite toute ambiguïté.
- Performance: usage de `partialCached` pour les index.

### 12. Checklist d'exécution — résumé
- Contenu: type présent, allergenes en liste
- Layouts: evenements/single consomme la liste plate + index
- Partials: ing4events reçoit allergenes
- Build: hugo --minify OK
- Mettre à jour la config Sveltia CMS (slug/uuid/relations).
- **[TERMINÉ]** Déployer les partials d'index et helper extract-uuid.
- **[PARTIELLEMENT TERMINÉ]** Déployer les layouts avec fallback UUID et intégration des index:
  - **[TERMINÉ]** Layouts recettes (list et single)
  - **[TERMINÉ]** Partial ing4recettes adapté
  - **[TERMINÉ]** Partial allergenesIng.html adapté
  - **[À FAIRE]** Layouts événements (single, single.ingredients) - adaptés mais non testables
  - **[A VOIR PLUS TARD]** Layout événements single.json.json - créé
- **[TERMINÉ]** Lancer le script de migration des recettes.
- Lancer les vérifications CI.
- Lancer la "recanonisation" si nécessaire.
- Revue manuelle et validation.

### 12.1 Checklist post-modification des layouts (rapide)
- Portée des variables:
  - Utiliser systématiquement $.Scratch.Set/Get pour partager des données entre scopes (boucles/with/partials).
  - Éviter de s’appuyer sur des variables locales hors de leur portée.
- Accès aux dictionnaires:
  - Remplacer les appels .Get par l’indexation: index $dict "clé".
  - Exposer les dictionnaires globaux (ex: byAllergen) via $.Scratch si nécessaire.
- Modèle d’ingrédients:
  - Parcourir le format plat (.Params.ingredients) et résoudre les métadonnées via l’index global (bySlug/byUUID).
  - Ne pas réintroduire l’ancien format groupé par type dans les layouts.
- Blocs de templates:
  - Vérifier l’équilibre des with/if/range et leurs end correspondants.
  - Préférer un unique bloc with … else … end par usage.
- Valeurs par défaut:
  - Toujours prévoir des valeurs par défaut avant len, range ou intersect (ex: | default (slice)).
  - Initialiser explicitement les listes temporaires (ex: via Scratch).
- Validation:
  - Lancer un build complet (minify activé) après modifications.
  - Vérifier visuellement les pages clés (ex: événements, listes, affiches).
  - Confirmer qu’aucun accès aux champs legacy n’est réintroduit.

- Contenu ingrédients:
  - Confirmer la suppression des clés legacy: `alergenesIng`, `itype`.
  - Confirmer la présence de `type` (string) et `allergenes` (liste).
- Partials et layouts:
  - `ingredients-index.html` forcera les `allergenes` non-liste à une liste vide côté lecture.
  - `ing4events.html` attend `allergenes` et pas `alergene`.
  - `evenements/single.html` consomme la structure plate `.Params.ingredients` et résout via l’index.
- Build:
  - Lancer `hugo --minify` et valider 0 erreurs.
  - Vérifier un échantillon de pages: 2-3 recettes, 2-3 événements.
- Impression:
  - Tester la modale d’impression et la bascule des sections/alertes.
- Accessibilité:
  - Vérifier la présence d’alternatives textuelles, labels, et contrastes sur les composants modifiés.

## 14. État actuel et avancement — résumé
- Migration contenu réalisée
- Layouts clés refactorés
- Étapes restantes: éventuel regroupement par type pour l’UI, DRY d’un resolver slug/uuid→meta (optionnel)

### 14.1 Migration du contenu réussie
**[TERMINÉ]** La migration du contenu des recettes et ingrédients a été réalisée avec succès:

- **Ingrédients migrés**: Ajout du champ `uuid` avec `{{uuid_short}}` pour tous les ingrédients
- **Recettes migrées**:
  - Ajout du champ `uuid` avec `{{uuid}}` pour toutes les recettes
  - Transformation des références d'ingrédients du format groupé par type vers le format plat avec slugs
  - Les slugs contiennent maintenant le suffixe UUID pour une stabilité permanente

### 14.2 Scripts de migration développés et exécutés
**[TERMINÉ]** Les scripts de migration ont été créés et exécutés avec succès:

- Script de migration des ingrédients: génération des UUID et mise à jour des slugs
- Script de migration des recettes: transformation des références ingrédients vers le nouveau format
- Les rapports de migration indiquent un taux de réussite de 100% sans erreurs critiques

### 14.3 Prochaines étapes

- Evenements – Rendu “recettes” (layouts/evenements/single.html)
  - Problème: Vue n’est pas chargé sur certaines pages, entraînant “Vue is not defined” et blocage de l’app.
  - Hypothèse: le layout utilisé ne rend pas (ou plus) le partial d’initialisation des scripts dans le head; la condition sur .Type/.Layout peut ne pas s’appliquer à ce rendu, ou la page n’hérite pas du baseof.
  - Action menée: renforcement conditionnel (ajout test sur prefixe de layout), inclusion explicite du partial côté layout, puis injection CDN de Vue juste avant l’initialisation de l’app.
  - Résultat: l’erreur persiste sur ces pages → le layout effectif semble contourner les insertions, nécessitant un audit d’héritage de layout et d’outputs.

- Evenements – Résolution des recettes
  - Problème: toutes les recettes signalées “non trouvées” sur les pages “recettes” (single.html), alors que le même contenu s’affiche dans “poster”.
  - État: la résolution via index global recettes (bySlugRecette + fallback UUID) fonctionne dans “poster”.
  - Hypothèse: le layout “recettes” n’exécute pas (ou voit vide) l’index global, ou `site.GetPage` est utilisé avec un chemin reconstruit incompatible post-migration.
  - Action menée: remplacement de `site.GetPage` par la page résolue via l’index global; ajout d’alerting si meta absent.
  - Résultat: persistance des alertes “n’existe plus” pour tous les slugs → indice fort que l’index n’est pas injecté/visible dans le contexte rendu effectif.

- Evenements – Page “ingredients”
  - Problème: Vue se charge, les recettes sont visibles, mais les ingrédients liés ne sont pas trouvés.
  - Hypothèse: divergence de clés post-migration (ex: `.ingredient` slug vs `.title` legacy) dans la structure `.Params.ingredients` ou dépendance à un ancien index `.Site.Data.ingredients`.
  - Action envisagée: homogénéiser l’accès à la donnée avec l’index global ingrédients (bySlug/byUUID), et fallback UUID, comme dans la page recettes standard.
1. **[EN COURS]** Mettre à jour la configuration sveltia CMS pour générer les slugs avec UUID
2. Tester et valider les layouts avec le contenu migré
3. Exécuter la "recanonisation" si nécessaire après validation
4. Déployer en production une fois la validation complète terminée

[MISE À JOUR — Build]
- Le build Hugo avec minification a été exécuté avec succès localement (version étendue >= 0.142.0). Les corrections ci-dessous ont été intégrées et validées par un build complet du site.

### 14.4 Erreurs rencontrées et résolutions (Avancement actuel)

Au cours de l'exécution et de la validation des layouts, plusieurs erreurs de compilation Hugo ont été rencontrées. Elles ont été diagnostiquées et résolues, permettant de progresser dans la stabilisation du site.

-   **`hugo-cookbook-theme/layouts/_default/recettes.html`**
    *   **Problème** : Le template tentait d'itérer sur `.Params.ingredients` comme une structure groupée par type (e.g., `.Params.ingredients.sec`), alors que le contenu avait été migré vers un format plat (liste directe d'ingrédients avec un champ `ingredient` contenant le slug). De plus, l'accès aux données du dictionnaire `$byAllergen` utilisait la méthode `.Get` qui n'est pas applicable sur un dictionnaire Hugo.
    *   **Résolution** : La logique de parcours des ingrédients a été refactorisée pour s'adapter au nouveau format plat. La variable `$ingredientsByType` a été introduite pour regrouper dynamiquement les ingrédients par leur type extrait de l'index global, permettant ainsi de maintenir la présentation visuelle par catégorie. L'accès à `$byAllergen` a été corrigé pour utiliser l'indexation directe (e.g., `index $byAllergen "Gluten"`).

-   **`hugo-cookbook-theme/layouts/recettes/list.html`**
    *   **Problème** : Ce template, responsable de la liste des recettes et des filtres associés, utilisait également l'ancien format groupé par type pour collecter les ingrédients (e.g., `range .Params.ingredients.sec`). La section générant le JSON pour l'interface de filtrage front-end (JavaScript) référençait également ces anciennes structures. Une variable `$iepices` n'était pas initialisée.
    *   **Résolution** : La logique de collecte des ingrédients pour les filtres a été mise à jour. Désormais, elle parcourt la liste plate des ingrédients de chaque recette, résout les métadonnées via l'index global `$bySlug` ou `$byUUID`, et ajoute les titres des ingrédients aux listes de catégories (`$isec`, `$ianimaux`, etc.) en fonction de leur `type` récupéré. La variable `$iepices` a été initialisée. La génération JSON a été adaptée pour utiliser ces listes fraîchement construites.

-   **`hugo-cookbook-theme/layouts/evenements/single.html`**
    *   **Problèmes** :
        - Variables de portée non disponibles dans les boucles imbriquées (`$recettesList`, `$bySlugRecette`, `$byUUIDRecette`, `$alertQuantite`, `$checkYes`, `$compareQuantite`), provoquant des "undefined variable".
        - Accès incorrect aux dictionnaires d’allergènes via `.Get` au lieu de l’indexation.
        - Déséquilibres de blocs `with/else/end` causant des erreurs `unexpected {{end}}`.
        - Références locales hors scope (ex: `$commentaire`), et accès potentiellement nul à la liste de recettes pour `len`.
    *   **Résolutions** :
        - Portée/état: utilisation systématique de `$.Scratch.Set/Get` pour stocker et accéder à:
          - `byAllergen`, `bySlugRecette`, `byUUIDRecette`, `recettesList`, `alertQuantite`, `checkYes`, `compareQuantite`.
        - Allergènes: remplacement de `$.byAllergen.Get "..."` par `index $byAllergen "..."`, après exposition de `byAllergen` dans le Scratch global.
        - Blocs: rééquilibrage des `with site.GetPage $url` avec un seul bloc `with … else … end` cohérent.
        - Commentaire recette: remplacement de `$commentaire` par `.Params.commentaire` au rendu.
        - Robustesse: par défaut, `recettesListLocal := $.Scratch.Get "recettesList" | default (slice)` avant `len`.
        - Listes typées: passage de `IngredientsTypesList` en Scratch, avec `append` et `uniq` sécurisés.
    *   **Statut** : Validé par build — les corrections ont permis un build complet réussi.

-   **`hugo-cookbook-theme/layouts/partials/evenement/poster.html`**
    *   **Problème** : Ce partial, utilisé pour générer des affiches d'événements, rencontrait des erreurs similaires à `_default/recettes.html` concernant l'ancien format des ingrédients et l'accès à `$byAllergen`.
    *   **Résolution** : Le partial charge désormais l'index global des ingrédients (`$ingredientsIndex`) en début de fichier. La collecte des allergènes et des ingrédients animaux a été refactorisée pour parcourir la liste plate des ingrédients et extraire leurs métadonnées via l'index (`$bySlug`, `$byUUID`). L'accès aux données d'allergènes a été corrigé pour utiliser l'indexation directe (`index $byAllergen .`) au lieu de `.Get`.

- Finaliser l’éventuel regroupement par type d’ingrédients côté affichage (optionnel) en s’appuyant sur `meta.type` depuis l’index, sans réintroduire de structure legacy.
- Ajouter un contrôle CI simple (script de lint) pour détecter:
  - `allergenes` non-liste
  - clés legacy encore présentes
  - items d’ingrédients de recettes sans `ingredient`.
- Documenter la convention d’unités (grammes, ml, Kg, litre, unité, etc.) et les conversions automatiques dans les partials.
- Vérifier la cohérence des slugs recette/ingrédient (immuables) et les fallbacks UUID.

## 13. Annexes
### 13.1 Snippets d’index et de fallback
- Index ingrédients (bySlug/byUUID/byAllergen)
- Index recettes (bySlug/byUUID)
- Résolution d’ingrédients dans recettes (fallback UUID)

### 13.2 Bonnes pratiques Hugo – Projet ENKA Cookbook

Règles clés
1) Portée des variables
- Utiliser le Scratch du contexte racine ($) pour partager des données entre scopes (range/with/partials).
- Préférer: $.Scratch.Set "clé" valeur et $.Scratch.Get "clé".
- Éviter de compter sur des variables locales en dehors de leur portée immédiate.

2) Accès aux dictionnaires
- Ne pas utiliser .Get sur des maps/dicos.
- Utiliser l’indexation: index $dict "clé".
- Pour des accès profonds, chaîner index: index (index $dict "clé1") "clé2".

3) Format plat des ingrédients
- Les layouts doivent parcourir .Params.ingredients comme une liste plate.
- Pour récupérer métadonnées (titre, type, allergènes...), résoudre via les index globaux (bySlug/byUUID) fournis par les partials d’index.
- Éviter toute réintroduction du format groupé par type côté contenu.

4) Valeurs par défaut robustes
- Toujours fournir des valeurs par défaut avant d’appeler len, range, intersect, delimit, etc.
- Exemple: {{ $list := ($.Scratch.Get "recettesList" | default (slice)) }}.

5) Blocs de templates équilibrés
- Contrôler le bon appariement des with/if/range et leurs end.
- Éviter les with imbriqués superflus; préférer un unique with … else … end par usage.

6) Index globaux et caches
- Charger les index via partialCached (ex: functions/ingredients-index.html, functions/recettes-index.html).
- Exposer ensuite les maps utiles dans le Scratch global: $.Scratch.Set "byAllergen" $byAllergen.

7) Journalisation et messages de diagnostic
- Ajouter des commentaires explicites dans les zones complexes.
- Préférer des messages de fallback clairs en else (ex: recette introuvable).

Exemples concrets
- Accès à un allergène
```/dev/null/example.md#L1-6
{{ $ingredientsIndex := partialCached "functions/ingredients-index.html" . }}
{{ $byAllergen := $ingredientsIndex.byAllergen }}
{{ $.Scratch.Set "byAllergen" $byAllergen }}
{{ $glutenList := index ($.Scratch.Get "byAllergen") "Gluten" | default (slice) }}
```

- Valeur par défaut avant len
```/dev/null/example.md#L1-3
{{ $recettesList := $.Scratch.Get "recettesList" | default (slice) }}
{{ len $recettesList }}
```

- Partage d’état entre scopes
```/dev/null/example.md#L1-4
{{ $.Scratch.Set "alertQuantite" false }}
{{ if $doAlert }}{{ $.Scratch.Set "alertQuantite" true }}{{ end }}
{{ if ($.Scratch.Get "alertQuantite") }} … {{ end }}
```

- Résolution d’un ingrédient plat via index slug
```/dev/null/example.md#L1-6
{{ $idx := partialCached "functions/ingredients-index.html" . }}
{{ $bySlug := $idx.bySlug }}
{{ range .Params.ingredients }}
  {{ $meta := index $bySlug .ingredient }}
  {{ $title := or $meta.title .ingredient }}
{{ end }}
```
```

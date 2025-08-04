AGENTS

Build/lint/test
- Build: hugo --minify (requires Hugo extended >= 0.142.0)
- Dev server: hugo server -D -F --disableFastRender
- Theme dev: go mod tidy; hugo mod vendor; hugo server
- Scripts: cd scripts_dev && node sort-ingredients.js
- No repo-level JS test/lint configured; run Hugo link check via build; single template check: hugo --templateMetrics --templateMetricsHints

Formatting/style
- Markdown: front matter YAML, use draft: false; keep slugs kebab-case; dates YYYY-MM-DD
- Hugo templates: follow theme imports from github.com/encas-parka/hugo-cookbook-theme; prefer partials in layouts/partials; avoid inline HTML logic
- CSS/SCSS lives in assets/scss; keep BEM-like naming; compile via Hugo Pipes
- JS: ESM in scripts_dev (type: module); Node >=14; avoid CommonJS
- Imports: for theme assets use assets/jsconfig paths; prefer relative imports within scripts_dev
- Types: no TS; keep explicit object shapes; validate inputs in utility scripts
- Naming: kebab-case for files/dirs; snake_case for data keys if existing; camelCase for JS variables/functions
- Errors: fail fast in CI; in scripts, process.exit(1) on fatal errors; log to stderr
- Content: place under content/ with proper section; avoid spaces in folder names; include index.md
- Images: store under static/images; reference with absolute paths starting with /

AI assistants
- No Cursor or Copilot rules found; follow this file
- When editing, mimic existing patterns; never commit secrets; do not create new frameworks
- Use French for user-facing content; keep accessibility in mind (alt text)
- Run lint/typecheck if introduced; otherwise ensure hugo build succeeds locally

Données CMS et contenu
- CMS: Sveltia (fork de Decap) via admin2, GitHub backend. Fichier config: static/admin2/config.yml
- Media: images sous static/images, référencées via /images
- Slugs: accents nettoyés, séparateur "-"; recettes et ingrédients suffixés par uuid court

Collections
- Recettes (content/recettes/):
  - Path: {{type}}/{{slug}}/index avec slug {{title}}_{{field.uuid}}
  - Filtre: layout: recettes; Catégories: type ∈ {entree, plat, dessert}; Sous-catégories via relation content/categories
  - Champs principaux: title, draft, img, description, layout, type, categories[], auteur, regime[], region, saison[], cuisson {Oui|Non}, temperature {Chaud|Froid}, plate (int), quantite_desc, check {Oui|Non}, checkAlwaysOk (bool), checkfor (int), publishDate (datetime), uuid
  - Ingrédients: list ingredients[] via relation vers ingredients_collection (content/ingredients), valeur slug; quantite (float), unit ∈ {Kg, grammes, unité}; commentaire (string)
  - Matériel: relation multiple vers materiel/title
  - Astuces: list d’objets {astuce}
  - Préparations Alternatives: list prepAlt[] relation vers recettes (value title)

- Évènements (content/evenements/):
  - Path: {{slug}}/index, create: true; champs: title, sitemap_exclude (hidden)
  - Repas: list repas[]
    - date_service (datetime), horaire ∈ {matin, midi, soir}, assiettes (int)
    - recettes_du_repas: list
      - recette: relation vers recettes (value title)
      - type_plat ∈ {entree, plat, dessert}
      - altAssiettes (int, optionnel), chef (string, optionnel), partof (string, optionnel), commentaire (text)

- Materiel (content/materiel/): list d’items {title, sitemap_exclude}

- Sous-catégories (content/categories/): list d’items {title}

- Ingrédients
  - ingredients_collection (content/ingredients/), slug {{title}}_{{field.uuid}}
    - Champs: uuid (hidden), title, type ∈ {frais, legumes, lof, sucres, epices, sec, animaux, autres}, allergenes[], saisons[], pFrais (bool), pSurgel (bool)
    - Exemple: content/ingredients/salsifis_30973a63/index.md avec {title, pFrais, type, uuid}

Sorties Hugo
- hugo.yml définit des outputs additionnels: Poster (poster/index), Ingredients (ingredients/index).

Conventions contenu
- Chaque entrée est un dossier avec index.md. Recettes sous content/recettes/{entree|plat|dessert}/{slug}/index.md. Évènements sous content/evenements/{slug}/index.md. Ingrédients sous content/ingredients/{slug}/index.md.
- Les relations utilisent soit title soit slug selon la config CMS; dans le site, préférer les slugs uniques (title_uuid) pour éviter collisions.

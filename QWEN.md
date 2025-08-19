QWEN

# Enka Cookbook Project Overview

This documentation provides context for the Enka Cookbook project, which consists of three main components:

1. **enka-cookbook-site** - The main Hugo-based website for sharing recipes and organizing events
2. **hugo-cookbook-theme** - A custom Hugo theme for community solidarity canteen recipe websites
3. **enka-auth** - Authentication services built with Node.js for Appwrite integration

## Project Structure

### 1. enka-cookbook-site
This is the main website that uses the hugo-cookbook-theme. It's a Hugo static site generator project configured for Netlify deployment.

Key files:
- `hugo.yml` - Main Hugo configuration file
- `netlify.toml` - Netlify deployment configuration
- `go.mod` - Go module dependencies (Hugo modules)
- `package.json` - Node.js dependencies (for CMS and content processing)

### 2. hugo-cookbook-theme
This is a custom Hugo theme based on Hyas, with Bootstrap 5 and Vue.js 2. It provides the frontend functionality for recipe sharing and event organization.

Key files:
- `hugo.yml` - Theme configuration
- `netlify.toml` - Example deployment configuration
- `go.mod` - Go module dependencies
- `package.json` - Development dependencies (prettier)
- `assets/` - Frontend assets (SCSS, JS, images, fonts)
- `layouts/` - Hugo templates
- `content/` - Example content

### 3. enka-auth
This is a Node.js service that provides authentication functionality for the website using Appwrite. It includes several modules:

Key files:
- `src/main.js` - Main authentication service (Sveltia CMS integration)
- `campaign/index.js` - Campaign-based user registration
- `invite/src/index.js` - Team invitation functionality
- `demande-acces/index.js` - Access request handling with email notifications
- `package.json` - Node.js dependencies (node-appwrite)

## Technology Stack

### Frontend
- **Hugo** - Static site generator
- **Bootstrap 5** - CSS framework
- **Vue.js 3** - JavaScript framework for interactive components
- **SCSS** - CSS preprocessor

### Backend/Services
- **Appwrite** - Backend-as-a-Service for authentication and database
- **Node.js** - Runtime for serverless functions
- **Cloudflare** - Hosting and deployment platform
- **Sveltia CMS** - Content management system (flork of Decap / Netlify CMS). Config file in `enka-cookbook-site/static/sveltia/config.yml`

### Development Tools
- **Go** - Required for Hugo modules
- **Bun** - JavaScript package manager (lock file present)
- **Prettier** - Code formatting

## Key Features

### Recipe Sharing
- Search functionality for recipes
- Filtering by categories, special diets, ingredients
- Quantity calculation based on number of servings

### Event Organization
- Menu creation for multi-day events
- Ingredient aggregation across recipes
- Printable/PDF export functionality optimized for kitchen use
- Fresh food tracking with customizable time intervals

### Authentication & Access Control
- User registration via campaigns
- Team-based access control
- Invitation system
- Access request workflow with admin notifications

## Development Workflow

### Site Development
1. Make changes to content in the `content/` directory
2. Customize styling in the `assets/scss/` directory
3. Modify layouts in the `layouts/` directory
4. Test locally with `hugo server`
5. Deploy to Cloudflare (automated on git push)

### Theme Development
1. Make changes in the theme directory
2. Test with the example site: `cd exampleSite && hugo server --themesDir ../..`
3. Update version in `go.mod` for consumption by sites

### Authentication Service Development
1. Modify functions in the respective directories
2. Deploy to Appwrite as functions
3. Configure environment variables in Appwrite dashboard

## Configuration

### Environment Variables (Appwrite Functions)
- `APPWRITE_FUNCTION_ENDPOINT` - Appwrite instance URL
- `APPWRITE_FUNCTION_PROJECT_ID` - Project ID
- `APPWRITE_API_KEY` - API key with appropriate permissions
- `GITHUB_PAT` - GitHub Personal Access Token for CMS
- `ADMIN_TEAM_ID` - Team ID for admin users
- `APP_URL` - Application URL for link generation

### Hugo Configuration
The main configuration is in `hugo.yml` which includes:
- Site metadata (title, description)
- Module imports (theme)
- Output formats (HTML, JSON, etc.)
- SEO settings
- Image processing configuration

## Deployment

### Netlify
The site is configured for Netlify deployment with:
- Build command: `hugo --gc --minify --buildFuture`
- Publish directory: `public`
- Hugo version: 0.142.0

### Appwrite
Authentication functions are deployed as Appwrite functions with appropriate environment variables configured in the dashboard.

## License
All components are distributed under the GPL-3.0 license. By publishing recipes on this site, you agree that they inherit this license.

## Conversation
Exprime toi en francais avec l'utilisateur.

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
  - Astuces: list d'objets {astuce}
  - Préparations Alternatives: list prepAlt[] relation vers recettes (value title)

- Évènements (content/evenements/):
  - Path: {{slug}}/index, create: true; champs: title, sitemap_exclude (hidden)
  - Repas: list repas[]
    - date_service (datetime), horaire ∈ {matin, midi, soir}, assiettes (int)
    - recettes_du_repas: list
      - recette: relation vers recettes (value title)
      - type_plat ∈ {entree, plat, dessert}
      - altAssiettes (int, optionnel), chef (string, optionnel), partof (string, optionnel), commentaire (text)

- Materiel (content/materiel/): list d'items {title, sitemap_exclude}

- Sous-catégories (content/categories/): list d'items {title}

- Ingrédients
  - ingredients_collection (content/ingredients/), slug {{title}}_{{field.uuid}}
    - Champs: uuid (hidden), title, type ∈ {frais, legumes, lof, sucres, epices, sec, animaux, autres}, allergenes[], saisons[], pFrais (bool), pSurgel (bool)
    - Exemple: content/ingredients/salsifis_30973a63/index.md avec {title, pFrais, type, uuid}

Sorties Hugo
- hugo.yml définit des outputs additionnels: Poster (poster/index), Ingredients (ingredients/index).

Conventions contenu
- Chaque entrée est un dossier avec index.md. Recettes sous content/recettes/{entree|plat|dessert}/{slug}/index.md. Évènements sous content/evenements/{slug}/index.md. Ingrédients sous content/ingredients/{slug}/index.md.
- Les relations utilisent soit title soit slug selon la config CMS; dans le site, préférer les slugs uniques (title_uuid) pour éviter collisions.

Authentification Appwrite
- Service d'authentification: Appwrite (cloud.appwrite.io) avec Project ID: 689725820024e81781b7
- Page de connexion: /login avec formulaire email/mot de passe et gestion de session
- Fonctions Appwrite existantes:
  * cms-auth-function (ID: 68976500002eb5c6ee4f): génère token CMS pour utilisateurs authentifiés
  * send-access-request (ID: 689cdea5001a4d74549d): envoie emails de demande d'accès aux admins
  * invite: gestion des invitations et création de memberships d'équipe
- Stockage local: localStorage pour 'sveltia-cms.user', 'appwrite-user-email', 'is-authenticated'
- SDK: Appwrite Web SDK chargé via CDN sur page /login; node-appwrite pour fonctions serveur
- Flux: Connexion Appwrite → Vérification session → Appel fonction cms-auth → Stockage token CMS → Accès Sveltia CMS
- Page d'inscription: /registration
- Pages liées: /accept-invitation (traitement invitations), /invitation (création invitations)
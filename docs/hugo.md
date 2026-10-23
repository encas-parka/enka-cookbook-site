# hugo

> **ARCHIVÉ (16-10)** — la toolchain Hugo est supprimée du worktree (étape A du plan `5b_csr-hosting-option-a.md`). L'app ne lit plus rien de Hugo au runtime. Ce document ne reste utile que pour deux choses vivantes : les **sources de migration** `content/` + `static/data/` (inputs du pipeline jusqu'au cutover, gate `--content-synced`) et l'historique des formats.

Scope: rôle de Hugo en Phase 1 — génération des recettes, de l'API JSON et des assets consommés par la SPA.
Maintenance: mettre à jour au retrait de Hugo (Phase 2, SvelteKit) ; d'ici là, tout changement de formats/content doit être répercuté ici.
**Legacy** : Hugo est appelé à disparaître en Phase 2 — voir `.agents/plans/4_routing-sveltekit.md`.

## Ce que Hugo fait encore en Phase 1

- Sert la SPA (`static/app/`) et le contenu statique (images, icônes, `static/data/`).
- Source de vérité des **recettes** (456 markdown) — la convergence recettes Hugo ↔ PB est vérifiée par le pipeline (`recipe-convergence`, cf. `.agents/plans/6_migration-evaluation.md` § 4). Gate `--content-synced` avant tout import.
- Génère l'API JSON consommée par la SPA **en dev via le proxy Vite** (les données vivantes viennent de PocketBase, pas de Hugo).

## Config (`hugo.yml`)

- `disableKinds` : taxonomy, term, section, 404 (la SPA gère tout le routing ; le 404 est désactivé pour le mode SPA Cloudflare Pages).
- Outputs : `home` → `dataJson` (`/data/data.json`), `page` → `RecipeDetail` (`/recipe/*/recipe.json`) + HTML.

## Contenu

- `content/recipe/<slug>_<uuid>/index.md` — frontmatter : `title`, `draft`, `typeR`, `categories`, `auteur`, `ingredients[]` (uuid + quantités), `yield`.
- Ne pas éditer le contenu Hugo pendant un run pipeline : fetch/merge d'abord (sinon verdicts `recipe-convergence` stale au check).

## Outils

- `hugo server -D` (port 1313) ; pour les fichiers HTML de `layouts/`, le parser `go-template` (+ `prettier-plugin-go-template`) n'est plus installé dans ce repo — il reste documenté côté `enka-cookbook-site` (Hugo y est actif).

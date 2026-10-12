# hugo

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

- `hugo server -D` (port 1313) ; prettier avec parser `go-template` (+ `prettier-plugin-go-template`) pour les fichiers HTML de `layouts/`.

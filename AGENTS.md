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
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Multiple CLAUDE.md Files

This project contains **two CLAUDE.md files** for different contexts:

1. **`/CLAUDE.md`** (this file) - Project-wide guidance for the Hugo site + Svelte app integration
2. **`svelte-app/CLAUDE.md`** - Detailed Svelte app architecture and development

**How Claude Code selects which file to read:**
- Working directory = project root → reads this file
- Working directory = `svelte-app/` → reads `svelte-app/CLAUDE.md`

**Recommendation**: When starting Svelte app work, explicitly reference:
> "Read svelte-app/CLAUDE.md for Svelte-specific architecture"

## Project Overview

ENKA-COOKBOOK is a collaborative recipe and event management platform for community solidarity canteens. It uses a **hybrid architecture** combining a static Hugo site with a dynamic Svelte 5 SPA, backed by Appwrite for database, authentication, and real-time features.

**Key characteristic**: Hugo generates JSON data APIs consumed by the Svelte app, enabling static performance with dynamic collaboration features.

## Development Commands

### Hugo Site (project root)

```bash
hugo                    # Build static site
hugo server -D          # Start development server (default: http://localhost:1313)
```

### Svelte App (svelte-app/)

**IMPORTANT**: The `cd` command is not persistent in shell sessions. Always use full paths:

```bash
# Development (run from svelte-app directory)
cd svelte-app && bun run dev

# Or navigate first, then run
cd svelte-app/
bun run dev             # Start Vite dev server with Hugo proxy
bun run build           # Build for production (outputs to ../static/app/)
bun run preview         # Preview production build
bun run check           # Type checking (svelte-check + TypeScript)
```

### Code Quality

```bash
# From project root (Hugo theme formatting)
npx prettier --check "**/*.{html,md,css,js,scss}"
npx prettier --write "**/*.{html,md,css,js,scss}"

# From svelte-app/ (Svelte app formatting)
npx prettier --check "**/*.{svelte,ts,js,css}"
npx prettier --write "**/*.{svelte,ts,js,css}"
```

## Architecture Overview

### Hybrid Pattern: Hugo + Svelte SPA + Appwrite

```
┌─────────────────────────────────────────────────────────────┐
│                    Markdown Content                         │
│  • Recipes (content/recettes/)                              │
│  • Events (content/evenements/)                             │
└─────────────────▲───────────────────────────────────────────┘
                   │ Hugo Processing
┌─────────────────▼───────────────────────────────────────────┐
│                      Hugo Engine                            │
│  • Generates JSON API (/api/data.json)                      │
│  • Recipe detail JSON (/recettes/*/recipe.json)             │
│  • Static assets (images, icons)                            │
└─────────────────▲───────────────────────────────────────────┘
                   │ Vite Proxy (dev) or Static (prod)
┌─────────────────▼───────────────────────────────────────────┐
│                   Svelte 5 SPA                              │
│  • Consumes Hugo JSON via proxy                             │
│  • Appwrite integration for auth/realtime/collaboration     │
│  • IndexedDB caching for offline-first                      │
└─────────────────▲───────────────────────────────────────────┘
                   │ Appwrite SDK
┌─────────────────▼───────────────────────────────────────────┐
│                   Appwrite Backend                          │
│  • Databases (products, recipes, events, teams)             │
│  • Authentication & Teams                                   │
│  • Realtime subscriptions                                   │
│  • Cloud Functions (batch operations)                       │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Static Site**: Hugo with custom theme in `layouts/`
- **Frontend**: Svelte 5 with TypeScript, Vite build system
- **Styling**: Tailwind CSS v4 with DaisyUI components
- **Backend**: Appwrite (database, auth, realtime, functions)
- **Icons**: SVG sprite system (see `static/icons/sprite.svg`)

### Data Flow

1. **Content creation**: Recipes/events as Markdown with YAML frontmatter
2. **Hugo processing**: Generates JSON data at build time
3. **Svelte consumption**: SPA fetches JSON via Vite proxy (dev) or static paths (prod)
4. **Appwrite sync**: Real-time collaboration features via Appwrite SDK

## Directory Structure

```
enka-cookbook-site/           # Hugo site root (this repository)
├── content/
│   ├── recettes/             # Recipe pages (Markdown with frontmatter)
│   └── evenements/           # Event pages
├── layouts/                  # Hugo templates
├── static/
│   ├── app/                  # Built Svelte app (from svelte-app build)
│   ├── data/                 # JSON data exports
│   └── icons/                # SVG sprite
├── svelte-app/               # Svelte 5 application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── router/       # sv-router configuration (routes, guards, navigation)
│   │   │   ├── stores/       # Svelte stores (state management)
│   │   │   ├── services/     # Appwrite service layers
│   │   │   ├── models/       # Reactive data models
│   │   │   └── utils/        # Utilities
│   │   └── routes/           # Page components
│   ├── vite.config.ts        # Vite config with Hugo proxy
│   └── package.json
├── hugo.yml                  # Hugo configuration
├── go.mod / go.sum           # Hugo module dependencies
└── CLAUDE.md                 # This file
```

## Hugo Configuration

### Custom Output Formats

Hugo generates two JSON outputs:

1. **`/api/data.json`** - Complete data export for the Svelte app
   - Contains all recipes, events, metadata
   - Used for initial app load

2. **`/recettes/*/recipe.json`** - Per-recipe detail JSON
   - Generated via custom `RecipeDetail` output format
   - Used for lazy loading recipe details

### Disabled Kinds

The following Hugo kinds are disabled (SPA handles routing):

```yaml
disableKinds:
  - taxonomy
  - term
  - section
  - 404  # SPA handles all routing
```

## Key Architecture Patterns

### Svelte 5 Router (sv-router)

The application uses **sv-router** for client-side hash-based routing:

- **Routes definition**: `svelte-app/src/lib/router/routes.ts`
- **Route guards**: `svelte-app/src/lib/router/guards.ts` (authGuard, eventGuard)
- **Public routes**: `/`, `/recipe`, `/recipe/:uuid`
- **Private routes**: `/dashboard/*`, `/recipe/my/*` (require auth)
- **Event routes**: `/event/:id/*` (mode-agnostic: demo or normal)

See `svelte-app/CLAUDE.md` for complete routing documentation.

### Store Pattern (3-Layer Architecture)

The Svelte app follows a reactive 3-layer pattern:

1. **Service Layer** (`src/lib/services/appwrite-*.ts`): Pure CRUD functions
2. **Store Layer** (`src/lib/stores/*.svelte.ts`): State management with SvelteMap
3. **Model Layer** (`src/lib/models/*.svelte.ts`): Reactive wrappers

**Store initialization** follows a 3-phase pattern:

1. `loadCache()` - Load from IndexedDB (fast UI)
2. `syncFromRemote()` - Sync from Appwrite/Hugo
3. `setupRealtime()` - Subscribe to live updates

**Central realtime multiplexing**: All stores register channels with `RealtimeManager` for a single WebSocket connection.

### Content Structure

**Recipes**: Each recipe is a directory with UUID-based naming:

```
content/recettes/recipe-name_uuid/
└── index.md
```

**Recipe frontmatter** includes:

- `title`, `draft`, `typeR`, `categories`, `auteur`
- `ingredients`: Array with UUID references, normalized quantities, types
- `yield`: Portions info

## Important Conventions

### Hugo Theme Development

- **No hardcoded content paths**: Theme must work as standalone module
- **Hugo pipelines**: Use for asset minification and fingerprinting
- **Go template modules**: Prefer over JavaScript when possible
- **Parser**: `go-template` for HTML files with Prettier

### Svelte 5 Development

- **Reactive runes**: Use `$state`, `$derived`, `$props`
- **Stores as singletons**: Import and use directly
- **Reactive access**: Always use `$derived()` for store data
- **IndexedDB caching**: Automatic - stores handle persistence
- **Auth required**: Check `globalState.isAuthenticated` for writes

### Vite Dev Server Proxy

During development, Vite proxies these paths to Hugo:

- `/recettes/*` → Hugo recipe pages
- `/api/*` → Hugo JSON API
- `/data/*` → Hugo static data
- `/icons/*` → Hugo icons
- `/images/*` → Hugo images

This allows the Svelte app to consume Hugo-generated data during development.

### Code Style

- **Naming**: kebab-case for files/partials, snake_case for YAML data
- **JavaScript**: ES5/ES6 (Hugo) or TypeScript (Svelte)
- **CSS**: Tailwind v4 + DaisyUI, follow Bootstrap 5 patterns
- **Hugo templates**: Limit logic in templates, use partials/blocks

## Local/Demo Mode

The application supports **local event mode** for demo/testing without authentication:

- Events with `status="local"` can be accessed via `/event/:id` routes
- Protected by `eventGuard` which initializes store in public mode
- Allows full event editing without being logged in
- Data stored in IndexedDB only (no Appwrite sync)

See `svelte-app/docs/local-mode.md` for complete documentation.

## Specialized Features

- **Print optimization**: Kitchen-optimized layouts for recipes
- **Batch operations**: Cloud Functions for large operations
- **Offline-first**: IndexedDB with automatic sync
- **Event management**: Multi-day events with ingredient consolidation
- **Real-time collaboration**: Single WebSocket multiplexed subscriptions
- **Team documents**: Collaborative document editing
- **Material management**: Equipment tracking and loans

## Related Documentation

**For Svelte app development**, always reference `svelte-app/CLAUDE.md` for:

- Complete store architecture and patterns
- Routing configuration with sv-router
- UI component conventions
- Appwrite integration patterns
- Error handling and debugging

**Project-wide documentation**:

- `svelte-app/docs/local-mode.md` - Local/demo event mode
- `svelte-app/docs/demo-events-generator.md` - Creating demo events
- `svelte-app/src/lib/services/README.md` - Service layer architecture

## Important Notes

- **Hugo generates JSON, not HTML**: The SPA handles all rendering
- **Vite proxy required in dev**: Must run both Hugo and Vite servers
- **Build order**: `cd svelte-app && bun run build` → outputs to `static/app/`
- **Auth is Appwrite-only**: Hugo has no authentication, handled by SPA
- **Realtime is multiplexed**: All stores share a single WebSocket
- **IndexedDB is automatic**: Stores handle cache persistence transparently

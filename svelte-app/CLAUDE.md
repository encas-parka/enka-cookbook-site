# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `bun run dev` - Start development server with Vite HMR and Hugo proxy
- `bun run build` - Build for production (outputs to `../static/app/`)
- `bun run check` - Run type checking (svelte-check + TypeScript)

### Code Quality

```bash
# Format with Prettier (includes Svelte and Tailwind plugins)
npx prettier --write "**/*.{svelte,ts,js,css}"
npx prettier --check "**/*.{svelte,ts,js,css}"
```

### Type Safety

- Uses Svelte 5 with TypeScript
- Type checking includes both app code (`tsconfig.app.json`) and Node/tooling (`tsconfig.node.json`)
- Appwrite types are auto-generated in `src/lib/types/appwrite.d.ts`
- Path aliases: `@/*` → `./src/*`, `$lib/*` → `./src/lib/*`

## Routing with sv-router

The application uses **sv-router** for client-side path-based routing (no hash). The `<Router>` component in `App.svelte` is used without `base="#"`, so URLs are clean paths like `/recipe/123` instead of `#/recipe/123`.

In development, Vite proxies non-JSON requests under `/recipe/*` to `/index.html` (SPA fallback), allowing the client-side router to handle all navigation. In production, the app is served under `/app/` and the hosting layer must redirect unknown paths to `/app/index.html`.

### Basic Navigation

```typescript
import { navigate, route, p } from "$lib/router";

// Programmatic navigation
navigate("/event/123");

// Get current route info
route.pathname; // Current path
route.params.id; // Route params
route.search.tab; // Query params

// Generate links
p("/recipe", "123"); // Returns '/recipe/123'
```

### Query Params with searchParams

```typescript
import { searchParams } from "$lib/router";

// Read
const tab = searchParams.get("tab");

// Write (updates URL reactively)
searchParams.set("tab", "info");
searchParams.delete("tab");

// Reactive listening
$effect(() => {
  console.log("Tab changed:", searchParams.get("tab"));
});
```

### Route Guards

Routes are protected with guards in `src/lib/router/guards.ts`:

- `authGuard` - Requires authentication, redirects to `/` if not logged in
- `eventGuard` - Initializes eventsStore in normal or public mode (demo)

### Route Configuration

All routes are defined in `src/lib/router/routes.ts`:

- **Public routes** (no auth): `/`, `/recipe`, `/recipe/:uuid`, `/verify-email`
- **Private routes** (authGuard): `/dashboard/*`, `/recipe/my/*`, `/recipe/new`, `/eventList`
- **Event routes** (eventGuard): `/event/:id/*` - works for both normal and demo events
- **Route 404**: `(*)` catch-all at the end

## Architecture Overview

### Tech Stack

- **Frontend**: Svelte 5 with reactive runes (`$state`, `$props`, `$derived`)
- **Build**: Vite with @sveltejs/vite-plugin-svelte
- **Styling**: Tailwind CSS v4 with DaisyUI components
- **Backend**: Appwrite (database, authentication, realtime)
- **Persistence**: Dexie (IndexedDB) via aw-sync layer for offline-first
- **Icons**: Lucide Svelte (`@lucide/svelte` - NOT `lucide-svelte`)
- **Markdown**: TipTap editor for rich text editing
- **Serialization**: SuperJSON for complex data structures

### Core Architecture Pattern: 3-Layer Reactive

```
┌─────────────────────────────────────────────────────────────┐
│                 Appwrite Backend                           │
│  • Database, Auth, Realtime, Cloud Functions               │
└─────────────────▲───────────────────────────────────────────┘
                   │ Raw data access
┌─────────────────▼───────────────────────────────────────────┐
│              Service Layer (appwrite-*.ts)                 │
│  • Pure CRUD functions                                      │
│  • Stateless data transformations                           │
│  • Realtime subscription management                         │
└─────────────────▲───────────────────────────────────────────┘
                   │ aw-sync: initialFetch / subscribe / CRUD
┌─────────────────▼───────────────────────────────────────────┐
│              Dexie / IndexedDB (aw-sync layer)              │
│  • Offline-first local persistence                          │
│  • Delta sync (cursor-based) + realtime WebSocket → Dexie   │
│  • Optimistic writes with automatic rollback                │
└─────────────────▲───────────────────────────────────────────┘
                   │ liveQuery → bridgeToMap
┌─────────────────▼───────────────────────────────────────────┐
│                  Store Layer (stores/*.svelte.ts)          │
│  • SvelteMap<string, Model> for O(1) access                │
│  • Reactive filtering with $derived.by()                    │
│  • Business logic & calculations                           │
└─────────────────▲───────────────────────────────────────────┘
                   │ Per-entity modal state
┌─────────────────▼───────────────────────────────────────────┐
│           Modal/State Factories (*ModalState.svelte.ts)    │
│  • Local forms for specific entity management              │
│  • Orchestration of Appwrite calls                         │
│  • Loading/error UI states with toast notifications        │
└─────────────────▲───────────────────────────────────────────┘
                   │ Cloud Functions (Batch Ops)
┌─────────────────▼───────────────────────────────────────────┐
│              appwrite-transaction.ts                       │
│  • Batch operations (Group Purchase)                        │
│  • Cloud Function execution with retry logic                │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Concepts

**1. aw-sync: Offline-First Sync Layer**

The `db-sync/` module provides the bridge between Appwrite (remote) and Svelte stores (UI):

```
Appwrite (remote)
  ↕  initialFetch() — delta sync (cursor-based, 500/page)
  ↕  subscribe()    — realtime WebSocket → Dexie put/delete
Dexie / IndexedDB (local)
  ↕  liveQuery()    — reactive, re-fires on table changes
SvelteMap (bridgeToMap) — incremental fine-grained updates
  ↕  $derived.by()  — enrichment / filters / sort
UI Components       — read-only from stores
```

- **`createSyncCollection()`** — Full CRUD + delta sync + realtime for a Dexie table
- **`bridgeToMap()`** — Connects a Dexie liveQuery to a SvelteMap for fine-grained reactivity
- **`bridgeToMapFiltered()`** — Scoped variant (e.g. by eventId)
- **`useLiveQuery()`** — Svelte 5 component hook for one-off Dexie queries
- **Entry point**: `import { createSyncCollection, bridgeToMap, db } from '$lib/db-sync/aw-sync'`

**2. Stores (Singleton Pattern)**

All major stores are singleton classes with Svelte 5 reactive runes:

- **ProductsStore** - Products with `ProductModel` instances
- **RecipesStore** - Recipe index with lazy loading details
- **EventsStore** - Events CRUD + participants + todos
- **GlobalState** - Auth, UI state, toasts, modals
- **DateRangeStore** - Date range selection logic
- **RealtimeManager** - Centralized WebSocket multiplexing
- **MaterielStore** - Equipment/material management
- **TeamdocsStore** - Team documents management
- **NativeTeamsStore** - Native teams from Appwrite
- **NotificationStore** - User notifications
- **NavBarStore** - Navigation bar state
- **RecipeDataStore** - Hugo static data (ingredients, recipe-info)

**3. Store Initialization Pattern (3-Phase)**

```typescript
// Phase 1: Fast cache load from Dexie (via bridgeToMap liveQuery)
await store.loadCache();

// Phase 2: Delta sync from Appwrite → Dexie (toggles #loading)
await store.syncInitial();

// Phase 3: Realtime WebSocket → Dexie
await store.setupRealtime();
```

**Naming convention** (since 2026-06-05, plan `resync-robuste`): stores expose `syncInitial()` (with loading) and `syncRevalidate()` (silent, no loading toggle). Resync triggers (post-visibility, post-ws-reconnect, post-bfcache restore) use `syncRevalidate()` exclusively. See `svelte-app/src/main.ts` for the orchestrator and `svelte-app/src/lib/db-sync/AGENTS.md` for the full resync mechanism.

**4. Store Cleanup (destroy / logout)**

Every store with private Dexie data must clean up on logout to prevent data leaks:

```typescript
async destroy(): Promise<void> {
  this.#bridge.subscription.unsubscribe();   // Stop Dexie liveQuery
  this.#collection.unsubscribeAll();          // Stop Appwrite realtime
  await this.#collection.clearLocal();        // Clear Dexie table + syncMeta
  this.#rawMap.clear();
  this.#isInitialized = false;
}
```

Stores are wired into `GlobalState.logout()` for automatic cleanup.

**5. Realtime Multiplexing**

All stores register channels with the central RealtimeManager:

```typescript
// During store initialization (before realtimeManager.initialize())
realtimeManager.register(
  [`databases.${DB_ID}.collections.${COLLECTION_ID}.documents`],
  (response) => {
    /* handle realtime update */
  },
);

// Dynamic registration (locks, event-specific) - can be called after init
const cleanup = realtimeManager.registerDynamic(channels, callback);
```

**6. Component Structure**

Components follow a consistent structure:

```svelte
<script lang="ts">
  // 1. Imports
  import { Icon } from "@lucide/svelte"; // Always use this, NOT lucide-svelte

  // 2. Types (if needed)
  interface Props { ... }

  // 3. Props
  let { ... }: Props = $props();

  // 4. Local state
  let localState = $state(...);

  // 5. Derived values
  const derived = $derived(...);
  const complexDerived = $derived.by(() => { ... });

  // 6. Effects
  $effect(() => { ... });

  // 7. Functions
  function handleSomething() { ... }
</script>

<!-- Template --><div>...</div>
```

**7. Toast Service Pattern**

Use `toastService.track()` for async operations, especially after modal closes:

```typescript
import { toastService } from "$lib/services/toast.service.svelte";

const result = await toastService.track(someAsyncOperation(), {
  loading: "Chargement...",
  success: "Opération réussie",
  error: "Erreur lors de l'opération",
});
```

## Directories Structure

```
src/
├── main.ts              # App entry point
├── App.svelte           # Root component with store initialization
├── app.css              # Global styles (Tailwind + DaisyUI)
└── lib/
    ├── router/          # sv-router configuration
    │   ├── routes.ts    # Route definitions
    │   └── guards.ts    # authGuard, eventGuard
    ├── stores/          # State management (Svelte 5 reactive)
    │   ├── GlobalState.svelte.ts
    │   ├── ProductsStore.svelte.ts
    │   ├── RecipesStore.svelte.ts
    │   ├── EventsStore.svelte.ts
    │   ├── RealtimeManager.svelte.ts
    │   └── ...
    ├── db-sync/         # aw-sync: Appwrite ↔ Dexie offline-first layer
    │   ├── aw-sync.ts          # Barrel export (entry point)
    │   ├── aw-collection.ts    # createSyncCollection()
    │   ├── aw-bridge.ts        # bridgeToMap(), bridgeToMapFiltered()
    │   ├── aw-db.ts            # EnkaDB schema (Dexie)
    │   ├── aw-types.ts         # Shared types
    │   └── use-live-query.svelte.ts  # useLiveQuery() component hook
    ├── services/        # Appwrite CRUD + utilities
    │   ├── appwrite.ts  # Centralized Appwrite client
    │   ├── appwrite-products.ts
    │   ├── appwrite-recipes.ts
    │   ├── appwrite-events.ts
    │   ├── appwrite-transaction.ts
    │   └── toast.service.svelte.ts
    ├── models/          # Reactive data wrappers
    │   └── ProductModel.svelte.ts
    ├── components/      # UI components organized by feature
    │   ├── ui/          # Reusable UI components
    │   ├── eventProducts/
    │   ├── recipes/
    │   ├── teams/
    │   ├── documents/
    │   └── ...
    ├── routes/          # Page components
    │   ├── HomePage.svelte
    │   ├── DashboardPage.svelte
    │   ├── EventEditPage.svelte
    │   └── ...
    ├── types/           # TypeScript definitions
    │   ├── appwrite.d.ts  # Auto-generated
    │   └── store.types.ts
    ├── constants/       # Constants (units, etc.)
    └── utils/           # Helper functions
```

## Important Conventions

### UI Component Conventions

- **Icons**: Always use `import { Icon } from "@lucide/svelte"` (NOT `lucide-svelte`)
- **Wrapped labels**: Prefer labels with placeholders over separate label elements
- **Modal async operations**: Use `toastService.track()` to handle operations after modal closes
- **Standard icon sizes**: `size-3` (12px), `size-4` (16px), `size-5` (20px), `size-6` (24px)

### Form Components

Available reusable form components in `src/lib/components/ui/`:

- **BtnGroupCheck** - Button group for single selection
- **CommentText** - Text input with optional comment
- **Fieldset** - Fieldset wrapper with required styling

### Code Style

- **Naming**: kebab-case for files/partials
- **Svelte components**: Use `$props()`, `$state()`, `$derived()`, `$derived.by()`, `$effect()`
- **Reactive access**: Always use reactive derived values, never copy store data
- **Stores**: Import singletons directly, don't create instances

### Appwrite Integration

- **Centralized config**: Use `getAppwriteInstances()` from `appwrite.ts` service
- **Services**: CRUD operations in `appwrite-*.ts` files
- **Permissions**: Handled server-side by Appwrite
- **Auth required**: Check `globalState.isAuthenticated` before write operations

### Error Handling

- **Toasts**: Use `toastService` for user feedback
- **Global errors**: Displayed via `ErrorAlert` component in App.svelte
- **Loading states**: Use `toastService.track()` for async operations

## Development Workflow

### When adding new features to existing stores:

1. Add/update types in `src/lib/types/`
2. Update store with new reactive calculations or methods
3. Add Appwrite CRUD functions in appropriate `appwrite-*.ts` service
4. Update modal/state factories with new forms/actions
5. Create/update UI components consuming the store
6. Register realtime channels if needed

### When creating a new store:

1. Add Dexie table in `src/lib/db-sync/aw-db.ts` (declare on `EnkaDB` + increment version)
2. Add collection name to `AwCollectionName` in `src/lib/db-sync/aw-types.ts`
3. Verify name is mapped in `APPWRITE_CONFIG.collections` (in `appwrite.ts`)
4. Create `src/lib/stores/YourStore.svelte.ts` with class-based singleton using `createSyncCollection` + `bridgeToMap`
5. Add 3-phase initialization: `loadCache()`, `syncInitial()`, `setupRealtime()`. Expose `syncRevalidate()` for background revalidation (no loading toggle)
6. Add `destroy()` with bridge unsubscribe + collection unsubscribeAll + clearLocal
7. Wire into `GlobalState.logout()` if the store holds private user data
8. Export singleton instance

### When debugging state issues:

1. Check store initialization sequence (cache → sync → realtime)
2. Verify IndexedDB cache contents with browser DevTools
3. Confirm realtime subscription status in console logs
4. Review Appwrite sync timestamps in cache metadata
5. Check GlobalState auth initialization for user context

## Build Configuration

### Vite Build Output

- **Output directory**: `../static/app/` (Hugo theme static folder)
- **Base path**: `/app/`
- **Code splitting**: Manual chunks for `@lucide/svelte` (icons) and `appwrite` (SDK)
- **Minification**: esbuild

### Dev Server Proxy

The Vite dev server proxies requests to Hugo:

- `/recipe/*` → Hugo recipe pages
- `/api/*` → Hugo JSON API
- `/data/*` → Hugo static data
- `/icons/*` → Hugo icons
- `/images/*` → Hugo images

## Important Notes

- **Always use reactive derived values** - Never copy store data, use `$derived()` for automatic updates
- **Stores are singletons** - Import and use directly, don't create instances
- **IndexedDB via aw-sync** - Dexie persistence is managed by `createSyncCollection` + `bridgeToMap`; stores call `clearLocal()` on destroy
- **Realtime is multiplexed** - All stores share a single WebSocket via RealtimeManager
- **Auth is required for most operations** - Check `globalState.isAuthenticated` before write operations
- **Appwrite config is centralized** - Use `getAppwriteInstances()` from `appwrite.ts` service
- **Permissions are handled server-side** - Appwrite enforces document-level access control

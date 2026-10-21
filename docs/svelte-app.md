# svelte-app

Scope: référence stack de la SPA Svelte 5 (`svelte-app/`) — lire avant de toucher au code de l'app.
Maintenance: mettre à jour quand l'architecture, le routing ou les canons de check/test changent.

## Stack actuelle

Svelte 5 (runes `$state`/`$props`/`$derived`/`$derived.by`/`$effect`) · Vite · Tailwind v4 + DaisyUI · icônes `@lucide/svelte` (**jamais** `lucide-svelte`) · TipTap (éditeur markdown) · SuperJSON · PocketBase SDK · Dexie (IndexedDB).

## Architecture — 3 couches offline-first

```
PocketBase (remote)  ↔  pb-sync (`src/lib/db-sync/`)  ↔  Dexie / IndexedDB  ↔  stores `*.svelte.ts`  ↔  composants
```

- Entrée unique : `import { createSyncCollection, bridgeToMap, db, pb } from "$lib/db-sync/pb-sync"`.
- `pb-collection.ts` : CRUD + delta sync (curseur `updated`) + SSE → Dexie. `aw-bridge.ts` : `bridgeToMap()` / `bridgeToMapFiltered()` (liveQuery Dexie → SvelteMap, granulaire). `use-live-query.svelte.ts` : hook one-shot.
- `pb-realtime.ts` : signaux SSE globaux (`PB_CONNECT` + resync debouncée) — lifecycle auth géré dans GlobalState.
- Invariant des curseurs de session (porté par la couche via l'option `sessionCursor` de `createSyncCollection` : full de session à chaque début de session, filet TTL 24 h, plafond anti-horloge, `resetCursor` sur élargissement de grant en session, borne `epochFilter` du fetch complet) : [ADR 0001](adr/0001-delta-sync-cursor-invalidation.md).
- Détail des flux : `src/lib/db-sync/README.md`.

## Pattern store (3-phase)

```typescript
await store.loadCache(); // Dexie → SvelteMap (bridge liveQuery)
await store.syncInitial(); // PB → Dexie (toggle #loading) ; variante silencieuse : syncRevalidate()
await store.setupRealtime(); // SSE → Dexie
```

`destroy()` (logout) : `bridge.subscription.unsubscribe()` + `collection.unsubscribeAll()` + `clearLocal()`. Câblé dans `GlobalState.logout()`.

## Routing — sv-router

- Routes : `src/lib/router/routes.ts` (lazy `import()`), guards : `authGuard`, `eventGuard` (`src/lib/router/guards.ts`).
- Publiques : `/`, `/recipe`, `/recipe/:uuid`, `/join/:linkId` (magic link), `/verify-email`, `/reset-password`.
- Privées (authGuard) : `/dashboard/*`, `/recipe/my/*`, `/recipe/new`, `/recipe/:uuid/edit`, `/recipe/:uuid/duplicate`, `/eventList`, `/createdocument/*`, `/editdocument/*`, `/documents/*`.
- Events (eventGuard : auth + cache + **matérialisation de la cible** via `eventsStore.ensureEvent`, attente bornée ~2,5 s) : `/event/:id/*`. Le guard garantit l'entité au montage, pas la réactivité du composant : une page event lit `currentEvent` en dépendance (`$derived` + effet qui attend son arrivée), jamais en lecture unique non trackée. Catch-all 404 en dernier.
- Invariant des pages event : **init par id, jamais par montage** — sv-router réutilise le composant entre `/event/A` et `/event/B`, donc un one-shot (init, lock, chargement) se keye sur `eventId`, avec un effet de cleanup qui libère lock et SSE au changement d'id (`EventEditPage` : sans lui, B serait édité puis sauvé sous le verrou de A ; un `$effect` de cleanup doit **lire** `eventId` dans son corps, sinon il ne rejoue jamais). Le verrou d'édition est péri-entité éditable : `event_*` dans EventEditPage, `recipe_*` dans RecipeEditPage, `doc_*` dans les pages document — **jamais** sur todos ni materiel (éditions rapides sans verrou). Un futur layout `/event/:id` porterait event + readiness, pas le lock.
- Deux formes de ce keying, selon l'entité : effet de cycle de vie (EventEditPage, dont l'état se resynchronise avec l'arrivée de la donnée) ou **remontage explicite par `{#key}` dans un wrapper de route** (`EditDocumentRoute`, `RecipeEditRoute`, `EventDocumentEditRoute` : pages entièrement one-shot — draft, snapshot, lock, heartbeat — le montage redevient réel et `onMount`/`onDestroy` existants suffisent). Le motif de route est ce qui compte : toute route à paramètre d'entité éditable est concernée.
- Piège : `hooks` n'est lu par sv-router que sur les **objets** de route (`{ hooks, "/": comp }`) — attaché à la fonction composant (`(component as any).hooks`), il est **silencieusement ignoré** (route sans guard). Épinglé par `src/lib/router/__tests__/guards.test.ts` ; les guards centralisent redirect + feedback (`requireAuth`), avant tout accès au cache.
- Guard refusé : `requireAuth` ouvre la modale de connexion en mémorisant le `pathname` visé (`authModal.pendingPath`) puis redirige sur `/` — pas de toast d'erreur, la modale porte le feedback. `openAuthModal()` (header, home, reset) efface l'intention ; elle est à usage unique (`consumePendingPath()`).
- Post-login (`App.handleLoginSuccess`) : `globalState.refreshAuthAfterLogin()` résout au **cache local prêt** (purge d'identité + `loadCache`) et c'est là que la navigation part — cible = intention mémorisée, sinon `/dashboard` (push). La phase réseau (fetch + realtime) continue derrière la navigation ; son issue est exposée par `globalState.hydration` (`false` = sync incomplète, session conservée en mode hors ligne) et porte le toast de fin de sync. Les chemins construits à l'exécution passent par `navigateTo()` (`router/index.ts`).

## Conventions

- Ordre du `<script>` : imports → types → `$props()` → `$state` → `$derived` → `$effect` → fonctions.
- Icônes : `@lucide/svelte`, tailles `size-3` (12px) à `size-6` (24px).
- Opérations async post-modal : `toastService.track()` (`$lib/services/toast.service.svelte`).
- Jamais copier de données store dans un état local — toujours `$derived`. Fichiers en kebab-case, stores en singletons importés directement.

## Typage

- `src/lib/types/pb-generated.ts` = vérité du schéma PB (pocketbase-typegen, **ne pas modifier à la main**, régénérer via `bun run generate-types`). Les valeurs d'enum (select) n'existent qu'ici, en `as const`.
- Les shapes JSON métier (`events.meals/todos`, `recipes.ingredients/astuces`, `products.store`) sont typées dans `pb.d.ts` — le typegen les produit en `unknown`. Toute nouvelle collection JSON doit y être typée, sinon résurrection du cluster `{}`/`unknown` au `check-legacy`. Les parse fns acceptent le natif PB + le legacy `string[]`.

## Build & dev

- `bun run build` → `svelte-app/dist/`, base `/` en dev comme en prod, chunks manuels `@lucide/svelte` + `pocketbase`, minify esbuild.
- Pas de proxy : les assets (`/icons/`, `/images/`, `/fonts/`, PWA) sont servis depuis `svelte-app/public/` en dev comme au build (toolchain Hugo supprimée 16-10).
- `bun run format` / `bun run format:check` (depuis la racine) : prettier sur tout le repo, config `.prettierrc` à la racine (`prettier-plugin-tailwindcss` avec `tailwindStylesheet` → tri des classes). Exclus : `content/`, `static/`, `pocketbase/pb_migrations`, `pb-generated.ts`, dotfiles locaux (`.prettierignore`).

## Canons de vérification

- `bun run check` = svelte-check-native : a11y/runes/compile — **ne voit PAS les erreurs de type** (mesuré 06-10).
- `bun run check-legacy` = vrai audit type (svelte-check) — raisonner par diff par fichier (dette préexistante ~193 erreurs au 06-10, à ne pas attendre à 0).
- `bun run test` = vitest. `resolve.conditions: ["browser"]` dans `vitest.config.ts` **obligatoire** (réactivité Svelte 5 en test) ; `@vitest-environment jsdom` par docblock ; faux SDK PocketBase : `src/lib/stores/__tests__/harness/stub-pb.ts` (dates `YYYY-MM-DD HH:mm:ss.SSSZ`, évaluation lexicale du delta).

## Layout `src/lib/`

`router/` (routes, guards) · `routes/` (pages) · `stores/` · `db-sync/` · `services/` (`pb-auth`, `pb-invitations`, `pb-locks`, `pb-users`, `toast.service.svelte`) · `components/` (`ui/` + par feature) · `models/` · `types/` · `constants/` · `utils/` · `data/` · `attachments/` · `test/`.

## Pistes

- Pièges PocketBase (JSVM, `?=` cassé en 0.37.5, ids `_pb_users_auth_`) : skill `pocketbase-best-practices` dans `.agents/skills/`
- Phase 2 (SvelteKit) : `.agents/plans/4_routing-sveltekit.md`.

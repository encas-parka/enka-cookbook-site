/**
 * PocketBase client singleton
 *
 * Replaces `getAppwriteInstances()` (~100 lines) with a single PocketBase instance (~5 lines).
 *
 * @module db-sync/pb
 */

import PocketBase from 'pocketbase';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * PocketBase server URL.
 * - Dev: http://localhost:8090 (Vite proxies are NOT used — direct access)
 * - Prod: env var VITE_POCKETBASE_URL or same origin
 */
const PB_URL =
	import.meta.env.VITE_POCKETBASE_URL ?? 'http://localhost:8090';

// =============================================================================
// SINGLETON
// =============================================================================

/**
 * Global PocketBase client instance.
 *
 * In CSR mode (Phase 1), a single instance is fine — the SDK stores auth
 * in localStorage by default. For SSR (Phase 3), this will be replaced
 * by per-request instances in `hooks.server.ts`.
 */
export const pb = new PocketBase(PB_URL);

console.log(`[pb] PocketBase client initialized → ${PB_URL}`);

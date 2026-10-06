/**
 * Vitest setup — loaded before any test file (see vitest.config.ts).
 *
 * Installs the `fake-indexeddb` polyfill globally so Dexie (which requires
 * IndexedDB) works unmodified in node/jsdom test environments.
 *
 * MUST be the first import in this file — Dexie opens the DB at first use,
 * and the polyfill must be registered before that happens.
 */
import "fake-indexeddb/auto";

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

// jsdom n'implémente pas matchMedia — requis par svelte/reactivity/window :
// l'import du module construit un DevicePixelRatio (ex. `online`, importé
// par MaterielCard). Stub minimal, hors environnement node (pas de window).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

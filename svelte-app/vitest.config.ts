import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      $lib: path.resolve(__dirname, "./src/lib"),
    },
    // CRITICAL for Svelte 5 reactivity in tests:
    // Without 'browser' conditions, Svelte resolves to its Node/SSR runtime
    // which uses source() instead of state() for SvelteMap internal signals.
    // This breaks $derived.by() dependency tracking — deriveds compute once
    // but never re-derive when the SvelteMap is mutated.
    conditions: process.env.VITEST ? ["browser"] : [],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: [
      "./src/lib/stores/__tests__/harness/setup.ts",
    ],
  },
});

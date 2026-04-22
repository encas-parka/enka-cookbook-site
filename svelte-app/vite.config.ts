import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
// import { visualizer } from "rollup-plugin-visualizer";

// ESM-safe __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pwaConfig: Partial<VitePWAOptions> = {
  registerType: "autoUpdate" as const,
  injectRegister: false, // Hugo contrôle le HTML, on enregistre le SW manuellement
  manifest: {
    name: "Enka Cookbook",
    short_name: "Enka",
    description:
      "Recettes collaboratives et gestion d'événements pour cantines autogérées",
    theme_color: "#900e3b",
    background_color: "#ffffff",
    lang: "fr",
    display: "standalone" as const,
    start_url: "/app/",
    scope: "/app/",
    icons: [
      {
        src: "192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["assets/**/*.{js,css,woff2}", "fonts/**/*.{css,woff2}"],
    dontCacheBustURLsMatching: /-[a-f0-9]{8}\./,
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/data\.json$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "hugo-api",
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
        },
      },
      {
        urlPattern: /^https?:\/\/.*\/recipe\/.*\/recipe\.json$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "hugo-recipes",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
        },
      },
      {
        urlPattern: /^https?:\/\/.*\/(icons|images)\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.+/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.+/,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  devOptions: {
    enabled: false,
  },
};

export default defineConfig(({ mode }) => ({
  base: mode === "development" ? "/" : "/app/",

  plugins: [
    tailwindcss(),
    svelte(), // v7 : inspector intégré automatiquement
    VitePWA(pwaConfig),
    // visualizer({
    //   open: true,
    //   gzipSize: true,
    //   filename: "./dist/stats.html",
    // }) as PluginOption,
  ],

  build: {
    outDir: "../static/app/",
    emptyOutDir: true,

    // ⭐ esbuild comme minificateur (au lieu d'OxC par défaut)
    // pure supprime uniquement console.log, console.error/warn restent intacts
    minify: "esbuild",
    esbuild: {
      pure: mode === "production" ? ["console.log"] : [],
    },

    target: "es2020",
    manifest: ".vite-manifest.json",

    // ⭐ Vite 8 : rollupOptions → rolldownOptions (rollupOptions déprécié)
    rolldownOptions: {
      output: {
        keepNames: true, // CRUCIAL pour Svelte 5 (équivalent terser keep_classnames)
        entryFileNames:
          mode === "development"
            ? "assets/[name].js"
            : "assets/[name]-[hash].js",
        chunkFileNames:
          mode === "development"
            ? "assets/[name].js"
            : "assets/[name]-[hash].js",
        assetFileNames:
          mode === "development"
            ? "assets/[name].[ext]"
            : "assets/[name]-[hash].[ext]",

        // Note: manualChunks en forme fonction est déprécié dans Vite 8
        // mais fonctionne encore. Rolldown propose codeSplitting comme alternative.
        manualChunks(id) {
          if (id.includes("@lucide/svelte")) {
            return "icons";
          }
          if (id.includes("appwrite")) {
            return "appwrite";
          }
          if (id.includes("@tiptap")) {
            return "tiptap";
          }
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      $lib: path.resolve(__dirname, "./src/lib"),
    },
  },

  server: {
    proxy: {
      "/recipe": {
        target: "http://localhost:1313",
        changeOrigin: true,
        // Ne proxy que les fichiers JSON vers Hugo.
        // Pour les pages HTML, laisser Vite servir index.html (SPA fallback)
        // afin que le HMR et l'inspecteur Svelte fonctionnent.
        bypass: (req, _res, _options) => {
          if (!req.url?.includes(".json")) {
            return "/index.html";
          }
        },
      },
      "/data": {
        target: "http://localhost:1313",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            console.log("[Vite Proxy] Hugo server not available for /data/");
          });
        },
      },
      "/icons": {
        target: "http://localhost:1313",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            console.log("[Vite Proxy] Hugo server not available for /icons/");
          });
        },
      },
      "/images": {
        target: "http://localhost:1313",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            console.log("[Vite Proxy] Hugo server not available for /images/");
          });
        },
      },
    },
  },
}));

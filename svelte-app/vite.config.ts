import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";
// import { visualizer } from "rollup-plugin-visualizer";

// ESM-safe __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  base: mode === "development" ? "/" : "/app/",

  plugins: [
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // Hugo contrôle le HTML, on enregistre le SW manuellement
      manifest: {
        name: "Enka Cookbook",
        short_name: "Enka",
        description:
          "Recettes collaboratives et gestion d'événements pour cantines autogérées",
        theme_color: "#900e3b",
        background_color: "#ffffff",
        lang: "fr",
        display: "standalone",
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
            urlPattern: /^https?:\/\/.*\/recettes\/.*\/recipe\.json$/,
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
    }),
    // visualizer({
    //   open: true,
    //   gzipSize: true,
    //   filename: "./dist/stats.html",
    // }),
  ],

  build: {
    outDir: "../static/app/",
    emptyOutDir: true,

    // ⭐ CHANGEMENT 1 : Terser basique
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: ["log"], // Supprime console.log
        pure_funcs: ["console.log"],
        drop_debugger: true, // Supprime debugger
        passes: 1, // 1 passe pour commencer
      },
      mangle: {
        keep_classnames: true, // CRUCIAL pour Svelte 5
      },
      format: {
        comments: false, // Supprime tous les commentaires
      },
    },

    target: "es2020",
    manifest: ".vite-manifest.json",

    rollupOptions: {
      output: {
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
      "/recettes": {
        target: "http://localhost:1313",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            console.log(
              "[Vite Proxy] Hugo server not available for /recettes/",
            );
          });
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

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // En dev: "/" (serveur Vite), en prod: "/app/" (chemin Hugo)
  base: mode === "development" ? "/" : "/app/",

  plugins: [
    tailwindcss(),
    svelte(),
    // visualizer({
    //   open: true,
    //   gzipSize: true,
    //   filename: "./dist/stats.html",
    // }),
  ],
  build: {
    // Cible le dossier static/app de votre thème Hugo
    outDir: "../static/app/",
    emptyOutDir: true, // Vide le dossier à chaque build (utile pour le dev)

    // Optimisations importantes
    minify: "esbuild",
    // Important pour le code splitting
    target: "es2020",

    // Générer un manifest pour le cache-busting
    manifest: "manifest.json",

    rollupOptions: {
      output: {
        // Ajout de hash pour le cache-busting
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",

        manualChunks(id) {
          // Icons Lucide (gros morceau)
          if (id.includes("@lucide/svelte")) {
            return "icons";
          }

          // Appwrite SDK
          if (id.includes("appwrite")) {
            return "appwrite";
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

  // --- Configuration du serveur de développement ---
  server: {
    // Proxy pour accéder aux données Hugo en mode dev
    proxy: {
      // Rediriger /recettes/ vers le serveur Hugo
      "/recettes": {
        target: "http://localhost:1313", // Serveur Hugo par défaut
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            console.log(
              "[Vite Proxy] Hugo server not available for /recettes/",
            );
          });
        },
      },
      // Rediriger /data/ vers le dossier static/data de Hugo
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

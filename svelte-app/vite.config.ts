import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
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
    manifest: "manifest.json",

    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",

        manualChunks(id) {
          if (id.includes("@lucide/svelte")) {
            return "icons";
          }
          if (id.includes("appwrite")) {
            return "appwrite";
          }
          // ⭐ AJOUT : Séparer Tiptap (gros paquet)
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

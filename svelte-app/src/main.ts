import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// Enregistrer le Service Worker en production uniquement
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker
      .register("/app/sw.js")
      .catch((err) => {
        console.warn("[PWA] Échec de l'enregistrement du Service Worker:", err);
        return null;
      });

    // Vérification quand l'utilisateur revient sur l'onglet
    // (timers throttlés en arrière-plan sur mobile, ce check compense)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    });
  });

  // Auto-reload quand une nouvelle version du SW est activée
  // (skipWaiting + clientsClaim dans workbox → activation immédiate)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[PWA] Nouvelle version activée — rechargement de la page");
    window.location.reload();
  });
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;

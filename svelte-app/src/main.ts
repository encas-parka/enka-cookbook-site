import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// Enregistrer le Service Worker en production uniquement
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/app/sw.js").catch((err) => {
      console.warn("[PWA] Échec de l'enregistrement du Service Worker:", err);
    });
  });

  // Notifier l'utilisateur quand une nouvelle version du SW est activée
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[PWA] Nouvelle version activée — rechargement de la page");
    window.location.reload();
  });
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;

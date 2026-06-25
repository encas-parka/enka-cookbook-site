<script lang="ts">
  import { onMount } from "svelte";
  import { productsStore } from "./lib/stores/ProductsStore.svelte";
  import { eventsStore } from "./lib/stores/EventsStore.svelte";
  import { nativeTeamsStore as teamsStore } from "./lib/stores/NativeTeamsStore.svelte";
  import { recipesStore } from "./lib/stores/RecipesStore.svelte";
  import { notificationStore } from "./lib/stores/NotificationStore.svelte";
  import { materielStore } from "./lib/stores/MaterielStore.svelte";
  import {
    cleanupLegacyCaches,
    initializeRealtime,
  } from "$lib/db-sync/aw-sync";
  import { teamdocsStore } from "./lib/stores/TeamdocsStore.svelte";
  import ErrorAlert from "./lib/components/ui/ErrorAlert.svelte";
  import HeaderNav from "./lib/components/HeaderNav.svelte";
  import Toast from "./lib/components/ui/Toast.svelte";
  import { globalState } from "./lib/stores/GlobalState.svelte";
  import { toastService } from "./lib/services/toast.service.svelte";
  import { Router, preload } from "$lib/router";
  import { updateStore } from "./lib/stores/UpdateStore.svelte";
  import UpdatePrompt from "./lib/components/ui/UpdatePrompt.svelte";
  import { markBootSuccess } from "./lib/sw-reload-guard";

  type AppState = "BOOTING" | "READY" | "ERROR";
  let appState = $state<AppState>("BOOTING");
  let initError: string | null = $state(null);

  async function initializeApp() {
    try {
      appState = "BOOTING";

      // Nettoyer les anciens caches IDB (migration PocketBase → Dexie)
      await cleanupLegacyCaches();

      await globalState.initializeAuth();

      appState = "READY";
      // Réarme le garde-fou anti-boucle du filet chunk-error : le boot a réussi.
      markBootSuccess();

      if (globalState.isAuthenticated) {
        const syncToastId = toastService.loading("Chargement des données...");

        Promise.all([
          recipesStore.loadCache(),
          eventsStore.loadCache(),
          materielStore.loadCache(),
          teamdocsStore.loadCache(),
        ])
          .then(async () => {
            toastService.update(syncToastId, {
              state: "loading",
              message: "Mise à jour des données en cours...",
            });

            return Promise.all([
              recipesStore.syncInitial(),
              eventsStore.syncInitial(),
              materielStore.syncInitial(),
              teamsStore.syncInitial(),
              teamdocsStore.syncInitial(),
            ]);
          })
          .catch((err) => {
            console.error("[App] Erreur synchro privée:", err);
          })
          .then(async () => {
            await Promise.all([
              eventsStore.setupRealtime(),
              recipesStore.setupRealtime(),
              materielStore.setupRealtime(),
              teamsStore.setupRealtime(),
              notificationStore.initialize(),
              teamdocsStore.setupRealtime(),
            ]);
            await initializeRealtime();

            toastService.update(syncToastId, {
              state: "success",
              message: "Données mises à jour",
              autoCloseDelay: 2000,
            });

            setTimeout(() => {
              preload("/dashboard");
              preload("/recipe");
            }, 3000);
          })
          .catch((err) => {
            console.error("[App] Erreur setup realtime:", err);
            toastService.update(syncToastId, {
              state: "warning",
              message: "Mode hors ligne : données mises en cache",
              autoCloseDelay: 5000,
            });
          });
      } else {
        recipesStore
          .loadCache()
          .then(() => {
            return recipesStore.syncFromRemotePublicOnly();
          })
          .then(() => {
            setTimeout(() => {
              preload("/recipe");
            }, 2000);
          })
          .catch((err) => {
            console.error("[App] Erreur synchro publique:", err);
          });
      }
    } catch (err: any) {
      console.error("[App] Erreur fatale d'initialisation:", err);
      initError = err.message || "Erreur critique de chargement";
      appState = "ERROR";
    }
  }

  onMount(() => {
    initializeApp();
    globalState.initializeScrollDirection();
  });

  let displayError = $derived(initError || productsStore.error);

  async function handleLoginSuccess() {
    globalState.authModal.isOpen = false;
    await globalState.refreshAuthAfterLogin();
  }
</script>

<link rel="stylesheet" href="{import.meta.env.BASE_URL}fonts/fredoka.css" />
<link rel="stylesheet" href="{import.meta.env.BASE_URL}fonts/sora.css" />

<div class="flex min-h-dvh flex-col">
  <div class="bg-base-200 flex-1">
    <HeaderNav />
    {#if appState === "ERROR"}
      <div class="flex h-[50vh] items-center justify-center">
        <ErrorAlert message={displayError || "Erreur inconnue"} />
      </div>
    {:else if appState === "BOOTING"}
      <div class="flex h-[80vh] flex-col items-center justify-center gap-4">
        <div class="loading loading-spinner loading-lg text-primary"></div>
        <p class="text-base-content/70 animate-pulse font-medium">
          Démarrage...
        </p>
      </div>
    {:else}
      <!-- ✅ sv-router -->
      <Router>
        <!-- Les composants de route sont rendus ici par sv-router -->
        <!-- Ils accèdent aux params via route.params et route.search -->
      </Router>
    {/if}
  </div>
</div>

<Toast />

<UpdatePrompt
  isOpen={updateStore.updateAvailable}
  changelog={updateStore.changelog}
  onAccept={() => updateStore.applyUpdate()}
/>

{#await import("./lib/components/ui/ScrollToTopButton.svelte") then { default: ScrollToTopButton }}
  <ScrollToTopButton />
{/await}

{#await import("./lib/components/ui/StatusBar.svelte") then { default: StatusBar }}
  <StatusBar />
{/await}

{#if globalState.isAuthenticated}
  {#if displayError}
    <ErrorAlert message={displayError} />
  {/if}
  {#await import("./lib/components/OverrideConflictModal.svelte") then { default: OverrideConflictModal }}
    <OverrideConflictModal />
  {/await}
{/if}

{#await import("./lib/components/AuthModal.svelte") then { default: AuthModal }}
  <AuthModal
    bind:isOpen={globalState.authModal.isOpen}
    showLogin={globalState.authModal.showLogin}
    onAuth_success={handleLoginSuccess}
  />
{/await}

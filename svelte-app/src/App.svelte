<script lang="ts">
  import { onMount } from "svelte";
  import { productsStore } from "./lib/stores/ProductsStore.svelte";
  import { eventsStore } from "./lib/stores/EventsStore.svelte";
  import { nativeTeamsStore as teamsStore } from "./lib/stores/NativeTeamsStore.svelte";
  import { recipesStore } from "./lib/stores/RecipesStore.svelte";
  import { materielStore } from "./lib/stores/MaterielStore.svelte";
  import { cleanupLegacyCaches, ensureDbReady } from "$lib/db-sync/pb-sync";
  import { teamdocsStore } from "./lib/stores/TeamdocsStore.svelte";
  import ErrorAlert from "./lib/components/ui/ErrorAlert.svelte";
  import HeaderNav from "./lib/components/HeaderNav.svelte";
  import Toast from "./lib/components/ui/Toast.svelte";
  import { globalState } from "./lib/stores/GlobalState.svelte";
  import { toastService } from "./lib/services/toast.service.svelte";
  import { Router, navigateTo, preload, route } from "$lib/router";

  type AppState = "BOOTING" | "READY" | "ERROR";
  let appState = $state<AppState>("BOOTING");
  let initError: string | null = $state(null);

  async function initializeApp() {
    try {
      appState = "BOOTING";

      // Nettoyer les anciens caches IDB (migration PocketBase → Dexie)
      await cleanupLegacyCaches();

      // Open défensif Dexie : une base locale incompatible (version supérieure,
      // upgrade cassé) est droppée et recréée — le cache n'est pas source de
      // vérité (PocketBase l'est). Sans cette garde, les liveQuery des bridges
      // échouent en silence et les stores restent vides malgré une sync OK.
      await ensureDbReady();

      await globalState.initializeAuth();

      appState = "READY";

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
              teamdocsStore.setupRealtime(),
            ]);

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
            // Recettes en lecture publique PB (REC-2) : syncInitial câble
            // syncReady et le loading, comme l'ancienne sync publique dédiée.
            return recipesStore.syncInitial();
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
    const origin = route.pathname;
    globalState.authModal.isOpen = false;

    // Cible : la page qu'un guard avait refusée, sinon le dashboard.
    const target = globalState.consumePendingPath() ?? "/dashboard";
    // `preload` type ses cibles par littéral ; la cible est un chemin runtime.
    void preload(target as `/${string}`);

    // Point de coupe : purge d'identité + cache Dexie. La synchronisation
    // réseau continue derrière la navigation (les stores sont des
    // singletons, rien ne l'interrompt).
    await globalState.refreshAuthAfterLogin();
    if (!globalState.isAuthenticated) return;

    // Feedback différé : la navigation est immédiate, ce toast ne s'affiche
    // qu'une fois les données réellement à jour (ou hors ligne assumé).
    void globalState.hydration.then((complete) => {
      if (!globalState.isAuthenticated) return;
      if (complete) {
        toastService.success("Vos données sont à jour");
      } else {
        toastService.warning("Mode hors ligne : données mises en cache", {
          autoCloseDelay: 5000,
        });
      }
    });

    // L'utilisateur a repris la main pendant l'hydratation locale : sa
    // navigation prime sur la redirection différée.
    if (route.pathname !== origin) return;
    navigateTo(target);
  }
</script>

<link rel="stylesheet" href="{import.meta.env.BASE_URL}fonts/fredoka.css" />
<link rel="stylesheet" href="{import.meta.env.BASE_URL}fonts/sora.css" />

<div class="flex min-h-dvh flex-col">
  <div class="flex-1 bg-base-200">
    <HeaderNav />
    {#if appState === "ERROR"}
      <div class="flex h-[50vh] items-center justify-center">
        <ErrorAlert message={displayError || "Erreur inconnue"} />
      </div>
    {:else if appState === "BOOTING"}
      <div class="flex h-[80vh] flex-col items-center justify-center gap-4">
        <div class="loading loading-lg loading-spinner text-primary"></div>
        <p class="animate-pulse font-medium text-base-content/70">
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
    defaultEmail={globalState.authModal.prefillEmail ?? ""}
    onAuth_success={handleLoginSuccess}
  />
{/await}

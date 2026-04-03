<script lang="ts">
  import { onMount, tick } from "svelte";
  import { productsStore } from "./lib/stores/ProductsStore.svelte";
  import { eventsStore } from "./lib/stores/EventsStore.svelte";
  import { nativeTeamsStore as teamsStore } from "./lib/stores/NativeTeamsStore.svelte";
  import { recipesStore } from "./lib/stores/RecipesStore.svelte";
  import { notificationStore } from "./lib/stores/NotificationStore.svelte";
  import { materielStore } from "./lib/stores/MaterielStore.svelte";
  import { realtimeManager } from "./lib/stores/RealtimeManager.svelte";
  import { teamdocsStore } from "./lib/stores/TeamdocsStore.svelte";
  import { onDestroy } from "svelte";
  import ErrorAlert from "./lib/components/ui/ErrorAlert.svelte";
  import HeaderNav from "./lib/components/HeaderNav.svelte";
  import Toast from "./lib/components/ui/Toast.svelte";
  import ScrollToTopButton from "./lib/components/ui/ScrollToTopButton.svelte";
  import OverrideConflictModal from "./lib/components/OverrideConflictModal.svelte";
  import AuthModal from "./lib/components/AuthModal.svelte";
  import { globalState } from "./lib/stores/GlobalState.svelte";
  import { toastService } from "./lib/services/toast.service.svelte";
  import { Router, preload } from "$lib/router";

  type AppState = "BOOTING" | "READY" | "ERROR";
  let appState = $state<AppState>("BOOTING");
  let initError: string | null = $state(null);

  async function initializeApp() {
    try {
      appState = "BOOTING";

      await globalState.initializeAuth();

      // ✅ Afficher IMMÉDIATEMENT l'UI (quel que soit l'état auth)
      appState = "READY";
      // ✅ Synchroniser l'état de référence pour éviter un faux "changement" dans l'effet
      wasAuthenticated = globalState.isAuthenticated;

      if (globalState.isAuthenticated) {
        // ============================================
        // UTILISATEUR AUTHENTIFIÉ
        // ============================================

        // 🔵 Toast informatif
        const syncToastId = toastService.loading("Chargement des données...");

        // 🚀 Charger TOUS les stores privés en arrière-plan (NON BLOQUANT)
        Promise.all([
          recipesStore.loadCache(), // Publique + Privé
          eventsStore.loadCache(), // ❌ PRIVÉ
          materielStore.loadCache(), // ❌ PRIVÉ
          teamdocsStore.loadCache(), // ❌ PRIVÉ
        ])
          .then(async () => {
            toastService.update(syncToastId, {
              state: "loading",
              message: "Mise à jour des données en cours...",
            });

            // Synchro distante
            return Promise.all([
              recipesStore.syncFromRemote(),
              eventsStore.syncFromRemote(),
              materielStore.syncFromRemote(),
              teamsStore.syncFromRemote(),
              teamdocsStore.syncFromRemote(),
            ]);
          })
          .catch((err) => {
            console.error("[App] Erreur synchro privée:", err);
            // En cas d'erreur de synchro, on continue quand même (mode offline)
            // Le .then() suivant sera exécuté même sans return Promise.resolve()
          })
          .then(async () => {
            // Realtime (UNIQUEMENT pour authentifié)
            // ✅ TOUJOURS exécuté : succès ou erreur de synchro
            await Promise.all([
              eventsStore.setupRealtime(),
              recipesStore.setupRealtime(),
              materielStore.setupRealtime(),
              teamsStore.setupRealtime(),
              notificationStore.initialize(),
              teamdocsStore.setupRealtime(),
            ]);
            await realtimeManager.initialize();

            toastService.update(syncToastId, {
              state: "success",
              message: "Données chargées",
              autoCloseDelay: 2000,
            });

            // Préchargement des routes probables
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
        // ============================================
        // VISITEUR NON AUTHENTIFIÉ
        // ============================================

        // 🚀 Charger SEULEMENT recipesStore en arrière-plan (NON BLOQUANT)
        // Pas de toast pour les visiteurs (chargement silencieux)
        recipesStore
          .loadCache()
          .then(() => {
            // Synchro publique SEULEMENT
            return recipesStore.syncFromRemotePublicOnly();
          })
          .then(() => {
            // Realtime publique (pas de notification, pas de teams)
            return Promise.all([
              recipesStore.setupRealtime(),
              realtimeManager.initialize(),
            ]);
          })
          .then(() => {
            // Précharger les routes publiques
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

  // ❌ PLUS BESOIN de gérer le scroll manuellement
  // sv-router le gère automatiquement avec scrollToTop par défaut
  // https://sv-router.vercel.app/guide/code-based/scroll-behavior

  let wasAuthenticated = $state(false);
  let isInitializing = $state(false);

  /**
   * Nettoie les stores privés lors d'une déconnexion
   * Préserve recipesStore (nécessaire pour les visiteurs)
   */
  function cleanupPrivateStores() {
    console.log("[App] Nettoyage des stores privés...");
    notificationStore.destroy();
    teamsStore.destroy();
    eventsStore.destroy();
    materielStore.destroy();
    teamdocsStore.destroy();
    // recipesStore est préservé pour les visiteurs
  }

  $effect(() => {
    const isAuth = globalState.isAuthenticated;

    if (isInitializing) {
      return;
    }

    if (appState !== "BOOTING" && isAuth !== wasAuthenticated) {
      wasAuthenticated = isAuth;

      // 🔴 DÉCONNEXION : nettoyer les stores privés
      if (!isAuth) {
        console.log("[App] Déconnexion détectée");
        cleanupPrivateStores();
        realtimeManager.destroy();
      } else {
        // ✅ CONNEXION : nettoyer le RealtimeManager avant de réinitialiser
        // Cela permet aux stores de ré-enregistrer leurs channels sans warning
        console.log("[App] Connexion détectée");
        realtimeManager.destroy();
      }

      console.log("[App] Changement d'état Auth -> Réinitialisation");

      isInitializing = true;
      initializeApp().finally(() => {
        isInitializing = false;
      });
    }
  });

  onMount(() => {
    initializeApp();
    // Initialiser la détection de scroll pour le smart header mobile
    globalState.initializeScrollDirection();
  });

  // USELESS en spa
  // onDestroy(() => {
  //   console.log("[App] Destruction de l'application - Nettoyage des stores...");
  //   notificationStore.destroy();
  //   teamsStore.destroy();
  //   eventsStore.destroy();
  //   recipesStore.destroy();
  //   materielStore.destroy();
  //   teamdocsStore.destroy();
  //   realtimeManager.destroy();
  //   globalState.destroyScrollDirection();
  // });

  let displayError = $derived(initError || productsStore.error);

  async function handleLoginSuccess() {
    globalState.authModal.isOpen = false;
    // Réinitialiser l'authentification et déclencher le rechargement du dashboard
    await globalState.refreshAuthAfterLogin();
  }
</script>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Fredoka:wght@300..700&display=swap&family=Sora:wght@100..800&display=swap"
  rel="stylesheet"
/>

<div class="flex min-h-dvh flex-col">
  <HeaderNav />
  <div class="bg-base-200 flex-1">
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
<ScrollToTopButton />

{#if globalState.isAuthenticated}
  {#if displayError}
    <ErrorAlert message={displayError} />
  {/if}
  <OverrideConflictModal />
{/if}

<AuthModal
  bind:isOpen={globalState.authModal.isOpen}
  showLogin={globalState.authModal.showLogin}
  onAuth_success={handleLoginSuccess}
/>

<style>
</style>

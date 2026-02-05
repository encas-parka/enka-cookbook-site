<script lang="ts">
  import { globalState } from "../stores/GlobalState.svelte";
  import { route, p, navigate } from "$lib/router";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { recipesStore } from "../stores/RecipesStore.svelte";
  import EventTabs from "./eventEdit/EventTabs.svelte";
  import MaterielTabs from "./MaterielTabs.svelte";
  import DocumentTabs from "./documents/DocumentTabs.svelte";
  import { refreshAllStores } from "$lib/utils/storesReload";

  import {
    LogInIcon,
    LogOutIcon,
    LayoutDashboardIcon,
    UsersIcon,
    BookOpenIcon,
    ChevronLeftIcon,
    PlusIcon,
    SearchIcon,
    CircleStar,
    LockIcon,
    RefreshCwIcon,
    DatabaseIcon,
    ChefHat,
    CookingPot,
  } from "@lucide/svelte";

  let showDropdown = $state(false);
  let isReloading = $state(false);
  let isRefreshingAll = $state(false);

  // Détection mode dev
  const isDev = import.meta.env.DEV;

  // Détection automatique du contexte via le router
  // Extrait toutes les informations de contexte depuis l'URL courante
  type ContextType =
    | { type: "eventEdit"; basePath: string; eventId: string }
    | { type: "materiel"; teamId: string }
    | { type: "loans"; teamId: string }
    | { type: "documentEdit"; teamId: string; docId: string }
    | null;

  const context: ContextType = $derived.by(() => {
    const pathname = route.pathname;
    const params = route.params;

    // Routes dashboard: /event/:id, /event/:id/recipes, /event/:id/products, /event/:id/posters
    if (pathname.includes("/event/") && params.id) {
      return {
        type: "eventEdit",
        basePath: "/event",
        eventId: params.id as string,
      };
    }

    // Routes demo: /demo/event/:id, /demo/event/recipes, etc.
    if (pathname.includes("/demo/event/") && params.id) {
      return {
        type: "eventEdit",
        basePath: "/demo/event",
        eventId: params.id as string,
      };
    }

    // Routes matériel: /dashboard/materiel/:teamId
    if (pathname.includes("/dashboard/materiel/") && params.teamId) {
      return {
        type: "materiel",
        teamId: params.teamId as string,
      };
    }

    // Routes emprunts: /dashboard/loans/:teamId
    if (pathname.includes("/dashboard/loans/") && params.teamId) {
      return {
        type: "loans",
        teamId: params.teamId as string,
      };
    }

    // Routes documents: /editdocument/:teamId/:docId
    if (pathname.includes("/editdocument/") && params.teamId && params.docId) {
      return {
        type: "documentEdit",
        teamId: params.teamId as string,
        docId: params.docId as string,
      };
    }

    return null;
  });

  // Initialiser le smart header

  if (globalState.isMobile) {
    globalState.initializeScrollDirection();
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  async function handleLogout() {
    try {
      await globalState.logout();
      window.location.href = "/"; // Rediriger vers la home après logout
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  }

  function handleLogin() {
    globalState.authModal.showLogin = true;
    globalState.authModal.isOpen = true;
  }

  async function handleReloadRecipes() {
    if (!globalState.userId) return;

    isReloading = true;
    try {
      await recipesStore.forceReloadAllRecipes();
      closeDropdown();
    } catch (error) {
      console.error("Erreur lors du rechargement des recettes:", error);
      alert("Erreur lors du rechargement des recettes");
    } finally {
      isReloading = false;
    }
  }

  async function handleRefreshAllStores() {
    if (!globalState.userId) return;

    isRefreshingAll = true;
    try {
      const result = await refreshAllStores();

      if (result.success) {
        console.log(
          "[HeaderNav] Tous les stores ont été rechargés avec succès",
        );
        closeDropdown();
      } else {
        console.error(
          "[HeaderNav] Erreur lors du rechargement des stores:",
          result.results,
        );
        alert(
          "Erreur lors du rechargement de certains stores. Vérifiez la console pour plus de détails.",
        );
      }
    } catch (error) {
      console.error("Erreur lors du rechargement des stores:", error);
      alert("Erreur lors du rechargement des stores");
    } finally {
      isRefreshingAll = false;
    }
  }

  // Fermer le dropdown au clic extérieur
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".svelte-user-dropdown")) {
      closeDropdown();
    }
  }

  $effect(() => {
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  });
</script>

<div
  class="navbar bg-base-100 border-base-300 sticky top-0 z-1000 min-h-13 border-b px-4 py-0 shadow-sm transition-transform duration-300 print:hidden {globalState.isMobile &&
    'min-h-11'}
    {globalState.isMobile && !globalState.headerVisible && '-translate-y-full'}"
>
  <div class="navbar-start w-fit shrink-0 gap-1">
    <!-- Brand -->
    <a href={p("/")} class="btn btn-ghost btn-circle">
      <img src="/images/favicon.png" alt="logo" class="h-8 w-8" />
    </a>

    <!-- Permanent Nav Links -->
    <div class=" flex items-center gap-1">
      {#if globalState.isAuthenticated}
        <button
          onclick={() => navigate("/dashboard")}
          class="btn btn-ghost not-md:btn-square md:gap-2"
        >
          <LayoutDashboardIcon size={18} />
          <span class="hidden md:inline">Tableau de bord</span>
        </button>
      {/if}

      <button
        onclick={() => navigate("/recipe")}
        class="btn btn-ghost not-md:btn-square md:gap-2"
      >
        <CookingPot size={18} />
        <span class="hidden md:inline">Recettes</span>
      </button>
    </div>

    <!-- Back button (Keep if really needed by some specific page logic) -->
    <!-- {#if navBarStore.backAction}
      <button
        class="btn btn-ghost btn-circle btn-sm ml-2"
        onclick={navBarStore.backAction}
      >
        <ChevronLeftIcon size={20} />
      </button>
    {/if} -->
  </div>

  <!-- navbar-center : SEULEMENT SUR DESKTOP -->
  {#if globalState.isDesktop}
    <div class="navbar-center absolute left-1/2 -translate-x-1/2 transform">
      {#if context?.type === "materiel" || context?.type === "loans"}
        <MaterielTabs currentTeamId={context.teamId} />
      {:else if context?.type === "eventEdit"}
        <EventTabs eventId={context.eventId} basePath={context.basePath} />
      {:else if context?.type === "documentEdit"}
        <DocumentTabs />
      {:else}
        <h1
          class="font-family-fredoka truncate text-sm font-bold tracking-wider uppercase opacity-70"
          title={navBarStore.title}
        >
          {navBarStore.title}
        </h1>
      {/if}
    </div>
  {/if}

  <div class="navbar-end ms-auto w-fit shrink-0 gap-4">
    {#if navBarStore.isLockedByOthers}
      <div class="badge badge-warning flex items-center gap-1 py-3 font-medium">
        <LockIcon size={14} />
        <span class="text-xs">
          Édition par {navBarStore.lockedByUserName}
        </span>
      </div>
    {/if}
    <!-- Actions -->
    <div class="flex items-center gap-2">
      {#if navBarStore.actions}
        {@render navBarStore.actions()}
      {/if}
    </div>

    <!-- User dropdown -->
    {#if globalState.isAuthenticated}
      <div class="dropdown dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn btn-ghost btn-circle avatar bg-primary/10 text-primary border-primary/20 border"
        >
          <div
            class="flex w-10 items-center justify-center rounded-full text-lg font-bold"
          >
            {globalState.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
        </div>
        <ul
          class="menu menu-sm dropdown-content bg-base-100 border-base-200 z-1 mt-3 w-56 rounded-xl border p-2 shadow-xl"
        >
          <li class="border-base-100 mb-1 border-b px-4 py-2">
            <span
              class="block truncate p-0 text-xs font-medium italic opacity-60"
            >
              {globalState.user?.email}
            </span>
          </li>
          <li>
            <button
              onclick={() => navigate("/dashboard")}
              class="flex items-center gap-2"
            >
              <LayoutDashboardIcon size={16} /> Dashboard
            </button>
          </li>
          <li>
            <button
              onclick={() => navigate("/dashboard/teams")}
              class="flex items-center gap-2"
            >
              <UsersIcon size={16} /> Équipes
            </button>
          </li>
          <li>
            <button
              onclick={() => navigate("/dashboard/eventCreate")}
              class="flex items-center gap-2"
            >
              <PlusIcon size={16} /> Nouvel événement
            </button>
          </li>
          <li>
            <button
              onclick={() => navigate("/recipe")}
              class="flex items-center gap-2"
            >
              <BookOpenIcon size={16} /> Recettes
            </button>
          </li>
          <li>
            <button
              onclick={handleReloadRecipes}
              disabled={isReloading}
              class="disabled:opacity-50"
            >
              <RefreshCwIcon
                size={16}
                class={isReloading ? "animate-spin" : ""}
              />
              {isReloading ? "Chargement..." : "Recharger les recettes"}
            </button>
          </li>
          {#if isDev}
            <li class="border-base-100 my-1 border-t"></li>
            <li>
              <button
                onclick={handleRefreshAllStores}
                disabled={isRefreshingAll}
                class="text-info disabled:opacity-50"
              >
                <DatabaseIcon
                  size={16}
                  class={isRefreshingAll ? "animate-pulse" : ""}
                />
                {isRefreshingAll ? "Refresh..." : "Force Refresh All (Dev)"}
              </button>
            </li>
          {/if}
          <li class="border-base-100 my-1 border-t"></li>
          <li>
            <button class="text-error hover:bg-error/10" onclick={handleLogout}
              ><LogOutIcon size={16} /> Se déconnecter</button
            >
          </li>
        </ul>
      </div>
    {:else}
      <button class="btn btn-primary btn-sm shadow-md" onclick={handleLogin}>
        <LogInIcon size={16} />
        Connexion
      </button>
    {/if}
  </div>
</div>

<!-- SECTION SÉPARÉE : SEULEMENT SUR MOBILE (NON-STICKY) -->
{#if !globalState.isDesktop}
  <div class="border-base-300 bg-base-100 border-b px-4 py-3">
    {#if context?.type === "materiel" || context?.type === "loans"}
      <MaterielTabs currentTeamId={context.teamId} />
    {:else if context?.type === "eventEdit"}
      <EventTabs eventId={context.eventId} basePath={context.basePath} />
    {:else if context?.type === "documentEdit"}
      <DocumentTabs />
    {:else if navBarStore.title}
      <h1
        class="text-center text-sm font-bold tracking-wider uppercase opacity-70"
      >
        {navBarStore.title}
      </h1>
    {/if}
  </div>
{/if}

<style>
  /* On garde juste ce qui est nécessaire pour sticky ou transitions spécifiques si non géré par DaisyUI */
  :global(.breadcrumbs ul li > button) {
    background: transparent;
    border: none;
    padding: 0;
    font-size: inherit;
    color: inherit;
    font-family: inherit;
    display: flex;
    align-items: center;
  }
</style>

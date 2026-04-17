<script lang="ts">
  import { navigate, p, route } from "$lib/router";
  import { refreshAllStores } from "$lib/utils/storesReload";
  import { globalState } from "../stores/GlobalState.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { recipesStore } from "../stores/RecipesStore.svelte";
  import { eventsStore } from "../stores/EventsStore.svelte";
  import { nativeTeamsStore } from "../stores/NativeTeamsStore.svelte";
  import EventTabs from "./eventEdit/EventTabs.svelte";
  import {
    allEventTabs,
    getEventActiveIndex,
    getEventTabPath,
  } from "./eventEdit/event-tabs-config";
  import InstallButton from "./ui/InstallButton.svelte";

  import {
    BookOpenIcon,
    Calendar,
    ChevronDown,
    CookingPot,
    DatabaseIcon,
    LayoutDashboardIcon,
    LockIcon,
    LogInIcon,
    LogOutIcon,
    Package,
    PlusIcon,
    RefreshCwIcon,
    UserIcon,
    Users,
  } from "@lucide/svelte";

  import { formatDateShort } from "$lib/utils/products-display";

  let showDropdown = $state(false);
  let isReloading = $state(false);
  let isRefreshingAll = $state(false);

  // Détection mode dev
  const isDev = import.meta.env.DEV;

  // Détection automatique du contexte via le router
  // Extrait toutes les informations de contexte depuis l'URL courante
  type ContextType =
    | { type: "eventEdit"; basePath: string; eventId: string }
    | { type: "eventDocumentEdit"; eventId: string; docId: string }
    | { type: "eventDocumentCreate"; eventId: string }
    | { type: "materiel"; teamId: string }
    | { type: "loans"; teamId: string }
    | { type: "documentEdit"; teamId: string; docId: string }
    | null;

  const context: ContextType = $derived.by(() => {
    const pathname = route.pathname;
    const params = route.params;

    // Routes documents événement: /event/:id/document/:docId/edit
    if (
      pathname.includes("/event/") &&
      pathname.includes("/document/") &&
      params.id &&
      params.docId
    ) {
      return {
        type: "eventDocumentEdit",
        eventId: params.id as string,
        docId: params.docId as string,
      };
    }

    // Routes création document événement: /event/:id/document/new
    if (
      pathname.includes("/event/") &&
      pathname.includes("/document/new") &&
      params.id
    ) {
      return {
        type: "eventDocumentCreate",
        eventId: params.id as string,
      };
    }

    // Routes documents événement (liste): /event/:id/documents
    if (
      pathname.includes("/event/") &&
      pathname.endsWith("/documents") &&
      params.id
    ) {
      return {
        type: "eventEdit",
        basePath: "/event",
        eventId: params.id as string,
      };
    }

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

  // ---------------------------------------------------------------------------
  // Event tabs context helper (pour le dropdown navbar)
  // ---------------------------------------------------------------------------
  const eventContext = $derived(
    context?.type === "eventEdit" ||
      context?.type === "eventDocumentEdit" ||
      context?.type === "eventDocumentCreate"
      ? {
          eventId: context.eventId,
          basePath: context.type === "eventEdit" ? context.basePath : "/event",
        }
      : null,
  );

  const eventActiveIdx = $derived(
    eventContext ? getEventActiveIndex(route.pathname) : -1,
  );

  const eventActiveTab = $derived(
    eventActiveIdx >= 0 ? allEventTabs[eventActiveIdx] : null,
  );

  const eventOtherTabs = $derived(
    eventActiveIdx >= 0
      ? allEventTabs.filter((_, i) => i !== eventActiveIdx)
      : [],
  );

  const eventTitle = $derived(
    eventContext ? eventsStore.getEventById(eventContext.eventId)?.name : null,
  );

  // 2 prochains événements de l'utilisateur (pour le dropdown)
  const upcomingEvents = $derived(
    eventsStore.getUpcomingEventsForUser().slice(0, 2),
  );

  // L'onglet actif a-t-il une LeftPanel ? (recettes=1, produits=2, affiches=5)
  const hasLeftPanel = $derived(
    eventActiveIdx === 1 ||
      eventActiveIdx === 2 ||
      eventActiveIdx === 4 ||
      eventActiveIdx === 5,
  );

  // Obtenir le chemin pour la page matériel
  function getMaterielPath(): string {
    const teamId =
      context?.type === "materiel" || context?.type === "loans"
        ? context.teamId
        : null;

    if (teamId) {
      return `/dashboard/materiel/${teamId}`;
    }

    const myTeams = nativeTeamsStore.myTeams;
    if (myTeams.length > 0) {
      return `/dashboard/materiel/${myTeams[0].$id}`;
    }

    return "/dashboard/materiel";
  }

  // Obtenir le chemin pour la page emprunts
  function getLoansPath(): string {
    const teamId =
      context?.type === "materiel" || context?.type === "loans"
        ? context.teamId
        : null;

    if (teamId) {
      return `/dashboard/loans/${teamId}`;
    }

    const myTeams = nativeTeamsStore.myTeams;
    if (myTeams.length > 0) {
      return `/dashboard/loans/${myTeams[0].$id}`;
    }

    return "/dashboard/loans";
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function closeAllCssDropdowns() {
    (document.activeElement as HTMLElement)?.blur();
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
  class="navbar bg-base-100 border-base-300 justify-items-between sticky top-0 z-1000 min-h-12 border-b px-4 py-0 shadow-sm transition-transform duration-300 print:hidden {globalState.isMobile &&
    'min-h-12'}
    {globalState.isMobile && !globalState.headerVisible
    ? '-translate-y-full'
    : ''}"
>
  <div class="navbar-start w-fit flex-1 shrink-0 gap-1">
    <!-- Brand -->
    <a
      href={globalState.isAuthenticated ? p("/dashboard") : p("/")}
      class="btn btn-ghost btn-sm max-sm:btn-circle"
    >
      <img src="/images/favicon.png" alt="logo" class="size-7" />
      <span class="hidden md:inline">Tableau de bord</span>
    </a>

    <!-- Permanent Nav Links -->
    <div class=" flex items-center gap-1">
      <a
        href={p("/recipe")}
        class="btn btn-sm btn-ghost not-md:btn-square md:gap-2"
      >
        <CookingPot size={18} />
        <span class="hidden md:inline">Recettes</span>
      </a>
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

  <!-- navbar-center : onglet actif + dropdown des autres routes -->
  <div class="navbar-center mx-auto min-w-0 flex-1 items-center px-2">
    {#if eventContext && eventActiveTab}
      <div class="dropdown mx-auto">
        <div
          tabindex="0"
          role="button"
          class="btn max-sm:btn-sm btn-ghost font-family-fredoka gap-2 font-bold uppercase"
        >
          {#if globalState.isDesktop && eventTitle}
            <span class="max-w-28 truncate opacity-70">{eventTitle}</span>
            <span class="text-xs opacity-40">›</span>
          {/if}
          <span class="opacity-80">{eventActiveTab.label}</span>
          <ChevronDown size={16} class="opacity-50" />
        </div>
        <ul
          class="menu dropdown-content bg-base-100 border-base-200 z-1 mt-3 w-48 rounded-xl border p-2 font-medium shadow-xl"
        >
          {#each eventOtherTabs as tab (tab.relativePath)}
            {@const TabIcon = tab.icon}
            <li>
              <a
                href={getEventTabPath(
                  tab,
                  eventContext.eventId,
                  eventContext.basePath,
                )}
                onclick={closeAllCssDropdowns}
              >
                <TabIcon size={16} />
                {tab.label}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {:else if context?.type === "materiel" || context?.type === "loans"}
      <!-- Dropdown Matériel/Reservations (pattern events) -->
      <div class="dropdown mx-auto">
        <div
          tabindex="0"
          role="button"
          class="btn btn-ghost font-family-fredoka gap-1 font-bold uppercase"
        >
          <span class="opacity-80">
            {context?.type === "loans" ? "Réservations" : "Matériel"}
          </span>
          <ChevronDown size={14} class="opacity-50" />
        </div>
        <ul
          class="menu dropdown-content bg-base-100 border-base-200 z-1 mt-3 w-48 rounded-xl border p-2 shadow-xl"
        >
          <li>
            <a href={getMaterielPath()} onclick={closeAllCssDropdowns}>
              <Package size={16} />
              Matériel
            </a>
          </li>
          <li>
            <a href={getLoansPath()} onclick={closeAllCssDropdowns}>
              <Users size={16} />
              Réservations
            </a>
          </li>
        </ul>
      </div>
    {:else if context?.type === "documentEdit"}
      <span class="btn btn-sm btn-ghost font-medium">Documents</span>
    {:else if navBarStore.title}
      <h1
        class="font-family-fredoka mx-auto truncate text-sm font-bold tracking-wider uppercase opacity-70"
        title={navBarStore.title}
      >
        {navBarStore.title}
      </h1>
    {/if}
  </div>

  <div class="navbar-end z-10 ms-auto w-fit flex-1 shrink-0 gap-4">
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
          class="btn btn-sm btn-ghost btn-circle avatar bg-primary/10 text-primary border-primary/20 border"
        >
          <div
            class="flex w-10 items-center justify-center rounded-full text-lg font-bold"
          >
            {globalState.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
        </div>
        <ul
          class="menu dropdown-content bg-base-100 border-base-200 z-1 mt-3 w-60 rounded-xl border p-2 shadow-xl"
        >
          <!-- Email -->
          <li class="border-base-100 mb-1 border-b px-4 py-2">
            <span
              class="block truncate p-0 text-xs font-medium italic opacity-60"
            >
              {globalState.user?.email}
            </span>
          </li>

          <!-- Navigation -->
          <li>
            <a
              href={p("/dashboard")}
              class="flex items-center gap-2"
              onclick={closeAllCssDropdowns}
            >
              <LayoutDashboardIcon size={16} /> Dashboard
            </a>
          </li>
          <li>
            <a
              href={p("/dashboard/user")}
              class="flex items-center gap-2"
              onclick={closeAllCssDropdowns}
            >
              <UserIcon size={16} /> Mon compte
            </a>
          </li>

          <!-- Création & contenu -->
          <li class="border-base-100 my-1 border-t"></li>
          <li>
            <a
              href={p("/dashboard/eventCreate")}
              class="flex items-center gap-2"
              onclick={closeAllCssDropdowns}
            >
              <PlusIcon size={16} /> Nouvel événement
            </a>
          </li>
          <li>
            <a
              href={p("/recipe/new")}
              class="flex items-center gap-2"
              onclick={closeAllCssDropdowns}
            >
              <PlusIcon size={16} /> Nouvelle recette
            </a>
          </li>
          <li>
            <a
              href={p("/recipe")}
              class="flex items-center gap-2"
              onclick={closeAllCssDropdowns}
            >
              <BookOpenIcon size={16} /> Recettes
            </a>
          </li>

          <!-- Prochains événements -->
          {#if upcomingEvents.length > 0}
            <li class="border-base-100 my-1 border-t"></li>
            <li
              class="pointer-events-none px-4 pt-1 pb-0.5 text-xs font-semibold uppercase opacity-40"
            >
              Prochains événements
            </li>
            {#each upcomingEvents as event (event.$id)}
              <li>
                <a
                  href={`/event/${event.$id}`}
                  class="flex items-center gap-2"
                  onclick={closeAllCssDropdowns}
                >
                  <Calendar size={16} class="shrink-0 opacity-60" />
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="truncate text-sm" title={event.name}>
                      {event.name}
                    </span>
                    <span class="truncate text-xs opacity-50">
                      {event.dateStart
                        ? formatDateShort(event.dateStart)
                        : "N/A"}
                    </span>
                  </div>
                </a>
              </li>
            {/each}
          {/if}

          <!-- Actions -->
          <li class="border-base-100 my-1 border-t"></li>
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
          <li><InstallButton /></li>
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

<!-- SECTION SOUS NAVBAR : tabs (non-sticky, tout le temps) -->
{#if eventContext}
  <div
    class=" h-fit px-4 py-2 print:hidden {globalState.isDesktop && hasLeftPanel
      ? 'ml-96'
      : ''}"
  >
    <EventTabs
      eventId={eventContext.eventId}
      basePath={eventContext.basePath}
    />
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

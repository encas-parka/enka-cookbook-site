<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import type { RecipeForDisplay } from "$lib/types/recipes.types";
  import type { SavedPosterConfig } from "$lib/components/eventPoster/poster.types";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { navigate, route } from "$lib/router";
  import { AlertCircle, Info, Printer } from "@lucide/svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { isDemoEvent } from "../data/demo-event-config";
  import LeftPanel from "../components/ui/LeftPanel.svelte";
  import EventInvitationAlert from "../components/EventInvitationAlert.svelte";
  import PosterDisplay from "../components/eventPoster/PosterDisplay.svelte";
  import PosterConfiguration from "../components/eventPoster/PosterConfiguration.svelte";
  import { fade } from "svelte/transition";

  // Event data
  let eventId = $derived(route.params.id);

  let event = $derived(eventId && eventsStore.getEventById(eventId));

  let eventLoading = $state(false);
  let eventError = $state<string | null>(null);
  let recipesDetails = $state<RecipeForDisplay[]>([]);
  let recipesLoading = $state(false);

  // Poster configuration state
  let config = $state({
    showDate: true,
    showHoraire: true,
    showDescription: false,
    showCategories: true,
    showRecipes: true,
    showRegimes: false,
    showAllergens: false,
    showIngredients: false,
    catPageBreak: false,
    dateByPageBreak: false,
    messageTop: "",
    fontTop: "montserrat-font",
    fontSizeTop: 1,
    boldTop: false,
    italicTop: false,
    messageBottom: "",
    fontBottom: "montserrat-font",
    fontSizeBottom: 1,
    boldBottom: false,
    italicBottom: false,
    // Font styles
    fontDate: "montserrat-font",
    fontSizeDate: 1,
    boldDate: false,
    italicDate: false,
    fontHoraire: "montserrat-font",
    fontSizeHoraire: 1,
    boldHoraire: false,
    italicHoraire: false,
    fontCat: "montserrat-font",
    fontSizeCat: 1,
    boldCat: false,
    italicCat: false,
    fontRecettes: "pacifico-regular",
    fontSizeRecettes: 2,
    boldRecettes: false,
    italicRecettes: false,
    fontDesc: "montserrat-font",
    fontSizeDesc: 1,
    boldDesc: false,
    italicDesc: false,
    fontRegimes: "montserrat-font",
    fontSizeRegimes: 1,
    boldRegimes: false,
    italicRegimes: false,
    fontAlert: "montserrat-font",
    fontSizeAlert: 1,
    boldAlert: false,
    italicAlert: false,
    fontIng: "montserrat-font",
    fontSizeIng: 1,
    boldIng: false,
    italicIng: false,
    centerVertical: true,
  });

  // Saved versions state
  let versions = $state<SavedPosterConfig[]>([]);
  let activeVersionId = $state<string | null>(null);

  // Print state - null = print all, string = print only this section
  let currentPrintTarget = $state<string | null>(null);

  // Invitation state
  let isBusy = $state(false);

  // Check if user has accepted invitation
  const canEdit = $derived.by(() => {
    if (!event) return false;

    const userId = globalState.userId || "";

    // Creator can always edit and demo events
    if (event.createdBy === userId || isDemoEvent(event.$id)) return true;

    // Contributor with accepted status can edit
    const contributor = event.contributors?.find((c) => c.id === userId);

    return contributor?.status === "accepted";
  });

  // Recipe modifications (temporary for printing)
  let recipeVisibility = $state<Record<string, boolean>>({});
  let recipeNames = $state<Record<string, string>>({});
  let editingRecipe = $state<string | null>(null);

  // Grouped meals by date and horaire
  type GroupedMeals = SvelteMap<string, SvelteMap<string, any[]>>;

  let groupedMeals: GroupedMeals = $derived.by(() => {
    if (!event?.meals) return new SvelteMap<string, SvelteMap<string, any[]>>();

    const grouped: GroupedMeals = new SvelteMap<
      string,
      SvelteMap<string, any[]>
    >();

    event.meals.forEach((meal) => {
      const date = new Date(meal.date);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      // Extract horaire from time
      const hours = date.getHours();
      const horaire =
        hours < 12
          ? "Petit-déjeuner"
          : hours < 14
            ? "Déjeuner"
            : hours < 18
              ? "Goûter"
              : "Dîner";

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new SvelteMap());
      }

      const dateGroup = grouped.get(dateKey)!;
      if (!dateGroup.has(horaire)) {
        dateGroup.set(horaire, []);
      }

      dateGroup.get(horaire)!.push(meal);
    });

    return grouped;
  });

  // Load event on mount
  onMount(() => {
    (async () => {
      // Le guard a déjà initialisé le store, l'event devrait être disponible
      if (!event) {
        eventLoading = true;
        try {
          await eventsStore.fetchEvent(route.params.id);
          // event is automatically updated via $derived after fetch
        } catch (err) {
          eventError =
            err instanceof Error ? err.message : "Erreur de chargement";
        } finally {
          eventLoading = false;
        }
      }

      // Charger la configuration sauvegardée
      await loadSavedConfig();
    })();
  });

  async function loadSavedConfig() {
    try {
      const container = await eventsStore.loadPosterConfig(route.params.id);
      if (container) {
        console.log("[EventPoster] Configuration chargée depuis le cache");
        // Si c'est un container V2
        if (container.current) {
          config = { ...config, ...container.current };
          versions = container.versions || [];
        } else {
          // Fallback legacy (ne devrait plus arriver avec la migration, mais sécu)
          config = { ...config, ...container };
          versions = [];
        }
      }
    } catch (err) {
      console.error("[EventPoster] Erreur chargement config cache:", err);
    }
  }

  async function saveConfig() {
    try {
      await eventsStore.savePosterConfig(
        route.params.id,
        $state.snapshot(config),
      );
      globalState.toast.success("Configuration sauvegardée", {
        details: "Les réglages courants sont enregistrés localement.",
      });
    } catch (err) {
      console.error("[EventPoster] Erreur sauvegarde config cache:", err);
      globalState.toast.error("Erreur de sauvegarde", {
        details: "Impossible d'enregistrer la configuration localement.",
      });
    }
  }

  async function createVersion() {
    try {
      const now = new Date();
      const formattedDate = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(now);
      const name = `Version du ${formattedDate}`;

      const newVersion = await eventsStore.createPosterVersion(
        route.params.id,
        $state.snapshot(config),
        name,
      );

      // Recharger pour avoir la liste à jour
      await loadSavedConfig();

      if (newVersion) {
        activeVersionId = newVersion.id;
      }

      globalState.toast.success("Version créée", {
        details: "Une nouvelle version de la configuration a été archivée.",
      });
    } catch (err: any) {
      console.error("[EventPoster] Erreur création version:", err);
      globalState.toast.error("Erreur de création", {
        details: err.message || "Impossible de créer une nouvelle version.",
      });
    }
  }

  async function deleteVersion(versionId: string) {
    try {
      await eventsStore.deletePosterVersion(route.params.id, versionId);

      // Update local state directly to avoid full reload flicker
      versions = versions.filter((v) => v.id !== versionId);

      if (activeVersionId === versionId) {
        activeVersionId = null;
      }

      globalState.toast.success("Version supprimée", {
        details: "La version archivée a été supprimée.",
      });
    } catch (err) {
      console.error("[EventPoster] Erreur suppression version:", err);
      globalState.toast.error("Erreur de suppression", {
        details: "Impossible de supprimer la version.",
      });
    }
  }

  function loadVersion(version: SavedPosterConfig) {
    config = { ...config, ...version.config };
    activeVersionId = version.id;
    globalState.toast.info("Version chargée", {
      details: `La configuration "${version.name}" a été appliquée.`,
    });
  }

  // Load recipes when event is loaded (using $effect like EventRecipesPage)
  $effect(() => {
    if (!event || eventLoading) return;

    // Check if event has meals with recipes
    const hasRecipes =
      event.meals &&
      event.meals.some((meal) => meal.recipes && meal.recipes.length > 0);

    if (!hasRecipes) {
      // No recipes to load - mark as not loading
      recipesLoading = false;
      return;
    }

    // Only load if we haven't loaded yet
    if (recipesDetails.length === 0 && !recipesLoading) {
      loadEventRecipes().then(() => {
        // Initialize recipe visibility and names after recipes are loaded
        initializeRecipeState();
      });
    }
  });

  // Load all recipes for the event (pattern from EventRecipesPage)
  async function loadEventRecipes() {
    if (!event?.meals) return;

    // OPTIMISATION BULK : Extraire tous les UUIDs de recettes
    const allRecipeUuids = event.meals.flatMap((meal) =>
      meal.recipes.map((mealRecipe: any) => mealRecipe.recipeUuid),
    );

    // Early return if no recipes
    if (allRecipeUuids.length === 0) {
      recipesLoading = false;
      return;
    }

    recipesLoading = true;
    try {
      console.log(
        `[EventPoster] Loading ${allRecipeUuids.length} recipes (bulk mode)...`,
      );

      // Utiliser la méthode bulk pour charger en une seule transaction IDB
      const recipesMap =
        await recipesStore.getRecipesByUuidsBulk(allRecipeUuids);

      // Convertir la Map en array
      recipesDetails = Array.from(recipesMap.values()).filter(
        (r): r is RecipeForDisplay => r !== null,
      );

      console.log(
        `[EventPoster] Loaded ${recipesDetails.length}/${allRecipeUuids.length} recipes in bulk`,
      );
      console.log(
        `[EventPoster] Recipe IDs:`,
        recipesDetails.map((r) => r.$id),
      );
    } catch (err) {
      console.error("Erreur lors du chargement des recettes:", err);
    } finally {
      recipesLoading = false;
    }
  }

  function initializeRecipeState() {
    if (!event?.meals) return;

    event.meals.forEach((meal) => {
      const date = new Date(meal.date);
      const dateKey = date.toISOString().split("T")[0];
      const hours = date.getHours();
      const horaire =
        hours < 12
          ? "Petit-déjeuner"
          : hours < 14
            ? "Déjeuner"
            : hours < 18
              ? "Goûter"
              : "Dîner";
      const mealKey = `${dateKey}${horaire}`;

      meal.recipes.forEach((recipe) => {
        const recipeKey = `${mealKey}_${recipe.recipeUuid}`;
        recipeVisibility[recipeKey] = true;
        // Get recipe name
        const indexEntry = recipesStore.getRecipeIndexByUuid(recipe.recipeUuid);
        recipeNames[recipeKey] = indexEntry?.title || recipe.recipeUuid;
      });
    });
  }

  // Print functions
  async function printThis(sectionId: string) {
    currentPrintTarget = sectionId;
    await tick();
    setTimeout(() => {
      window.print();
      currentPrintTarget = null;
    }, 400);
  }

  async function printAll() {
    currentPrintTarget = null;
    await tick();
    setTimeout(() => {
      window.print();
    }, 400);
  }

  // Recipe modification functions
  function toggleRecipeVisibility(recipeKey: string) {
    recipeVisibility[recipeKey] = !recipeVisibility[recipeKey];
    if (!recipeVisibility[recipeKey]) {
      console.log("to-implement");
    }
  }

  function startEditingRecipe(recipeKey: string) {
    editingRecipe = recipeKey;
  }

  function finishEditingRecipe() {
    editingRecipe = null;
  }

  function updateRecipeName(recipeKey: string, newName: string) {
    recipeNames[recipeKey] = newName;
  }

  function getRecipeName(recipeKey: string, originalName: string) {
    return recipeNames[recipeKey] || originalName;
  }

  async function handleInvitationResponse(accept: boolean) {
    if (!route.params.id || !globalState.userId) return;

    try {
      isBusy = true;

      const newStatus = accept ? "accepted" : "declined";

      await eventsStore.updateContributorStatus(
        route.params.id,
        globalState.userId,
        newStatus,
      );

      globalState.toast.success(
        accept ? "Invitation acceptée" : "Invitation déclinée",
      );
    } catch (error) {
      console.error("Erreur réponse invitation:", error);
      globalState.toast.error("Erreur lors de la réponse");
    } finally {
      isBusy = false;
    }
  }

  // Configure nav bar
  $effect(() => {
    if (event) {
      navBarStore.setConfig({
        title: `Affiches : ${event.name}`,
        actions: navActions,
      });
    }
  });

  // Cleanup nav bar on unmount
  onDestroy(() => {
    navBarStore.reset();
  });
</script>

{#snippet navActions()}
  <button class="btn btn-primary btn-sm gap-2" onclick={printAll}>
    <Printer class="h-5 w-5" />
    Imprimer tout
  </button>
{/snippet}

{#if eventLoading}
  <div class="flex min-h-[60vh] items-center justify-center">
    <div class="loading loading-spinner loading-lg text-primary"></div>
  </div>
{:else if eventError}
  <div class="container mx-auto p-4">
    <div class="alert alert-error max-md:alert-vertical">
      <AlertCircle class="h-6 w-6 shrink-0" />
      <span>{eventError}</span>
    </div>
  </div>
{:else if !event || (event.meals && event.meals.length > 0 && event.meals.every((meal) => !meal.recipes || meal.recipes.length === 0))}
  <div class="flex min-h-[60vh] items-center justify-center">
    <div class="alert alert-info alert-vertical">
      <Info />
      <p class="text-lg">Aucune recette pour le moment</p>
    </div>
  </div>
{:else if event}
  <!-- Left Panel for Configuration -->
  <LeftPanel bgClass="bg-base-200" width="120">
    <PosterConfiguration
      bind:config
      {versions}
      {activeVersionId}
      onSave={saveConfig}
      onCreateVersion={createVersion}
      onDeleteVersion={deleteVersion}
      onLoadVersion={loadVersion}
      disabled={!canEdit}
    />
  </LeftPanel>

  <!-- Main Content Area with left margin for desktop -->
  <div
    class="bg-base-200 min-h-screen print:h-auto print:min-h-0"
    transition:fade
  >
    <!-- Invitation Alert -->
    <div class="mx-auto px-4 py-4 print:hidden">
      <EventInvitationAlert
        currentEvent={event}
        {isBusy}
        onRespond={handleInvitationResponse}
      />
    </div>

    <div class="print:m-0 print:p-0 {globalState.isDesktop ? 'ml-80' : ''}">
      <PosterDisplay
        {event}
        {groupedMeals}
        {config}
        {currentPrintTarget}
        {recipesDetails}
        {recipeVisibility}
        {recipeNames}
        {editingRecipe}
        {printThis}
        {toggleRecipeVisibility}
        {startEditingRecipe}
        {finishEditingRecipe}
        {updateRecipeName}
        {getRecipeName}
      />
    </div>
  </div>
{/if}

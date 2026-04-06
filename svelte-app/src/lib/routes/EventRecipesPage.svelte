<script lang="ts">
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import {
    getTotalGuests,
    getTotalRecipes,
  } from "$lib/utils/event-stats-helpers";
  import { navigate, route } from "$lib/router";
  import { onMount, tick } from "svelte";
  import EventStats from "$lib/components/EventStats.svelte";
  import EventRecipeCard from "$lib/components/eventEdit/EventRecipeCard.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import AutocompleteInput from "$lib/components/ui/AutocompleteInput.svelte";
  import { formatDateShort } from "$lib/utils/products-display";
  import {
    ArrowLeft,
    Calendar,
    CookingPot,
    Utensils,
    Eye,
    X,
    Funnel,
    Printer,
  } from "@lucide/svelte";
  import { extractTime, formatDateWdDayMonth } from "../utils/date-helpers";
  import { globalState } from "../stores/GlobalState.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { fade } from "svelte/transition";

  // État local
  let loading = $state(true);
  let error = $state<string | null>(null);
  let eventId = $derived(route.params.id ?? null);

  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  let eventMeals = $state<any[]>([]);
  let recipesDetails = $state<any[]>([]);

  // Pour éviter les rechargements en boucle
  let isLoading = $state(false);

  // État pour la recherche par ingrédient (un seul à la fois)
  let selectedIngredient = $state<string>("");
  let ingredientSearch = $state("");

  // Extraire tous les ingrédients uniques des recettes de l'événement
  const availableIngredients = $derived.by(() => {
    const ingredientsSet = new Set<string>();
    recipesDetails.forEach((recipe) => {
      recipe.ingredients?.forEach((ingredient: any) => {
        if (ingredient.name) {
          ingredientsSet.add(ingredient.name);
        }
      });
    });
    return Array.from(ingredientsSet).sort();
  });

  // Ingrédients disponibles pour l'autocomplétion (exclut celui déjà sélectionné)
  const availableIngredientsForAutocomplete = $derived(
    selectedIngredient
      ? availableIngredients.filter((ing) => ing !== selectedIngredient)
      : availableIngredients,
  );

  // État pour les filtres de date, moment et recette individuelle
  let selectedDateFilter = $state<string | null>(null);
  let selectedTimeFilter = $state<string | null>(null);
  let selectedMealRecipeFilter = $state<string | null>(null); // Format: "mealId-recipeIndex"
  let selectedUndatedFilter = $state<boolean>(false); // Filtre "mise de côté"

  // Repas filtrés par date et moment (pour l'affichage principal)
  const filteredMeals = $derived.by(() => {
    if (selectedUndatedFilter) {
      return eventMeals.filter((meal) => meal.date === "");
    }
    if (!selectedDateFilter) return eventMeals.filter((meal) => meal.date !== "");

    return eventMeals.filter((meal) => {
      if (meal.date === "") return false;
      const date = formatDateShort(meal.date);
      const time = extractTime(meal.date);

      const dateMatch = date === selectedDateFilter;
      const timeMatch = !selectedTimeFilter || time === selectedTimeFilter;

      return dateMatch && timeMatch;
    });
  });

  // Recettes mises de côté (meals sans date)
  const undatedMeals = $derived(eventMeals.filter((meal) => meal.date === ""));

  // Recettes filtrées par ingrédients ET par filtres de date/moment
  const filteredRecipes = $derived.by(() => {
    let recipes = recipesDetails;

    // Filtrer par la recherche d'ingrédient
    if (selectedIngredient) {
      recipes = recipes.filter((recipe) =>
        recipe.ingredients?.some(
          (ingredient: any) =>
            ingredient.name &&
            ingredient.name.toLowerCase() === selectedIngredient.toLowerCase(),
        ),
      );
    }

    // Filtrer par date/moment sélectionnés
    if (selectedDateFilter) {
      const filteredMealRecipes = new Set();
      filteredMeals.forEach((meal) => {
        meal.recipes.forEach((mealRecipe: any) => {
          filteredMealRecipes.add(mealRecipe.recipeUuid);
        });
      });

      recipes = recipes.filter((recipe: any) =>
        filteredMealRecipes.has(recipe.$id),
      );
    }

    return recipes;
  });

  // Organisation des repas pour le sommaire (par date et moment, exclut les meals sans date)
  const mealsByDate = $derived.by(() => {
    const groups = new Map();
    eventMeals.forEach((meal) => {
      if (meal.date === "") return;

      const date = formatDateShort(meal.date);
      const time = extractTime(meal.date);

      if (!groups.has(date)) {
        groups.set(date, new Map());
      }
      if (!groups.get(date).has(time)) {
        groups.get(date).set(time, []);
      }
      groups.get(date).get(time).push(meal);
    });
    return groups;
  });

  // Calculer les informations de l'événement
  const eventName = $derived(currentEvent?.name ?? "");
  const startDate = $derived(currentEvent?.dateStart ?? null);
  const endDate = $derived(currentEvent?.dateEnd ?? null);
  const totalGuests = $derived(getTotalGuests(currentEvent));
  const totalRecipes = $derived(getTotalRecipes(currentEvent));

  // Charger les données
  async function loadEventData(currentEventId: string) {
    if (isLoading || !currentEventId) return;

    loading = true;
    isLoading = true;
    error = null;

    try {
      // Note: eventsStore et recipesStore sont déjà initialisés via App.svelte (loadCache + syncFromRemote)

      // Récupérer les repas de l'événement
      const event = eventsStore.getEventById(currentEventId);
      if (!event) {
        error = "Événement non trouvé";
        return;
      }

      eventMeals = event.meals || [];

      // OPTIMISATION BULK : Charger toutes les recettes en une seule transaction IDB
      // Extraire tous les UUIDs de recettes uniques
      const allRecipeUuids = eventMeals.flatMap((meal) =>
        meal.recipes.map((mealRecipe: any) => mealRecipe.recipeUuid),
      );

      // Utiliser la méthode bulk pour charger en une seule transaction
      const recipesMap =
        await recipesStore.getRecipesByUuidsBulk(allRecipeUuids);

      // Convertir la Map en array
      // Note: preparationHtml et preparation24hHtml sont déjà parsés par RecipesStore
      recipesDetails = Array.from(recipesMap.values()).filter(Boolean);

      console.log(
        `[EventRecipesPage] ${recipesDetails.length}/${allRecipeUuids.length} recettes chargées`,
      );
    } catch (err) {
      console.error("Erreur lors du chargement des données:", err);
      error = err instanceof Error ? err.message : "Erreur lors du chargement";
    } finally {
      loading = false;
      isLoading = false;
    }
  }

  // Charger au montage
  onMount(async () => {
    const id = eventId;
    if (!id) {
      error = "ID d'événement manquant";
      loading = false;
      return;
    }

    try {
      // Le guard a déjà initialisé le store et vérifié l'event
      // Charger les données de l'événement
      await loadEventData(id);
    } catch (err) {
      console.error("[EventRecipesPage] Erreur lors du chargement:", err);
      error = err instanceof Error ? err.message : "Erreur lors du chargement";
      loading = false;
    }
  });

  // Surveiller les changements realtime de l'événement
  $effect(() => {
    if (!eventId) return;

    const currentEvent = eventsStore.getEventById(eventId);
    if (!currentEvent) return;

    // Comparer les meals pour éviter les boucles infinies
    const currentMealsJson = JSON.stringify(currentEvent.meals);
    const localMealsJson = JSON.stringify(eventMeals);

    if (currentMealsJson !== localMealsJson && !isLoading) {
      console.log(
        "[EventRecipesPage] Meals mis à jour via realtime, rafraîchissement...",
      );
      loadEventData(eventId);
    }
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
    });
  });

  // Gestion de l'ingrédient sélectionné
  function selectIngredient(ingredient: string) {
    selectedIngredient = ingredient;
    // Reset les filtres de date/recette/mise de côté
    selectedDateFilter = null;
    selectedTimeFilter = null;
    selectedMealRecipeFilter = null;
    selectedUndatedFilter = false;
  }

  function resetIngredientFilter() {
    selectedIngredient = "";
  }
</script>

{#snippet navActions()}
  <div class="flex gap-2 max-sm:hidden">
    <button class="btn btn-circle btn-primary" onclick={() => window.print()}
      ><Printer size={18} /></button
    >
  </div>
{/snippet}

<div class="bg-base-200" in:fade>
  <!-- LeftPanel avec recherche et sommaire -->
  <div class="print:hidden">
    <LeftPanel>
      <!-- Champ de recherche par ingrédient avec autocomplétion -->
      <button
        class="absolute -z-50 size-0 opacity-0"
        tabindex="-1"
        aria-hidden="true"
      ></button>
      <div class="my-6">
        <h3 class="mb-3 text-lg font-semibold">Rechercher par ingrédient</h3>

        <div class="relative">
          <AutocompleteInput
            items={availableIngredientsForAutocomplete}
            onSelect={selectIngredient}
            placeholder={selectedIngredient || "Filtrer par ingrédients..."}
            minQueryLength={1}
            bind:value={ingredientSearch}
          />
          {#if selectedIngredient}
            <button
              class="btn btn-circle btn-error btn-outline btn-xs absolute top-1/2 right-2 z-10 -translate-y-1/2 opacity-60 hover:opacity-100"
              onclick={resetIngredientFilter}
              aria-label="Effacer la recherche"
            >
              <X size={14} />
            </button>
          {/if}
        </div>
      </div>

      <!-- Sommaire réactif des recettes avec filtrage -->
      <ul class="menu bg-base-100 rounded-box w-full drop-shadow-lg">
        {#each Array.from(mealsByDate.entries()) as [date, times] (date)}
          <li>
            <button
              class="btn btn-sm justify-start {selectedDateFilter === date &&
              !selectedTimeFilter
                ? 'btn-accent'
                : 'btn-ghost'}"
              onclick={() => {
                selectedTimeFilter = null; // Réinitialiser le filtre de temps
                selectedMealRecipeFilter = null; // Réinitialiser le filtre de recette
                selectedIngredient = ""; // Réinitialiser le filtre d'ingrédient
                selectedUndatedFilter = false; // Réinitialiser le filtre mise de côté
                selectedDateFilter = selectedDateFilter === date ? null : date;
              }}
            >
              <span>{date}</span>
            </button>
          </li>

          <ul>
            {#each Array.from((times as Map<string, any[]>).entries()) as [time, meals] (time)}
              <li>
                <button
                  class="btn btn-sm mb-1 h-auto justify-start pl-4 {selectedDateFilter ===
                    date && selectedTimeFilter === time
                    ? 'btn-accent'
                    : 'btn-ghost '}"
                  onclick={() => {
                    selectedDateFilter = date;
                    selectedTimeFilter =
                      selectedTimeFilter === time ? null : time;
                    selectedMealRecipeFilter = null; // Réinitialiser le filtre de recette
                    selectedIngredient = ""; // Réinitialiser le filtre d'ingrédient
                    selectedUndatedFilter = false; // Réinitialiser le filtre mise de côté
                  }}
                >
                  <span class="flex w-full items-center justify-between">
                    <span>
                      {time === "matin" ? "🌅" : time === "midi" ? "☀️" : "🌙"}
                      {time}
                    </span>
                  </span>
                </button>
              </li>
              <ul>
                {#each meals[0].recipes as mealRecipe, recipeIndex (mealRecipe.recipeUuid + "-" + recipeIndex)}
                  {@const recipe = recipesDetails.find(
                    (r) => r.$id === mealRecipe.recipeUuid,
                  )}
                  {@const mealRecipeKey =
                    (meals[0].id || meals[0].date) + "_" + recipeIndex}
                  {#if recipe}
                    <li>
                      <button
                        class="btn btn-sm mb-1 ml-8 justify-start {selectedMealRecipeFilter ===
                        mealRecipeKey
                          ? 'btn-accent'
                          : 'btn-ghost'}"
                        onclick={() => {
                          selectedDateFilter = null;
                          selectedTimeFilter = null;
                          selectedMealRecipeFilter =
                            selectedMealRecipeFilter === mealRecipeKey
                              ? null
                              : mealRecipeKey;
                          selectedIngredient = ""; // Réinitialiser le filtre d'ingrédient
                          selectedUndatedFilter = false; // Réinitialiser le filtre mise de côté
                        }}
                      >
                        <span class="truncate text-left text-wrap">
                          {recipe.title}
                        </span>
                      </button>
                    </li>
                  {/if}
                {/each}
              </ul>
            {/each}
          </ul>
        {/each}

        <!-- Section "Mise de côté" dans le sommaire -->
        {#if undatedMeals.length > 0}
          <li class="mt-2">
            <button
              class="btn btn-sm justify-start {selectedUndatedFilter
                ? 'btn-accent'
                : 'btn-ghost'}"
              onclick={() => {
                selectedDateFilter = null;
                selectedTimeFilter = null;
                selectedMealRecipeFilter = null;
                selectedIngredient = "";
                selectedUndatedFilter = !selectedUndatedFilter;
              }}
            >
              <span>📌 Mise de côté ({undatedMeals.reduce((count, m) => count + m.recipes.length, 0)})</span>
            </button>
          </li>
          {#if selectedUndatedFilter}
            <ul>
              {#each undatedMeals as undatedMeal (undatedMeal.id)}
                {#each undatedMeal.recipes as mealRecipe, recipeIndex (mealRecipe.recipeUuid + "-" + recipeIndex)}
                  {@const recipe = recipesDetails.find(
                    (r) => r.$id === mealRecipe.recipeUuid,
                  )}
                  {@const mealRecipeKey =
                    "undated_" + undatedMeal.id + "_" + recipeIndex}
                  {#if recipe}
                    <li>
                      <button
                        class="btn btn-sm mb-1 ml-4 justify-start {selectedMealRecipeFilter ===
                        mealRecipeKey
                          ? 'btn-accent'
                          : 'btn-ghost'}"
                        onclick={() => {
                          selectedDateFilter = null;
                          selectedTimeFilter = null;
                          selectedUndatedFilter = false;
                          selectedIngredient = "";
                          selectedMealRecipeFilter =
                            selectedMealRecipeFilter === mealRecipeKey
                              ? null
                              : mealRecipeKey;
                        }}
                      >
                        <span class="truncate text-left text-wrap">
                          {recipe.title}
                        </span>
                      </button>
                    </li>
                  {/if}
                {/each}
              {/each}
            </ul>
          {/if}
        {/if}
      </ul>

      {#if selectedDateFilter || selectedTimeFilter || selectedMealRecipeFilter || selectedUndatedFilter}
        <div class="my-4">
          <button
            class="btn btn-dash btn-block btn-primary"
            onclick={() => {
              selectedDateFilter = null;
              selectedTimeFilter = null;
              selectedMealRecipeFilter = null;
              selectedUndatedFilter = false;
            }}
            aria-label="Afficher toutes les recettes"
          >
            <Eye size={18} />
            Afficher toutes les recettes
          </button>
        </div>
      {/if}
    </LeftPanel>
  </div>
  <!-- Contenu principal -->
  <div class="print:ml-0 {globalState.isDesktop && ' ml-110'}">
    <div class="mx-auto max-w-6xl px-1 py-8 md:px-4">
      <!-- En-tête de l'événement -->
      {#if loading}
        <!-- Skeleton de l'en-tête -->
        <div class="mb-8 space-y-4 print:hidden">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-2">
              <div class="skeleton h-6 w-64"></div>
              <div class="skeleton h-4 w-48"></div>
            </div>
          </div>
          <div class="flex justify-end p-4">
            <div class="skeleton h-10 w-3/4"></div>
          </div>
        </div>

        <!-- Skeleton des cartes de recettes -->
        <div class="space-y-10 print:hidden">
          {#each Array(3) as _, i}
            <div class="space-y-6">
              <!-- Skeleton de l'en-tête de repas -->
              <div
                class="card bg-accent/20 flex flex-row items-center justify-center gap-6 p-4"
              >
                <div class="skeleton h-6 w-32"></div>
                <div class="skeleton h-6 w-20"></div>
                <div class="skeleton h-8 w-16 rounded-full"></div>
                <div class="skeleton h-8 w-16 rounded-full"></div>
              </div>

              <!-- Skeleton de la carte de recette -->
              <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                  <div class="flex justify-between">
                    <div class="flex-1">
                      <div class="mb-4">
                        <div class="skeleton mb-2 h-8 w-3/4"></div>
                        <div class="flex gap-2">
                          <div class="skeleton h-5 w-20 rounded-full"></div>
                          <div class="skeleton h-5 w-16 rounded-full"></div>
                        </div>
                      </div>

                      <!-- Skeleton des métadonnées -->
                      <div class="mb-4 flex flex-wrap gap-4 text-sm">
                        <div class="skeleton h-4 w-24"></div>
                        <div class="skeleton h-4 w-24"></div>
                        <div class="skeleton h-4 w-24"></div>
                      </div>

                      <!-- Skeleton des ingrédients -->
                      <div class="mb-6">
                        <h3
                          class="mb-2 flex items-center gap-2 font-semibold"
                          aria-label="Chargement des ingrédients"
                        >
                          <div class="skeleton h-5 w-6"></div>
                          <div class="skeleton h-5 w-32"></div>
                        </h3>
                        <div class="space-y-2">
                          {#each Array(4) as _, j}
                            <div class="skeleton h-4 w-full"></div>
                          {/each}
                        </div>
                      </div>

                      <!-- Skeleton de la préparation -->
                      <div>
                        <h3
                          class="mb-2 flex items-center gap-2 font-semibold"
                          aria-label="Chargement de la préparation"
                        >
                          <div class="skeleton h-5 w-6"></div>
                          <div class="skeleton h-5 w-32"></div>
                        </h3>
                        <div class="space-y-2">
                          {#each Array(3) as _, k}
                            <div class="flex gap-2">
                              <div class="skeleton h-4 w-6 shrink-0"></div>
                              <div class="skeleton h-4 w-full"></div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if error}
        <div class="alert alert-error">
          <div>
            <h3 class="font-bold">Erreur</h3>
            <div>{error}</div>
          </div>
        </div>
      {:else if eventName}
        <!-- Informations principales -->
        <div class="mb-8 space-y-4 print:hidden">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 class="">{eventName}</h1>
              <div class="text-base-content/60 text-sm">
                {#if startDate && endDate}
                  <Calendar class="inline h-4 w-4" />
                  {formatDateShort(startDate)} au {formatDateShort(endDate)}
                {:else if startDate}
                  <Calendar class="inline h-4 w-4" />
                  {formatDateShort(startDate)}
                {/if}
              </div>
            </div>
          </div>

          <!-- Statistiques -->
          <div class="flex justify-end p-4">
            <EventStats {currentEvent} />
          </div>

          <!-- filtre en cours -->
          {#if selectedDateFilter || selectedTimeFilter || selectedMealRecipeFilter || selectedIngredient || selectedUndatedFilter}
            <div class="m-4 flex flex-wrap items-center justify-center gap-2">
              <div class="badge badge-xl badge-primary">
                <Funnel class="mr-1 h-4 w-4" />
                filtre :
                {#if selectedUndatedFilter}
                  <span class="mr-1">📌 Mise de côté</span>
                {/if}
                {#if selectedDateFilter}
                  <span class="mr-1">{selectedDateFilter}</span>
                {/if}
                {#if selectedTimeFilter}
                  <span class="mr-1">{selectedTimeFilter}</span>
                {/if}
                {#if selectedMealRecipeFilter}
                  <span class="mr-1"> recette</span>
                {/if}
                {#if selectedIngredient}
                  <span>{selectedIngredient}</span>
                {/if}
              </div>
              <button
                class="btn btn-dash btn-sm"
                onclick={() => {
                  selectedDateFilter = null;
                  selectedTimeFilter = null;
                  selectedMealRecipeFilter = null;
                  selectedUndatedFilter = false;
                  selectedIngredient = "";
                }}
                aria-label="Afficher toutes les recettes"
              >
                <Eye class="h-4 w-4" />
                Afficher toutes les recettes
              </button>
            </div>
          {/if}
        </div>

        <!-- Grille des recettes -->
        {#if selectedIngredient}
          <!-- Mode recherche par ingrédient : afficher les recettes filtrées -->
          {#if filteredRecipes.length === 0}
            <div
              class="bg-base-100 border-base-300 rounded-xl border p-8 text-center print:hidden"
            >
              <p class="text-base-content/60 text-lg">
                Aucune recette ne contient l'ingrédient "{selectedIngredient}".
              </p>
            </div>
          {:else}
            <div class="space-y-8 print:space-y-0">
              {#each eventMeals as meal, mealIndex (meal.id || mealIndex)}
                {@const recipesMatchingSearch = meal.recipes.filter((mr: any) =>
                  filteredRecipes.some((fr) => fr.$id === mr.recipeUuid),
                )}
                {#if recipesMatchingSearch.length > 0}
                  <!-- Date break / Mise de côté header -->
                  <div
                    id="meal-{meal.date || 'undated'}"
                    class="card my-4 flex flex-row items-center justify-center gap-6 px-4 py-2 font-black print:hidden {meal.date
                      ? 'bg-accent text-accent-content'
                      : 'bg-warning/20 text-warning-content'}"
                  >
                    {#if meal.date}
                      <div class="">
                        {formatDateWdDayMonth(meal.date)}
                      </div>
                      <div>{extractTime(meal.date)}</div>
                    {:else}
                      <div class="flex items-center gap-2">
                        <span>📌</span>
                        <span>Mise de côté</span>
                      </div>
                    {/if}
                    <div class="badge badge-outline">
                      <Utensils size={16} />
                      {meal.guests}
                    </div>
                    <div class="badge badge-outline">
                      <CookingPot size={16} />
                      {recipesMatchingSearch.length}
                    </div>
                  </div>

                  <!-- Recettes qui correspondent à la recherche -->
                  {#each recipesMatchingSearch as mealRecipe, recipeIndex ((meal.id || mealIndex) + "-" + mealRecipe.recipeUuid + "-" + recipeIndex)}
                    {@const recipe = recipesDetails.find(
                      (r) => r.$id === mealRecipe.recipeUuid,
                    )}
                    <div class="page-break-after mb-8">
                      {#if recipe}
                        <EventRecipeCard
                          {recipe}
                          {meal}
                          {mealRecipe}
                          {totalGuests}
                        />
                      {/if}
                    </div>
                  {/each}
                {/if}
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Mode normal : afficher les repas filtrés par date/moment/recette -->
          {#if filteredMeals.length === 0 && (selectedDateFilter || selectedTimeFilter)}
            <div
              class="bg-base-100 border-base-300 rounded-xl border p-8 text-center"
            >
              <p class="text-base-content/60 text-lg">
                Aucune recette ne correspond aux filtres sélectionnés.
              </p>
              <button
                class="btn btn-primary mt-4"
                onclick={() => {
                  selectedDateFilter = null;
                  selectedTimeFilter = null;
                  selectedMealRecipeFilter = null;
                }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          {:else}
            <div class="space-y-10 print:space-y-0">
              {#each filteredMeals as meal, mealIndex (meal.id || mealIndex)}
                <!-- Filtrer les recettes individuellement si sélectionné -->
                {@const mealRecipesToDisplay = selectedMealRecipeFilter
                  ? (() => {
                      const [mealId, recipeIndex] =
                        selectedMealRecipeFilter.split("_");
                      if (mealId === "undated") {
                        const currentMealId = meal.id;
                        if (mealId !== "undated_" + currentMealId) return [];
                        return meal.recipes.filter(
                          (_mr: any, idx: number) =>
                            idx === parseInt(recipeIndex),
                        );
                      }
                      const currentMealId = meal.id || meal.date;
                      if (mealId !== currentMealId.toString()) return [];
                      return meal.recipes.filter(
                        (_mr: any, idx: number) =>
                          idx === parseInt(recipeIndex),
                      );
                    })()
                  : meal.recipes}

                {#if mealRecipesToDisplay.length > 0}
                  <!-- Date break / Mise de côté header -->
                  <div
                    id="meal-{meal.date || 'undated'}"
                    class="card my-4 flex flex-row flex-wrap items-center justify-center gap-4 p-2 font-black shadow-lg sm:gap-6 sm:px-4 sm:py-2 print:hidden {meal.date
                      ? 'bg-primary text-primary-content'
                      : 'bg-warning/20 text-warning-content'}"
                  >
                    {#if meal.date}
                      <div class="">
                        {formatDateWdDayMonth(meal.date)}
                      </div>
                      <div>{extractTime(meal.date)}</div>
                    {:else}
                      <div class="flex items-center gap-2">
                        <span>📌</span>
                        <span>Mise de côté</span>
                      </div>
                    {/if}
                    <div class="badge badge-outline">
                      <Utensils size={16} />
                      {meal.guests}
                    </div>
                    <div class="badge badge-outline">
                      <CookingPot size={16} />
                      {mealRecipesToDisplay.length}
                    </div>
                  </div>

                  <!-- Recettes -->
                  {#each mealRecipesToDisplay as mealRecipe, recipeIndex ((meal.id || mealIndex) + "-" + mealRecipe.recipeUuid + "-" + recipeIndex)}
                    {@const recipe = recipesDetails.find(
                      (r) => r.$id === mealRecipe.recipeUuid,
                    )}
                    <div class="page-break-after">
                      {#if recipe}
                        <EventRecipeCard
                          {recipe}
                          {meal}
                          {mealRecipe}
                          {totalGuests}
                        />
                      {/if}
                    </div>
                  {/each}
                {/if}
              {/each}
            </div>
            {#if selectedDateFilter || selectedTimeFilter || selectedMealRecipeFilter || selectedUndatedFilter}
              <button
                class="btn btn-dash btn-block my-5"
                onclick={() => {
                  selectedDateFilter = null;
                  selectedTimeFilter = null;
                  selectedMealRecipeFilter = null;
                  selectedUndatedFilter = false;
                  selectedIngredient = "";
                }}
                aria-label="Afficher toutes les recettes"
              >
                <Eye class="h-4 w-4" />
                Afficher toutes les recettes
              </button>
            {/if}
          {/if}
        {/if}

        <!-- Message si pas de recettes du tout -->
        {#if !selectedIngredient && recipesDetails.length === 0 && !loading}
          <div
            class="bg-base-100 border-base-300 rounded-xl border p-8 text-center"
          >
            <p class="text-base-content/60 text-lg">
              Aucune recette n'a encore été ajoutée à cet événement.
            </p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

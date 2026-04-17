<script lang="ts">
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import {
    getTotalGuests,
    getTotalRecipes,
  } from "$lib/utils/event-stats-helpers";
  import { navigate, route, searchParams } from "$lib/router";
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

  // ============================================================================
  // FILTRAGE : searchParams comme source de vérité unique
  // Params : recipe=uuid, meal=dateISO|"undated", ingredient=name
  // ============================================================================

  const urlFilter = $derived.by(() => {
    const r = searchParams.get("recipe");
    const m = searchParams.get("meal");
    const i = searchParams.get("ingredient");
    return {
      recipeUuid: r ? String(r) : null,
      mealDate: m ? String(m) : null,
      ingredient: i ? String(i) : null,
    };
  });

  const hasActiveFilter = $derived(
    !!urlFilter.recipeUuid || !!urlFilter.mealDate || !!urlFilter.ingredient,
  );

  // Ingrédients disponibles pour l'autocomplétion (exclut celui déjà sélectionné)
  const availableIngredientsForAutocomplete = $derived(
    urlFilter.ingredient
      ? availableIngredients.filter((ing) => ing !== urlFilter.ingredient)
      : availableIngredients,
  );

  // Repas filtrés par date/meal (pour l'affichage principal)
  const filteredMeals = $derived.by(() => {
    const { mealDate } = urlFilter;

    if (!mealDate) {
      return eventMeals.filter((meal) => meal.date !== "");
    }

    if (mealDate === "undated") {
      return eventMeals.filter((meal) => meal.date === "");
    }

    // mealDate peut être une date complète (2026-04-15T12:00:00) ou juste la date (2026-04-15)
    if (mealDate.includes("T")) {
      return eventMeals.filter((meal) => meal.date === mealDate);
    }

    // Date seule → prefix match
    return eventMeals.filter((meal) => meal.date?.startsWith(mealDate));
  });

  // Recettes mises de côté (meals sans date)
  const undatedMeals = $derived(eventMeals.filter((meal) => meal.date === ""));

  // Recettes filtrées par ingrédient
  const filteredRecipes = $derived.by(() => {
    if (!urlFilter.ingredient) return recipesDetails;

    return recipesDetails.filter((recipe) =>
      recipe.ingredients?.some(
        (ingredient: any) =>
          ingredient.name &&
          ingredient.name.toLowerCase() === urlFilter.ingredient!.toLowerCase(),
      ),
    );
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
  // SCROLL : vers le header du meal ciblé quand les données sont prêtes
  // ============================================================================

  $effect(() => {
    const { recipeUuid, mealDate } = urlFilter;
    if (!recipeUuid || !mealDate || loading) return;
    if (eventMeals.length === 0) return;

    tick().then(() => {
      // D'abord se assurer d'être en haut (utile quand on vient d'une autre page)
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => {
        scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
    });
  });

  // Helpers pour écrire dans les searchParams
  function clearAllFilters() {
    searchParams.delete("recipe");
    searchParams.delete("meal");
    searchParams.delete("ingredient");
    ingredientSearch = "";
  }

  function setFilterRecipe(recipeUuid: string, mealDate: string) {
    searchParams.set("recipe", recipeUuid);
    searchParams.set("meal", mealDate);
    searchParams.delete("ingredient");
    ingredientSearch = "";
  }

  function setFilterMeal(mealDate: string) {
    searchParams.delete("recipe");
    searchParams.set("meal", mealDate);
    searchParams.delete("ingredient");
    ingredientSearch = "";
  }

  function setFilterIngredient(ingredient: string) {
    searchParams.delete("recipe");
    searchParams.delete("meal");
    searchParams.set("ingredient", ingredient);
  }

  function selectIngredient(ingredient: string) {
    setFilterIngredient(ingredient);
  }

  function resetIngredientFilter() {
    searchParams.delete("ingredient");
    ingredientSearch = "";
  }
</script>

{#snippet navActions()}
  <div class="flex gap-2 max-sm:hidden">
    <button
      class="btn btn-sm btn-circle btn-primary"
      onclick={() => window.print()}><Printer size={18} /></button
    >
  </div>
{/snippet}

<div class="bg-base-200 overflow-x-hidden" in:fade>
  <!-- LeftPanel avec recherche et sommaire -->
  <div class="print:hidden">
    <LeftPanel>
      <!-- Champ de recherche par ingrédient avec autocomplétion -->
      <button
        class="absolute -z-50 size-0 opacity-0"
        tabindex="-1"
        aria-hidden="true"
      ></button>
      <div>
        <h3 class="mb-3 text-lg font-semibold">Rechercher par ingrédient</h3>

        <div class="relative mb-4">
          <AutocompleteInput
            items={availableIngredientsForAutocomplete}
            onSelect={selectIngredient}
            placeholder={urlFilter.ingredient || "Filtrer par ingrédients..."}
            minQueryLength={1}
            bind:value={ingredientSearch}
          />
          {#if urlFilter.ingredient}
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
          {@const dateISO =
            Array.from(
              (times as Map<string, any[]>).values(),
            )[0]?.[0]?.date?.split("T")[0] ?? ""}
          <li>
            <button
              class="btn btn-sm justify-start {urlFilter.mealDate === dateISO &&
              !urlFilter.recipeUuid
                ? 'btn-accent'
                : 'btn-ghost'}"
              onclick={() => {
                if (urlFilter.mealDate === dateISO && !urlFilter.recipeUuid) {
                  clearAllFilters();
                } else {
                  setFilterMeal(dateISO);
                }
              }}
            >
              <span>{date}</span>
            </button>
          </li>

          <ul>
            {#each Array.from((times as Map<string, any[]>).entries()) as [time, meals] (time)}
              {@const mealISO = meals[0].date}
              <li>
                <button
                  class="btn btn-sm mb-1 h-auto justify-start pl-4 {urlFilter.mealDate ===
                    mealISO && !urlFilter.recipeUuid
                    ? 'btn-accent'
                    : 'btn-ghost '}"
                  onclick={() => {
                    if (
                      urlFilter.mealDate === mealISO &&
                      !urlFilter.recipeUuid
                    ) {
                      clearAllFilters();
                    } else {
                      setFilterMeal(mealISO);
                    }
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
                  {#if recipe}
                    <li>
                      <button
                        class="btn btn-sm mb-1 ml-8 justify-start {urlFilter.recipeUuid ===
                        mealRecipe.recipeUuid
                          ? 'btn-accent'
                          : 'btn-ghost'}"
                        onclick={() => {
                          if (urlFilter.recipeUuid === mealRecipe.recipeUuid) {
                            clearAllFilters();
                          } else {
                            setFilterRecipe(mealRecipe.recipeUuid, mealISO);
                          }
                        }}
                      >
                        <span class="truncate text-left leading-none text-wrap">
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
              class="btn btn-sm justify-start {urlFilter.mealDate ===
                'undated' && !urlFilter.recipeUuid
                ? 'btn-accent'
                : 'btn-ghost'}"
              onclick={() => {
                if (urlFilter.mealDate === "undated" && !urlFilter.recipeUuid) {
                  clearAllFilters();
                } else {
                  setFilterMeal("undated");
                }
              }}
            >
              <span
                >📌 Mise de côté ({undatedMeals.reduce(
                  (count, m) => count + m.recipes.length,
                  0,
                )})</span
              >
            </button>
          </li>
          {#if urlFilter.mealDate === "undated"}
            <ul>
              {#each undatedMeals as undatedMeal (undatedMeal.id)}
                {#each undatedMeal.recipes as mealRecipe, recipeIndex (mealRecipe.recipeUuid + "-" + recipeIndex)}
                  {@const recipe = recipesDetails.find(
                    (r) => r.$id === mealRecipe.recipeUuid,
                  )}
                  {#if recipe}
                    <li>
                      <button
                        class="btn btn-sm mb-1 ml-4 justify-start {urlFilter.recipeUuid ===
                        mealRecipe.recipeUuid
                          ? 'btn-accent'
                          : 'btn-ghost'}"
                        onclick={() => {
                          if (urlFilter.recipeUuid === mealRecipe.recipeUuid) {
                            clearAllFilters();
                          } else {
                            setFilterRecipe(mealRecipe.recipeUuid, "undated");
                          }
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

      {#if hasActiveFilter}
        <div class="my-4">
          <button
            class="btn btn-dash btn-block btn-primary"
            onclick={clearAllFilters}
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
  <div class="print:ml-0 {globalState.isDesktop && ' ml-96'}">
    <div class="mx-auto max-w-6xl p-4 pb-20">
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
          {#if hasActiveFilter}
            <div class="m-4 flex flex-wrap items-center justify-center gap-2">
              <div class="badge badge-xl badge-primary">
                <Funnel class="mr-1 h-4 w-4" />
                filtre :
                {#if urlFilter.mealDate === "undated"}
                  <span class="mr-1">📌 Mise de côté</span>
                {/if}
                {#if urlFilter.mealDate && urlFilter.mealDate !== "undated"}
                  <span class="mr-1"
                    >{urlFilter.mealDate.includes("T")
                      ? formatDateWdDayMonth(urlFilter.mealDate)
                      : urlFilter.mealDate}</span
                  >
                {/if}
                {#if urlFilter.recipeUuid}
                  <span class="mr-1"> recette</span>
                {/if}
                {#if urlFilter.ingredient}
                  <span>{urlFilter.ingredient}</span>
                {/if}
              </div>
              <button
                class="btn btn-dash btn-sm"
                onclick={clearAllFilters}
                aria-label="Afficher toutes les recettes"
              >
                <Eye class="h-4 w-4" />
                Afficher toutes les recettes
              </button>
            </div>
          {/if}
        </div>

        <!-- Grille des recettes -->
        {#if urlFilter.ingredient}
          <!-- Mode recherche par ingrédient : afficher les recettes filtrées -->
          {#if filteredRecipes.length === 0}
            <div
              class="bg-base-100 border-base-300 rounded-xl border p-8 text-center print:hidden"
            >
              <p class="text-base-content/60 text-lg">
                Aucune recette ne contient l'ingrédient "{urlFilter.ingredient}".
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
          <!-- Mode normal : afficher les repas filtrés par meal/recette -->
          {#if filteredMeals.length === 0 && urlFilter.mealDate}
            <div
              class="bg-base-100 border-base-300 rounded-xl border p-8 text-center"
            >
              <p class="text-base-content/60 text-lg">
                Aucune recette ne correspond aux filtres sélectionnés.
              </p>
              <button class="btn btn-primary mt-4" onclick={clearAllFilters}>
                Réinitialiser les filtres
              </button>
            </div>
          {:else}
            <div class="space-y-10 print:space-y-0">
              {#each filteredMeals as meal, mealIndex (meal.id || mealIndex)}
                {@const mealRecipesToDisplay = urlFilter.recipeUuid
                  ? meal.recipes.filter(
                      (mr: any) => mr.recipeUuid === urlFilter.recipeUuid,
                    )
                  : meal.recipes}

                {#if mealRecipesToDisplay.length > 0}
                  <!-- Date break / Mise de côté header -->
                  <div
                    id="meal-{meal.date || 'undated'}"
                    class="card my-4 flex flex-row flex-wrap items-center justify-center gap-4 p-2 font-black shadow-lg sm:gap-6 sm:px-4 sm:py-2 print:hidden {meal.date
                      ? 'bg-primary text-primary-content'
                      : 'bg-warning/80 text-warning-content'}"
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
            {#if hasActiveFilter}
              <button
                class="btn btn-dash btn-block my-5"
                onclick={clearAllFilters}
                aria-label="Afficher toutes les recettes"
              >
                <Eye class="h-4 w-4" />
                Afficher toutes les recettes
              </button>
            {/if}
          {/if}
        {/if}

        <!-- Message si pas de recettes du tout -->
        {#if !urlFilter.ingredient && recipesDetails.length === 0 && !loading}
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

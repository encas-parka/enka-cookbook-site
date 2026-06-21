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
  import EventDocumentsBloc from "$lib/components/documents/EventDocumentsBloc.svelte";
  import EventRecipeCard from "$lib/components/eventEdit/EventRecipeCard.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import AutocompleteInput from "$lib/components/ui/AutocompleteInput.svelte";
  import { formatDateShort } from "$lib/utils/products-display";
  import EventCalendar from "$lib/components/EventCalendar.svelte";
  import EventCalendarPrint from "$lib/components/EventCalendarPrint.svelte";
  import {
    ArrowLeft,
    Calendar,
    CalendarDays,
    CookingPot,
    Utensils,
    Eye,
    X,
    Funnel,
    Printer,
    CalendarMinus,
  } from "@lucide/svelte";
  import {
    extractTime,
    formatDateWdDayMonth,
    extractDate,
    formatDateWdDayMonthShort,
  } from "../utils/date-helpers";
  import { globalState } from "../stores/GlobalState.svelte";
  import { online } from "svelte/reactivity/window";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { fade, slide } from "svelte/transition";

  // État local
  let loading = $state(true);
  let error = $state<string | null>(null);
  let eventId = $derived(route.params.id ?? null);

  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  // Permission d'édition
  const canEdit = $derived(
    eventId && globalState.userId
      ? online.current &&
          eventsStore.canUserEditEvent(eventId, globalState.userId)
      : false,
  );

  let eventMeals = $state<any[]>([]);
  let recipesDetails = $state<any[]>([]);

  // Pour éviter les rechargements en boucle
  let isLoading = $state(false);

  // Pagination progressive (lazy loading par meals)
  let pageSize = $state(1);
  let currentPage = $state(1);
  let sentinel = $state<HTMLElement | undefined>();

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

  // Meals qui contiennent au moins une recette correspondant au filtre ingrédient
  const mealsWithIngredientMatch = $derived.by(() => {
    if (!urlFilter.ingredient) return [];
    return eventMeals.filter((meal) =>
      meal.recipes.some((mr: any) =>
        filteredRecipes.some((fr) => fr.$id === mr.recipeUuid),
      ),
    );
  });

  // Source de meals à paginer selon le mode actif
  const mealsToPaginate = $derived(
    urlFilter.ingredient ? mealsWithIngredientMatch : filteredMeals,
  );

  // Meals paginés pour le lazy loading
  const paginatedMeals = $derived(
    mealsToPaginate.slice(0, currentPage * pageSize),
  );

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

  // ============================================================================
  // CALENDRIER : colonnes de dates × moments pour EventCalendar
  // ============================================================================

  const showCalendar = $derived(mealsByDate.size >= 3);

  // Toggle utilisateur : afficher/masquer le calendrier
  // svelte-ignore state_referenced_locally
  let calendarVisible = $state(showCalendar);

  // Synchroniser la valeur par défaut quand les données changent
  $effect(() => {
    if (showCalendar && !calendarVisible) calendarVisible = true;
  });

  // Le calendrier est pertinent uniquement s'il y a des dates
  const canShowCalendar = $derived(mealsByDate.size > 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CalendarRecipeInfo = {
    recipeUuid: string;
    title: string;
    plates: number;
    mealDate: string;
    typeR: string;
    preparation24h: string | null;
  };

  const TYPE_ORDER: Record<string, number> = {
    entree: 0,
    plat: 1,
    dessert: 2,
    autre: 3,
  };

  const calendarColumns = $derived.by(() => {
    type ColumnData = {
      label: string;
      mealsByMoment: Map<string, CalendarRecipeInfo[]>;
    };
    const dateMap = new Map<string, ColumnData>();

    eventMeals.forEach((meal: any) => {
      if (meal.date === "") return;

      const dateISO = extractDate(meal.date);
      const moment = extractTime(meal.date);

      if (!dateMap.has(dateISO)) {
        dateMap.set(dateISO, {
          label: formatDateWdDayMonthShort(meal.date),
          mealsByMoment: new Map(),
        });
      }

      const col = dateMap.get(dateISO)!;

      meal.recipes.forEach((mealRecipe: any) => {
        const recipe = recipesDetails.find(
          (r: any) => r.$id === mealRecipe.recipeUuid,
        );
        if (!recipe) return;

        if (!col.mealsByMoment.has(moment)) {
          col.mealsByMoment.set(moment, []);
        }
        col.mealsByMoment.get(moment)!.push({
          recipeUuid: mealRecipe.recipeUuid,
          title: recipe.title,
          plates: mealRecipe.plates ?? meal.guests ?? 0,
          mealDate: meal.date,
          typeR: mealRecipe.typeR ?? "autre",
          preparation24h: recipe.preparation24h ?? null,
        });
      });
    });

    // Trier par date ISO et trier les recettes par typeR dans chaque moment
    return Array.from(dateMap.keys())
      .sort()
      .map((dateISO) => {
        const data = dateMap.get(dateISO)!;
        // Trier chaque moment par typeR (entree → plat → dessert → autre)
        data.mealsByMoment.forEach((recipes) => {
          recipes.sort(
            (a, b) => (TYPE_ORDER[a.typeR] ?? 9) - (TYPE_ORDER[b.typeR] ?? 9),
          );
        });
        return {
          dateISO,
          label: data.label,
          mealsByMoment: data.mealsByMoment,
        };
      });
  });

  const undatedCalendarRecipes = $derived.by(() => {
    const recipes: CalendarRecipeInfo[] = [];
    undatedMeals.forEach((meal: any) => {
      meal.recipes.forEach((mealRecipe: any) => {
        const recipe = recipesDetails.find(
          (r: any) => r.$id === mealRecipe.recipeUuid,
        );
        if (!recipe) return;
        recipes.push({
          recipeUuid: mealRecipe.recipeUuid,
          title: recipe.title,
          plates: mealRecipe.plates ?? meal.guests ?? 0,
          mealDate: "undated",
          typeR: mealRecipe.typeR ?? "autre",
          preparation24h: recipe.preparation24h ?? null,
        });
      });
    });
    return recipes;
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
      // Note: eventsStore et recipesStore sont déjà initialisés via App.svelte (loadCache + syncInitial)

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
  // SCROLL : vers la zone recettes quand les données sont prêtes
  // ============================================================================

  $effect(() => {
    const { recipeUuid, mealDate } = urlFilter;
    if (!recipeUuid || !mealDate || loading) return;
    if (eventMeals.length === 0) return;

    tick().then(() => {
      const anchor = document.getElementById("recipes-anchor");
      if (anchor) {
        anchor.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  // Lazy loading avec Intersection Observer
  $effect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          paginatedMeals.length < mealsToPaginate.length
        ) {
          currentPage++;
        }
      },
      { threshold: 0.1, rootMargin: "150px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // ============================================================================
  // IMPRESSION : deux modes disponibles via dropdown navbar.
  //  - "Imprimer les recettes" (handlePrintRecipes) : force la pagination
  //    complète, attend le rendu, puis window.print(). C'est aussi le
  //    comportement par défaut de Ctrl+P / Cmd+P (contenu principal).
  //  - "Imprimer le tableau" (handlePrintCalendar) : bascule en mode calendrier
  //    (recettes masquées, calendrier visible en noir et blanc), injecte la
  //    règle @page landscape, ouvre le dialogue, puis nettoie via afterprint.
  //    Disponible uniquement si calendarVisible.
  // Le lazy load remplit son rôle (décharger le rendu initial) ; une fois tout
  // chargé, currentPage reste à max — pas besoin de restaurer.
  // ============================================================================
  let isPreparingPrint = $state(false);
  let isPrintingCalendar = $state(false);

  /** Force la pagination complète pour révéler toutes les meals. */
  function forceFullPaginationForPrint(): boolean {
    if (currentPage * pageSize < mealsToPaginate.length) {
      currentPage = Math.ceil(mealsToPaginate.length / pageSize) + 1;
      return true;
    }
    return false;
  }

  /** Impression des recettes (bouton + Ctrl+P par défaut). */
  async function handlePrintRecipes() {
    if (isPreparingPrint) return;
    isPrintingCalendar = false;
    if (forceFullPaginationForPrint()) {
      isPreparingPrint = true;
      await tick();
      // Laisser le navigateur peindre les nouvelles cartes
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      isPreparingPrint = false;
    }
    window.print();
  }

  /** Impression du calendrier en mode paysage (bouton, si calendarVisible). */
  async function handlePrintCalendar() {
    if (isPreparingPrint || !calendarVisible) return;
    isPrintingCalendar = true;

    // @page ne peut pas être conditionnel via classe : injection dynamique
    const styleEl = document.createElement("style");
    styleEl.id = "print-calendar-page";
    styleEl.textContent = "@page { size: A4 landscape; margin: 1cm; }";
    document.head.appendChild(styleEl);

    const cleanup = () => {
      styleEl.remove();
      isPrintingCalendar = false;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup, { once: true });

    await tick();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    window.print();
  }

  // Capture Ctrl+P / Cmd+P : imprime les recettes par défaut (contenu principal).
  $effect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        handlePrintRecipes();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Reset pagination quand les filtres changent
  $effect(() => {
    urlFilter;
    mealsToPaginate;
    currentPage = 1;
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
      stickyLeftPanel: calendarVisible,
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
    <div class="dropdown dropdown-end">
      <div
        class="btn btn-sm btn-circle btn-primary"
        tabindex="0"
        role="button"
        title="Imprimer"
      >
        {#if isPreparingPrint}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Printer size={18} />
        {/if}
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <ul
        class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow-lg"
        tabindex="0"
      >
        {#if calendarVisible}
          <li>
            <button onclick={handlePrintCalendar}>
              <CalendarDays size={16} />
              Imprimer le tableau
            </button>
          </li>
        {/if}
        <li>
          <button onclick={handlePrintRecipes}>
            <Printer size={16} />
            Imprimer les recettes
          </button>
        </li>
      </ul>
    </div>
  </div>
{/snippet}

<div class="bg-base-200 overflow-x-clip" in:fade>
  {#if !loading && eventName}
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- HEADER : titre, dates, stats (uniquement mode calendrier) -->
    <!-- ═══════════════════════════════════════════════════════════ -->

    {#if calendarVisible}
      <!-- En-tête événement (pleine largeur) -->
      <div class="mx-auto max-w-6xl p-4 pb-0 print:hidden">
        <div class="mb-4 space-y-4">
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

          <!-- Bloc Documents attachés -->
          {#if eventId}
            <EventDocumentsBloc
              {eventId}
              tag="recette"
              tagLabel="Recettes"
              {canEdit}
            />
          {/if}
        </div>
      </div>
    {/if}

    <!-- Toggle calendrier -->
    {#if !showCalendar}
      <div class="flex justify-end px-6">
        <label class="btn btn-ghost swap" class:swap-active={calendarVisible}>
          <input type="checkbox" bind:checked={calendarVisible} />
          <CalendarMinus class="swap-on size-6" />
          <CalendarDays class="swap-off size-6 opacity-40" />
        </label>
      </div>
    {/if}

    <!-- Calendrier (conditionnel) -->
    {#if calendarVisible}
      <!-- Calendrier interactif (écran uniquement — jamais imprimé :
           EventCalendarPrint dédié prend le relais en print mode calendrier) -->
      <div
        class="max-w-9xl mx-auto px-2 py-6 sm:px-4 print:hidden"
        transition:slide
      >
        <EventCalendar
          columns={calendarColumns}
          undatedRecipes={undatedCalendarRecipes}
          selectedRecipeUuid={urlFilter.recipeUuid}
          selectedMealDate={urlFilter.mealDate}
          onFilterRecipe={setFilterRecipe}
          onFilterMeal={setFilterMeal}
          onClearFilters={clearAllFilters}
        />
      </div>

      <!-- Calendrier d'impression dédié (visible uniquement en print mode
           calendrier). <table> sémantique, court-circuite les règles globales
           app.css qui détruisent les grids en print. -->
      <div class="hidden {isPrintingCalendar ? 'print:block' : ''}">
        <EventCalendarPrint columns={calendarColumns} />
      </div>
    {/if}

    {#if calendarVisible}
      <!-- Zone LeftPanel sticky + contenu -->
      <div id="recipes-anchor" class="flex">
        <div class="print:hidden">
          <LeftPanel sticky={true}>
            <!-- Champ de recherche par ingrédient avec autocomplétion -->
            <button
              class="absolute -z-50 size-0 opacity-0"
              tabindex="-1"
              aria-hidden="true"
            ></button>
            <div>
              <h3 class="mb-3 text-lg font-semibold">
                Rechercher par ingrédient
              </h3>

              <div class="relative mb-4">
                <AutocompleteInput
                  items={availableIngredientsForAutocomplete}
                  onSelect={selectIngredient}
                  placeholder={urlFilter.ingredient ||
                    "Filtrer par ingrédients..."}
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
                    class="btn btn-sm justify-start {urlFilter.mealDate ===
                      dateISO && !urlFilter.recipeUuid
                      ? 'btn-accent'
                      : 'btn-ghost'}"
                    onclick={() => {
                      if (
                        urlFilter.mealDate === dateISO &&
                        !urlFilter.recipeUuid
                      ) {
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
                            {time === "matin"
                              ? "🌅"
                              : time === "midi"
                                ? "☀️"
                                : "🌙"}
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
                                if (
                                  urlFilter.recipeUuid === mealRecipe.recipeUuid
                                ) {
                                  clearAllFilters();
                                } else {
                                  setFilterRecipe(
                                    mealRecipe.recipeUuid,
                                    mealISO,
                                  );
                                }
                              }}
                            >
                              <span
                                class="truncate text-left leading-none text-wrap"
                              >
                                {recipe.title}
                              </span>
                              {#if recipe.preparation24h}<span
                                  class="status status-md status-warning pb-2"
                                ></span>{/if}
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
                      if (
                        urlFilter.mealDate === "undated" &&
                        !urlFilter.recipeUuid
                      ) {
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
                                if (
                                  urlFilter.recipeUuid === mealRecipe.recipeUuid
                                ) {
                                  clearAllFilters();
                                } else {
                                  setFilterRecipe(
                                    mealRecipe.recipeUuid,
                                    "undated",
                                  );
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

        <!-- Contenu principal (sans ml-96 car LeftPanel est sticky dans le flux) -->
        <div class="flex-1 {isPrintingCalendar ? 'print:hidden' : ''}">
          <div class="mx-auto max-w-6xl p-4 pb-20">
            {#if urlFilter.ingredient}
              <!-- Mode recherche par ingrédient -->
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
                  {#each paginatedMeals as meal, mealIndex (meal.id || mealIndex)}
                    {@const recipesMatchingSearch = meal.recipes.filter(
                      (mr: any) =>
                        filteredRecipes.some((fr) => fr.$id === mr.recipeUuid),
                    )}
                    {#if recipesMatchingSearch.length > 0}
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
              <!-- Mode normal -->
              {#if filteredMeals.length === 0 && urlFilter.mealDate}
                <div
                  class="bg-base-100 border-base-300 rounded-xl border p-8 text-center"
                >
                  <p class="text-base-content/60 text-lg">
                    Aucune recette ne correspond aux filtres sélectionnés.
                  </p>
                  <button
                    class="btn btn-primary mt-4"
                    onclick={clearAllFilters}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              {:else}
                <div class="space-y-10 print:space-y-0">
                  {#each paginatedMeals as meal, mealIndex (meal.id || mealIndex)}
                    {@const mealRecipesToDisplay = urlFilter.recipeUuid
                      ? meal.recipes.filter(
                          (mr: any) => mr.recipeUuid === urlFilter.recipeUuid,
                        )
                      : meal.recipes}

                    {#if mealRecipesToDisplay.length > 0}
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

            <!-- Sentinelle pour lazy loading -->
            {#if paginatedMeals.length < mealsToPaginate.length}
              <div bind:this={sentinel} class="py-8 text-center print:hidden">
                <span class="loading loading-spinner loading-md"></span>
              </div>
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
          </div>
        </div>
      </div>
    {:else}
      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- MODE CLASSIQUE (sans calendrier) : layout original         -->
      <!-- ═══════════════════════════════════════════════════════════ -->

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
            <h3 class="mb-3 text-lg font-semibold">
              Rechercher par ingrédient
            </h3>

            <div class="relative mb-4">
              <AutocompleteInput
                items={availableIngredientsForAutocomplete}
                onSelect={selectIngredient}
                placeholder={urlFilter.ingredient ||
                  "Filtrer par ingrédients..."}
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
                  class="btn btn-sm justify-start {urlFilter.mealDate ===
                    dateISO && !urlFilter.recipeUuid
                    ? 'btn-accent'
                    : 'btn-ghost'}"
                  onclick={() => {
                    if (
                      urlFilter.mealDate === dateISO &&
                      !urlFilter.recipeUuid
                    ) {
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
                          {time === "matin"
                            ? "🌅"
                            : time === "midi"
                              ? "☀️"
                              : "🌙"}
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
                              if (
                                urlFilter.recipeUuid === mealRecipe.recipeUuid
                              ) {
                                clearAllFilters();
                              } else {
                                setFilterRecipe(mealRecipe.recipeUuid, mealISO);
                              }
                            }}
                          >
                            <span
                              class="truncate text-left leading-none text-wrap"
                            >
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
                    if (
                      urlFilter.mealDate === "undated" &&
                      !urlFilter.recipeUuid
                    ) {
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
                              if (
                                urlFilter.recipeUuid === mealRecipe.recipeUuid
                              ) {
                                clearAllFilters();
                              } else {
                                setFilterRecipe(
                                  mealRecipe.recipeUuid,
                                  "undated",
                                );
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
      <div
        id="recipes-anchor"
        class="print:ml-0 {globalState.isDesktop && ' ml-96'}"
      >
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
                <div
                  class="m-4 flex flex-wrap items-center justify-center gap-2"
                >
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
                  {#each paginatedMeals as meal, mealIndex (meal.id || mealIndex)}
                    {@const recipesMatchingSearch = meal.recipes.filter(
                      (mr: any) =>
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
                  <button
                    class="btn btn-primary mt-4"
                    onclick={clearAllFilters}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              {:else}
                <div class="space-y-10 print:space-y-0">
                  {#each paginatedMeals as meal, mealIndex (meal.id || mealIndex)}
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

            <!-- Sentinelle pour lazy loading -->
            {#if paginatedMeals.length < mealsToPaginate.length}
              <div bind:this={sentinel} class="py-8 text-center print:hidden">
                <span class="loading loading-spinner loading-md"></span>
              </div>
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
    {/if}
  {/if}
</div>

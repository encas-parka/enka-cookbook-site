<script lang="ts">
  import { onMount } from "svelte";
  import type { RecipeIndexEntry } from "$lib/types/recipes.types";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import RecipeSearchBar from "$lib/components/recipes/RecipeSearchBar.svelte";
  import RecipeFilters from "$lib/components/recipes/RecipeFilters.svelte";
  import ActiveFiltersDisplay from "$lib/components/recipes/ActiveFiltersDisplay.svelte";
  import RecipeCard from "$lib/components/recipes/RecipeCard.svelte";
  import RecipeSortControls from "$lib/components/recipes/RecipeSortControls.svelte";
  import LeftPanel from "$lib/components/ui/LeftPanel.svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { PlusIcon } from "@lucide/svelte";
  import { navigate, route } from "$lib/router";
  import { globalState } from "../stores/GlobalState.svelte";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";

  // État des filtres
  interface Filters {
    categories: string[];
    regimes: string[];
    temperature: string;
    cuisson: string;
    saison: string;
    testedStatus: "all" | "tested" | "untested";
    ingredients: string[];
    typeR: string;
    scope: "all" | "mine" | "drafts";
  }

  let searchQuery = $state("");
  let filters = $state<Filters>({
    categories: [],
    regimes: [],
    temperature: "",
    cuisson: "",
    saison: "",
    testedStatus: "all",
    ingredients: [],
    typeR: "",
    scope: "all",
  });

  // Pagination
  let pageSize = $state(20);
  let currentPage = $state(1);
  let sentinel = $state<HTMLElement | undefined>();

  // Tri
  let sortBy = $state<"title" | "$createdAt" | "$updatedAt">("title");
  let sortOrder = $state<"asc" | "desc">("asc");

  // Récupérer toutes les recettes depuis le store
  const allRecipes = $derived.by(() => {
    // Retourner un tableau vide si le store n'est pas initialisé
    if (!recipesStore.isInitialized) {
      return [];
    }
    return recipesStore.getAllRecipes();
  });

  // Extraire les valeurs uniques pour les filtres
  const availableCategories = $derived.by(() => {
    const cats = new Set<string>();
    allRecipes.forEach((r) => r.categories?.forEach((c) => cats.add(c)));
    return Array.from(cats).sort();
  });

  const availableRegimes = [
    "vegan",
    "vegetarien",
    "sans-gluten",
    "sans-lactose",
  ];

  const availableIngredients = $derived.by(() => {
    return recipeDataStore.isInitialized ? recipeDataStore.ingredientNames : [];
  });

  // Logique de filtrage
  const filteredRecipes = $derived.by(() => {
    // Si recherche active (>= 2 chars), ignorer les filtres sauf typeR
    if (searchQuery.length >= 2) {
      const normalized = searchQuery
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

      return allRecipes.filter((recipe) => {
        const titleMatch = recipe.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .includes(normalized);

        const authorMatch =
          recipe.auteur
            ?.toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .includes(normalized) || false;

        const specialiteMatch =
          recipe.region
            ?.toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .includes(normalized) || false;

        // Filtrer sur typeR même pendant la recherche
        const typeRMatch = !filters.typeR || recipe.typeR === filters.typeR;

        return (titleMatch || authorMatch || specialiteMatch) && typeRMatch;
      });
    }

    // Sinon, appliquer les filtres
    return allRecipes.filter((recipe) => {
      // Catégories (OU logique)
      const categoryMatch =
        !filters.categories.length ||
        filters.categories.some((c) => recipe.categories?.includes(c));

      // Régimes (OU logique)
      const regimeMatch =
        !filters.regimes.length ||
        filters.regimes.some((r) => recipe.regime?.includes(r));

      // Température
      const temperatureMatch =
        !filters.temperature ||
        recipe.serveHot === (filters.temperature === "Chaud");

      // Cuisson
      const cuissonMatch =
        !filters.cuisson ||
        (filters.cuisson === "Oui"
          ? recipe.cuisson === true
          : recipe.cuisson === false);

      // Saison
      const saisonMatch =
        !filters.saison || recipe.saison?.includes(filters.saison);

      // Testé
      const testedMatch =
        filters.testedStatus === "all" ||
        (filters.testedStatus === "tested" && recipe.check) ||
        (filters.testedStatus === "untested" && !recipe.check);

      // Ingrédients (ET logique - tous les ingrédients sélectionnés doivent être présents)
      const ingredientMatch =
        !filters.ingredients.length ||
        filters.ingredients.every((ing) => recipe.ingredients?.includes(ing));

      // Type de recette
      const typeRMatch = !filters.typeR || recipe.typeR === filters.typeR;

      // Scope (Tout / Mes recettes / Mes brouillons)
      let scopeMatch = true;
      if (filters.scope === "mine") {
        scopeMatch = recipe.createdBy === globalState.userId;
      } else if (filters.scope === "drafts") {
        scopeMatch =
          recipe.createdBy === globalState.userId && recipe.draft === true;
      }

      return (
        categoryMatch &&
        regimeMatch &&
        temperatureMatch &&
        cuissonMatch &&
        saisonMatch &&
        testedMatch &&
        ingredientMatch &&
        typeRMatch &&
        scopeMatch
      );
    });
  });

  // Tri des recettes filtrées
  const sortedRecipes = $derived.by(() => {
    const recipes = [...filteredRecipes];
    return recipes.sort((a, b) => {
      if (sortBy === "title") {
        return sortOrder === "asc"
          ? a.title.localeCompare(b.title, "fr")
          : b.title.localeCompare(a.title, "fr");
      } else if (sortBy === "$createdAt") {
        const diff =
          new Date(b.$createdAt || 0).getTime() -
          new Date(a.$createdAt || 0).getTime();
        return sortOrder === "asc" ? -diff : diff;
      } else {
        const diff =
          new Date(b.$updatedAt || 0).getTime() -
          new Date(a.$updatedAt || 0).getTime();
        return sortOrder === "asc" ? -diff : diff;
      }
    });
  });

  // Pagination
  const paginatedRecipes = $derived(
    sortedRecipes.slice(0, currentPage * pageSize),
  );

  // Désactiver les filtres si recherche active
  const filtersDisabled = $derived(searchQuery.length >= 2);

  // Reset fonctions
  function resetSearch() {
    searchQuery = "";
  }

  function resetFilters() {
    filters = {
      categories: [],
      regimes: [],
      temperature: "",
      cuisson: "",
      saison: "",
      testedStatus: "all",
      ingredients: [],
      typeR: "",
      scope: filters.scope, // Garder le scope actuel lors du reset des filtres techniques
    };
  }

  // Lazy loading avec Intersection Observer
  $effect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          paginatedRecipes.length < filteredRecipes.length
        ) {
          currentPage++;
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Reset pagination quand les filtres changent
  $effect(() => {
    // Dépendances : filteredRecipes, sortBy, sortOrder
    filteredRecipes;
    sortBy;
    sortOrder;
    currentPage = 1;
  });

  // Synchronisation du scope avec la route
  $effect(() => {
    const path = route.pathname;
    if (path === "/recipe/my/draft") {
      filters.scope = "drafts";
    } else if (path === "/recipe/my") {
      filters.scope = "mine";
    } else {
      filters.scope = "all";
    }
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title:
        filters.scope === "mine"
          ? "Mes recettes"
          : filters.scope === "drafts"
            ? "Mes brouillons"
            : "Recettes",
      actions: navActions,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });

  onMount(async () => {
    // Note: recipesStore est déjà initialisé via App.svelte (loadCache + syncFromRemote)

    // recipeDataStore est initialisé à la demande (pas global)
    if (!recipeDataStore.isInitialized) {
      await recipeDataStore.initialize();
    }
  });
</script>

{#snippet navActions()}
  {#if globalState.isAuthenticated}
    <button
      class="btn btn-primary btn-sm"
      onclick={() => navigate("/recipe/new")}
    >
      <PlusIcon size={18} />
      <span class="hidden sm:inline"> Créer une recette</span>
    </button>
  {/if}
{/snippet}

<!-- Filtres - Sidebar Desktop / Drawer Mobile -->
<LeftPanel width="100">
  <RecipeFilters
    bind:filters
    disabled={filtersDisabled}
    {availableCategories}
    {availableRegimes}
    {availableIngredients}
    onReset={resetFilters}
  />
</LeftPanel>

<!-- Contenu principal -->
<div class="relative z-0 p-4 lg:ml-100" in:fade>
  <div class="mx-auto max-w-4xl">
    <div class="mb-10 space-y-6">
      <!-- Tabs de filtrage par type -->
      <div class="tabs tabs-border tabs-lg mb-6 font-bold">
        <button
          class="tab {filters.typeR === '' ? 'tab-active' : ''}"
          onclick={() => (filters.typeR = "")}
        >
          Toutes
        </button>
        <button
          class="tab {filters.typeR === 'entree' ? 'tab-active' : ''}"
          onclick={() => (filters.typeR = "entree")}
        >
          Entrées
        </button>
        <button
          class="tab {filters.typeR === 'plat' ? 'tab-active' : ''}"
          onclick={() => (filters.typeR = "plat")}
        >
          Plats
        </button>
        <button
          class="tab {filters.typeR === 'dessert' ? 'tab-active' : ''}"
          onclick={() => (filters.typeR = "dessert")}
        >
          Desserts
        </button>
      </div>

      <!-- Barre de recherche -->
      <div class="mb-4">
        <RecipeSearchBar bind:searchQuery onReset={resetSearch} />
      </div>
      <!-- Résumé des filtres actifs -->
      <div class="mb-6">
        <ActiveFiltersDisplay
          {searchQuery}
          {filters}
          resultCount={filteredRecipes.length}
          onResetFilters={resetFilters}
        />
      </div>

      <!-- Boutons de tri -->
      <RecipeSortControls
        {sortBy}
        {sortOrder}
        onSortChange={(s, o) => {
          sortBy = s;
          sortOrder = o;
        }}
        scope={filters.scope}
      />
    </div>

    <!-- Liste des recettes -->
    {#if recipesStore.error}
      <div class="alert alert-error">
        <span>Erreur : {recipesStore.error}</span>
      </div>
    {:else if !recipesStore.isInitialized && !recipesStore.loading}
      <!-- État initial : Skeleton loader -->
      <div class="my-8 space-y-10">
        {#each Array(5) as _, i (i)}
          <div class="skeleton h-40 w-full rounded-lg"></div>
        {/each}
      </div>
    {:else if recipesStore.loading && paginatedRecipes.length === 0}
      <!-- Chargement en cours (après initialisation) -->
      <div class="flex justify-center py-12">
        <div class="text-center">
          <div class="loading loading-spinner loading-lg text-primary"></div>
          <p class="text-base-content/60 mt-4 text-sm">
            Chargement des recettes...
          </p>
        </div>
      </div>
    {:else}
      <!-- Contenu normal -->
      <div class="my-8 space-y-10">
        {#each paginatedRecipes as recipe (recipe.$id)}
          <div transition:fade={{ duration: 300 }}>
            <RecipeCard {recipe} highlightedIngredients={filters.ingredients} />
          </div>
        {/each}
      </div>

      <!-- Sentinelle pour lazy loading -->
      {#if paginatedRecipes.length < filteredRecipes.length}
        <div bind:this={sentinel} class="py-8 text-center">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}

      <!-- Message si aucun résultat -->
      {#if filteredRecipes.length === 0 && recipesStore.isInitialized}
        <div class="py-12 text-center">
          <p class="text-base-content/60 text-lg">
            Aucune recette ne correspond aux critères...
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>

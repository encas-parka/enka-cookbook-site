<script lang="ts">
  import { Eraser } from "@lucide/svelte";
  import { navigate } from '$lib/router';
  import { globalState } from "$lib/stores/GlobalState.svelte";

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

  interface Props {
    searchQuery: string;
    filters: Filters;
    resultCount: number;
    onResetFilters: () => void;
  }

  let { searchQuery, filters, resultCount, onResetFilters }: Props = $props();

  const hasActiveFilters = $derived(
    filters.categories.length > 0 ||
      filters.regimes.length > 0 ||
      filters.ingredients.length > 0 ||
      filters.temperature !== "" ||
      filters.cuisson !== "" ||
      filters.saison !== "" ||
      filters.testedStatus !== "all",
  );

  // Obtenir le nom du type de recette pour l'affichage
  const typeRLabel = $derived.by(() => {
    switch (filters.typeR) {
      case "entree":
        return "entrée";
      case "plat":
        return "plat";
      case "dessert":
        return "dessert";
      default:
        return "";
    }
  });
</script>

<fieldset class="fieldset border-base-300 relative rounded-lg border-2">
  <!-- Compteur de résultats -->
  {#if hasActiveFilters}
    <legend class="legend text-base-content/70 ms-4">
      {#if resultCount > 1}
        {#if typeRLabel}
          <span class="font-semibold">{resultCount} {typeRLabel}s</span> correspondent
          aux critères
        {:else}
          <span class="font-semibold">{resultCount} recettes</span> correspondent
          aux critères
        {/if}
      {:else if resultCount === 1}
        {#if typeRLabel}
          <span class="font-semibold">1 {typeRLabel}</span> correspond aux critères
        {:else}
          <span class="font-semibold">1 recette</span> correspond aux critères
        {/if}
      {:else if typeRLabel}
        <span class="text-warning">Aucun {typeRLabel}</span> ne correspond aux critères...
      {:else}
        <span class="text-warning">Aucune recette</span> ne correspond aux critères...
      {/if}
    </legend>
  {/if}
  <div class="p-4">
    {#if !hasActiveFilters}
      <div class="text-base-content/70 text-base">
        {#if typeRLabel}
          {resultCount} {typeRLabel}s
        {:else}
          {resultCount} recettes
        {/if}
      </div>
    {/if}
    <!-- Recherche textuelle -->
    {#if searchQuery.length >= 2}
      <div>
        <span class="text-base-content/60 italic"
          >contient (dans son titre/auteur·ice...) :
        </span>
        <span class="font-bold">{searchQuery}</span>
      </div>
    {:else if hasActiveFilters}
      <!-- Filtres actifs -->
      <div class="flex flex-wrap gap-2">
        <!-- Catégories -->
        {#each filters.categories as cat}
          <span class="badge badge-success">{cat}</span>
        {/each}

        <!-- Régimes -->
        {#each filters.regimes as regime}
          <span class="badge badge-secondary">{regime}</span>
        {/each}

        <!-- Température -->
        {#if filters.temperature === "Chaud"}
          <span class="badge badge-error text-white">Servir Chaud</span>
        {:else if filters.temperature === "Froid"}
          <span class="badge badge-info">Servir Froid</span>
        {/if}

        <!-- Cuisson -->
        {#if filters.cuisson === "Oui"}
          <span class="badge badge-warning">Avec Cuisson</span>
        {:else if filters.cuisson === "Non"}
          <span class="badge badge-success">Sans Cuisson</span>
        {/if}

        <!-- Saison -->
        {#if filters.saison}
          <span class="badge badge-accent">{filters.saison}</span>
        {/if}

        <!-- Ingrédients -->
        {#each filters.ingredients as ing}
          <span class="badge badge-success">{ing}</span>
        {/each}

        <!-- Statut de test -->
        {#if filters.testedStatus === "tested"}
          <span class="badge badge-success">Testées</span>
        {:else if filters.testedStatus === "untested"}
          <span class="badge badge-error">À tester</span>
        {/if}

        <!-- Type de recette -->
        {#if filters.typeR}
          <span class="badge badge-warning">{typeRLabel}</span>
        {/if}
      </div>

      <!-- Bouton reset -->
      <div class="mt-3 text-end">
        <button class="btn btn-warning btn-sm" onclick={onResetFilters}>
          <Eraser class="h-4 w-4" />
          Effacer tous les filtres
        </button>
      </div>
    {/if}
  </div>
</fieldset>

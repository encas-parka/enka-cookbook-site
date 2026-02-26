<script lang="ts">
  import { Eraser } from "@lucide/svelte";

  interface Filters {
    tags: string[];
  }

  interface Props {
    searchQuery: string;
    filters: Filters;
    resultCount: number;
    onResetFilters: () => void;
  }

  let { searchQuery, filters, resultCount, onResetFilters }: Props = $props();

  const hasActiveFilters = $derived(filters.tags.length > 0);
</script>

<fieldset class="fieldset border-base-300 relative rounded-lg border-2">
  <!-- Compteur de résultats -->
  {#if hasActiveFilters || searchQuery.length >= 2}
    <legend class="legend text-base-content/70 ms-4">
      {#if resultCount > 1}
        <span class="font-semibold">{resultCount} documents</span> correspondent aux
        critères
      {:else if resultCount === 1}
        <span class="font-semibold">1 document</span> correspond aux critères
      {:else}
        <span class="text-warning">Aucun document</span> ne correspond aux critères...
      {/if}
    </legend>
  {/if}

  <div class="p-4">
    {#if !hasActiveFilters && searchQuery.length < 2}
      <div class="text-base-content/70 text-base">
        {resultCount} document{resultCount > 1 ? "s" : ""}
      </div>
    {/if}

    <!-- Recherche textuelle -->
    {#if searchQuery.length >= 2}
      <div>
        <span class="text-base-content/60 italic"
          >contient (dans le titre ou le contenu) :
        </span>
        <span class="font-bold">{searchQuery}</span>
      </div>
    {:else if hasActiveFilters}
      <!-- Filtres actifs -->
      <div class="flex flex-wrap gap-2">
        <!-- Tags -->
        {#each filters.tags as tag}
          <span class="badge badge-primary">{tag}</span>
        {/each}
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

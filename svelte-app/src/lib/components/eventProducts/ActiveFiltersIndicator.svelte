<script lang="ts">
  import { FunnelX } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { scale } from "svelte/transition";

  const activeFilters = $derived(productsStore.activeFiltersDescription);
  const hasActiveFilters = $derived(activeFilters.length > 0);
  const isSearchActive = $derived(productsStore.isSearchActive);
  const searchQuery = $derived(productsStore.filters.searchQuery);

  // Pendant une recherche : on affiche la recherche (priorité sur les filtres
  // de vue "en pause"). Sinon : la liste des filtres actifs.
  const displayText = $derived(
    isSearchActive
      ? `"${searchQuery}"`
      : activeFilters.length > 2
        ? `${activeFilters.slice(0, 2).join(", ")}...`
        : activeFilters.join(", "),
  );

  const resetTitle = $derived(
    isSearchActive ? "Effacer la recherche" : "Effacer tous les filtres",
  );

  // Contextuel : sort de la recherche si active (filttres de vue préservés
  // et réactivés), sinon clear tous les filtres.
  function handleReset() {
    if (productsStore.isSearchActive) {
      productsStore.setSearchQuery("");
    } else {
      productsStore.clearFilters();
    }
  }
</script>

<!-- Indicateur flottant : visible quand des filtres OU une recherche sont actifs -->
{#if hasActiveFilters || isSearchActive}
  <div
    class="fixed right-[15%] bottom-10 z-50 md:right-24 print:hidden"
    transition:scale={{ duration: 200, start: 0.8 }}
  >
    <div
      class=" bg-secondary/80 text-secondary-content flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg"
    >
      <span class="max-w-32 truncate text-xs font-medium">{displayText}</span>
      <button
        class="btn btn-sm btn-circle btn-secondary"
        onclick={handleReset}
        title={resetTitle}
      >
        <FunnelX class="size-6" />
      </button>
    </div>
  </div>
{/if}

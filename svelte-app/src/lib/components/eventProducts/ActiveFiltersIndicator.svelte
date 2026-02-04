<script lang="ts">
  import { FunnelX } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { scale } from "svelte/transition";

  const activeFilters = $derived(productsStore.activeFiltersDescription);
  const hasActiveFilters = $derived(activeFilters.length > 0);
  const displayText = $derived(
    activeFilters.length > 2
      ? `${activeFilters.slice(0, 2).join(", ")}...`
      : activeFilters.join(", "),
  );
</script>

<!-- Indicateur flottant des filtres actifs - visible uniquement ~~sur mobile~~ quand des filtres sont actifs -->
{#if hasActiveFilters}
  <div
    class="fixed right-[15%] bottom-6 z-50 md:right-24 print:hidden"
    transition:scale={{ duration: 200, start: 0.8 }}
  >
    <div
      class="alert alert-soft bg-secondary/90 text-secondary-content flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-sm"
    >
      <span class="max-w-32 truncate text-xs font-medium">{displayText}</span>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        onclick={() => productsStore.clearFilters()}
        title="Effacer tous les filtres"
      >
        <FunnelX class="size-4" />
      </button>
    </div>
  </div>
{/if}

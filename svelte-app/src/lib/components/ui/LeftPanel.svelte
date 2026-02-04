<script lang="ts">
  import type { Snippet } from "svelte";
  import { FunnelIcon, FunnelX, PanelLeftClose, X } from "@lucide/svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";

  let filtersDrawerOpen = $state(false);

  interface Props {
    children?: Snippet;
    bgClass?: string;
    width?: string;
  }
  let { children, width = "80", bgClass = "bg-base-200" }: Props = $props();

  const panelWidth = $derived("w-" + width);
</script>

{#if globalState.isDesktop}
  <!-- Conteneur fixe à gauche avec overflow -->
  <div
    class="{bgClass} {panelWidth
      ? panelWidth
      : 'w-100'} fixed top-0 left-0 z-40 h-dvh overflow-y-auto p-4 pb-12 print:hidden"
  >
    {@render children?.()}
  </div>
{:else}
  <div class="drawer">
    <input
      id="filters-drawer"
      type="checkbox"
      class="drawer-toggle"
      bind:checked={filtersDrawerOpen}
    />

    <div class="drawer-side">
      <label for="filters-drawer" class="drawer-overlay"></label>

      <div class="menu bg-base-200 h-vh w-[95vw] p-4">
        {@render children?.()}
      </div>
    </div>
  </div>

  <!-- FAB flottant pour mobile -->
  <div class="fixed bottom-10 left-4 z-50 print:hidden">
    <label
      for="filters-drawer"
      class="btn btn-primary btn-circle btn-lg shadow-lg"
    >
      {#if filtersDrawerOpen}
        <PanelLeftClose class="h-6 w-6" />
      {:else}
        <FunnelIcon class="h-6 w-6" />
      {/if}
    </label>
  </div>
{/if}

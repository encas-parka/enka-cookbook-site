<script lang="ts">
  import type { Snippet } from "svelte";
  import { FunnelIcon, PanelLeftClose } from "@lucide/svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    Drawer,
    DrawerOverlay,
    DrawerContent,
    DrawerHandle,
  } from "@abhivarde/svelte-drawer";

  let filtersDrawerOpen = $state(false);

  interface Props {
    children?: Snippet;
    bgClass?: string;
  }
  let { children, bgClass = "bg-base-200" }: Props = $props();
</script>

{#if globalState.isDesktop}
  <!-- Conteneur fixe à gauche avec overflow -->
  <div
    class="{bgClass} fixed top-0 left-0 z-40 h-dvh w-sm overflow-y-auto p-4 pb-12 print:hidden"
  >
    {@render children?.()}
  </div>
{:else}
  <!-- Implementation Mobile via svelte-drawer (Portal) -->
  <Drawer bind:open={filtersDrawerOpen} direction="left">
    <DrawerOverlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <DrawerContent
      class="fixed top-0 bottom-0 left-0 z-50 flex w-[90vw] max-w-100 flex-row shadow-2xl {bgClass}"
    >
      <div class="min-h-0 flex-1 overflow-y-auto p-4 pb-24">
        <div data-vaul-no-drag>
          {@render children?.()}
        </div>
      </div>
      <div class="flex items-center px-1">
        <DrawerHandle />
      </div>
    </DrawerContent>
  </Drawer>

  <!-- FAB flottant pour mobile -->
  <div class="fixed bottom-10 left-[2%] z-50 print:hidden">
    <button
      class="btn btn-primary btn-circle btn-lg shadow-lg"
      onclick={() => (filtersDrawerOpen = !filtersDrawerOpen)}
      aria-label="Ouvrir les filtres"
    >
      {#if filtersDrawerOpen}
        <PanelLeftClose class="h-6 w-6" />
      {:else}
        <FunnelIcon class="h-6 w-6" />
      {/if}
    </button>
  </div>
{/if}

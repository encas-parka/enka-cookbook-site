<script lang="ts">
  import {
    GitMerge,
    Search,
    Unlink,
    ChevronRight,
    Info,
  } from "@lucide/svelte";
  import type { ProductModalStateType } from "$lib/types/store.types.js";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { fade } from "svelte/transition";

  interface Props {
    modalState: ProductModalStateType;
    isArchiveMode: boolean;
    onClose?: () => void;
  }

  let { modalState, isArchiveMode, onClose }: Props = $props();

  // Données du produit courant
  const product = $derived(modalState.product);

  // État de la recherche
  let searchQuery = $state("");
  let showResults = $state(false);

  // Résultats de recherche dérivés
  const searchResults = $derived(
    product ? productsStore.searchProducts(searchQuery, product.$id) : [],
  );

  // État du merge du produit courant (mergedInto est la source de vérité)
  const mergedIntoId = $derived(product?.mergedInto ?? null);
  const mergedTargetName = $derived(
    mergedIntoId
      ? productsStore.getEnrichedProductById(mergedIntoId)?.productName ?? "…"
      : "",
  );

  // Produits mergés VERS ce produit (ce produit est un target)
  const mergedFromNames = $derived(product?.mergedProductNames ?? []);
  const mergedFromIds = $derived(product?.mergedProductIds ?? []);

  // Ce produit est-il un target (a des produits mergés vers lui) ?
  const isTarget = $derived(mergedFromNames.length > 0);

  // Afficher la section merge si on n'est pas en mode archive
  const showMergeSection = $derived(!isArchiveMode);

  async function handleMerge(targetId: string) {
    if (!product) return;
    await productsStore.mergeProducts(product.$id, targetId);
    searchQuery = "";
    showResults = false;
    // Fermer le modal : le source vient d'être mergé, il n'est plus dans #productModels
    onClose?.();
  }

  function handleUnmergeFromSource(sourceId: string) {
    if (!product) return;
    productsStore.unmergeProduct(sourceId, product.$id);
  }

  function handleUnmergeFromTarget() {
    if (!product || !mergedIntoId) return;
    productsStore.unmergeProduct(product.$id, mergedIntoId);
  }

  function handleSearchFocus() {
    showResults = true;
  }

  function handleSearchBlur() {
    // Délai pour permettre le clic sur un résultat avant de fermer
    setTimeout(() => (showResults = false), 200);
  }
</script>

{#if product && showMergeSection}
  <div class="space-y-3 pt-2">
    <h4 class="flex items-center gap-2 text-sm font-semibold text-base-content/70">
      <GitMerge class="h-4 w-4" />
      Fusion de produits
    </h4>

    <!-- Cas 1 : Ce produit est fusionné VERS un autre (source) -->
    {#if mergedIntoId}
      <div class="rounded-box bg-warning/10 flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-base-content/70">Fusionné vers</span>
          <span class="font-medium">{mergedTargetName}</span>
        </div>
        <button
          class="btn btn-ghost btn-sm"
          onclick={handleUnmergeFromTarget}
        >
          <Unlink class="h-4 w-4" />
          Annuler
        </button>
      </div>

    <!-- Cas 2 : Ce produit est un target (a des produits mergés vers lui) -->
    {:else if isTarget}
      <div class="rounded-box bg-base-200 px-4 py-3 space-y-2">
        <div class="text-sm text-base-content/70">
          Produits fusionnés vers celui-ci :
        </div>
        {#each mergedFromIds as sourceId, i (sourceId)}
          <div class="flex items-center justify-between">
            <span class="badge badge-soft badge-sm">
              {mergedFromNames[i]}
            </span>
            <button
              class="btn btn-ghost btn-xs"
              onclick={() => handleUnmergeFromSource(sourceId)}
            >
              <Unlink class="h-3 w-3" />
              Annuler
            </button>
          </div>
        {/each}
      </div>

    <!-- Cas 3 : Produit normal — recherche de target -->
    {:else}
      <div class="rounded-box bg-base-200 px-4 py-3 space-y-2">
        <div class="flex items-center gap-2 text-xs text-base-content/50">
          <Info class="h-3 w-3" />
          Fusionner ce produit vers un autre. Les quantités seront ajoutées au produit cible.
        </div>
        <div class="relative">
          <div class="flex items-center gap-2">
            <div class="join join-horizontal flex-1">
              <div class="join-item bg-base-100 flex items-center px-2">
                <Search class="h-4 w-4 text-base-content/40" />
              </div>
              <input
                type="text"
                class="join-item input input-sm flex-1 border-0 bg-base-100"
                placeholder="Rechercher un produit cible…"
                bind:value={searchQuery}
                onfocus={handleSearchFocus}
                onblur={handleSearchBlur}
              />
            </div>
          </div>

          <!-- Dropdown des résultats -->
          {#if showResults && searchQuery.trim() && searchResults.length > 0}
            <div
              class="absolute z-50 mt-1 w-full rounded-box bg-base-100 shadow-lg border border-base-300 max-h-48 overflow-y-auto"
              in:fade={{ duration: 100 }}
            >
              {#each searchResults as result (result.$id)}
                <button
                  class="flex w-full items-center justify-between px-3 py-2 hover:bg-base-200 text-sm"
                  onclick={() => handleMerge(result.$id)}
                >
                  <span>{result.productName}</span>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-ghost badge-xs">{result.productType}</span>
                    <ChevronRight class="h-3 w-3 text-base-content/30" />
                  </div>
                </button>
              {/each}
            </div>
          {:else if showResults && searchQuery.trim() && searchResults.length === 0}
            <div class="absolute z-50 mt-1 w-full rounded-box bg-base-100 shadow-lg border border-base-300 px-3 py-2 text-sm text-base-content/50">
              Aucun produit trouvé
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

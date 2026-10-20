<script lang="ts">
  import { GitMerge, Search, Unlink, ChevronRight, Info } from "@lucide/svelte";
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
  let activeIndex = $state(-1);

  // Résultats de recherche dérivés
  const searchResults = $derived(
    product ? productsStore.searchProducts(searchQuery, product.id) : [],
  );

  // Dropdown visible (résultats non vides)
  const isDropdownOpen = $derived(showResults && searchQuery.trim().length > 0);

  // État du merge du produit courant (mergedInto est la source de vérité)
  const mergedIntoId = $derived(product?.mergedInto ?? null);
  const mergedTargetName = $derived(
    mergedIntoId
      ? (productsStore.getEnrichedProductById(mergedIntoId)?.productName ?? "…")
      : "",
  );

  // Produits mergés VERS ce produit (ce produit est une cible)
  const mergedFrom = $derived(product?.mergedFrom ?? []);

  // Ce produit est-il une cible (a des produits mergés vers lui) ?
  const isTarget = $derived(mergedFrom.length > 0);

  // Afficher la section merge si on n'est pas en mode archive
  const showMergeSection = $derived(!isArchiveMode);

  async function handleMerge(targetId: string) {
    if (!product) return;
    await productsStore.mergeProducts(product.id, targetId);
    searchQuery = "";
    showResults = false;
    // Fermer le modal : la source vient d'être mergée, elle n'est plus dans #productModels
    onClose?.();
  }

  function handleUnmergeFromSource(sourceId: string) {
    if (!product) return;
    productsStore.unmergeProduct(sourceId, product.id);
  }

  function handleUnmergeFromTarget() {
    if (!product || !mergedIntoId) return;
    productsStore.unmergeProduct(product.id, mergedIntoId);
  }

  function handleSearchFocus() {
    showResults = true;
  }

  function handleSearchBlur() {
    // Délai pour permettre le clic sur un résultat avant de fermer
    setTimeout(() => {
      showResults = false;
      activeIndex = -1;
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isDropdownOpen || searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % searchResults.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex =
        activeIndex <= 0 ? searchResults.length - 1 : activeIndex - 1;
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleMerge(searchResults[activeIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      showResults = false;
      activeIndex = -1;
    }
  }
</script>

{#if product && showMergeSection}
  <div class="space-y-3 pt-2">
    <h4
      class="flex items-center gap-2 text-sm font-semibold text-base-content/70"
    >
      <GitMerge class="h-4 w-4" />
      Fusion de produits
    </h4>

    <!-- Cas 1 : Ce produit est fusionné VERS un autre (source) -->
    {#if mergedIntoId}
      <div
        class="flex items-center justify-between rounded-box bg-warning/10 px-4 py-3"
      >
        <div class="flex items-center gap-2 text-sm">
          <span class="text-base-content/70">Fusionné vers</span>
          <span class="font-medium">{mergedTargetName}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick={handleUnmergeFromTarget}>
          <Unlink class="h-4 w-4" />
          Annuler
        </button>
      </div>

      <!-- Cas 2 : Ce produit est une cible (a des produits mergés vers lui) -->
    {:else if isTarget}
      <div class="space-y-2 rounded-box bg-base-200 px-4 py-3">
        <div class="text-sm text-base-content/70">
          Produits fusionnés vers celui-ci :
        </div>
        {#each mergedFrom as item (item.id)}
          <div class="flex items-center justify-between">
            <span class="badge badge-soft">
              {item.name}
            </span>
            <button
              class="btn btn-ghost btn-xs"
              onclick={() => handleUnmergeFromSource(item.id)}
            >
              <Unlink class="size-3" />
              Annuler
            </button>
          </div>
        {/each}
      </div>

      <!-- Cas 3 : Produit normal — recherche de cible -->
    {:else}
      <div class="space-y-2 rounded-box bg-base-200 px-4 py-3">
        <div class="flex items-center gap-2 text-sm text-base-content/50">
          <Info class=" size-4 shrink-0 max-sm:hidden" />
          Fusionner ce produit vers un autre: les quantités requises et les achats
          effectués seront ajoutés au produit cible. Cela ne modifie pas les recettes,
          mais uniquement la liste de courses.
        </div>
        <div class="relative">
          <label class="input w-full border-0">
            <Search class="h-4 w-4 shrink-0 text-base-content/40" />
            <input
              type="text"
              role="combobox"
              aria-expanded={isDropdownOpen && searchResults.length > 0}
              aria-controls="merge-search-listbox"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0
                ? `merge-option-${activeIndex}`
                : undefined}
              class="min-w-0 grow bg-base-100"
              placeholder="Rechercher un produit cible…"
              bind:value={searchQuery}
              onfocus={handleSearchFocus}
              onblur={handleSearchBlur}
              onkeydown={handleKeydown}
            />
          </label>

          <!-- Dropdown des résultats -->
          {#if isDropdownOpen && searchResults.length > 0}
            <div
              id="merge-search-listbox"
              role="listbox"
              class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
              in:fade={{ duration: 100 }}
            >
              {#each searchResults as result, i (result.id)}
                <button
                  id="merge-option-{i}"
                  role="option"
                  aria-selected={i === activeIndex}
                  class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-base-200 {i ===
                  activeIndex
                    ? 'bg-base-200'
                    : ''}"
                  onclick={() => handleMerge(result.id)}
                >
                  <span>{result.productName}</span>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-ghost badge-xs"
                      >{result.productType}</span
                    >
                    <ChevronRight class="h-3 w-3 text-base-content/30" />
                  </div>
                </button>
              {/each}
            </div>
          {:else if isDropdownOpen && searchResults.length === 0}
            <div
              role="status"
              class="absolute z-50 mt-1 w-full rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content/50 shadow-lg"
            >
              Aucun produit trouvé
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

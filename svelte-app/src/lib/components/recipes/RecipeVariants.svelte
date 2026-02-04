<script lang="ts">
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import type { RecipeIndexEntry } from "$lib/types/recipes.types";
  import { navigate } from "$lib/router";

  import { onMount } from "svelte";
  import { Copy } from "@lucide/svelte";

  interface Props {
    recipeId: string;
  }

  let { recipeId }: Props = $props();

  let variants = $state<RecipeIndexEntry[]>([]);
  let root = $state<RecipeIndexEntry | null>(null);
  let loading = $state(true);

  // Charger les variantes
  async function loadVariants() {
    loading = true;
    try {
      const group = await recipesStore.getVariantGroup(recipeId, 2);
      root = group.root;
      variants = group.variants.sort((a, b) =>
        a.title.localeCompare(b.title, "fr-FR"),
      );
    } catch (error) {
      console.error("[RecipeVariants] Erreur chargement:", error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadVariants();
  });

  // Filtrer pour ne pas afficher la recette actuelle
  let displayVariants = $derived.by(() => {
    return variants.filter((v) => v.$id !== recipeId);
  });
</script>

{#if loading}
  <div class="card bg-base-100 mt-4 shadow-sm">
    <div class="card-body p-4">
      <div class="loading loading-spinner loading-sm"></div>
    </div>
  </div>
{:else if displayVariants.length > 0}
  <div class="card bg-base-100 mt-4 shadow-sm">
    <div class="card-body p-4">
      <h4 class="card-title flex items-center gap-2">
        <Copy class="h-4 w-4" />
        {displayVariants.length} variante{displayVariants.length > 1 ? "s" : ""}
        de cette recette
      </h4>

      <div class="flex flex-wrap gap-x-4 gap-y-2">
        {#each displayVariants as variant}
          <button
            class="btn btn-ghost"
            onclick={() => navigate(`/recipe/${variant.$id}`)}
          >
            <div class="flex items-center gap-2 text-sm">
              {variant.title}

              {#if variant.versionLabel}
                <span class="badge badge-ghost badge-xs">
                  {variant.versionLabel}
                </span>
              {/if}
              {#if variant.$id === root?.$id}
                <span class="badge badge-primary badge-xs badge-soft"
                  >Originale</span
                >
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

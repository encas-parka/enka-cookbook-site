<script lang="ts">
  import {
    BookOpen,
    Clock,
    ChefHat,
    ArrowRight,
    Users,
    ArrowBigRight,
    AlertTriangle,
  } from "@lucide/svelte";
  import { formatDateRelative } from "$lib/utils/date-helpers";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import { navigate } from "$lib/router";
  import type { RecipeIndexEntry } from "$lib/types/recipes.types";
  import { getTypeDisplay } from "$lib/utils/recipeUtils";
  import { globalState } from "$lib/stores/GlobalState.svelte";

  // Récupérer les dernières recettes créées par l'utilisateur
  const myLatestRecipes = $derived.by(() => {
    if (!recipesStore.isInitialized) {
      return [];
    }

    return recipesStore.recipesIndex
      .filter((r) => r.auteur === globalState.userName)
      .sort((a, b) => {
        const dateA = a.$updatedAt ? new Date(a.$updatedAt).getTime() : 0;
        const dateB = b.$updatedAt ? new Date(b.$updatedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  });

  function formatRecipeDate(recipe: RecipeIndexEntry) {
    return recipe.$updatedAt
      ? formatDateRelative(recipe.$updatedAt)
      : recipe.$createdAt
        ? formatDateRelative(recipe.$updatedAt)
        : "Date inconnue";
  }

  function getRecipeTypeLabel(type: string): string {
    switch (type) {
      case "entree":
        return "Entrée";
      case "plat":
        return "Plat";
      case "dessert":
        return "Dessert";
      default:
        return type;
    }
  }

  function getRecipeIcon(recipe: RecipeIndexEntry) {
    return getTypeDisplay(recipe.typeR, recipe.categories ?? undefined);
  }

  // État de chargement combiné
  const isLoading = $derived(
    !recipesStore.isInitialized && !recipesStore.loading,
  );

  function viewRecipe(uuid: string) {
    navigate(`/recipe/${uuid}`);
  }

  function viewAllRecipes() {
    navigate("/recipe/my");
  }

  function createNewRecipe() {
    navigate("/recipe/new");
  }
</script>

{#snippet recipeCard(recipe: RecipeIndexEntry, withBorder: boolean)}
  {@const iconInfo = getRecipeIcon(recipe)}
  <div
    class="{withBorder
      ? 'border-accent/60 border-l-2'
      : ''} bg-base-200 hover:bg-base-300 flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors"
    onclick={() => viewRecipe(recipe.$id)}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        viewRecipe(recipe.$id);
      }
    }}
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="text-primary flex flex-wrap items-center gap-x-2">
          <svg class="text-primary h-4 w-4 shrink-0">
            <use href={`/icons/sprite.svg#${iconInfo.iconId}`} />
          </svg>
          <div class="truncate text-sm font-medium">
            {recipe.title}
          </div>
          {#if recipe.versionLabel}
            <span class="font-medium">
              - {recipe.versionLabel}
            </span>
          {/if}
        </div>

        <!-- Métadonnées -->
        <div class="text-base-content/50 flex items-center gap-3 text-xs">
          <div class="flex items-center gap-1">
            <span>{formatRecipeDate(recipe)}</span>
          </div>
        </div>
        {#if recipe.draft}
          <div class="badge badge-accent badge-outline badge-xs">brouillon</div>
        {/if}
      </div>
    </div>
    <ArrowRight class="mt-1 h-4 w-4 shrink-0 opacity-40" />
  </div>
{/snippet}

<div class="flex items-center justify-between">
  <h2 class="card-title flex items-center gap-2">
    <BookOpen class="text-primary h-5 w-5 stroke-3" />
    Vos dernières Recettes
  </h2>
  <button
    class="btn btn-sm btn-link"
    onclick={viewAllRecipes}
    title="Voir toutes les recettes"
  >
    Voir tout
    <ArrowRight size={16} />
  </button>
</div>

{#if recipesStore.error}
  <div class="py-6 text-center">
    <div class="text-error mb-2">
      <AlertTriangle class="mx-auto h-8 w-8" />
    </div>
    <p class="text-base-content/60 text-sm">
      Erreur de chargement des recettes
    </p>
    <button
      class="btn btn-ghost btn-xs mt-2"
      onclick={() => window.location.reload()}
    >
      Réessayer
    </button>
  </div>
{:else if isLoading}
  <!-- Skeleton loader -->
  <div class="space-y-3 py-4">
    <div class="skeleton h-32 w-full rounded-lg"></div>
    <div class="skeleton h-32 w-full rounded-lg"></div>
    <div class="skeleton h-32 w-full rounded-lg"></div>
  </div>
{:else if myLatestRecipes.length === 0}
  <div class="py-6 text-center">
    <ChefHat class="mx-auto mb-3 h-12 w-12 opacity-20" />
    <p class="text-base-content/60 mb-4 text-sm">Aucune recette publiée</p>
    <button class="btn btn-primary btn-sm" onclick={createNewRecipe}>
      <BookOpen class="mr-2 h-4 w-4" />
      Créer une recette
    </button>
  </div>
{:else}
  <!-- Mes dernières recettes -->
  {#if myLatestRecipes.length > 0}
    <div class="space-y-2">
      {#each myLatestRecipes as recipe (recipe.$id)}
        {@render recipeCard(recipe, true)}
      {/each}
    </div>
  {/if}

  <!-- Bouton création rapide -->
  <div class="card-actions justify-end pt-4">
    <button
      class="btn btn-primary sm:btn-sm btn-soft"
      onclick={createNewRecipe}
    >
      <BookOpen class="mr-2 h-4 w-4" />
      Créer une recette
    </button>
  </div>
{/if}

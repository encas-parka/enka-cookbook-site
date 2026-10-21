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
        const dateA = a.updated ? new Date(a.updated).getTime() : 0;
        const dateB = b.updated ? new Date(b.updated).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  });

  function formatRecipeDate(recipe: RecipeIndexEntry) {
    return recipe.updated
      ? formatDateRelative(recipe.updated)
      : recipe.created
        ? formatDateRelative(recipe.updated)
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
      ? 'border-l-2 border-accent/60'
      : ''} flex cursor-pointer items-start gap-3 rounded-lg bg-base-200 p-3 transition-colors hover:bg-base-300"
    onclick={() => viewRecipe(recipe.id)}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        viewRecipe(recipe.id);
      }
    }}
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex flex-wrap items-center gap-x-2 text-primary">
          <svg class="h-4 w-4 shrink-0 text-primary">
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
        <div class="flex items-center gap-3 text-xs text-base-content/50">
          <div class="flex items-center gap-1">
            <span>{formatRecipeDate(recipe)}</span>
          </div>
        </div>
        {#if recipe.draft}
          <div class="badge badge-outline badge-xs badge-accent">brouillon</div>
        {/if}
      </div>
    </div>
    <ArrowRight class="mt-1 h-4 w-4 shrink-0 opacity-40" />
  </div>
{/snippet}

<div class="flex items-center justify-between">
  <h2 class="card-title flex items-center gap-2">
    <BookOpen class="h-5 w-5 stroke-3 text-primary" />
    Vos dernières Recettes
  </h2>
  <button
    class="btn btn-link btn-sm"
    onclick={viewAllRecipes}
    title="Voir toutes les recettes"
  >
    Voir tout
    <ArrowRight class="size-4" />
  </button>
</div>

{#if recipesStore.error}
  <div class="py-6 text-center">
    <div class="mb-2 text-error">
      <AlertTriangle class="mx-auto h-8 w-8" />
    </div>
    <p class="text-sm text-base-content/60">
      Erreur de chargement des recettes
    </p>
    <button
      class="btn mt-2 btn-ghost btn-xs"
      onclick={() => window.location.reload()}
    >
      Réessayer
    </button>
  </div>
{:else if isLoading}
  <!-- Skeleton loader -->
  <div class="space-y-3 py-4">
    <div class="h-32 w-full skeleton rounded-lg"></div>
    <div class="h-32 w-full skeleton rounded-lg"></div>
    <div class="h-32 w-full skeleton rounded-lg"></div>
  </div>
{:else if myLatestRecipes.length === 0}
  <div class="py-6 text-center">
    <ChefHat class="mx-auto mb-3 h-12 w-12 opacity-20" />
    <p class="mb-4 text-sm text-base-content/60">Aucune recette publiée</p>
    <button class="btn btn-primary btn-sm" onclick={createNewRecipe}>
      <BookOpen class="mr-2 h-4 w-4" />
      Créer une recette
    </button>
  </div>
{:else}
  <!-- Mes dernières recettes -->
  {#if myLatestRecipes.length > 0}
    <div class="space-y-2">
      {#each myLatestRecipes as recipe (recipe.id)}
        {@render recipeCard(recipe, true)}
      {/each}
    </div>
  {/if}

  <!-- Bouton création rapide -->
  <div class="card-actions justify-end pt-4">
    <button
      class="btn btn-soft btn-primary sm:btn-sm"
      onclick={createNewRecipe}
    >
      <BookOpen class="mr-2 h-4 w-4" />
      Créer une recette
    </button>
  </div>
{/if}

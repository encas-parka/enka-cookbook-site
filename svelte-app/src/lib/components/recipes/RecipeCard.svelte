<script lang="ts">
  import type { RecipeIndexEntry } from "$lib/types/recipes.types";
  import { p } from "$lib/router";
  import RecipeRegimeBadges from "./RecipeRegimeBadges.svelte";
  import { getTypeDisplay } from "$lib/utils/recipeUtils";
  import { globalState } from "@/lib/stores/GlobalState.svelte";

  interface Props {
    recipe: RecipeIndexEntry;
    highlightedIngredients?: string[];
  }

  let { recipe, highlightedIngredients = [] }: Props = $props();

  // Récupérer l'affichage avec la priorité : catégorie > type
  const typeDisplay = $derived(
    getTypeDisplay(recipe.typeR, recipe.categories || undefined),
  );
</script>

<a
  class="card bg-base-100 cursor-pointer p-4 shadow-sm transition-shadow hover:shadow-md {recipe.auteur ===
    globalState.userName && 'border-accent/60 border-l-3'}"
  href={p(`/recipe/${recipe.$id}`)}
  role="button"
>
  <!-- Absolute top @md -->
  {#if globalState.isDesktop}
    <h3
      class="text-primary bg-base-100 rounded-t-box border-t-base-300 absolute -top-4 left-0 flex max-w-5/6 items-center-safe gap-3 border-t py-1 ps-4 pe-6"
    >
      <svg class="inline size-6 stroke-3">
        <use href={`/icons/sprite.svg#${typeDisplay.iconId}`} />
      </svg>
      {recipe.title}
      {#if recipe.versionLabel}
        <span class="text-sm">{recipe.versionLabel}</span>
      {/if}
      {#if recipe.draft}
        <div class="badge badge-accent badge-outline badge-sm">brouillon</div>
      {/if}
    </h3>

    <div
      class="bg-base-100 rounded-t-box border-base-300 absolute -top-4 right-0 border-t px-1"
    >
      {#if recipe.regime}
        <RecipeRegimeBadges regimes={recipe.regime} iconOnly />
      {/if}
    </div>
  {/if}

  <!-- Header -->
  <div class=" flex flex-wrap items-start justify-between gap-4 @md:my-2">
    <div class="min-w-2/3 flex-1">
      <!-- title mobile-->
      {#if !globalState.isDesktop}
        <div class="flex gap-4">
          <div
            class="text-primary mb-2 inline-flex flex-wrap items-center gap-2 font-bold"
          >
            <div class="inline-flex items-center gap-x-2 leading-5">
              <svg class=" size-6 shrink-0 self-start stroke-3">
                <use href={`/icons/sprite.svg#${typeDisplay.iconId}`} />
              </svg>
              <div>
                {recipe.title}
                {#if recipe.versionLabel}
                  <span class="text-sm"> • {recipe.versionLabel}</span>
                {/if}
              </div>
            </div>
            {#if recipe.draft}
              <div class="badge badge-accent badge-outline badge-sm">
                brouillon
              </div>
            {/if}
          </div>
          {#if recipe.regime}
            <RecipeRegimeBadges regimes={recipe.regime} iconOnly />
          {/if}
        </div>
      {/if}
      <div class="flex flex-col items-start">
        <div class="">
          {#if recipe.auteur}
            <span
              class={recipe.auteur === globalState.userName
                ? "text-accent font-semibold"
                : "text-base-content/70 "}>de {recipe.auteur}</span
            >
          {/if}
        </div>
        <div class="text-base-content/60 text-sm text-wrap">
          {#if recipe.check}
            <p>
              testée pour {recipe.plate}
              couverts
            </p>
          {:else}
            <p class="">
              théoriquement pour {recipe.plate} couverts
              <strong>(non testée)</strong>
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Badges -->
    <div class="ms-auto flex flex-col justify-end gap-2">
      <div class=" flex flex-wrap justify-end gap-1 pt-1">
        {#if recipe.categories}
          {#if recipe.region}
            <span class="badge badge-ghost">{recipe.region}</span>
          {/if}
          {#each recipe.categories as categorie}
            <span class="badge badge-primary badge-soft">{categorie}</span>
          {/each}
        {/if}
      </div>

      <div class="mb-2 flex flex-wrap justify-end gap-1">
        {#if recipe.serveHot}
          <span class="badge badge-soft badge-error">Servir Chaud</span>
        {:else}
          <span class="badge badge-soft badge-info">Servir Froid</span>
        {/if}

        {#if recipe.cuisson}
          <span class="badge badge-soft badge-warning">Avec Cuisson</span>
        {:else}
          <span class="badge badge-soft badge-success">Sans Cuisson</span>
        {/if}

        {#if recipe.saison}
          {#each recipe.saison as saison}
            <span class="badge badge-soft badge-accent">{saison}</span>
          {/each}
        {/if}
      </div>
    </div>
    <!-- Badges température et cuisson -->
  </div>

  <!-- Ingrédients -->
  {#if recipe.ingredients && recipe.ingredients.length > 0}
    <div class="my-1 flex flex-wrap text-sm">
      <span class="me-2 font-semibold">Ingrédients : </span>
      {#each recipe.ingredients as ingredient, index}
        <span class="break-word me-1">
          {ingredient}{#if index < recipe.ingredients.length - 1},{/if}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Matériel -->
  {#if recipe.materiel && recipe.materiel.length > 0}
    <div class="flex flex-wrap text-sm">
      <span class="me-2 font-semibold">Matériel : </span>
      {#each recipe.materiel as item, index}
        <span class="break-word me-1">
          {item}{#if index < recipe.materiel.length - 1},{/if}
        </span>
      {/each}
    </div>
  {/if}
</a>

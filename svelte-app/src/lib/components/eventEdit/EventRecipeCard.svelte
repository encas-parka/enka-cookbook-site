<script lang="ts">
  import type {
    RecettesTypeR,
    RecipeForDisplay,
  } from "$lib/types/recipes.types";
  import { scaleAndFormatIngredient } from "$lib/utils/QuantityFormatter";
  import {
    extractDate,
    extractTime,
    formatDateWdDayMonthShort,
  } from "$lib/utils/date-helpers";
  import RecipeIngredientsList from "$lib/components/recipes/RecipeIngredientsList.svelte";
  import RecipePreparation from "$lib/components/recipes/RecipePreparation.svelte";
  import RecipeRegimeBadges from "$lib/components/recipes/RecipeRegimeBadges.svelte";
  import { Utensils, Calendar, ChefHat, Users } from "@lucide/svelte";
  import { getTypeDisplay } from "$lib/utils/recipeUtils";

  interface Props {
    recipe: RecipeForDisplay;
    meal?: any;
    mealRecipe?: any;
    totalGuests?: number;
  }

  let { recipe, meal, mealRecipe, totalGuests = 0 }: Props = $props();

  // Calculer le facteur d'échelle pour les quantités
  const scaleFactor = $derived.by(() => {
    if (!mealRecipe || !recipe.plate) return 1;
    return mealRecipe.plates / recipe.plate;
  });

  // Informations sur le repas
  const mealDate = $derived.by(() => {
    if (!meal?.date) return null;
    return extractDate(meal.date);
  });

  const mealTime = $derived.by(() => {
    if (!meal?.date) return null;
    return extractTime(meal.date);
  });

  const mealTimeLabel = $derived.by(() => {
    if (!mealTime) return "";
    switch (mealTime) {
      case "matin":
        return "Matin";
      case "midi":
        return "Midi";
      case "soir":
        return "Soir";
      default:
        return "";
    }
  });

  // Type de repas pour cette recette dans l'événement
  const recipeTypeInEvent = $derived.by(() => {
    if (!mealRecipe?.typeR) return recipe.typeR;
    return mealRecipe.typeR;
  });

  // Nombre de couverts pour cette recette dans l'événement
  const recipePlates = $derived.by(() => {
    return mealRecipe?.plates || recipe.plate;
  });

  // Formatteur pour les couverts
  function formatPlates(plates: number): string {
    if (plates === 1) return "1 couvert";
    return `${plates} couverts`;
  }

  // Type de repas affiché
  function getTypeLabel(type: string): string {
    switch (type) {
      case "entree":
        return "Entrée";
      case "plat":
        return "Plat";
      case "dessert":
        return "Dessert";
      case "autre":
        return "Autre";
      default:
        return type;
    }
  }

  function getRecipeColor(typeR: RecettesTypeR) {
    if (typeR === "entree") return "bg-lime-100 border-lime-200";
    else if (typeR === "plat") return "bg-orange-100 border-orange-200";
    else if (typeR === "dessert") return "bg-pink-100 border-pink-200";
    else if (typeR === "autre") return "bg-purple-100 border-purple-200";
    else return "bg-base-200";
  }

  // Date formatée pour l'affichage
  const formattedDate = $derived.by(() => {
    if (!mealDate) return "";
    return formatDateWdDayMonthShort(mealDate);
  });

  // Récupérer l'affichage avec la priorité : catégorie > type
  const typeDisplay = $derived(
    getTypeDisplay(recipe.typeR, recipe.categories || undefined),
  );
</script>

<div
  id="recipe-{recipe.$id}"
  class="card bg-base-100 border-base-300 print-break-auto border shadow-lg print:border-none print:shadow-none"
>
  <div class="card-body p-2 md:p-6">
    <!-- En-tête de la carte -->
    <div class="border-base-300 mb-4 border-b pb-4">
      <div
        class="flex flex-wrap items-baseline justify-between gap-4 print:gap-1"
      >
        <div class="flex min-w-2/3 flex-1 gap-2">
          <svg class="size-6">
            <use href={`/icons/sprite.svg#${typeDisplay.iconId}`} />
          </svg>
          <div class="text-xl font-bold">{recipe.title}</div>
        </div>

        <div class="ms-auto flex flex-wrap items-center justify-end gap-4">
          {#if formattedDate}
            <div
              class="text-base-content/80 flex items-center gap-2 text-base font-bold"
            >
              <Calendar class="h-4 w-4" />
              <span>{formattedDate}</span>
              {#if mealTimeLabel}
                <span class="">{mealTimeLabel}</span>
              {/if}
            </div>
          {/if}

          {#if recipeTypeInEvent}
            <div
              class="badge text-base-content/80 font-medium {getRecipeColor(
                recipeTypeInEvent,
              )}"
            >
              {getTypeLabel(recipeTypeInEvent)}
            </div>
          {/if}

          <!-- Badges de régimes -->
          <div class="flex-shrink-0">
            {#if recipe.regime}
              <RecipeRegimeBadges
                regimes={recipe.regime}
                iconOnly={true}
                colorClass={"success"}
              />
            {/if}
          </div>
        </div>
      </div>

      <!-- Informations supplémentaires -->
      <div
        class="border-base-300 flex flex-wrap items-center gap-4 pt-4 print:gap-2 print:pt-0"
      >
        <div class="text-base-content/80 flex items-center gap-2 py-2 text-lg">
          <Users class="h-4 w-4" />
          <span>{formatPlates(recipePlates)}</span>
        </div>
        <div class="flex flex-wrap gap-1">
          {#if recipe.serveHot}
            <span class="badge badge-error badge-sm badge-soft"
              >Servir Chaud</span
            >
          {:else}
            <span class="badge badge-info badge-sm badge-soft"
              >Servir Froid</span
            >
          {/if}

          {#if recipe.cuisson}
            <span class="badge badge-warning badge-sm badge-soft"
              >Avec Cuisson</span
            >
          {:else}
            <span class="badge badge-success badge-sm badge-soft"
              >Sans Cuisson</span
            >
          {/if}
        </div>

        {#if recipe.materiel && recipe.materiel.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each recipe.materiel as item (item)}
              <span class="badge badge-ghost badge-sm">{item}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Grille principale : Ingrédients + Préparation -->
    <div class=" gap-6 md:flex print:flex">
      <!-- Colonne gauche : Ingrédients -->
      <div class="w-full space-y-4 md:w-1/3 print:w-2/6">
        <RecipeIngredientsList
          ingredients={recipe.ingredients}
          servings={recipePlates}
          defaultServings={recipe.plate}
        />
      </div>

      <!-- Colonne droite : Préparation -->
      <div class="flex-1 space-y-4 print:w-4/6">
        <RecipePreparation
          preparation={recipe.preparation}
          preparation24h={recipe.preparation24h || undefined}
          preparationHtml={recipe.preparationHtml}
          preparation24hHtml={recipe.preparation24hHtml}
          astuces={recipe.astuces || []}
        />
      </div>
    </div>
  </div>
</div>

<style>
  /* Optimisation mobile */
  @media (max-width: 1024px) {
    .card-body {
      padding: 1rem;
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

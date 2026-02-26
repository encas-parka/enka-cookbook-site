<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import { recipesStore } from "$lib/stores/RecipesStore.svelte";
  import type { RecipeForDisplay } from "$lib/types/recipes.types";
  import RecipeCard from "./RecipeCard.svelte";
  import { ArrowBigLeft, Eye, EyeOff, Printer } from "@lucide/svelte";

  interface Props {
    sectionId: string;
    dateKey: string;
    date: Date;
    horaire: string;
    meals: any[];
    config: any;
    currentPrintTarget: string | null;
    recipesDetails: RecipeForDisplay[];
    recipeVisibility: Record<string, boolean>;
    recipeNames: Record<string, string>;
    editingRecipe: string | null;
    onPrintThis: (sectionId: string) => void;
    onToggleRecipe: (recipeKey: string) => void;
    onStartEditRecipe: (recipeKey: string) => void;
    onFinishEditRecipe: () => void;
    onUpdateRecipeName: (recipeKey: string, newName: string) => void;
    getRecipeName: (recipeKey: string, originalName: string) => string;
  }

  let {
    sectionId,
    dateKey,
    date,
    horaire,
    meals,
    config,
    currentPrintTarget,
    recipesDetails,
    recipeVisibility,
    recipeNames,
    editingRecipe,
    onPrintThis,
    onToggleRecipe,
    onStartEditRecipe,
    onFinishEditRecipe,
    onUpdateRecipeName,
    getRecipeName,
  }: Props = $props();

  // Custom ingredients, descriptions and visibilities state
  let recipeIngredients = $state<Record<string, string[]>>({});
  let recipeDescriptions = $state<Record<string, string>>({});
  let descriptionVisibilities = $state<Record<string, boolean>>({});

  function handleUpdateRecipeIngredients(
    recipeKey: string,
    ingredients: string[],
  ) {
    recipeIngredients[recipeKey] = ingredients;
  }

  function handleUpdateRecipeDescription(
    recipeKey: string,
    description: string,
  ) {
    recipeDescriptions[recipeKey] = description;
  }

  function handleToggleRecipeDescription(recipeKey: string) {
    const current = descriptionVisibilities[recipeKey] ?? true;
    descriptionVisibilities[recipeKey] = !current;
  }

  // Format date for display
  let formattedDate = $derived.by(() =>
    date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );

  // Group recipes by category
  let recipesByCategory = $derived.by(() => {
    const groups = new SvelteMap<string, any[]>();

    meals.forEach((meal) => {
      meal.recipes.forEach((recipe: any) => {
        const category = recipe.typeR || "autre";
        if (!groups.has(category)) {
          groups.set(category, []);
        }
        groups.get(category)!.push({
          ...recipe,
          mealId: meal.id,
          guests: meal.guests,
        });
      });
    });

    return groups;
  });

  // Define category order
  let categoryOrder = ["entree", "plat", "dessert"];

  // Sort categories by defined order, then alphabetically
  let sortedCategories = $derived.by(() => {
    const cats = Array.from(recipesByCategory.keys());
    return cats.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  });

  function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      entree: "Entrée",
      plat: "Plat",
      dessert: "Dessert",
      autre: "Autre",
    };
    return labels[category] || category;
  }
  // Font size helpers
  function getBigFontSize(step: number) {
    const sizes = ["1.5rem", "2rem", "2.5rem", "3.2rem"];
    return `font-size: ${sizes[step] || "2.5rem"}`;
  }
  // Font size helpers
  function getLargeFontSize(step: number) {
    const sizes = ["1.3rem", "1.7rem", "2rem", "2.5rem"];
    return `font-size: ${sizes[step] || "2.5rem"}`;
  }

  function getSmallFontSize(step: number) {
    const sizes = ["0.7rem", "0.85rem", "1rem", "1.2rem"];
    return `font-size: ${sizes[step] || "1rem"}`;
  }

  // Logic for page-breaking
  let pages = $derived.by(() => {
    if (!config.catPageBreak) {
      // Single page with all categories
      return [
        {
          categories: sortedCategories,
          isFirst: true,
          isLast: true,
        },
      ];
    }

    // One page per category
    return sortedCategories.map((cat, idx) => ({
      categories: [cat],
      isFirst: idx === 0,
      isLast: idx === sortedCategories.length - 1,
    }));
  });
</script>

<div class="grid grid-cols-[1fr_auto] items-start gap-4 md:p-2">
  <!-- L'affiche A4 (Colonne de gauche, centrée) -->
  <div class="flex flex-col items-end gap-8">
    {#each pages as page, pageIdx}
      <!-- L'affiche A4 -->
      {@const currentPageId =
        pageIdx === 0 ? sectionId : `${sectionId}-page-${pageIdx}`}

      <div
        id={currentPageId}
        class="meal-poster-section relative flex max-w-svw bg-white
        shadow-2xl transition-shadow {currentPrintTarget !== null &&
          currentPrintTarget !== currentPageId &&
          'no-print'}"
      >
        <!-- Print action (no-print) - Added to every page -->
        <div class="group absolute top-4 right-4 print:hidden">
          <button
            class="btn btn-circle opacity-60 transition-opacity hover:opacity-100"
            onclick={() =>
              onPrintThis(
                pageIdx === 0 ? sectionId : `${sectionId}-page-${pageIdx}`,
              )}
            title="Imprimer cette page"
          >
            <Printer class="h-4 w-4" />
          </button>
        </div>

        <div
          class="poster-content text-black"
          class:centered-content={config.centerVertical}
        >
          <!-- Message Top (First page OR every page if dateByPageBreak) -->
          {#if config.messageTop && (page.isFirst || config.dateByPageBreak)}
            <div
              class="mb-8 text-center"
              class:montserrat-font={config.fontTop === "montserrat-font"}
              class:playfair-display={config.fontTop === "playfair-display"}
              class:oswald-font={config.fontTop === "oswald-font"}
              class:quicksand-font={config.fontTop === "quicksand-font"}
              class:dancing-script={config.fontTop === "dancing-script"}
              class:pacifico-regular={config.fontTop === "pacifico-regular"}
              class:caveat-font={config.fontTop === "caveat-font"}
              class:gluten-font={config.fontTop === "gluten-font"}
              class:font-bold={config.boldTop}
              class:italic={config.italicTop}
              style={getLargeFontSize(config.fontSizeTop)}
            >
              {config.messageTop}
            </div>
          {/if}

          <!-- Date and Horaire Header (First page OR every page if dateByPageBreak) -->
          {#if page.isFirst || config.dateByPageBreak}
            <div class="mb-8 text-center">
              {#if config.showDate}
                <p
                  class="m-0 text-center text-3xl"
                  class:montserrat-font={config.fontDate === "montserrat-font"}
                  class:gluten-font={config.fontDate === "gluten-font"}
                  class:pacifico-regular={config.fontDate ===
                    "pacifico-regular"}
                  class:font-bold={config.boldDate}
                  class:italic={config.italicDate}
                  style={getBigFontSize(config.fontSizeDate)}
                >
                  {formattedDate}
                </p>
              {/if}

              {#if config.showHoraire}
                <p
                  class="m-0 text-center text-3xl"
                  class:montserrat-font={config.fontHoraire ===
                    "montserrat-font"}
                  class:playfair-display={config.fontHoraire ===
                    "playfair-display"}
                  class:oswald-font={config.fontHoraire === "oswald-font"}
                  class:quicksand-font={config.fontHoraire === "quicksand-font"}
                  class:dancing-script={config.fontHoraire === "dancing-script"}
                  class:pacifico-regular={config.fontHoraire ===
                    "pacifico-regular"}
                  class:caveat-font={config.fontHoraire === "caveat-font"}
                  class:gluten-font={config.fontHoraire === "gluten-font"}
                  class:font-bold={config.boldHoraire}
                  class:italic={config.italicHoraire}
                  style={getBigFontSize(config.fontSizeHoraire)}
                >
                  {horaire}
                </p>
              {/if}

              {#if config.showHoraire || config.showDate}
                <div
                  class="separator mx-auto my-6 w-48 border-t border-black opacity-20"
                ></div>
              {/if}
            </div>
          {/if}

          <!-- Recipes by Category -->
          {#each page.categories as category (category)}
            <div class="category-block mb-10">
              <!-- Category Header -->
              {#if config.showCategories}
                <h3
                  class="mb-6 text-center text-xl tracking-widest uppercase opacity-60"
                  class:montserrat-font={config.fontCat === "montserrat-font"}
                  class:playfair-display={config.fontCat === "playfair-display"}
                  class:oswald-font={config.fontCat === "oswald-font"}
                  class:quicksand-font={config.fontCat === "quicksand-font"}
                  class:dancing-script={config.fontCat === "dancing-script"}
                  class:pacifico-regular={config.fontCat === "pacifico-regular"}
                  class:caveat-font={config.fontCat === "caveat-font"}
                  class:gluten-font={config.fontCat === "gluten-font"}
                  class:font-bold={config.boldCat}
                  class:italic={config.italicCat}
                  style={getBigFontSize(config.fontSizeCat)}
                >
                  {getCategoryLabel(category)}
                </h3>
              {/if}

              <!-- Recipes in this category -->
              <div class="recipes-grid avoid-break-inside">
                {#each recipesByCategory.get(category) ?? [] as recipe (recipe.recipeUuid)}
                  {@const recipeKey = `${dateKey}${horaire}_${recipe.recipeUuid}`}
                  {@const visible = recipeVisibility[recipeKey] ?? true}
                  {@const name =
                    recipeNames[recipeKey] ||
                    recipesStore.getRecipeIndexByUuid(recipe.recipeUuid)
                      ?.title ||
                    recipe.recipeUuid}
                  {@const recipeData =
                    recipesDetails.find((r) => r.$id === recipe.recipeUuid) ||
                    null}
                  {@const descriptionVisible =
                    descriptionVisibilities[recipeKey] ?? true}

                  {#if visible}
                    <RecipeCard
                      {recipeKey}
                      recipeUuid={recipe.recipeUuid}
                      plates={recipe.plates}
                      typeR={recipe.typeR}
                      {category}
                      {config}
                      {visible}
                      {name}
                      {recipeData}
                      customIngredients={recipeIngredients[recipeKey] || null}
                      customDescription={recipeDescriptions[recipeKey] || null}
                      {descriptionVisible}
                      isEditing={editingRecipe === recipeKey}
                      onToggle={onToggleRecipe}
                      onStartEdit={onStartEditRecipe}
                      onFinishEdit={onFinishEditRecipe}
                      onUpdateName={onUpdateRecipeName}
                      onUpdateIngredients={handleUpdateRecipeIngredients}
                      onUpdateDescription={handleUpdateRecipeDescription}
                      onToggleDescription={handleToggleRecipeDescription}
                    />
                  {/if}
                {/each}
              </div>
            </div>
          {/each}

          <!-- Message Bottom (On Every Page) -->
          <div class="pt-8" class:mt-auto={!config.centerVertical}>
            {#if config.messageBottom}
              <div
                class="text-center opacity-60"
                class:montserrat-font={config.fontBottom === "montserrat-font"}
                class:playfair-display={config.fontBottom ===
                  "playfair-display"}
                class:oswald-font={config.fontBottom === "oswald-font"}
                class:quicksand-font={config.fontBottom === "quicksand-font"}
                class:dancing-script={config.fontBottom === "dancing-script"}
                class:pacifico-regular={config.fontBottom ===
                  "pacifico-regular"}
                class:caveat-font={config.fontBottom === "caveat-font"}
                class:gluten-font={config.fontBottom === "gluten-font"}
                class:font-bold={config.boldBottom}
                class:italic={config.italicBottom}
                style={getLargeFontSize(config.fontSizeBottom)}
              >
                {config.messageBottom}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Boutons de restauration (no-print, Colonne de droite) -->
  <div class="m-auto flex flex-col gap-4 print:hidden">
    {#each sortedCategories as category}
      {#each recipesByCategory.get(category) ?? [] as recipe}
        {@const recipeKey = `${dateKey}${horaire}_${recipe.recipeUuid}`}
        {@const isVisible = recipeVisibility[recipeKey] ?? true}
        {@const isDescVisible = descriptionVisibilities[recipeKey] ?? true}
        {@const recipeName = getRecipeName(
          recipeKey,
          recipesStore.getRecipeIndexByUuid(recipe.recipeUuid)?.title ||
            "Recette",
        )}

        <!-- Recette masquée -->
        {#if !isVisible}
          <button
            class="btn btn-secondary btn-outline flex h-auto max-w-20 flex-col py-3"
            onclick={() => onToggleRecipe(recipeKey)}
            title="Afficher la recette"
          >
            <ArrowBigLeft class="size-5" />
            <span class="">
              {recipeName}
            </span>
          </button>
        {/if}

        <!-- Description masquée -->
        {#if isVisible && !isDescVisible}
          <button
            class="btn btn-secondary btn-outline flex h-auto flex-col py-3"
            onclick={() => handleToggleRecipeDescription(recipeKey)}
            title="Afficher la description"
          >
            <Eye class="size-5" />
            <span>
              <span class="font-bold italic">Desc:</span>
              {recipeName}
            </span>
          </button>
        {/if}
      {/each}
    {/each}
  </div>
</div>

<style>
  .meal-poster-section {
    width: 210mm;
    height: 297mm;
    margin: 2rem auto;
    display: flex;
    flex-direction: column;
    padding: 20mm !important;
    box-sizing: border-box;
  }

  .poster-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .poster-content.centered-content {
    justify-content: center;
  }

  .separator {
    border-top-width: 1px;
    border-top-style: solid;
  }

  .category-block {
    break-inside: avoid;
  }

  @media print {
    @page {
      size: A4;
      margin: 0;
    }

    /* APLATIR LA STRUCTURE : Le grid disparaît, les enfants deviennent frères */
    .grid.grid-cols-\[1fr_auto\] {
      display: contents !important;
    }

    /* La colonne gauche (flex) devient block simple */
    .grid.grid-cols-\[1fr_auto\] > .flex {
      display: block !important;
    }

    /* Supprimer gap-8 et autres espacements */
    .grid.grid-cols-\[1fr_auto\] > .flex {
      gap: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* CACHER la colonne de droite (boutons de restauration) */
    .grid.grid-cols-\[1fr_auto\] > div:last-child {
      display: none !important;
    }

    /* Styles d'impression pour les sections */
    .meal-poster-section {
      box-shadow: none !important;
      border: none !important;
      padding: 20mm !important;
      margin: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
  }
</style>

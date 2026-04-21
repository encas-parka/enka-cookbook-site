<script lang="ts">
  import {
    extractTime,
    formatDateWdDayMonthShort,
    extractDate,
  } from "$lib/utils/date-helpers";

  interface CalendarRecipe {
    recipeUuid: string;
    title: string;
    plates: number;
    mealDate: string;
    typeR: string;
    preparation24h: string | null;
  }

  interface CalendarColumn {
    dateISO: string;
    label: string;
    mealsByMoment: Map<string, CalendarRecipe[]>;
  }

  interface Props {
    columns: CalendarColumn[];
    undatedRecipes: CalendarRecipe[];
    selectedRecipeUuid: string | null;
    selectedMealDate: string | null;
    onFilterRecipe: (uuid: string, mealDate: string) => void;
    onFilterMeal: (mealDate: string) => void;
    onClearFilters: () => void;
  }

  let {
    columns,
    undatedRecipes,
    selectedRecipeUuid,
    selectedMealDate,
    onFilterRecipe,
    onFilterMeal,
    onClearFilters,
  }: Props = $props();

  const moments = [
    { key: "matin", icon: "🌅", label: "Matin" },
    { key: "midi", icon: "☀️", label: "Midi" },
    { key: "soir", icon: "🌙", label: "Soir" },
  ] as const;

  const hasUndated = $derived(undatedRecipes.length > 0);

  // Nombre total de colonnes = dates + (📌 si undated)
  const colCount = $derived(columns.length + (hasUndated ? 1 : 0));

  // Moments ayant au moins une recette dans une colonne
  const activeMoments = $derived(
    moments.filter((m) =>
      columns.some((col) => (col.mealsByMoment.get(m.key) ?? []).length > 0),
    ),
  );

  function getRecipeColor(typeR: string): string {
    if (typeR === "entree") return "bg-lime-100 border-lime-200";
    if (typeR === "plat") return "bg-orange-100 border-orange-200";
    if (typeR === "dessert") return "bg-pink-100 border-pink-200";
    if (typeR === "autre") return "bg-purple-100 border-purple-200";
    return "bg-base-200";
  }

  function handleRecipeClick(recipe: CalendarRecipe) {
    if (selectedRecipeUuid === recipe.recipeUuid) {
      onClearFilters();
    } else {
      onFilterRecipe(recipe.recipeUuid, recipe.mealDate);
    }
  }
</script>

<div class="print:hidden">
  <div
    class="rounded-box border-base-300 bg-base-100 mx-auto w-fit max-w-full overflow-x-auto border shadow-lg"
  >
    <div
      class="grid min-w-fit"
      style="grid-template-columns: repeat({colCount}, minmax(120px, 240px));"
    >
      <!-- ═══ En-tête : dates (pas de coin vide sur mobile) ═══ -->
      {#each columns as col, i (col.dateISO)}
        <div
          class="bg-secondary/10 border-base-300 sticky top-0 z-10 border-r border-b px-2 py-2 text-center text-xs font-semibold sm:text-sm {selectedMealDate &&
          extractDate(selectedMealDate) === col.dateISO &&
          !selectedRecipeUuid
            ? 'bg-primary text-primary-content'
            : ''}"
        >
          <button
            class="hover:underline"
            onclick={() => {
              if (
                selectedMealDate &&
                extractDate(selectedMealDate) === col.dateISO &&
                !selectedRecipeUuid
              ) {
                onClearFilters();
              } else {
                onFilterMeal(col.dateISO);
              }
            }}
          >
            {col.label}
          </button>
        </div>
      {/each}

      {#if hasUndated}
        <div
          class="bg-base-200 border-base-300 sticky top-0 z-10 border-b px-2 py-2 text-center text-xs font-semibold sm:text-sm {selectedMealDate ===
            'undated' && !selectedRecipeUuid
            ? 'bg-warning text-warning-content'
            : ''}"
        >
          <button
            class="hover:underline"
            onclick={() => {
              if (selectedMealDate === "undated" && !selectedRecipeUuid) {
                onClearFilters();
              } else {
                onFilterMeal("undated");
              }
            }}
          >
            📌
          </button>
        </div>
      {/if}

      <!-- ═══ Lignes : uniquement les moments ayant des recettes ═══ -->
      {#each activeMoments as moment, mIdx (moment.key)}
        <!-- Cellules recettes par date -->
        {#each columns as col (col.dateISO)}
          {@const recipes = col.mealsByMoment.get(moment.key) ?? []}
          <div
            class="border-base-300 border-r border-b px-1 py-1.5 align-top sm:px-2"
          >
            {#each recipes as recipe (recipe.recipeUuid)}
              {@const bgColor = getRecipeColor(recipe.typeR)}
              <div class="indicator w-full">
                {#if recipe.preparation24h}
                  <span class="indicator-item status status-md status-warning badge-xs"></span>
                {/if}
                <button
                  class="mb-1 flex w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-xs leading-tight transition-colors hover:cursor-pointer sm:text-sm {selectedRecipeUuid ===
                  recipe.recipeUuid
                    ? 'bg-accent text-accent-content border-accent font-semibold'
                    : `${bgColor} text-base-content hover:brightness-95`}"
                  onclick={() => handleRecipeClick(recipe)}
                  title="{recipe.title} ({recipe.plates} couverts)"
                >
                  <span class="line-clamp-2">{recipe.title}</span>
                  <span class="shrink-0 text-[10px] opacity-60 sm:text-xs"
                    >({recipe.plates})</span
                  >
                </button>
              </div>
            {/each}
          </div>
        {/each}

        <!-- Cellule undated (rowspan dynamique) -->
        {#if hasUndated}
          {@const isRow0 = mIdx === 0}
          <div
            class="border-base-300 border-b px-1 py-1.5 align-top sm:px-2 {isRow0
              ? 'border-r'
              : ''}"
            style={isRow0 ? "grid-row: span {activeMoments.length}" : ""}
          >
            {#if isRow0}
              {#each undatedRecipes as recipe (recipe.recipeUuid)}
                {@const bgColor = getRecipeColor(recipe.typeR)}
                <div class="indicator w-full">
                  {#if recipe.preparation24h}
                    <span class="indicator-item status status-md status-warning badge-xs"></span>
                  {/if}
                  <button
                    class="mb-1 flex w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-xs leading-tight transition-colors sm:text-sm {selectedRecipeUuid ===
                    recipe.recipeUuid
                      ? 'bg-accent text-accent-content border-accent font-semibold'
                      : `${bgColor} text-base-content hover:brightness-95`}"
                    onclick={() => handleRecipeClick(recipe)}
                    title="{recipe.title} ({recipe.plates} couverts)"
                  >
                    <span class="line-clamp-2">{recipe.title}</span>
                    <span class="shrink-0 text-[10px] opacity-60 sm:text-xs"
                      >({recipe.plates})</span
                    >
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>

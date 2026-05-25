<script lang="ts">
  import { Sun, Moon, Cloud, Utensils } from "@lucide/svelte";
  import type { RecipeOccurrence } from "$lib/types/store.types";
  import { calculateDateDisplayInfo } from "$lib/utils/dateRange";
  import { formatSingleQuantity } from "$lib/utils/QuantityFormatter";

  interface Props {
    recipesByDate: Map<string, RecipeOccurrence[]>;
    concernedDates: string[];
  }

  let { recipesByDate, concernedDates }: Props = $props();

  /** Flatten recipe occurrences into a single list with their associated date */
  const recipeLines = $derived.by(() => {
    const lines: { recipe: RecipeOccurrence; date: string }[] = [];
    for (const date of concernedDates) {
      const recipes = recipesByDate.get(date) || [];
      for (const recipe of recipes) {
        lines.push({ recipe, date });
      }
    }
    return lines;
  });
</script>

{#if recipeLines.length > 0}
  <div
    class="bg-neutral/5 grid grid-cols-1 gap-x-6 gap-y-0.5 rounded-lg p-2 text-xs lg:grid-cols-2"
  >
    {#each recipeLines as { recipe, date }, i (`${recipe.id ?? recipe.r}-${date}-${i}`)}
      {@const dateInfo = calculateDateDisplayInfo(date)}
      {@const DateIcon =
        dateInfo.timeIcon === "sun"
          ? Sun
          : dateInfo.timeIcon === "moon"
            ? Moon
            : dateInfo.timeIcon === "cloud"
              ? Cloud
              : null}
      <div
        class="text-base-content/60 border-neutral/10 flex min-w-0 items-center gap-2 border px-1 py-0.5"
      >
        <span class="truncate font-medium">{recipe.r}</span>
        <span class="flex shrink-0 items-center gap-0.5 whitespace-nowrap">
          {dateInfo.formattedDate}
          {#if DateIcon}
            <DateIcon size={11} class="stroke-2" />
          {/if}
        </span>
        <span class="flex shrink-0 items-center gap-0.5 whitespace-nowrap">
          {recipe.a}<Utensils size={10} />
        </span>
        <span class="shrink-0 font-medium whitespace-nowrap">
          {formatSingleQuantity(recipe.qEq, recipe.uEq)}
        </span>
      </div>
    {/each}
  </div>
{/if}

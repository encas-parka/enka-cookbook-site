<script lang="ts">
  import { Sun, Moon, Cloud } from "@lucide/svelte";
  import type {
    RecipeOccurrence,
    DateDisplayInfo,
  } from "$lib/types/store.types";

  interface Props {
    dateDisplayInfo: DateDisplayInfo;
    recipes?: RecipeOccurrence[];
  }

  let { dateDisplayInfo, recipes = [] }: Props = $props();

  const tooltipText = $derived(
    recipes.length > 3
      ? recipes
          .slice(0, 3)
          .map((r) => r.r)
          .join(", ") + `… (+${recipes.length - 3})`
      : recipes.map((r) => r.r).join(", "),
  );

  const IconComponent = $derived(
    dateDisplayInfo.timeIcon === "sun"
      ? Sun
      : dateDisplayInfo.timeIcon === "moon"
        ? Moon
        : dateDisplayInfo.timeIcon === "cloud"
          ? Cloud
          : null,
  );
</script>

<div class="tooltip" data-tip={tooltipText}>
  <div
    class="badge badge-soft badge-sm hover:badge-primary flex items-center gap-1"
  >
    <span class="whitespace-nowrap">{dateDisplayInfo.formattedDate}</span>

    {#if IconComponent}
      <IconComponent class="h-3 w-3 stroke-3" />
    {/if}
  </div>
</div>

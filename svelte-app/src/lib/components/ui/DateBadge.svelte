<script lang="ts">
  import type {
    RecipeOccurrence,
    DateDisplayInfo,
  } from "$lib/types/store.types";
  import { getTimeIconComponent } from "$lib/utils/time-icon";

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
    getTimeIconComponent(dateDisplayInfo.timeIcon),
  );
</script>

<div class="tooltip" data-tip={tooltipText}>
  <div
    class="badge badge-soft hover:badge-primary sm:badge-sm flex items-center gap-1"
  >
    <span class="whitespace-nowrap">{dateDisplayInfo.formattedDate}</span>

    {#if IconComponent}
      <IconComponent class="h-3 w-3 stroke-3" />
    {/if}
  </div>
</div>

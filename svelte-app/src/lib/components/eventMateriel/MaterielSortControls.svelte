<script lang="ts">
  import { ArrowDownNarrowWide } from "@lucide/svelte";
  import type { EventMaterielSortField, EventMaterielSort } from "$lib/types/event-materiel.types";

  interface Props {
    sort: EventMaterielSort;
    onSortChange: (sort: EventMaterielSort) => void;
  }

  const { sort, onSortChange }: Props = $props();

  type SortOption = { field: EventMaterielSortField; label: string };

  const sortOptions: SortOption[] = [
    { field: "type", label: "Type" },
    { field: "name", label: "Alphabétique" },
    { field: "where", label: "Lieu" },
  ];

  function handleClick(field: EventMaterielSortField) {
    onSortChange({ field, direction: "asc" });
  }

  function getButtonClasses(field: EventMaterielSortField): string {
    const base = "btn btn-sm btn-primary btn-outline gap-2";
    return sort.field === field ? `${base} btn-active` : base;
  }
</script>

<div class="bg-base-300 rounded-box flex items-center gap-4 px-4 py-3">
  <fieldset class="fieldset">
    <legend class="legend label">
      <ArrowDownNarrowWide class="inline size-4" /> Trier par :
    </legend>
    <div class="flex flex-wrap items-center gap-2">
      {#each sortOptions as option (option.field)}
        <button
          class={getButtonClasses(option.field)}
          onclick={() => handleClick(option.field)}
          aria-label="Trier par {option.label}"
        >
          {option.label}
        </button>
      {/each}
    </div>
  </fieldset>
</div>

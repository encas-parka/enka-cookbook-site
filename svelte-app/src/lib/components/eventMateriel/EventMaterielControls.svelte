<script lang="ts">
  import type {
    EventMaterielSort,
    EventMaterielSortField,
  } from "$lib/types/event-materiel.types";
  import {
    ArrowDownNarrowWide,
    ArrowDownAZ,
    X,
  } from "@lucide/svelte";

  export interface ActiveBadge {
    id: string;
    label: string;
    color: string;
  }

  export type CollapseState = "expanded" | "collapsed" | "indeterminate";

  interface Props {
    sort: EventMaterielSort;
    onSortChange: (sort: EventMaterielSort) => void;
    hasActiveFilters: boolean;
    activeBadges: ActiveBadge[];
    onRemoveBadge: (id: string) => void;
    onResetFilters: () => void;
  }

  let {
    sort,
    onSortChange,
    hasActiveFilters,
    activeBadges,
    onRemoveBadge,
    onResetFilters,
  }: Props = $props();

  type SortOption = {
    field: EventMaterielSortField;
    label: string;
    icon?: string;
  };

  const sortOptions: SortOption[] = [
    { field: "type", label: "Type" },
    { field: "name", label: "Abc", icon: "ArrowDownAZ" },
    { field: "where", label: "Lieu" },
  ];

  function handleSortClick(field: EventMaterielSortField) {
    onSortChange({ field, direction: "asc" });
  }

  function getSortButtonClasses(field: EventMaterielSortField): string {
    const base = "btn btn-sm btn-primary btn-outline gap-2";
    return sort.field === field ? `${base} btn-active` : base;
  }
</script>

<div class="space-y-2">
  <div
    class="bg-base-300 rounded-box flex flex-wrap items-center justify-between gap-3 px-4 py-3"
  >
    <fieldset class="fieldset">
      <legend class="legend label">
        <ArrowDownNarrowWide class="inline size-4" /> Trier par :
      </legend>
      <div class="flex flex-wrap items-center gap-2">
        {#each sortOptions as option (option.field)}
          <button
            class={getSortButtonClasses(option.field)}
            onclick={() => handleSortClick(option.field)}
            aria-label="Trier par {option.label}"
          >
            {#if option.icon}<ArrowDownAZ class="inline size-4" />{/if}
            {option.label}
          </button>
        {/each}
      </div>
    </fieldset>
  </div>

  {#if activeBadges.length > 0}
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-base-content/50 text-sm">Filtres :</span>
      {#each activeBadges as badge (badge.id)}
        <button
          type="button"
          class="badge {badge.color} cursor-pointer gap-1 hover:opacity-80"
          onclick={() => onRemoveBadge(badge.id)}
          title="Retirer ce filtre"
        >
          {badge.label}
          <X class="h-3 w-3" />
        </button>
      {/each}
      {#if activeBadges.length > 1}
        <button
          class="btn btn-ghost btn-xs text-error"
          onclick={onResetFilters}
        >
          Réinitialiser
        </button>
      {/if}
    </div>
  {/if}
</div>

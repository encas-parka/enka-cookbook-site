<script lang="ts">
  import {
    ArrowDownNarrowWide,
    LayoutGrid,
    LayoutList,
    ChevronsDown,
    ChevronsUp,
    Minus,
    X,
  } from "@lucide/svelte";
  import type {
    EventMaterielSortField,
    EventMaterielSort,
  } from "$lib/types/event-materiel.types";

  export interface ActiveBadge {
    id: string;
    label: string;
    color: string;
  }

  export type CollapseState = "expanded" | "collapsed" | "indeterminate";

  interface Props {
    sort: EventMaterielSort;
    onSortChange: (sort: EventMaterielSort) => void;
    displayMode: "nested" | "flat";
    onDisplayModeChange: (mode: "nested" | "flat") => void;
    hasActiveFilters: boolean;
    activeBadges: ActiveBadge[];
    onRemoveBadge: (id: string) => void;
    onResetFilters: () => void;
    collapseState?: CollapseState;
    onCollapseChange?: (state: CollapseState) => void;
  }

  let {
    sort,
    onSortChange,
    displayMode,
    onDisplayModeChange,
    hasActiveFilters,
    activeBadges,
    onRemoveBadge,
    onResetFilters,
    collapseState = "expanded",
    onCollapseChange,
  }: Props = $props();

  type SortOption = { field: EventMaterielSortField; label: string };

  const sortOptions: SortOption[] = [
    { field: "type", label: "Type" },
    { field: "name", label: "Alphabétique" },
    { field: "where", label: "Lieu" },
  ];

  function handleSortClick(field: EventMaterielSortField) {
    onSortChange({ field, direction: "asc" });
  }

  function getSortButtonClasses(field: EventMaterielSortField): string {
    const base = "btn btn-sm btn-primary btn-outline gap-2";
    return sort.field === field ? `${base} btn-active` : base;
  }

  function toggleCollapse() {
    if (collapseState === "collapsed") {
      onCollapseChange?.("expanded");
    } else {
      onCollapseChange?.("collapsed");
    }
  }
</script>

<div class="space-y-2">
  <div
    class="bg-base-300 rounded-box flex flex-wrap items-center gap-3 px-4 py-3"
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
            {option.label}
          </button>
        {/each}
      </div>
    </fieldset>

    <div
      class="divider divider-horizontal mx-0 hidden h-6 w-px bg-base-content/10 sm:flex"
    ></div>

    <div class="flex items-center gap-2">
      <div class="flex rounded-btn bg-base-200 p-1">
        <button
          class="btn btn-xs gap-1 {displayMode === 'nested'
            ? 'btn-primary'
            : 'btn-ghost'}"
          onclick={() => onDisplayModeChange("nested")}
          title="Vue groupée"
          disabled={hasActiveFilters}
        >
          <LayoutGrid class="size-4" />
          <span class="hidden sm:inline">Groupé</span>
        </button>
        <button
          class="btn btn-xs gap-1 {displayMode === 'flat'
            ? 'btn-primary'
            : 'btn-ghost'}"
          onclick={() => onDisplayModeChange("flat")}
          title="Vue liste"
        >
          <LayoutList class="size-4" />
          <span class="hidden sm:inline">Liste</span>
        </button>
      </div>

      {#if displayMode === "nested" && !hasActiveFilters}
        <button
          class="btn btn-ghost btn-xs gap-1"
          onclick={toggleCollapse}
          title={collapseState === "collapsed"
            ? "Tout déplier"
            : "Tout plier"}
        >
          {#if collapseState === "collapsed"}
            <ChevronsDown class="size-4" />
          {:else if collapseState === "expanded"}
            <ChevronsUp class="size-4" />
          {:else}
            <Minus class="size-4" />
          {/if}
          <span class="hidden sm:inline">
            {collapseState === "collapsed" ? "Déplier" : "Plier"}
          </span>
        </button>
      {/if}
    </div>
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
        <button class="btn btn-ghost btn-xs text-error" onclick={onResetFilters}>
          Réinitialiser
        </button>
      {/if}
    </div>
  {/if}
</div>

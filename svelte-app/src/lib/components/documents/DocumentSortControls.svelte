<script lang="ts">
  import { ArrowDownNarrowWide, ArrowUp, ArrowDown, X } from "@lucide/svelte";

  type SortBy = "title" | "$createdAt" | "$updatedAt";

  interface Props {
    sortBy: SortBy;
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: SortBy, sortOrder: "asc" | "desc") => void;
    availableTags?: string[];
    selectedTags?: string[];
    onTagToggle?: (tag: string) => void;
    disabled?: boolean;
  }

  let {
    sortBy,
    sortOrder,
    onSortChange,
    availableTags = [],
    selectedTags = [],
    onTagToggle,
    disabled = false,
  }: Props = $props();

  // Définit l'ordre pour chaque critère
  const getSortOrder = (field: SortBy): "asc" | "desc" | "inactive" => {
    if (sortBy !== field) return "inactive";
    return sortOrder;
  };

  // Gère le clic sur un bouton de tri
  const handleSortClick = (field: SortBy) => {
    if (field === "title") {
      // Titre: toggle entre asc et desc
      onSortChange(
        "title",
        sortBy === "title" && sortOrder === "asc" ? "desc" : "asc",
      );
    } else {
      // Dates: inactive -> desc -> asc -> inactive
      if (sortBy !== field) {
        onSortChange(field, "desc");
      } else if (sortOrder === "desc") {
        onSortChange(field, "asc");
      } else {
        onSortChange("title", "asc"); // Retour au titre
      }
    }
  };

  // Classes pour les différents états
  const getButtonSortClasses = (field: SortBy) => {
    const order = getSortOrder(field);
    const baseClasses = "btn btn-sm btn-primary btn-outline gap-2";

    if (order === "inactive") {
      return `${baseClasses}`;
    } else if (order === "asc") {
      return `${baseClasses} btn-active`;
    } else {
      return `${baseClasses} btn-active`;
    }
  };

  const getSortIcon = (field: SortBy) => {
    const order = getSortOrder(field);
    if (order === "inactive") return null;
    if (order === "asc") return ArrowUp;
    return ArrowDown;
  };
</script>

<div
  class="bg-base-300 rounded-box flex flex-wrap items-center justify-between gap-6 px-6 py-6"
>
  <fieldset class="fieldset w-full sm:flex-1">
    <legend class="legend label"
      ><ArrowDownNarrowWide class="inline size-4" /> Trier par :</legend
    >

    <div class="flex flex-wrap gap-2">
      <button
        class={getButtonSortClasses("title")}
        onclick={() => handleSortClick("title")}
        aria-label="Trier par noms"
      >
        Nom
      </button>

      <button
        class={getButtonSortClasses("$createdAt")}
        onclick={() => handleSortClick("$createdAt")}
        aria-label="Trier par date de création"
      >
        {#if getSortIcon("$createdAt")}
          {@const Icon = getSortIcon("$createdAt")}
          <Icon size={16} />
        {/if}
        Date de création
      </button>

      <button
        class={getButtonSortClasses("$updatedAt")}
        onclick={() => handleSortClick("$updatedAt")}
        aria-label="Trier par date de modification"
      >
        {#if getSortIcon("$updatedAt")}
          {@const Icon = getSortIcon("$updatedAt")}
          <Icon size={16} />
        {/if}
        Date de modification
      </button>
    </div>
  </fieldset>

  <!-- Filtres par tags (si disponibles) -->
  {#if availableTags.length > 0}
    <fieldset class="fieldset w-full sm:flex-1">
      <legend class="legend label flex items-center justify-between">
        <span>Filtrer par tags :</span>
        {#if selectedTags.length > 0}
          <button
            class="btn btn-ghost btn-xs"
            onclick={() => {
              selectedTags.forEach((tag) => onTagToggle?.(tag));
            }}
            {disabled}
          >
            <X class="size-3" />
            Tout effacer
          </button>
        {/if}
      </legend>

      <div class="flex flex-wrap gap-2">
        {#each availableTags as tag}
          <button
            class="badge {selectedTags.includes(tag)
              ? 'badge-primary cursor-pointer'
              : 'badge-outline hover:badge-primary cursor-pointer'} gap-1 py-3"
            onclick={() => onTagToggle?.(tag)}
            {disabled}
          >
            {tag}
            {#if selectedTags.includes(tag)}
              <X class="size-3" />
            {/if}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}
</div>

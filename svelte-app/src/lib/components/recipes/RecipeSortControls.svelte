<script lang="ts">
  import {
    ArrowDownNarrowWide,
    ArrowUp,
    ArrowDown,
    Filter,
    Funnel,
  } from "@lucide/svelte";
  import { navigate } from '$lib/router';
  import { globalState } from "$lib/stores/GlobalState.svelte";

  type SortBy = "title" | "$createdAt" | "$updatedAt";

  interface Props {
    sortBy: SortBy;
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: SortBy, sortOrder: "asc" | "desc") => void;
    scope: "all" | "mine" | "drafts";
  }

  const { sortBy, sortOrder, onSortChange, scope }: Props = $props();

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

  // Classes pour les boutons de filtre de scope
  const getScopeButtonClasses = (scopeValue: "all" | "mine" | "drafts") => {
    const baseClasses = "btn btn-sm btn-secondary";
    return scope === scopeValue
      ? `${baseClasses}`
      : `${baseClasses} btn-outline`;
  };
</script>

<div
  class="bg-base-300 rounded-box flex flex-wrap items-center justify-between gap-6 px-6 py-6"
>
  <fieldset class="fieldset">
    <legend class="legend label"
      ><ArrowDownNarrowWide class="inline size-4" /> Trier par :</legend
    >

    <div class="btn-group">
      <button
        class={getButtonSortClasses("title")}
        onclick={() => handleSortClick("title")}
        aria-label="Trier par titre"
      >
        Titre
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

  <!-- Boutons de filtre de scope en haut à droite -->
  {#if globalState.isAuthenticated}
    <fieldset class="fieldset">
      <legend class="legend label"
        ><Funnel class="inline h-4 w-4" /> Filtrer :</legend
      >
      <div class="btn-group">
        <button
          class={getScopeButtonClasses("all")}
          onclick={() => navigate("/recipe")}
        >
          Tout
        </button>
        <button
          class={getScopeButtonClasses("mine")}
          onclick={() => navigate("/recipe/my")}
        >
          Mes recettes
        </button>
        <button
          class={getScopeButtonClasses("drafts")}
          onclick={() => navigate("/recipe/my/draft")}
        >
          Mes brouillons
        </button>
      </div>
    </fieldset>
  {/if}
</div>

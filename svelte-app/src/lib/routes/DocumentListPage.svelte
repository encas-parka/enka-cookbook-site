<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { navigate } from "$lib/router";
  import { PlusIcon } from "@lucide/svelte";
  import DocCard from "$lib/components/documents/DocCard.svelte";
  import DocumentSearchBar from "$lib/components/documents/DocumentSearchBar.svelte";
  import DocumentSortControls from "$lib/components/documents/DocumentSortControls.svelte";
  import ActiveFiltersDisplay from "$lib/components/documents/ActiveFiltersDisplay.svelte";
  import type { EnrichedTeamdoc } from "$lib/stores/TeamdocsStore.svelte";

  // ============================================================================
  // PROPS & ROUTE
  // ============================================================================

  import { route } from "$lib/router";

  let teamId = $derived(route.params.teamId);

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================

  // État des filtres
  interface Filters {
    tags: string[];
  }

  let searchQuery = $state("");
  let filters = $state<Filters>({
    tags: [],
  });

  // Tri
  type SortBy = "title" | "$createdAt" | "$updatedAt";
  let sortBy = $state<SortBy>("$updatedAt");
  let sortOrder = $state<"asc" | "desc">("desc");

  // Pagination
  let pageSize = $state(20);
  let currentPage = $state(1);
  let sentinel = $state<HTMLElement | undefined>();

  // Équipe
  let team = $derived.by(() => {
    return nativeTeamsStore.myTeams.find((t) => t.$id === teamId);
  });

  // Récupérer tous les documents de l'équipe depuis le store
  const allDocs = $derived.by(() => {
    if (!teamdocsStore.isInitialized) {
      return [];
    }
    return teamdocsStore.getTeamDocuments(teamId);
  });

  // Extraire les valeurs uniques pour les filtres
  const availableTags = $derived.by(() => {
    return teamdocsStore.getTeamTags(teamId);
  });

  // Logique de filtrage
  const filteredDocs = $derived.by(() => {
    // Si recherche active (>= 2 chars), ignorer les autres filtres
    if (searchQuery.length >= 2) {
      const normalized = searchQuery
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

      return allDocs.filter((doc) => {
        const titleMatch = doc.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .includes(normalized);

        const contentMatch = doc.content
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .includes(normalized);

        return titleMatch || contentMatch;
      });
    }

    // Sinon, appliquer les filtres
    return allDocs.filter((doc) => {
      // Tags (OU logique)
      const tagMatch =
        !filters.tags.length || filters.tags.some((t) => doc.tags?.includes(t));

      return tagMatch;
    });
  });

  // Tri des documents filtrés
  const sortedDocs = $derived.by(() => {
    const docs = [...filteredDocs];
    return docs.sort((a, b) => {
      if (sortBy === "title") {
        return sortOrder === "asc"
          ? a.title.localeCompare(b.title, "fr")
          : b.title.localeCompare(a.title, "fr");
      } else if (sortBy === "$createdAt") {
        const diff =
          new Date(b.$createdAt || 0).getTime() -
          new Date(a.$createdAt || 0).getTime();
        return sortOrder === "asc" ? -diff : diff;
      } else {
        const diff =
          new Date(b.$updatedAt || 0).getTime() -
          new Date(a.$updatedAt || 0).getTime();
        return sortOrder === "asc" ? -diff : diff;
      }
    });
  });

  // Pagination
  const paginatedDocs = $derived(sortedDocs.slice(0, currentPage * pageSize));

  // Désactiver les filtres si recherche active
  const filtersDisabled = $derived(searchQuery.length >= 2);

  // Reset fonctions
  function resetSearch() {
    searchQuery = "";
  }

  function resetFilters() {
    filters = {
      tags: [],
    };
  }

  function toggleTag(tag: string) {
    if (filters.tags.includes(tag)) {
      filters.tags = filters.tags.filter((t) => t !== tag);
    } else {
      filters.tags = [...filters.tags, tag];
    }
  }

  // Lazy loading avec Intersection Observer
  $effect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          paginatedDocs.length < filteredDocs.length
        ) {
          currentPage++;
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Reset pagination quand les filtres changent
  $effect(() => {
    // Dépendances : filteredDocs, sortBy, sortOrder
    filteredDocs;
    sortBy;
    sortOrder;
    currentPage = 1;
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    if (team) {
      navBarStore.setConfig({
        title: `Documents - ${team.name}`,
        actions: navActions,
      });
    }
  });

  onDestroy(() => {
    navBarStore.reset();
  });

  onMount(async () => {
    // Note: teamdocsStore est déjà initialisé via App.svelte
    // Mais on s'assure qu'il est bien chargé
    if (!teamdocsStore.isInitialized) {
      await teamdocsStore.initialize();
    }

    // Vérifier que l'équipe existe
    if (!team) {
      navigate("/dashboard/teams");
    }
  });
</script>

{#snippet navActions()}
  <button
    class="btn btn-primary btn-sm"
    onclick={() => navigate(`/createdocument/${teamId}/new`)}
  >
    <PlusIcon size={18} />
    Créer un document
  </button>
{/snippet}

<!-- Contenu principal -->
<div class="p-4" transition:fade>
  <div class="mx-auto max-w-4xl">
    <div class="mb-10 space-y-6">
      <!-- Barre de recherche -->
      <div class="mb-4">
        <DocumentSearchBar
          bind:searchQuery
          onReset={resetSearch}
          placeholder="Rechercher dans les documents..."
        />
      </div>

      <!-- Résumé des filtres actifs -->
      <!-- <div class="mb-6">
        <ActiveFiltersDisplay
          {searchQuery}
          {filters}
          resultCount={filteredDocs.length}
          onResetFilters={resetFilters}
        />
      </div> -->

      <!-- Boutons de tri et filtres -->
      <DocumentSortControls
        {sortBy}
        {sortOrder}
        {availableTags}
        selectedTags={filters.tags}
        onTagToggle={toggleTag}
        disabled={filtersDisabled}
        onSortChange={(s, o) => {
          sortBy = s;
          sortOrder = o;
        }}
      />
    </div>

    <!-- Liste des documents -->
    {#if teamdocsStore.error}
      <div class="alert alert-error">
        <span>Erreur : {teamdocsStore.error}</span>
      </div>
    {:else}
      <div class="my-8 space-y-3">
        {#each paginatedDocs as doc (doc.$id)}
          <DocCard
            {doc}
            {teamId}
            highlightedTags={filters.tags}
            bgClass="bg-base-100"
          />
        {/each}
      </div>

      <!-- Sentinelle pour lazy loading -->
      {#if paginatedDocs.length < filteredDocs.length}
        <div bind:this={sentinel} class="py-8 text-center">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}

      <!-- Message si aucun résultat -->
      {#if filteredDocs.length === 0}
        <div class="py-12 text-center">
          <p class="text-base-content/60 text-lg">
            Aucun document ne correspond aux critères...
          </p>
        </div>
      {/if}

      <!-- Message si aucun document dans l'équipe -->
      {#if allDocs.length === 0 && !teamdocsStore.loading}
        <div class="py-12 text-center">
          <p class="text-base-content/60 mb-4 text-lg">
            Aucun document dans cette équipe
          </p>
          <button
            class="btn btn-primary"
            onclick={() => navigate(`/createdocument/${teamId}/new`)}
          >
            <PlusIcon size={18} />
            Créer le premier document
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

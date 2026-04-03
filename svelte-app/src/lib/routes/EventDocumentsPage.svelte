<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { teamdocsStore } from "$lib/stores/TeamdocsStore.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { navigate } from "$lib/router";
  import { PlusIcon } from "@lucide/svelte";
  import DocCard from "$lib/components/documents/DocCard.svelte";
  import DocumentSearchBar from "$lib/components/documents/DocumentSearchBar.svelte";
  import EventTabs from "$lib/components/eventEdit/EventTabs.svelte";

  import { route } from "$lib/router";

  let eventId = $derived(route.params.id || "");

  // État local
  let searchQuery = $state("");
  let pageSize = 20;
  let currentPage = $state(1);
  let sentinel = $state<HTMLElement | undefined>();

  // Événement courant
  const currentEvent = $derived(eventsStore.getEventById(eventId));
  const canEdit = $derived(
    currentEvent
      ? eventsStore.canUserEditEvent(eventId, globalState.userId || "")
      : false,
  );

  // Documents de l'événement
  const allDocs = $derived(
    teamdocsStore.isInitialized ? teamdocsStore.getEventDocuments(eventId) : [],
  );

  // Filtrage par recherche
  const filteredDocs = $derived.by(() => {
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
    return allDocs;
  });

  // Tri par date de modification (plus récent d'abord)
  const sortedDocs = $derived(
    [...filteredDocs].sort(
      (a, b) =>
        new Date(b.$updatedAt || 0).getTime() -
        new Date(a.$updatedAt || 0).getTime(),
    ),
  );

  const paginatedDocs = $derived(sortedDocs.slice(0, currentPage * pageSize));

  // Lazy loading
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

  // Reset pagination
  $effect(() => {
    filteredDocs;
    currentPage = 1;
  });

  // Navbar
  $effect(() => {
    navBarStore.setConfig({
      title: `Documents - ${currentEvent?.name || "Événement"}`,
      actions: navActions,
    });
  });

  onMount(async () => {
    if (!teamdocsStore.isInitialized) {
      await teamdocsStore.initialize();
    }
  });
</script>

{#snippet navActions()}
  {#if canEdit}
    <button
      class="btn btn-primary btn-sm"
      onclick={() => navigate(`/event/${eventId}/document/new`)}
    >
      <PlusIcon size={18} />
      Créer un document
    </button>
  {/if}
{/snippet}

<div class="bg-base-200 min-h-lvh px-2 pt-4 pb-20 md:px-20" transition:fade>
  <div class="mx-auto mt-6 max-w-4xl">
    <div class="mb-6">
      <DocumentSearchBar
        bind:searchQuery
        onReset={() => (searchQuery = "")}
        placeholder="Rechercher dans les documents..."
      />
    </div>

    {#if teamdocsStore.error}
      <div class="alert alert-error">
        <span>Erreur : {teamdocsStore.error}</span>
      </div>
    {:else}
      <div class="my-4 space-y-3">
        {#each paginatedDocs as doc (doc.$id)}
          <DocCard {doc} {eventId} bgClass="bg-base-100" />
        {/each}
      </div>

      {#if paginatedDocs.length < filteredDocs.length}
        <div bind:this={sentinel} class="py-8 text-center">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}

      {#if filteredDocs.length === 0 && !teamdocsStore.loading}
        <div class="py-12 text-center">
          <p class="text-base-content/60 text-lg">
            {searchQuery.length >= 2
              ? "Aucun document ne correspond à la recherche"
              : "Aucun document pour cet événement"}
          </p>
          {#if canEdit && searchQuery.length < 2}
            <button
              class="btn btn-primary mt-4"
              onclick={() => navigate(`/event/${eventId}/document/new`)}
            >
              <PlusIcon size={18} />
              Créer le premier document
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

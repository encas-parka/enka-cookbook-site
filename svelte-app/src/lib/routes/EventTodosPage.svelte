<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { SvelteSet } from "svelte/reactivity";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { route } from "$lib/router";
  import { getContributors } from "$lib/utils/event-stats-helpers";
  import EventTodoList from "$lib/components/eventTodo/EventTodoList.svelte";
  import EventDocumentsBloc from "$lib/components/documents/EventDocumentsBloc.svelte";
  import { ListTodo } from "@lucide/svelte";
  import { online } from "svelte/reactivity/window";

  // Event data
  let eventId = $derived(route.params.id);
  const currentEvent = $derived(
    eventId ? eventsStore.getEventById(eventId) : null,
  );

  // Contributors derived from currentEvent
  const contributors = $derived(getContributors(currentEvent));

  // Permissions
  const canEdit = $derived(
    online.current &&
      eventsStore.canUserEditEvent(eventId || "", globalState.userId || "") &&
      currentEvent?.status !== "canceled",
  );

  // Unique taskOn types in event todos
  const uniqueTaskOnTypes = $derived.by(() => {
    if (!currentEvent?.todos) return [];
    const types = new SvelteSet<string>();
    currentEvent.todos.forEach((todo: any) => {
      if (todo.taskOn) types.add(todo.taskOn);
    });
    return Array.from(types);
  });

  // Max-width based on number of types
  const maxWidthClass = $derived(
    uniqueTaskOnTypes.length >= 3
      ? "max-w-5xl"
      : uniqueTaskOnTypes.length >= 2
        ? "max-w-4xl"
        : "max-w-3xl",
  );

  // Navbar configuration
  $effect(() => {
    if (currentEvent) {
      navBarStore.setConfig({
        title: `Tâches : ${currentEvent.name}`,
        actions: navActions,
      });
    }
  });

  // Handle todos change from EventTodoList
  async function handleTodosChange(todos: any[]) {
    if (!eventId || !currentEvent) return;

    try {
      await eventsStore.updateEvent(eventId, { todos });
      toastService.success("Tâches mises à jour");
    } catch (error) {
      console.error("[EventTodosPage] Erreur sauvegarde des tâches:", error);
      toastService.error("Erreur lors de la sauvegarde des tâches");
    }
  }

  onMount(() => {
    // Le guard a déjà initialisé le store, l'event devrait être disponible
  });
</script>

{#snippet navActions()}
  <!-- Pas d'actions spécifiques pour cette page -->
{/snippet}

<div class="bg-base-200 min-h-lvh px-4 pt-4 pb-20 md:px-20" transition:fade>
  <!-- Header -->

  <!-- Bloc Documents attachés -->
  {#if eventId}
    <div class="mx-auto mt-4 {maxWidthClass}">
      <EventDocumentsBloc
        {eventId}
        tag="tache"
        tagLabel="Tâches"
        {canEdit}
      />
    </div>
  {/if}

  <!-- Todo List -->
  {#if currentEvent}
    <div class="mx-auto mt-6 {maxWidthClass}">
      <div class="mb-4 flex items-center gap-4">
        <ListTodo class="text-primary size-5" />
        <h2 class="text-xl font-bold">
          Tâches ({currentEvent.todos.length}) - {currentEvent.name}
        </h2>
      </div>
      <EventTodoList
        event={currentEvent}
        {contributors}
        onTodosChange={handleTodosChange}
        disabled={!canEdit}
      />
    </div>
  {:else}
    <div class="flex items-center justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {/if}
</div>

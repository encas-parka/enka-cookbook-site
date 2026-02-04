<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { ArrowLeft, Calendar } from "@lucide/svelte";
  import { navigate } from "$lib/router";
  import EventCard from "$lib/components/dashboard/EventCard.svelte";

  let pastEvents = $derived(eventsStore.pastEvents);
  let loading = $state(false);
  let loaded = $state(false);

  function goBack() {
    navigate("/dashboard");
  }

  // Charger tous les événements passés au montage
  onMount(async () => {
    loading = true;
    try {
      await eventsStore.loadAllPastEvents();
      loaded = true;
    } catch (err) {
      console.error("[EventListPage] Erreur lors du chargement:", err);
    } finally {
      loading = false;
    }
  });
</script>

<div class="container mx-auto p-4" transition:fade>
  <div class="mb-4 flex items-center gap-2">
    <button class="btn btn-ghost btn-sm" onclick={goBack}>
      <ArrowLeft class="h-4 w-4" />
    </button>
    <h1 class="text-2xl font-bold">Événements passés</h1>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>
  {:else if pastEvents.length === 0}
    <div class="py-6 text-center">
      <Calendar class="mx-auto mb-3 h-12 w-12 opacity-20" />
      <p class="text-base-content/60">Aucun événement passé</p>
    </div>
  {:else}
    <div class="card bg-base-100">
      <div class="card-body">
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
          {#each pastEvents as event (event.$id)}
            <EventCard {event} />
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

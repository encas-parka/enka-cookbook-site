<script lang="ts">
  import { Calendar } from "@lucide/svelte";
  import type { EnrichedEvent } from "$lib/types/events.d";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import EventCard from "./EventCard.svelte";

  interface Props {
    events: EnrichedEvent[];
    cardClass?: string;
    loading?: boolean;
  }

  let { events = [], loading = false, cardClass = "" }: Props = $props();

  function hasInvitation(eventId: string) {
    return eventsStore.getRsvpStatus(eventId) === "invited";
  }
</script>

{#if loading}
  <!-- Skeleton loader -->
  <div class="space-y-6 py-4">
    <div class="h-40 w-full skeleton rounded-lg"></div>
    <div class="h-40 w-full skeleton rounded-lg"></div>
    <div class="h-40 w-full skeleton rounded-lg"></div>
  </div>
{:else if events.length === 0}
  <div class="py-6 text-center">
    <Calendar size={32} class="mx-auto mb-3 text-base-content/20" />
    <p class="mb-4 text-sm text-base-content/60">Aucun événement prévu</p>
  </div>
{:else}
  <!-- Événements à venir -->
  {#if events.length > 0}
    <div class="my-4">
      <div class="space-y-6">
        {#each events as event (event.id)}
          <EventCard
            {event}
            {cardClass}
            contributorStatus={hasInvitation(event.id) ? "invited" : null}
          />
        {/each}
      </div>
    </div>
  {/if}
{/if}

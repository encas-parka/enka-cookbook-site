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
    return eventsStore.getContributorStatus(eventId) === "invited";
  }
</script>

{#if loading}
  <!-- Skeleton loader -->
  <div class="space-y-6 py-4">
    <div class="skeleton h-40 w-full rounded-lg"></div>
    <div class="skeleton h-40 w-full rounded-lg"></div>
    <div class="skeleton h-40 w-full rounded-lg"></div>
  </div>
{:else if events.length === 0}
  <div class="py-6 text-center">
    <Calendar size={32} class="text-base-content/20 mx-auto mb-3" />
    <p class="text-base-content/60 mb-4 text-sm">Aucun événement prévu</p>
  </div>
{:else}
  <!-- Événements à venir -->
  {#if events.length > 0}
    <div class="my-4">
      <div class="space-y-6">
        {#each events as event (event.$id)}
          <EventCard
            {event}
            {cardClass}
            contributorStatus={hasInvitation(event.$id) ? "invited" : null}
          />
        {/each}
      </div>
    </div>
  {/if}
{/if}

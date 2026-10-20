<script lang="ts">
  import { Calendar, Users } from "@lucide/svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import ListEventCard from "./ListEventCard.svelte";
  import type { EnrichedEvent } from "$lib/types/events.d";

  interface Props {
    currentEvents: EnrichedEvent[]; // Déjà triés et filtrés (date >= aujourd'hui)
    userTeamIds: string[];
    loading?: boolean;
  }

  let { currentEvents, userTeamIds, loading = false }: Props = $props();

  // État : false = événements externes uniquement, true = tous les événements
  let showAllEvents = $state(true);

  // Événements externes : utilisateur est contributor mais pas dans ses équipes
  // currentEvents est déjà trié par dateStart croissant dans le store
  const externalEvents = $derived.by(() => {
    const userId = globalState.user?.id;
    if (!userId) return [];

    return currentEvents.filter((event) => {
      // L'événement n'appartient pas aux équipes de l'utilisateur
      // (la relation teams porte des ids PocketBase)
      const belongsToUserTeams = event.teams?.some((id) =>
        userTeamIds.includes(id),
      );

      if (belongsToUserTeams) return false;

      // L'utilisateur est dans les contributors
      const isContributor = event.contributors?.some((c) => c.id === userId);

      return isContributor;
    });
  });

  // Événements des équipes de l'utilisateur
  const teamEvents = $derived.by(() => {
    return currentEvents.filter((event) => {
      return event.teams?.some((id) => userTeamIds.includes(id));
    });
  });

  // Événements à afficher selon le toggle
  const displayedEvents = $derived.by(() => {
    return showAllEvents ? [...externalEvents, ...teamEvents] : externalEvents;
  });

  // Statistiques pour le badge
  const totalEventsCount = $derived.by(
    () => externalEvents.length + teamEvents.length,
  );
  const externalEventsCount = $derived.by(() => externalEvents.length);

  // Handler pour le toggle
  function toggleEventsView() {
    showAllEvents = !showAllEvents;
  }
</script>

{#if currentEvents.length === 0}
  <!-- Pas d'événements du tout -->
{:else if externalEvents.length === 0 && !showAllEvents}
  <!-- Affichage minimaliste : pas d'invitations externes -->
  <div class="card border border-base-200 bg-base-300 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Calendar class="h-6 w-6 stroke-3 text-primary" />
          <div>
            <h2 class="mb-1 card-title">Événements</h2>
            <p class="text-sm text-base-content/60">
              Aucune invitation à participer à un événement hors de vos équipes.
            </p>
          </div>
        </div>
        {#if teamEvents.length > 0}
          <button class="btn gap-2 btn-sm" onclick={toggleEventsView}>
            <Users class="h-4 w-4" />
            Voir tous mes événements
            <div class="badge badge-xs badge-neutral">{totalEventsCount}</div>
          </button>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- Affichage normal avec événements -->
  <div
    class="card mb-6 border border-base-200 bg-base-100 shadow-md max-sm:card-sm"
  >
    <div class="card-body">
      <div class="mb-4 flex flex-wrap items-center justify-between">
        <div class="flex items-center gap-3">
          <Calendar class="h-6 w-6 stroke-3 text-primary" />
          <div>
            <h2 class="mb-1 card-title">
              {showAllEvents ? "Tous mes événements" : "Invitations externes"}
            </h2>
            <p class="text-sm text-base-content/60">
              {#if showAllEvents}
                {displayedEvents.length} événement{displayedEvents.length > 1
                  ? "s"
                  : ""} à venir
              {:else}
                {externalEventsCount} évenement{externalEventsCount > 1
                  ? "s"
                  : ""} hors équipe
              {/if}
            </p>
          </div>
        </div>

        <!-- Bouton toggle -->
        {#if teamEvents.length > 0}
          <button
            class="btn ms-auto btn-link btn-secondary btn-sm"
            onclick={toggleEventsView}
          >
            {#if showAllEvents}
              Voir les invitations externes uniquement
            {:else}
              Voir tous mes événements
              <div class="badge badge-soft badge-sm badge-secondary">
                {totalEventsCount}
              </div>
            {/if}
          </button>
        {/if}
      </div>

      <!-- Liste des événements -->
      <ListEventCard
        events={displayedEvents}
        {loading}
        cardClass={showAllEvents ? "" : "border-l-4 border-info"}
      />
    </div>
  </div>
{/if}

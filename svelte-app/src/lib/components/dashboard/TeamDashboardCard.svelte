<script lang="ts">
  import {
    Users,
    MapPin,
    Settings,
    Plus,
    Package,
    ShoppingCart,
    ArrowRight,
    Calendar,
    ScrollText,
    NotebookPen,
  } from "@lucide/svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { p } from "$lib/router";
  import TeamDetailModal from "$lib/components/teams/TeamDetailModal.svelte";
  import ListEventCard from "./ListEventCard.svelte";
  import type { EnrichedNativeTeam } from "$lib/types/aw_native_team.d";
  import type { EnrichedEvent } from "$lib/types/events.d";
  import DocQuickAccess from "$lib/components/documents/DocQuickAccess.svelte";

  interface Props {
    team: EnrichedNativeTeam;
    currentEvents: EnrichedEvent[]; // Déjà triés par dateStart croissant
    pastEvents: EnrichedEvent[]; // Déjà triés par dateStart décroissant
    loading?: boolean;
  }

  let { team, currentEvents, pastEvents, loading = false }: Props = $props();

  // État local
  let showTeamModal = $state(false);
  let teamModalTab = $state("");

  // Dérivés - Informations équipe
  const teamLocation = $derived.by(() => {
    const prefs = team.prefs || {};
    return prefs.city || prefs.location || prefs.region || null;
  });

  const teamMembers = $derived.by(() => {
    return team.members || [];
  });

  const memberNames = $derived(nativeTeamsStore.getTeamMemberNames(team.id));

  const memberNamesDisplay = $derived.by(() => {
    if (memberNames.length <= 20) return memberNames.join(", ");
    return `${memberNames.slice(0, 20).join(", ")} +${memberNames.length - 20}`;
  });

  // Dérivés - Événements filtrés par équipe
  // Les événements entrants sont déjà triés par date dans le store
  // Le filtre préserve l'ordre établi
  const teamCurrentEvents = $derived.by(() => {
    return currentEvents.filter(
      (event) =>
        event.teamsId?.includes(team.id) || event.teams?.includes(team.name),
    );
  });

  const teamPastEvents = $derived.by(() => {
    return pastEvents
      .filter(
        (event) =>
          event.teamsId?.includes(team.id) || event.teams?.includes(team.name),
      )
      .slice(0, 3); // 3 événements passés récents
  });

  // Handlers
  function openTeamModal() {
    teamModalTab = "members";

    showTeamModal = true;
  }

  function inviteMember() {
    teamModalTab = "invitations";
    showTeamModal = true;
  }
</script>

<div class="card bg-base-100/70 border-base-200 border shadow-xl">
  <div class="card-body gap-4 max-sm:px-2">
    <!-- === HEADER PRINCIPAL === -->
    <div class="flex flex-wrap items-start justify-between gap-2">
      <!-- Nom + Localisation -->
      <div class="flex items-center gap-2">
        <Users class="text-primary size-6 shrink-0 stroke-3" />
        <h2>{team.name}</h2>
        {#if teamLocation}
          <div class="badge badge-soft badge-secondary gap-1">
            <MapPin class="h-3 w-3" />
            {teamLocation}
          </div>
        {/if}
      </div>

      <!-- Bouton Paramètres -->
      <button
        class="btn btn-circle btn-ghost"
        onclick={openTeamModal}
        title="Paramètres de l'équipe"
      >
        <Settings />
      </button>
    </div>

    <!-- === SOUS-CARD MEMBRES | materiel  -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        class="card bg-base-100 card-sm border-neutral/20 shoadow-sm self-start border shadow"
      >
        <div class="card-body">
          <div
            class="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <div class=" flex items-center gap-2">
              <div class="indicator bg-primary/20 rounded-full p-2">
                <span class="indicator-item badge badge-sm badge-primary">
                  {teamMembers.length}</span
                >
                <Users class=" text-primary inline size-5 shrink-0 " />
              </div>
              <!-- Liste des noms -->
              <div class="text-base-content/70">{memberNamesDisplay}</div>
            </div>
            <button
              class="btn sm:btn-sm btn-accent ms-auto"
              onclick={inviteMember}
            >
              <Plus class="h-4 w-4" />
              Inviter
            </button>
          </div>
          {#if team.prefs.description}
            <blockquote
              class="text-base-content/70 border-neutral/20 bg-base-200/50 mt-2 rounded-lg border-x-4 p-2"
            >
              {team.prefs.description.slice(0, 250)}
              {#if team.prefs.description.length > 250}
                ...
              {/if}
            </blockquote>
          {/if}
        </div>
      </div>

      <div
        class="card border-neutral/20 bg-base-100 card-sm mb-auto flex w-full justify-center border shadow-sm"
      >
        <!-- Actions Matériel -->
        <div class="card-body place-content-center">
          <div class="card card-sm bg-base-300/60">
            <div class="card-body text-center">
              <p class="font-semibold">
                Gérez le matériel collectif de cantine :
              </p>
              <p>inventaire, gestion des emprunt, partage, etc.</p>
            </div>
          </div>
          <div class="flex w-full flex-wrap justify-around gap-2">
            <a
              class="btn btn-primary btn-soft flex-1"
              href={p(`/dashboard/materiel/${team.id}`)}
            >
              <NotebookPen class="size-4" />
              Inventaire
            </a>
            <a
              class="btn btn-primary btn-soft flex-1"
              href={p(`/dashboard/loans/${team.id}`)}
            >
              <ScrollText class="size-4" />
              Réservations
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="card grid grid-cols-1 gap-6 text-sm lg:grid-cols-6">
      <!-- === ÉVÉNEMENTS === -->
      <div
        class="card bg-base-100 card-sm border-neutral/20 border shadow-sm lg:col-span-4"
      >
        <div class="card-body">
          <div class="flex flex-wrap justify-between gap-2">
            <h3 class="card-title items-center">
              <Calendar class="text-primary inline size-5" /> Événements
            </h3>
            <a class="btn btn-sm btn-link" href={p("/eventList")}>
              Voir les événements passés
              <ArrowRight class="ml-2 h-4 w-4" />
            </a>
          </div>
          <!-- Événements à venir -->
          <ListEventCard
            events={teamCurrentEvents}
            {loading}
            cardClass="border-l-4 border-accent/60"
          />

          <!-- Événements récents -->
          {#if teamPastEvents.length > 0}
            <div class="fieldset-legend">Récents</div>
            <ListEventCard events={teamPastEvents} {loading} />
          {/if}
          <div class="card-actions mt-auto items-center justify-end">
            <!-- Bouton Créer un événement -->
            <a
              class="btn btn-primary btn-soft sm:btn-sm ml-auto"
              href={p(`/dashboard/eventCreate/${team.id}`)}
            >
              <Plus class="h-4 w-4" />
              Créer un événement
            </a>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2">
        <DocQuickAccess teamId={team.id} />
      </div>
    </div>

    <div class="flex justify-center"></div>
  </div>
</div>

<!-- Modal de détails de l'équipe -->
{#if showTeamModal}
  <TeamDetailModal
    teamId={team.id}
    onClose={() => (showTeamModal = false)}
    initialTab={teamModalTab}
  />
{/if}

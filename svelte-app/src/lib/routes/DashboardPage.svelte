<script lang="ts">
  import {
    warmUpEnkaData,
    warmUpUsersTeamsManager,
  } from "$lib/services/appwrite-warmup";
  import { navigate } from "$lib/router";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    nativeTeamsStore,
    nativeTeamsStore as teamsStore,
  } from "$lib/stores/NativeTeamsStore.svelte";
  import {
    CalendarPlus,
    CookingPot,
    Plus,
    Settings,
    Users,
  } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";

  import LatestRecipesCard from "$lib/components/dashboard/LatestRecipesCard.svelte";
  import TeamDashboardCard from "../components/dashboard/TeamDashboardCard.svelte";
  import ExternalEventsCard from "../components/dashboard/ExternalEventsCard.svelte";
  import CreateTeamModal from "../components/teams/CreateTeamModal.svelte";
  import { fade } from "svelte/transition";
  import EmailVerificationAlert from "../components/ui/EmailVerificationAlert.svelte";
  import TeamSummaryCard from "../components/dashboard/TeamSummaryCard.svelte";
  import ActionCard from "../components/ui/ActionCard.svelte";

  let createModalOpen = $state(false);

  // Traitement des événements - utiliser les derived properties du store

  // WARM-UP
  // $effect(() => {
  //   warmUpUsersTeamsManager();
  //   warmUpEnkaData();
  // });

  function handleTeamCreated(teamId: string) {
    createModalOpen = false;
  }

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: "Dashboard",
      actions: navActions,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });
</script>

{#snippet navActions()}
  <div class="flex gap-2 {globalState.isMobile && 'hidden'}">
    <button
      class="btn btn-primary btn-sm"
      onclick={() => navigate("/dashboard/eventCreate")}
    >
      <Plus class="h-4 w-4" />
      Créer un Événement
    </button>
    <button
      class="btn btn-primary btn-sm"
      onclick={() => navigate("/recipe/new")}
    >
      <Plus class="h-4 w-4" />
      Créer une Recette
    </button>
  </div>
{/snippet}

<div class="bg-base-200 min-h-screen" in:fade>
  <!-- Alerte de vérification d'email -->
  <EmailVerificationAlert />

  <!-- Greeting -->
  <div class="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
    <h2 class="text-base-content">
      Bienvenue {globalState.user?.name || ""}
    </h2>
  </div>

  <!-- Contenu principal -->
  <div class="mx-auto max-w-7xl px-1 py-8 sm:px-4">
    {#if !globalState.isAuthenticated}
      <!-- État non connecté -->
      <div
        class="bg-base-100 border-base-200 rounded-xl border p-8 text-center shadow-sm"
      >
        <Settings class="mx-auto mb-4 h-16 w-16 opacity-20" />
        <h2 class="mb-2 text-xl font-semibold">
          Connectez-vous pour accéder à votre tableau de bord
        </h2>
        <p class="text-base-content/60 mb-6">
          Connectez-vous pour voir vos équipes, événements et recettes.
        </p>
        <button class="btn btn-primary" onclick={() => {}}>
          Se connecter
        </button>
      </div>
    {:else if eventsStore.error || teamsStore.error}
      <!-- État d'erreur -->
      <div class="alert alert-error shadow-lg">
        <span
          >{eventsStore.error ||
            teamsStore.error ||
            "Une erreur est survenue"}</span
        >
      </div>
    {:else}
      <!-- Tableau de bord -->

      <!-- Actions rapides -->
      <div class="mb-8">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionCard
            title="Créer un Événement"
            description="Organisez un nouvel événement et invitez des équipes ou des individus à participer"
          >
            {#snippet icon()}
              <CalendarPlus class="size-5" />
            {/snippet}
            {#snippet action()}
              <button
                class="btn btn-primary btn-sm"
                onclick={() => navigate("/dashboard/eventCreate")}
              >
                <Plus class="size-5" />
              </button>
            {/snippet}
          </ActionCard>

          <ActionCard
            title="Créer une Recette"
            description="Partager une nouvelle recette pour pouvoir l'ajouter à des événements"
          >
            {#snippet icon()}
              <CookingPot class="size-5" />
            {/snippet}
            {#snippet action()}
              <button
                class="btn btn-primary btn-sm"
                onclick={() => navigate("/recipe/new")}
              >
                <Plus class="size-5" />
              </button>
            {/snippet}
          </ActionCard>

          <ActionCard
            title="Créer une Équipe"
            description="Créez un groupe et invitez des membres pour ensuite vous organiser ensemble sur des événements, gérer du matos en commun, partager des documents..."
          >
            {#snippet icon()}
              <Users class="size-5" />
            {/snippet}
            {#snippet action()}
              <button
                class="btn btn-primary btn-sm"
                onclick={() => (createModalOpen = true)}
              >
                <Plus class="size-5" />
              </button>
            {/snippet}
          </ActionCard>
        </div>
      </div>

      <!-- SECTION 1: Événements personnels (invitations externes) -->
      <section class="bg-base-200 py-8">
        <div class=" mx-auto">
          <ExternalEventsCard
            currentEvents={eventsStore.currentEvents}
            userTeamIds={globalState.userTeams}
            loading={eventsStore.loading}
          />
        </div>
      </section>

      <!-- SECTION 2: Team Cards (uniquement si authentifié avec équipes) -->
      {#if globalState.userTeams.length > 0}
        <section class="bg-base-200 py-8">
          <div class="mx-auto">
            <div class="grid grid-cols-1 gap-6">
              {#each globalState.userTeams as teamId (teamId)}
                {@const team = nativeTeamsStore.getTeamById(teamId)}
                {#if team}
                  <TeamDashboardCard
                    {team}
                    currentEvents={eventsStore.currentEvents}
                    pastEvents={eventsStore.pastEvents}
                    loading={eventsStore.loading}
                  />
                {/if}
              {/each}
            </div>
          </div>
        </section>
      {/if}

      <div class="card bg-base-100 border-base-200 border shadow-xl">
        <div class="card-body">
          <LatestRecipesCard />
        </div>
      </div>
    {/if}
  </div>
</div>

<CreateTeamModal
  isOpen={createModalOpen}
  onClose={() => (createModalOpen = false)}
  onSuccess={handleTeamCreated}
/>

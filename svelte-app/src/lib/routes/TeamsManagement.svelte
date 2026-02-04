<script lang="ts">
  import { Plus, Users, LoaderCircle } from "@lucide/svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import TeamCard from "$lib/components/teams/TeamCard.svelte";
  import CreateTeamModal from "$lib/components/teams/CreateTeamModal.svelte";
  import TeamDetailModal from "$lib/components/teams/TeamDetailModal.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { onDestroy } from "svelte";
  import { navigate } from "$lib/router";
  import { fade } from "svelte/transition";

  import { warmUpUsersTeamsManager } from "$lib/services/appwrite-warmup";

  // État de la page
  let createModalOpen = $state(false);
  let selectedTeamId = $state<string | null>(null);

  function openTeamDetails(teamId: string) {
    selectedTeamId = teamId;
  }

  function closeTeamDetails() {
    selectedTeamId = null;
  }

  function openCreateModal() {
    createModalOpen = true;
  }

  function closeCreateModal() {
    createModalOpen = false;
  }

  // Après création d'équipe, ouvrir les détails
  function handleTeamCreated(teamId: string) {
    closeCreateModal();
    openTeamDetails(teamId);
  }

  // ============================================================================
  // WARM-UP
  // ============================================================================
  // $effect(() => {
  //   warmUpUsersTeamsManager();
  // });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      title: "Équipes",
      actions: navActions,
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });
</script>

{#snippet navActions()}
  <button class="btn btn-primary btn-sm" onclick={openCreateModal}>
    <Plus class="h-4 w-4" />
    Créer une équipe
  </button>
{/snippet}

<div class="mx-auto max-w-7xl px-4 py-8" transition:fade>
  <!-- Contenu -->
  {#if !globalState.isAuthenticated}
    <div class="alert alert-warning">
      <span>Vous devez être connecté pour voir vos équipes</span>
    </div>
  {:else if teamsStore.error}
    <div class="alert alert-error shadow-lg">
      <span>{teamsStore.error}</span>
    </div>
  {:else if teamsStore.count === 0}
    <!-- Empty state -->
    <div
      class="bg-base-200 rounded-box border-base-200 border-2 border-dashed py-20 text-center"
    >
      <div class="bg-base-200 mb-4 inline-block rounded-full p-4">
        <Users class="h-8 w-8 opacity-50" />
      </div>
      <h3 class="mb-2 text-lg font-bold">Aucune équipe</h3>
      <p class="text-base-content/60 mb-6">
        Vous n'avez pas encore créé ou rejoint d'équipe.
      </p>
      <button class="btn btn-primary btn-sm" onclick={openCreateModal}>
        Créer ma première équipe
      </button>
    </div>
  {:else}
    <!-- Liste des équipes -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each teamsStore.teams as team (team.$id)}
        <TeamCard
          {team}
          teamId={team.$id}
          onClick={(teamId) => openTeamDetails(teamId)}
        />
      {/each}
    </div>
  {/if}
</div>

<!-- Modals -->
<CreateTeamModal
  isOpen={createModalOpen}
  onClose={closeCreateModal}
  onSuccess={handleTeamCreated}
/>

<TeamDetailModal teamId={selectedTeamId} onClose={closeTeamDetails} />

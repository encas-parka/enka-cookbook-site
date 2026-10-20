<script lang="ts">
  import { Users, Calendar, CheckCircle, XCircle, Plus } from "@lucide/svelte";
  import { p } from "$lib/router";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import TeamDetailModal from "$lib/components/teams/TeamDetailModal.svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import CreateTeamModal from "../teams/CreateTeamModal.svelte";

  interface Team {
    id: string;
    name: string;
    description?: string | null;
    total?: number;
  }

  interface PendingInvite {
    teamId: string;
    teamName: string;
    membershipId: string;
  }

  interface Props {
    teams: Team[];
    invitations: PendingInvite[];
    loading?: boolean;
  }

  let { teams = [], invitations = [], loading = false }: Props = $props();

  // État pour le modal de détails d'équipe
  let selectedTeamId = $state<string | null>(null);

  let createModalOpen = $state(false);

  function openCreateModal() {
    createModalOpen = true;
  }

  function closeCreateModal() {
    createModalOpen = false;
  }

  function handleTeamCreated(teamId: string) {
    closeCreateModal();
    openTeamDetailModal(teamId);
  }

  function openTeamDetailModal(teamId: string) {
    selectedTeamId = teamId;
  }

  function closeTeamDetailModal() {
    selectedTeamId = null;
  }
</script>

<div class="card border border-base-200 bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <h2 class="card-title flex items-center gap-2">
        <Users class="h-5 w-5 text-primary" />
        Mes Équipes
      </h2>
      <a
        class="btn btn-ghost btn-sm"
        href={p("/dashboard/teams")}
        title="Voir toutes les équipes"
      >
        Voir tout
      </a>
    </div>

    {#if loading}
      <!-- Skeleton loader -->
      <div class="space-y-3 py-4">
        <div class="h-24 w-full skeleton rounded-lg"></div>
        <div class="h-24 w-full skeleton rounded-lg"></div>
        <div class="h-24 w-full skeleton rounded-lg"></div>
      </div>
    {:else if teams.length === 0 && invitations.length === 0}
      <div class="py-6 text-center">
        <Users class="mx-auto mb-3 h-12 w-12 opacity-20" />
        <p class="text-sm text-base-content/60">Aucune équipe ou invitation</p>
        <a class="btn mt-3 btn-primary btn-sm" href={p("/dashboard/teams")}>
          Créer une équipe
        </a>
      </div>
    {:else}
      <div class="space-y-4">
        <!-- Équipes -->
        {#if teams.length > 0}
          <div>
            <h3 class="mb-2 text-sm font-semibold text-base-content/70">
              Vos équipes ({teams.length})
            </h3>
            <div class="space-y-2">
              {#each teams as team (team.id)}
                <div
                  class="flex cursor-pointer items-center justify-between rounded-lg bg-base-200 p-2 transition-colors hover:bg-base-300"
                  onclick={() => openTeamDetailModal(team.id)}
                  role="button"
                  tabindex="0"
                  title="Voir les détails de {team.name}"
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      openTeamDetailModal(team.id);
                    }
                  }}
                >
                  <div>
                    <div class="text-sm font-medium">{team.name}</div>
                    {#if team.total}
                      <div class="text-xs text-base-content/60">
                        {team.total} membre{team.total > 1 ? "s" : ""}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
    <div class="mt-4 card-actions">
      <button class="btn ms-auto btn-primary btn-sm" onclick={openCreateModal}
        ><Plus class="size-4" /> Créer une équipe</button
      >
    </div>
  </div>
</div>

<!-- Modals -->
<CreateTeamModal
  isOpen={createModalOpen}
  onClose={closeCreateModal}
  onSuccess={handleTeamCreated}
/>

<!-- Modal de détails d'équipe -->
{#if selectedTeamId}
  <TeamDetailModal teamId={selectedTeamId} onClose={closeTeamDetailModal} />
{/if}

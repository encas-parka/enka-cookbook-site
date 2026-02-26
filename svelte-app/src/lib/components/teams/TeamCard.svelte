<script lang="ts">
  import { Users, Crown, ChevronRight, LogOut } from "@lucide/svelte";
  import type { EnrichedNativeTeam as EnrichedTeam } from "$lib/types/aw_native_team.d";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";

  interface Props {
    team: EnrichedTeam;
    teamId: string;
    onClick: (teamId: string) => void;
  }

  let { team, teamId, onClick }: Props = $props();

  // Détermine le rôle de l'utilisateur dans cette équipe
  const userRole = $derived.by(() => {
    const currentUserId = globalState.userId;
    if (!currentUserId) return null;

    const member = team.members.find((m) => m.id === currentUserId);
    return member?.roles?.[0] || null;
  });

  // Icône du rôle
  const RoleIcon = $derived(userRole === "owner" ? Crown : null);

  // Couleur du badge selon le rôle
  const roleBadgeClass = $derived(
    userRole === "owner" ? "badge-primary" : "badge-ghost",
  );

  // Membres confirmés uniquement
  const confirmedMembers = $derived(team.members.filter((m) => m.confirmed));

  // Nombre d'invitations en attente (membres non confirmés)
  const pendingInvitationsCount = $derived(
    team.members.filter((m) => !m.confirmed).length,
  );

  // Description depuis les prefs
  const description = $derived(team.prefs?.description as string | undefined);

  // L'utilisateur est-il membre confirmé ?
  const isUserMember = $derived.by(() => {
    const me = team.members.find((m) => m.id === globalState.userId);
    return me && me.confirmed;
  });

  // Quitter l'équipe (pour les membres non-owner)
  async function leaveTeam() {
    const me = team.members.find((m) => m.id === globalState.userId);
    if (me && me.roles?.[0] !== "owner") {
      await teamsStore.removeMember(teamId, me.$id);
    }
  }
</script>

<div
  class="card bg-base-100 border-base-200 hover:border-primary/50 group cursor-pointer border text-left shadow-xl transition-all hover:shadow-2xl"
  role="button"
  tabindex="0"
  onclick={() => onClick(team.$id)}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(team.$id);
    }
  }}
>
  <div class="card-body">
    <!-- Header avec nom et rôle -->
    <div class="mb-2 flex items-start justify-between">
      <h3 class="card-title group-hover:text-primary text-lg transition-colors">
        {team.name}
      </h3>
      <!-- {#if userRole}
        <div class="badge {roleBadgeClass} gap-1">
          {#if RoleIcon}
            <RoleIcon class="h-3 w-3" />
          {/if}
          {userRole === "owner" ? "Propriétaire" : "Membre"}
        </div>
      {/if} -->
    </div>

    <!-- Description -->
    {#if description}
      <p class="text-base-content/70 mb-2 line-clamp-2 text-sm">
        {description}
      </p>
    {/if}

    <!-- Stats -->
    <div class="text-base-content/70 mt-2 flex items-center gap-4 text-sm">
      <div class="flex items-center gap-1">
        <Users class="h-4 w-4" />
        <span
          >{confirmedMembers.length} membre{confirmedMembers.length > 1
            ? "s"
            : ""}</span
        >
      </div>
      {#if userRole === "owner" && pendingInvitationsCount > 0}
        <div class="badge badge-warning badge-sm gap-1">
          {pendingInvitationsCount} invitation{pendingInvitationsCount > 1
            ? "s"
            : ""}
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="card-actions mt-4 justify-between">
      {#if isUserMember && userRole !== "owner"}
        <button
          class="btn btn-ghost btn-xs text-error"
          onclick={(e) => {
            e.stopPropagation();
            leaveTeam();
          }}
          title="Quitter l'équipe"
        >
          <LogOut class="h-4 w-4" />
          Quitter
        </button>
      {:else}
        <span></span>
      {/if}
      <span
        class="text-primary flex items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100"
      >
        Gérer
        <ChevronRight class="h-4 w-4" />
      </span>
    </div>
  </div>
</div>

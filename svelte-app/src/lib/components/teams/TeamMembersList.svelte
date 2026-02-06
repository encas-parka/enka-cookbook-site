<script lang="ts">
  import {
    Users,
    Crown,
    Shield,
    LogOut,
    Info,
    Pencil,
    Mail,
  } from "@lucide/svelte";
  import type { EnrichedNativeTeam as EnrichedTeam } from "$lib/types/aw_native_team.d";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import ManageMemberModal from "./ManageMemberModal.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import { getAppwriteInstances } from "$lib/services/appwrite";
  import { getFunctionId } from "$lib/services/appwrite";

  interface Props {
    team: EnrichedTeam;
    onMemberRemoved?: () => void;
  }

  let { team, onMemberRemoved }: Props = $props();

  // État du modal de gestion de membre
  let manageMemberModal = $state<{
    isOpen: boolean;
    member: (typeof team.members)[number] | null;
  }>({ isOpen: false, member: null });

  let confirmLeaveTeam = $state(false);
  let loading = $state(false);
  let resendingInvite = $state<string | null>(null); // memberId en cours de renvoi

  // Utilisateur actuel
  const currentUserId = $derived(globalState.userId);

  // Rôle de l'utilisateur actuel
  const currentUserRole = $derived(() => {
    if (!currentUserId) return null;
    const member = team.members.find((m) => m.id === currentUserId);
    return (member?.roles?.[0] as "owner" | "member") || null;
  });

  // Peut gérer les membres (owner)
  const canManageMembers = $derived(currentUserRole() === "owner");

  // Formater la date
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // Ouvrir le modal de gestion d'un membre
  function openManageModal(member: (typeof team.members)[number]) {
    manageMemberModal = { isOpen: true, member };
  }

  // Callback après mise à jour d'un membre
  async function handleMemberUpdated() {
    // Recharger les données de la team pour refléter les modifications
    await teamsStore.fetchTeam(team.$id);
    onMemberRemoved?.();
    manageMemberModal = { isOpen: false, member: null };
  }

  // Quitter l'équipe
  async function leaveTeam() {
    if (!currentUserId) return;

    const myMembership = team.members.find((m) => m.id === currentUserId);
    if (!myMembership) return;

    // Validation : vérifier si c'est le dernier owner
    if (myMembership.roles[0] === "owner") {
      const otherOwners = team.members.filter(
        (m) => m.roles[0] === "owner" && m.id !== currentUserId,
      );

      if (otherOwners.length === 0) {
        alert(
          "Vous ne pouvez pas quitter l'équipe car vous êtes le dernier administrateur. Désignez un autre administrateur avant de quitter.",
        );
        confirmLeaveTeam = false;
        return;
      }
    }

    loading = true;
    try {
      await teamsStore.removeMember(team.$id, myMembership.$id);
      confirmLeaveTeam = false;
      onMemberRemoved?.();
    } catch (err: any) {
      console.error("[TeamMembersList] Erreur désinscription:", err);
      alert("Erreur lors de la désinscription");
    } finally {
      loading = false;
    }
  }

  // Icône et couleur selon le rôle
  function getRoleIcon(role: string) {
    return role === "owner" ? Crown : Users;
  }

  function getRoleBadgeClass(role: string) {
    return role === "owner" ? "badge-primary badge-soft" : "badge-ghost";
  }

  function getRoleLabel(role: string) {
    return role === "owner" ? "Admin" : "Membre";
  }

  // Renvoyer une invitation à un membre (utilise native-invite)
  async function resendInvite(member: (typeof team.members)[number]) {
    if (!canManageMembers) return;

    resendingInvite = member.id;
    try {
      const { functions } = await getAppwriteInstances();
      const functionId = getFunctionId("usersTeamsManager");

      // Utiliser native-invite avec un seul email
      const payload = {
        action: "native-invite",
        teamId: team.$id,
        emails: [member.userEmail], // native-invite gère déjà un tableau d'emails
      };

      await functions.createExecution({
        functionId,
        body: JSON.stringify(payload),
      });

      alert(`Invitation renvoyée à ${member.name}`);
    } catch (err: any) {
      console.error("[TeamMembersList] Erreur renvoi invitation:", err);
      alert("Erreur lors du renvoi de l'invitation : " + err.message);
    } finally {
      resendingInvite = null;
    }
  }
</script>

<div class="space-y-4">
  <!-- Liste des membres -->
  {#if team.members.length === 0}
    <div class="py-8 text-center opacity-50">
      <Users class="mx-auto mb-2 h-8 w-8" />
      <p class="text-sm">Aucun membre</p>
    </div>
  {:else}
    <div class="alert">
      <Info class="size-4 shrink-0" /> Seul les admins peuvent modifier les parametre
      de l'équipe
    </div>
    <div class="space-y-2">
      {#each team.members.filter((m) => m.confirmed) as member (member.id)}
        {@const role = member.roles[0]}
        {@const RoleIcon = getRoleIcon(role)}
        {@const isCurrentUser = member.id === currentUserId}
        {@const canRemove = canManageMembers && !isCurrentUser}

        <div
          class="card bg-base-100 border-base-200 border p-4 transition-shadow hover:shadow-md"
        >
          <div class="flex items-center justify-between gap-4">
            <!-- Avatar et infos -->
            <div class="flex flex-1 items-center gap-3">
              <!-- Avatar avec initiales -->
              <div class="avatar avatar-placeholder">
                <div
                  class="{member.name === globalState.userName
                    ? 'bg-accent'
                    : 'bg-neutral'} text-neutral-content w-12 rounded-full"
                >
                  <span class="text-lg">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
              </div>

              <!-- Nom et rôle -->
              <div class="flex-1">
                <div class="font-medium">
                  {member.name}
                  {#if isCurrentUser}
                    <span class="text-xs opacity-50">(vous)</span>
                  {/if}
                </div>
                <div class="text-sm opacity-70">
                  Membre depuis {formatDate(member.joinedAt)}
                  <!-- Bouton renvoyer l'invitation (visible pour tous les membres) -->
                  <button
                    class="btn btn-info btn-link btn-xs py-4"
                    onclick={() => resendInvite(member)}
                    disabled={resendingInvite === member.id}
                    title="Renvoyer l'invitation par email"
                  >
                    {#if resendingInvite === member.id}
                      <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                      <Mail class="h-4 w-4" /> Renvoyer l'invitation
                    {/if}
                  </button>
                </div>
              </div>
            </div>

            <!-- Badge de rôle + bouton d'édition -->
            <div class="flex items-center gap-2">
              <div class="badge {getRoleBadgeClass(role)} gap-1">
                <RoleIcon class="h-3 w-3" />
                {getRoleLabel(role)}
              </div>

              {#if canManageMembers && !isCurrentUser}
                <!-- Bouton de gestion du membre (uniquement pour les owners sur les autres membres) -->
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  onclick={() => openManageModal(member)}
                  disabled={loading}
                  title="Gérer ce membre"
                >
                  <Pencil class="h-4 w-4" />
                </button>
              {/if}
            </div>

            <!-- Actions (uniquement quitter l'équipe pour soi-même) -->
            <div class="flex gap-2">
              {#if isCurrentUser && member.roles?.[0] !== "owner"}
                <!-- Bouton de désinscription -->
                <button
                  class="btn btn-error btn-sm"
                  onclick={() => (confirmLeaveTeam = true)}
                  disabled={loading}
                  title="Quitter l'équipe"
                >
                  <LogOut class="h-4 w-4" />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal de gestion de membre -->
{#if manageMemberModal.isOpen && manageMemberModal.member}
  <ManageMemberModal
    isOpen={manageMemberModal.isOpen}
    {team}
    member={manageMemberModal.member}
    onClose={() => (manageMemberModal = { isOpen: false, member: null })}
    onMemberUpdated={handleMemberUpdated}
  />
{/if}

<!-- Modal de confirmation - Quitter l'équipe -->
<ConfirmModal
  isOpen={confirmLeaveTeam}
  title="Quitter l'équipe"
  message="Êtes-vous sûr de vouloir quitter cette équipe ? Vous devrez être réinvité pour y revenir."
  variant="warning"
  confirmLabel="Quitter"
  cancelLabel="Annuler"
  onConfirm={leaveTeam}
  onCancel={() => (confirmLeaveTeam = false)}
/>

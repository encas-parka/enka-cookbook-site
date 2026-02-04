<script lang="ts">
  import { X, Users, Mail, Settings, Trash2 } from "@lucide/svelte";
  import type { EnrichedNativeTeam as EnrichedTeam } from "$lib/types/aw_native_team.d";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import TeamMembersList from "./TeamMembersList.svelte";
  import TeamFormFields from "./TeamFormFields.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import InviteMembersForm from "./InviteMembersForm.svelte";

  interface Props {
    teamId: string | null;
    onClose: () => void;
    initialTab?: string;
  }

  let { teamId, onClose, initialTab = "members" }: Props = $props();

  // État du modal
  // svelte-ignore state_referenced_locally
  let currentTab = $state<string>(initialTab);
  let confirmDeleteTeam = $state(false);
  let loading = $state(false);

  // État pour le formulaire d'invitation
  let invitedEmails = $state<string[]>([]);
  let inviteCustomMessage = $state("");
  let inviteLoading = $state(false);

  // Équipe actuelle
  const team = $derived(teamId ? teamsStore.getTeamById(teamId) : null);

  // Rôle de l'utilisateur
  const userRole = $derived.by(() => {
    if (!team || !globalState.userId) return null;
    const member = team.members.find((m) => m.id === globalState.userId);
    return member?.roles?.[0] || null;
  });

  const isOwner = $derived(userRole === "owner");
  const canEdit = $derived(isOwner); // Dans les Teams natives, seul l'owner édite pour l'instant

  // État du formulaire de paramètres
  let editName = $state("");
  let editDescription = $state("");
  let editLocation = $state("");
  let editCity = $state("");
  let hasChanges = $state(false);

  // Initialiser les valeurs d'édition
  $effect(() => {
    if (team) {
      editName = team.name;
      editDescription = (team.prefs?.description as string) || "";
      editLocation = (team.prefs?.location as string) || "";
      editCity = (team.prefs?.city as string) || "";
      hasChanges = false;
    }
  });

  // Détecter les changements
  $effect(() => {
    if (team) {
      hasChanges =
        editName !== team.name ||
        editDescription !== ((team.prefs?.description as string) || "") ||
        editLocation !== ((team.prefs?.location as string) || "") ||
        editCity !== ((team.prefs?.city as string) || "");
    }
  });

  // Sauvegarder les modifications
  async function saveSettings() {
    if (!team || !hasChanges) return;

    loading = true;
    try {
      await teamsStore.updateTeam(team.$id, editName.trim() || undefined, {
        description: editDescription.trim() || undefined,
        location: editLocation.trim() || undefined,
        city: editCity.trim() || undefined,
      });
      hasChanges = false;
    } catch (err: any) {
      console.error("[TeamDetailModal] Erreur sauvegarde:", err);
      alert("Erreur lors de la sauvegarde");
    } finally {
      loading = false;
    }
  }

  // Supprimer l'équipe
  async function deleteTeam() {
    if (!team) return;

    loading = true;
    try {
      await teamsStore.deleteTeam(team.$id);
      confirmDeleteTeam = false;
      onClose();
    } catch (err: any) {
      console.error("[TeamDetailModal] Erreur suppression:", err);
      alert("Erreur lors de la suppression de l'équipe");
    } finally {
      loading = false;
    }
  }

  // Rafraîchir après modification
  async function handleMemberChange() {
    if (teamId) {
      await teamsStore.fetchTeam(teamId);
    }
  }

  // Envoyer les invitations
  async function sendInvitations() {
    if (!team || invitedEmails.length === 0) return;

    inviteLoading = true;

    try {
      await toastService.track(
        teamsStore.inviteTeamMember(
          team.$id,
          invitedEmails,
          inviteCustomMessage || undefined,
        ),
        {
          loading: "Envoi des invitations en cours...",
          success: `${invitedEmails.length} invitation${invitedEmails.length > 1 ? "s" : ""} envoyée${invitedEmails.length > 1 ? "s" : ""} avec succès`,
          error: "Erreur lors de l'envoi des invitations",
        },
      );

      // Réinitialiser le formulaire
      invitedEmails = [];
      inviteCustomMessage = "";

      // Rafraîchir la liste
      if (teamId) {
        await teamsStore.fetchTeam(teamId);
      }
    } catch (err: any) {
      console.error("[TeamDetailModal] Erreur envoi invitations:", err);
    } finally {
      inviteLoading = false;
    }
  }
</script>

<ModalContainer isOpen={teamId !== null} {onClose}>
  {#if team}
    <ModalHeader title={team.name} subtitle={team.description} {onClose}>
      <!-- {#if isOwner}
        <button
          class="btn btn-error btn-sm"
          onclick={() => (confirmDeleteTeam = true)}
          disabled={loading}
          title="Supprimer l'équipe"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      {/if} -->
    </ModalHeader>

    <ModalContent>
      <!-- Onglets -->
      <div class="tabs tabs-border mb-6 flex-none" role="tablist">
        <button
          role="tab"
          class="tab {currentTab === 'members' ? 'tab-active' : ''}"
          onclick={() => (currentTab = "members")}
        >
          <Users class="mr-1 h-5 w-5" />
          Membres
          <span class="badge badge-sm badge-secondary ml-1">
            {team.members.length}
          </span>
        </button>

        <button
          role="tab"
          class="tab {currentTab === 'invitations' ? 'tab-active' : ''}"
          onclick={() => (currentTab = "invitations")}
        >
          <Mail class="mr-1 h-5 w-5" />
          Invitations
        </button>

        <button
          role="tab"
          class="tab {currentTab === 'settings' ? 'tab-active' : ''}"
          onclick={() => (currentTab = "settings")}
        >
          <Settings class="mr-1 h-5 w-5" />
          Paramètres
          {#if hasChanges}
            <div class="bg-warning ml-1 h-2 w-2 rounded-full"></div>
          {/if}
        </button>
      </div>

      <!-- Contenu -->
      {#key currentTab}
        {#if currentTab === "members"}
          <TeamMembersList {team} onMemberRemoved={handleMemberChange} />
        {:else if currentTab === "invitations"}
          <!-- Formulaire d'invitation -->
          <div>
            <h4 class=" text-sm font-medium opacity-70">
              Inviter de nouveaux membres
            </h4>
            <InviteMembersForm
              {team}
              bind:invitedEmails
              bind:customMessage={inviteCustomMessage}
              loading={inviteLoading}
            />
          </div>
        {:else if currentTab === "settings"}
          <!-- Paramètres -->
          <TeamFormFields
            bind:name={editName}
            bind:description={editDescription}
            bind:location={editLocation}
            bind:city={editCity}
            showLocation={true}
            disabled={loading || !isOwner}
          />
        {/if}
      {/key}
    </ModalContent>

    <ModalFooter>
      {#if currentTab === "settings"}
        <button class="btn btn-ghost" onclick={onClose}>Annuler</button>
        <button
          class="btn btn-primary"
          onclick={saveSettings}
          disabled={loading || !hasChanges}
        >
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            Enregistrer
          {/if}
        </button>
      {:else if currentTab === "invitations"}
        <button class="btn btn-ghost" onclick={onClose}>Fermer</button>
        <button
          class="btn btn-primary"
          onclick={sendInvitations}
          disabled={inviteLoading || invitedEmails.length === 0}
        >
          {#if inviteLoading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            Envoyer {invitedEmails.length} invitation{invitedEmails.length > 1
              ? "s"
              : ""}
          {/if}
        </button>
      {:else}
        <button class="btn btn-ghost" onclick={onClose}>Fermer</button>
      {/if}
    </ModalFooter>
  {/if}
</ModalContainer>

<!-- Modal de confirmation - Suppression équipe -->
<ConfirmModal
  isOpen={confirmDeleteTeam}
  title="Supprimer l'équipe"
  message="Êtes-vous sûr de vouloir supprimer définitivement cette équipe ? Tous les membres seront retirés et cette action est irréversible."
  variant="danger"
  confirmLabel="Supprimer définitivement"
  cancelLabel="Annuler"
  onConfirm={deleteTeam}
  onCancel={() => (confirmDeleteTeam = false)}
/>

<script lang="ts">
  import {
    Pencil,
    Crown,
    Users,
    UserMinus,
    AlertTriangle,
  } from "@lucide/svelte";
  import type {
    EnrichedNativeTeam as EnrichedTeam,
    NativeTeamMember,
  } from "$lib/types/aw_native_team.d";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    team: EnrichedTeam;
    member: NativeTeamMember;
    onMemberUpdated?: () => void;
  }

  let { isOpen, onClose, team, member, onMemberUpdated }: Props = $props();

  // État du formulaire
  let selectedAction = $state<"keep" | "owner" | "member" | "remove">("keep");
  let loading = $state(false);

  // Initialiser l'action avec le rôle actuel du membre
  $effect(() => {
    selectedAction = member.roles[0] === "owner" ? "owner" : "member";
  });

  // Compter le nombre d'owners dans l'équipe
  const ownerCount = $derived(
    team.members.filter((m) => m.roles[0] === "owner").length,
  );

  // Vérifier si c'est le dernier owner
  const isLastOwner = $derived(member.roles[0] === "owner" && ownerCount === 1);

  // Validation : empêcher de rétrograder ou supprimer le dernier owner
  const canSubmit = $derived.by(() => {
    // Si c'est le dernier owner et qu'on veut le rétrograder ou supprimer
    if (
      isLastOwner &&
      (selectedAction === "member" || selectedAction === "remove")
    ) {
      return false;
    }
    return true;
  });

  // Message d'erreur de validation
  const validationError = $derived.by(() => {
    if (
      isLastOwner &&
      (selectedAction === "member" || selectedAction === "remove")
    ) {
      return "Vous devez désigner un autre administrateur avant de pouvoir rétrograder ou supprimer ce rôle.";
    }
    return null;
  });

  // Sauvegarder les modifications
  async function handleSubmit() {
    if (!canSubmit || loading) return;

    // Pas de changement - fermer sans opérer
    if (selectedAction === "keep" || selectedAction === member.roles[0]) {
      onClose();
      return;
    }

    // Capturer les données AVANT fermeture
    const teamId = team.$id;
    const memberId = member.$id;
    const memberName = member.name;
    const callback = onMemberUpdated;

    // Fermer immédiatement
    onClose();

    // Exécuter l'action appropriée
    if (selectedAction === "remove") {
      // Supprimer le membre
      await toastService.track(teamsStore.removeMember(teamId, memberId), {
        loading: `Suppression de ${memberName} de l'équipe...`,
        success: `${memberName} a été retiré de l'équipe`,
        error: "Erreur lors de la suppression du membre",
      });
    } else {
      // Changer le rôle (owner ↔ member)
      await toastService.track(
        teamsStore.updateMemberRole(teamId, memberId, selectedAction),
        {
          loading: `Mise à jour du rôle de ${memberName}...`,
          success: `Rôle de ${memberName} mis à jour avec succès`,
          error: "Erreur lors de la mise à jour du rôle",
        },
      );
    }

    callback?.();
  }

  function handleClose() {
    if (!loading) {
      onClose();
    }
  }
</script>

<ModalContainer
  {isOpen}
  onClose={handleClose}
  modalClass="!z-[1100]"
  maxWidth="sm"
>
  <ModalHeader title="Gérer le membre" subtitle={member.name} {onClose} />

  <ModalContent>
    <div class="space-y-6">
      <!-- Sélection du rôle -->
      <fieldset class="fieldset bg-base-100">
        <legend class="fieldset-legend">Rôle dans l'équipe</legend>

        <div class="space-y-3">
          <!-- Option Membre -->
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={selectedAction}
              value="member"
              disabled={loading}
            />
            <span class="label-text flex flex-1 items-center gap-2">
              <Users class="h-5 w-5" />
              <div>
                <strong class="block">Membre</strong>
                <span class="text-xs opacity-70">
                  Peut voir les ressources de l'équipe
                </span>
              </div>
            </span>
          </label>

          <!-- Option Admin (Owner) -->
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={selectedAction}
              value="owner"
              disabled={loading}
            />
            <span class="label-text flex flex-1 items-center gap-2">
              <Crown class="text-warning h-5 w-5" />
              <div>
                <strong class="block">Admin (Owner)</strong>
                <span class="text-xs opacity-70">
                  Peut gérer les membres et les paramètres
                </span>
              </div>
            </span>
          </label>

          <!-- Option Retirer de l'équipe -->
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="radio"
              class="radio radio-error"
              bind:group={selectedAction}
              value="remove"
              disabled={loading}
            />
            <span class="label-text flex flex-1 items-center gap-2">
              <UserMinus class="text-error h-5 w-5" />
              <div>
                <strong class="text-error block">Retirer de l'équipe</strong>
                <span class="text-xs opacity-70">
                  Ce membre ne pourra plus accéder aux ressources de l'équipe
                </span>
              </div>
            </span>
          </label>
        </div>
      </fieldset>

      <!-- Alerte de validation -->
      {#if validationError}
        <div class="alert alert-warning alert-soft">
          <AlertTriangle class="h-5 w-5" />
          <span class="text-sm">{validationError}</span>
        </div>
      {/if}
    </div>
  </ModalContent>

  <ModalFooter>
    <div class="flex-1"></div>

    <button class="btn btn-ghost" onclick={handleClose} disabled={loading}>
      Annuler
    </button>
    <button
      class="btn btn-primary"
      onclick={handleSubmit}
      disabled={loading || !canSubmit}
    >
      <Pencil class="h-4 w-4" />
      Valider
    </button>
  </ModalFooter>
</ModalContainer>

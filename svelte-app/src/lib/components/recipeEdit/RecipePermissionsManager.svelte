<script lang="ts">
  import {
    Users,
    UserPlus,
    X,
    Mail,
    ShieldAlert,
    Info,
    Lock,
  } from "@lucide/svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import Fieldset from "../ui/Fieldset.svelte";
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { fade } from "svelte/transition";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  interface Props {
    permissionWrite: string[] | null;
    createdBy: string | undefined;
    canEdit: boolean;
  }

  let { permissionWrite = $bindable(), createdBy, canEdit }: Props = $props();

  // État local
  let showInviteModal = $state(false);
  let emailInput = $state("");
  let isChecking = $state(false);
  let inviteError = $state<string | null>(null);

  // Carte pour faire le lien entre ID et Nom/Email pour l'affichage
  // On pourrait l'enrichir au fur et à mesure
  let memberNames = $state<Record<string, string>>({});

  // Initialisation des noms connus (le créateur) et synchronisation avec les équipes
  $effect(() => {
    if (createdBy === globalState.userId) {
      memberNames[createdBy] = globalState.userName || "Propriétaire";
    }

    // Synchroniser les noms depuis TeamsStore
    for (const team of teamsStore.teams) {
      if (team.members) {
        for (const member of team.members) {
          if (member.name && !memberNames[member.id]) {
            memberNames[member.id] = member.name;
          }
        }
      }
    }
  });

  // Liste des membres des équipes de l'utilisateur (invitables)
  let invitableMembers = $derived.by(() => {
    const list: Array<{ id: string; label: string; selected: boolean }> = [];

    // Parcourir les équipes du store
    for (const team of teamsStore.teams) {
      if (team.members) {
        for (const member of team.members) {
          // Exclure le créateur et ceux déjà dans permissionWrite
          if (member.id !== createdBy) {
            // Éviter les doublons si un membre est dans plusieurs équipes
            if (!list.some((m) => m.id === member.id)) {
              list.push({
                id: member.id,
                label: member.name,
                selected: false,
              });
            }
          }
        }
      }
    }
    return list;
  });

  async function handleAddEmail() {
    if (!emailInput) return;
    const email = emailInput.trim();

    // Vérifier si déjà présent (conceptuellement par email, mais permissionWrite stocke des IDs)
    // Pour simplifier, on vérifie si l'ID correspondant est déjà là (si on le connaît)

    isChecking = true;
    inviteError = null;

    try {
      const { checkUserEmails } =
        await import("$lib/services/appwrite-functions");
      const result = await checkUserEmails([email]);
      const userInfo = result[email];

      if (userInfo) {
        if (permissionWrite?.includes(userInfo.id)) {
          inviteError = "Cet utilisateur a déjà les droits d'écriture.";
        } else {
          permissionWrite = [...(permissionWrite || []), userInfo.id];
          memberNames[userInfo.id] = userInfo.name || email;
          emailInput = "";
          toastService.success(
            `Permission d'édition ajouté pour ${userInfo.name || email}`,
          );
        }
      } else {
        inviteError =
          "Utilisateur introuvable. Seuls les utilisateur·ices inscrit sur enka-cookbook peuvent être ajouté·es. Vous pouvez invitez des personnes depuis votre dashboard";
      }
    } catch (error) {
      console.error("Erreur check email:", error);
      inviteError = "Erreur lors de la vérification de l'email.";
    } finally {
      isChecking = false;
    }
  }

  function toggleMember(memberId: string) {
    if (permissionWrite?.includes(memberId)) {
      permissionWrite = (permissionWrite || []).filter((id) => id !== memberId);
    } else {
      permissionWrite = [...(permissionWrite || []), memberId];
    }
  }

  function removeContributor(id: string) {
    if (id === createdBy) return; // Impossible de supprimer le propriétaire
    permissionWrite = (permissionWrite || []).filter((p) => p !== id);
  }

  function handleCloseInviteModal() {
    showInviteModal = false;
    emailInput = "";
    inviteError = null;
  }
</script>

<Fieldset iconComponent={Users} legend="Permissions">
  <div class="space-y-4">
    <div
      class="alert alert-info alert-soft border-info/20 max-md:alert-vertical text-xs"
    >
      <Info size={16} />
      <span>
        Par défaut, seul l'auteur·ice peut modifier la recette. Les autres
        utilisateur·ices peuvent la consulter ou la dupliquer pour créer leur
        propre version. Ajoutez des collaborateur·ices ici pour leur donner
        explicitement le droit de modifier cette version originale.
      </span>
    </div>

    <div class="flex flex-wrap gap-2">
      <!-- Propriétaire -->
      <div class="badge badge-lg badge-soft badge-info gap-2 p-4">
        <Lock size={14} />
        <span class=""
          >{createdBy
            ? memberNames[createdBy] || "Propriétaire"
            : "Propriétaire"}</span
        >
        <div class="badge badge-xs">Auteur</div>
      </div>

      <!-- Autres collaborateurs -->
      {#each (permissionWrite || []).filter((id) => createdBy !== undefined && id !== createdBy) as contributorId}
        <div
          class="badge badge-lg badge-soft gap-2 p-4"
          transition:fade={{ duration: 200 }}
        >
          <span>{memberNames[contributorId] || contributorId}</span>
          {#if canEdit}
            <button
              class="btn btn-circle btn-xs btn-error btn-ghost ms-2"
              onclick={() => removeContributor(contributorId)}
              title="Retirer les droits"
            >
              <X size={16} />
            </button>
          {/if}
        </div>
      {/each}

      {#if canEdit}
        <button
          class="btn btn-primary btn-sm btn-outline ms-4"
          onclick={() => (showInviteModal = true)}
          title="Gérer les collaborateurs"
        >
          <UserPlus size={18} />
          Ajouter des contributeur·ices
        </button>
      {/if}
    </div>
  </div>
</Fieldset>

<!-- Modal de gestion -->
<ModalContainer isOpen={showInviteModal} onClose={handleCloseInviteModal}>
  <ModalHeader
    title="Gérer les collaborateurs"
    onClose={handleCloseInviteModal}
  ></ModalHeader>

  <ModalContent>
    <div class="space-y-6">
      <!-- Par email -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Ajouter par email</legend>
        <div class="flex gap-2">
          <label class="input input-bordered flex grow items-center gap-2">
            <Mail class="opacity-40" size={18} />
            <input
              type="email"
              class="grow"
              placeholder="utilisateur@email.com"
              bind:value={emailInput}
              onkeydown={(e) => e.key === "Enter" && handleAddEmail()}
            />
          </label>
          <button
            class="btn btn-primary"
            onclick={handleAddEmail}
            disabled={isChecking || !emailInput}
          >
            {#if isChecking}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              Ajouter
            {/if}
          </button>
        </div>
        {#if inviteError}
          <p class="text-error mt-2 flex items-center gap-1 text-xs">
            <ShieldAlert size={14} />
            {inviteError}
          </p>
        {/if}
      </fieldset>

      <div
        class="divider text-xs font-bold tracking-widest uppercase opacity-50"
      >
        Ou via vos équipes
      </div>

      <!-- Par équipe -->
      <div class="space-y-4">
        {#if invitableMembers.length > 0}
          <p class="text-xs opacity-60">
            Sélectionnez des membres de vos équipes pour les ajouter :
          </p>
          <div class="max-h-48 overflow-y-auto pr-2">
            <BtnGroupCheck
              items={invitableMembers}
              onToggleItem={toggleMember}
              size="sm"
            />
          </div>
        {:else if teamsStore.teams.length === 0}
          <p class="py-4 text-center text-sm italic opacity-40">
            Vous n'avez pas encore d'équipe créée.
          </p>
        {:else}
          <p class="py-4 text-center text-sm italic opacity-40">
            Tous les membres de vos équipes sont déjà ajoutés.
          </p>
        {/if}
      </div>
    </div>
  </ModalContent>

  <ModalFooter>
    <button class="btn btn-block btn-primary" onclick={handleCloseInviteModal}>
      Terminer
    </button>
  </ModalFooter>
</ModalContainer>

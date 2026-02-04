<script lang="ts">
  import {
    Users,
    UserPlus,
    Mail,
    Check,
    PencilLine,
    Plus,
    X,
  } from "@lucide/svelte";
  import type { EventContributor } from "$lib/types/events";
  import type { NativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import type { EventsStore } from "$lib/stores/EventsStore.svelte";
  import { nanoid } from "nanoid";
  import { toastService } from "$lib/services/toast.service.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";

  // Interface des props
  interface Props {
    minContrib: number;
    canEdit: boolean;
    contributors: EventContributor[]; // Contributeurs DÉJÀ enregistrés (lecture seule)
    nativeTeamsStore: NativeTeamsStore; // Store des teams natives
    eventsStore: EventsStore;
    userId: string;
    eventId?: string;
    onStartEdit: () => void;
  }

  // Props
  let {
    minContrib = $bindable(),
    canEdit,
    contributors, // Lecture seule - vient du parent via $derived
    nativeTeamsStore,
    eventsStore,
    userId = "",
    eventId = "",
    onStartEdit = () => {}, // TODO : il faudrait un releaseLock pour quand aucun modif n'a été effectivement effectué (qui desactiverait l'auto save tankaf)
  }: Props = $props();

  // État local - géré entièrement dans ce composant
  let selectedTeams = $state<string[]>([]);
  let newContributors = $state<EventContributor[]>([]);
  let sendEmailToExistingMembers = $state(false);

  // État local pour le modal
  let showInviteModal = $state(false);
  let editingMinContrib = $state(false);

  // Synchroniser selectedTeams depuis les teams de l'événement
  $effect(() => {
    if (eventId) {
      const event = eventsStore.getEventById(eventId);
      if (event && event.teams) {
        // event.teams[] contient les NOMS des teams
        // On doit faire un lookup nom→ID depuis nativeTeamsStore
        const teamNames = event.teams || [];
        const teamIds: string[] = [];

        for (const name of teamNames) {
          const team = nativeTeamsStore.teams.find((t) => t.name === name);
          if (team) {
            teamIds.push(team.$id);
          }
        }

        selectedTeams = teamIds;
      }
    }
  });

  // Reset newContributors quand le modal se ferme
  $effect(() => {
    if (!showInviteModal) {
      newContributors = [];
    } else {
      // onStartEdit(); // TODO: relaseLock si pas de modif (close)
    }
  });

  let emailInput = $state("");
  let inviteError = $state<string | null>(null);

  // Groupes de contributeurs pour l'affichage
  let acceptedContributors = $derived(
    contributors.filter((c) => c.status === "accepted"),
  );
  let invitedContributors = $derived(
    contributors.filter((c) => c.status === "invited"),
  );
  let declinedContributors = $derived(
    contributors.filter((c) => c.status === "declined"),
  );

  // Vérifier si l'utilisateur courant peut se désinscrire
  let canUserUnregister = $derived(
    contributors.some((c) => c.id === userId && c.status === "accepted"),
  );

  let canUserBack = $derived(
    contributors.some((c) => c.id === userId && c.status === "declined"),
  );

  // Fonction pour toggle une team
  function toggleTeam(teamId: string) {
    if (selectedTeams.includes(teamId)) {
      selectedTeams = selectedTeams.filter((id) => id !== teamId);
    } else {
      selectedTeams = [...selectedTeams, teamId];
    }
  }

  // Ajouter par email (simplifié - la cloud function gère la vérification)
  function handleAddEmail() {
    if (!emailInput) return;
    const email = emailInput.trim();

    // Vérif doublons LOCALEMENT uniquement
    if (
      contributors.some((c) => c.email === email) ||
      newContributors.some((c) => c.email === email)
    ) {
      inviteError = "Cet email est déjà invité.";
      return;
    }

    inviteError = null;

    // Ajouter simplement l'email - la cloud function fera la distinction
    const newContributor: EventContributor = {
      id: nanoid(), // ID temporaire
      email: email,
      status: "invited",
      invitedAt: new Date().toISOString(),
    };

    newContributors = [...newContributors, newContributor];
    emailInput = "";
  }

  // Fonction pour valider et envoyer les invitations
  async function validateInvitations() {
    if (!eventId) {
      toastService.error("ID d'événement manquant");
      return;
    }

    const event = eventsStore.getEventById(eventId);
    if (!event) throw new Error("Événement introuvable");

    // 1. Traiter les teams à ajouter
    // Filtrer les teams qui ne sont pas encore dans event.teams[]
    const teamsToAdd = selectedTeams.filter((teamId) => {
      const team = nativeTeamsStore.teams.find((t) => t.$id === teamId);
      if (!team) return false;
      return !event.teams?.includes(team.name);
    });

    // 2. Traiter les utilisateurs individuels (par email)
    const emails = newContributors.map((c) => c.email!).filter(Boolean);

    // ✅ CRITIQUE : Validation AVANT d'appeler la cloud function
    // Empêche l'erreur "Au moins un email ou un userId est requis"
    if (teamsToAdd.length === 0 && emails.length === 0) {
      toastService.warning(
        "Sélectionnez au moins une équipe ou entrez un email",
      );
      return;
    }

    // ✅ Utiliser la fonction unifiée (atomicité)
    try {
      await toastService.track(
        eventsStore.inviteParticipants(eventId, {
          teamIds: teamsToAdd,
          emails: emails,
          sendEmailToExistingMembers: sendEmailToExistingMembers,
        }),
        {
          loading: "Envoi des invitations en cours...",
          success: `invitation envoyé avec succès`,
          error: "Erreur lors de l'envoi des invitations",
        },
      );

      // Fermer le modal
      showInviteModal = false;
      newContributors = [];
      // Ne PAS reset selectedTeams, il sera resynchronisé par $effect
    } catch (error) {
      console.error("Erreur lors de l'envoi des invitations:", error);
      // Le toast d'erreur est déjà géré par toastService.track
      // ✅ NE PAS réinitialiser le form en cas d'erreur - laisser l'utilisateur réessayer
    }
  }

  function handleCloseInviteModal() {
    showInviteModal = false;
    emailInput = "";
    inviteError = null;
  }

  // Calculer les teams à ajouter (non encore présentes dans l'événement)
  let pendingTeams = $derived(() => {
    if (!eventId) return [];
    const event = eventsStore.getEventById(eventId);
    if (!event) return [];

    return selectedTeams.filter((teamId) => {
      const team = nativeTeamsStore.teams.find((t) => t.$id === teamId);
      if (!team) return false;
      return !event.teams?.includes(team.name);
    });
  });

  // Fonction de désinscription (change le statut en "declined")
  async function handleUnregister() {
    if (!eventId || !userId) return;

    const confirmed = confirm(
      "Êtes-vous sûr de vouloir vous désinscrire de cet événement ?",
    );
    if (!confirmed) return;

    try {
      await toastService.track(
        eventsStore.updateContributorStatus(eventId, userId, "declined"),
        {
          loading: "Désinscription en cours...",
          success: "Vous avez été désinscrit de l'événement",
          error: "Erreur lors de la désinscription",
        },
      );
    } catch (error) {
      console.error("Erreur lors de la désinscription:", error);
    }
  }

  async function handleBack() {
    try {
      await toastService.track(
        eventsStore.updateContributorStatus(eventId, userId, "accepted"),
        {
          loading: "Désinscription en cours...",
          success: "Vous avez été désinscrit de l'événement",
          error: "Erreur lors de la désinscription",
        },
      );
    } catch (error) {
      console.error("Erreur lors de la désinscription:", error);
    }
  }
</script>

<Fieldset legend="Participants">
  <!-- Équipe minimale -->
  <fieldset class="fieldset mb-4">
    {#if editingMinContrib}
      <label class="input w-56">
        <span class="label">Minimum</span>
        <input
          type="number"
          bind:value={minContrib}
          onfocus={onStartEdit}
          onblur={() => (editingMinContrib = false)}
          disabled={!canEdit}
          min="1"
          defaultValue={1}
          class="grow"
          id="min-contrib-input"
        />
      </label>
    {:else}
      <button
        class="btn justify-start"
        onclick={() => {
          editingMinContrib = true;
          setTimeout(() => {
            document.getElementById("min-contrib-input")?.focus();
          }, 50);
        }}
        disabled={!canEdit}
      >
        <div class="flex items-center gap-4">
          <span class="label">minimum</span>

          <span class="text-lg">
            {minContrib || 1}
          </span>
          <PencilLine class="h-4 w-4" />
        </div>
      </button>
    {/if}
    <div class="fieldset-label ms-1">
      Combien faudrait-il être pour tout gérer ?
    </div>
  </fieldset>

  <!-- Participants (Déjà enregistrés) -->
  <div class="mb-6">
    <div class="space-y-4">
      <!-- Teams déjà invitées -->
      {#if eventId}
        {@const event = eventsStore.getEventById(eventId)}
        {#if event && event.teams && event.teams.length > 0}
          <fieldset class="fieldset">
            <legend class="legend">Équipes invitées</legend>
            <div class="flex flex-wrap gap-2">
              {#each event.teams as teamName}
                <div class="badge badge-primary badge-soft badge-lg gap-2 p-3">
                  <Users class="inline size-4" />
                  <span class="font-medium">{teamName}</span>
                </div>
              {/each}
            </div>
          </fieldset>
        {/if}
      {/if}

      <!-- Accepted -->
      {#if acceptedContributors.length > 0}
        <fieldset class="fieldset">
          <legend class="legend">Participant confirmé</legend>

          <div class="flex flex-wrap gap-2">
            {#each acceptedContributors as contributor (contributor.id)}
              <div class="badge badge-soft badge-success gap-2 p-3">
                <span class="font-medium"
                  >{contributor.name || contributor.email}</span
                >
              </div>
            {/each}
            {#if canUserUnregister}
              <!-- Bouton de désinscription pour l'utilisateur courant -->
              {#if canEdit}
                <button
                  class="link link-error"
                  onclick={handleUnregister}
                  title="Se désinscrire"
                >
                  Se désinscrire
                </button>
              {/if}
            {/if}
          </div>
        </fieldset>
      {/if}

      <!-- Invited -->
      {#if invitedContributors.length > 0}
        <fieldset class="fieldset">
          <legend class="text-base-content/70 text-sm font-medium"
            >Invité·es</legend
          >
          <div class="flex flex-wrap gap-2">
            {#each invitedContributors as contributor (contributor.id)}
              <div class="badge badge-warning badge-soft gap-2 p-3">
                <span class="font-medium"
                  >{contributor.name || contributor.email}</span
                >
              </div>
            {/each}
          </div>
        </fieldset>
      {/if}

      <!-- Declined -->
      {#if declinedContributors.length > 0}
        <fieldset class="fieldset">
          <legend class="text-base-content/70 text-sm font-medium"
            >ne participent pas</legend
          >
          <div class="flex flex-wrap items-center gap-2">
            {#each declinedContributors as contributor (contributor.id)}
              <div class="badge badge-error badge-soft gap-2 p-3">
                <span class="font-medium"
                  >{contributor.name || contributor.email}</span
                >
              </div>
            {/each}
            {#if canUserBack}
              <button class="link" onclick={() => handleBack()}
                >je participe</button
              >
            {/if}
          </div>
        </fieldset>
      {/if}
    </div>
  </div>

  <!-- N'afficher le composant que si eventId est défini -->
  {#if eventId}
    <!-- Bouton pour ouvrir le modal d'invitation -->
    <div class="my-2">
      <button
        class="btn btn-primary btn-outline btn-block gap-1"
        onclick={() => (showInviteModal = true)}
      >
        <UserPlus class="mr-2 h-4 w-4" />
        Inviter des participant·es
      </button>
    </div>
  {/if}
</Fieldset>

<!-- Modal d'invitation -->
<ModalContainer isOpen={showInviteModal} onClose={handleCloseInviteModal}>
  <ModalHeader
    title="Inviter des participants"
    onClose={handleCloseInviteModal}
  />

  <ModalContent>
    <div class="space-y-6">
      <!-- Invitation par email -->
      <fieldset class="fieldset">
        <legend class="legend">Par email</legend>
        <div class="flex gap-2">
          <label class="input flex items-center gap-2">
            <Mail class="h-4 w-4 opacity-70" />
            <input
              type="email"
              class="grow"
              placeholder="email@exemple.com"
              bind:value={emailInput}
              onkeydown={(e) => e.key === "Enter" && handleAddEmail()}
            />
          </label>
          <button
            class="btn btn-primary"
            onclick={handleAddEmail}
            disabled={!emailInput}
          >
            <Plus class="h-4 w-4 opacity-70" />
            Ajouter
          </button>
        </div>
        {#if inviteError}
          <p class="text-error mt-1 text-xs">{inviteError}</p>
        {/if}

        <div>
          {#each newContributors as contributor}
            <p>{contributor.email}</p>
          {/each}
        </div>
      </fieldset>

      <div class="divider">OU</div>

      <!-- Sélection des teams NATIVES -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend"
          ><Users size={16} class="inline shrink-0 opacity-60" /> Inviter des équipes
          entières</legend
        >

        {#if eventId}
          {@const event = eventsStore.getEventById(eventId)}
          {#if event && event.teams && event.teams.length > 0}
            <!-- Teams déjà invitées -->
            <div class="mb-4">
              <p class="mb-2 text-sm font-medium opacity-70">
                Équipes déjà invitées :
              </p>
              <div class="flex flex-wrap gap-2">
                {#each event.teams as teamName}
                  <div class="badge badge-primary badge-soft badge-lg">
                    <Users class="inline size-4" />{teamName}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        {#if nativeTeamsStore.myTeams.length > 0}
          <!-- Filtrer les teams déjà invitées -->
          {@const availableTeams = nativeTeamsStore.myTeams.filter((team) => {
            if (!eventId) return true;
            const event = eventsStore.getEventById(eventId);
            if (!event || !event.teams) return true;
            return !event.teams.includes(team.name);
          })}

          {#if availableTeams.length > 0}
            <div class="flex flex-wrap gap-4">
              {#each availableTeams as team}
                <label
                  class="hover:bg-secondary/20 bg-secondary/10 flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2 transition-colors"
                >
                  <input
                    type="checkbox"
                    class="checkbox bg-base-100 checkbox-sm"
                    checked={selectedTeams.includes(team.$id)}
                    onchange={() => toggleTeam(team.$id)}
                  />
                  <div class="flex flex-col">
                    <span class="text-sm font-medium"
                      >{team.name}
                      <span class="text-xs opacity-60"
                        >{team.total} membre{team.total > 1 ? "s" : ""}</span
                      ></span
                    >
                    <div class="text-xs opacity-70">
                      {nativeTeamsStore.getTeamMemberNames(team.$id).join(", ")}
                    </div>
                  </div>
                </label>
              {/each}
            </div>

            <!-- ✅ NOUVEAU: Contrôle de l'envoi d'emails aux membres existants -->
            {#if selectedTeams.length > 0}
              <label class="mt-4 cursor-pointer justify-center gap-4">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  bind:checked={sendEmailToExistingMembers}
                />
                <span class="font-base ms-1">
                  Envoyer un email de notification
                </span>
              </label>
              <p class="text-base-content/60 mt-1 text-xs">
                Si désactivé, les membres auront accès à l'événement mais ne
                recevront pas d'email. Les personnes invitées n'ayant pas de
                compte recevront toujours un email pour la création de leur
                compte.
              </p>
            {/if}
          {:else}
            <p class="text-sm italic opacity-60">
              Toutes vos équipes sont déjà invitées.
            </p>
          {/if}
        {:else}
          <p class="text-sm italic opacity-60">
            Vous ne faites partie d'aucune équipe. Créez une équipe pour inviter
            plusieurs personnes.
          </p>
        {/if}
      </fieldset>
    </div>
  </ModalContent>

  <ModalFooter>
    <button class="btn" onclick={handleCloseInviteModal}>Annuler</button>
    <button
      class="btn btn-primary"
      onclick={validateInvitations}
      disabled={newContributors.length === 0 && pendingTeams().length === 0}
    >
      <Check class="mr-2 h-4 w-4" />
      Inviter
      {#if pendingTeams().length > 0 || newContributors.length > 0}
        ({pendingTeams().length + newContributors.length})
      {/if}
    </button>
  </ModalFooter>
</ModalContainer>

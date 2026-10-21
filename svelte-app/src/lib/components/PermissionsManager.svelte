<script lang="ts">
  import { onMount } from "svelte";
  import {
    Users,
    UserPlus,
    Mail,
    Check,
    PencilLine,
    Plus,
    X,
    Link as LinkIcon,
    Copy,
    RefreshCw,
    Info,
  } from "@lucide/svelte";
  import type { EventContributor } from "$lib/types/events";
  import type { NativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import type { EventsStore } from "$lib/stores/EventsStore.svelte";
  import { nanoid } from "nanoid";
  import { toastService } from "$lib/services/toast.service.svelte";
  import {
    getOrCreateShareLink,
    getEventShareLinks,
    regenerateShareLink,
  } from "$lib/services/pb-invitations";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
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
  let checkedEmails = $state<string[]>([]);
  let newContributors = $state<EventContributor[]>([]);

  // État local pour le modal
  let showInviteModal = $state(false);
  let showInviteConfirm = $state(false);
  let showRegenerateConfirm = $state(false);
  let editingMinContrib = $state(false);

  type TeamMember = NonNullable<
    ReturnType<NativeTeamsStore["getTeamById"]>
  >["members"][number];

  /** L'accès de ce membre est déjà actif, quel que soit le canal
   * d'invitation : invité individuel (guestUsers ou registre) ou membre
   * d'une équipe invitée. Affiché cochés-verrouillés — l'invitation est
   * irrévocable, l'UI ne prétend pas désinviter. */
  function isAlreadyInvited(member: TeamMember): boolean {
    const event = eventId ? eventsStore.getEventById(eventId) : null;
    if (!event) return false;
    if (member.userId && event.guestUsers?.includes(member.userId)) return true;
    if (
      member.userEmail &&
      contributors.some(
        (c) => c.email?.toLowerCase() === member.userEmail!.toLowerCase(),
      )
    ) {
      return true;
    }
    const invitedTeamIds = new Set(
      (event.teams ?? [])
        .map((name) => nativeTeamsStore.teams.find((t) => t.name === name)?.id)
        .filter(Boolean),
    );
    for (const teamId of invitedTeamIds) {
      const team = nativeTeamsStore.getTeamById(teamId as string);
      if (team?.members?.some((m) => m.userId === member.userId)) return true;
    }
    return false;
  }

  /** Membres encore invitable de l'équipe (les déjà invités sont verrouillés). */
  function invitableMembers(teamId: string): TeamMember[] {
    const team = nativeTeamsStore.getTeamById(teamId);
    return (team?.members ?? []).filter((m) => !isAlreadyInvited(m));
  }

  /** Équipes affichées dans le picker : pas déjà invitées comme équipe, et
   * avec au moins un membre invitable (tous verrouillés = déjà couverte). */
  let pickerTeams = $derived.by(() => {
    if (!eventId) return [];
    const event = eventsStore.getEventById(eventId);
    const invitedNames = new Set(event?.teams ?? []);
    return nativeTeamsStore.myTeams.filter(
      (team) =>
        !invitedNames.has(team.name) && invitableMembers(team.id).length > 0,
    );
  });

  /** Une équipe cochée « entière » (tous ses membres invitable cochés — les
   * déjà invités, verrouillés-cochés, ont déjà leur accès) écrit le grant
   * équipe : les futurs membres hériteront. */
  function isFullTeam(teamId: string): boolean {
    const invitable = invitableMembers(teamId);
    return (
      invitable.length > 0 &&
      invitable.every((m) => checkedEmails.includes(m.userEmail!))
    );
  }

  let fullTeamIds = $derived(
    pickerTeams.filter((t) => isFullTeam(t.id)).map((t) => t.id),
  );

  function toggleMember(member: TeamMember) {
    const email = member.userEmail!;
    if (checkedEmails.includes(email)) {
      checkedEmails = checkedEmails.filter((e) => e !== email);
    } else {
      checkedEmails = [...checkedEmails, email];
    }
  }

  function toggleWholeTeam(teamId: string) {
    const invitable = invitableMembers(teamId);
    if (isFullTeam(teamId)) {
      // Décocher l'équipe retire seulement ses membres à nous
      checkedEmails = checkedEmails.filter(
        (email) => !invitable.some((m) => m.userEmail === email),
      );
    } else {
      const additions = invitable
        .map((m) => m.userEmail!)
        .filter((email) => !checkedEmails.includes(email));
      checkedEmails = [...checkedEmails, ...additions];
    }
  }

  // Reset la sélection quand le modal se ferme
  $effect(() => {
    if (!showInviteModal) {
      newContributors = [];
      checkedEmails = [];
      showInviteConfirm = false;
    } else {
      // onStartEdit(); // TODO: relaseLock si pas de modif (close)
    }
  });

  let emailInput = $state("");
  let inviteError = $state<string | null>(null);
  let isGenerating = $state(false);
  let shareLinkIds = $state<string[]>([]);

  async function loadShareLinks() {
    if (!eventId || !userId) return;
    try {
      let links = await getEventShareLinks(eventId);
      if (links.length === 0) {
        // Chaque event porte son lien dès la création ; le get-or-create
        // rattrape aussi les events créés avant cette garantie
        const link = await getOrCreateShareLink(eventId, userId);
        links = [link.id];
      }
      shareLinkIds = links;
    } catch {
      shareLinkIds = [];
    }
  }

  onMount(() => {
    loadShareLinks();
  });

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

  /** Sélection courante → payload d'invitation (règle actée : équipe entière
   * vs partiel). Utilisé par le compteur du footer et par la validation. */
  function buildInvitationPayload(): {
    teamIds: string[];
    emails: string[];
    notifyEmails: string[];
  } {
    // Règle d'écriture actée : une équipe entièrement cochée passe par le
    // canal équipe (futurs membres hériteront) ; une équipe partiellement
    // cochée passe par ses seuls membres cochés, en individuel. Les membres
    // des équipes entières reçoivent l'email groupé sans être écrits
    // individuellement (notifyEmails).
    const fullTeams = fullTeamIds;

    const fullTeamEmails = new Set(
      fullTeams.flatMap((teamId) =>
        invitableMembers(teamId)
          .map((m) => m.userEmail?.toLowerCase())
          .filter(Boolean),
      ),
    );
    const partialEmails = checkedEmails.filter(
      (email) => !fullTeamEmails.has(email.toLowerCase()),
    );
    const manualEmails = newContributors.map((c) => c.email!).filter(Boolean);
    const emails = [...new Set([...partialEmails, ...manualEmails])];
    const notifyEmails = [
      ...new Set([
        ...emails,
        ...fullTeams.flatMap((teamId) =>
          invitableMembers(teamId)
            .map((m) => m.userEmail!)
            .filter(Boolean),
        ),
      ]),
    ];

    return { teamIds: fullTeams, emails, notifyEmails };
  }

  /** Nombre de personnes qui recevront l'email groupé. */
  let pendingCount = $derived(buildInvitationPayload().notifyEmails.length);

  // Fonction pour valider et envoyer les invitations
  async function validateInvitations() {
    if (!eventId) {
      toastService.error("ID d'événement manquant");
      return;
    }

    const payload = buildInvitationPayload();

    // ✅ CRITIQUE : Validation AVANT d'appeler l'invitation
    if (payload.teamIds.length === 0 && payload.emails.length === 0) {
      toastService.warning(
        "Sélectionnez au moins une équipe ou entrez un email",
      );
      return;
    }

    try {
      await toastService.track(
        eventsStore.inviteParticipants(eventId, payload),
        {
          loading: "Envoi des invitations en cours...",
          error: "Erreur lors de l'envoi des invitations",
        },
      );

      // Fermer le modal
      showInviteModal = false;
      newContributors = [];
      checkedEmails = [];
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
          loading: "Inscription en cours...",
          success: "Vous participez à l'événement",
          error: "Erreur lors de l'inscription",
        },
      );
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
    }
  }

  async function handleRegenerateLink() {
    if (!userId || !eventId) return;
    try {
      isGenerating = true;
      // Désactive tous les liens actifs (les usages passés ne sont pas
      // rappelés) puis crée le remplaçant
      await regenerateShareLink(eventId, userId);
      toastService.success("Nouveau lien généré — l'ancien est désactivé");
      await loadShareLinks();
    } catch (e: any) {
      toastService.error(e.message || "Erreur lors de la régénération du lien");
    } finally {
      isGenerating = false;
    }
  }

  function copyToClipboard(linkId: string) {
    const url = `${window.location.origin}/join/${linkId}`;
    navigator.clipboard.writeText(url).then(() => {
      toastService.success("Lien copié dans le presse-papier !");
    });
  }
</script>

<Fieldset legend="Participants">
  <!-- Équipe minimale -->
  <fieldset class="mb-4 fieldset">
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
    <div class="ms-1 fieldset-label">
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
              {#each nativeTeamsStore.teamNames(event.teams) as teamName}
                <div class="badge gap-2 badge-soft p-3 badge-lg badge-primary">
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
              <div class="badge gap-2 badge-soft p-3 badge-success">
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
          <legend class="text-sm font-medium text-base-content/70"
            >Invité·es</legend
          >
          <div class="flex flex-wrap gap-2">
            {#each invitedContributors as contributor (contributor.id)}
              <div class="badge gap-2 badge-soft p-3 badge-warning">
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
          <legend class="text-sm font-medium text-base-content/70"
            >ne participent pas</legend
          >
          <div class="flex flex-wrap items-center gap-2">
            {#each declinedContributors as contributor (contributor.id)}
              <div class="badge gap-2 badge-soft p-3 badge-error">
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
  {#if eventId && canEdit}
    <!-- Bouton pour ouvrir le modal d'invitation (pouvoir d'éditeur) -->
    <div class="my-2">
      <button
        class="btn btn-block gap-1 btn-outline btn-primary"
        onclick={() => (showInviteModal = true)}
      >
        <UserPlus class="mr-2 h-4 w-4" />
        Inviter des participant·es
      </button>
    </div>
  {/if}

  <!-- Section Lien de partage (pouvoir d'éditeur : lecture, copie, régénération) -->
  {#if eventId && canEdit}
    <div class="divider"></div>

    <div class="flex items-center gap-2 text-base font-medium">
      <LinkIcon class="inline size-4 shrink-0" /> Lien de partage
    </div>

    <div class="mt-6 alert alert-info">
      <div class="text-sm">
        <p>
          Le lien permet de rejoindre l'événement en tant qu'invité — les
          personnes qui l'utilisent reçoivent une invitation et confirment
          ensuite leur participation. Partagez-le uniquement avec des personnes
          de confiance : il reste valable jusqu'à régénération.
        </p>
      </div>
    </div>

    <!-- Liste des liens déjà générés (chargée depuis la collection share_links) -->
    {#if shareLinkIds.length > 0}
      <div class="mt-4 space-y-2">
        {#each shareLinkIds as linkId (linkId)}
          <div
            class="flex items-center justify-between gap-2 rounded-md bg-base-200 p-2"
          >
            <div
              class="flex-1 overflow-auto font-mono text-xs text-base-content/80"
            >
              {window.location.origin}/join/{linkId}
            </div>
            <button
              class="btn btn-ghost text-primary btn-xs"
              aria-label="Copier"
              title="Copier le lien"
              onclick={() => copyToClipboard(linkId)}
            >
              <Copy class="h-4 w-4" />
            </button>
          </div>
        {/each}
      </div>
      <button
        class="btn mt-4 w-full btn-outline btn-warning"
        onclick={() => (showRegenerateConfirm = true)}
        disabled={isGenerating}
      >
        {#if isGenerating}
          <span
            class="loading hidden loading-xs loading-spinner md:inline-block"
          ></span>
          Régénération...
        {:else}
          <RefreshCw class="mr-1 h-4 w-4" />
          Régénérer le lien
        {/if}
      </button>
    {:else}
      <p class="mt-2 py-4 text-sm text-base-content/50 italic">
        Lien de partage indisponible — réessayez en rouvrant cette page.
      </p>
    {/if}
  {/if}
</Fieldset>

<!-- Modal d'invitation dégroupé : membres cochables individuellement -->
<ModalContainer isOpen={showInviteModal} onClose={handleCloseInviteModal}>
  <ModalHeader
    title="Inviter des participants"
    onClose={handleCloseInviteModal}
  />

  <ModalContent>
    <div class="space-y-6">
      <!-- En-tête explicatif : les effets avant la validation -->
      <div class="alert alert-soft text-sm alert-info">
        <Info class="h-5 w-5 shrink-0" />
        <span>
          Un email groupé avec le lien de participation sera envoyé aux
          personnes cochées — l'invitation est irrévocable. Une équipe
          entièrement cochée accorde l'accès à ses futurs membres ; cochée
          partiellement, seuls ses membres cochés sont invités. Les invités
          voient l'événement et confirment ensuite leur participation.
        </span>
      </div>

      <!-- Invitation par email -->
      <fieldset class="fieldset">
        <legend class="legend">Par email (sans compte)</legend>
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
          <p class="mt-1 text-xs text-error">{inviteError}</p>
        {/if}

        <div class="flex flex-wrap gap-2">
          {#each newContributors as contributor (contributor.email)}
            <div class="badge gap-2 badge-soft badge-warning">
              <Mail class="inline size-3" />
              {contributor.email}
            </div>
          {/each}
        </div>
      </fieldset>

      <div class="divider">OU</div>

      <!-- Picker dégroupé : membres cochables individuellement -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend">
          <Users class="inline size-4 shrink-0 opacity-60" /> Inviter depuis vos équipes
        </legend>

        {#if eventId}
          {@const event = eventsStore.getEventById(eventId)}
          {#if event && event.teams && event.teams.length > 0}
            <!-- Équipes déjà invitées (grant équipe en place) -->
            <div class="mb-4">
              <p class="mb-2 text-sm font-medium opacity-70">
                Équipes déjà invitées :
              </p>
              <div class="flex flex-wrap gap-2">
                {#each nativeTeamsStore.teamNames(event.teams) as teamName}
                  <div class="badge badge-soft badge-lg badge-primary">
                    <Users class="inline size-4" />{teamName}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        {#if pickerTeams.length > 0}
          <div class="space-y-4">
            {#each pickerTeams as team (team.id)}
              <div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
                <!-- Header d'équipe : tout cocher / décocher -->
                <label class="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    class="checkbox bg-base-100 checkbox-sm"
                    checked={isFullTeam(team.id)}
                    onchange={() => toggleWholeTeam(team.id)}
                  />
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">
                      {team.name}
                      <span class="text-xs opacity-60"
                        >{team.total} membre{team.total > 1 ? "s" : ""}</span
                      >
                    </span>
                    {#if isFullTeam(team.id)}
                      <span class="text-xs text-success">
                        Équipe entière — les futurs membres hériteront
                      </span>
                    {/if}
                  </div>
                </label>

                <!-- Membres cochables un par un ; déjà invités verrouillés -->
                <div class="mt-3 space-y-1 ps-6">
                  {#each team.members as member (member.userId)}
                    <label
                      class="flex items-center gap-2
                        {isAlreadyInvited(member)
                        ? 'cursor-not-allowed opacity-70'
                        : 'cursor-pointer'}"
                    >
                      <input
                        type="checkbox"
                        class="checkbox bg-base-100 checkbox-xs"
                        checked={isAlreadyInvited(member) ||
                          checkedEmails.includes(member.userEmail!)}
                        disabled={isAlreadyInvited(member)}
                        onchange={() => toggleMember(member)}
                      />
                      <span class="text-sm"
                        >{member.name || member.userEmail}</span
                      >
                      {#if isAlreadyInvited(member)}
                        <span class="text-xs text-base-content/50 italic"
                          >accès actif</span
                        >
                      {/if}
                    </label>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {:else if nativeTeamsStore.myTeams.length > 0}
          <p class="text-sm italic opacity-60">
            Tous les membres de vos équipes ont déjà un accès actif à cet
            événement.
          </p>
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
      onclick={() => (showInviteConfirm = true)}
      disabled={pendingCount === 0}
    >
      <Check class="mr-2 h-4 w-4" />
      Inviter
      {#if pendingCount > 0}({pendingCount}){/if}
    </button>
  </ModalFooter>
</ModalContainer>

<!-- Confirmation avant validation : l'email groupé part, l'invitation est
     irrévocable (le lien ne se rappelle pas) -->
<ConfirmModal
  isOpen={showInviteConfirm}
  title="Confirmer l'invitation"
  message="Un email avec le lien de participation sera envoyé à {pendingCount}
    personne(s). L'invitation est irrévocable — le lien reste valable."
  variant="warning"
  confirmLabel="Envoyer l'invitation"
  onConfirm={validateInvitations}
  onCancel={() => (showInviteConfirm = false)}
/>

<!-- Confirmation avant régénération : l'ancien lien cesse de fonctionner -->
<ConfirmModal
  isOpen={showRegenerateConfirm}
  title="Régénérer le lien de partage"
  message="L'ancien lien cessera immédiatement de fonctionner : les personnes
    qui l'ont reçu ne pourront plus l'utiliser. Continuer ?"
  variant="warning"
  confirmLabel="Régénérer"
  onConfirm={() => {
    showRegenerateConfirm = false;
    handleRegenerateLink();
  }}
  onCancel={() => (showRegenerateConfirm = false)}
/>

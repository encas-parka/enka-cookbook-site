<script lang="ts">
  import {
    CheckCircle,
    Mail,
    UserPlus,
    X,
    XCircle,
    AlertCircle,
    Info,
  } from "@lucide/svelte";
  import Suggestions from "$lib/components/ui/Suggestions.svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import type { EnrichedNativeTeam as EnrichedTeam } from "$lib/types/aw_native_team.d";
  import { isValidEmail } from "@/lib/utils/utils";
  import { toastService } from "$lib/services/toast.service.svelte";
  import InfoCollapse from "../ui/InfoCollapse.svelte";
  import { globalState } from "@/lib/stores/GlobalState.svelte";
  interface Props {
    team: EnrichedTeam;
    invitedEmails?: string[];
    customMessage?: string;
    role?: string;
    loading?: boolean;
  }

  let {
    team,
    invitedEmails = $bindable([]),
    customMessage = $bindable(""),
    loading = false,
    role = $bindable("member"),
  }: Props = $props();

  // État local pour l'input d'email courant
  let emailInput = $state("");
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  const isOwner = $derived(globalState.isTeamOwner(team.$id));

  // Ajouter un email à la liste
  function addEmail() {
    const trimmedEmail = emailInput.trim().toLowerCase();

    if (!trimmedEmail) {
      error = "Veuillez entrer une adresse email";
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      error = "Adresse email invalide";
      return;
    }

    // Vérifier si déjà dans la liste
    if (invitedEmails.includes(trimmedEmail)) {
      error = "Cet email est déjà dans la liste";
      return;
    }

    // Vérifier si déjà membre ou déjà invité (on renvoie quand meme)
    // const alreadyStatus = team.members.some(
    //   (m) =>
    //     m.name.toLowerCase() === trimmedEmail ||
    //     m.userEmail.toLowerCase() === trimmedEmail,
    // );
    // if (alreadyStatus) {
    //   error = "Cette personne est déjà membre ou invitée dans l'équipe";
    //   return;
    // }

    invitedEmails.push(trimmedEmail);
    emailInput = "";
    error = null;
  }

  // Retirer un email de la liste
  function removeEmail(email: string) {
    invitedEmails = invitedEmails.filter((e) => e !== email);
  }

  // Gestion de la touche Entrée
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  }
</script>

<!-- TODO : toast.service lorsqu'invitation réussi, (et fermeture du modal ?) -->

<div class="@container space-y-4">
  <div class="alert alert-soft alert-info @max-lg:alert-vertical">
    <Info class="h-6 w-6 shrink-0 self-baseline" />
    <div>
      <p>
        Envoyez des invitations aux personnes qui font partie de votre cantine.
        Si elles possèdent déjà un compte enka-cookbook, elles pourront
        directement acceder aux événements de l'équipe, sinon, elles recevrons
        un lien pour créer leur compte.
      </p>
      <p>
        Il est aussi possible d'inviter des personnes individuellement à
        participer aux évenements (depuis les pages d'évenements), même si elles
        ne font pas partie de vos équipes.
      </p>
    </div>
  </div>
  <!-- Message de succès -->
  {#if successMessage}
    <div class="alert alert-success">
      <CheckCircle class="h-6 w-6 shrink-0" />
      <span>{successMessage}</span>
    </div>
  {/if}

  <!-- Message d'erreur général -->
  {#if error}
    <div class="alert alert-error">
      <XCircle class="h-6 w-6 shrink-0" />
      <span>{error}</span>
    </div>
  {/if}
  <!-- Input email avec bouton d'ajout -->
  <div class="rounded-box bg-base-200 flex flex-col gap-2 p-4">
    <div class="flex flex-wrap gap-2">
      <label class="input min-w-56 flex-1 gap-2">
        <Mail class="h-4 w-4 opacity-50" />
        <input
          type="email"
          bind:value={emailInput}
          placeholder="email@example.com"
          disabled={loading}
          onkeydown={handleKeydown}
        />
      </label>
      {#if isOwner}
        <label for="" class="select">
          <span class="label">Rôle</span>
          <select class="select" bind:value={role}>
            <option value="member" class="flex" selected>Membre</option>
            <option value="owner">Administrateur</option>
          </select>
        </label>
      {/if}
    </div>
    <div class="fieldset-label text-xs {!isOwner && 'hidden'}">
      Les administrateur·ices sont seul·es autorisé·es à modifier les
      informations concernant l'équipe et à supprimer des membres.
    </div>
    <button
      class="btn btn-primary btn-sm ml-auto w-fit"
      onclick={addEmail}
      disabled={loading || !emailInput.trim()}
      title="Ajouter à la liste"
    >
      <UserPlus class=" h-5 w-5" />
      Ajouter
    </button>
  </div>

  <!-- Liste des emails ajoutés -->
  {#if invitedEmails.length > 0}
    <div>
      <div class="mb-2 text-sm font-medium opacity-70">
        Personnes à inviter ({invitedEmails.length})
      </div>
      <div class="flex flex-wrap gap-2">
        {#each invitedEmails as email (email)}
          <div class="badge badge-primary badge-lg gap-2">
            <Mail class="h-3 w-3" />
            {email}
            <button
              class="btn btn-circle btn-ghost btn-xs"
              onclick={() => removeEmail(email)}
              disabled={loading}
              title="Retirer"
            >
              <X class="h-3 w-3" />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Message personnalisé -->
  <div>
    <label class="label" for="invite-message">
      <span class="label-text">Message personnalisé (optionnel)</span>
    </label>
    <textarea
      id="invite-message"
      class="textarea textarea-bordered w-full"
      bind:value={customMessage}
      placeholder="Ajoutez un message pour les personnes invitées..."
      rows="3"
      maxlength="200"
      disabled={loading}
    ></textarea>
    <span class="label label-text-alt opacity-50"
      >{customMessage.length}/200 caractères</span
    >
  </div>
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { pb } from "$lib/db-sync/pb-sync";
  import { navigate, route } from "$lib/router";

  import {
    AlertCircle,
    Check,
    ArrowLeft,
    KeyRound,
    Loader2,
  } from "@lucide/svelte";

  // États
  let isLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let isValidLink = $state(false);
  let isProcessing = $state(true);
  let token = $state("");

  // Récupérer userId et secret depuis l'URL via sv-router
  onMount(() => {
    navBarStore.reset();
    token = typeof route.search.token === "string" ? route.search.token : "";
    validateRecoveryLink();
  });

  // Valider le lien
  async function validateRecoveryLink() {
    if (!token) {
      errorMessage = "Lien de réinitialisation invalide ou manquant.";
      isValidLink = false;
      isProcessing = false;
      return;
    }

    isValidLink = true;
    isProcessing = false;
  }

  async function handleResetPassword(event: Event) {
    event.preventDefault();

    // Guard : vérifier que le lien est valide
    if (!token || !isValidLink) {
      errorMessage = "Lien de réinitialisation invalide.";
      return;
    }

    if (!newPassword || !confirmPassword) {
      errorMessage = "Veuillez remplir tous les champs";
      return;
    }

    if (newPassword !== confirmPassword) {
      errorMessage = "Les mots de passe ne correspondent pas.";
      return;
    }

    if (newPassword.length < 8) {
      errorMessage = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }

    isLoading = true;
    errorMessage = "";

    try {
      await pb
        .collection("users")
        .confirmPasswordReset(token, newPassword, newPassword);

      successMessage = "Mot de passe réinitialisé avec succès !";

      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    } catch (error: any) {
      console.error("Erreur réinitialisation:", error);
      if (
        error.status === 400 ||
        error.message?.includes("Invalid") ||
        error.message?.includes("expired")
      ) {
        errorMessage =
          "Ce lien est invalide ou a expiré. Veuillez refaire une demande.";
      } else {
        errorMessage = error.message || "Erreur lors de la réinitialisation";
      }
    } finally {
      isLoading = false;
    }
  }

  function goToLogin() {
    navigate("/");
  }
</script>

<div class="flex h-full items-center justify-center bg-base-200 p-4">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <!-- Header -->
    <div class="card-body">
      <div class="text-center">
        <div class="mb-4 flex justify-center">
          <div class="rounded-full bg-primary/10 p-4">
            <KeyRound class="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 class="card-title justify-center text-2xl">
          Réinitialisation du mot de passe
        </h2>
        {#if isValidLink}
          <p class="mt-2 text-base-content/70">
            Entrez votre nouveau mot de passe
          </p>
        {/if}
      </div>

      <!-- Processing -->
      {#if isProcessing}
        <div class="flex flex-col items-center py-8">
          <Loader2 class="h-12 w-12 animate-spin text-primary" />
          <p class="mt-4 text-base-content/70">Vérification du lien...</p>
        </div>

        <!-- Lien invalide -->
      {:else if !isValidLink}
        <div role="alert" class="mt-4 alert alert-error max-md:alert-vertical">
          <AlertCircle class="h-6 w-6 shrink-0" />
          <span>{errorMessage}</span>
        </div>
        <div class="mt-6 card-actions justify-center">
          <button onclick={goToLogin} class="btn btn-primary">
            Retour à la connexion
          </button>
        </div>

        <!-- Formulaire -->
      {:else}
        <!-- Messages -->
        {#if errorMessage}
          <div
            role="alert"
            class="mb-4 alert alert-error max-md:alert-vertical"
          >
            <AlertCircle class="h-6 w-6 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        {#if successMessage}
          <div
            role="alert"
            class="mb-4 alert alert-success max-md:alert-vertical"
          >
            <Check class="h-6 w-6 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <p class="text-center text-base-content/70">
            Vous allez être redirigé...
          </p>
        {:else}
          <form onsubmit={handleResetPassword} class="space-y-4">
            <!-- Nouveau mot de passe -->
            <fieldset class="fieldset">
              <legend class="legend">
                <span class="">Nouveau mot de passe</span>
              </legend>
              <input
                id="new-password"
                type="password"
                bind:value={newPassword}
                class="input w-full"
                minlength="8"
                required
                disabled={isLoading}
                autocomplete="new-password"
              />

              <p class="label text-base-content/50">Minimum 8 caractères</p>
            </fieldset>

            <!-- Confirmer le mot de passe -->
            <fieldset class="fieldset">
              <legend class="legend">
                <span>Confirmer le mot de passe</span>
              </legend>
              <input
                id="confirm-password"
                type="password"
                bind:value={confirmPassword}
                class="input w-full"
                minlength="8"
                required
                disabled={isLoading}
                autocomplete="new-password"
              />
            </fieldset>

            <!-- Bouton de soumission -->
            <div class=" mt-6">
              <button
                type="submit"
                class="btn btn-block btn-primary"
                disabled={isLoading}
              >
                {#if isLoading}
                  <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                  Réinitialisation en cours...
                {:else}
                  Réinitialiser le mot de passe
                {/if}
              </button>
            </div>
          </form>

          <!-- Lien retour -->
          <div class="mt-4 card-actions justify-center">
            <button
              onclick={goToLogin}
              class="btn btn-ghost btn-sm"
              disabled={isLoading}
            >
              <ArrowLeft class="mr-1 h-4 w-4" />
              Retour à l'acceuil
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1rem;
  }
</style>

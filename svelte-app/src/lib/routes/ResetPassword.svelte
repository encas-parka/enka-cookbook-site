<script lang="ts">
  import { getAppwriteInstances } from "../services/appwrite";
  import { navigate } from "$lib/router";

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

  // Récupérer userId et secret depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("userId");
  const secret = urlParams.get("secret");

  // Valider le lien
  async function validateRecoveryLink() {
    if (!userId || !secret) {
      errorMessage = "Lien de réinitialisation invalide ou manquant.";
      isValidLink = false;
      isProcessing = false;
      return;
    }

    isValidLink = true;
    isProcessing = false;
  }

  // Appeler la validation au montage
  validateRecoveryLink();

  async function handleResetPassword(event: Event) {
    event.preventDefault();

    // Guard : vérifier que le lien est valide
    if (!userId || !secret || !isValidLink) {
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
      const { account } = await getAppwriteInstances();

      await account.updateRecovery({ userId, secret, password: newPassword });

      successMessage = "Mot de passe réinitialisé avec succès !";

      // Rediriger vers le dashboard après 3 secondes
      setTimeout(() => {
        navigate("/dashboard");
      }, 3000);
    } catch (error: any) {
      console.error("Erreur réinitialisation:", error);
      if (
        error.response?.code === 401 ||
        error.message?.includes("Invalid secret")
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

<div class="bg-base-200 flex items-center justify-center p-4">
  <div class="card bg-base-100 w-full max-w-md shadow-xl">
    <!-- Header -->
    <div class="card-body">
      <div class="text-center">
        <div class="mb-4 flex justify-center">
          <div class="bg-primary/10 rounded-full p-4">
            <KeyRound class="text-primary h-8 w-8" />
          </div>
        </div>
        <h2 class="card-title justify-center text-2xl">
          Réinitialisation du mot de passe
        </h2>
        {#if isValidLink}
          <p class="text-base-content/70 mt-2">
            Entrez votre nouveau mot de passe
          </p>
        {/if}
      </div>

      <!-- Processing -->
      {#if isProcessing}
        <div class="flex flex-col items-center py-8">
          <Loader2 class="text-primary h-12 w-12 animate-spin" />
          <p class="text-base-content/70 mt-4">Vérification du lien...</p>
        </div>

        <!-- Lien invalide -->
      {:else if !isValidLink}
        <div role="alert" class="alert alert-error max-md:alert-vertical mt-4">
          <AlertCircle class="h-6 w-6 shrink-0" />
          <span>{errorMessage}</span>
        </div>
        <div class="card-actions mt-6 justify-center">
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
            class="alert alert-error max-md:alert-vertical mb-4"
          >
            <AlertCircle class="h-6 w-6 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        {#if successMessage}
          <div
            role="alert"
            class="alert alert-success max-md:alert-vertical mb-4"
          >
            <Check class="h-6 w-6 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <p class="text-base-content/70 text-center">
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
                class="input input-bordered w-full"
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
                class="input input-bordered w-full"
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
                class="btn btn-primary btn-block"
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
          <div class="card-actions mt-4 justify-center">
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

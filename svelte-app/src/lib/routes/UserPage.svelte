<script lang="ts">
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { route, navigate, p } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { getAppwriteInstances } from "$lib/services/appwrite";

  import { User, Lock, Key, Save, ArrowLeft } from "@lucide/svelte";

  // =============================================================================
  // STATE
  // =============================================================================

  // Nom d'utilisateur
  let newName = $state("");
  let isUpdatingName = $state(false);

  // Mot de passe
  let oldPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let isUpdatingPassword = $state(false);

  // =============================================================================
  // DERIVED
  // =============================================================================

  const hasNameChanges = $derived(
    newName.trim() !== "" && newName.trim() !== globalState.userName,
  );

  const hasPasswordChanges = $derived(
    oldPassword !== "" && newPassword !== "" && confirmPassword !== "",
  );

  const passwordError = $derived.by(() => {
    if (newPassword !== confirmPassword) {
      return "Les mots de passe ne correspondent pas";
    }
    if (newPassword.length < 8) {
      return "Le mot de passe doit contenir au moins 8 caractères";
    }
    return null;
  });

  // =============================================================================
  // EFFECTS
  // =============================================================================

  $effect(() => {
    // Initialiser avec le nom actuel
    if (globalState.userName) {
      newName = globalState.userName;
    }
  });

  // =============================================================================
  // HANDLERS
  // =============================================================================

  async function handleUpdateName(event: Event) {
    event.preventDefault();

    if (!hasNameChanges || isUpdatingName) return;

    isUpdatingName = true;

    try {
      const { account } = await getAppwriteInstances();

      await toastService.track(account.updateName(newName.trim()), {
        loading: "Mise à jour du nom d'utilisateur...",
        success: "Nom d'utilisateur mis à jour avec succès",
        error: "Erreur lors de la mise à jour du nom d'utilisateur",
      });

      // Mettre à jour globalState
      await globalState.refreshAuthAfterLogin();
    } catch (error) {
      console.error("[UserPage] Erreur lors de la mise à jour du nom:", error);
    } finally {
      isUpdatingName = false;
    }
  }

  async function handleUpdatePassword(event: Event) {
    event.preventDefault();

    if (!hasPasswordChanges || isUpdatingPassword || passwordError) return;

    isUpdatingPassword = true;

    try {
      const { account } = await getAppwriteInstances();

      await toastService.track(
        account.updatePassword(newPassword, oldPassword),
        {
          loading: "Mise à jour du mot de passe...",
          success: "Mot de passe mis à jour avec succès",
          error: "Erreur lors de la mise à jour du mot de passe",
        },
      );

      // Réinitialiser les champs
      oldPassword = "";
      newPassword = "";
      confirmPassword = "";
    } catch (error) {
      console.error(
        "[UserPage] Erreur lors de la mise à jour du mot de passe:",
        error,
      );
    } finally {
      isUpdatingPassword = false;
    }
  }

  function handleBack() {
    navigate("/dashboard");
  }
</script>

<div class="container mx-auto max-w-2xl p-4">
  <!-- Header -->
  <div class="mb-6 flex items-center gap-4">
    <button
      onclick={handleBack}
      class="btn btn-ghost btn-circle btn-sm"
      aria-label="Retour au tableau de bord"
    >
      <ArrowLeft size={20} />
    </button>
    <h1 class="text-2xl font-bold">Mon compte</h1>
  </div>

  <!-- Section 1 : Nom d'utilisateur -->
  <section class="card bg-base-100 mb-6 shadow-xl">
    <div class="card-body">
      <h2 class="card-title mb-4 flex items-center gap-2">
        <User size={20} />
        Modifier le nom d'utilisateur
      </h2>

      <form onsubmit={handleUpdateName}>
        <label class="input input-bordered flex items-center gap-2">
          <User class="h-4 w-4 opacity-50" />
          <input
            type="text"
            bind:value={newName}
            placeholder="Nouveau nom d'utilisateur"
            required
            disabled={isUpdatingName}
            maxlength="25"
          />
        </label>

        <div class="card-actions mt-4 justify-end">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={!hasNameChanges || isUpdatingName}
          >
            {#if isUpdatingName}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Save size={16} />
            {/if}
            Mettre à jour
          </button>
        </div>
      </form>
    </div>
  </section>

  <!-- Section 2 : Mot de passe -->
  <section class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title mb-4 flex items-center gap-2">
        <Lock size={20} />
        Modifier le mot de passe
      </h2>

      <form onsubmit={handleUpdatePassword}>
        <fieldset class="fieldset mb-4">
          <legend class="fieldset-legend">Ancien mot de passe</legend>
          <label class="input input-bordered flex items-center gap-2">
            <Key class="h-4 w-4 opacity-50" />
            <input
              type="password"
              bind:value={oldPassword}
              placeholder="Entrez votre ancien mot de passe"
              required
              disabled={isUpdatingPassword}
            />
          </label>
        </fieldset>

        <fieldset class="fieldset mb-4">
          <legend class="fieldset-legend">Nouveau mot de passe</legend>
          <label class="input input-bordered flex items-center gap-2">
            <Lock class="h-4 w-4 opacity-50" />
            <input
              type="password"
              bind:value={newPassword}
              placeholder="Nouveau mot de passe (min. 8 caractères)"
              required
              disabled={isUpdatingPassword}
            />
          </label>
        </fieldset>

        <fieldset class="fieldset mb-4">
          <legend class="fieldset-legend"
            >Confirmer le nouveau mot de passe</legend
          >
          <label class="input input-bordered flex items-center gap-2">
            <Lock class="h-4 w-4 opacity-50" />
            <input
              type="password"
              bind:value={confirmPassword}
              placeholder="Confirmez le nouveau mot de passe"
              required
              disabled={isUpdatingPassword}
            />
          </label>
          {#if passwordError && confirmPassword !== ""}
            <div class="label text-error">
              <span class="label-text-alt">{passwordError}</span>
            </div>
          {/if}
        </fieldset>

        <div class="card-actions justify-end">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={!hasPasswordChanges ||
              isUpdatingPassword ||
              !!passwordError}
          >
            {#if isUpdatingPassword}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Save size={16} />
            {/if}
            Mettre à jour
          </button>
        </div>
      </form>
    </div>
  </section>
</div>

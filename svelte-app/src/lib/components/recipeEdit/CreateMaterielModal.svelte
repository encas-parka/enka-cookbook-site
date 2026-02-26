<script lang="ts">
  import { Plus, TriangleAlert, Wrench } from "@lucide/svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    open: boolean;
    initialName?: string;
    onMaterielCreated?: (materiel: string) => void;
  }

  let { open = $bindable(false), onMaterielCreated }: Props = $props();

  // ============================================================================
  // ÉTAT DU FORMULAIRE
  // ============================================================================

  let formData = $state<{ name: string }>({
    name: "",
  });

  let loading = $state(false);
  let showErrors = $state(false);
  let serverError = $state<string | null>(null);
  let validationErrors = $state<{ name?: string }>({});

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function validateForm(): { name?: string } {
    const errors: { name?: string } = {};

    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      errors.name = "Le nom est requis";
    } else if (trimmedName.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caractères";
    } else if (trimmedName.length > 50) {
      errors.name = "Le nom ne peut pas dépasser 50 caractères";
    }

    return errors;
  }

  // ============================================================================
  // FONCTIONS
  // ============================================================================

  /**
   * Création du matériel
   */
  async function handleSubmit() {
    if (loading) return;

    // Afficher les erreurs de validation
    showErrors = true;

    // Vérifier la validation
    validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    loading = true;
    serverError = null;

    try {
      const materielName = formData.name.trim();

      // Appeler le store
      await recipeDataStore.addMateriel(materielName);

      // Success
      toastService.success(`Matériel "${materielName}" créé avec succès`);

      // Callback parent
      if (onMaterielCreated) {
        onMaterielCreated(materielName);
      }

      // Reset et fermeture
      resetForm();
      open = false;
    } catch (err) {
      serverError =
        err instanceof Error ? err.message : "Erreur lors de la création";
      toastService.error(serverError);
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    formData = { name: "" };
    showErrors = false;
    serverError = null;
    validationErrors = {};
  }

  function handleClose() {
    open = false;
    resetForm();
  }

  // Reset du formulaire à l'ouverture du modal
  $effect(() => {
    if (open) {
      setTimeout(() => {
        document.getElementById("materiel-name-input")?.focus();
      }, 50);
    }
  });
</script>

<ModalContainer isOpen={open} onClose={handleClose}>
  <ModalHeader title="Ajouter du matériel" onClose={handleClose} />

  <ModalContent>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      class="flex flex-col space-y-6"
    >
      <!-- Erreur -->
      {#if serverError}
        <div class="alert alert-error max-md:alert-vertical text-sm">
          <TriangleAlert size={18} />
          <span>{serverError}</span>
        </div>
      {/if}

      <fieldset disabled={loading} class="space-y-4">
        <!-- Nom -->
        <div class="fieldset">
          <legend class="fieldset-legend">Nom du matériel</legend>
          <label
            class="input input-lg w-full {showErrors && validationErrors.name
              ? 'input-error'
              : ''}"
          >
            <Wrench class="text-base-content/50 h-5 w-5" />
            <input
              id="materiel-name-input"
              type="text"
              placeholder="Ex: Robot Mixeur"
              bind:value={formData.name}
              required
              aria-required="true"
              minlength="2"
              maxlength="50"
            />
          </label>
          {#if showErrors && validationErrors.name}
            <p class="text-error text-xs">{validationErrors.name}</p>
          {/if}
          <p class="text-base-content/60 text-xs italic">
            2 à 50 caractères. Ex: "Four", "Robot Mixeur", "Gastro 1/1 (10cm)"
          </p>
        </div>
      </fieldset>
    </form>
  </ModalContent>

  <ModalFooter>
    <button
      type="button"
      class="btn btn-ghost"
      onclick={handleClose}
      disabled={loading}
    >
      Annuler
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      onclick={handleSubmit}
      disabled={loading}
    >
      {#if loading}
        <span class="loading loading-spinner"></span>
      {:else}
        <Plus size={18} />
      {/if}
      Créer
    </button>
  </ModalFooter>
</ModalContainer>

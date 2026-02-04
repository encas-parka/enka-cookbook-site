<script lang="ts">
  import {
    Plus,
    X,
    TriangleAlert,
    Thermometer,
    Snowflake,
    Refrigerator,
    PackagePlus,
  } from "@lucide/svelte";
  import { recipeDataStore } from "$lib/stores/RecipeDataStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type { Ingredient } from "$lib/types/recipes.types";
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
    onIngredientCreated?: (ingredient: Ingredient) => void;
  }

  let {
    open = $bindable(false),
    initialName = "",
    onIngredientCreated,
  }: Props = $props();

  // ============================================================================
  // ÉTAT DU FORMULAIRE
  // ============================================================================

  let formData = $state<{
    name: string;
    type: string;
    allergens: string[];
    pF: boolean | null;
    pS: boolean | null;
    saisons: string[];
  }>({
    // svelte-ignore state_referenced_locally
    name: initialName,
    type: "",
    allergens: [],
    pF: null,
    pS: false,
    saisons: [],
  });

  let loading = $state(false);
  let showErrors = $state(false);
  let serverError = $state<string | null>(null);
  let validationErrors = $state<{
    name?: string;
    type?: string;
    allergens?: string;
    pF?: string;
    pS?: string;
  }>({});

  // ============================================================================
  // CONSTANTES
  // ============================================================================

  const INGREDIENT_TYPES = [
    { value: "frais", label: "Produits Frais (beurre, fromage, yahourt..." },
    {
      value: "legumes",
      label: "Fruits et Légumes (frais, concerves, surgelés, etc.",
    },
    { value: "lof", label: "LOF : Laits, oeuf, farines, huiles..." },
    { value: "sucres", label: "Sucrés (jus, sirop, confiture ...)" },
    { value: "epices", label: "Assaisonnements (épices, herbes, sauces...)" },
    { value: "sec", label: "Sec (riz, pâtes, lentilles...)" },
    { value: "animaux", label: "Viandes et Poissons" },
    { value: "autres", label: "Autres" },
  ];

  const ALLERGENS = [
    "Aucun",
    "Produit laitier",
    "Gluten",
    "Crustacé",
    "Oeuf",
    "Poisson",
    "Viande",
    "Porc",
    "Arachides",
    "Soja",
    "Fruits à coque",
    "Céleri",
    "Moutarde",
    "Sésame",
    "Sulfites",
    "Lupin",
    "Mollusque",
    "Alcool",
    "Vérifier emballage",
  ];

  const SAISONS = [
    { value: "printemps", label: "Printemps" },
    { value: "ete", label: "Eté" },
    { value: "automne", label: "Automne" },
    { value: "hiver", label: "Hiver" },
  ];

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function validateForm(): {
    name?: string;
    type?: string;
    allergens?: string;
    pF?: string;
    pS?: string;
  } {
    const errors: {
      name?: string;
      type?: string;
      allergens?: string;
      pF?: string;
      pS?: string;
    } = {};

    if (!formData.name.trim()) {
      errors.name = "Le nom est requis";
    }
    if (!formData.type.trim()) {
      errors.type = "Le type est requis";
    }
    if (formData.allergens.length === 0) {
      errors.allergens =
        "Cochez 'Aucun' si l'ingrédient ne contient aucun allergène";
    }
    if (formData.pF === null) {
      errors.pF = "Indiquez si c'est un produit frais";
    }
    if (formData.pS === null) {
      errors.pS = "Indiquez si c'est un produit surgelé";
    }

    return errors;
  }

  // ============================================================================
  // FONCTIONS
  // ============================================================================

  /**
   * Gestion spécial "Aucun" pour allergènes
   * Si "Aucun" est sélectionné, désélectionne tous les autres allergènes
   */
  function toggleAllergen(allergen: string) {
    if (allergen === "Aucun") {
      // Si "Aucun" est coché, désélectionner tous les autres
      formData.allergens = ["Aucun"];
    } else {
      // Si un allergène est coché, désélectionner "Aucun"
      formData.allergens = formData.allergens.filter((a) => a !== "Aucun");

      // Toggle l'allergène
      if (formData.allergens.includes(allergen)) {
        formData.allergens = formData.allergens.filter((a) => a !== allergen);
      } else {
        formData.allergens.push(allergen);
      }
    }
  }

  /**
   * Création de l'ingrédient
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
      // Préparer les données
      const ingredientData = {
        name: formData.name.trim(),
        type: formData.type,
        allergens: formData.allergens.includes("Aucun")
          ? []
          : formData.allergens,
        pF: formData.pF === true,
        pS: formData.pS === true,
        saisons: formData.saisons.length > 0 ? formData.saisons : undefined,
      };

      // Appeler le store
      const newIngredient = await recipeDataStore.addIngredient(ingredientData);

      // Success
      toastService.success(`Ingrédient "${newIngredient.n}" créé avec succès`);

      // Callback parent
      if (onIngredientCreated) {
        onIngredientCreated(newIngredient);
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
    formData = {
      name: "",
      type: "",
      allergens: [],
      pF: null,
      pS: null,
      saisons: [],
    };
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
      resetForm();
      // Appliquer initialName si fourni
      if (initialName) {
        formData.name = initialName;
      }
      // Focus automatique
      setTimeout(() => {
        document.getElementById("ingredient-name-input")?.focus();
      }, 50);
    }
  });
</script>

<ModalContainer isOpen={open} onClose={handleClose}>
  <ModalHeader title="Créer un nouvel ingrédient" onClose={handleClose} />

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
          <legend class="fieldset-legend required">Nom</legend>
          <label
            class="input w-full {showErrors && validationErrors.name
              ? 'input-error'
              : ''}"
          >
            <PackagePlus class="text-base-content/50 h-5 w-5" />
            <input
              id="ingredient-name-input"
              type="text"
              placeholder="Nom de l'ingrédient"
              bind:value={formData.name}
              required
              aria-required="true"
              minlength="2"
              maxlength="60"
            />
          </label>
          {#if showErrors && validationErrors.name}
            <p class="text-error text-xs">{validationErrors.name}</p>
          {/if}
        </div>

        <!-- Type -->
        <div class="fieldset">
          <legend class="fieldset-legend required">Type</legend>
          <select
            class="select select-bordered w-full {showErrors &&
            validationErrors.type
              ? 'select-error'
              : ''}"
            bind:value={formData.type}
            required
            aria-required="true"
          >
            <option value="">Sélectionner un type...</option>
            {#each INGREDIENT_TYPES as type (type.value)}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
          {#if showErrors && validationErrors.type}
            <p class="text-error text-xs">{validationErrors.type}</p>
          {/if}
        </div>

        <!-- Allergènes -->
        <div class="fieldset">
          <legend class="fieldset-legend required">Allergènes</legend>
          <p class="text-base-content/60 mb-2 text-xs">
            Précisez les allergènes présents dans l'ingrédient et/ou la nature
            de l'ingrédients (ou cochez "Aucun"). Sert notamment à la
            classification des recettes comme végétarienne, sans-gluten, etc.)
          </p>
          <div class="flex flex-wrap gap-2">
            {#each ALLERGENS as allergen (allergen)}
              <label
                class="label border-base-300 cursor-pointer gap-2 rounded-lg border px-3 py-1 {formData.allergens.includes(
                  allergen,
                )
                  ? 'bg-primary/20 border-primary'
                  : 'bg-base-200'} {showErrors &&
                validationErrors.allergens &&
                !formData.allergens.length
                  ? 'border-error'
                  : ''}"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm bg-base-100"
                  checked={formData.allergens.includes(allergen)}
                  onchange={() => toggleAllergen(allergen)}
                />
                <span class="text-sm">{allergen}</span>
              </label>
            {/each}
          </div>
          {#if showErrors && validationErrors.allergens}
            <p class="text-error text-xs">
              {validationErrors.allergens}
            </p>
          {/if}
        </div>

        <!-- pF / pS -->
        <div class="grid gap-4 md:grid-cols-2">
          <!-- Produit Frais -->
          <div class="fieldset">
            <legend class="fieldset-legend"
              ><div class="flex items-center gap-2">
                <Refrigerator size={16} class="opacity-50" />
                <span class="required">frais ?</span>
              </div></legend
            >
            <p class="text-base-content/60 mb-2 text-xs">
              Fruits et légumes frais, ou ingrédients qui se conservent au frigo
            </p>
            <div
              class="join w-full {showErrors && validationErrors.pF
                ? 'join-error'
                : ''}"
            >
              <button
                type="button"
                class="btn join-item flex-1 {formData.pF === true
                  ? 'btn-success'
                  : ''}"
                onclick={() => (formData.pF = true)}
              >
                Oui
              </button>
              <button
                type="button"
                class="btn join-item flex-1 {formData.pF === false
                  ? 'btn-error'
                  : ''}"
                onclick={() => (formData.pF = false)}
              >
                Non
              </button>
            </div>
            {#if showErrors && validationErrors.pF}
              <p class="text-error text-xs">{validationErrors.pF}</p>
            {/if}
          </div>

          <!-- Produit Surgelé -->
          <div class="fieldset">
            <legend class="fieldset-legend">
              <div class="flex items-center gap-2">
                <Snowflake size={16} class="opacity-50" />
                <span class="required">Produit surgelé ?</span>
              </div></legend
            >
            <p class="text-base-content/60 mb-2 text-xs">
              Ingrédients qui se conservent au congélateur
            </p>
            <div
              class="join w-full {showErrors && validationErrors.pS
                ? 'join-error'
                : ''}"
            >
              <button
                type="button"
                class="btn join-item flex-1 {formData.pS === true
                  ? 'btn-info'
                  : ''}"
                onclick={() => (formData.pS = true)}
              >
                Oui
              </button>
              <button
                type="button"
                class="btn join-item flex-1 {formData.pS === false
                  ? 'btn-error'
                  : ''}"
                onclick={() => (formData.pS = false)}
              >
                Non
              </button>
            </div>
            {#if showErrors && validationErrors.pS}
              <p class="text-error text-xs">
                {validationErrors.pS}
              </p>
            {/if}
          </div>
        </div>

        <!-- Saisons -->
        <div class="fieldset">
          <legend class="fieldset-legend">Saisons (optionnel)</legend>
          <p class="text-base-content/60 mb-2 text-xs">
            Si l'ingrédient se trouve surtout à certaines saisons
          </p>
          <div class="flex flex-wrap gap-2">
            {#each SAISONS as saison (saison.value)}
              <label
                class="label border-base-300 cursor-pointer gap-2 rounded-lg px-3 py-1 {formData.saisons.includes(
                  saison.value,
                )
                  ? 'bg-success/20 border-success'
                  : 'bg-base-200'}"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm bg-base-100"
                  checked={formData.saisons.includes(saison.value)}
                  onchange={(e) => {
                    if (e.currentTarget.checked) {
                      formData.saisons = [...formData.saisons, saison.value];
                    } else {
                      formData.saisons = formData.saisons.filter(
                        (s) => s !== saison.value,
                      );
                    }
                  }}
                />
                <span class="label-text">{saison.label}</span>
              </label>
            {/each}
          </div>
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
      Créer l'ingrédient
    </button>
  </ModalFooter>
</ModalContainer>

<script lang="ts">
  import {
    Plus,
    X,
    PackagePlus,
    TriangleAlert,
    Thermometer,
    Snowflake,
    History,
  } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { createManualProduct } from "$lib/services/appwrite-products";
  import { toastService } from "$lib/services/toast.service.svelte";
  import {
    getProductTypeInfo,
    getProductTypeRawKey,
  } from "$lib/utils/products-display";
  import Suggestions from "../ui/Suggestions.svelte";
  import QuantityInput from "../ui/QuantityInput.svelte";
  import StoreInput from "../ui/StoreInput.svelte";
  import WhoInput from "../ui/WhoInput.svelte";
  import ModalContainer from "../ui/modal/ModalContainer.svelte";
  import ModalHeader from "../ui/modal/ModalHeader.svelte";
  import ModalContent from "../ui/modal/ModalContent.svelte";

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let showErrors = $state(false);
  let validationErrors = $state<{
    productName?: string;
    productType?: string;
  }>({});

  let formData = $state<{
    productName: string;
    productType: string;
    store: string;
    who: string;
    pF: boolean;
    pS: boolean;
    quantity: number | null;
    unit: string;
  }>({
    productName: "",
    productType: "",
    store: "",
    who: "",
    pF: false,
    pS: false,
    quantity: null,
    unit: "",
  });

  // Validation
  function validateForm() {
    const errors: { productName?: string; productType?: string } = {};

    if (!formData.productName.trim()) {
      errors.productName = "Le nom du produit est requis";
    }
    if (!formData.productType.trim()) {
      errors.productType = "Le type/catégorie est requis";
    }

    return errors;
  }

  const isFormValid = $derived(
    formData.productName.trim().length > 0 &&
      formData.productType.trim().length > 0,
  );

  // Suggestions
  const typeSuggestions = $derived(
    productsStore.uniqueProductTypes.map((t) => {
      const info = getProductTypeInfo(t);
      return { id: t, label: info.displayName, icon: info.icon };
    }),
  );
  let isArchiveMode = $derived(productsStore.isEventPassed);

  async function handleSubmit(keepOpen: boolean = false) {
    if (loading) return;

    showErrors = true;
    validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      toastService.error("Veuillez remplir les champs obligatoires");
      return;
    }

    loading = true;
    error = null;
    success = false;

    try {
      if (!productsStore.currentMainId) {
        throw new Error("Aucun événement principal sélectionné");
      }

      const productData = {
        productName: formData.productName.trim(),
        productType: getProductTypeRawKey(formData.productType.trim()),
        store: formData.store.trim()
          ? { storeName: formData.store.trim() }
          : undefined,
        who: formData.who.trim() ? [formData.who.trim()] : undefined,
        pF: formData.pF,
        pS: formData.pS,
        quantity: formData.quantity
          ? { q: formData.quantity, u: formData.unit.trim() || "pièces" }
          : undefined,
      };

      const newProduct = await createManualProduct(
        productData,
        productsStore.currentMainId!,
      );
      productsStore.addProductOptimistic(newProduct);

      success = true;
      toastService.success(`Produit "${productData.productName}" ajouté`);

      // Reset form after short delay and close
      // Reset form but keep some values
      if (keepOpen) {
        formData.productName = "";
        formData.quantity = null;
        formData.unit = "";
        formData.pF = false;
        formData.pS = false;
        showErrors = false;
        validationErrors = {};

        // Focus on product name input
        setTimeout(() => {
          const input = document.getElementById("product-name");
          input?.focus();
        }, 100);
      } else {
        open = false;
        handleClose();
      }
    } catch (err) {
      console.error("Error creating product:", err);
      error = "Erreur lors de la création du produit. Veuillez réessayer.";
      toastService.error(error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    formData = {
      productName: "",
      productType: "",
      store: "",
      who: "",
      pF: false,
      pS: false,
      quantity: null,
      unit: "",
    };
    error = null;
    showErrors = false;
    validationErrors = {};
  }

  $effect(() => {
    if (open) {
      // Petit délai pour s'assurer que le modal est visible
      setTimeout(() => {
        document.getElementById("product-name")?.focus();
      }, 50);
    }
  });

  function handleSuggestionClick(
    field: "productType" | "store" | "who",
    value: string,
  ) {
    formData[field] = value;
  }
</script>

<ModalContainer isOpen={open} onClose={handleClose}>
  <ModalHeader title="Ajouter un produit" onClose={handleClose} />

  <ModalContent>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      class="flex h-full flex-col space-y-4"
    >
      {#if error}
        <div class="alert alert-error text-sm">
          <TriangleAlert size={18} />
          <span>{error}</span>
        </div>
      {/if}

      {#if isArchiveMode}
        <div
          class="alert alert-warning border-warning/20 border-b px-4 py-2 text-xs"
        >
          <History class="h-4 w-4" />
          <span class="font-medium">Mode consultation</span>
          <span class="opacity-75">Événement terminé</span>
        </div>
      {/if}

      <fieldset disabled={loading} class="space-y-4">
        <div class="flex flex-wrap gap-4">
          <!-- Nom du produit -->
          <fieldset class="fieldset">
            <label
              class="input required w-72 {showErrors &&
              validationErrors.productName
                ? 'input-error'
                : ''}"
            >
              <PackagePlus class="text-base-content/50 h-5 w-5" />
              <input
                id="product-name"
                type="text"
                placeholder="Nom du produit"
                bind:value={formData.productName}
                disabled={loading}
              />
            </label>
            {#if showErrors && validationErrors.productName}
              <p class="text-error text-xs">{validationErrors.productName}</p>
            {/if}
          </fieldset>
          <!-- Quantité et Unité -->
          <QuantityInput
            bind:quantity={formData.quantity}
            bind:unit={formData.unit}
            disabled={loading}
          />
        </div>

        <!-- Type de produit -->
        <fieldset class="fieldset">
          <div class="flex flex-wrap items-baseline gap-2">
            <label
              class="input required w-72 {showErrors &&
              validationErrors.productType
                ? 'input-error'
                : ''}"
            >
              <input
                id="product-type"
                type="text"
                placeholder="type / catégorie"
                bind:value={formData.productType}
                disabled={loading}
              />
            </label>
            <Suggestions
              suggestions={typeSuggestions}
              onSuggestionClick={(s) => (formData.productType = s.label)}
              maxSuggestions={Infinity}
              disabled={loading}
            />
          </div>
          {#if showErrors && validationErrors.productType}
            <p class="text-error text-xs">{validationErrors.productType}</p>
          {/if}
        </fieldset>

        <!-- Magasin -->
        <StoreInput
          bind:value={formData.store}
          suggestions={productsStore.uniqueStores}
          disabled={loading}
        />

        <!-- Qui -->
        <WhoInput
          bind:value={formData.who}
          suggestions={productsStore.uniqueWho}
          disabled={loading}
        />

        <div class="flex flex-wrap gap-x-6">
          <!-- Checkboxes Frais / Surgelé -->
          <fieldset class="fieldset">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-success"
                bind:checked={formData.pF}
                disabled={loading}
              />
              <span class="label-text flex items-center gap-2">
                Produit frais
              </span>
            </label>
          </fieldset>

          <fieldset class="fieldset">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-info"
                bind:checked={formData.pS}
                disabled={loading}
              />
              <span class="label-text flex items-center gap-2">
                Produit surgelé
              </span>
            </label>
          </fieldset>
        </div>

        <!-- Actions avec mt-auto pour rester en bas -->
        <div
          class="border-base-300 mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-4"
        >
          <button
            type="button"
            class="btn btn-ghost"
            onclick={handleClose}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() => handleSubmit(true)}
            disabled={loading || isArchiveMode}
          >
            {#if loading}
              <span class="loading loading-spinner"></span>
            {:else}
              <Plus size={18} />
            {/if}
            Ajouter et créer un nouveau
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={loading || isArchiveMode}
          >
            {#if loading}
              <span class="loading loading-spinner"></span>
            {/if}
            Ajouter et fermer
          </button>
        </div>
      </fieldset>
    </form>
  </ModalContent>
</ModalContainer>

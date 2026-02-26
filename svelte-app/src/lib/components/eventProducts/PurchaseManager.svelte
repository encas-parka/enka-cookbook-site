<script lang="ts">
  import {
    ShoppingCart,
    SquarePen,
    Save,
    X,
    Package,
    Store,
    User,
    MessageCircle,
    WeightIcon,
    Calendar,
    PackageCheck,
    Weight,
    Trash,
    Trash2,
    Bubbles,
    Euro,
  } from "@lucide/svelte";
  import type { Purchases } from "$lib/types/appwrite.d.ts";
  import type { ProductModalStateType } from "$lib/types/store.types.js";
  import {
    formatDate,
    getStatusBadge,
    formatDateOrNull,
  } from "$lib/utils/products-display.js";
  import {
    formatSingleQuantity,
    convertAndFormatQuantity,
  } from "$lib/utils/QuantityFormatter.js";
  import { UnitConverter } from "$lib/utils/UnitConverter.js";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import ArchiveMessage from "./ArchiveMessage.svelte";
  import QuantityInput from "../ui/QuantityInput.svelte";
  import StoreInput from "../ui/StoreInput.svelte";
  import WhoInput from "../ui/WhoInput.svelte";
  import CommentTextarea from "../ui/CommentTextarea.svelte";
  import PriceInput from "../ui/PriceInput.svelte";
  import StatusSelect from "../ui/StatusSelect.svelte";

  interface Props {
    modalState: ProductModalStateType;
    isArchiveMode?: boolean;
  }

  let { modalState, isArchiveMode = false }: Props = $props();

  function isEditFormValid(purchase: Purchases): boolean {
    return (
      purchase.quantity !== null &&
      purchase.quantity !== 0 &&
      purchase.unit?.trim() !== ""
    );
  }

  // État local pour la checkbox de commande
  let isOrder = $state(false);

  // ✅ Fonction pour démarrer l'édition en utilisant le formulaire d'ajout
  function startEdit(purchase: Purchases) {
    // Ne rien faire en mode archive
    if (isArchiveMode) return;

    // Convertir les quantités pour l'affichage (≥1000 → kg/l.)
    const { value: displayQuantity, unit: displayUnit } =
      convertAndFormatQuantity(purchase.quantity, purchase.unit);

    // Copier les données du purchase dans le formulaire
    modalState.forms.purchase.quantity = displayQuantity;
    modalState.forms.purchase.unit = displayUnit;
    modalState.forms.purchase.price = purchase.price;
    modalState.forms.purchase.store = purchase.store || "";
    modalState.forms.purchase.who = purchase.who || "";
    modalState.forms.purchase.notes = purchase.notes || "";
    modalState.forms.purchase.status =
      (purchase.status as "ordered" | "delivered") || null;
    modalState.forms.purchase.orderDate = purchase.orderDate || null;
    modalState.forms.purchase.deliveryDate = purchase.deliveryDate || null;

    // Définir l'ID du purchase en cours d'édition via la méthode dédiée
    modalState.startEditPurchase(purchase);

    // Scroll vers le formulaire et focus sur l'input du prix
    setTimeout(() => {
      const formElement = document.querySelector("#purchase-form-card");
      formElement?.scrollIntoView({ behavior: "smooth", block: "center" });

      // Focus sur l'input du prix (premier input de type number dans PriceInput)
      const priceInput = formElement?.querySelector(
        'input[type="number"]',
      ) as HTMLInputElement;
      priceInput?.focus();
    }, 100);
  }

  // ✅ Fonction pour réinitialiser le formulaire
  function resetForm() {
    modalState.forms.purchase.quantity = null;
    modalState.forms.purchase.unit = "kg";
    modalState.forms.purchase.price = null;
    modalState.forms.purchase.store = "";
    modalState.forms.purchase.who = "";
    modalState.forms.purchase.notes = "";
    modalState.forms.purchase.status = "delivered";
    modalState.forms.purchase.orderDate = null;
    modalState.forms.purchase.deliveryDate = null;

    // Annuler l'édition en cours si nécessaire
    if (modalState.editingPurchaseId) {
      modalState.cancelEditPurchase();
    }
  }

  // ✅ Pas besoin d'intermédiaires - accès direct au state du modalState
  function handleAddOrUpdatePurchase() {
    if (!modalState.isPurchaseFormValid) return;

    if (modalState.editingPurchaseId) {
      // Mode Édition : mettre à jour le purchase existant
      const edited = modalState.editingPurchaseData;
      if (!edited || !isEditFormValid(edited)) return;

      // Mettre à jour avec les données du formulaire
      // Normaliser les unités pour le stockage (kg→gr., l.→ml)
      const rawQuantity = modalState.forms.purchase.quantity ?? 0;
      const rawUnit = modalState.forms.purchase.unit;
      const normalized = UnitConverter.normalize(rawQuantity, rawUnit);

      edited.quantity = normalized.quantity;
      edited.unit = normalized.unit;
      edited.price = modalState.forms.purchase.price;
      edited.store = modalState.forms.purchase.store;
      edited.who = modalState.forms.purchase.who;
      edited.notes = modalState.forms.purchase.notes;
      edited.status = modalState.forms.purchase.status;
      edited.orderDate = modalState.forms.purchase.orderDate;
      edited.deliveryDate = modalState.forms.purchase.deliveryDate;

      modalState.updateEditedPurchase(edited);
      modalState.cancelEditPurchase(); // Reset après mise à jour
    } else {
      // Mode Création : ajouter un nouveau purchase
      // Définir la date de commande par défaut si c'est une commande
      if (
        modalState.forms.purchase.status === "ordered" &&
        !modalState.forms.purchase.orderDate
      ) {
        modalState.forms.purchase.orderDate = new Date()
          .toISOString()
          .split("T")[0];
      }

      modalState.addPurchase();
    }
  }

  function handleUpdateEditedPurchase() {
    // Cette fonction n'est plus utilisée car on utilise le formulaire d'ajout pour l'édition
    // Gardée pour compatibilité si elle est appelée ailleurs
    const edited = modalState.editingPurchaseData;
    if (!edited || !isEditFormValid(edited)) return;
    modalState.updateEditedPurchase(edited);
  }

  function handleDeletePurchase(purchaseId: string) {
    modalState.removePurchase(purchaseId);
  }

  function handleStartEdit(purchase: Purchases) {
    // Rediriger vers la nouvelle fonction startEdit qui utilise le formulaire
    startEdit(purchase);
  }

  function handleCancelEdit() {
    // Utiliser resetForm pour annuler l'édition
    resetForm();
  }

  // ✅ Dérivée pour savoir si on est en mode édition
  let isEditMode = $derived(modalState.editingPurchaseId !== null);

  // ✅ Titre du formulaire selon le mode
  let formTitle = $derived(
    isEditMode
      ? "Modifier l'achat"
      : "Ajouter un achat / une récup / une commande",
  );

  // ✅ Texte du bouton selon le mode
  let buttonText = $derived(
    isEditMode ? "Enregistrer les modifications" : "Ajouter l'achat",
  );
</script>

<div class="space-y-4">
  {#if isArchiveMode}
    <ArchiveMessage
      title="Achats non modifiables"
      message="L'événement est terminé, les achats ne peuvent plus être ajoutés ou modifiés."
    />
  {:else}
    <!-- <h3 class="flex items-center gap-2 text-lg font-semibold">
    <ShoppingCart class="h-5 w-5" />
    Gestion des achats
  </h3> -->

    <div
      class="card bg-base-200 {isEditMode
        ? 'ring-accent ring-2 ring-offset-2'
        : ''}"
      id="purchase-form-card"
    >
      <div class="card-body">
        <h4 class="card-title text-base">
          {formTitle}
        </h4>
        <div class="space-y-8">
          <div class="flex flex-wrap items-baseline gap-4">
            <QuantityInput
              bind:quantity={modalState.forms.purchase.quantity}
              bind:unit={modalState.forms.purchase.unit}
              disabled={modalState.loading}
            />
            <PriceInput
              bind:value={modalState.forms.purchase.price}
              disabled={modalState.loading}
            />
            <StoreInput
              bind:value={modalState.forms.purchase.store}
              suggestions={productsStore.uniqueStores}
              disabled={modalState.loading}
              flexCol={true}
            />
            <WhoInput
              bind:value={modalState.forms.purchase.who}
              suggestions={productsStore.uniqueWho}
              disabled={modalState.loading}
              flexCol={true}
            />
          </div>

          <!-- Ligne Notes -->
          <div class="">
            <CommentTextarea
              bind:value={modalState.forms.purchase.notes}
              disabled={modalState.loading}
            />
          </div>
          <!-- Ligne Statut -->
          <StatusSelect
            bind:status={modalState.forms.purchase.status}
            bind:deliveryDate={modalState.forms.purchase.deliveryDate}
            disabled={modalState.loading}
          />
        </div>
        <div class="card-actions mt-4 justify-end">
          {#if isEditMode}
            <button class="btn btn-ghost btn-sm" onclick={resetForm}>
              Annuler
            </button>
          {/if}
          <button
            class="btn btn-primary btn-sm"
            onclick={handleAddOrUpdatePurchase}
            disabled={modalState.loading || !modalState.isPurchaseFormValid}
          >
            {#if modalState.loading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              {buttonText}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Table des achats (Desktop) ou Cartes (Mobile) -->
{#if modalState.purchasesList.length === 0}
  <div class="mt-4 py-8 text-center opacity-50">
    <ShoppingCart class="mx-auto mb-2 h-12 w-12" />
    <p>Aucun achat enregistré pour ce produit</p>
  </div>
{:else if !globalState.isMobile}
  <!-- Desktop Table View -->
  <div class="mt-4 overflow-x-auto">
    <table class="table-zebra table-sm table">
      <thead>
        <tr>
          <th>Quantité</th>
          <th>Magasin</th>
          <th>Qui</th>
          <th>Statut</th>
          <th>Date commande</th>
          <th>Date livraison</th>
          <th>Prix</th>
          <th>Notes</th>
          {#if !isArchiveMode}<th>Actions</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each modalState.purchasesList as purchase (purchase.$id)}
          <!-- Mode affichage uniquement - plus d'édition inline -->
          <tr>
            <td class="font-medium">
              {formatSingleQuantity(purchase.quantity, purchase.unit)}
            </td>
            <td>{purchase.store || "-"}</td>
            <td>{purchase.who || "-"}</td>
            <td>
              <div
                class="badge badge-sm {getStatusBadge(purchase.status).class}"
              >
                {getStatusBadge(purchase.status).text}
              </div>
            </td>
            <td class="text-xs">
              {formatDateOrNull(purchase.orderDate)}
            </td>
            <td class="text-xs">
              {formatDateOrNull(purchase.deliveryDate)}
            </td>
            <td>{purchase.price ? `${purchase.price}€` : "-"}</td>
            <td>{purchase.notes || "-"}</td>
            {#if !isArchiveMode}
              <td>
                <div class="btn-group btn-group-sm">
                  <button
                    class="btn btn-ghost btn-sm"
                    onclick={() => handleStartEdit(purchase)}
                  >
                    <SquarePen class="h-4 w-4" />
                  </button>
                  <button
                    class="btn btn-ghost btn-sm text-error"
                    onclick={() => handleDeletePurchase(purchase.$id)}
                    disabled={modalState.loading}
                  >
                    {#if modalState.loading}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <X class="h-4 w-4" />
                    {/if}
                  </button>
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <!-- Mobile Card View -->
  <div class="mt-4 space-y-3">
    {#each modalState.purchasesList as purchase (purchase.$id)}
      <div class="card bg-base-100 border-neutral/40 card-xs border shadow-sm">
        <div class="card-body p-4">
          <div class="flex items-center justify-between gap-3">
            <!-- Quantité + Prix + Statut -->
            <div class="flex flex-wrap items-center gap-4 text-base">
              <div class="flex items-center gap-2">
                <Weight class="size-4" />
                <span class="font-medium">
                  {formatSingleQuantity(purchase.quantity, purchase.unit)}
                </span>
              </div>
              <div class="">
                {purchase.price ? purchase.price : "?"}
                <Euro class="me-1 inline size-4" />
              </div>
              <!-- Statut badge -->
              <div class="badge {getStatusBadge(purchase.status).class}">
                {getStatusBadge(purchase.status).text}
              </div>
            </div>

            <!-- Bouton suppression en haut à droite -->
            {#if !isArchiveMode}
              <button
                class="btn btn-ghost btn-square btn-sm text-error"
                onclick={() => handleDeletePurchase(purchase.$id)}
                disabled={modalState.loading}
              >
                {#if modalState.loading}
                  <span class="loading loading-spinner loading-xs"></span>
                {:else}
                  <Trash2 size={16} />
                {/if}
              </button>
            {/if}
          </div>

          <!-- Dates -->
          <div class="mt-2 flex flex-wrap gap-3 text-sm">
            {#if purchase.orderDate}
              <div class="flex items-center gap-1 opacity-70">
                <Calendar class="size-3.5" />
                <span>Commande: {formatDateOrNull(purchase.orderDate)}</span>
              </div>
            {/if}
            {#if purchase.status === "ordered"}
              <div class="flex items-center gap-1 opacity-70">
                <Calendar class="size-3.5" />
                <span
                  >Livraison: {purchase.deliveryDate
                    ? formatDateOrNull(purchase.deliveryDate)
                    : "non renseigné"}</span
                >
              </div>
            {/if}
          </div>

          <!-- Notes -->
          {#if purchase.notes}
            <div class="mt-2 text-sm opacity-70">
              <MessageCircle class="me-1 inline size-3.5" />
              {purchase.notes}
            </div>
          {/if}

          <!-- Magasin et Qui -->
          <div class="mt-3 flex flex-wrap gap-3">
            {#if purchase.store}
              <div class="badge badge-soft gap-1">
                <Store class="h-3 w-3" />
                <span class="max-w-37.5 truncate">{purchase.store}</span>
              </div>
            {/if}
            {#if purchase.who}
              <div class="badge badge-soft gap-1">
                <User class="size-3.5" />
                <span class="max-w-25 truncate">{purchase.who}</span>
              </div>
            {/if}
          </div>

          <!-- Bouton édition en bas à droite -->
          {#if !isArchiveMode}
            <div class="card-actions mt-2 justify-end">
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => handleStartEdit(purchase)}
              >
                <SquarePen size={16} class="mr-1" />
                Modifier
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<script lang="ts">
  import { Archive, Package, SquarePen } from "@lucide/svelte";
  import type { ProductModalStateType } from "$lib/types/store.types.js";
  import { formatDate } from "$lib/utils/products-display.js";
  import { convertAndFormatQuantity } from "$lib/utils/QuantityFormatter.js";
  import InfoCollapse from "$lib/components/ui/InfoCollapse.svelte";
  import ArchiveMessage from "./ArchiveMessage.svelte";
  import QuantityInput from "$lib/components/ui/QuantityInput.svelte";
  import CommentTextarea from "$lib/components/ui/CommentTextarea.svelte";
  import { formatDateDayMonthShort } from "@/lib/utils/date-helpers";

  interface Props {
    modalState: ProductModalStateType;
    isArchiveMode?: boolean;
  }

  let { modalState, isArchiveMode = false }: Props = $props();

  // État local pour le mode édition
  let isEditMode = $state(false);

  // Données dérivées du store

  async function handleSetStock() {
    await modalState?.setStock();
    isEditMode = false; // Sortir du mode édition après sauvegarde
  }

  async function handleDeleteStock() {
    await modalState?.removeStock();
  }

  function startEdit() {
    if (!modalState.stockParsed) return;

    // Convertir les quantités pour l'affichage (≥1000 → kg/l.)
    const { value: displayQuantity, unit: displayUnit } =
      convertAndFormatQuantity(
        modalState.stockParsed.quantity,
        modalState.stockParsed.unit,
      );

    // Pré-remplir le formulaire avec les valeurs existantes
    modalState.forms.stock.quantity = displayQuantity;
    modalState.forms.stock.unit = displayUnit;
    modalState.forms.stock.notes = modalState.stockParsed.notes ?? "";
    modalState.forms.stock.dateTime = modalState.stockParsed.dateTime;

    isEditMode = true;
  }

  function cancelEdit() {
    isEditMode = false;
    // Réinitialiser le formulaire
    modalState.forms.stock.quantity = null;
    modalState.forms.stock.notes = "";
    modalState.forms.stock.dateTime = new Date().toISOString();
  }
</script>

<div class="space-y-4">
  {#if isArchiveMode}
    <ArchiveMessage
      title="Stock non modifiable"
      message="L'événement est terminé, le stock ne peut plus être modifié."
      data={modalState.stockParsed}
      dataLabel="Stock actuel"
    />
  {:else}
    <!-- Formulaire de déclaration (affiché si PAS de stock OU en mode édition) -->
    {#if !modalState.stockParsed || isEditMode}
      <div
        class="card bg-base-200 {isEditMode
          ? 'ring-accent ring-2 ring-offset-2'
          : ''}"
      >
        <div class="card-body">
          <h4 class="card-title text-base">
            {isEditMode
              ? "Modifier le stock réel"
              : `Déclarer le stock réel du ${new Date().toLocaleDateString(
                  "fr-FR",
                  {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  },
                )}`}
          </h4>
          <div class="mb-4">
            <InfoCollapse
              initiallyOpen={true}
              contentVisible="Cette section permet de gérer le stock réel de l'ingrédient.
            "
            >
              Le stock réel est la quantité réelle du produit constaté dans le
              stock: <strong
                >il sera utilisé pour le calcul des quantités manquantes à se
                fournir à la place des achats / réccup déclarés antérieurement</strong
              >
              au stock. Les achats / réccup déclarés
              <strong>ultérieurement</strong> seront pris en compte dans le calcul
              des quantités manquantes à se fournir.
            </InfoCollapse>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <QuantityInput
              bind:quantity={modalState.forms.stock.quantity}
              bind:unit={modalState.forms.stock.unit}
              disabled={modalState.loading}
            />
          </div>

          <div>
            <CommentTextarea
              bind:value={modalState.forms.stock.notes}
              disabled={modalState.loading}
            />
          </div>
          <div class="card-actions mt-4 justify-end">
            {#if isEditMode}
              <button
                class="btn btn-ghost btn-sm"
                onclick={cancelEdit}
                disabled={modalState.loading}
              >
                Annuler
              </button>
            {/if}
            <button
              class="btn btn-ghost btn-sm {!isEditMode ? '' : 'hidden'}"
              onclick={() => {
                modalState.forms.stock.quantity = null;
                modalState.forms.stock.notes = "";
              }}
              disabled={modalState.loading}
            >
              Effacer
            </button>
            <button
              class="btn btn-primary btn-sm"
              onclick={handleSetStock}
              disabled={modalState.loading || !modalState.forms.stock.quantity}
            >
              {#if modalState.loading}
                <span class="loading loading-spinner loading-xs"></span>
              {:else}
                {isEditMode
                  ? "Enregistrer les modifications"
                  : "Déclarer le stock"}
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if !modalState.stockParsed}
  <div class="py-8 text-center opacity-50">
    <Archive class="mx-auto mb-2 h-12 w-12" />
    <p>Aucun stock enregistré pour ce produit</p>
  </div>
{:else}
  <!-- Affichage du stock existant (masqué en mode édition) -->
  {#if !isEditMode}
    <div class="card bg-base-300 my-4">
      <div class="card-body">
        <div class="flex flex-wrap items-center gap-4 text-lg font-medium">
          <div class="">Stock enregistré :</div>
          <div class="badge badge-primary badge-lg ml-2">
            {modalState.stockParsed.quantity}
            {modalState.stockParsed.unit}
          </div>
          <div>
            <span class="font-semibold">le:</span>
            <span class="ml-2"
              >{formatDateDayMonthShort(modalState.stockParsed.dateTime)}</span
            >
          </div>
          {#if modalState.stockParsed.notes}
            <div class="md:col-span-2">
              <span class="font-semibold">Notes:</span>
              <span class="ml-2">{modalState.stockParsed.notes}</span>
            </div>
          {/if}
        </div>
        {#if !isArchiveMode}
          <div class="card-actions mt-4 justify-end space-x-4">
            <button
              class="btn btn-error btn-sm"
              onclick={handleDeleteStock}
              disabled={modalState.loading}
            >
              {#if modalState.loading}
                <span class="loading loading-spinner loading-xs"></span>
              {:else}
                Supprimer le stock
              {/if}
            </button>

            <button
              class="btn btn-primary btn-sm"
              onclick={startEdit}
              disabled={modalState.loading}
            >
              <SquarePen class="mr-1 h-4 w-4" />
              Modifier
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
</style>

<script lang="ts">
  import {
    X,
    Check,
    Package,
    AlertTriangle,
    Wrench,
    Zap,
    ChefHat,
    Utensils,
    Flame,
    SoapDispenserDroplet,
    Box,
  } from "@lucide/svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import type {
    EnrichedMaterielLoan,
    MaterielLoanItem,
  } from "$lib/types/materiel.types";
  import type { MaterielLoan } from "$lib/types/appwrite";

  interface MaterielReturnItem {
    materielId: string;
    materielName: string;
    quantity: number; // Quantité empruntée
    type: string;
    lostQuantity: number;
    brokenQuantity: number;
  }

  interface Props {
    isOpen: boolean;
    loan: EnrichedMaterielLoan;
    onClose: () => void;
  }

  let { isOpen, loan, onClose }: Props = $props();

  let returnItems = $state<MaterielReturnItem[]>([]);
  let returnNotes = $state("");
  let loading = $state(false);

  // Les matériels sont déjà parsés dans le store ✅
  $effect(() => {
    if (!loan) return;

    const items = loan.materielItems;

    returnItems = items.map((item) => ({
      materielId: item.materielId,
      materielName: item.materielName,
      quantity: item.quantity,
      type: "",
      lostQuantity: 0,
      brokenQuantity: 0,
    }));

    // Récupérer les types
    items.forEach((item) => {
      const materiel = materielStore.materiels.find(
        (m) => m.$id === item.materielId,
      );
      if (materiel) {
        const returnItem = returnItems.find(
          (ri) => ri.materielId === item.materielId,
        );
        if (returnItem) {
          returnItem.type = materiel.type || "";
        }
      }
    });
  });

  const isValid = $derived(
    returnItems.every(
      (item) =>
        item.lostQuantity >= 0 &&
        item.brokenQuantity >= 0 &&
        item.lostQuantity + item.brokenQuantity <= item.quantity,
    ) && !loading,
  );

  const totalLost = $derived(
    returnItems.reduce((sum, item) => sum + item.lostQuantity, 0),
  );

  const totalBroken = $derived(
    returnItems.reduce((sum, item) => sum + item.brokenQuantity, 0),
  );

  function handleQuantityChange(
    materielId: string,
    field: "lostQuantity" | "brokenQuantity",
    value: number,
  ) {
    returnItems = returnItems.map((item) =>
      item.materielId === materielId
        ? { ...item, [field]: Math.max(0, Math.min(value, item.quantity)) }
        : item,
    );
  }

  async function handleSubmit() {
    if (!isValid) return;

    loading = true;

    try {
      // Préparer les items mis à jour
      const updatedMateriels = returnItems.map((item) => ({
        materielId: item.materielId,
        materielName: item.materielName,
        quantity: item.quantity,
        lostQuantity: item.lostQuantity > 0 ? item.lostQuantity : undefined,
        brokenQuantity:
          item.brokenQuantity > 0 ? item.brokenQuantity : undefined,
      }));

      // Mettre à jour le loan avec status returned
      await materielStore.updateLoan(loan.$id, {
        materiels: updatedMateriels,
        status: "returned",
        returnedAt: new Date().toISOString(),
        returnNotes: returnNotes.trim() || undefined,
      });

      // TODO: Mettre à jour les Materiel affectés
      // - Déduire lostQuantity de la quantité totale
      // - Mettre status="torepair" si brokenQuantity > 0

      onClose();
    } catch (error) {
      console.error("Erreur retour emprunt:", error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    returnNotes = "";
    onClose();
  }

  // Icône du type
  function getTypeIcon(type: string) {
    switch (type) {
      case "electronic":
        return Zap;
      case "manual":
        return Wrench;
      case "cooking":
        return ChefHat;
      case "dish":
        return Utensils;
      case "gaz":
        return Flame;
      case "hygiene":
        return SoapDispenserDroplet;
      default:
        return Box;
    }
  }
</script>

<div class="modal {isOpen && 'modal-open'}">
  <div
    class="modal-box fixed top-0 flex h-lvh w-lvw flex-col overflow-auto md:top-10 md:h-full md:max-h-11/12 md:w-full md:max-w-3xl"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b p-4 pt-0">
      <div>
        <h3 class="text-lg font-bold">Retour d'emprunt</h3>
        <p class="text-sm opacity-70">
          Du {new Date(loan.startDate).toLocaleDateString("fr-FR")} au {new Date(
            loan.endDate,
          ).toLocaleDateString("fr-FR")}
        </p>
      </div>
      <button
        class="btn btn-circle btn-ghost btn-sm absolute top-2 right-2"
        onclick={handleClose}
        aria-label="Fermer"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- Contenu principal -->
    <div class="flex-1 space-y-6 overflow-y-auto p-4">
      <!-- Liste des matériels -->
      <div class="space-y-4">
        <h4 class="text-sm font-semibold uppercase opacity-70">
          Matériel à retourner
        </h4>

        {#each returnItems as item (item.materielId)}
          {@const TypeIcon = getTypeIcon(item.type)}
          {@const hasIssues = item.lostQuantity > 0 || item.brokenQuantity > 0}

          <div class="border-base-300 bg-base-100 rounded-lg border p-4">
            <div class="mb-3 flex items-start gap-3">
              <div class="bg-primary/10 rounded-lg p-2">
                <TypeIcon class="text-primary h-5 w-5" />
              </div>
              <div class="flex-1">
                <div class="font-semibold">{item.materielName}</div>
                <div class="text-sm opacity-70">
                  Quantité empruntée : {item.quantity}
                </div>
              </div>
            </div>

            <div class="ml-10 space-y-3">
              <!-- Tout est OK (par défaut) -->
              <label class="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox checkbox-success checkbox-sm mt-1"
                  checked={item.lostQuantity === 0 && item.brokenQuantity === 0}
                  onchange={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.checked) {
                      item.lostQuantity = 0;
                      item.brokenQuantity = 0;
                    }
                  }}
                  disabled={loading}
                />
                <div class="text-sm">
                  <div class="font-medium">Tout est OK</div>
                  <div class="opacity-60">Aucune perte ni casse</div>
                </div>
              </label>

              <!-- Pièces perdues -->
              <div class="space-y-2">
                <label class="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-error checkbox-sm mt-1"
                    checked={item.lostQuantity > 0}
                    onchange={(e) => {
                      const target = e.target as HTMLInputElement;
                      item.lostQuantity = target.checked ? 1 : 0;
                    }}
                    disabled={loading}
                  />
                  <div class="flex-1 text-sm">
                    <div class="flex items-center gap-2 font-medium">
                      <AlertTriangle class="h-3 w-3" />
                      Des pièces sont perdues
                    </div>
                  </div>
                </label>

                {#if item.lostQuantity > 0}
                  <div class="ml-8">
                    <label class="input input-sm w-32">
                      <span class="label text-xs">Qté perdue:</span>
                      <input
                        type="number"
                        class="grow"
                        min="0"
                        max={item.quantity - item.brokenQuantity}
                        bind:value={item.lostQuantity}
                        disabled={loading}
                      />
                    </label>
                  </div>
                {/if}
              </div>

              <!-- Pièces cassées -->
              <div class="space-y-2">
                <label class="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-warning checkbox-sm mt-1"
                    checked={item.brokenQuantity > 0}
                    onchange={(e) => {
                      const target = e.target as HTMLInputElement;
                      item.brokenQuantity = target.checked ? 1 : 0;
                    }}
                    disabled={loading}
                  />
                  <div class="flex-1 text-sm">
                    <div class="flex items-center gap-2 font-medium">
                      <Wrench class="h-3 w-3" />
                      Des pièces sont cassées
                    </div>
                    <div class="text-xs opacity-60">
                      À réparer (status: torepair)
                    </div>
                  </div>
                </label>

                {#if item.brokenQuantity > 0}
                  <div class="ml-8">
                    <label class="input input-sm w-32">
                      <span class="label text-xs">Qté cassée:</span>
                      <input
                        type="number"
                        class="grow"
                        min="0"
                        max={item.quantity - item.lostQuantity}
                        bind:value={item.brokenQuantity}
                        disabled={loading}
                      />
                    </label>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Résumé -->
      {#if totalLost > 0 || totalBroken > 0}
        <div class="alert alert-warning">
          <AlertTriangle class="h-5 w-5" />
          <div>
            <h4 class="font-bold">
              Attention : {totalLost + totalBroken} unité{totalLost +
                totalBroken >
              1
                ? "s"
                : ""} problématique{totalLost + totalBroken > 1 ? "s" : ""}
            </h4>
            <div class="text-sm">
              {#if totalLost > 0}
                <div class="text-error">
                  • {totalLost} perdue{totalLost > 1 ? "s" : ""} (déduit du stock)
                </div>
              {/if}
              {#if totalBroken > 0}
                <div class="text-warning">
                  • {totalBroken} cassée{totalBroken > 1 ? "s" : ""} (à réparer)
                </div>
              {/if}
            </div>
          </div>
        </div>
        ){/if}

      <!-- Notes de retour -->
      <fieldset class="fieldset bg-base-100">
        <legend class="fieldset-legend">Notes de retour (optionnel)</legend>
        <textarea
          class="textarea textarea-bordered w-full"
          rows="3"
          bind:value={returnNotes}
          placeholder="Précisez l'état du matériel, les raisons des pertes/casses, etc."
          maxlength="1000"
          disabled={loading}
        ></textarea>
      </fieldset>
    </div>

    <!-- Footer -->
    <div class="border-base-300 flex-none border-t px-4 py-3">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button class="btn btn-ghost" onclick={handleClose} disabled={loading}>
          <X class="h-5 w-5" />
          Annuler
        </button>
        <button
          class="btn btn-warning"
          onclick={handleSubmit}
          disabled={!isValid}
        >
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Check class="h-5 w-5" />
          {/if}
          Valider le retour
        </button>
      </div>
    </div>
  </div>
</div>

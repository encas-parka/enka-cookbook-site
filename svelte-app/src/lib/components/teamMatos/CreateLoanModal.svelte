<script lang="ts">
  import {
    Calendar,
    Package,
    X,
    Check,
    Sparkles,
    Hash,
    User,
    Zap,
    Wrench,
    ChefHat,
    Utensils,
    Flame,
    SoapDispenserDroplet,
    Box,
    Info,
    LoaderCircle,
  } from "@lucide/svelte";
  import AutocompleteInput from "../ui/AutocompleteInput.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import type {
    EnrichedMateriel,
    EnrichedMaterielLoan,
  } from "$lib/types/materiel.types";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import QuickMaterielSelectionModal from "./QuickMaterielSelectionModal.svelte";

  // Types
  type MaterielTypeLiteral =
    | "electronic"
    | "manual"
    | "other"
    | "tools"
    | "dish"
    | "cooking"
    | "gaz"
    | "hygiene"
    | "";

  // Mode du modal : création ou édition
  type Mode = "create" | "edit";

  interface SelectedMateriel {
    materielId: string;
    materielName: string;
    quantity: number;
    type: MaterielTypeLiteral;
    maxQuantity: number; // Quantité disponible sur la période
  }

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    ownerId: string; // ID de l'équipe propriétaire
    ownerName: string; // Nom de l'équipe
    loanId?: string; // Optionnel : ID du loan à modifier (mode édition)
  }

  let { isOpen, onClose, onSuccess, ownerId, ownerName, loanId }: Props =
    $props();

  // Mode dérivé : édition si loanId est fourni
  let mode = $derived<Mode>(loanId ? "edit" : "create");

  // État du formulaire
  let startDate = $state("");
  let endDate = $state("");
  let notes = $state("");
  let selectedMateriels = $state<SelectedMateriel[]>([]);
  let loanStatus = $state<any>("accepted"); // Statut de l'emprunt (forcé à "accepted")

  // UI state
  let showQuickSelection = $state(false);
  let loading = $state(false);
  let loadingLoan = $state(false); // Chargement du loan en mode édition
  let existingLoan = $state<EnrichedMaterielLoan | null>(null); // Loan existant en mode édition

  // État pour afficher les conflits (matériels supprimés/ajustés)
  let displayConflicts = $state<{
    count: number;
    removed: string[];
  }>({ count: 0, removed: [] });

  // Flag pour éviter la double exécution de l'effect
  let isProcessingConflicts = $state(false);

  // Dérivés - Matériels disponibles pour la période sélectionnée
  const availableMateriels = $derived.by(() => {
    if (!startDate || !endDate) {
      // Si pas de dates, retourner tous les matériels (fallback)
      return materielStore.getAvailableMaterielsByOwner(ownerId);
    }
    // Vérifier la disponibilité sur la période
    // En mode édition, exclure le loan actuel du calcul de disponibilité
    return materielStore.getAvailableMaterielsForPeriod(
      ownerId,
      startDate,
      endDate,
      mode === "edit" ? loanId : undefined,
    );
  }) as Array<EnrichedMateriel & { availableForPeriod?: number }>;

  // Dérivés - TOUS les matériels de l'équipe avec leur disponibilité sur la période
  const allMaterielsWithAvailability = $derived.by(() => {
    if (!startDate || !endDate) {
      // Si pas de dates, retourner tous les matériels avec availableQuantity
      return materielStore.getMaterielsByOwner(ownerId).map((m) => ({
        ...m,
        availableForPeriod: m.availableQuantity,
      }));
    }

    // Récupérer tous les matériels de l'équipe
    const allMateriels = materielStore.getMaterielsByOwner(ownerId);

    // Récupérer les IDs des matériels disponibles
    const availableIds = new Set(availableMateriels.map((m) => m.$id));

    // Marquer les indisponibles
    return allMateriels.map((m) => {
      const available = availableMateriels.find((a) => a.$id === m.$id);
      return {
        ...m,
        availableForPeriod: available?.availableForPeriod || 0,
      };
    });
  }) as Array<EnrichedMateriel & { availableForPeriod?: number }>;

  const isValid = $derived(
    startDate !== "" &&
      endDate !== "" &&
      startDate < endDate &&
      selectedMateriels.length > 0 &&
      selectedMateriels.every((m) => m.quantity >= 1) &&
      globalState.userId !== null &&
      globalState.userId !== undefined &&
      !loading &&
      !loadingLoan,
  );

  // Effect pour détecter et gérer les conflits de disponibilité
  $effect(() => {
    // Réinitialiser displayConflicts et le flag
    if (!startDate || !endDate) {
      displayConflicts = { count: 0, removed: [] };
      isProcessingConflicts = false;
      return;
    }

    // Éviter la double exécution : si on est déjà en train de traiter des conflits, on skip
    if (isProcessingConflicts) {
      return;
    }

    // Détecter les matériels sélectionnés qui ne sont plus disponibles
    const removed: string[] = [];

    const updated = selectedMateriels
      .map((m) => {
        const available = availableMateriels.find(
          (a) => a.$id === m.materielId,
        );
        // Retirer complètement si indisponible
        if (
          !available ||
          available.availableForPeriod === undefined ||
          available.availableForPeriod === 0
        ) {
          removed.push(m.materielName);
          return null;
        }
        // Ajuster la quantité si nécessaire (mutation directe pour Svelte 5)
        if (m.quantity > available.availableForPeriod) {
          m.quantity = available.availableForPeriod;
          m.maxQuantity = available.availableForPeriod;
        }
        return m;
      })
      .filter((m): m is SelectedMateriel => m !== null);

    // Capturer les conflits pour l'affichage
    if (removed.length > 0) {
      displayConflicts = {
        count: removed.length,
        removed,
      };
    } else {
      displayConflicts = { count: 0, removed: [] };
    }
    // Mettre à jour selectedMateriels si nécessaire
    if (JSON.stringify(updated) !== JSON.stringify(selectedMateriels)) {
      isProcessingConflicts = true;
      selectedMateriels = updated;
    }
  });
  $effect(() => {
    // Se déclenche à chaque changement de isOpen, mode ou loanId
    if (isOpen) {
      if (mode === "edit" && loanId) {
        loadingLoan = true;
        const loan = materielStore.getLoanById(loanId);
        if (loan) {
          existingLoan = loan;
          // Charger les données du loan dans le formulaire
          startDate = loan.startDate.split("T")[0];
          endDate = loan.endDate.split("T")[0];
          notes = loan.notes || "";
          loanStatus = loan.status;

          // Charger les matériels sélectionnés
          selectedMateriels = loan.materielItems.map((item) => {
            const materiel = materielStore.getMaterielById(item.materielId);
            return {
              materielId: item.materielId,
              materielName: item.materielName,
              quantity: item.quantity,
              type: materiel?.type || "",
              maxQuantity: item.quantity, // Sera recalculé avec availableMateriels
            };
          });
        } else {
          toastService.error("Emprunt introuvable");
          onClose();
        }
        loadingLoan = false;
      } else if (mode === "create") {
        // Reset en mode création
        resetForm();
      }
    }
  });

  // Fonctions
  function handleAddMateriel(
    materiel: EnrichedMateriel & { availableForPeriod?: number },
  ) {
    // Récupérer la quantité disponible sur la période
    const maxQty =
      (materiel as any).availableForPeriod ?? materiel.availableQuantity;

    // Vérifier si déjà sélectionné
    const existing = selectedMateriels.find(
      (m) => m.materielId === materiel.$id,
    );
    if (existing) {
      // Augmenter la quantité si possible
      if (existing.quantity < maxQty) {
        existing.quantity++;
      }
      return;
    }

    // Ajouter avec quantité = 1
    selectedMateriels = [
      ...selectedMateriels,
      {
        materielId: materiel.$id,
        materielName: materiel.name,
        quantity: 1,
        type: materiel.type || "",
        maxQuantity: maxQty,
      },
    ];
  }

  function handleRemoveMateriel(materielId: string) {
    selectedMateriels = selectedMateriels.filter(
      (m) => m.materielId !== materielId,
    );
  }

  function handleQuantityChange(materielId: string, newQuantity: number) {
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId
        ? { ...m, quantity: Math.max(1, Math.min(newQuantity, m.maxQuantity)) }
        : m,
    );
  }

  function handleQuickSelectionAdd(materielIds: string[]) {
    materielIds.forEach((id) => {
      const materiel = availableMateriels.find((m) => m.$id === id);
      if (materiel) {
        handleAddMateriel(materiel);
      }
    });
    showQuickSelection = false;
  }

  async function handleSubmit() {
    if (!isValid) return;

    // Validation temporelle pour l'édition
    if (mode === "edit" && existingLoan) {
      const now = new Date();
      const loanEnd = new Date(existingLoan.endDate);

      // Vérifier que la date de fin n'est pas passée
      if (now > loanEnd) {
        toastService.error(
          "Impossible de modifier un emprunt dont la date est passée",
        );
        return;
      }

      // Vérifier que l'emprunt n'a pas déjà commencé
      const loanStart = new Date(existingLoan.startDate);
      if (now >= loanStart && startDate !== existingLoan.startDate) {
        toastService.error(
          "Impossible de modifier la date de début d'un emprunt en cours",
        );
        return;
      }
    }

    loading = true;

    try {
      const materielItems = selectedMateriels.map((m) => ({
        materielId: m.materielId,
        materielName: m.materielName,
        quantity: m.quantity,
      }));

      if (mode === "create") {
        // Création d'un nouvel emprunt
        const responsibleId = globalState.userId || "";
        const responsibleName = globalState.userName || "Inconnu";

        await materielStore.createLoan({
          startDate,
          endDate,
          responsibleId,
          responsibleName,
          ownerId,
          ownerName,
          materiels: materielItems,
          notes: notes.trim() || undefined,
          status: loanStatus,
        });

        toastService.success("Réservation créée avec succès");
      } else {
        // Mise à jour d'un emprunt existant
        if (!loanId) {
          throw new Error("loanId manquant en mode édition");
        }

        await materielStore.updateLoan(loanId, {
          startDate,
          endDate,
          materiels: materielItems,
          notes: notes.trim() || undefined,
        });

        toastService.success("Réservation modifiée avec succès");
      }

      // Reset et fermeture
      resetForm();
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error(
        mode === "create"
          ? "Erreur création emprunt:"
          : "Erreur mise à jour emprunt:",
        error,
      );
      toastService.error(
        mode === "create"
          ? "Erreur lors de la création de la réservation"
          : "Erreur lors de la modification de la réservation",
      );
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    startDate = "";
    endDate = "";
    notes = "";
    selectedMateriels = [];
    loanStatus = "accepted"; // Reset du statut (forcé à "accepted")
  }

  function handleClose() {
    resetForm();
    onClose();
  }
</script>

<div class="modal {isOpen && 'modal-open'}">
  <div
    class="modal-box fixed top-0 flex h-lvh w-lvw flex-col overflow-auto md:top-10 md:h-full md:max-h-11/12 md:w-full md:max-w-4xl"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b p-4 pt-0">
      <h3 class="flex items-center gap-2 text-lg font-bold">
        <Package class="h-5 w-5" />
        {mode === "create"
          ? `Nouvelle réservation - ${ownerName}`
          : `Modifier la réservation - ${ownerName}`}
      </h3>
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
      <!-- État de chargement initial en mode édition -->
      {#if mode === "edit" && loadingLoan}
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <LoaderCircle
              class="text-primary mx-auto mb-4 h-12 w-12 animate-spin"
            />
            <p class="text-lg font-medium">Chargement de la réservation...</p>
          </div>
        </div>
      {:else}
        <!-- Alerte de conflit de disponibilité -->
        {#if displayConflicts.count > 0}
          <div class="alert alert-warning alert-soft">
            <Info class="h-5 w-5" />
            <div>
              <p class="font-semibold">
                Certaines choses étaient déjà réservées sur ces dates et ont été
                retirées de la liste.
              </p>
              <p class="mt-1 text-sm opacity-80">
                {#if displayConflicts.removed.length > 0}
                  <span
                    >Retiré{displayConflicts.removed.length > 1 ? "s" : ""} :
                  </span>
                  <span class="font-medium"
                    >{displayConflicts.removed.join(", ")}</span
                  >
                {/if}
              </p>
            </div>
          </div>
        {/if}

        <!-- Section 1: Informations de l'emprunt -->
        <div class="space-y-4">
          <!-- Dates -->
          <div class="flex flex-wrap gap-4">
            <label class="input min-w-[200px] flex-1">
              <span class="label"
                ><Calendar class="h-4 w-4" />
                Date début *</span
              >
              <input
                type="date"
                class="grow"
                bind:value={startDate}
                disabled={loading}
              />
            </label>

            <label class="input min-w-[200px] flex-1">
              <span class="label"
                ><Calendar class="h-4 w-4" />
                Date fin *</span
              >
              <input
                type="date"
                class="grow"
                bind:value={endDate}
                disabled={loading}
                min={startDate}
              />
            </label>
          </div>

          <!-- Responsable (read-only, sera l'utilisateur actuel) -->
          <label class="input w-full">
            <span class="label"
              ><User class="h-4 w-4" />
              Responsable</span
            >
            <input
              type="text"
              class="grow"
              value={globalState.userName || "Utilisateur actuel"}
              disabled
            />
          </label>

          <!-- Notes -->
          <fieldset class="fieldset bg-base-100">
            <legend class="fieldset-legend">Notes (optionnel)</legend>
            <textarea
              class="textarea textarea-bordered w-full"
              rows="2"
              bind:value={notes}
              placeholder="Informations complémentaires sur l'emprunt..."
              maxlength="500"
              disabled={loading}
            ></textarea>
          </fieldset>
        </div>

        <!-- Section 2: Sélection du matériel -->
        <div class="space-y-4">
          <h4
            class="flex items-center gap-2 text-sm font-semibold uppercase opacity-70"
          >
            <Sparkles class="h-4 w-4" />
            Matériel à emprunter ({selectedMateriels.length})
          </h4>

          <!-- Message info si dates non définies -->
          {#if !startDate || !endDate}
            <div class="alert alert-info max-md:alert-vertical">
              <Info class="h-5 w-5" />
              <span>
                Veuillez sélectionner une <strong>date de début</strong> et une
                <strong>date de fin</strong> pour voir le matériel disponible sur
                cette période.
              </span>
            </div>
          {:else}
            <!-- Recherche + ajout rapide -->
            <div class="flex flex-wrap gap-6">
              <div class="flex-1">
                <AutocompleteInput
                  items={availableMateriels}
                  itemToString={(m) => m.name}
                  onSelect={(m) => handleAddMateriel(m)}
                  placeholder="Rechercher du matériel..."
                  disabled={loading}
                />
              </div>
              <button
                class="btn btn-secondary btn-md flex-1 gap-2"
                onclick={() => (showQuickSelection = true)}
                disabled={loading || availableMateriels.length === 0}
              >
                <Sparkles class="h-4 w-4" />
                Ajout rapide
              </button>
            </div>
            <!-- Info sur la disponibilité -->
            {#if availableMateriels.length === 0}
              <div class="alert alert-warning">
                <Info class="h-5 w-5" />
                <span>
                  Aucun matériel disponible pour la période sélectionnée.
                </span>
              </div>
            {/if}

            <!-- Alerte warning si conflits avec matériels sélectionnés -->
            {#if displayConflicts.count > 0}
              <div class="alert alert-warning alert-soft">
                <Info class="h-5 w-5" />
                <div>
                  <p class="font-semibold">
                    {displayConflicts.count} matériel{displayConflicts.count > 1
                      ? "s"
                      : ""}
                    sélectionné{displayConflicts.count > 1 ? "s" : ""} devenu{displayConflicts.count >
                    1
                      ? "s"
                      : ""}
                    indisponible{displayConflicts.count > 1 ? "s" : ""} avec les nouvelles
                    dates
                  </p>
                  <p class="mt-1 text-sm opacity-80">
                    {#if displayConflicts.removed.length > 0}
                      <span
                        >Retiré{displayConflicts.removed.length > 1 ? "s" : ""} :
                      </span>
                      <span class="font-medium"
                        >{displayConflicts.removed.join(", ")}</span
                      >
                    {/if}
                  </p>
                </div>
              </div>
            {/if}
          {/if}

          <!-- Liste des matériels sélectionnés -->
          {#if selectedMateriels.length > 0}
            <div class="space-y-2">
              <p class="text-sm font-semibold opacity-70">
                Matériels sélectionnés
              </p>
              {#each selectedMateriels as materiel (materiel.materielId)}
                {@const TypeIcon =
                  materiel.type === "electronic"
                    ? Zap
                    : materiel.type === "manual"
                      ? Wrench
                      : materiel.type === "cooking"
                        ? ChefHat
                        : materiel.type === "dish"
                          ? Utensils
                          : materiel.type === "gaz"
                            ? Flame
                            : materiel.type === "hygiene"
                              ? SoapDispenserDroplet
                              : Box}

                <div class="bg-base-200 rounded-lg p-2">
                  <div class="flex items-center gap-2">
                    <!-- Icone type -->
                    <div class="bg-base-300 rounded p-1">
                      <TypeIcon class="h-4 w-4 opacity-70" />
                    </div>

                    <!-- Nom + dispo -->
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-medium">
                        {materiel.materielName}
                      </div>
                      <div class="text-xs opacity-70">
                        Disponible : <span class="font-semibold"
                          >{materiel.maxQuantity}</span
                        >
                      </div>
                    </div>

                    <!-- Quantité -->
                    <div class="flex items-center gap-1">
                      <span class="text-sm opacity-70">
                        <Hash class="inline h-3 w-3" />
                      </span>
                      <label class="select join">
                        <select
                          class="join-item select-sm select-bordered w-20"
                          bind:value={materiel.quantity}
                          onchange={(e) => {
                            const target = e.target as HTMLSelectElement;
                            handleQuantityChange(
                              materiel.materielId,
                              parseInt(target.value),
                            );
                          }}
                          disabled={loading}
                        >
                          {#each Array(materiel.maxQuantity) as _, i (i)}
                            <option value={i + 1}>{i + 1}</option>
                          {/each}
                        </select>
                      </label>
                    </div>

                    <!-- Supprimer -->
                    <button
                      class="btn btn-ghost btn-xs btn-circle"
                      onclick={() => handleRemoveMateriel(materiel.materielId)}
                      disabled={loading}
                      aria-label="Supprimer"
                    >
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="py-8 text-center opacity-50">
              <Package class="mx-auto mb-2 h-12 w-12" />
              <p class="text-sm">Aucun matériel sélectionné</p>
              <p class="text-xs">
                Utilisez la recherche ou l'ajout rapide pour ajouter du matériel
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="border-base-300 flex-none border-t px-4 py-3">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          class="btn btn-ghost"
          onclick={handleClose}
          disabled={loading || loadingLoan}
        >
          <X class="h-5 w-5" />
          Annuler
        </button>
        <button
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={!isValid}
        >
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Check class="h-5 w-5" />
          {/if}
          {mode === "create" ? "Créer l'emprunt" : "Sauvegarder"}
        </button>
      </div>
    </div>
  </div>

  <!-- Modal de sélection rapide -->
  {#if showQuickSelection}
    <QuickMaterielSelectionModal
      isOpen={showQuickSelection}
      onClose={() => (showQuickSelection = false)}
      onAdd={handleQuickSelectionAdd}
      selectedIds={new Set(selectedMateriels.map((m) => m.materielId))}
      materiels={allMaterielsWithAvailability}
    />
  {/if}
</div>

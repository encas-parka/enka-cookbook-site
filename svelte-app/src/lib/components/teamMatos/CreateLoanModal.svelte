<script lang="ts">
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import type {
    EnrichedMateriel,
    EnrichedMaterielLoan,
  } from "$lib/types/materiel.types";
  import {
    Box,
    Calendar,
    Check,
    ChefHat,
    Flame,
    Info,
    LoaderCircle,
    Minus,
    Package,
    Plus,
    SoapDispenserDroplet,
    Sparkles,
    User,
    Utensils,
    Wrench,
    X,
    Zap,
  } from "@lucide/svelte";
  import AutocompleteInput from "../ui/AutocompleteInput.svelte";
  import ModalContainer from "../ui/modal/ModalContainer.svelte";
  import ModalContent from "../ui/modal/ModalContent.svelte";
  import ModalFooter from "../ui/modal/ModalFooter.svelte";
  import ModalHeader from "../ui/modal/ModalHeader.svelte";
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
    preselectedEventId?: string; // Optionnel : eventId pré-sélectionné en mode création
  }

  let {
    isOpen,
    onClose,
    onSuccess,
    ownerId,
    ownerName,
    loanId,
    preselectedEventId,
  }: Props = $props();

  // Mode dérivé : édition si loanId est fourni
  let mode = $derived<Mode>(loanId ? "edit" : "create");

  // État du formulaire
  let startDate = $state("");
  let endDate = $state("");
  let notes = $state("");
  let selectedMateriels = $state<SelectedMateriel[]>([]);
  let loanStatus = $state<any>("accepted"); // Statut de l'emprunt (forcé à "accepted")
  let selectedEventId = $state<string | null>(null); // ID de l'event sélectionné

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

  // Flag pour éviter la double exécution de l'effet de conflits
  let isProcessingConflicts = $state(false);

  // Flag pour indiquer si l'utilisateur a modifié manuellement les dates
  let userHasModifiedDates = $state(false);

  // Helper pour ajouter/supprimer des jours à une date
  // Gère les formats YYYY-MM-DD et ISO complet (2025-04-15T10:30:00.000Z)
  function addDays(dateStr: string, days: number): string {
    // Parser la date - works avec les deux formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error("[CreateLoanModal] Date invalide:", dateStr);
      return dateStr; // Retourner tel quel en cas d'erreur
    }
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  // Helper pour formater une date au format "lun. 1 janv."
  function formatShortDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const jourCourt = date.toLocaleDateString("fr-FR", { weekday: "short" });
    const jour = date.getDate();
    const moisCourt = date.toLocaleDateString("fr-FR", { month: "short" });
    return `${jourCourt} ${jour} ${moisCourt}.`;
  }

  // Effet pour pré-remplir les dates depuis l'événement sélectionné (mode création uniquement)
  $effect(() => {
    if (mode === "create" && selectedEventId && !userHasModifiedDates) {
      const event = availableEvents.find((e) => e.$id === selectedEventId);
      if (event && event.dateStart && event.dateEnd) {
        startDate = addDays(event.dateStart, -1);
        endDate = addDays(event.dateEnd, 1);
      }
    }
  });

  // Effet pour réinitialiser le flag quand l'événement change
  $effect(() => {
    selectedEventId; // Dépendance explicite
    userHasModifiedDates = false;
  });

  // Liste des événements disponibles pour la liaison
  const availableEvents = $derived.by(() => {
    return eventsStore.events.filter((e) => e.status !== "canceled");
  });

  // Événement sélectionné (pour affichage des dates)
  const selectedEvent = $derived(
    selectedEventId
      ? availableEvents.find((e) => e.$id === selectedEventId)
      : null,
  );

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
      selectedMateriels.some((m) => m.quantity >= 1) &&
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
          selectedEventId = loan.eventId || null; // Charger l'event lié
          userHasModifiedDates = true; // Dates pré-remplies, l'utilisateur peut les modifier

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
        // Reset en mode création avec pré-sélection éventuelle
        resetForm();
        if (preselectedEventId) {
          selectedEventId = preselectedEventId;
        }
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

  function getStep(maxQuantity: number): number {
    if (maxQuantity <= 15) return 1;
    return 5;
  }

  function handleQuantityChange(materielId: string, newQuantity: number) {
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId
        ? { ...m, quantity: Math.max(0, Math.min(newQuantity, m.maxQuantity)) }
        : m,
    );
  }

  function handleTakeAll() {
    selectedMateriels = selectedMateriels.map((m) => ({
      ...m,
      quantity: m.maxQuantity,
    }));
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
      const materielItems = selectedMateriels
        .filter((m) => m.quantity >= 1)
        .map((m) => ({
          materielId: m.materielId,
          materielName: m.materielName,
          quantity: m.quantity,
        }));

      if (mode === "create") {
        // Création d'un nouvel emprunt
        const responsibleId = globalState.userId || "";
        const responsibleName = globalState.userName || "Inconnu";

        // Récupérer le nom de l'event sélectionné
        const selectedEvent = selectedEventId
          ? availableEvents.find((e) => e.$id === selectedEventId)
          : null;

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
          eventId: selectedEventId,
          eventName: selectedEvent?.name || null,
        });

        toastService.success("Réservation créée avec succès");
      } else {
        // Mise à jour d'un emprunt existant
        if (!loanId) {
          throw new Error("loanId manquant en mode édition");
        }

        // Récupérer le nom de l'event sélectionné
        const selectedEvent = selectedEventId
          ? availableEvents.find((e) => e.$id === selectedEventId)
          : null;

        await materielStore.updateLoan(loanId, {
          startDate,
          endDate,
          materiels: materielItems,
          notes: notes.trim() || undefined,
          eventId: selectedEventId,
          eventName: selectedEvent?.name || null,
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
    selectedEventId = null; // Reset de l'event sélectionné
    userHasModifiedDates = false; // Reset du flag de modification manuelle
  }

  function handleClose() {
    resetForm();
    onClose();
  }
</script>

<ModalContainer {isOpen} onClose={handleClose} maxWidth="lg">
  <ModalHeader
    title={mode === "create"
      ? `Nouvelle réservation - ${ownerName}`
      : `Modifier la réservation - ${ownerName}`}
    onClose={handleClose}
    showBackButton={false}
  />

  <ModalContent>
    <div class="space-y-6">
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
          <!-- Lien événement (optionnel) -->
          <label class="select w-full">
            <span class="label"
              ><Package class="h-4 w-4" />
              Événement lié ?</span
            >
            <select
              disabled={loading}
              value={selectedEventId || ""}
              onchange={(e) => {
                const target = e.target as HTMLSelectElement;
                selectedEventId = target.value || null;
              }}
            >
              <option value="">Aucun événement</option>
              {#each availableEvents as event (event.$id)}
                <option value={event.$id}>{event.name}</option>
              {/each}
            </select>
          </label>

          <!-- Dates -->
          <div class="flex flex-wrap gap-4">
            <label class="input min-w-50 flex-1">
              <span class="label"
                ><Calendar class="h-4 w-4" />
                Date début *</span
              >
              <input
                type="date"
                class="grow"
                bind:value={startDate}
                oninput={() => (userHasModifiedDates = true)}
                disabled={loading}
              />
            </label>

            <label class="input min-w-50 flex-1">
              <span class="label"
                ><Calendar class="h-4 w-4" />
                Date fin *</span
              >
              <input
                type="date"
                class="grow"
                bind:value={endDate}
                oninput={() => (userHasModifiedDates = true)}
                disabled={loading}
                min={startDate}
              />
            </label>
          </div>

          <!-- Info dates de l'événement -->
          {#if selectedEvent && selectedEvent.dateStart && selectedEvent.dateEnd}
            <p class="text-base-content/50 -mt-2 px-1 text-sm">
              L'événement aura lieu du <span class="font-medium"
                >{formatShortDate(selectedEvent.dateStart)}</span
              >
              au
              <span class="font-medium"
                >{formatShortDate(selectedEvent.dateEnd)}</span
              >
            </p>
          {/if}

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
              class="textarea w-full"
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
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold opacity-70">
                  Matériels sélectionnés
                </p>
                {#if selectedMateriels.some((m) => m.maxQuantity > m.quantity)}
                  <button
                    class="link link-primary text-xs font-medium"
                    onclick={handleTakeAll}
                    disabled={loading}
                  >
                    Tout prendre
                  </button>
                {:else}
                  <span class="text-xs font-medium">Tout pris</span>
                {/if}
              </div>
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

                <div
                  class="bg-base-200 rounded-lg p-2 transition-opacity {materiel.quantity ===
                  0
                    ? 'opacity-40'
                    : ''}"
                >
                  <div class="flex items-center gap-2">
                    <!-- Icone type -->
                    <div class="bg-base-300 rounded p-1">
                      <TypeIcon class="h-4 w-4 opacity-70" />
                    </div>

                    <!-- Nom + dispo -->
                    <div
                      class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
                    >
                      <div
                        class="truncate font-medium {materiel.quantity === 0
                          ? 'line-through'
                          : ''}"
                      >
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
                      <button
                        class="btn btn-ghost btn-xs btn-circle hidden sm:flex"
                        onclick={() =>
                          handleQuantityChange(
                            materiel.materielId,
                            materiel.quantity - getStep(materiel.maxQuantity),
                          )}
                        disabled={loading || materiel.quantity <= 0}
                        aria-label="Diminuer"
                      >
                        <Minus class="size-3" />
                      </button>
                      <input
                        type="number"
                        class="input input-sm w-16 [appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        min={0}
                        max={materiel.maxQuantity}
                        step={getStep(materiel.maxQuantity)}
                        value={materiel.quantity}
                        onchange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleQuantityChange(
                            materiel.materielId,
                            parseInt(target.value) || 0,
                          );
                        }}
                        disabled={loading}
                      />
                      <button
                        class="btn btn-ghost btn-xs btn-circle hidden sm:flex"
                        onclick={() =>
                          handleQuantityChange(
                            materiel.materielId,
                            materiel.quantity + getStep(materiel.maxQuantity),
                          )}
                        disabled={loading ||
                          materiel.quantity >= materiel.maxQuantity}
                        aria-label="Augmenter"
                      >
                        <Plus class="size-3" />
                      </button>

                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() =>
                          handleQuantityChange(
                            materiel.materielId,
                            materiel.maxQuantity,
                          )}
                        disabled={loading ||
                          materiel.quantity >= materiel.maxQuantity}
                      >
                        tout
                      </button>
                    </div>
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
  </ModalContent>

  <ModalFooter>
    <button
      class="btn btn-ghost btn-sm"
      onclick={handleClose}
      disabled={loading || loadingLoan}
    >
      <X class="h-5 w-5" />
      Annuler
    </button>
    <button
      class="btn btn-primary btn-sm"
      onclick={handleSubmit}
      disabled={!isValid}
    >
      {#if loading}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <Check class="h-5 w-5" />
      {/if}
      {mode === "create" ? "Créer" : "Sauvegarder"}
    </button>
  </ModalFooter>
</ModalContainer>

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

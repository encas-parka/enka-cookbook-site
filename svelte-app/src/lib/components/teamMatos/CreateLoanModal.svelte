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
    AlertCircle,
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
    Trash2,
    User,
    Utensils,
    Wrench,
    X,
    Zap,
  } from "@lucide/svelte";
  import AutocompleteInput from "../ui/AutocompleteInput.svelte";
  import ConfirmModal from "../ui/ConfirmModal.svelte";
  import ModalContainer from "../ui/modal/ModalContainer.svelte";
  import ModalContent from "../ui/modal/ModalContent.svelte";
  import ModalFooter from "../ui/modal/ModalFooter.svelte";
  import ModalHeader from "../ui/modal/ModalHeader.svelte";
  import QuickMaterielSelectionModal from "./QuickMaterielSelectionModal.svelte";

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

  type Mode = "create" | "edit";

  interface SelectedMateriel {
    materielId: string;
    materielName: string;
    quantity: number;
    type: MaterielTypeLiteral;
    maxQuantity: number;
  }

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    ownerId: string;
    ownerName: string;
    loanId?: string;
    preselectedEventId?: string;
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

  let mode = $derived<Mode>(loanId ? "edit" : "create");

  let startDate = $state("");
  let endDate = $state("");
  let notes = $state("");
  let selectedMateriels = $state<SelectedMateriel[]>([]);
  let loanStatus = $state<any>("accepted");
  let selectedEventId = $state<string | null>(null);

  let showQuickSelection = $state(false);
  let loading = $state(false);
  let loadingLoan = $state(false);
  let existingLoan = $state<EnrichedMaterielLoan | null>(null);

  let showCancelConfirm = $state(false);
  let showConflictConfirm = $state(false);

  let userHasModifiedDates = $state(false);

  function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error("[CreateLoanModal] Date invalide:", dateStr);
      return dateStr;
    }
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  function formatShortDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const jourCourt = date.toLocaleDateString("fr-FR", { weekday: "short" });
    const jour = date.getDate();
    const moisCourt = date.toLocaleDateString("fr-FR", { month: "short" });
    return `${jourCourt} ${jour} ${moisCourt}.`;
  }

  $effect(() => {
    if (mode === "create" && selectedEventId && !userHasModifiedDates) {
      const event = availableEvents.find((e) => e.$id === selectedEventId);
      if (event && event.dateStart && event.dateEnd) {
        startDate = addDays(event.dateStart, -1);
        endDate = addDays(event.dateEnd, 1);
      }
    }
  });

  $effect(() => {
    selectedEventId;
    userHasModifiedDates = false;
  });

  const availableEvents = $derived.by(() => {
    return eventsStore.events.filter((e) => e.status !== "canceled");
  });

  const selectedEvent = $derived(
    selectedEventId
      ? availableEvents.find((e) => e.$id === selectedEventId)
      : null,
  );

  const availableMateriels = $derived.by(() => {
    if (!startDate || !endDate) {
      return materielStore.getAvailableMaterielsByOwner(ownerId);
    }
    return materielStore.getAvailableMaterielsForPeriod(
      ownerId,
      startDate,
      endDate,
      mode === "edit" ? loanId : undefined,
    );
  }) as Array<EnrichedMateriel & { availableForPeriod?: number }>;

  const allMaterielsWithAvailability = $derived.by(() => {
    if (!startDate || !endDate) {
      return materielStore.getMaterielsByOwner(ownerId).map((m) => ({
        ...m,
        availableForPeriod: m.availableQuantity,
      }));
    }

    const allMateriels = materielStore.getMaterielsByOwner(ownerId);
    const availableIds = new Set(availableMateriels.map((m) => m.$id));

    return allMateriels.map((m) => {
      const available = availableMateriels.find((a) => a.$id === m.$id);
      return {
        ...m,
        availableForPeriod: available?.availableForPeriod || 0,
      };
    });
  }) as Array<EnrichedMateriel & { availableForPeriod?: number }>;

  const isEndDatePast = $derived.by(() => {
    if (mode !== "edit" || !existingLoan) return false;
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(endDate) < today;
  });

  // Utilise allMaterielsWithAvailability pour avoir TOUS les matériels
  // (même ceux avec availableForPeriod === 0) afin de détecter les conflits partiels
  const availabilityMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const m of allMaterielsWithAvailability) {
      map.set(m.$id, m.availableForPeriod ?? 0);
    }
    return map;
  });

  const conflictSummary = $derived.by(() => {
    const toRemove: { name: string }[] = [];
    const toReduce: { name: string; requested: number; available: number }[] =
      [];

    for (const m of selectedMateriels) {
      if (m.quantity === 0) continue;
      const available = availabilityMap.get(m.materielId) ?? 0;
      if (available === 0) {
        toRemove.push({ name: m.materielName });
      } else if (m.quantity > available) {
        toReduce.push({
          name: m.materielName,
          requested: m.quantity,
          available,
        });
      }
    }
    return { toRemove, toReduce };
  });

  const hasConflicts = $derived(
    conflictSummary.toRemove.length > 0 || conflictSummary.toReduce.length > 0,
  );

  // Toast quand des conflits apparaissent (false → true)
  let previousHasConflicts = $state(false);
  $effect(() => {
    if (hasConflicts && !previousHasConflicts) {
      const total =
        conflictSummary.toRemove.length + conflictSummary.toReduce.length;
      toastService.warning(
        `${total} matériel${total > 1 ? "s" : ""} en conflit avec les nouvelles dates`,
      );
    }
    previousHasConflicts = hasConflicts;
  });

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

  const isStartDatePast = $derived.by(() => {
    if (!existingLoan) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(existingLoan.startDate) <= today;
  });

  $effect(() => {
    if (isOpen) {
      if (mode === "edit" && loanId) {
        loadingLoan = true;
        const loan = materielStore.getLoanById(loanId);
        if (loan) {
          existingLoan = loan;
          startDate = loan.startDate.split("T")[0];
          endDate = loan.endDate.split("T")[0];
          notes = loan.notes || "";
          loanStatus = loan.status;
          selectedEventId = loan.eventId || null;
          userHasModifiedDates = true;

          selectedMateriels = loan.materielItems.map((item) => {
            const materiel = materielStore.getMaterielById(item.materielId);
            return {
              materielId: item.materielId,
              materielName: item.materielName,
              quantity: item.quantity,
              type: materiel?.type || "",
              maxQuantity: item.quantity,
            };
          });
        } else {
          toastService.error("Emprunt introuvable");
          onClose();
        }
        loadingLoan = false;
      } else if (mode === "create") {
        resetForm();
        if (preselectedEventId) {
          selectedEventId = preselectedEventId;
        }
      }
    }
  });

  function handleAddMateriel(
    materiel: EnrichedMateriel & { availableForPeriod?: number },
  ) {
    const maxQty =
      (materiel as any).availableForPeriod ?? materiel.availableQuantity;

    const existing = selectedMateriels.find(
      (m) => m.materielId === materiel.$id,
    );
    if (existing) {
      if (existing.quantity < maxQty) {
        existing.quantity++;
      }
      return;
    }

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

  // Plafond dynamique : lit la disponibilité réelle depuis availabilityMap
  // fallback = maxQuantity stocké (utile quand pas de dates)
  function getEffectiveMax(materielId: string, fallbackMax: number): number {
    const available = availabilityMap.get(materielId);
    // Si le matériel est dans la map, c'est la vraie dispo sur la période
    if (available !== undefined) return available;
    // Sinon (pas de dates), on utilise le fallback
    return fallbackMax;
  }

  function handleQuantityChange(materielId: string, newQuantity: number) {
    const max = getEffectiveMax(
      materielId,
      selectedMateriels.find((m) => m.materielId === materielId)?.maxQuantity ??
        0,
    );
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId
        ? { ...m, quantity: Math.max(0, Math.min(newQuantity, max)) }
        : m,
    );
  }

  function handleRemoveMateriel(materielId: string) {
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId ? { ...m, quantity: 0 } : m,
    );
  }

  function handleTakeAll() {
    selectedMateriels = selectedMateriels.map((m) => ({
      ...m,
      quantity: getEffectiveMax(m.materielId, m.maxQuantity),
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

  function buildConflictMessage(): string {
    const parts: string[] = [];
    if (conflictSummary.toRemove.length > 0) {
      parts.push(
        `Les items suivants seront retirés de la réservation :\n${conflictSummary.toRemove.map((i) => `- ${i.name}`).join("\n")}`,
      );
    }
    if (conflictSummary.toReduce.length > 0) {
      parts.push(
        `Les quantités réservées seront ajustées :\n${conflictSummary.toReduce.map((i) => `- ${i.name} : ${i.available} (au lieu de ${i.requested})`).join("\n")}`,
      );
    }
    return parts.join("\n\n");
  }

  function applyConflictResolution(): SelectedMateriel[] {
    const removeIds = new Set(conflictSummary.toRemove.map((i) => i.name));
    return selectedMateriels
      .filter((m) => m.quantity > 0 && !removeIds.has(m.materielName))
      .map((m) => {
        const reduce = conflictSummary.toReduce.find(
          (i) => i.name === m.materielName,
        );
        if (reduce) {
          return { ...m, quantity: reduce.available };
        }
        return m;
      });
  }

  async function handleSubmit() {
    if (!isValid) return;

    if (mode === "edit" && selectedEventId) {
      const event = availableEvents.find((e) => e.$id === selectedEventId);
      if (event?.dateEnd) {
        const eventEndDate = event.dateEnd.split("T")[0];
        if (startDate > eventEndDate) {
          toastService.error(
            "La date de début doit être antérieure à la fin de l'événement",
          );
          return;
        }
      }
    }

    if (hasConflicts) {
      showConflictConfirm = true;
      return;
    }

    await doSubmit(selectedMateriels.filter((m) => m.quantity >= 1));
  }

  async function handleConflictConfirm() {
    showConflictConfirm = false;
    const resolved = applyConflictResolution();
    await doSubmit(resolved);
  }

  async function doSubmit(
    materiels: { materielId: string; materielName: string; quantity: number }[],
  ) {
    loading = true;

    try {
      const materielItems = materiels.map((m) => ({
        materielId: m.materielId,
        materielName: m.materielName,
        quantity: m.quantity,
      }));

      if (mode === "create") {
        const responsibleId = globalState.userId || "";
        const responsibleName = globalState.userName || "Inconnu";

        const evt = selectedEventId
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
          eventName: evt?.name || null,
        });

        toastService.success("Réservation créée avec succès");
      } else {
        if (!loanId) {
          throw new Error("loanId manquant en mode édition");
        }

        const evt = selectedEventId
          ? availableEvents.find((e) => e.$id === selectedEventId)
          : null;

        await materielStore.updateLoan(loanId, {
          startDate,
          endDate,
          materiels: materielItems,
          notes: notes.trim() || undefined,
          eventId: selectedEventId,
          eventName: evt?.name || null,
        });

        toastService.success("Réservation modifiée avec succès");
      }

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

  async function handleCancelReservation() {
    showCancelConfirm = true;
  }

  async function confirmCancelReservation() {
    if (!loanId) return;
    showCancelConfirm = false;
    loading = true;
    try {
      await materielStore.cancelLoan(loanId);
      toastService.success("Réservation annulée");
      resetForm();
      onClose();
      onSuccess?.();
    } catch {
      toastService.error("Erreur lors de l'annulation de la réservation");
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    startDate = "";
    endDate = "";
    notes = "";
    selectedMateriels = [];
    loanStatus = "accepted";
    selectedEventId = null;
    userHasModifiedDates = false;
    showCancelConfirm = false;
    showConflictConfirm = false;
    previousHasConflicts = false;
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function getItemConflictInfo(
    materielId: string,
    quantity: number,
  ): {
    isUnavailable: boolean;
    unavailableCount: number;
    available: number;
  } {
    const available = availabilityMap.get(materielId) ?? 0;
    if (quantity > 0 && available === 0) {
      return { isUnavailable: true, unavailableCount: quantity, available: 0 };
    }
    if (quantity > available) {
      return {
        isUnavailable: false,
        unavailableCount: quantity - available,
        available,
      };
    }
    return { isUnavailable: false, unavailableCount: 0, available };
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
        {#if mode === "edit" && isEndDatePast}
          <div class="alert alert-info alert-soft">
            <Info class="h-5 w-5" />
            <span>
              La date de fin est passée. Vous pouvez modifier les dates et les
              notes, mais pas les matériels ni l'événement lié.
            </span>
          </div>
        {/if}

        <div class="space-y-4">
          <label class="select w-full">
            <span class="label"
              ><Package class="h-4 w-4" />
              Événement lié ?</span
            >
            <select
              disabled={loading ||
                (mode === "edit" && isEndDatePast) ||
                !!preselectedEventId}
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

        <div class="space-y-4">
          <h4
            class="flex items-center gap-2 text-sm font-semibold uppercase opacity-70"
          >
            <Sparkles class="h-4 w-4" />
            Matériel à emprunter ({selectedMateriels.length})
          </h4>

          {#if !startDate || !endDate}
            <div class="alert alert-info max-md:alert-vertical">
              <Info class="h-5 w-5" />
              <span>
                Veuillez sélectionner une <strong>date de début</strong> et une
                <strong>date de fin</strong> pour voir le matériel disponible sur
                cette période.
              </span>
            </div>
          {:else if mode === "edit" && isEndDatePast}
            <div class="space-y-2">
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
                    <div class="bg-base-300 rounded p-1">
                      <TypeIcon class="h-4 w-4 opacity-70" />
                    </div>
                    <div
                      class="flex min-w-0 flex-1 items-center gap-x-4 gap-y-1"
                    >
                      <div class="truncate font-medium">
                        {materiel.materielName}
                      </div>
                      <div class="text-xs opacity-70">
                        × <span class="font-semibold">{materiel.quantity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
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
            {#if availableMateriels.length === 0}
              <div class="alert alert-warning">
                <Info class="h-5 w-5" />
                <span>
                  Aucun matériel disponible pour la période sélectionnée.
                </span>
              </div>
            {/if}
          {/if}

          {#if hasConflicts && !(mode === "edit" && isEndDatePast)}
            <div class="alert alert-warning alert-soft">
              <AlertCircle class="h-5 w-5" />
              <div>
                <p class="font-semibold">
                  Conflit{conflictSummary.toRemove.length +
                    conflictSummary.toReduce.length >
                  1
                    ? "s"
                    : ""} de disponibilité détecté{conflictSummary.toRemove
                    .length +
                    conflictSummary.toReduce.length >
                  1
                    ? "s"
                    : ""}
                </p>
                <p class="mt-1 text-sm opacity-80">
                  {#if conflictSummary.toRemove.length > 0}
                    <span
                      >Indisponible{conflictSummary.toRemove.length > 1
                        ? "s"
                        : ""} :
                    </span>
                    <span class="font-medium"
                      >{conflictSummary.toRemove
                        .map((i) => i.name)
                        .join(", ")}</span
                    >
                    {#if conflictSummary.toReduce.length > 0}
                      <span class="mx-1">·</span>
                    {/if}
                  {/if}
                  {#if conflictSummary.toReduce.length > 0}
                    <span>Quantité réduite : </span>
                    <span class="font-medium"
                      >{conflictSummary.toReduce
                        .map((i) => `${i.name} (${i.available}/${i.requested})`)
                        .join(", ")}</span
                    >
                  {/if}
                </p>
              </div>
            </div>
          {/if}

          {#if selectedMateriels.length > 0 && !(mode === "edit" && isEndDatePast)}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold opacity-70">
                  Matériels sélectionnés
                </p>
                {#if selectedMateriels.some((m) => {
                  const eMax = getEffectiveMax(m.materielId, m.maxQuantity);
                  return eMax > m.quantity && !getItemConflictInfo(m.materielId, m.quantity).isUnavailable;
                })}
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
                {@const conflict = getItemConflictInfo(
                  materiel.materielId,
                  materiel.quantity,
                )}
                {@const hasConflict = conflict.unavailableCount > 0}
                {@const effectiveMax = getEffectiveMax(
                  materiel.materielId,
                  materiel.maxQuantity,
                )}

                <div
                  class="rounded-lg p-2 transition-opacity {materiel.quantity ===
                  0
                    ? 'opacity-50'
                    : hasConflict
                      ? 'bg-error/20'
                      : 'bg-base-200'}"
                >
                  <div class="flex items-center gap-2">
                    <div class="bg-base-300 rounded p-1">
                      <TypeIcon class="h-4 w-4 opacity-70" />
                    </div>

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
                      {#if hasConflict}
                        <span class="badge badge-error badge-sm">
                          {conflict.isUnavailable
                            ? "Indisponible"
                            : `${conflict.unavailableCount} indisponible${conflict.unavailableCount > 1 ? "s" : ""}`}
                        </span>
                      {:else}
                        <div class="text-xs opacity-70">
                          Disponible : <span class="font-semibold"
                            >{effectiveMax}</span
                          >
                        </div>
                      {/if}
                    </div>

                    <div class="flex items-center gap-1">
                      <button
                        class="btn btn-ghost btn-xs btn-circle text-error"
                        onclick={() =>
                          handleRemoveMateriel(materiel.materielId)}
                        disabled={loading || materiel.quantity === 0}
                        aria-label="Retirer"
                      >
                        <X class="size-3" />
                      </button>
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
                        max={effectiveMax}
                        step={getStep(effectiveMax)}
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
                            materiel.quantity + getStep(effectiveMax),
                          )}
                        disabled={loading || materiel.quantity >= effectiveMax}
                        aria-label="Augmenter"
                      >
                        <Plus class="size-3" />
                      </button>

                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() =>
                          handleQuantityChange(
                            materiel.materielId,
                            effectiveMax,
                          )}
                        disabled={loading || materiel.quantity >= effectiveMax}
                      >
                        tout
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if !(mode === "edit" && isEndDatePast) && selectedMateriels.length === 0}
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
    {#if mode === "edit" && existingLoan?.status === "accepted"}
      <button
        class="btn btn-error btn-outline btn-sm"
        onclick={handleCancelReservation}
        disabled={loading}
      >
        <Trash2 class="h-4 w-4" />
        <span class="hidden sm:inline">Annuler la réservation</span>
      </button>
    {/if}

    <div class="flex-1"></div>

    <button
      class="btn btn-ghost btn-sm"
      onclick={handleClose}
      disabled={loading || loadingLoan}
    >
      <X class="h-5 w-5" />
      Fermer
    </button>
    {#if !(mode === "edit" && isEndDatePast)}
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
    {/if}
  </ModalFooter>
</ModalContainer>

{#if showQuickSelection}
  <QuickMaterielSelectionModal
    isOpen={showQuickSelection}
    onClose={() => (showQuickSelection = false)}
    onAdd={handleQuickSelectionAdd}
    selectedIds={new Set(selectedMateriels.map((m) => m.materielId))}
    materiels={allMaterielsWithAvailability}
  />
{/if}

{#if showConflictConfirm}
  <ConfirmModal
    isOpen={showConflictConfirm}
    title="Conflits de disponibilité"
    message={buildConflictMessage()}
    variant="warning"
    confirmLabel="Confirmer les ajustements"
    onConfirm={handleConflictConfirm}
    onCancel={() => (showConflictConfirm = false)}
  />
{/if}

{#if showCancelConfirm}
  <ConfirmModal
    isOpen={showCancelConfirm}
    title="Annuler la réservation"
    message={isStartDatePast
      ? "Confirmez qu'aucun matériel n'a été effectivement emprunté. L'annulation est irréversible."
      : "Êtes-vous sûr de vouloir annuler cette réservation ?"}
    variant="danger"
    confirmLabel="Confirmer l'annulation"
    onConfirm={confirmCancelReservation}
    onCancel={() => (showCancelConfirm = false)}
  />
{/if}

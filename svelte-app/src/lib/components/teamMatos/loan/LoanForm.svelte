<script lang="ts">
  /**
   * Cœur métier du formulaire d'emprunt : dates, événement lié, sélection du
   * matériel, détection des conflits et soumission.
   *
   * Ce composant ne porte aucun chrome (ni modal, ni page) : il est monté
   * aussi bien par `CreateLoanModal` que par la page dossier emprunt. Les
   * enveloppes lui fournissent `valid` / `busy` / `summary` et déclenchent
   * `submit()` / `cancelReservation()` via l'API impérative.
   *
   * Deux parcours de sélection coexistent :
   * - `flat` (par défaut) : liste plate de l'inventaire avec quantité par
   *   matériel — le parcours actif ;
   * - `legacy` : autocomplétion + ajout rapide, chargé à la demande. Seule
   *   l'enveloppe modal l'utilise (rollback du prototype) ; la page dossier
   *   ne charge jamais ce parcours.
   */
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    materielStore,
    EventMaterielSyncError,
  } from "$lib/stores/MaterielStore.svelte";
  import type {
    EnrichedMateriel,
    EnrichedMaterielLoan,
  } from "$lib/types/materiel.types";
  import { untrack } from "svelte";
  import {
    toInputDate,
    formatDateDayMonthShort,
  } from "$lib/utils/date-helpers";
  import {
    summarizeSelection,
    type GhostLoanItem,
    EMPTY_LOAN_FILTERS,
    type LoanListFilters,
    groupByTypeOrder,
    loanTypeLabel,
  } from "$lib/utils/materiel-list.utils";
  import LoanMaterielList from "../LoanMaterielList.svelte";
  import MaterielTypeGroup from "../MaterielTypeGroup.svelte";
  import LoanItemReadRow from "./LoanItemReadRow.svelte";
  import {
    AlertCircle,
    Calendar,
    Info,
    LoaderCircle,
    Package,
    Sparkles,
    Trash2,
    User,
  } from "@lucide/svelte";
  import ConfirmModal from "../../ui/ConfirmModal.svelte";
  import type { Component } from "svelte";
  import type { LoanSelectionSummary, SelectedMateriel } from "./loan.types";

  type Mode = "create" | "edit";

  type MaterielWithAvailability = EnrichedMateriel & {
    availableForPeriod?: number;
  };

  interface Props {
    /** Équipe propriétaire de l'emprunt. */
    ownerId: string;
    ownerName: string;
    /** Emprunt à modifier : absent = création. */
    loanId?: string;
    /** Événement pré-sélectionné (import depuis un événement). */
    preselectedEventId?: string;
    /** Parcours de sélection du matériel. */
    selectionMode?: "flat" | "legacy";
    /** Appelé après une sauvegarde réussie (emprunt créé ou mis à jour). */
    onSaved?: (loan?: EnrichedMaterielLoan) => void;
    /** Appelé quand la réservation a été annulée. */
    onCancelled?: () => void;
    /** Appelé quand l'utilisateur abandonne. */
    onCancel?: () => void;
    /** Le formulaire est-il prêt à être soumis ? */
    valid?: boolean;
    /** Une opération est-elle en cours ? */
    busy?: boolean;
    /** Compteur de la sélection courante. */
    summary?: LoanSelectionSummary;
    /** Statut de l'emprunt chargé (édition) ; null en création. */
    existingLoanStatus?: string | null;
    /**
     * Fiche figée (édition) : date de fin passée ou retour effectué —
     * plus modifiable, pas d'enregistrement.
     */
    frozen?: boolean;
    /** L'utilisateur a-t-il modifié le formulaire ? */
    dirty?: boolean;
    /** Mode carte (page dossier) : les sections sont portées par des cards. */
    framed?: boolean;
    /**
     * Filtres de la liste (type, segment, disponible), partagés avec la
     * sidebar : le sélecteur compact sous la recherche remonte ici.
     */
    listFilter?: LoanListFilters;
    /**
     * Affiche le sélecteur de segment sous la recherche même en desktop :
     * pour le modal, qui n'a pas de sidebar.
     */
    showSegmentInline?: boolean;
    /**
     * Ancrage sticky de la liste de matériel, selon l'enveloppe (modal
     * compense le padding du scroll container, page se cale sous la navbar).
     */
    stickyTopClass?: string;
  }

  let {
    ownerId,
    ownerName,
    loanId,
    preselectedEventId,
    selectionMode = "flat",
    onSaved,
    onCancelled,
    onCancel,
    valid = $bindable(false),
    busy = $bindable(false),
    summary = $bindable({ itemCount: 0, totalUnits: 0 }),
    existingLoanStatus = $bindable(null),
    frozen = $bindable(false),
    dirty = $bindable(false),
    framed = false,
    listFilter = $bindable({ ...EMPTY_LOAN_FILTERS }),
    showSegmentInline = false,
    stickyTopClass = "-top-4 sm:-top-2",
  }: Props = $props();

  const useFlat = $derived(selectionMode === "flat");
  const mode = $derived<Mode>(loanId ? "edit" : "create");

  let startDate = $state("");
  let endDate = $state("");
  let notes = $state("");
  let selectedMateriels = $state<SelectedMateriel[]>([]);
  let loanStatus = $state<any>("accepted");
  let selectedEventId = $state<string | null>(null);

  let quantities = $state<Record<string, number>>({});
  let materielList = $state<ReturnType<typeof LoanMaterielList>>();
  let loading = $state(false);
  let loadingLoan = $state(false);
  let existingLoan = $state<EnrichedMaterielLoan | null>(null);

  let showCancelConfirm = $state(false);
  let showConflictConfirm = $state(false);

  let userHasModifiedDates = $state(false);

  /** Parcours legacy : chargé à la demande, jamais sur la page dossier. */
  let LegacySelection = $state<Component<any> | null>(null);

  $effect(() => {
    if (!useFlat || LegacySelection) return;
    import("./LoanLegacySelection.svelte").then((mod) => {
      LegacySelection = mod.default;
    });
  });

  function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.error("[LoanForm] Date invalide:", dateStr);
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
      const event = availableEvents.find((e) => e.id === selectedEventId);
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
    const now = new Date();
    return eventsStore.events.filter(
      (e) =>
        e.status !== "canceled" &&
        // dateEnd null → epoch : comportement runtime historique conservé
        (new Date(e.dateEnd ?? 0) >= now || e.id === selectedEventId),
    );
  });

  const selectedEvent = $derived(
    selectedEventId
      ? availableEvents.find((e) => e.id === selectedEventId)
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
  }) as MaterielWithAvailability[];

  const allMaterielsWithAvailability = $derived.by(() => {
    if (!startDate || !endDate) {
      return materielStore.getMaterielsByOwner(ownerId).map((m) => ({
        ...m,
        availableForPeriod: m.availableQuantity,
      }));
    }

    const allMateriels = materielStore.getMaterielsByOwner(ownerId);
    const availableIds = new Set(availableMateriels.map((m) => m.id));

    return allMateriels.map((m) => {
      const available = availableMateriels.find((a) => a.id === m.id);
      return {
        ...m,
        availableForPeriod: available?.availableForPeriod || 0,
      };
    });
  }) as MaterielWithAvailability[];

  const isEndDatePast = $derived.by(() => {
    if (mode !== "edit" || !existingLoan) return false;
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(endDate) < today;
  });

  /** Retour déjà effectué : la réservation est conservée en lecture seule. */
  const loanReturned = $derived(
    mode === "edit" && existingLoan?.status === "completed",
  );

  /**
   * Fiche figée (retour effectué ou date de fin passée) : plus aucune
   * modification — l'historique doit refléter ce qui a réellement eu lieu.
   */
  const isFrozen = $derived(mode === "edit" && (isEndDatePast || loanReturned));

  /** Réservation figée : items groupés par type (ordre canonique). */
  const frozenGroups = $derived(
    isFrozen ? groupByTypeOrder(selectedMateriels, (m) => m.type) : [],
  );

  // Utilise allMaterielsWithAvailability pour avoir TOUS les matériels
  // (même ceux avec availableForPeriod === 0) afin de détecter les conflits partiels
  const availabilityMap = $derived.by(() => {
    const map = new Map<string, number>();
    for (const m of allMaterielsWithAvailability) {
      map.set(m.id, m.availableForPeriod ?? 0);
    }
    return map;
  });

  // --- Mode liste plate : projection de la sélection ---
  const flatGhostItems = $derived<GhostLoanItem[]>(
    selectedMateriels
      .filter((m) => m.isDeleted)
      .map((m) => ({
        materielId: m.materielId,
        materielName: m.materielName,
        quantity: m.quantity,
      })),
  );

  const flatInitialQuantities = $derived(
    Object.fromEntries(
      selectedMateriels.map((m) => [m.materielId, m.quantity]),
    ),
  );

  const flatNameById = $derived.by(() => {
    const map = new Map<string, string>();
    for (const m of allMaterielsWithAvailability) map.set(m.id, m.name);
    for (const g of flatGhostItems) map.set(g.materielId, g.materielName);
    return map;
  });

  const flatSelected = $derived(
    Object.entries(quantities)
      .filter(([, qty]) => qty >= 1)
      .map(([materielId, quantity]) => ({ materielId, quantity })),
  );

  const flatSummary = $derived(summarizeSelection(quantities));

  const conflictSummary = $derived.by(() => {
    // Liste plate : les rows viennent des quantités ; sinon de l'ancienne
    // sélection. materielId est porté pour une résolution par id (le nom n'est
    // pas unique dans l'inventaire).
    const rows = (
      useFlat
        ? flatSelected.map(({ materielId, quantity }) => ({
            materielId,
            materielName: flatNameById.get(materielId) ?? "",
            quantity,
          }))
        : selectedMateriels.map((m) => ({
            materielId: m.materielId,
            materielName: m.materielName,
            quantity: m.quantity,
          }))
    ).filter((m) => m.quantity > 0);

    const toRemove: { name: string; materielId?: string }[] = [];
    const toReduce: {
      name: string;
      requested: number;
      available: number;
      materielId?: string;
    }[] = [];

    for (const m of rows) {
      const available = availabilityMap.get(m.materielId) ?? 0;
      if (available === 0) {
        toRemove.push({ name: m.materielName, materielId: m.materielId });
      } else if (m.quantity > available) {
        toReduce.push({
          name: m.materielName,
          requested: m.quantity,
          available,
          materielId: m.materielId,
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
      (useFlat
        ? flatSummary.itemCount > 0
        : selectedMateriels.length > 0 &&
          selectedMateriels.some((m) => m.quantity >= 1)) &&
      globalState.userId !== null &&
      globalState.userId !== undefined &&
      !loading &&
      !loadingLoan,
  );

  const isStartDatePast = $derived.by(() => {
    if (!existingLoan) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // startDate null → epoch : comportement runtime historique conservé
    return new Date(existingLoan.startDate ?? 0) <= today;
  });

  // État exposé aux enveloppes (modal, page) : validity, activité, compteur.
  $effect(() => {
    valid = isValid;
  });
  $effect(() => {
    busy = loading || loadingLoan;
  });
  $effect(() => {
    summary = {
      itemCount: flatSummary.itemCount,
      totalUnits: flatSummary.totalUnits,
    };
  });
  $effect(() => {
    existingLoanStatus = existingLoan?.status ?? null;
    frozen = isFrozen;
  });

  // Modifications non sauvegardées : comparaison à l'état d'ouverture. Le
  // snapshot est lu hors graphe pour que sa capture ne relance pas l'effet.
  let baseline = $state<string | null>(null);

  function currentSignature(): string {
    return JSON.stringify({
      startDate,
      endDate,
      notes,
      selectedEventId,
      quantities,
      selectedMateriels,
    });
  }

  // Passe d'ouverture : une exécution par (mode, loanId), hors graphe
  // réactif — syncRevalidate et getLoanById réécrivent #raw (sync → Dexie →
  // liveQuery) ; trackés, chaque écriture relancerait cet effet et
  // re-syncerait en boucle. Fraîcheur en session : SSE + orchestrateur de
  // resync ; disponibilités/conflits restent réactifs via les $derived.
  $effect(() => {
    // L'init suit l'emprunt : sv-router réutilise le composant entre deux
    // urls du même motif (création → édition d'un autre emprunt).
    const openKey = `${mode}:${loanId ?? "new"}`;

    untrack(() => {
      // Delta sync silencieux à l'ouverture ; l'affichage se met à jour
      // quand le résultat atterrit en Dexie (échec silencieux — le statut
      // serveur est déjà porté par la barre d'état).
      materielStore.syncRevalidate().catch(() => {});

      if (mode === "edit" && loanId && !loading) {
        loadingLoan = true;
        const loan = materielStore.getLoanById(loanId);
        if (loan) {
          existingLoan = loan;
          startDate = toInputDate(loan.startDate);
          endDate = toInputDate(loan.endDate);
          notes = loan.notes || "";
          loanStatus = loan.status;
          selectedEventId = loan.eventId || null;
          userHasModifiedDates = true;

          selectedMateriels = loan.materielItems.map((item) => {
            const materiel = materielStore.getMaterielById(item.materielId);
            const isDeleted = !materiel;
            return {
              materielId: item.materielId,
              materielName: item.materielName,
              quantity: item.quantity,
              type: materiel?.type || "",
              maxQuantity: isDeleted ? 0 : item.quantity,
              isDeleted,
            };
          });
        } else {
          toastService.error("Emprunt introuvable");
          onCancel?.();
        }
        loadingLoan = false;
      } else if (mode === "create") {
        resetForm();
        if (preselectedEventId) {
          selectedEventId = preselectedEventId;
        }
      }
    });
  });

  // Liste plate : initialise la sélection du composant quand il apparaît
  // (montage après saisie des dates en création, après chargement en
  // édition). Lit materielList ($state bind:this) : l'effet re-court au
  // montage du composant. reset() n'écrit que quantities — pas de boucle.
  $effect(() => {
    if (!useFlat || loadingLoan) return;
    materielList?.reset(flatInitialQuantities);
  });

  // Suivi des modifications non sauvegardées. L'effet est déclaré après
  // l'init et après le remplissage de la sélection : le premier passage
  // capture l'état d'ouverture, les suivants comparent.
  $effect(() => {
    const signature = currentSignature();
    const base = untrack(() => baseline);
    if (base === null) {
      baseline = signature;
      return;
    }
    dirty = signature !== base;
  });

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

  function applyConflictResolution(): {
    materielId: string;
    materielName: string;
    quantity: number;
  }[] {
    if (useFlat) {
      const next: Record<string, number> = {};
      for (const { materielId, quantity } of flatSelected) {
        if (conflictSummary.toRemove.some((r) => r.materielId === materielId)) {
          continue;
        }
        const reduce = conflictSummary.toReduce.find(
          (r) => r.materielId === materielId,
        );
        next[materielId] = reduce ? reduce.available : quantity;
      }
      materielList?.applyQuantities(next);
      return materielList?.getSelectedItems() ?? [];
    }

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
      const event = availableEvents.find((e) => e.id === selectedEventId);
      if (event?.dateEnd) {
        const eventEndDate = toInputDate(event.dateEnd);
        if (toInputDate(startDate) > eventEndDate) {
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

    await doSubmit(currentSelection());
  }

  function currentSelection(): {
    materielId: string;
    materielName: string;
    quantity: number;
  }[] {
    if (useFlat) {
      // Liste non montée (fiche figée : édition figée) → l'état
      // chargé de l'emprunt, sinon un submit écraserait les items.
      if (materielList) return materielList.getSelectedItems();
      return selectedMateriels
        .filter((m) => m.quantity >= 1)
        .map((m) => ({
          materielId: m.materielId,
          materielName: m.materielName,
          quantity: m.quantity,
        }));
    }
    return selectedMateriels.filter((m) => m.quantity >= 1);
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
          ? availableEvents.find((e) => e.id === selectedEventId)
          : null;

        const created = await materielStore.createLoan({
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
        resetForm();
        onSaved?.(created);
        return;
      }

      if (!loanId) {
        throw new Error("loanId manquant en mode édition");
      }

      const evt = selectedEventId
        ? availableEvents.find((e) => e.id === selectedEventId)
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
      // Pas de reset ici : la page dossier reste affichée après enregistrement,
      // le formulaire doit garder ses valeurs (baseline recapturée → dirty
      // repasse à false). Le modal se ferme de toute façon.
      baseline = currentSignature();
      onSaved?.();
    } catch (error) {
      console.error(
        mode === "create"
          ? "Erreur création emprunt:"
          : "Erreur mise à jour emprunt:",
        error,
      );
      if (error instanceof EventMaterielSyncError) {
        // Échec partiel : le prêt est modifié (visible partout), seule la
        // liste du materiel de l'événement n'a pas suivi — pas une erreur
        // globale.
        toastService.warning(error.message);
      } else {
        toastService.error(
          mode === "create"
            ? "Erreur lors de la création de la réservation"
            : "Erreur lors de la modification de la réservation",
        );
      }
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
      // Recapture : sinon le reset relèverait `dirty` et le guard de
      // navigation demanderait confirmation pour une navigation voulue.
      baseline = currentSignature();
      onCancelled?.();
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
    quantities = {};
    loanStatus = "accepted";
    selectedEventId = null;
    userHasModifiedDates = false;
    showCancelConfirm = false;
    showConflictConfirm = false;
    previousHasConflicts = false;
  }

  // --- API impérative (enveloppes modal / page) ---

  /** Soumet le formulaire (validation, conflits puis écriture). */
  export function submit() {
    handleSubmit();
  }

  /** Vide le formulaire sans quitter. */
  export function reset() {
    resetForm();
  }

  /** Demande l'annulation de la réservation (confirmation interne). */
  export function cancelReservation() {
    handleCancelReservation();
  }
</script>

<div class="space-y-6">
  {#if mode === "edit" && loadingLoan}
    <div class="flex items-center justify-center py-12">
      <div class="text-center">
        <LoaderCircle
          class="mx-auto mb-4 h-12 w-12 animate-spin text-primary"
        />
        <p class="text-lg font-medium">Chargement de la réservation...</p>
      </div>
    </div>
  {:else}
    {#if mode === "edit" && loanReturned}
      <div class="alert alert-soft alert-info">
        <Info class="h-5 w-5" />
        <span>
          Retour effectué
          {#if existingLoan?.returnedAt}
            le {formatDateDayMonthShort(existingLoan.returnedAt)}
          {/if}
          : la réservation est conservée en lecture seule.
        </span>
      </div>
    {:else if mode === "edit" && isEndDatePast}
      <div class="alert alert-soft alert-info">
        <Info class="h-5 w-5" />
        <span>
          La date de fin est passée : la réservation est figée, elle ne peut
          plus être modifiée.
        </span>
      </div>
    {/if}

    {#snippet periodFields()}
      <label class="select w-full">
        <span class="label"
          ><Package class="h-4 w-4" />
          Événement lié ?</span
        >
        <select
          disabled={loading ||
            (mode === "edit" && isFrozen) ||
            !!preselectedEventId}
          value={selectedEventId || ""}
          onchange={(e) => {
            const target = e.target as HTMLSelectElement;
            selectedEventId = target.value || null;
          }}
        >
          <option value="">Aucun événement</option>
          {#each availableEvents as event (event.id)}
            <option value={event.id}>{event.name}</option>
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
            disabled={loading || (mode === "edit" && isFrozen)}
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
            disabled={loading || (mode === "edit" && isFrozen)}
            min={startDate}
          />
        </label>
      </div>

      {#if selectedEvent && selectedEvent.dateStart && selectedEvent.dateEnd}
        <p class="-mt-2 px-1 text-sm text-base-content/50">
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
          placeholder="Informations complémentaires sur l'emprunt...Vous pouvez notamment y indiquer du matériel emprunté qui ne figure pas dans l'inventaire."
          maxlength="500"
          disabled={loading || (mode === "edit" && isFrozen)}></textarea>
      </fieldset>
    {/snippet}

    {#snippet materielBlock()}
      {#if !startDate || !endDate}
        <div class="alert alert-info max-md:alert-vertical">
          <Info class="h-5 w-5" />
          <span>
            Veuillez sélectionner une <strong>date de début</strong> et une
            <strong>date de fin</strong> pour voir le matériel disponible sur cette
            période.
          </span>
        </div>
      {:else if mode === "edit" && isFrozen}
        <!-- Lecture seule groupée : même anatomie que la fiche de retour -->
        <div class="mx-auto max-w-3xl space-y-3">
          {#each frozenGroups as group (group.type)}
            <MaterielTypeGroup
              type={group.type}
              label={loanTypeLabel(group.type)}
              count={group.items.length}
            >
              {#each group.items as materiel (materiel.materielId)}
                <LoanItemReadRow
                  name={materiel.materielName}
                  quantity={materiel.quantity}
                  type={materiel.type}
                />
              {/each}
            </MaterielTypeGroup>
          {/each}
        </div>
      {:else if useFlat}
        <LoanMaterielList
          bind:this={materielList}
          bind:quantities
          bind:filter={listFilter}
          materiels={allMaterielsWithAvailability}
          ghostItems={flatGhostItems}
          {loading}
          stickyClass={stickyTopClass}
          {showSegmentInline}
        />
      {:else if LegacySelection}
        <LegacySelection
          bind:selectedMateriels
          {availableMateriels}
          allMateriels={allMaterielsWithAvailability}
          {availabilityMap}
          {loading}
        />
      {/if}

      {#if hasConflicts && !(mode === "edit" && isFrozen)}
        <div class="alert alert-soft alert-warning">
          <AlertCircle class="h-5 w-5" />
          <div>
            <p class="font-semibold">
              Conflit{conflictSummary.toRemove.length +
                conflictSummary.toReduce.length >
              1
                ? "s"
                : ""} de disponibilité détecté{conflictSummary.toRemove.length +
                conflictSummary.toReduce.length >
              1
                ? "s"
                : ""}
            </p>
            <p class="mt-1 text-sm opacity-80">
              {#if conflictSummary.toRemove.length > 0}
                <span
                  >Indisponible{conflictSummary.toRemove.length > 1 ? "s" : ""} :
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
    {/snippet}

    {#if framed}
      <div class="card bg-base-100 shadow-sm max-sm:card-xs">
        <div class="card-body">
          <h2 class="card-title">
            <Calendar class="h-5 w-5" />
            Période &amp; événement
          </h2>
          {@render periodFields()}
          {#if mode === "edit" && existingLoanStatus === "accepted"}
            <!-- Geste destructif gardé près de son contexte ; la confirmation
                 vit dans ce composant. Le modal, lui, porte ce bouton dans son
                 footer. -->
            <div class="mt-2 flex justify-end border-t border-base-200 pt-4">
              <button
                class="btn btn-outline btn-error btn-sm"
                onclick={handleCancelReservation}
                disabled={loading}
              >
                <Trash2 class="h-4 w-4" />
                Annuler la réservation
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm max-sm:card-xs">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="card-title">
              <Sparkles class="h-5 w-5" />
              Matériel à emprunter
            </h2>
            {#if summary.itemCount > 0}
              <span class="badge badge-outline tabular-nums badge-primary">
                {summary.itemCount}
                matériel{summary.itemCount > 1 ? "s" : ""}
                ·
                {summary.totalUnits}
                unité{summary.totalUnits > 1 ? "s" : ""}
              </span>
            {/if}
          </div>
          {@render materielBlock()}
        </div>
      </div>
    {:else}
      <div class="space-y-4">
        {@render periodFields()}
      </div>

      <div class="space-y-4">
        <h4
          class="flex items-center gap-2 text-sm font-semibold uppercase opacity-70"
        >
          <Sparkles class="h-4 w-4" />
          Matériel à emprunter ({useFlat
            ? flatSummary.itemCount
            : selectedMateriels.length})
        </h4>
        {@render materielBlock()}
      </div>
    {/if}
  {/if}
</div>

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

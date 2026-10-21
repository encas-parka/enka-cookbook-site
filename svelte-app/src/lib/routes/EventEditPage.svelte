<script lang="ts">
  import EventMealCard from "$lib/components/eventEdit/EventMealCard.svelte";
  import PermissionsManager from "$lib/components/PermissionsManager.svelte";

  import EventInvitationAlert from "$lib/components/EventInvitationAlert.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { getContributors } from "$lib/utils/event-stats-helpers";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type { EventMeal, EventMealRecipe } from "$lib/types/events";
  import type { RecettesTypeR } from "$lib/types/recipes.types";
  import { getRecipeTypeColor } from "$lib/utils/recipeUtils";

  import {
    Calendar,
    Plus,
    Save,
    Lock as LockIcon,
    PencilLine,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Users,
    Info,
    ChefHat,
    CalendarPlus,
    XCircle,
    Download,
  } from "@lucide/svelte";
  import { nanoid } from "nanoid";
  import { flip } from "svelte/animate";
  import { untrack } from "svelte";
  import EventStats from "../components/EventStats.svelte";
  import EventDocumentsFieldset from "../components/eventEdit/EventDocumentsFieldset.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { locksService, type Lock } from "$lib/services/pb-locks";
  import { statusBarStore } from "../stores/StatusBarStore.svelte";
  import UnsavedChangesGuard from "../components/ui/UnsavedChangesGuard.svelte";
  import Fieldset from "../components/ui/Fieldset.svelte";
  import ConfirmModal from "../components/ui/ConfirmModal.svelte";
  import BadgeEventStatus from "../components/ui/BadgeEventStatus.svelte";
  import AssignDateModal from "../components/eventEdit/AssignDateModal.svelte";
  import { recipesStore } from "../stores/RecipesStore.svelte";
  import { online } from "svelte/reactivity/window";
  import { shareOrDownload, toSlug } from "$lib/utils/share-utils";

  // ============================================================================
  // PROPS & INITIALISATION
  // ============================================================================

  import { route } from "$lib/router";
  import { slide } from "svelte/transition";

  // Rendre eventId entièrement réactif aux changements de params
  const eventId = $derived(route.params.id ?? "");

  // Shadow Draft permanent (jamais null)
  // NOTE: meals est un $state brut (non trié) pour permettre les mutations
  let meals = $state<EventMeal[]>([]);
  let eventName = $state("");
  let description = $state("");
  let status = $state<
    "proposition" | "confirmed" | "canceled" | "archive" | "locked" | "local"
  >("proposition");
  let minContrib = $state<number>(1);

  // Meals sans date (recettes à planifier)
  const undatedMeals = $derived(meals.filter((m) => m.date === ""));

  // Meals datés triés par date (pour l'affichage)
  const sortedDatedMeals = $derived(
    [...meals.filter((m) => m.date !== "")].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  );

  // Meals triés : datés en premier (triés par date), puis non-datés
  const sortedMeals = $derived([...sortedDatedMeals, ...undatedMeals]);

  // État UI
  let isBusy = $state(false); // Quand on sauvegarde/charge (maître)
  let isAcquiringLock = $state(false); // Quand on acquiert le lock
  let isEditing = $state(false); // Mode édition (shadow draft actif)
  let editingMealIndex = $state<string | null>(null);
  let editingTitle = $state(false);

  // « Init par id, jamais par montage » : la clé d'idempotence est l'eventId,
  // pas la vie du composant (sv-router réutilise le composant entre /event/A
  // et /event/B — un init one-shot par montage éditerait B sous le lock de A).
  let initialisedFor = $state<string | null>(null);
  const isInitialised = $derived(
    initialisedFor !== null && initialisedFor === eventId,
  );
  let editingDescription = $state(false);

  // États des modales de confirmation
  let showConfirmStatusModal = $state(false);
  let showCancelStatusModal = $state(false);
  let showCancelEditModal = $state(false);

  // Assignation de date (recettes à planifier)
  let showAssignDateModal = $state(false);
  let assigningRecipe = $state<{
    mealId: string;
    recipeUuid: string;
    typeR: RecettesTypeR;
    sourceHasDate: boolean;
  } | null>(null);

  // Meals datés pour le modal (exclut le meal source si on réassigne depuis un meal daté)
  const modalDatedMeals = $derived.by(() => {
    const assigning = assigningRecipe;
    if (assigning?.sourceHasDate) {
      return sortedDatedMeals.filter((m) => m.id !== assigning.mealId);
    }
    return sortedDatedMeals;
  });

  // État du verrou externe (via locksService)
  let activeLock = $state<Lock | null>(null);
  let lockUnsub: (() => void) | null = null;

  // eventId non-réactif capturé au moment de l'acquisition du lock
  // pour garantir sa disponibilité lors du cleanup du cycle de vie
  // car eventId ($derived de route.params) peut déjà être vide après navigation
  let lockedEventId: string | null = null;

  // isDirty est calculé par comparaison avec currentEvent (la référence)
  const isDirty = $derived.by(() => {
    if (eventName === "" && meals.length === 0) return false;
    if (!isInitialised || !currentEvent) return false;

    // Comparaison des valeurs scalaires
    if (eventName !== currentEvent.name) return true;
    if (description !== (currentEvent.description || "")) return true;
    if (status !== currentEvent.status) return true;
    if (minContrib !== (currentEvent.minContrib || 1)) return true;

    // Comparaison structurelle des meals
    const currentMeals = currentEvent.meals || [];
    if (meals.length !== currentMeals.length) return true;

    // Comparer chaque meal via une signature légère (id, date, guests, recipes)
    const mealSig = (m: EventMeal) => ({
      id: m.id,
      date: m.date,
      guests: m.guests,
      recipes: m.recipes?.map((r) => [
        r.recipeUuid,
        r.typeR,
        r.plates,
        r.hasOwnPlatesNb,
      ]),
    });

    if (
      JSON.stringify(meals.map(mealSig)) !==
      JSON.stringify(currentMeals.map(mealSig))
    )
      return true;

    return false;
  });

  /**
   * Démarre le mode édition en acquérant le verrou.
   */
  async function startEditing(): Promise<boolean> {
    if (isEditing) return true; // Déjà en édition

    if (isLockedByOthers) {
      toastService.warning(
        `Cet événement est verrouillé par ${lockedByUserName}`,
      );
      return false;
    }

    // Acquérir le verrou
    const success = await acquireLock();
    if (success) {
      isEditing = true; // ✅ Activer le mode édition après acquisition du lock
    }

    return success;
  }

  // ============================================================================
  // DERIVED STATES
  // ============================================================================

  // currentEvent directement depuis eventsStore
  const currentEvent = $derived(eventsStore.getEventById(eventId));

  // DONNÉES RÉACTIVES DÉRIVÉES EN LECTURE SEULE (Single Source of Truth depuis currentEvent)
  // Note: eventName est maintenant un $state local (shadow draft), pas un $derived
  const contributors = $derived(getContributors(currentEvent));

  const isLockedByOthers = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId !== globalState.userId;
  });

  const isLockedByMe = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId === globalState.userId;
  });

  const canEdit = $derived(
    // Mode normal : vérifier les permissions + en ligne
    !!online.current &&
      eventsStore.canUserEditEvent(eventId, globalState.userId || "") &&
      !isLockedByOthers &&
      !isAcquiringLock &&
      !isBusy,
  );

  const lockedByUserName = $derived(
    activeLock?.userName || "un autre utilisateur",
  );

  // ============================================================================
  // SYNCHRONISATION UNIDIRECTIONNELLE (SHADOW DRAFT)
  // ============================================================================

  $effect(() => {
    // Guard 1: currentEvent pas encore chargé
    if (!currentEvent) {
      console.log("[Sync] Guard 1 - Pas de currentEvent");
      return;
    }

    // Guard 2: composant pas initialisé
    if (!isInitialised) {
      console.log("[Sync] Guard 2 - Pas initialisé");
      return;
    }

    // Guard 3: déjà en édition (ne pas écraser les modifications)
    // ✅ IMPORTANT: Toujours permettre la PREMIÈRE sync (shadow draft vide)
    if (isEditing && eventName !== "") {
      console.log(
        "[Sync] Guard 3 - Mode édition actif, pas de sync (shadow draft déjà peuplé)",
      );
      return; // Déjà édité avec des données, ne pas écraser
    }

    // Synchronisation automatique (preview OU première sync démo)
    untrack(() => {
      const oldEventName = eventName;
      const oldMealsCount = meals.length;

      meals = $state.snapshot(currentEvent.meals || []);
      eventName = currentEvent.name || "";
      description = currentEvent.description || "";
      status = currentEvent.status || "proposition";
      minContrib = currentEvent.minContrib || 1;

      // console.log("🔄 Shadow draft synchronisé depuis currentEvent", {
      //   oldEventName,
      //   newEventName: eventName,
      //   oldMealsCount,
      //   newMealsCount: meals.length,
      // });
    });
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
      hasUnsavedChanges: isDirty && !isLockedByOthers,
    });
  });

  // ============================================================================
  // STATUS BAR (lock info)
  // ============================================================================

  $effect(() => {
    if (isLockedByOthers) {
      statusBarStore.setLockStatus({
        type: "locked-by-other",
        userName: lockedByUserName,
      });
    } else if (isLockedByMe) {
      statusBarStore.setLockStatus({ type: "locked-by-me" });
    } else {
      statusBarStore.setLockStatus(null);
    }
  });

  // ============================================================================
  // CYCLE DE VIE PAR EVENT — « init par id, jamais par montage »
  // ============================================================================

  /**
   * Cleanup du cycle de vie : tourne au CHANGEMENT d'eventId et au démontage,
   * jamais aux mutations de l'event (seul `eventId` est une dépendance — un
   * effet sans dépendance ne rejouant jamais, lire `eventId` ici est ce qui
   * donne au cleanup son déclencheur).
   *
   * C'est ce cleanup qui rend l'init par id sûre : naviguer A→B libère le
   * verrou de A, désabonne son SSE et repart d'un état d'édition vierge —
   * sinon B serait affiché puis sauvé sous le verrou de A.
   *
   * Ordre de déclaration : ce bloc DOIT précéder l'effet d'init — Svelte
   * exécute le cleanup d'un effet avant son propre re-run, dans l'ordre de
   * création ; l'init de B doit voir l'état déjà nettoyé de A.
   */
  $effect(() => {
    const id = eventId;
    if (!id) return;

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
      }
      if (lockUnsub) {
        lockUnsub();
        lockUnsub = null;
      }
      // Libération réseau fire-and-forget (un cleanup est synchrone) :
      // releaseLock() toucherait isEditing après l'await, au risque de
      // couper une édition déjà relancée sur le nouvel event.
      const heldId = lockedEventId;
      lockedEventId = null;
      if (heldId) {
        void untrack(() => releaseLockRequest(heldId));
      }
      activeLock = null;
      isEditing = false;
      initialisedFor = null;
      editingMealIndex = null;
      editingTitle = false;
      showAssignDateModal = false;
      assigningRecipe = null;
      showConfirmStatusModal = false;
      showCancelStatusModal = false;
      showCancelEditModal = false;
      statusBarStore.clearLockStatus();
    };
  });

  /**
   * Charge le verrou de l'événement en arrière-plan (non bloquant : le shadow
   * draft reste utilisable). Isolé de l'effet pour que ses lectures ne
   * deviennent pas des dépendances réactives.
   */
  async function initializeLock(id: string): Promise<void> {
    isBusy = true;
    try {
      activeLock = await locksService.getLock(`event_${id}`);
      lockUnsub = await locksService.subscribeToLock(`event_${id}`, (lock) => {
        console.log("[EventEditPage] 🔒 Verrou mis à jour:", {
          lockedBy: lock?.userName,
          userId: lock?.userId,
          expiresAt: lock?.expiresAt,
        });
        activeLock = lock;
      });
    } catch (err) {
      console.error("[EventEditPage] Verrou indisponible:", err);
    } finally {
      isBusy = false;
      console.log("[Init] Lock chargé, isBusy = false");
    }
  }

  $effect(() => {
    // Guard 1 : une seule initialisation par id.
    if (initialisedFor === eventId || isBusy) {
      return;
    }

    if (!eventId) {
      return;
    }

    // Dépendance volontaire : l'ARRIVÉE de l'event relance l'effet. Sans elle,
    // un montage sur cache froid (login après purge, deep link) sortait ici
    // pour toujours — le shadow draft ne se peuplait jamais (meals vides).
    if (!currentEvent) {
      return;
    }

    initialisedFor = eventId;
    void untrack(() => initializeLock(eventId));
  });

  // ============================================================================
  // LOCK MANAGEMENT
  // ============================================================================

  async function acquireLock(): Promise<boolean> {
    if (!eventId || !globalState.userId || isBusy || isAcquiringLock)
      return false;

    isAcquiringLock = true;
    const requestedId = eventId;
    try {
      const lock = await locksService.acquireLock(
        `event_${requestedId}`,
        globalState.userId,
        globalState.userName,
      );
      // Navigation pendant l'acquisition : le verrou ne concerne plus la
      // page courante — le libérer aussitôt, ne jamais l'afficher comme nôtre.
      if (eventId !== requestedId) {
        void releaseLockRequest(requestedId);
        return false;
      }
      // L'état du verrou est posé immédiatement (le realtime confirmera)
      activeLock = lock;

      if (lock.userId === globalState.userId) {
        // Capturer l'ID de manière non-réactive pour le cleanup
        lockedEventId = eventId;
        scheduleAutoSave();
        return true;
      }
      toastService.warning(
        `Cet événement est en cours de modification par ${lockedByUserName}`,
      );
      return false;
    } catch (error) {
      console.error("❌ Erreur acquisition verrou:", error);
      // L'échec peut masquer une prise concurrente (la règle update répond
      // 404 quand le verrou vient d'être repris par autrui) : relire l'état
      // réel du verrou avant quoi que ce soit — l'alerte de page suivra.
      try {
        activeLock = await locksService.getLock(`event_${eventId}`);
      } catch {
        toastService.error("Impossible de vérifier le verrou de l'événement");
      }
      return false;
    } finally {
      isAcquiringLock = false;
    }
  }

  /**
   * Libération réseau seule — sans toucher aux états d'édition : utilisable
   * depuis le cleanup du cycle de vie, où les états sont déjà réinitialisés.
   */
  async function releaseLockRequest(eventIdToRelease: string): Promise<void> {
    if (!globalState.userId) return;
    try {
      await locksService.releaseLock(
        `event_${eventIdToRelease}`,
        globalState.userId,
      );
      console.log("🔓 Verrou libéré");
    } catch (error) {
      console.error("❌ Erreur libération verrou:", error);
    }
  }

  async function releaseLock(): Promise<void> {
    const eventIdToRelease = lockedEventId;
    if (!eventIdToRelease || !globalState.userId) return;

    await releaseLockRequest(eventIdToRelease);
    lockedEventId = null;
    isEditing = false; // ✅ Désactiver le mode édition après libération du lock
    // activeLock sera mis à jour par le realtime
  }

  // ============================================================================
  // NAVIGATION GUARD
  // ============================================================================

  /**
   * Handler pour "Quitter sans sauvegarder"
   */
  async function handleLeaveWithoutSave() {
    // Libérer le lock si on l'a
    if (isEditing) {
      await releaseLock();
    }
    // Plus besoin de reset isDirty manuellement, le $derived s'en charge
  }

  /**
   * Handler pour "Enregistrer et quitter"
   */
  async function handleSaveAndLeave() {
    const success = await saveEventData();
    if (success) {
      // On libère le verrou impérativement après le succès de la sauvegarde
      await releaseLock();
    }
    return success;
  }

  // ============================================================================
  // SAUVEGARDE
  // ============================================================================

  function validateEventData() {
    if (!eventName.trim()) {
      return {
        isValid: false,
        errorMessage: "Veuillez renseigner le nom de l'événement",
      };
    }

    if (meals.length === 0) {
      return {
        isValid: false,
        errorMessage: "Veuillez ajouter au moins un repas",
      };
    }

    // Vérification des doublons
    const allDatesValidation = meals.map((m) => m.date);
    const duplicatedDates = allDatesValidation.filter(
      (date, index, self) => self.indexOf(date) !== index,
    );

    if (duplicatedDates.length > 0) {
      const duplicatedDatesFormatted = duplicatedDates.map((date) => {
        try {
          return new Date(date).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch (e) {
          return date;
        }
      });

      return {
        isValid: false,
        errorMessage: `Certaines dates sont en double: ${duplicatedDatesFormatted.join(", ")}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Fonction générique de sauvegarde de l'événement
   * @returns true si succès, false si échec
   */
  async function saveEventData(): Promise<boolean> {
    const validation = validateEventData();
    if (!validation.isValid) {
      toastService.error(validation.errorMessage || "Erreur de validation");
      return false;
    }

    const allDatesSorted = Array.from(
      new Set(sortedMeals.filter((m) => m.date !== "").map((m) => m.date)),
    ).sort();

    const eventData = {
      name: eventName,
      description,
      status,
      minContrib,
      dateStart: allDatesSorted.length > 0 ? allDatesSorted[0] : null,
      dateEnd:
        allDatesSorted.length > 0
          ? allDatesSorted[allDatesSorted.length - 1]
          : null,

      // Pas de teams/contributors ici : éditables de manière concurrente
      // par d'autres utilisateurs (gestion via PermissionsManager/invitations)
      meals: sortedMeals,
    };
    try {
      await eventsStore.updateEvent(eventId, eventData);
      // Le realtime mettra à jour currentEvent
      // Le $effect resynchronisera le shadow draft automatiquement
      // quand on libérera le verrou

      return true;
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toastService.error("Erreur lors de la sauvegarde");
      return false;
    }
  }

  /**
   * Sauvegarde avec libération du lock (pour auto-save)
   */
  async function performAutoSave(): Promise<void> {
    if (!eventId || isBusy || !isEditing) return;

    isBusy = true;
    const toastId = toastService.loading("Sauvegarde automatique...");

    const success = await saveEventData();

    if (success) {
      await releaseLock(); // Cela désactivera aussi isEditing
      toastService.update(toastId, {
        state: "success",
        message: "Modifications sauvegardées automatiquement",
      });
    } else {
      // ⚠️ Données invalides ou erreur → Heartbeat pour maintenir le verrou
      if (eventId && globalState.userId) {
        try {
          await locksService.acquireLock(
            `event_${eventId}`,
            globalState.userId,
            globalState.userName,
          );
        } catch (e) {
          console.error("Erreur heartbeat lock:", e);
        }
      }

      toastService.update(toastId, {
        state: "warning",
        message: "Impossible de sauvegarder : modifications invalides",
      });
    }

    isBusy = false;
    setTimeout(() => toastService.dismiss(toastId), 3000);
  }

  /**
   * Sauvegarde manuelle avec libération du lock
   */
  async function handleSave() {
    isBusy = true;

    const success = await saveEventData();

    if (success) {
      await releaseLock();
      toastService.success("Événement mis à jour");
    }

    isBusy = false;
  }

  let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

    autoSaveTimeout = setTimeout(
      () => {
        performAutoSave();
      },
      5 * 60 * 1000,
    );

    console.log("Auto-save programme dans 5 minutes");
  }

  // Protection beforeunload - Avertir l'utilisateur s'il a des modifications non sauvegardées
  $effect(() => {
    // Capturer la valeur actuelle pour éviter les dépendances dynamiques dans le handler
    const editing = isEditing;
    const dirty = isDirty;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editing || dirty) {
        e.preventDefault();
        e.returnValue =
          "Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });

  // Rafraîchir le lock quand l'onglet redevient visible (mobile/tab arrière-plan)
  $effect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      if (!lockedEventId || !globalState.userId) return;

      const lock = await locksService.acquireLock(
        `event_${lockedEventId}`,
        globalState.userId,
        globalState.userName,
      );
      activeLock = lock;

      if (lock.userId !== globalState.userId) {
        toastService.warning(
          `Cet événement est maintenant édité par ${lockedByUserName}`,
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  });

  // ============================================================================
  // HANDLERS DE MODIFICATION
  // ============================================================================

  async function handleNameInput(e: Event) {
    if (!(await startEditing())) return;

    // Mutation directe du shadow draft
    eventName = (e.target as HTMLInputElement).value;
  }

  async function addMeal() {
    if (!(await startEditing())) return;

    const mealId = nanoid(6);

    // Déterminer la date par défaut
    let defaultDateTime: string;

    if (sortedDatedMeals.length === 0) {
      const today = new Date();
      today.setDate(today.getDate() + 7);
      today.setHours(20, 0, 0, 0);
      defaultDateTime = today.toISOString();
    } else {
      const lastMeal = sortedDatedMeals[sortedDatedMeals.length - 1];
      const lastDate = new Date(lastMeal.date);
      const lastHour = lastDate.getHours();

      if (lastHour < 14) {
        lastDate.setHours(20, 0, 0, 0);
      } else {
        lastDate.setDate(lastDate.getDate() + 1);
        lastDate.setHours(12, 0, 0, 0);
      }

      defaultDateTime = lastDate.toISOString();
    }

    const newMeal: EventMeal = {
      id: mealId,
      date: defaultDateTime,
      guests: 100,
      recipes: [],
    };

    // Mutation directe du shadow draft
    meals = [...meals, newMeal];
    editingMealIndex = mealId;

    // Scroll vers le nouveau meal après le rendu Svelte
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById(`meal-card-${mealId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function removeMeal(mealId: string) {
    meals = meals.filter((m) => m.id !== mealId);
  }

  function toggleEditMeal(mealId: string) {
    editingMealIndex = editingMealIndex === mealId ? null : mealId;
  }

  // ============================================================================
  // ASSIGNATION DE DATE (recettes à planifier)
  // ============================================================================

  async function openAssignDateModal(
    mealId: string,
    recipeUuid: string,
    typeR: RecettesTypeR,
  ) {
    if (!(await startEditing())) return;
    assigningRecipe = { mealId, recipeUuid, typeR, sourceHasDate: false };
    showAssignDateModal = true;
  }

  function openReassignModal(
    mealId: string,
    recipeUuid: string,
    typeR: RecettesTypeR,
  ) {
    assigningRecipe = { mealId, recipeUuid, typeR, sourceHasDate: true };
    showAssignDateModal = true;
  }

  function handleAssignDateRecipe(targetMealId: string) {
    if (!assigningRecipe) return;

    const {
      mealId: sourceMealId,
      recipeUuid,
      typeR,
      sourceHasDate,
    } = assigningRecipe;

    // Trouver le meal source
    const sourceIdx = meals.findIndex((m) => m.id === sourceMealId);
    if (sourceIdx === -1) return;

    const sourceMeal = meals[sourceIdx];

    // 1. Retirer la recette du meal source
    const updatedSourceRecipes = sourceMeal.recipes.filter(
      (r) => r.recipeUuid !== recipeUuid,
    );

    let newMeals = [...meals];

    if (targetMealId === "__undated__") {
      // Mettre de côté : rejoindre ou créer un meal undated
      let undatedIdx = newMeals.findIndex((m) => m.date === "");

      const newRecipe: EventMealRecipe = {
        recipeUuid,
        plates: 0,
        typeR,
        hasOwnPlatesNb: false,
      };

      if (undatedIdx !== -1) {
        // Meal undated existant → ajouter la recette
        const existingUndated = newMeals[undatedIdx];
        newMeals[undatedIdx] = {
          ...existingUndated,
          recipes: [...existingUndated.recipes, newRecipe],
        };
      } else {
        // Créer un nouveau meal undated
        const newUndatedMeal: EventMeal = {
          id: nanoid(6),
          date: "",
          guests: 0,
          recipes: [newRecipe],
        };
        newMeals = [...newMeals, newUndatedMeal];
      }
    } else {
      // Cible datée
      const targetIdx = newMeals.findIndex((m) => m.id === targetMealId);
      if (targetIdx === -1) return;

      const targetMeal = newMeals[targetIdx];

      const updatedTargetRecipes = [
        ...targetMeal.recipes,
        {
          recipeUuid,
          plates: targetMeal.guests,
          typeR,
          hasOwnPlatesNb: false,
        } satisfies EventMealRecipe,
      ];

      newMeals[targetIdx] = {
        ...targetMeal,
        recipes: updatedTargetRecipes,
      };
    }

    // Gérer le meal source vide après retrait
    const updatedSourceIdx = newMeals.findIndex((m) => m.id === sourceMealId);
    if (updatedSourceIdx !== -1) {
      const updatedSource = newMeals[updatedSourceIdx];
      if (updatedSource.recipes.length === 0) {
        if (sourceHasDate) {
          // dated → autre : garder le meal vide
          // Ne rien faire, le meal reste
        } else {
          // undated → dated : supprimer le meal source vide
          newMeals.splice(updatedSourceIdx, 1);
        }
      } else {
        // Meal source a encore des recettes → mettre à jour
        newMeals[updatedSourceIdx] = {
          ...updatedSource,
          recipes: updatedSourceRecipes,
        };
      }
    }

    meals = newMeals;
    showAssignDateModal = false;
    assigningRecipe = null;
  }

  // ============================================================================
  // AUTRES HANDLERS
  // ============================================================================

  async function handleInvitationResponse(accept: boolean) {
    if (!eventId || !globalState.userId) return;

    try {
      isBusy = true;

      const newStatus = accept ? "accepted" : "declined";

      await eventsStore.updateContributorStatus(
        eventId,
        globalState.userId,
        newStatus,
      );

      toastService.success(
        accept ? "Invitation acceptée" : "Invitation déclinée",
      );
    } catch (error) {
      console.error("Erreur réponse invitation:", error);
      toastService.error("Erreur lors de la réponse");
    } finally {
      isBusy = false;
    }
  }

  // ============================================================================
  // STATUS CONFIRMATION HANDLERS
  // ============================================================================

  async function handleConfirmStatus() {
    if (!(await startEditing())) return;
    status = "confirmed";
    showConfirmStatusModal = false;
  }

  async function handleCancelStatus() {
    if (!(await startEditing())) return;
    status = "canceled";
    showCancelStatusModal = false;
  }

  async function handleCancelEdit() {
    showCancelEditModal = false;
    await releaseLock();
    // Le $effect de sync resynchronisera automatiquement le shadow draft
    // depuis currentEvent une fois isEditing passé à false
  }

  function handleExportRecipes() {
    const lines: string[] = [];

    lines.push("---");
    lines.push(`# ${eventName || "Événement"} - Recettes`);
    lines.push("");

    for (const meal of sortedDatedMeals) {
      const date = new Date(meal.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      });
      lines.push(`## ${date} (${meal.guests} couverts)`);
      lines.push("");

      if (meal.recipes.length === 0) {
        lines.push("_Aucune recette_");
        lines.push("");
        continue;
      }

      for (const recipe of meal.recipes) {
        const name =
          recipesStore.getRecipeIndexByUuid(recipe.recipeUuid)?.title ??
          recipe.recipeUuid.slice(0, 8);
        const suffix =
          recipe.hasOwnPlatesNb && recipe.plates !== meal.guests
            ? ` (${recipe.plates})`
            : "";
        lines.push(`- ${name}${suffix}`);
      }
      lines.push("");
    }

    if (undatedMeals.length > 0) {
      const allUndated = undatedMeals.flatMap((m) => m.recipes);
      if (allUndated.length > 0) {
        lines.push("## Recettes à planifier");
        lines.push("");
        for (const recipe of allUndated) {
          const name =
            recipesStore.getRecipeIndexByUuid(recipe.recipeUuid)?.title ??
            recipe.recipeUuid.slice(0, 8);
          lines.push(`- ${name}`);
        }
        lines.push("");
      }
    }

    shareOrDownload(
      lines.join("\n"),
      `${toSlug(eventName || "evenement")}-recettes.md`,
      "Recettes exportées",
    );
  }
</script>

{#snippet navActions()}
  <div class="flex items-center gap-2">
    {#if isEditing}
      <button
        class="btn btn-ghost btn-sm"
        onclick={() => (showCancelEditModal = true)}
        disabled={isBusy}
      >
        <XCircle size={18} class="mr-1" />
        <span class="hidden sm:flex">Annuler</span>
      </button>
    {/if}
    <button
      class="btn btn-circle btn-primary btn-sm"
      onclick={handleExportRecipes}
      title="Exporter les recettes en Markdown"
    >
      <Download size={18} />
    </button>
    <button
      class="btn btn-accent btn-sm"
      onclick={handleSave}
      disabled={isBusy || !isDirty || !canEdit}
    >
      {#if isBusy}
        <span class="loading loading-xs loading-spinner text-primary"></span>
      {:else}
        <Save size={18} class="mr-1" />
      {/if}
      <span class="hidden font-bold sm:flex">Enregistrer</span>
    </button>
  </div>
{/snippet}

<div
  class="relative min-h-lvh space-y-6 overflow-x-clip bg-base-200 px-4 pt-4 pb-20 md:px-20"
>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div class="min-w-80 flex-1 gap-2">
      {#if editingTitle}
        <input
          type="text"
          class="input min-w-full shadow-md input-lg"
          value={eventName}
          oninput={handleNameInput}
          onfocus={startEditing}
          onblur={() => (editingTitle = false)}
          disabled={!canEdit}
          placeholder="Nom de l'événement"
        />
      {:else}
        <button
          class="btn btn-ghost"
          onclick={() => (editingTitle = !editingTitle)}
          disabled={!canEdit}
        >
          <div class="flex items-baseline gap-4">
            <h1 class="">
              {eventName || "Nom de l'événement"}
            </h1>
            <PencilLine class="h-4 w-4" />
          </div>
        </button>
      {/if}
    </div>
    {#if currentEvent}
      <EventStats {currentEvent} />
    {/if}
  </div>

  <!-- Nouveaux champs : description, isConfirmed, minContrib -->
  {#if isInitialised}
    <div
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2 lg:grid-cols-3"
    >
      <!-- Description -->
      <div class="col-span-2">
        <Fieldset legend="Description">
          {#if editingDescription}
            <textarea
              class="textarea w-full"
              placeholder="Décrivez l'événement..."
              bind:value={description}
              onfocus={startEditing}
              onblur={() => (editingDescription = false)}
              disabled={!canEdit}
              maxlength="3000"
              rows="9"></textarea>
            <p class="label">{description.length}/3000 caractères</p>
          {:else}
            <button
              class="btn h-auto justify-start bg-base-100 btn-ghost py-4 text-left font-normal"
              onclick={() => (editingDescription = true)}
              disabled={!canEdit}
            >
              <div class="flex w-full items-start justify-between gap-4">
                <div class="flex-1">
                  {#if description}
                    <p class="whitespace-pre-wrap">{description}</p>
                  {:else}
                    <p class="text-base-content/40 italic">
                      Ajoutez une description...
                    </p>
                  {/if}
                </div>
                <PencilLine class="h-4 w-4 shrink-0" />
              </div>
            </button>
          {/if}
        </Fieldset>
      </div>
      <!-- status & minContrib -->
      <div class="flex flex-col justify-start gap-4">
        <!-- Statut de l'événement -->
        <Fieldset legend="Statut de l'événement">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <!-- Affichage du statut actuel -->
            <BadgeEventStatus {status} />

            <!-- Bouton d'action -->
            {#if status === "proposition"}
              <button
                class="btn btn-link btn-md btn-success"
                onclick={() => (showConfirmStatusModal = true)}
                disabled={!canEdit}
              >
                Confirmez l'événement
              </button>
              <button
                class="btn btn-link btn-error btn-sm"
                onclick={() => (showCancelStatusModal = true)}
                disabled={!canEdit}
              >
                Annuler l'événement
              </button>
            {:else if status === "confirmed"}
              <button
                class="btn btn-link btn-error btn-sm"
                onclick={() => (showCancelStatusModal = true)}
                disabled={!canEdit}
              >
                Annuler l'événement
              </button>
            {:else}
              <button
                class="btn btn-link btn-sm"
                onclick={async () => {
                  if (await startEditing()) {
                    status = "proposition";
                  }
                }}
                disabled={!canEdit}
              >
                Réactiver
              </button>
            {/if}
          </div>
        </Fieldset>
      </div>
    </div>
  {/if}

  <!-- Alerte d'invitation pour les utilisateurs invités -->
  <EventInvitationAlert
    {currentEvent}
    {isBusy}
    onRespond={handleInvitationResponse}
  />

  {#if isBusy && !isInitialised}
    <div class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-lg loading-spinner text-primary"></span>
        <p class="text-base-content/60">Chargement de l'événement...</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-3">
      <!-- Colonne Gauche : Infos & Permissions -->
      <div class="space-y-6 lg:col-span-1">
        <!-- Permissions -->
        <PermissionsManager
          {canEdit}
          {contributors}
          {nativeTeamsStore}
          {eventsStore}
          bind:minContrib
          userId={globalState.userId || ""}
          {eventId}
          onStartEdit={startEditing}
        />

        <!-- Documents liés à l'événement -->
        {#if currentEvent}
          <EventDocumentsFieldset
            eventId={currentEvent.id}
            canEdit={canEdit && !isLockedByOthers}
          />
        {/if}
      </div>

      <!-- Colonne Droite : Repas -->
      <div class="space-y-6 md:px-4 lg:col-span-2">
        <!-- Alerte de verrouillage par un autre utilisateur -->
        {#if isLockedByOthers}
          <div class="alert alert-warning max-md:alert-vertical">
            <LockIcon class="h-6 w-6 shrink-0" />
            <div>
              <h3 class="font-bold">Événement en cours de modification</h3>
              <div class="text-xs">
                Un autre utilisateur est en train de modifier cet événement. Les
                contrôles sont temporairement désactivés.
              </div>
            </div>
          </div>
        {/if}

        <div class="mb-6 flex items-center justify-between">
          <h3 class="card-title text-lg">
            Repas & Menus ({sortedDatedMeals.length})
          </h3>
          <button class="btn btn-primary" onclick={addMeal} disabled={!canEdit}>
            <Plus class="mr-1 h-4 w-4" />
            Ajouter un repas
          </button>
        </div>

        <!-- Recettes à planifier (meals sans date) -->
        {#if undatedMeals.length > 0}
          <fieldset
            class="mb-4 fieldset rounded-box border border-base-300 bg-base-100/50 p-4 shadow"
          >
            <legend
              class="fieldset-legend rounded-2xl bg-base-100/70 px-4 text-lg"
              >Recettes à planifier</legend
            >
            <div class="flex flex-wrap gap-2 p-2">
              {#each undatedMeals as undatedMeal (undatedMeal.id)}
                {#each undatedMeal.recipes as recipe (recipe.recipeUuid)}
                  {@const recipeIndex = recipesStore.getRecipeIndexByUuid(
                    recipe.recipeUuid,
                  )}
                  {@const recipeName =
                    recipeIndex?.title ?? recipe.recipeUuid.slice(0, 8)}
                  <div
                    class="badge badge-lg {getRecipeTypeColor(
                      recipe.typeR,
                    )} h-auto gap-3 border py-1 font-medium"
                    transition:slide
                  >
                    <ChefHat class="size-4 shrink-0" />
                    <span class="leading-none">{recipeName}</span>
                    {#if sortedDatedMeals.length > 0}
                      <button
                        class="btn btn-square btn-outline btn-primary btn-sm"
                        onclick={() =>
                          openAssignDateModal(
                            undatedMeal.id || "",
                            recipe.recipeUuid,
                            recipe.typeR,
                          )}
                        disabled={!canEdit}
                        title="Assigner une date"
                      >
                        <CalendarPlus class="" />
                      </button>
                    {/if}
                  </div>
                {/each}
              {/each}
            </div>
          </fieldset>
        {/if}

        {#if sortedDatedMeals.length === 0}
          <div
            class="flex flex-col items-center justify-center rounded-box border-2 border-dashed border-base-200 bg-base-200 py-12 text-base-content/60"
          >
            <div class="mb-4 rounded-full bg-base-200 p-4">
              <Calendar class="h-8 w-8 opacity-50" />
            </div>
            <p class="font-medium">Aucun repas planifié</p>
            <p class="mt-1 text-sm">
              Commencez par ajouter un repas à votre événement
            </p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each sortedDatedMeals as meal (meal.id + "-" + currentEvent?.updated)}
              <div
                id="meal-card-{meal.id}"
                animate:flip={{ delay: 100, duration: 400 }}
              >
                <EventMealCard
                  bind:meal={meals[meals.findIndex((m) => m.id === meal.id)]}
                  isEditing={editingMealIndex === meal.id}
                  onEditToggle={async () => {
                    if (!(await startEditing())) return;
                    toggleEditMeal(meal.id || "");
                  }}
                  onDelete={() => removeMeal(meal.id || "")}
                  allDates={meals.map((m) => m.date)}
                  disabled={!canEdit || isLockedByOthers}
                  onOpenReassignMealDate={openReassignModal}
                />
              </div>
            {/each}
          </div>
        {/if}
        <div class="flex">
          <button
            class="btn mt-4 btn-block btn-outline btn-primary"
            onclick={addMeal}
            disabled={!canEdit}
          >
            <Plus class="mr-1 h-4 w-4" />
            Ajouter un repas
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Bouton flottant Enregistrer (mobile uniquement) -->
  {#if (isDirty || isEditing) && !isBusy}
    <button
      class="btn sticky bottom-2 shadow-lg btn-accent btn-sm {!globalState.isMobile &&
        'hidden'}"
      onclick={handleSave}
      disabled={!isDirty || !canEdit}
    >
      <Save class="mr-1 size-4" />
      Enregistrer
    </button>
  {/if}
</div>

<!-- Modales de confirmation pour le statut -->
<ConfirmModal
  isOpen={showConfirmStatusModal}
  title="Confirmer l'événement"
  message="Êtes-vous sûr de vouloir confirmer cet événement ? "
  variant="info"
  confirmLabel="Confirmer"
  cancelLabel="Annuler"
  onConfirm={handleConfirmStatus}
  onCancel={() => (showConfirmStatusModal = false)}
/>

<ConfirmModal
  isOpen={showCancelStatusModal}
  title="Annuler la confirmation"
  message="Êtes-vous sûr de vouloir annuler cet événement ?."
  variant="warning"
  confirmLabel="Oui, annuler"
  cancelLabel="Non, garder"
  onConfirm={handleCancelStatus}
  onCancel={() => (showCancelStatusModal = false)}
/>

<!-- Modal d'annulation des modifications -->
<ConfirmModal
  isOpen={showCancelEditModal}
  title="Annuler les modifications"
  message="Vos modifications non enregistrées seront perdues. La dernière version sauvegardée de l'événement sera rétablie."
  variant="warning"
  confirmLabel="Oui, annuler"
  cancelLabel="Continuer l'édition"
  onConfirm={handleCancelEdit}
  onCancel={() => (showCancelEditModal = false)}
/>

<!-- Modal d'assignation de date pour les recettes à planifier -->
{#if showAssignDateModal && assigningRecipe}
  <AssignDateModal
    isOpen={showAssignDateModal}
    onClose={() => {
      showAssignDateModal = false;
      assigningRecipe = null;
    }}
    recipeName={recipesStore.getRecipeIndexByUuid(assigningRecipe.recipeUuid)
      ?.title ?? "Recette"}
    datedMeals={modalDatedMeals}
    onAssign={handleAssignDateRecipe}
    allowSetAside={assigningRecipe.sourceHasDate}
  />
{/if}

<!-- Guard de navigation pour modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey={`/event/${eventId}`}
  shouldProtect={() => isDirty}
  onLeaveWithoutSave={async () => {
    // Libérer le lock si on le détient
    if (isEditing) {
      await releaseLock();
    }
  }}
  message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
/>

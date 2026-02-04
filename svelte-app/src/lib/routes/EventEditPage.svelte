<script lang="ts">
  import EventMealCard from "$lib/components/eventEdit/EventMealCard.svelte";
  import PermissionsManager from "$lib/components/PermissionsManager.svelte";
  import EventInvitationAlert from "$lib/components/EventInvitationAlert.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { nativeTeamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import { getContributors } from "$lib/utils/event-stats-helpers";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import type { EventMeal } from "$lib/types/events";
  import { isDemoEvent } from "$lib/data/demo-event-config";

  import {
    Calendar,
    Plus,
    Save,
    Lock,
    PencilLine,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Users,
    Info,
  } from "@lucide/svelte";
  import { nanoid } from "nanoid";
  import { flip } from "svelte/animate";
  import { untrack, onDestroy, onMount } from "svelte";
  import EventStats from "../components/EventStats.svelte";
  import EventTodoList from "../components/eventTodo/EventTodoList.svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { locksService, type AppwriteLock } from "../services/appwrite-locks";
  import UnsavedChangesGuard from "../components/ui/UnsavedChangesGuard.svelte";
  import Fieldset from "../components/ui/Fieldset.svelte";
  import ConfirmModal from "../components/ui/ConfirmModal.svelte";
  import BadgeEventStatus from "../components/ui/BadgeEventStatus.svelte";

  // ============================================================================
  // PROPS & INITIALISATION
  // ============================================================================

  import { route } from "$lib/router";

  // Rendre eventId entièrement réactif aux changements de params
  let eventId = $derived(route.params.id);

  // Shadow Draft permanent (jamais null)
  // NOTE: meals est un $state brut (non trié) pour permettre les mutations
  let meals = $state<EventMeal[]>([]);
  let eventName = $state("");
  let description = $state("");
  let status = $state<
    "proposition" | "confirmed" | "canceled" | "archive" | "locked" | "local"
  >("proposition");
  let minContrib = $state<number>(1);

  // Meals triés par date pour l'affichage et la sauvegarde (computed réactif)
  const sortedMeals = $derived(
    [...meals].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  );

  // État UI
  let isInitialised = $state(false);
  let isBusy = $state(false); // Quand on sauvegarde/charge (maître)
  let isAcquiringLock = $state(false); // Quand on acquiert le lock
  let isEditing = $state(false); // Mode édition (shadow draft actif)
  let editingMealIndex = $state<string | null>(null);
  let editingTitle = $state(false);
  let editingDescription = $state(false);

  // États des modales de confirmation
  let showConfirmStatusModal = $state(false);
  let showCancelStatusModal = $state(false);

  // État du verrou externe (via locksService)
  let activeLock = $state<AppwriteLock | null>(null);
  let lockUnsub: (() => void) | null = null;

  // isDirty est calculé par comparaison avec currentEvent (la référence)
  const isDirty = $derived.by(() => {
    if (eventName === "" && meals.length === 0) return false;
    if (!isInitialised || !isEditing || !currentEvent) return false;

    // Comparaison des valeurs scalaires
    if (eventName !== currentEvent.name) return true;
    if (description !== (currentEvent.description || "")) return true;
    if (status !== currentEvent.status) return true;
    if (minContrib !== (currentEvent.minContrib || 1)) return true;

    // Comparaison structurelle des meals
    const currentMeals = currentEvent.meals || [];
    if (meals.length !== currentMeals.length) return true;

    // Comparer les métadonnées de chaque meal (pas les objets recipes complets)
    for (let i = 0; i < meals.length; i++) {
      const currentMeal = currentMeals[i];
      const localMeal = meals[i];

      if (localMeal.id !== currentMeal.id) return true;
      if (localMeal.date !== currentMeal.date) return true;
      if (localMeal.guests !== currentMeal.guests) return true;
      if (
        (localMeal.recipes?.length || 0) !== (currentMeal.recipes?.length || 0)
      )
        return true;
    }

    return false;
  });

  /**
   * Démarre le mode édition en acquérant le verrou.
   * Mode démo : active isEditing sans verrou.
   * Mode normal : acquiert le verrou puis active isEditing.
   */
  async function startEditing(): Promise<boolean> {
    if (isEditing) return true; // Déjà en édition

    if (isLockedByOthers) {
      toastService.warning(
        `Cet événement est verrouillé par ${lockedByUserName}`,
      );
      return false;
    }

    // Mode démo : activer directement l'édition (pas de lock)
    if (currentEvent && isDemoEvent(currentEvent.$id)) {
      isEditing = true;
      return true;
    }

    // Mode normal : acquérir le verrou
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
  const selectedTeams = $derived(currentEvent?.teamsId ?? []);

  const isLockedByOthers = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId !== globalState.userId;
  });

  const isLockedByMe = $derived.by(() => {
    if (!activeLock) return false;
    return activeLock.userId === globalState.userId;
  });

  const canEdit = $derived(
    // ✅ Mode démo : toujours éditable
    (currentEvent && isDemoEvent(currentEvent.$id)) ||
      // Mode normal : vérifier les permissions
      (eventsStore.canUserEditEvent(eventId, globalState.userId || "") &&
        !isLockedByOthers &&
        !isBusy),
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
      //   isDemo: isDemoEvent(currentEvent.$id),
      // });
    });
  });

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
      isLockedByOthers,
      lockedByUserName,
      hasUnsavedChanges: isDirty && !isLockedByOthers,
    });
  });
  // ============================================================================
  // INITIALISATION
  // ============================================================================

  $effect(() => {
    // Guard 1: déjà initialisé OU déjà en cours
    if (isInitialised || isBusy) {
      console.log("[Init] Guard 1 - Déjà initialisé ou occupé", {
        isInitialised,
        isBusy,
      });
      return;
    }

    // Guard 2: pas d'eventId
    if (!eventId) {
      console.log("[Init] Guard 2 - Pas d'eventId");
      return;
    }

    console.log("[Init] Début initialisation pour eventId:", eventId);

    untrack(async () => {
      isBusy = true;
      try {
        const event = eventsStore.getEventById(eventId);
        console.log("[Init] Event récupéré:", event?.$id, event?.name);

        // 🔥 Mode démo: marquer initialisé, pas de lock
        if (event && isDemoEvent(event.$id)) {
          console.log("[Init] Mode démo: prêt, marquage isInitialised = true");
          isInitialised = true;
          // ✅ NE PAS activer isEditing ici - il sera activé par startEditing() quand l'utilisateur éditera
          return;
        }

        // Mode normal: initialiser le lock
        activeLock = await locksService.getLock(eventId);
        lockUnsub = locksService.subscribeToLock(eventId, (lock) => {
          console.log("[EventEditPage] 🔒 Verrou mis à jour:", {
            lockedBy: lock?.userName,
            userId: lock?.userId,
            expiresAt: lock?.expiresAt,
          });
          activeLock = lock;
        });

        isInitialised = true;
      } finally {
        isBusy = false;
        console.log("[Init] Fin initialisation, isBusy = false");
      }
    });
  });

  // ============================================================================
  // RESET AU CHANGEMENT DE ROUTE
  // ============================================================================

  // $effect(() => {
  //   // Réinitialiser quand eventId change
  //   // NOTE: Le cleanup s'exécute AVANT le prochain run de l'effect
  //   return () => {
  //     console.log("[EventEditPage] Changement de route, reset état...");
  //     isInitialised = false;
  //     activeLock = null;
  //     if (lockUnsub) {
  //       lockUnsub();
  //       lockUnsub = null;
  //     }
  //   };
  // });

  onDestroy(() => {
    // 1. Annuler l'auto-save planifié
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = null;
    }

    // 2. Désabonner du realtime des locks
    if (lockUnsub) {
      lockUnsub();
      lockUnsub = null;
    }

    // 3. Libérer le lock si détenu
    if (eventId && isEditing) {
      console.log("🚪 Démontage du composant, libération du lock...");
      releaseLock();
    }

    // 4. Reset de la navbar
    navBarStore.reset();
  });

  // ============================================================================
  // LOCK MANAGEMENT
  // ============================================================================

  async function acquireLock(): Promise<boolean> {
    // Mode démo : ne rien faire (géré par startEditing)
    if (currentEvent && isDemoEvent(currentEvent.$id)) {
      console.log("[acquireLock] Mode démo : pas de lock à acquérir");
      return true;
    }

    if (!eventId || !globalState.userId || isBusy || isAcquiringLock)
      return false;

    isAcquiringLock = true;
    try {
      const success = await locksService.acquireLock(
        eventId,
        globalState.userId,
        globalState.userName,
      );

      if (success) {
        // On laisse le realtime mettre à jour activeLock (pas d'optimistic update)
        scheduleAutoSave();
        return true;
      } else {
        toastService.warning(
          `Cet événement est en cours de modification par ${lockedByUserName}`,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Erreur acquisition verrou:", error);
      toastService.error("Impossible de verrouiller l'événement");
      return false;
    } finally {
      isAcquiringLock = false;
    }
  }

  async function releaseLock(): Promise<void> {
    // Mode démo : juste désactiver le mode édition
    if (currentEvent && isDemoEvent(currentEvent.$id)) {
      console.log("[releaseLock] Mode démo : désactivation de isEditing");
      isEditing = false;
      return;
    }

    // Mode normal : libérer le vrai verrou
    if (!eventId || !globalState.userId) return;

    try {
      await locksService.releaseLock(eventId, globalState.userId);
      console.log("🔓 Verrou libéré");
    } catch (error) {
      console.error("❌ Erreur libération verrou:", error);
    }

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

    // Contributors existants
    const contributorsToSave = contributors;

    const allDatesSorted = Array.from(
      new Set(sortedMeals.map((m) => m.date)),
    ).sort();

    // Récupérer les noms des teams sélectionnés
    // 1. Commencer avec les noms existants de currentEvent
    const existingTeamNames = currentEvent?.teams || [];
    const existingTeamIds = currentEvent?.teamsId || [];
    const teamNamesMap = new Map(
      existingTeamIds.map((id, index) => [id, existingTeamNames[index]]),
    );

    // 2. Ajouter/mettre à jour les noms depuis nativeTeamsStore pour les teams sélectionnés
    const teamNames = selectedTeams.map((teamId) => {
      // Priorité: valeur depuis nativeTeamsStore, sinon valeur existante, sinon ID
      const team = nativeTeamsStore.getTeamById(teamId);
      return team?.name || teamNamesMap.get(teamId) || teamId;
    });

    const eventData = {
      name: eventName,
      description,
      status,
      minContrib,
      allDates: allDatesSorted as string[],
      dateStart: allDatesSorted.length > 0 ? allDatesSorted[0] : "",
      dateEnd:
        allDatesSorted.length > 0
          ? allDatesSorted[allDatesSorted.length - 1]
          : "",

      // ON ne save pas, car peut etre édité de manière concurrente par d'autre utilisateur
      // teams: teamNames, // Noms des équipes pour affichage
      // teamsId: selectedTeams, // IDs des équipes pour filtrage
      // contributors: contributorsToSave,
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
            eventId,
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

    console.log("⏰ Auto-save programmé dans 30 secondes");
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

    if (sortedMeals.length === 0) {
      const today = new Date();
      today.setDate(today.getDate() + 7);
      today.setHours(20, 0, 0, 0);
      defaultDateTime = today.toISOString();
    } else {
      const lastMeal = sortedMeals[sortedMeals.length - 1];
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
  }

  function removeMeal(mealId: string) {
    meals = meals.filter((m) => m.id !== mealId);
  }

  function toggleEditMeal(mealId: string) {
    editingMealIndex = editingMealIndex === mealId ? null : mealId;
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
</script>

{#snippet navActions()}
  <div class="flex items-center gap-2">
    <button
      class="btn btn-accent btn-sm"
      onclick={handleSave}
      disabled={isBusy || !isDirty || !canEdit}
    >
      {#if isBusy}
        <span class="loading loading-spinner loading-xs text-primary"></span>
      {:else}
        <Save size={18} class="mr-1" />
      {/if}
      <span class="font-bold">Enregistrer</span>
    </button>
  </div>
{/snippet}

<div class="bg-base-200 min-h-lvh space-y-6 px-2 pt-4 pb-20 md:px-20">
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div class="min-w-80 flex-1 gap-2">
      {#if editingTitle}
        <input
          type="text"
          class="input input-lg min-w-full shadow-md"
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
              rows="9"
            ></textarea>
            <p class="label">{description.length}/3000 caractères</p>
          {:else}
            <button
              class="btn btn-ghost bg-base-100 h-auto justify-start py-4 text-left font-normal"
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
                class="btn btn-success btn-link btn-md"
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
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="text-base-content/60">Chargement de l'événement...</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-3">
      <!-- Colonne Gauche : Infos & Permissions -->
      <div class="space-y-6 lg:col-span-1">
        <!-- Permissions -->
        {#if currentEvent && isDemoEvent(currentEvent.$id)}
          <!-- Mode démo : Message informatif -->
          <Fieldset legend="Participants" iconComponent={Users}>
            <div class="alert alert-info">
              <Info class="h-5 w-5" />
              <div>
                <h4 class="font-bold">Mode Démonstration</h4>
                <p class="text-sm">
                  Dans un véritable événement, vous pourrez inviter des équipes
                  et des participants à collaborer sur la planification.
                </p>
              </div>
            </div>
          </Fieldset>
        {:else}
          <!-- Mode normal : PermissionsManager -->
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
        {/if}

        <!-- Liste des Tâches (TODO) -->
        {#if currentEvent}
          <EventTodoList
            event={currentEvent}
            {contributors}
            disabled={!canEdit || isLockedByOthers}
          />
        {/if}
      </div>

      <!-- Colonne Droite : Repas -->
      <div class="space-y-6 md:px-4 lg:col-span-2">
        <!-- Alerte de verrouillage par un autre utilisateur -->
        {#if isLockedByOthers}
          <div class="alert alert-warning max-md:alert-vertical">
            <Lock class="h-6 w-6 shrink-0" />
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
            Repas & Menus ({sortedMeals.length})
          </h3>
          <button class="btn btn-primary" onclick={addMeal} disabled={!canEdit}>
            <Plus class="mr-1 h-4 w-4" />
            Ajouter un repas
          </button>
        </div>

        {#if sortedMeals.length === 0}
          <div
            class="text-base-content/60 bg-base-200 rounded-box border-base-200 flex flex-col items-center justify-center border-2 border-dashed py-12"
          >
            <div class="bg-base-200 mb-4 rounded-full p-4">
              <Calendar class="h-8 w-8 opacity-50" />
            </div>
            <p class="font-medium">Aucun repas planifié</p>
            <p class="mt-1 text-sm">
              Commencez par ajouter un repas à votre événement
            </p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each sortedMeals as meal (meal.id + "-" + currentEvent?.$updatedAt)}
              <div animate:flip={{ delay: 100, duration: 400 }}>
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
                />
              </div>
            {/each}
          </div>
        {/if}
        <div class="flex">
          <button
            class="btn btn-outline btn-primary btn-block mt-4"
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

<!-- Guard de navigation pour modifications non sauvegardées -->
<UnsavedChangesGuard
  routeKey={`/event/${eventId}`}
  shouldProtect={() => isDirty}
  onLeaveWithoutSave={handleLeaveWithoutSave}
  onSaveAndLeave={handleSaveAndLeave}
  message="Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
/>

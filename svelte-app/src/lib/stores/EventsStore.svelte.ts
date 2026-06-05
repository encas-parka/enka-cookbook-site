/**
 * EventsStore - Store de gestion des événements avec Svelte 5 + aw-sync
 *
 * Architecture:
 * - aw-sync: Dexie (db.events) + delta sync + realtime + optimistic writes
 * - bridgeToMap: liveQuery → SvelteMap<Main> (raw Appwrite data)
 * - $derived: EnrichedEvent with parsed meals/contributors/todos
 * - Business logic: CRUD, invitations, meals, todos, poster configs
 *
 * Flux de données:
 * Lecture :  Dexie → liveQuery → SvelteMap<Main> → $derived → EnrichedEvent → UI
 * Écriture : UI → Store → #collection.update() → Dexie (optimiste) → Appwrite → confirmé
 * Realtime : Appwrite WS → aw-sync → Dexie.put() → liveQuery → SvelteMap → $derived → UI
 *
 * @usage
 * await eventsStore.initialize();
 * const event = eventsStore.getEventById('event-id');
 * const myEvents = eventsStore.events;
 */

import { ExecutionMethod } from "appwrite";
import type { Main, MainStatus } from "$lib/types/appwrite.d";
import type {
  CreateEventData,
  UpdateEventData,
  EnrichedEvent,
  EventMeal,
  EventMealRecipe,
  EventContributor,
  EventTodo,
  EventTodoStatus,
  EventStatus,
} from "$lib/types/events.d";
import type { RecettesTypeR } from "$lib/types/recipes.types";
import { nanoid } from "nanoid";
import {
  getEvent as getAppwriteEvent,
  createEvent as createAppwriteEvent,
  createEventWithTeams as createAppwriteEventWithTeams,
  deleteEvent as deleteAppwriteEvent,
} from "$lib/services/appwrite-events";
import { globalState } from "./GlobalState.svelte";
import {
  parseEventMeals,
  parseEventContributors,
  parseEventTodos,
} from "$lib/utils/events.utils";
import { getAppwriteInstances, getCollectionId } from "$lib/services/appwrite";
import {
  createSyncCollection,
  bridgeToMap,
  db,
  type BridgeResult,
} from "$lib/db-sync/aw-sync";

// =============================================================================
// STORE CLASS
// =============================================================================

export class EventsStore {
  // aw-sync collection for events (Appwrite 'main' table)
  #collection = createSyncCollection<Main>({
    table: db.events,
    collectionName: "events",
  });

  // Bridge: liveQuery on db.events → SvelteMap of raw Appwrite data
  #bridge: BridgeResult<Main> = bridgeToMap<Main>(() => db.events.toArray());
  #rawEvents = this.#bridge.map;

  // UI state
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #realtimeInitialized = false;

  // User context — dérivé réactif de globalState pour rester synchronisé
  #userId = $derived(globalState.userId);
  #userTeams = $derived(globalState.userTeams);

  // Dedup init
  #initPromise: Promise<void> | null = null;

  // =============================================================================
  // DERIVED: Enriched events from raw Main data
  // =============================================================================

  /**
   * Transforme un événement brut (Main) en événement enrichi (EnrichedEvent).
   * Les champs meals/contributors/todos (JSON stringifiés dans Appwrite)
   * sont parsés en objets typés.
   */
  #enrichEvent(main: Main): EnrichedEvent {
    return {
      ...main,
      status: (main.status as EventStatus) ?? "proposition",
      teams: main.teams || undefined,
      teamsId: main.teamsId || undefined,
      meals: parseEventMeals(main.meals),
      contributors: parseEventContributors(main.contributors),
      todos: parseEventTodos(main.todos),
    };
  }

  /**
   * Map enrichie — dérivée automatiquement depuis les données brutes Dexie.
   * Re-dérivée à chaque changement dans #rawEvents (bridge liveQuery).
   * Les champs JSON stringifiés sont parsés à la volée.
   */
  #enrichedMap = $derived.by(() => {
    const map = new Map<string, EnrichedEvent>();
    // .size assure le suivi réactif de la SvelteMap
    const _s = this.#rawEvents.size;
    for (const [id, main] of this.#rawEvents) {
      map.set(id, this.#enrichEvent(main));
    }
    return map;
  });

  // =============================================================================
  // DERIVED: Current & past events
  // =============================================================================

  /**
   * Événements en cours (dateEnd >= aujourd'hui), triés par dateStart croissant
   */
  #currentEvents = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from(this.#enrichedMap.values())
      .filter((event) => {
        if (!event.dateStart || !event.dateEnd) return false;
        return new Date(event.dateEnd) >= today;
      })
      .sort((a, b) => {
        return (
          new Date(a.dateStart!).getTime() - new Date(b.dateStart!).getTime()
        );
      });
  });

  /**
   * Événements passés (dateEnd < maintenant), triés par dateStart décroissant
   */
  #pastEvents = $derived.by(() => {
    const now = new Date();

    return Array.from(this.#enrichedMap.values())
      .filter((event) => {
        if (!event.dateStart || !event.dateEnd) return false;
        return new Date(event.dateEnd) < now;
      })
      .sort((a, b) => {
        return (
          new Date(b.dateStart!).getTime() - new Date(a.dateStart!).getTime()
        );
      });
  });

  // =============================================================================
  // GETTERS
  // =============================================================================

  get loading() {
    return this.#loading;
  }

  get error() {
    return this.#error;
  }

  get isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Liste réactive de tous les événements accessibles
   */
  get events() {
    return Array.from(this.#enrichedMap.values());
  }

  get count() {
    return this.#enrichedMap.size;
  }

  get currentEvents() {
    return this.#currentEvents;
  }

  get pastEvents() {
    return this.#pastEvents;
  }

  get pastEventsCount() {
    return this.#pastEvents.length;
  }

  /**
   * Événements à venir où l'utilisateur est participant accepté
   * Exclut les événements annulés et archivés
   */
  getUpcomingEventsForUser(): EnrichedEvent[] {
    const events = this.#currentEvents;
    if (!this.#userId) return [];

    return events.filter((event) => {
      if (event.status === "canceled" || event.status === "archive")
        return false;

      // Créateur → inclus
      if (event.createdBy === this.#userId) return true;

      // Contributeur accepté → inclus
      if (
        event.contributors?.some(
          (c) => c.id === this.#userId && c.status === "accepted",
        )
      )
        return true;

      // Membre d'une équipe de l'événement → inclus
      if (event.teamsId?.some((teamId) => this.#userTeams.includes(teamId)))
        return true;

      return false;
    });
  }

  // =============================================================================
  // 3-PHASE INIT
  // =============================================================================

  /**
   * Phase 1 : Charger depuis le cache Dexie
   * Les données sont déjà disponibles via bridgeToMap (liveQuery)
   */
  async loadCache(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[EventsStore] Cache déjà chargé");
      return;
    }

    console.log("[EventsStore] Chargement du cache...");
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.isAuthenticated) {
        throw new Error("Utilisateur non connecté");
      }

      // #userId et #userTeams sont maintenant des $derived de globalState,
      // pas besoin de les assigner manuellement

      // Dexie data is already loaded via bridgeToMap liveQuery
      this.#isInitialized = true;
      console.log(
        `[EventsStore] Cache chargé: ${this.#rawEvents.size} événements`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement du cache";
      this.#error = message;
      console.error("[EventsStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 2 : Delta sync depuis Appwrite (premier chargement avec loading UI).
   * Toggle `this.#loading` avant et après l'appel. Utilisé pendant l'init.
   *
   * Sémantique : si déjà initialisé, équivaut à `syncRevalidate()` avec loading
   * toggle (pas de skip sur `#isInitialized`). Le toggle loading peut être
   * visible si appelé après init — préférer `syncRevalidate()` pour les
   * revalidations silencieuses.
   */
  async syncInitial(): Promise<void> {
    return this.#runWithLoading(() => this.syncRevalidate());
  }

  /**
   * Revalidation silencieuse depuis le remote (sans flash UI skeleton).
   * Ne toggle PAS le loading. Met à jour Dexie en place (bridgeToMap propage
   * aux composants). Utilisé par `main.ts:performResync()` et toute
   * situation de revalidation en arrière-plan.
   */
  async syncRevalidate(): Promise<void> {
    console.log("[EventsStore] Synchronisation depuis Appwrite...");
    try {
      await this.#collection.initialFetch();
      console.log(
        `[EventsStore] Synchronisation terminée: ${this.#rawEvents.size} événements`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de la synchronisation";
      this.#error = message;
      console.error("[EventsStore]", message, err);
      throw err;
    }
  }

  async #runWithLoading(work: () => Promise<void>): Promise<void> {
    this.#loading = true;
    try {
      return await work();
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 3 : Activer le realtime Appwrite via aw-sync
   */
  async setupRealtime(): Promise<void> {
    if (this.#realtimeInitialized) {
      console.log("[EventsStore] Realtime déjà configuré");
      return;
    }

    console.log("[EventsStore] Configuration du realtime...");
    this.#collection.subscribe();
    this.#realtimeInitialized = true;
  }

  /**
   * Initialise le store (combine les 3 phases)
   */
  async initialize(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[EventsStore] Déjà initialisé");
      return;
    }

    if (this.#initPromise) {
      console.log("[EventsStore] Initialisation déjà en cours, attente...");
      return this.#initPromise;
    }

    console.log("[EventsStore] Initialisation complète...");
    this.#loading = true;
    this.#error = null;

    this.#initPromise = (async () => {
      try {
        await this.loadCache();
        await this.syncInitial();
        await this.setupRealtime();

        console.log(
          `[EventsStore] Initialisation complétée: ${this.#rawEvents.size} événements`,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors de l'initialisation";
        this.#error = message;
        console.error("[EventsStore]", message, err);
        throw err;
      } finally {
        this.#loading = false;
        this.#initPromise = null;
      }
    })();

    return this.#initPromise;
  }

  // =============================================================================
  // PUBLIC API - LECTURE
  // =============================================================================

  /**
   * Récupère un événement par ID
   */
  getEventById(eventId: string): EnrichedEvent | null {
    return this.#enrichedMap.get(eventId) || null;
  }

  /**
   * Récupère un événement depuis Appwrite (force refresh)
   */
  async fetchEvent(eventId: string): Promise<EnrichedEvent | null> {
    try {
      const event = await getAppwriteEvent(eventId);
      if (event) {
        await db.events.put(event);
        return this.#enrichEvent(event);
      }
      return null;
    } catch (err) {
      console.error(`[EventsStore] Erreur lors du fetch de ${eventId}:`, err);
      return null;
    }
  }

  /**
   * Filtre les événements par date
   */
  getEventsByDateRange(startDate: string, endDate: string): EnrichedEvent[] {
    return this.events.filter((event) => {
      return (
        event.dateStart &&
        event.dateEnd &&
        event.dateStart >= startDate &&
        event.dateEnd <= endDate
      );
    });
  }

  /**
   * Vérifie si l'utilisateur peut éditer un événement
   */
  canEditEvent(eventId: string): boolean {
    if (!this.#userId) return false;

    const event = this.#enrichedMap.get(eventId);
    if (!event) return false;

    // Créateur
    if (event.createdBy === this.#userId) return true;

    // Membre d'une équipe autorisée
    if (event.teams?.some((teamId) => this.#userTeams.includes(teamId)))
      return true;

    // Contributeur accepté
    if (
      event.contributors?.some(
        (c) => c.id === this.#userId && c.status === "accepted",
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un utilisateur spécifique peut éditer un événement
   */
  canUserEditEvent(
    eventId: string,
    userId: string,
    userTeams?: string[],
  ): boolean {
    const event = this.#enrichedMap.get(eventId);
    if (!event) return false;
    if (!userId) return false;

    // Créateur
    if (event.createdBy === userId) return true;

    // Membre d'une équipe autorisée
    if (event.teams?.length && userTeams?.length) {
      if (event.teams.some((teamId) => userTeams.includes(teamId))) {
        return true;
      }
    }

    // Contributeur accepté
    if (
      event.contributors?.some(
        (c) => c.id === userId && c.status === "accepted",
      )
    ) {
      return true;
    }

    return false;
  }

  // =============================================================================
  // SERIALISATION & CRUD
  // =============================================================================

  /**
   * Sérialise les données de mise à jour pour Appwrite.
   * meals/contributors/todos sont des string[] (JSON stringifiés) dans Appwrite.
   */
  #serializeUpdateData(data: UpdateEventData): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    if (data.name !== undefined) serialized.name = data.name;
    if (data.dateStart !== undefined) serialized.dateStart = data.dateStart;
    if (data.dateEnd !== undefined) serialized.dateEnd = data.dateEnd;
    if (data.allDates !== undefined) serialized.allDates = data.allDates;
    if (data.status !== undefined) serialized.status = data.status;
    if (data.teams !== undefined) serialized.teams = data.teams;
    if (data.teamsId !== undefined) serialized.teamsId = data.teamsId;
    if (data.description !== undefined)
      serialized.description = data.description;
    if (data.minContrib !== undefined) serialized.minContrib = data.minContrib;

    // JSON stringification pour les champs array d'objets
    if (data.meals !== undefined) {
      serialized.meals = data.meals.map((m) => JSON.stringify(m));
    }
    if (data.contributors !== undefined) {
      serialized.contributors = data.contributors.map((c) => JSON.stringify(c));
    }
    if (data.todos !== undefined) {
      serialized.todos = data.todos.map((t) => JSON.stringify(t));
    }

    return serialized;
  }

  /**
   * Met à jour un événement via aw-sync avec écriture optimiste.
   * Sérialise automatiquement meals/contributors/todos.
   */
  async #updateEventData(
    eventId: string,
    data: UpdateEventData,
  ): Promise<Main> {
    const serialized = this.#serializeUpdateData(data);
    return await this.#collection.update(eventId, serialized as Partial<Main>);
  }

  /**
   * Crée un nouvel événement
   * @deprecated : utiliser createEventWithTeams (CF unifiée)
   */
  async createEvent(data: CreateEventData): Promise<EnrichedEvent> {
    if (!globalState.userId) throw new Error("Utilisateur non connecté");

    const event = await createAppwriteEvent(data, globalState.userId);
    await db.events.put(event);

    console.log(`[EventsStore] Événement créé: ${event.$id}`);
    return this.#enrichEvent(event);
  }

  /**
   * Crée un nouvel événement avec des teams (CF unifiée)
   */
  async createEventWithTeams(
    data: CreateEventData,
    teamIds: string[] = [],
    sendEmailToExistingMembers: boolean = true,
  ): Promise<EnrichedEvent> {
    if (!globalState.userId) throw new Error("Utilisateur non connecté");

    const event = await createAppwriteEventWithTeams(
      data,
      globalState.userId,
      teamIds,
      sendEmailToExistingMembers,
    );
    await db.events.put(event);

    console.log(
      `[EventsStore] Événement créé avec ${teamIds.length} team(s): ${event.$id}`,
    );
    return this.#enrichEvent(event);
  }

  /**
   * Met à jour un événement (écriture optimiste via aw-sync)
   */
  async updateEvent(
    eventId: string,
    data: UpdateEventData,
  ): Promise<EnrichedEvent> {
    const confirmed = await this.#updateEventData(eventId, data);
    console.log(`[EventsStore] Événement mis à jour: ${eventId}`);
    return this.#enrichEvent(confirmed);
  }

  /**
   * Met à jour uniquement le statut d'un événement
   */
  async updateEventStatus(eventId: string, status: MainStatus): Promise<void> {
    try {
      await this.#collection.update(eventId, {
        status,
      } as Partial<Main>);
      console.log(`[EventsStore] Statut mis à jour: ${eventId} -> ${status}`);
    } catch (err) {
      console.error(`[EventsStore] Erreur mise à jour statut ${eventId}:`, err);
      throw err;
    }
  }

  /**
   * Supprime un événement (CF + cleanup label + suppression Dexie)
   */
  async deleteEvent(eventId: string): Promise<void> {
    await deleteAppwriteEvent(eventId); // Supprime + CF cleanup label
    await db.events.delete(eventId); // Supprime du cache Dexie
    console.log(`[EventsStore] Événement supprimé: ${eventId}`);
  }

  // =============================================================================
  // PUBLIC API - CONTRIBUTORS
  // =============================================================================

  /**
   * Récupère les contributeurs d'un événement
   */
  getContributors(eventId: string): EventContributor[] {
    const event = this.#enrichedMap.get(eventId);
    if (!event) return [];
    return event.contributors;
  }

  getContributorStatus(eventId: string): string {
    const event = this.#enrichedMap.get(eventId);
    if (!event) return "";
    const user = event.contributors.filter((c) => c.id === this.#userId);
    return user.length > 0 ? user[0].status : "";
  }

  /**
   * Supprime un contributeur d'un événement
   */
  async removeContributor(
    eventId: string,
    contributorId: string,
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      // Retirer le Label de l'utilisateur via CF
      const { removeUserFromEvent } =
        await import("$lib/services/appwrite-functions");
      await removeUserFromEvent(eventId, contributorId);

      const contributors = event.contributors.filter(
        (c) => c.id !== contributorId && c.email !== contributorId,
      );

      if (event.contributors.length === contributors.length) {
        return event;
      }

      return await this.updateEvent(eventId, { contributors });
    } catch (err) {
      console.error(`[EventsStore] Erreur suppression contributeur:`, err);
      throw err;
    }
  }

  /**
   * Met à jour le statut d'un contributeur
   */
  async updateContributorStatus(
    eventId: string,
    contributorId: string,
    status: "accepted" | "declined",
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const contributors = [...event.contributors];
      const index = contributors.findIndex(
        (c) => c.id === contributorId || c.email === contributorId,
      );

      if (index === -1) throw new Error("Contributeur introuvable");

      contributors[index] = {
        ...contributors[index],
        status,
        respondedAt: new Date().toISOString(),
      };

      return await this.updateEvent(eventId, { contributors });
    } catch (err) {
      console.error(`[EventsStore] Erreur maj statut:`, err);
      throw err;
    }
  }

  // =============================================================================
  // PUBLIC API - TEAMS
  // =============================================================================

  /**
   * Invite des teams et/ou des utilisateurs à un événement (méthode unifiée)
   */
  async inviteParticipants(
    eventId: string,
    options: {
      teamIds?: string[];
      emails?: string[];
      userIds?: string[];
      sendEmailToExistingMembers?: boolean;
    },
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const {
        teamIds = [],
        emails = [],
        userIds = [],
        sendEmailToExistingMembers = true,
      } = options;

      if (teamIds.length === 0 && emails.length === 0 && userIds.length === 0) {
        console.log(`[EventsStore] Aucun participant à inviter`);
        return event;
      }

      const { inviteParticipantsToEvent } =
        await import("$lib/services/appwrite-functions");
      const result = await inviteParticipantsToEvent(eventId, event.name, {
        teamIds,
        emails,
        userIds,
        sendEmailToExistingMembers,
      });

      console.log(`[EventsStore] Invitation déclenchée: ${result.executionId}`);

      // Retourner l'événement actuel (sera mis à jour via realtime)
      return event;
    } catch (err) {
      console.error(`[EventsStore] Erreur invitation participants:`, err);
      throw err;
    }
  }

  /**
   * Retire une team d'un événement
   */
  async removeTeam(eventId: string, teamId: string): Promise<EnrichedEvent> {
    try {
      const { removeTeamFromEvent } =
        await import("$lib/services/appwrite-functions");
      await removeTeamFromEvent(eventId, teamId);

      // Recharger l'événement depuis Appwrite
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const updatedEvent = await this.fetchEvent(eventId);

      if (!updatedEvent) throw new Error("Impossible de recharger l'événement");

      console.log(
        `[EventsStore] Team ${teamId} retirée de l'événement ${eventId}`,
      );

      return updatedEvent;
    } catch (err) {
      console.error(`[EventsStore] Erreur retrait team:`, err);
      throw err;
    }
  }

  // =============================================================================
  // PUBLIC API - MEALS
  // =============================================================================

  /**
   * Récupère les meals d'un événement
   */
  getMeals(eventId: string): EventMeal[] {
    const event = this.#enrichedMap.get(eventId);
    if (!event) return [];
    return event.meals;
  }

  /**
   * Ajoute un repas à un événement
   */
  async addMeal(eventId: string, meal: EventMeal): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const meals = [...event.meals, meal];
      return await this.updateEvent(eventId, { meals });
    } catch (err) {
      console.error(`[EventsStore] Erreur ajout meal:`, err);
      throw err;
    }
  }

  /**
   * Met à jour un repas dans un événement
   */
  async updateMeal(
    eventId: string,
    mealIndex: number,
    meal: EventMeal,
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const meals = [...event.meals];
      if (mealIndex < 0 || mealIndex >= meals.length)
        throw new Error("Index invalide");

      meals[mealIndex] = meal;
      return await this.updateEvent(eventId, { meals });
    } catch (err) {
      console.error(`[EventsStore] Erreur maj meal:`, err);
      throw err;
    }
  }

  /**
   * Supprime un repas d'un événement
   */
  async deleteMeal(eventId: string, mealIndex: number): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const meals = [...event.meals];
      if (mealIndex < 0 || mealIndex >= meals.length)
        throw new Error("Index invalide");

      meals.splice(mealIndex, 1);
      return await this.updateEvent(eventId, { meals });
    } catch (err) {
      console.error(`[EventsStore] Erreur suppression meal:`, err);
      throw err;
    }
  }

  /**
   * Ajoute une recette à un événement sans date (meal avec date: "")
   * Utilisé depuis RecipeDetailPage pour "mettre de côté" une recette
   */
  async addRecipeToEvent(
    eventId: string,
    recipeUuid: string,
    typeR: RecettesTypeR,
  ): Promise<EnrichedEvent> {
    const event = this.#enrichedMap.get(eventId);
    if (!event) throw new Error("Événement introuvable");

    const meals = [...event.meals];

    // Chercher un meal existant sans date
    let undatedMeal = meals.find((m) => m.date === "");

    if (undatedMeal) {
      // Vérifier si la recette y est déjà
      if (undatedMeal.recipes.some((r) => r.recipeUuid === recipeUuid)) {
        throw new Error("Recette déjà mise de côté pour cet événement");
      }
      // Ajouter la recette au meal existant
      undatedMeal = {
        ...undatedMeal,
        recipes: [
          ...undatedMeal.recipes,
          {
            recipeUuid,
            plates: 0,
            typeR,
            hasOwnPlatesNb: false,
          } satisfies EventMealRecipe,
        ],
      };
      // Remplacer dans le tableau
      const idx = meals.findIndex((m) => m.date === "");
      meals[idx] = undatedMeal;
    } else {
      // Créer un nouveau meal sans date
      const newMeal: EventMeal = {
        id: nanoid(6),
        date: "",
        guests: 0,
        recipes: [
          {
            recipeUuid,
            plates: 0,
            typeR,
            hasOwnPlatesNb: false,
          } satisfies EventMealRecipe,
        ],
      };
      meals.push(newMeal);
    }

    return await this.updateEvent(eventId, { meals });
  }

  // =============================================================================
  // PUBLIC API - TODOS
  // =============================================================================

  /**
   * Récupère les todos d'un événement
   */
  getTodos(eventId: string): EventTodo[] {
    const event = this.#enrichedMap.get(eventId);
    if (!event) return [];
    return event.todos;
  }

  /**
   * Ajoute un todo à un événement
   */
  async addTodo(eventId: string, todo: EventTodo): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = [...event.todos, todo];
      return await this.updateEvent(eventId, { todos });
    } catch (err) {
      console.error(`[EventsStore] Erreur ajout todo:`, err);
      throw err;
    }
  }

  /**
   * Ajoute plusieurs todos à un événement
   */
  async addTodos(eventId: string, todos: EventTodo[]): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const updatedTodos = [...event.todos, ...todos];
      return await this.updateEvent(eventId, { todos: updatedTodos });
    } catch (err) {
      console.error(`[EventsStore] Erreur ajout todos:`, err);
      throw err;
    }
  }

  /**
   * Met à jour le statut d'un todo via Cloud Function (atomique)
   */
  async updateTodoStatus(
    eventId: string,
    todoId: string,
    status: EventTodoStatus,
  ): Promise<void> {
    try {
      const { functions, config } = await getAppwriteInstances();

      await functions.createExecution(
        config.functions.enkaData,
        JSON.stringify({
          action: "update_todo_status",
          data: { eventId, todoId, status },
        }),
        false,
        "/",
        ExecutionMethod.POST,
      );
    } catch (err) {
      console.error(`[EventsStore] Erreur updateTodoStatus:`, err);
      throw err;
    }
  }

  /**
   * Toggle l'assignation via Cloud Function (atomique)
   */
  async toggleTodoAssignment(eventId: string, todoId: string): Promise<void> {
    try {
      const userId = globalState.userId;
      if (!userId) throw new Error("Utilisateur non connecté");

      const { functions, config } = await getAppwriteInstances();

      await functions.createExecution(
        config.functions.enkaData,
        JSON.stringify({
          action: "toggle_todo_assignment",
          data: { eventId, todoId },
        }),
        false,
        "/",
        ExecutionMethod.POST,
      );
    } catch (err) {
      console.error(`[EventsStore] Erreur toggleTodoAssignment:`, err);
      throw err;
    }
  }

  /**
   * Met à jour un todo dans un événement (par id)
   */
  async updateTodo(
    eventId: string,
    todoId: string,
    updates: Partial<EventTodo>,
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = event.todos.map((t) =>
        t.id === todoId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t,
      );
      return await this.updateEvent(eventId, { todos });
    } catch (err) {
      console.error(`[EventsStore] Erreur maj todo:`, err);
      throw err;
    }
  }

  /**
   * Supprime un todo d'un événement (par id)
   */
  async deleteTodo(eventId: string, todoId: string): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = event.todos.filter((t) => t.id !== todoId);
      return await this.updateEvent(eventId, { todos });
    } catch (err) {
      console.error(`[EventsStore] Erreur suppression todo:`, err);
      throw err;
    }
  }

  // =============================================================================
  // POSTER CONFIGS (stockés dans db.recipeData, clé poster:${eventId})
  // =============================================================================

  /**
   * Charge la configuration d'affiche depuis Dexie
   */
  async loadPosterConfig(eventId: string): Promise<any | null> {
    const row = await db.recipeData.get(`poster:${eventId}`);
    return (row?.data as any) ?? null;
  }

  /**
   * Sauvegarde la configuration courante (Working Copy)
   * Met à jour le champ `current` du conteneur.
   */
  async savePosterConfig(eventId: string, config: any): Promise<void> {
    const existing = await this.loadPosterConfig(eventId);
    const container = existing || { versions: [] };

    container.current = config;

    await db.recipeData.put({
      key: `poster:${eventId}`,
      data: container,
    });
  }

  /**
   * Crée une nouvelle version archivée à partir de la config donnée
   * @throws Error si quota atteint (3 versions)
   */
  async createPosterVersion(
    eventId: string,
    config: any,
    name: string,
  ): Promise<any | undefined> {
    const existing = await this.loadPosterConfig(eventId);
    const container = existing || { current: config, versions: [] };

    if (!container.versions) container.versions = [];

    // Vérifier la limite
    if (container.versions.length >= 3) {
      throw new Error("Limite de 3 versions atteinte");
    }

    // Créer la version
    const newVersion = {
      id: crypto.randomUUID(),
      name,
      config: JSON.parse(JSON.stringify(config)), // Deep copy
      createdAt: new Date().toISOString(),
    };

    container.versions.push(newVersion);
    container.current = config;

    await db.recipeData.put({
      key: `poster:${eventId}`,
      data: container,
    });

    return newVersion;
  }

  /**
   * Supprime une version archivée
   */
  async deletePosterVersion(eventId: string, versionId: string): Promise<void> {
    const container = await this.loadPosterConfig(eventId);
    if (!container || !container.versions) return;

    container.versions = container.versions.filter(
      (v: any) => v.id !== versionId,
    );

    await db.recipeData.put({
      key: `poster:${eventId}`,
      data: container,
    });
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  /**
   * Charge TOUS les événements (y compris les anciens).
   * Avec aw-sync delta sync, tous les événements sont déjà disponibles.
   * Méthode conservée pour compatibilité (no-op).
   */
  async loadAllPastEvents(): Promise<void> {
    console.log(
      `[EventsStore] loadAllPastEvents: ${this.#rawEvents.size} événements déjà disponibles via aw-sync`,
    );
  }

  /**
   * Calcule le scaleFactor pour une recette dans un repas
   * scaleFactor = plates / basePlates
   */
  calculateScaleFactor(recipePlates: number, recipeBasePlates: number): number {
    return recipePlates / recipeBasePlates;
  }

  /**
   * Force le rechargement des événements
   */
  async reload(): Promise<void> {
    console.log("[EventsStore] Rechargement...");
    this.#loading = true;
    this.#error = null;

    try {
      // Reset sync metadata pour forcer un full re-fetch
      const collectionId = getCollectionId("events");
      await db.syncMeta.delete(collectionId);
      await this.#collection.initialFetch();

      console.log("[EventsStore] Rechargement complété");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du rechargement";
      this.#error = message;
      console.error("[EventsStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Hard reset : Vide TOUT (Dexie + sync meta) et recharge depuis Appwrite
   */
  async hardReset(): Promise<void> {
    console.log("[EventsStore] 🔄 HARD RESET - Vidage complet...");
    this.#loading = true;
    this.#error = null;

    try {
      await this.#collection.clearLocal();
      await this.#collection.initialFetch();

      console.log("[EventsStore] ✓ HARD RESET terminé");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du hard reset";
      this.#error = message;
      console.error("[EventsStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Nettoie les ressources et vide le cache local IndexedDB.
   * Async car clearLocal() doit être attendu pour éviter les fuites
   * de données entre utilisateurs sur un même navigateur.
   */
  async destroy(): Promise<void> {
    this.#bridge.subscription.unsubscribe();
    this.#collection.unsubscribeAll();
    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await this.#collection.clearLocal();
    this.#rawEvents.clear();
    this.#isInitialized = false;
    this.#realtimeInitialized = false;
    console.log("[EventsStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const eventsStore = new EventsStore();

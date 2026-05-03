/**
 * EventsStore - Store de gestion des événements avec Svelte 5 + pb-sync
 *
 * Architecture:
 * - pb-sync: Dexie (db.events) + delta sync + SSE realtime + optimistic writes
 * - bridgeToMap: liveQuery → SvelteMap<Main> (raw PB data)
 * - $derived: EnrichedEvent with parsed meals/contributors/todos
 * - Business logic: CRUD, invitations, meals, todos, poster configs
 *
 * Flux de données:
 * Lecture :  Dexie → liveQuery → SvelteMap<Main> → $derived → EnrichedEvent → UI
 * Écriture : UI → Store → #collection.update() → Dexie (optimiste) → PocketBase → confirmé
 * Realtime : PB SSE → pb-sync → Dexie.put() → liveQuery → SvelteMap → $derived → UI
 *
 * @usage
 * await eventsStore.initialize();
 * const event = eventsStore.getEventById('event-id');
 * const myEvents = eventsStore.events;
 */

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
import { globalState } from "./GlobalState.svelte";
import {
  parseEventMeals,
  parseEventContributors,
  parseEventTodos,
} from "$lib/utils/events.utils";
import {
  createSyncCollection,
  bridgeToMap,
  db,
  pb,
  type BridgeResult,
} from "$lib/db-sync/pb-sync";

// =============================================================================
// STORE CLASS
// =============================================================================

export class EventsStore {
  // pb-sync collection for events (PocketBase 'events' table)
  #collection = createSyncCollection<Main>(pb, db.events, "events");

  // Bridge: liveQuery on db.events → SvelteMap of raw PB data
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
   * Les champs meals/contributors/todos sont parsés en objets typés.
   * Compatible Appwrite (JSON strings) et PocketBase (objets natifs).
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
   * Phase 2 : Delta sync depuis PocketBase
   */
  async syncFromRemote(): Promise<void> {
    console.log("[EventsStore] Synchronisation depuis PocketBase...");
    this.#loading = true;

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
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Force un re-sync complet depuis PocketBase (safe, n'exception pas).
   * Utilise par GlobalState quand un message realtime custom est recu
   * (ex: ajout a une team → nouveaux evenements visibles).
   */
  async forceRefresh(): Promise<void> {
    try {
      await this.syncFromRemote();
    } catch (err) {
      console.error("[EventsStore] forceRefresh() failed:", err);
    }
  }

  /**
   * Phase 3 : Activer le realtime PocketBase via pb-sync (SSE)
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
        await this.syncFromRemote();
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
   * Récupère un événement depuis PocketBase (force refresh)
   */
  async fetchEvent(eventId: string): Promise<EnrichedEvent | null> {
    try {
      const event = await this.#collection.view(eventId);
      return this.#enrichEvent(event);
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
   * Prépare les données de mise à jour pour PocketBase.
   * PocketBase gère le JSON nativement — pas de stringify nécessaire.
   * meals/contributors/todos sont envoyés en objets natifs.
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

    // PocketBase gère le JSON nativement — pas de stringify
    if (data.meals !== undefined) {
      serialized.meals = data.meals;
    }
    if (data.contributors !== undefined) {
      serialized.contributors = data.contributors;
    }
    if (data.guestEmails !== undefined) {
      serialized.guestEmails = data.guestEmails;
    }
    if (data.todos !== undefined) {
      serialized.todos = data.todos;
    }

    return serialized;
  }

  /**
   * Met à jour un événement via pb-sync avec écriture optimiste.
   */
  async #updateEventData(
    eventId: string,
    data: UpdateEventData,
  ): Promise<Main> {
    const serialized = this.#serializeUpdateData(data);
    return await this.#collection.update(eventId, serialized as Partial<Main>);
  }

  /**
   * Crée un nouvel événement avec des teams.
   * Avec PocketBase, la création est directe (pas de CF atomique).
   * Le système d'invitation PB (étape 1.3) gère les emails.
   */
  async createEventWithTeams(
    data: CreateEventData,
    teamIds: string[] = [],
  ): Promise<EnrichedEvent> {
    if (!globalState.userId) throw new Error("Utilisateur non connecté");

    const record = await this.#collection.create({
      name: data.name,
      description: data.description || "",
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      allDates: data.allDates,
      meals: data.meals ?? [],
      createdBy: globalState.userId,
      teams: data.teams ?? [],
      teamsId: teamIds,
      contributors: data.contributors ?? [],
      todos: data.todos ?? [],
      status: data.status || "proposition",
    } as unknown as Omit<Main, 'id' | 'created' | 'updated'>);

    console.log(
      `[EventsStore] Événement créé avec ${teamIds.length} team(s): ${record.id}`,
    );

    return this.#enrichEvent(record);
  }

  /**
   * Met à jour un événement (écriture optimiste via pb-sync)
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
   * Supprime un événement (direct PB, pas de cleanup de label nécessaire)
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.#collection.remove(eventId);
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
   * Supprime un contributeur d'un événement (mise à jour directe).
   * Avec PocketBase, pas de Label à nettoyer — on modifie directement le record.
   */
  async removeContributor(
    eventId: string,
    contributorId: string,
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

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
   * Invite des participants à un événement.
   * STUB — le système d'invitation PocketBase sera implémenté à l'étape 1.3.
   * En attendant, les contributeurs sont ajoutés directement au record.
   */
  /**
   * Invite des participants à un événement.
   *
   * Flux PocketBase :
   *   1. Ajoute les emails dans guestEmails[] et contributors[] (atomique)
   *   2. Ajoute les teamIds dans les relations teams + teamsId
   *   3. Crée/récupère un share link pour l'event
   *   4. Appelle le hook email en fire-and-forget
   *
   * @param eventId - ID de l'événement
   * @param options.emails - Emails à inviter (individuels + membres des teams, pré-calculé par l'appelant)
   * @param options.teamIds - IDs des équipes à ajouter aux relations
   */
  async inviteParticipants(
    eventId: string,
    options: {
      teamIds?: string[];
      emails?: string[];
    },
  ): Promise<EnrichedEvent> {
    const event = this.#enrichedMap.get(eventId);
    if (!event) throw new Error("Événement introuvable");

    const { emails = [], teamIds = [] } = options;

    if (emails.length === 0 && teamIds.length === 0) {
      return event;
    }

    // --- 1. Construire les nouveaux contributeurs (dédupliqués) ---
    const existingEmails = new Set(
      event.contributors
        .filter((c) => c.email)
        .map((c) => c.email!.toLowerCase()),
    );
    const existingIds = new Set(
      event.contributors.filter((c) => c.id).map((c) => c.id),
    );

    const newContributors = [...event.contributors];
    for (const email of emails) {
      if (!existingEmails.has(email.toLowerCase())) {
        newContributors.push({
          id: nanoid(), // ID temporaire pour l'affichage
          email,
          status: "invited" as const,
          invitedAt: new Date().toISOString(),
        });
        existingEmails.add(email.toLowerCase());
      }
    }

    // --- 2. Construire les nouveaux guestEmails (dédupliqués) ---
    const currentGuests: string[] = Array.isArray(
      (event as Record<string, unknown>).guestEmails,
    )
      ? ((event as Record<string, unknown>).guestEmails as string[])
      : [];

    const guestSet = new Set(
      currentGuests.map((e: string) => e.toLowerCase()),
    );
    for (const email of emails) {
      guestSet.add(email.toLowerCase());
    }
    const updatedGuests = [...currentGuests];
    for (const email of emails) {
      if (!currentGuests.some((g: string) => g.toLowerCase() === email.toLowerCase())) {
        updatedGuests.push(email);
      }
    }

    // --- 3. Construire les nouvelles teams (dédupliquées) ---
    const currentTeams: string[] = event.teams || [];
    const currentTeamsId: string[] = event.teamsId || [];
    const updatedTeams = [...currentTeams];
    const updatedTeamsId = [...currentTeamsId];

    for (const teamId of teamIds) {
      if (!updatedTeamsId.includes(teamId)) {
        updatedTeamsId.push(teamId);
      }
      // Ajouter aussi le nom de la team dans teams[] si pas déjà présent
      const teamName = currentTeams.find((t) => t === teamId);
      if (!teamName && !updatedTeams.includes(teamId)) {
        updatedTeams.push(teamId);
      }
    }

    // --- 4. Mise à jour atomique de l'event ---
    const updatedEvent = await this.updateEvent(eventId, {
      contributors: newContributors,
      guestEmails: updatedGuests,
      teams: updatedTeams,
      teamsId: updatedTeamsId,
    } as UpdateEventData);

    // --- 5. Créer ou récupérer un share link pour l'event ---
    let shareLinkId: string | null = null;
    try {
      const { getEventShareLinks, createShareLink } = await import(
        "$lib/services/pb-invitations"
      );
      const userId = globalState.userId || event.createdBy;
      const existingLinks = await getEventShareLinks(eventId);
      if (existingLinks.length > 0) {
        shareLinkId = existingLinks[0];
      } else {
        const link = await createShareLink(eventId, userId);
        shareLinkId = link.id;
      }
    } catch (err) {
      console.warn("[EventsStore] Impossible de créer le share link:", err);
    }

    // --- 6. Envoyer les emails (fire-and-forget) ---
    if (shareLinkId && emails.length > 0) {
      pb
        .send("/api/enka/send-emails", {
          method: "POST",
          body: {
            template: "invitation_to_event",
            recipients: emails.map((email) => ({
              email,
              shareLinkId,
            })),
            eventName: event.name,
            eventDescription: event.description || "",
            dateStart: event.dateStart || "",
            dateEnd: event.dateEnd || "",
          },
        })
        .then((result) => {
          const okCount = result.results?.filter((r: { ok: boolean }) => r.ok).length || 0;
          const failCount = emails.length - okCount;
          if (failCount > 0) {
            console.warn(
              `[EventsStore] Emails envoyés : ${okCount}/${emails.length} (${failCount} échec(s))`,
            );
          } else {
            console.log(
              `[EventsStore] Emails envoyés : ${okCount}/${emails.length}`,
            );
          }
        })
        .catch((err) => {
          console.error("[EventsStore] Erreur d'envoi des emails:", err);
        });

      console.log(
        `[EventsStore] Invitation: ${emails.length} email(s), ${teamIds.length} team(s) → event ${eventId}`,
      );
    }

    return updatedEvent;
  }

  /**
   * Retire une team d'un événement (mise à jour directe).
   * Avec PocketBase, pas de Label à nettoyer — on modifie directement le record.
   */
  async removeTeam(eventId: string, teamId: string): Promise<EnrichedEvent> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const teams = (event.teams ?? []).filter((t) => t !== teamId);
      const teamsId = (event.teamsId ?? []).filter((t) => t !== teamId);

      return await this.updateEvent(eventId, {
        teams,
        teamsId,
      } as UpdateEventData);
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
   * Met à jour le statut d'un todo via mise à jour directe du record.
   * Avec PocketBase, plus de Cloud Function nécessaire — update atomique sur le champ todos.
   */
  async updateTodoStatus(
    eventId: string,
    todoId: string,
    status: EventTodoStatus,
  ): Promise<void> {
    try {
      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = event.todos.map((t) =>
        t.id === todoId ? { ...t, status } : t,
      );

      await this.#collection.update(eventId, { todos } as Partial<Main>);
    } catch (err) {
      console.error(`[EventsStore] Erreur updateTodoStatus:`, err);
      throw err;
    }
  }

  /**
   * Toggle l'assignation d'un todo via mise à jour directe du record.
   * Avec PocketBase, plus de Cloud Function nécessaire.
   */
  async toggleTodoAssignment(eventId: string, todoId: string): Promise<void> {
    try {
      const userId = globalState.userId;
      if (!userId) throw new Error("Utilisateur non connecté");

      const event = this.#enrichedMap.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = event.todos.map((t) => {
        if (t.id !== todoId) return t;

        const assignedTo = t.assignedTo ?? [];
        const isAssigned = assignedTo.includes(userId);

        return {
          ...t,
          assignedTo: isAssigned
            ? assignedTo.filter((id) => id !== userId)
            : [...assignedTo, userId],
        };
      });

      await this.#collection.update(eventId, { todos } as Partial<Main>);
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
   * Avec pb-sync delta sync, tous les événements sont déjà disponibles.
   * Méthode conservée pour compatibilité (no-op).
   */
  async loadAllPastEvents(): Promise<void> {
    console.log(
      `[EventsStore] loadAllPastEvents: ${this.#rawEvents.size} événements déjà disponibles via pb-sync`,
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
   * Force le rechargement des événements depuis PocketBase
   */
  async reload(): Promise<void> {
    console.log("[EventsStore] Rechargement...");
    this.#loading = true;
    this.#error = null;

    try {
      await this.#collection.clearLocal();
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
   * Hard reset : Vide TOUT (Dexie) et recharge depuis PocketBase
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

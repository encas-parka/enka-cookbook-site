/**
 * EventsStore - Store de gestion des événements avec Svelte 5
 *
 * Architecture:
 * - Chargement des événements depuis Appwrite
 * - Filtrage strict : accès conditionné à l'appartenance (teams/contributors)
 * - CRUD complet via Appwrite
 * - Realtime pour les événements accessibles
 * - Helpers pour la gestion des meals
 *
 * @usage
 * await eventsStore.initialize();
 * const event = await eventsStore.getEvent('event-id');
 * const myEvents = eventsStore.events;
 */

import { SvelteMap } from "svelte/reactivity";
import { ExecutionMethod } from "appwrite";
import type { Main, MainStatus } from "../types/appwrite.d";
import type { UserNotifications } from "$lib/types/appwrite.d";
import { deepSerialize } from "$lib/utils/serialization.utils";
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
} from "../types/events.d";
import type { RecettesTypeR } from "$lib/types/recipes.types";
import { nanoid } from "nanoid";
import {
  listEvents,
  getEvent as getAppwriteEvent,
  createEvent as createAppwriteEvent,
  createEventWithTeams as createAppwriteEventWithTeams,
  updateEvent as updateAppwriteEvent,
  deleteEvent as deleteAppwriteEvent,
  EVENTS_COLLECTION_ID,
} from "../services/appwrite-events";
import { globalState } from "./GlobalState.svelte";
import {
  parseEventMeals,
  parseEventContributors,
  parseEventTodos,
} from "../utils/events.utils";
import {
  createEventsIDBCache,
  type EventsIDBCache,
} from "../services/events-idb-cache";
import { getAppwriteInstances, getDatabaseId } from "$lib/services/appwrite";
import { realtimeManager } from "./RealtimeManager.svelte";
import { toastService } from "$lib/services/toast.service.svelte";

// =============================================================================
// STORE SINGLETON
// =============================================================================

export class EventsStore {
  // État réactif - Événements
  #events = new SvelteMap<string, EnrichedEvent>();

  // État UI
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);

  // Cache IndexedDB
  #cache: EventsIDBCache | null = null;

  // Appwrite
  #userId: string | null = null;
  #userTeams: string[] = [];
  #currentEventId: string | null = null;

  // Getters publics
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
   * Liste réactive des événements accessibles
   */
  get events() {
    return Array.from(this.#events.values());
  }

  /**
   * Nombre d'événements
   */
  get count() {
    return this.#events.size;
  }

  // =============================================================================
  // DERIVED STATES
  // =============================================================================

  /**
   * Événements en cours (maintenant)
   * Filtrés par date ET par accessibilité (contributorsIds)
   */
  #currentEvents = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de la journée actuelle

    return Array.from(this.#events.values())
      .filter((event) => {
        if (!event.dateStart || !event.dateEnd) return false;
        const end = new Date(event.dateEnd);
        // Filtrer uniquement par date (accessibilité gérée par Appwrite via permissions)
        return end >= today;
      })
      .sort((a, b) => {
        // Tri par date de début croissante (prochaines événements d'abord)
        const dateA = new Date(a.dateStart!);
        const dateB = new Date(b.dateStart!);
        return dateA.getTime() - dateB.getTime();
      });
  });

  /**
   * Événements passés
   * Filtrés par date (accessibilité gérée par Appwrite via permissions). Ne sont récupérés que les événement des 15 derniers jours max (TOCHECK)
   */
  #pastEvents = $derived.by(() => {
    const now = new Date();
    return Array.from(this.#events.values())
      .filter((event) => {
        if (!event.dateStart || !event.dateEnd) return false;
        const end = new Date(event.dateEnd);
        // Filtrer uniquement par date (accessibilité gérée par Appwrite via permissions)
        return end < now;
      })
      .sort((a, b) => {
        // Tri par date de début décroissante (plus récents d'abord)
        const dateA = new Date(a.dateStart!);
        const dateB = new Date(b.dateStart!);
        return dateB.getTime() - dateA.getTime();
      });
  });

  /**
   * Getters publics pour les derived states
   */
  get currentEvents() {
    return this.#currentEvents;
  }

  get pastEvents() {
    return this.#pastEvents;
  }

  /**
   * Nombre d'événements passés
   */
  get pastEventsCount() {
    return this.#pastEvents.length;
  }

  /**
   * Événements à venir où l'utilisateur est participant accepté
   * Exclut les événements annulés et archivés
   */
  getUpcomingEventsForUser(): EnrichedEvent[] {
    // Toujours lire #currentEvents pour maintenir la dépendance réactive
    // (sinon le early return casse la chaîne de réactivité si le store
    // n'est pas encore initialisé au premier appel)
    const events = this.#currentEvents;
    if (!this.#userId) return [];

    return events.filter((event) => {
      // Exclure les événements annulés ou archivés
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
  // INITIALISATION PHASÉE (OPTIMISATION)
  // =============================================================================

  /**
   * Phase 1 : Charger uniquement depuis le cache IndexedDB
   * Appelé au démarrage pour afficher l'UI rapidement
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

      this.#userId = globalState.userId;
      this.#userTeams = globalState.userTeams;

      this.#cache = await createEventsIDBCache();

      const cachedEvents = await this.#cache.loadEvents();
      if (cachedEvents.size > 0) {
        console.log(
          `[EventsStore] ${cachedEvents.size} événements chargés depuis le cache`,
        );
        this.#events.clear();
        for (const [id, event] of cachedEvents) {
          this.#events.set(id, event);
        }
      }

      this.#isInitialized = true;
      console.log(
        `[EventsStore] Cache chargé: ${this.#events.size} événements`,
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
   * Phase 2 : Synchroniser avec Appwrite (appelé après loadCache)
   */
  async syncFromRemote(): Promise<void> {
    if (!this.#cache) {
      console.warn("[EventsStore] Impossible de sync : cache non initialisé");
      return;
    }

    console.log("[EventsStore] Synchronisation depuis Appwrite...");
    this.#loading = true;

    try {
      await this.#loadEvents();

      // Persister dans le cache (avec sérialisation automatique)
      await this.#saveAllToCache();
      await this.#cache.saveMetadata({
        lastSync: new Date().toISOString(),
      });

      console.log(
        `[EventsStore] Synchronisation terminée: ${this.#events.size} événements`,
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
   * Phase 3 : Setup du realtime (appelé après syncFromRemote)
   */
  async setupRealtime(): Promise<void> {
    if (!this.#cache) {
      console.warn(
        "[EventsStore] Impossible de setup realtime : cache non initialisé",
      );
      return;
    }

    // Vérifier si déjà configuré pour éviter les doublons
    // ✅ SAUF si le RealtimeManager a été détruit (changement auth)
    if (this.#realtimeInitialized && realtimeManager.isInitialized) {
      console.log("[EventsStore] Realtime déjà configuré");
      return;
    }

    // Réinitialiser le flag si le RealtimeManager a été détruit
    if (this.#realtimeInitialized && !realtimeManager.isInitialized) {
      console.log("[EventsStore] RealtimeManager détruit, réinitialisation...");
      this.#realtimeInitialized = false;
    }

    console.log("[EventsStore] Configuration du realtime...");
    await this.#setupRealtime();
    this.#realtimeInitialized = true;
  }

  // =============================================================================
  // INITIALISATION
  // =============================================================================

  /**
   * Initialise le store
   * 1. Ouvre le cache IndexedDB
   * 2. Charge les événements depuis le cache
   * 3. Charge les événements depuis Appwrite (mise à jour)
   * 4. Sauvegarde dans le cache
   * 5. Active le realtime
   */
  // Promise d'initialisation en cours pour déduplication
  #initPromise: Promise<void> | null = null;
  #realtimeInitialized = false;

  /**
   * Initialise le store (méthode legacy pour compatibilité)
   * Combine les 3 phases : loadCache → syncFromRemote → setupRealtime
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
        // Phase 1: Charger le cache
        await this.loadCache();

        // Phase 2: Sync depuis Appwrite
        await this.syncFromRemote();

        // Phase 3: Setup realtime
        await this.setupRealtime();

        console.log(
          `[EventsStore] Initialisation complétée: ${this.#events.size} événements`,
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

  /**
   * Charge les événements depuis Appwrite
   * Filtrage optimisé : seulement les événements récents (15 jours) ou futurs
   */
  async #loadEvents(minDate: string | null = null): Promise<void> {
    try {
      console.log("[EventsStore] Chargement des événements...");

      // Vérifier que l'utilisateur est initialisé
      if (!this.#userId) {
        console.warn(
          "[EventsStore] userId non défini, impossible de charger les événements",
        );
        return;
      }

      // Calculer la date limite (15 jours en arrière) pour les événements courants
      if (!minDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const fifteenDaysAgo = new Date(today);
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        minDate = fifteenDaysAgo.toISOString();
      }

      // Utiliser le filtrage optimisé avec minDate
      const { events } = await listEvents(this.#userId, minDate);

      // Ajouter à la map
      events.forEach((event) => {
        this.#events.set(event.$id, this.#enrichEvent(event));
      });

      console.log(
        `[EventsStore] ${events.length} événements chargés (filtrés pour userId: ${this.#userId}, date >= ${minDate})`,
      );
    } catch (err) {
      console.error("[EventsStore] Erreur lors du chargement:", err);
      throw err;
    }
  }

  /**
   * Transforme un événement brut en événement enrichi
   */
  #enrichEvent(event: Main): EnrichedEvent {
    return {
      ...event,
      status: event.status as EventStatus, // Cast nécessaire pour "local"
      teams: event.teams || undefined, // Convertir null en undefined
      teamsId: event.teamsId || undefined, // Convertir null en undefined
      meals: parseEventMeals(event.meals),
      contributors: parseEventContributors(event.contributors),
      todos: parseEventTodos(event.todos),
    };
  }

  /**
   * Sauvegarde un événement dans IndexedDB en retirant les Proxies Svelte
   * Utilitaire privé pour éviter la répétition dans toutes les méthodes locales
   */
  async #saveToCache(event: EnrichedEvent): Promise<void> {
    if (!this.#cache) return;

    // 🔥 Sérialiser pour retirer les Proxies Svelte avant IndexedDB
    const serialized = deepSerialize(event);
    await this.#cache.saveEvent(serialized);
  }

  /**
   * Sauvegarde tous les événements dans IndexedDB en retirant les Proxies Svelte
   * Utilitaire privé pour les sauvegardes en bloc (hardReset)
   */
  async #saveAllToCache(): Promise<void> {
    if (!this.#cache) return;

    // 🔥 Sérialiser tous les événements pour retirer les Proxies Svelte
    const serializedEvents = new Map<string, EnrichedEvent>();
    for (const [id, event] of this.#events) {
      serializedEvents.set(id, deepSerialize(event));
    }

    await this.#cache.saveEvents(serializedEvents);
  }

  /**
   * Configure le realtime pour les événements
   */
  async #setupRealtime(): Promise<void> {
    try {
      console.log("[EventsStore] Activation du Realtime...");
      const DB_ID = getDatabaseId();

      realtimeManager.register(
        [`databases.${DB_ID}.collections.${EVENTS_COLLECTION_ID}.documents`],
        async (response: any) => {
          const eventType = response.events.some((e: string) =>
            e.includes(".create"),
          )
            ? "create"
            : response.events.some((e: string) => e.includes(".delete"))
              ? "delete"
              : "update";

          const event = response.payload as Main;

          console.log(
            `[EventsStore] ⚡️ Realtime RECEIVED: ${eventType} pour ${event.$id}`,
            { name: event.name, updatedAt: event.$updatedAt },
          );

          // NOTE: L'accessibilité est gérée par Appwrite via les permissions (labels et teams)
          // Si nous recevons cet événement via realtime, c'est que nous y avons accès

          if (eventType === "create" || eventType === "update") {
            const enrichedEvent = this.#enrichEvent(event);
            this.#events.set(event.$id, enrichedEvent);

            // Persister dans le cache (avec sérialisation automatique)
            await this.#saveToCache(enrichedEvent);
          } else if (eventType === "delete") {
            this.#events.delete(event.$id);

            if (this.#cache) {
              await this.#cache.deleteEvent(event.$id);
            }
          }
        },
      );

      console.log("[EventsStore] Realtime enregistré auprès du manager");
    } catch (err) {
      console.error(
        "[EventsStore] Erreur lors de la configuration du realtime:",
        err,
      );
    }
  }

  // =============================================================================
  // API PUBLIQUE - LECTURE
  // =============================================================================

  /**
   * Récupère un événement par ID
   */
  getEventById(eventId: string): EnrichedEvent | null {
    return this.#events.get(eventId) || null;
  }

  /**
   * Récupère un événement depuis Appwrite (force refresh)
   */
  async fetchEvent(eventId: string): Promise<EnrichedEvent | null> {
    try {
      const event = await getAppwriteEvent(eventId);
      if (event) {
        const enriched = this.#enrichEvent(event);
        this.#events.set(eventId, enriched);
        return enriched;
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

    const event = this.#events.get(eventId);
    if (!event) return false;

    // Créateur
    if (event.createdBy === this.#userId) return true;

    // Membre d'une équipe autorisée
    if (event.teams?.some((teamId) => this.#userTeams.includes(teamId)))
      return true;

    // Contributeur accepté
    if (event.contributors) {
      // event.contributors est déjà un tableau d'objets EventContributor grâce à EnrichedEvent
      if (
        event.contributors.some(
          (c) => c.id === this.#userId && c.status === "accepted",
        )
      ) {
        return true;
      }
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
    const event = this.#events.get(eventId);
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
    if (event.contributors) {
      if (
        event.contributors.some(
          (c) => c.id === userId && c.status === "accepted",
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // =============================================================================
  // API PUBLIQUE - ÉCRITURE
  // =============================================================================

  /**
   * Crée un nouvel événement
   * @deprecated : on utilise la CF appelé par createEventWithTeam
   */
  async createEvent(data: CreateEventData): Promise<EnrichedEvent> {
    if (!globalState.userId) throw new Error("Utilisateur non connecté");

    const event = await createAppwriteEvent(data, globalState.userId);
    const enriched = this.#enrichEvent(event);
    this.#events.set(event.$id, enriched);

    // Persistance immédiate dans le cache (avec sérialisation automatique)
    await this.#saveToCache(enriched);

    console.log(`[EventsStore] Événement créé: ${event.$id}`);
    return enriched;
  }

  /**
   * Crée un nouvel événement avec des teams (action unifiée)
   * Cette méthode remplace l'approche en 2 étapes pour une meilleure performance
   *
   * @param data - Données de l'événement
   * @param teamIds - IDs des teams à inviter
   * @param sendEmailToExistingMembers - Envoyer un email aux membres des teams
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
    const enriched = this.#enrichEvent(event);
    this.#events.set(event.$id, enriched);

    // Persistance immédiate dans le cache (avec sérialisation automatique)
    await this.#saveToCache(enriched);

    console.log(
      `[EventsStore] Événement créé avec ${teamIds.length} team(s): ${event.$id}`,
    );
    return enriched;
  }

  /**
   * Met à jour un événement
   */
  async updateEvent(
    eventId: string,
    data: UpdateEventData,
  ): Promise<EnrichedEvent> {
    const event = await updateAppwriteEvent(eventId, data);
    const enriched = this.#enrichEvent(event);
    this.#events.set(eventId, enriched);

    // Persistance immédiate dans le cache (avec sérialisation automatique)
    await this.#saveToCache(enriched);

    console.log(`[EventsStore] Événement mis à jour: ${eventId}`);
    return enriched;
  }

  /**
   * Met à jour uniquement le statut d'un événement
   */
  async updateEventStatus(eventId: string, status: MainStatus): Promise<void> {
    try {
      // Utiliser le service appwrite-events pour la cohérence
      await updateAppwriteEvent(eventId, { status });

      // Mettre à jour le cache local
      const existingEvent = this.#events.get(eventId);
      if (existingEvent) {
        existingEvent.status = status;
      }

      console.log(`[EventsStore] Statut mis à jour: ${eventId} -> ${status}`);
    } catch (err) {
      console.error(`[EventsStore] Erreur mise à jour statut ${eventId}:`, err);
      throw err;
    }
  }

  /**
   * Supprime un événement
   */
  async deleteEvent(eventId: string): Promise<void> {
    await deleteAppwriteEvent(eventId);
    this.#events.delete(eventId);

    // Suppression immédiate du cache
    if (this.#cache) {
      await this.#cache.deleteEvent(eventId);
    }
    console.log(`[EventsStore] Événement supprimé: ${eventId}`);
  }

  // =============================================================================
  // API PUBLIQUE - CONTRIBUTORS
  // =============================================================================

  /**
   * Récupère les contributeurs d'un événement
   */
  getContributors(eventId: string): EventContributor[] {
    const event = this.#events.get(eventId);
    if (!event) return [];
    return event.contributors;
  }

  getContributorStatus(eventId: string) {
    const event = this.#events.get(eventId);
    if (!event) return "";
    const user = event.contributors.filter((c) => c.id === this.#userId);
    return user.length > 0 ? user[0].status : "";
  }
  /**
   * Ajoute des contributeurs à un événement via la cloud function
   * Envoie les invitations et met à jour les permissions côté serveur
   */
  // async addContributors(
  //   eventId: string,
  //   contributorData: {
  //     emails?: string[];
  //     userIds?: string[];
  //   },
  // ): Promise<EnrichedEvent> {
  //   try {
  //     const event = this.#events.get(eventId);
  //     if (!event) throw new Error("Événement introuvable");

  //     const { emails = [], userIds = [] } = contributorData;

  //     if (
  //       (!emails || emails.length === 0) &&
  //       (!userIds || userIds.length === 0)
  //     ) {
  //       console.log(`[EventsStore] Aucun contributeur à ajouter`);
  //       return event;
  //     }

  //     // Filtrer les emails déjà présents
  //     const existingEmails = new Set(
  //       event.contributors.map((c) => c.email).filter(Boolean),
  //     );
  //     const newEmails = emails.filter((email) => !existingEmails.has(email));

  //     // Filtrer les userIds déjà présents
  //     const existingUserIds = new Set(event.contributors.map((c) => c.id));
  //     const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

  //     if (newEmails.length === 0 && newUserIds.length === 0) {
  //       console.log(`[EventsStore] Tous les contributeurs sont déjà présents`);
  //       return event;
  //     }

  //     // Appeler la cloud function pour gérer l'invitation
  //     // Elle va :
  //     // 1. Créer les utilisateurs si nécessaire
  //     // 2. Ajouter les permissions
  //     // 3. Envoyer les emails (groupé pour existants, individuel pour nouveaux)
  //     const { inviteToEvent } = await import("../services/appwrite-functions");
  //     await inviteToEvent(eventId, event.name, newEmails, newUserIds);

  //     // Recharger l'événement depuis Appwrite pour avoir les données à jour
  //     // Attendre un court instant pour que le traitement côté serveur soit effectué
  //     await new Promise((resolve) => setTimeout(resolve, 500));

  //     const updatedEvent = await this.fetchEvent(eventId);
  //     if (!updatedEvent) throw new Error("Impossible de recharger l'événement");

  //     console.log(
  //       `[EventsStore] ${newEmails.length + newUserIds.length} contributeur(s) ajouté(s) à l'événement ${eventId}`,
  //     );

  //     return updatedEvent;
  //   } catch (err) {
  //     console.error(`[EventsStore] Erreur ajout contributeurs:`, err);
  //     throw err;
  //   }
  // }

  /**
   * Supprime un contributeur d'un événement
   */
  async removeContributor(
    eventId: string,
    contributorId: string,
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#events.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      // 🔥 Retirer le Label de l'utilisateur
      const { removeUserFromEvent } =
        await import("../services/appwrite-functions");
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

  // =============================================================================
  // API PUBLIQUE - TEAMS (Natives)
  // =============================================================================

  /**
   * Invite des teams et/ou des utilisateurs à un événement (méthode unifiée)
   *
   * @param eventId - ID de l'événement
   * @param options - Options d'invitation
   *   @param options.teamIds - IDs des teams à inviter
   *   @param options.emails - Emails des utilisateurs à inviter
   *   @param options.userIds - IDs des utilisateurs à inviter
   *   @param options.sendEmailToExistingMembers - Envoyer un email aux membres existants (défaut: true)
   * @returns L'événement mis à jour
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
      const event = this.#events.get(eventId);
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

      // Appeler la nouvelle fonction unifiée
      const { inviteParticipantsToEvent } =
        await import("../services/appwrite-functions");
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
   * @param eventId - ID de l'événement
   * @param teamId - ID de la team à retirer
   * @returns L'événement mis à jour
   */
  async removeTeam(eventId: string, teamId: string): Promise<EnrichedEvent> {
    try {
      const { removeTeamFromEvent } =
        await import("../services/appwrite-functions");
      await removeTeamFromEvent(eventId, teamId);

      // Recharger l'événement
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

  /**
   * Met à jour le statut d'un contributeur
   */
  async updateContributorStatus(
    eventId: string,
    contributorId: string,
    status: "accepted" | "declined",
  ): Promise<EnrichedEvent> {
    try {
      const event = this.#events.get(eventId);
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
  // API PUBLIQUE - MEALS
  // =============================================================================

  /**
   * Récupère les meals d'un événement
   */
  getMeals(eventId: string): EventMeal[] {
    const event = this.#events.get(eventId);
    if (!event) return [];
    return event.meals; // Déjà parsé !
  }

  /**
   * Ajoute un repas à un événement
   */
  async addMeal(eventId: string, meal: EventMeal): Promise<EnrichedEvent> {
    try {
      const event = this.#events.get(eventId);
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
      const event = this.#events.get(eventId);
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
      const event = this.#events.get(eventId);
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
    const event = this.#events.get(eventId);
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
  // API PUBLIQUE - TODOS
  // =============================================================================

  /**
   * Récupère les todos d'un événement
   */
  getTodos(eventId: string): EventTodo[] {
    const event = this.#events.get(eventId);
    if (!event) return [];
    return event.todos;
  }

  /**
   * Ajoute un todo à un événement
   */
  async addTodo(eventId: string, todo: EventTodo): Promise<EnrichedEvent> {
    try {
      const event = this.#events.get(eventId);
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
      const event = this.#events.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const updatedTodos = [...event.todos, ...todos];
      return await this.updateEvent(eventId, { todos: updatedTodos });
    } catch (err) {
      console.error(`[EventsStore] Erreur ajout todos:`, err);
      throw err;
    }
  }

  /**
   * Met à jour le statut d'un todo via Cloud Function (Atomique)
   */
  async updateTodoStatus(
    eventId: string,
    todoId: string,
    status: EventTodoStatus,
  ): Promise<void> {
    try {
      // Update optimiste local
      const event = this.#events.get(eventId);
      if (event) {
        event.todos = event.todos.map((t) =>
          t.id === todoId
            ? { ...t, status, updatedAt: new Date().toISOString() }
            : t,
        );
      }

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
      // Revert serait idéal ici, mais pour l'instant on laisse le realtime corriger si échec
      throw err;
    }
  }

  /**
   * Toggle l'assignation via Cloud Function (Atomique)
   */
  async toggleTodoAssignment(eventId: string, todoId: string): Promise<void> {
    try {
      const userId = globalState.userId;
      if (!userId) throw new Error("Utilisateur non connecté");

      // Update optimiste local
      const event = this.#events.get(eventId);
      if (event) {
        const todo = event.todos.find((t) => t.id === todoId);
        if (todo) {
          let currentAssigned: string[] = [];
          // Handle both string[] and string case for robustness (though types say string[] | null)
          if (Array.isArray(todo.assignedTo)) {
            currentAssigned = [...todo.assignedTo];
          } else if (todo.assignedTo) {
            currentAssigned = [todo.assignedTo as string];
          }

          if (currentAssigned.includes(userId)) {
            currentAssigned = currentAssigned.filter((id) => id !== userId);
          } else {
            currentAssigned.push(userId);
          }

          // Update event todos
          event.todos = event.todos.map((t) =>
            t.id === todoId
              ? {
                  ...t,
                  assignedTo:
                    currentAssigned.length > 0 ? currentAssigned : null,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          );
        }
      }

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
      const event = this.#events.get(eventId);
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
      const event = this.#events.get(eventId);
      if (!event) throw new Error("Événement introuvable");

      const todos = event.todos.filter((t) => t.id !== todoId);
      return await this.updateEvent(eventId, { todos });
    } catch (err) {
      console.error(`[EventsStore] Erreur suppression todo:`, err);
      throw err;
    }
  }

  // =============================================================================
  // CALCULS UTILITAIRES
  // =============================================================================

  /**
   * Charge TOUS les événements (y compris les anciens) depuis Appwrite
   * Utilisé pour la page /eventList
   * Cette méthode ajoute les événements à la map existante (sans vider)
   */
  async loadAllPastEvents(): Promise<void> {
    try {
      console.log("[EventsStore] Chargement de TOUS les événements...");

      if (!this.#userId) {
        console.warn("[EventsStore] userId non défini");
        return;
      }

      this.#loading = true;

      // Ne pas filtrer par date
      const { events } = await listEvents(this.#userId, null);

      // Ajouter à la map (sans vider les événements existants)
      events.forEach((event) => {
        this.#events.set(event.$id, this.#enrichEvent(event));
      });

      console.log(
        `[EventsStore] ${events.length} événements chargés (sans filtre de date, total: ${this.#events.size})`,
      );
    } catch (err) {
      console.error("[EventsStore] Erreur lors du chargement:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Calcule le scaleFactor pour une recette dans un repas
   * scaleFactor = plates / basePlates
   */
  calculateScaleFactor(recipePlates: number, recipeBasePlates: number): number {
    return recipePlates / recipeBasePlates;
  }

  // =============================================================================
  // POSTER CONFIGS
  // =============================================================================

  /**
   * Charge la configuration d'affiche depuis le cache local (retourne le conteneur complet)
   */
  async loadPosterConfig(eventId: string): Promise<any | null> {
    if (!this.#cache) return null;
    return await this.#cache.loadPosterConfig(eventId);
  }

  /**
   * Sauvegarde la configuration courante (Working Copy)
   * Met à jour le champ `current` du conteneur.
   */
  async savePosterConfig(eventId: string, config: any): Promise<void> {
    if (!this.#cache) return;

    // Charger l'existant ou créer un nouveau conteneur
    const existing = await this.#cache.loadPosterConfig(eventId);
    const container = existing || { versions: [] };

    // Mettre à jour current
    container.current = config;

    await this.#cache.savePosterConfig(eventId, container);
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
    if (!this.#cache) return;

    const existing = await this.#cache.loadPosterConfig(eventId);
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
      config: JSON.parse(JSON.stringify(config)), // Deep copy par sécurité
      createdAt: new Date().toISOString(),
    };

    container.versions.push(newVersion);

    // Mettre à jour current pour refléter la nouvelle version
    container.current = config;

    await this.#cache.savePosterConfig(eventId, container);

    return newVersion;
  }

  /**
   * Supprime une version archivée
   */
  async deletePosterVersion(eventId: string, versionId: string): Promise<void> {
    if (!this.#cache) return;

    const container = await this.#cache.loadPosterConfig(eventId);
    if (!container || !container.versions) return;

    container.versions = container.versions.filter(
      (v: any) => v.id !== versionId,
    );

    await this.#cache.savePosterConfig(eventId, container);
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  /**
   * Force le rechargement des événements
   */
  async reload(): Promise<void> {
    console.log("[EventsStore] Rechargement...");
    this.#loading = true;
    this.#error = null;

    try {
      this.#events.clear();
      await this.#loadEvents();
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
   * Hard reset : Vide TOUT (état Svelte + cache IDB) et recharge depuis Appwrite
   * Utilisé en mode dev pour repartir de zéro
   */
  async hardReset(): Promise<void> {
    console.log("[EventsStore] 🔄 HARD RESET - Vidage complet...");
    this.#loading = true;
    this.#error = null;

    try {
      // 1. Vider l'état Svelte
      this.#events.clear();

      // 2. Vider le cache IndexedDB
      if (this.#cache) {
        await this.#cache.clear();
        console.log("[EventsStore] Cache IDB vidé");
      }

      // 3. Recharger depuis Appwrite
      await this.#loadEvents();

      // 4. Recréer le cache avec les données fraîches
      if (this.#cache) {
        // Persister dans le cache (avec sérialisation automatique)
        await this.#saveAllToCache();
        await this.#cache.saveMetadata({
          lastSync: new Date().toISOString(),
        });
        console.log("[EventsStore] Cache IDB recréé");
      }

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
   * Nettoie les ressources
   */
  destroy(): void {
    // Fermer le cache
    if (this.#cache) {
      this.#cache.close();
      this.#cache = null;
    }

    this.#events.clear();
    this.#isInitialized = false;
    this.#realtimeInitialized = false; // Reset pour permettre une réinitialisation
    console.log("[EventsStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const eventsStore = new EventsStore();

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

import type { Main, MainStatus } from "$lib/types/pb";
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
import { lookupUsersByEmails } from "$lib/services/pb-users";
import { getOrCreateShareLink } from "$lib/services/pb-invitations";
import { toastService } from "$lib/services/toast.service.svelte";
import { globalState } from "./GlobalState.svelte";
import {
  parseEventMeals,
  parseEventContributors,
  parseEventTodos,
  getEventDates,
} from "$lib/utils/events.utils";
import {
  createSyncCollection,
  bridgeToMap,
  db,
  pb,
  pbDate,
  type BridgeResult,
  type PbFetchOptions,
} from "$lib/db-sync/pb-sync";
import { EVENTS_EPOCH_FLOOR_DAYS } from "$lib/constants/sync";

// =============================================================================
// STORE CLASS
// =============================================================================

export class EventsStore {
  // pb-sync collection for events (PocketBase 'events' table)
  #collection = createSyncCollection<Main>(pb, db.events, "events", {
    sessionCursor: true,
  });

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

  // Dedup des matérialisations ciblées : un guard et une page qui demandent
  // le même event en même temps partagent un seul fetch.
  #ensurePromises = new Map<string, Promise<EnrichedEvent | null>>();

  // Garde revalidation : une seule delta sync en vol (les appels concurrents
  // skipent silencieusement — l'orchestrateur de resync peut déclencher
  // plusieurs sources la même seconde). Réinitialisé par le finally.
  #revalidating = false;

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
      // (la relation teams porte des ids PocketBase)
      if (event.teams?.some((teamId) => this.#userTeams.includes(teamId)))
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
   * Phase 2 : sync de session (ADR 0001 « curseurs de session ») — le fetch
   * repart de l'époque (curseur ignoré par la collection en session) : tout
   * ce qui a été manqué pendant l'absence (mutations ET élargissements de
   * grant : join d'équipe hors ligne, invitation) est rattrapé ici, une fois
   * par session. Toggle `this.#loading` autour de la revalidation.
   */
  async syncInitial(): Promise<void> {
    return this.#runWithLoading(() => this.syncRevalidate(true));
  }

  /**
   * Revalidation silencieuse (delta sync, sans toggle loading — pas de flash
   * UI skeleton). Skip silencieux si déjà en cours. Rethrow pour laisser
   * l'appelant (orchestrateur de resync) décider du signalement.
   * Un changement d'utilisateur en vol (logout) discard le résultat.
   * `forceFull` asserte un début de session : full inconditionnel (le filet
   * TTL des sessions longévives vit dans la collection).
   */
  async syncRevalidate(forceFull = false): Promise<void> {
    if (this.#revalidating) return;
    this.#revalidating = true;

    console.log("[EventsStore] Synchronisation depuis PocketBase...");

    try {
      const uid = globalState.userId;
      await this.#collection.revalidate(this.#sessionFetchOptions(), forceFull);
      // Logout en vol : ne pas livrer les données de l'utilisateur précédent
      // à la cache du suivant.
      if (globalState.userId !== uid) return;
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
      this.#revalidating = false;
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
   * Bornes du fetch complet de session : les events terminés depuis plus de
   * EVENTS_EPOCH_FLOOR_DAYS ne sont pas re-populés (l'historique s'accumule,
   * le présent compte). Les mutations des events hors fenêtre restent
   * rattrapées par le delta — l'epochFilter ne s'applique qu'au fetch
   * complet. `dateEnd = ''` inclut les events sans date (champ non requis au
   * schéma) : une borne ne doit jamais rendre un record invisible.
   */
  #sessionFetchOptions(): PbFetchOptions {
    const floor = pbDate(
      new Date(Date.now() - EVENTS_EPOCH_FLOOR_DAYS * 24 * 60 * 60 * 1000),
    );
    return {
      epochFilter: ["dateEnd >= {:floor} || dateEnd = ''", { floor }],
    };
  }

  /**
   * Force un re-sync complet depuis PocketBase (safe, n'exception pas).
   * Utilise par GlobalState quand un message realtime custom est recu
   * (ex: ajout a une team → nouveaux evenements visibles).
   */
  async forceRefresh(): Promise<void> {
    try {
      await this.syncRevalidate();
    } catch (err) {
      console.error("[EventsStore] forceRefresh() failed:", err);
    }
  }

  /**
   * Invalide le curseur delta des events puis resynchronise, SANS vider la
   * table locale (pas de fenêtre d'état vide). À appeler quand le périmètre
   * autorisé s'élargit SANS toucher aux records (join d'équipe :
   * `teams.members`) : leur `updated` antérieur au curseur est invisible au
   * delta comme au SSE.
   */
  async resetCursorAndSync(): Promise<void> {
    await this.#collection.resetCursor();
    await this.syncRevalidate();
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
   * Récupère un événement depuis PocketBase (force refresh, sans cache).
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
   * Garantit la disponibilité d'un événement précis avant le montage de sa
   * page : no-op si le cache local le porte, sinon `view` ciblé puis écriture
   * Dexie (le bridge liveQuery propage vers `#rawEvents`).
   *
   * `null` couvre trois cas que le store ne distingue pas — 404, droits
   * refusés, réseau indisponible — sans jeter : un guard ne doit jamais
   * bloquer la navigation sur une absence. L'attente est bornée par
   * `timeoutMs` ; au-delà la navigation continue et la phase réseau (ou la
   * réactivité de la page) rattrape.
   */
  async ensureEvent(
    eventId: string,
    timeoutMs = 2500,
  ): Promise<EnrichedEvent | null> {
    const cached = this.getEventById(eventId);
    if (cached) return cached;

    const inFlight = this.#ensurePromises.get(eventId);
    if (inFlight) return inFlight;

    const fetchPromise = (async () => {
      try {
        const record = await this.#collection.view(eventId);
        // Écriture locale : la source de vérité UI reste le bridge liveQuery,
        // pas le retour de `view` (sinon deux chemins de lecture).
        await db.events.put(record);
        return this.#enrichEvent(record);
      } catch (err) {
        console.warn(
          `[EventsStore] ensureEvent(${eventId}) indisponible:`,
          err,
        );
        return null;
      } finally {
        this.#ensurePromises.delete(eventId);
      }
    })();

    this.#ensurePromises.set(eventId, fetchPromise);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetchPromise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
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
   * Point de passage unique du droit d'édition d'un événement : le créateur,
   * ou un participant confirmé (entrée accepted au registre). Une équipe
   * invitée ouvre la visibilité et l'invitation — jamais l'édition.
   */
  canUserEditEvent(eventId: string, userId: string): boolean {
    const event = this.#enrichedMap.get(eventId);
    if (!event || !userId) return false;

    // Créateur
    if (event.createdBy === userId) return true;

    // Participant confirmé
    return (
      event.contributors?.some(
        (c) => c.id === userId && c.status === "accepted",
      ) ?? false
    );
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
    if (data.status !== undefined) serialized.status = data.status;
    if (data.teams !== undefined) serialized.teams = data.teams;
    if (data.description !== undefined)
      serialized.description = data.description;
    if (data.minContrib !== undefined) serialized.minContrib = data.minContrib;

    // PocketBase gère le JSON nativement — pas de stringify
    if (data.meals !== undefined) {
      serialized.meals = data.meals;
      // Le JSON `date` reflète toujours les dates uniques des repas
      serialized.date = getEventDates({ meals: data.meals });
    }
    if (data.contributors !== undefined) {
      serialized.contributors = data.contributors;
    }
    if (data.guestEmails !== undefined) {
      serialized.guestEmails = data.guestEmails;
    }
    if (data.guestUsers !== undefined) {
      serialized.guestUsers = data.guestUsers;
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
   * Fait naître le lien de partage d'un event — chaque event en porte un dès
   * sa création. Fire-and-forget : un échec (réseau, règles) n'annule pas la
   * création ; le lien se matérialisera au premier get-or-create (invitation,
   * section lien des éditeurs).
   */
  #ensureEventShareLink(eventId: string): void {
    const userId = globalState.userId;
    if (!userId) return;
    getOrCreateShareLink(eventId, userId).catch((err) => {
      console.warn(
        `[EventsStore] Lien de partage non créé pour ${eventId}:`,
        err,
      );
    });
  }

  /**
   * Crée un nouvel événement avec des teams.
   * Avec PocketBase, la création est directe (pas de CF atomique).
   * Le système d'invitation PB (étape 1.3) gère les emails.
   *
   * Idempotence réseau : `submissionKey` (id PB [a-z0-9]{15}) rend la
   * re-soumission après un échec ambigu (requête partie, réponse perdue)
   * sans duplication — le serveur rejette un id déjà pris (400
   * validation_not_unique, mesuré sonde T10) et l'event déjà créé est
   * réconcilié par relecture sous cette clé. La même clé doit être réutilisée
   * d'une tentative à l'autre (côté appelant : une par session de formulaire).
   */
  async createEventWithTeams(
    data: CreateEventData,
    teamIds: string[] = [],
    submissionKey?: string,
  ): Promise<EnrichedEvent> {
    if (!globalState.userId) throw new Error("Utilisateur non connecté");

    const payload = {
      name: data.name,
      description: data.description || "",
      dateStart: data.dateStart,
      dateEnd: data.dateEnd,
      date: getEventDates({ meals: data.meals ?? [] }),
      meals: data.meals ?? [],
      createdBy: globalState.userId,
      teams: data.teams ?? [],
      contributors: data.contributors ?? [],
      todos: data.todos ?? [],
      status: data.status || "proposition",
    } as unknown as Omit<Main, "id" | "created" | "updated">;

    try {
      const record = await this.#collection.create(
        submissionKey ? { ...payload, id: submissionKey } : payload,
      );

      console.log(
        `[EventsStore] Événement créé avec ${teamIds.length} team(s): ${record.id}`,
      );

      this.#ensureEventShareLink(record.id);

      return this.#enrichEvent(record);
    } catch (err) {
      // Rejet d'un id déjà pris ou réponse à nouveau perdue : la première
      // tentative a pu aboutir côté serveur — relire sous la clé avant de
      // laisser l'appelant re-créer. Clé absente ou inconnue serveur →
      // l'erreur d'origine est la vraie.
      if (!submissionKey) throw err;
      const reconciled = await this.#reconcileCreatedEvent(submissionKey).catch(
        () => null,
      );
      if (reconciled) {
        this.#ensureEventShareLink(reconciled.id);
        return this.#enrichEvent(reconciled);
      }
      throw err;
    }
  }

  /**
   * Relit un event créé côté serveur mais dont la réponse a été perdue.
   * Retourne null si rien n'existe sous cette clé (l'échec de create était
   * réel). Le record réconcilié est remiroité en Dexie : le SSE a pu manquer
   * pendant la panne réseau.
   */
  async #reconcileCreatedEvent(submissionKey: string): Promise<Main | null> {
    const record = await this.#collection.view(submissionKey);
    if (record.createdBy !== globalState.userId) return null;
    await this.#collection.getTable().put(record);
    console.warn(
      `[EventsStore] Création réconciliée après échec ambigu: ${record.id}`,
    );
    return record;
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

  /**
   * Statut de participation de l'utilisateur courant, dérivé.
   *
   * Une entrée au registre fait foi ; sans entrée, toute personne rendue
   * visible (équipe invitée, invité individuel) est une invitation
   * virtuelle — statut `invited` sans aucune écriture. Le créateur et les
   * hors canaux ne sont pas des invités (null).
   */
  getRsvpStatus(eventId: string): "accepted" | "invited" | "declined" | null {
    if (!this.#userId) return null;

    const event = this.#enrichedMap.get(eventId);
    if (!event) return null;

    // Le créateur n'est jamais une invitation — même s'il traîne une entrée
    // de registre (donnée migrée).
    if (event.createdBy === this.#userId) return null;

    const entry = event.contributors?.find((c) => c.id === this.#userId);
    if (entry) return entry.status;

    const viaTeam = event.teams?.some((teamId) =>
      this.#userTeams.includes(teamId),
    );
    const viaGuestUser = event.guestUsers?.includes(this.#userId) ?? false;

    return viaTeam || viaGuestUser ? "invited" : null;
  }

  /**
   * Enregistre la réponse de l'utilisateur courant à son invitation (upsert).
   *
   * Sans entrée au registre (invitation virtuelle), la réponse crée l'entrée
   * avec l'email et le nom de la session ; avec entrée, elle met à jour le
   * statut. L'écriture ne porte que contributors — aucun canal de
   * visibilité n'est touché.
   */
  async respondToInvitation(
    eventId: string,
    accept: boolean,
  ): Promise<EnrichedEvent> {
    if (!this.#userId) throw new Error("Utilisateur non connecté");

    const event = this.#enrichedMap.get(eventId);
    if (!event) throw new Error("Événement introuvable");

    const status = accept ? ("accepted" as const) : ("declined" as const);
    const contributors = [...event.contributors];
    const index = contributors.findIndex((c) => c.id === this.#userId);

    if (index === -1) {
      contributors.push({
        id: this.#userId,
        email: globalState.userEmail || undefined,
        name: globalState.userName || undefined,
        status,
        invitedAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
      });
    } else {
      contributors[index] = {
        ...contributors[index],
        status,
        respondedAt: new Date().toISOString(),
      };
    }

    return await this.updateEvent(eventId, { contributors });
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
   *
   * Règle d'écriture actée :
   *   - `teamIds` : équipes ENTIÈREMENT invitées — seul cas où le canal équipe
   *     est écrit (grant vivant : les futurs membres hériteront). Les membres
   *     actuels ne sont pas individualisés ; leur statut invité se dérive de
   *     l'équipe. L'appelant (picker) garantit le « entier » — le store ne
   *     connaît pas les rosters d'équipe.
   *   - `emails` : personnes invitées individuellement (membres d'équipes
   *     partiellement cochées + emails saisis à la main). Connue (avec
   *     compte) → visibilité individuelle (guestUsers, relation filtrée par
   *     les règles events list/view/update) + entrée au registre (invité) ;
   *     inconnue → registre avec identifiant temporaire (nanoid) — le hook
   *     join-event la rattache au vrai userId au premier join.
   *   - `notifyEmails` : destinataires de l'expédition groupée (défaut :
   *     `emails`) — les membres d'équipes entières y figurent sans être
   *     écrits individuellement.
   *   - le champ de tracking guestEmails n'est plus écrit par le client.
   *
   * Une seule écriture atomique de l'event, puis get-or-create du lien et
   * expédition en fire-and-forget : l'invitation est déjà posée si l'un des
   * deux échoue.
   *
   * @param eventId - ID de l'événement
   * @param options.emails - Emails à inviter individuellement
   * @param options.teamIds - IDs des équipes entièrement invitées
   * @param options.notifyEmails - Destinataires de l'email groupé
   */
  async inviteParticipants(
    eventId: string,
    options: {
      teamIds?: string[];
      emails?: string[];
      notifyEmails?: string[];
    },
  ): Promise<EnrichedEvent> {
    const event = this.#enrichedMap.get(eventId);
    if (!event) throw new Error("Événement introuvable");

    const { emails = [], teamIds = [], notifyEmails = [] } = options;

    if (
      emails.length === 0 &&
      teamIds.length === 0 &&
      notifyEmails.length === 0
    ) {
      return event;
    }

    // --- 1. Construire les nouveaux contributeurs (dédupliqués) ---
    // Les emails résolus vers un compte PB reçoivent le vrai userId (bandeau
    // RSVP et getRsvpStatus fonctionnels immédiatement) ; fallback
    // nanoid pour les inconnus — le hook join-event rattache l'id au vrai
    // userId au premier join (dédoublonnage par email côté serveur).
    const existingEmails = new Set(
      event.contributors
        .filter((c) => c.email)
        .map((c) => c.email!.toLowerCase()),
    );
    const newEmails = emails.filter(
      (email) => !existingEmails.has(email.toLowerCase()),
    );
    // Une invitation d'équipes entières ne porte aucun email : pas de
    // résolution à faire (ni requête users)
    const knownUsers =
      newEmails.length > 0
        ? await lookupUsersByEmails(newEmails)
        : new Map<string, { id: string; name?: string }>();

    const newContributors = [...event.contributors];
    for (const email of newEmails) {
      const known = knownUsers.get(email.toLowerCase());
      newContributors.push({
        id: known ? known.id : nanoid(), // nanoid : id temporaire pour l'affichage
        email,
        name: known?.name || undefined,
        status: "invited" as const,
        invitedAt: new Date().toISOString(),
      });
      existingEmails.add(email.toLowerCase());
    }

    // --- 2. Construire les nouvelles teams (dédupliquées) ---
    // La relation teams porte des ids PocketBase — le canal équipe n'est
    // écrit que pour les équipes entièrement invitées.
    const currentTeams: string[] = event.teams || [];
    const updatedTeams = [...currentTeams];

    for (const teamId of teamIds) {
      if (!updatedTeams.includes(teamId)) {
        updatedTeams.push(teamId);
      }
    }

    // --- 2b. Résoudre les guestUsers (dédupliqués) ---
    // La relation guestUsers est le champ filtré par les règles events
    // (list/view/update) — contributors est un json non traversable par les
    // règles. N'écrire que contributors laisse l'invité connu hors de toute
    // règle : l'event ne lui est jamais livré et son RSVP est rejeté.
    const currentGuestUsers: string[] = Array.isArray(event.guestUsers)
      ? event.guestUsers
      : [];
    const guestUserIds = new Set(currentGuestUsers);
    for (const known of knownUsers.values()) {
      guestUserIds.add(known.id);
    }
    const updatedGuestUsers = [...guestUserIds];

    // --- 3. Mise à jour atomique de l'event ---
    // guestEmails n'est plus écrit : omettre la clé du PATCH laisse le champ
    // serveur inchangé.
    const updatedEvent = await this.updateEvent(eventId, {
      contributors: newContributors,
      guestUsers: updatedGuestUsers,
      teams: updatedTeams,
    });

    // --- 4. Get-or-create du lien de partage ---
    // Chaque event porte son lien dès la création ; l'appel ici garantit
    // aussi les events créés avant cette garantie. Non bloquant : échouer
    // ici ne remet pas en cause l'invitation déjà posée.
    let shareLinkId: string | null = null;
    try {
      const userId = globalState.userId || event.createdBy;
      if (userId) {
        const link = await getOrCreateShareLink(eventId, userId);
        shareLinkId = link.id;
      } else {
        console.warn(
          "[EventsStore] Pas de userId pour le share link de l'event",
          eventId,
        );
      }
    } catch (err) {
      console.warn("[EventsStore] Share link indisponible:", err);
    }

    // --- 5. Expédition groupée (fire-and-forget) ---
    // notifyEmails porte tous les invités du geste (y compris les membres
    // d'équipes entières, non écrits individuellement).
    const recipients = notifyEmails.length > 0 ? notifyEmails : emails;
    if (shareLinkId && recipients.length > 0) {
      pb.send("/api/enka/send-emails", {
        method: "POST",
        body: {
          template: "invitation_to_event",
          recipients: recipients.map((email) => ({
            email,
            shareLinkId,
          })),
        },
      })
        .then((result) => {
          const okCount =
            result.results?.filter((r: { ok: boolean }) => r.ok).length || 0;
          const failCount = recipients.length - okCount;
          if (failCount > 0) {
            console.warn(
              `[EventsStore] Emails envoyés : ${okCount}/${recipients.length} (${failCount} échec(s))`,
            );
            // L'invitation est posée, mais l'utilisateur doit savoir que le
            // mail n'est pas parti (même traitement que NativeTeamsStore).
            toastService.warning(
              `Emails d'invitation : ${okCount}/${recipients.length} envoyé(s)`,
            );
          } else {
            console.log(
              `[EventsStore] Emails envoyés : ${okCount}/${recipients.length}`,
            );
          }
        })
        .catch((err) => {
          console.error("[EventsStore] Erreur d'envoi des emails:", err);
          toastService.error("Échec de l'envoi des emails d'invitation");
        });

      console.log(
        `[EventsStore] Invitation: ${emails.length} écriture(s) individuelle(s), ${teamIds.length} équipe(s) entière(s) → event ${eventId}`,
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

      return await this.updateEvent(eventId, {
        teams,
      });
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

  /**
   * Purge du cache local (table + curseurs delta) sans toucher aux
   * abonnements : contrairement à destroy(), le bridge liveQuery reste vivant
   * et la map se réconcilie seule au prochain changement de table — le store
   * reste utilisable dans la session (re-scope d'identité).
   */
  async purgeLocal(): Promise<void> {
    await this.#collection.clearLocal();
    this.#rawEvents.clear();
    this.#isInitialized = false;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const eventsStore = new EventsStore();

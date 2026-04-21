import { Permission, Role } from "appwrite";
import type { Teamdocs } from "$lib/types/appwrite.d";
import { globalState } from "./GlobalState.svelte";
import { createSyncCollection, bridgeToMap, db } from "$lib/db-sync/aw-sync";

export interface EnrichedTeamdoc extends Omit<Teamdocs, "lockedBy"> {
  lockedBy: string | null;
}

export class TeamdocsStore {
  #collection = createSyncCollection<Teamdocs>({
    table: db.teamdocs,
    collectionName: "teamdocs",
  });

  #bridge = bridgeToMap<Teamdocs>(() => db.teamdocs.toArray());
  #documents = this.#bridge.map;

  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;
  #initPromise: Promise<void> | null = null;

  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }
  get isInitialized() {
    return this.#isInitialized;
  }
  get isRealtimeActive() {
    return this.#isRealtimeActive;
  }
  get count() {
    return this.#documents.size;
  }

  #documentsList = $derived(Array.from(this.#documents.values()));
  get documents() {
    return this.#documentsList;
  }

  // =============================================================================
  // FILTRAGE
  // =============================================================================

  getTeamDocuments(teamId: string): EnrichedTeamdoc[] {
    return this.#documentsList.filter((doc) => doc.teamId === teamId);
  }

  getTeamTags(teamId: string): string[] {
    const tags = new Set<string>();
    for (const doc of this.#documentsList) {
      if (doc.teamId === teamId && doc.tags) {
        for (const tag of doc.tags) tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  getEventDocuments(eventId: string): EnrichedTeamdoc[] {
    return this.#documentsList.filter((doc) => doc.eventId === eventId);
  }

  // =============================================================================
  // INITIALISATION (3 PHASES)
  // =============================================================================

  async loadCache(): Promise<void> {
    if (this.#isInitialized) return;

    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        console.log("[TeamdocsStore] Pas de userId, cache vide");
        return;
      }

      console.log("[TeamdocsStore] Cache chargé (Dexie)");
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de chargement du cache";
      console.error("[TeamdocsStore] LoadCache error:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async syncFromRemote(): Promise<void> {
    if (!globalState.userId) {
      console.log("[TeamdocsStore] Pas de userId, skip syncFromRemote");
      return;
    }

    this.#loading = true;
    this.#error = null;

    try {
      await this.#collection.initialFetch();

      console.log(
        `[TeamdocsStore] Sync terminé : ${this.#documents.size} documents`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de synchronisation";
      console.error("[TeamdocsStore] SyncFromRemote error:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async setupRealtime(): Promise<void> {
    if (!globalState.isAuthenticated) {
      return;
    }

    if (this.#realtimeInitialized) {
      console.log("[TeamdocsStore] Realtime déjà configuré");
      return;
    }

    try {
      this.#collection.subscribe();
      this.#isRealtimeActive = true;
      this.#realtimeInitialized = true;
      console.log("[TeamdocsStore] Realtime configuré");
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de configuration realtime";
      console.error("[TeamdocsStore] SetupRealtime error:", err);
      throw err;
    }
  }

  async initialize(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[TeamdocsStore] Déjà initialisé");
      return;
    }

    if (this.#initPromise) {
      console.log("[TeamdocsStore] Initialisation déjà en cours, attente...");
      return this.#initPromise;
    }

    console.log("[TeamdocsStore] Initialisation complète...");
    this.#initPromise = (async () => {
      try {
        await this.loadCache();
        await this.syncFromRemote();
        await this.setupRealtime();

        this.#isInitialized = true;
        console.log(
          `[TeamdocsStore] Initialisation complétée: ${this.#documents.size} documents`,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors de l'initialisation";
        this.#error = message;
        console.error("[TeamdocsStore]", message, err);
        throw err;
      } finally {
        this.#initPromise = null;
      }
    })();

    return this.#initPromise;
  }

  // =============================================================================
  // CRUD
  // =============================================================================

  async createDocument(
    data: Partial<Teamdocs>,
    teamId: string,
  ): Promise<Teamdocs> {
    if (!globalState.userId || !globalState.userName) {
      throw new Error("Utilisateur non connecté");
    }

    const doc = await this.#collection.create(
      {
        ...data,
        teamId,
        createdBy: globalState.userId,
      } as Omit<Teamdocs, "$id" | "$createdAt" | "$updatedAt">,
      [
        Permission.read(Role.team(teamId)),
        Permission.update(Role.team(teamId)),
        Permission.delete(Role.team(teamId)),
      ],
    );

    console.log(`[TeamdocsStore] Document créé : ${doc.$id}`);
    return doc;
  }

  async createEventDocument(
    data: Partial<Teamdocs>,
    eventId: string,
  ): Promise<Teamdocs> {
    if (!globalState.userId) {
      throw new Error("Utilisateur non connecté");
    }

    const doc = await this.#collection.create(
      {
        ...data,
        eventId,
        status: "doc",
      } as Omit<Teamdocs, "$id" | "$createdAt" | "$updatedAt">,
      [
        Permission.read(Role.label(eventId)),
        Permission.update(Role.label(eventId)),
        Permission.delete(Role.label(eventId)),
      ],
    );

    console.log(`[TeamdocsStore] Document événement créé : ${doc.$id}`);
    return doc;
  }

  async updateDocument(id: string, data: Partial<Teamdocs>): Promise<Teamdocs> {
    const doc = await this.#collection.update(id, data);

    console.log(`[TeamdocsStore] Document mis à jour : ${id}`);
    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.#collection.remove(id);

    console.log(`[TeamdocsStore] Document supprimé : ${id}`);
  }

  getDocumentById(id: string): EnrichedTeamdoc | undefined {
    return this.#documents.get(id);
  }

  // =============================================================================
  // LOCK MANAGEMENT
  // =============================================================================

  async updateDocumentLock(
    docId: string,
    lockedBy: string | null,
    lockedByName: string | null = null,
  ): Promise<void> {
    if (!globalState.userId) return;

    try {
      await this.#collection.update(docId, {
        lockedBy,
        lockedByName,
      } as Partial<Teamdocs>);

      console.log(
        `[TeamdocsStore] Verrou ${docId} mis à jour: ${lockedBy || "libéré"}`,
      );
    } catch (error) {
      console.error(`[TeamdocsStore] Erreur verrouillage ${docId}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  async destroy(): Promise<void> {
    // Unsubscribe bridge en premier pour arrêter le liveQuery Dexie
    this.#bridge.subscription.unsubscribe();
    this.#collection.unsubscribeAll();
    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await this.#collection.clearLocal();
    this.#isInitialized = false;
    this.#isRealtimeActive = false;
    this.#realtimeInitialized = false;
    this.#loading = false;
    this.#error = null;
    this.#initPromise = null;
    console.log("[TeamdocsStore] Store détruit");
  }

  async hardReset(): Promise<void> {
    await this.destroy();
    console.log("[TeamdocsStore] Hard reset effectué");
  }
}

export const teamdocsStore = new TeamdocsStore();

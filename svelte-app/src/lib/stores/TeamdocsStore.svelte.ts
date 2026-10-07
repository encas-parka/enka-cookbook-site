import type { Teamdocs } from "$lib/types/pb";
import { globalState } from "./GlobalState.svelte";
import { createSyncCollection, bridgeToMap, db, pb } from "$lib/db-sync/pb-sync";

export class TeamdocsStore {
  #collection = createSyncCollection<Teamdocs>(pb, db.teamdocs, "teamdocs");

  #bridge = bridgeToMap<Teamdocs>(() => db.teamdocs.toArray());
  #documents = this.#bridge.map;

  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;
  #initPromise: Promise<void> | null = null;

  // Garde revalidation : une seule delta sync en vol (les appels concurrents
  // skipent silencieusement). Réinitialisé par le finally.
  #revalidating = false;

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

  getTeamDocuments(teamId: string): Teamdocs[] {
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

  getEventDocuments(eventId: string): Teamdocs[] {
    return this.#documentsList.filter((doc) => doc.eventId === eventId);
  }

  /**
   * Récupère les documents d'un événement filtrés par tag
   */
  getEventDocumentsByTag(eventId: string, tag: string): Teamdocs[] {
    return this.#documentsList.filter(
      (doc) => doc.eventId === eventId && doc.tags?.includes(tag),
    );
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

  /**
   * Delta sync depuis PocketBase (premier chargement, loading UI).
   * Toggle `this.#loading` autour de la revalidation.
   */
  async syncInitial(): Promise<void> {
    return this.#runWithLoading(() => this.syncRevalidate());
  }

  /**
   * Revalidation silencieuse (delta sync, sans toggle loading — pas de flash
   * UI skeleton). Skip silencieux si déjà en cours. Rethrow pour laisser
   * l'appelant (orchestrateur de resync) décider du signalement.
   * Un changement d'utilisateur en vol (logout) discard le résultat.
   */
  async syncRevalidate(): Promise<void> {
    if (!globalState.userId) {
      console.log("[TeamdocsStore] Pas de userId, skip syncRevalidate");
      return;
    }

    if (this.#revalidating) return;
    this.#revalidating = true;
    this.#error = null;

    try {
      const uid = globalState.userId;
      await this.#collection.initialFetch();
      // Logout en vol : ne pas livrer les données de l'utilisateur précédent
      // à la cache du suivant.
      if (globalState.userId !== uid) return;

      console.log(
        `[TeamdocsStore] Sync terminé : ${this.#documents.size} documents`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de synchronisation";
      console.error("[TeamdocsStore] SyncRevalidate error:", err);
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
        await this.syncInitial();
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
      } as Omit<Teamdocs, "id" | "created" | "updated">,
    );

    console.log(`[TeamdocsStore] Document créé : ${doc.id}`);
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
      } as Omit<Teamdocs, "id" | "created" | "updated">,
    );

    console.log(`[TeamdocsStore] Document événement créé : ${doc.id}`);
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

  getDocumentById(id: string): Teamdocs | undefined {
    return this.#documents.get(id);
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  /**
   * Reset non destructif (tests / resync locale) : purge l'état en mémoire et
   * les tables Dexie SANS désabonner le bridge liveQuery — une fois
   * désabonné (destroy), le singleton ne peut plus être repeuplé. Le store
   * reste utilisable immédiatement après.
   */
  async softReset(): Promise<void> {
    this.#loading = false;
    this.#error = null;
    this.#isInitialized = false;
    this.#isRealtimeActive = false;
    this.#realtimeInitialized = false;
    this.#initPromise = null;
    await this.#collection.clearLocal();
  }

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

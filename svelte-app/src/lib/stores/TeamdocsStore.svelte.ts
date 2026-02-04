/**
 * Store pour les documents d'équipe (Teamdocs)
 * Pattern MaterielStore avec SvelteMap, IDB cache, Realtime
 */

import { SvelteMap } from "svelte/reactivity";
import type { Teamdocs } from "$lib/types/appwrite.d";
import {
  listDocuments,
  createDocument as createDocumentAppwrite,
  updateDocument as updateDocumentAppwrite,
  deleteDocument as deleteDocumentAppwrite,
  updateDocumentLock,
} from "$lib/services/appwrite-teamdocs";
import { globalState } from "./GlobalState.svelte";
import { realtimeManager } from "./RealtimeManager.svelte";

export interface EnrichedTeamdoc extends Omit<Teamdocs, "lockedBy"> {
  lockedBy: string | null;
}

export class TeamdocsStore {
  // État réactif
  #documents = new SvelteMap<string, EnrichedTeamdoc>();
  #teamTags = new SvelteMap<string, string[]>(); // teamId -> tags[]
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;
  #lastSync = $state<string | null>(null);
  #realtimeUnsubscribe: (() => void) | null = null;

  // Getters simples
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

  // Propriétés réactives ($derived)
  #documentsList = $derived(Array.from(this.#documents.values()));
  get documents() {
    return this.#documentsList;
  }

  // =============================================================================
  // FILTRAGE PAR TEAM
  // =============================================================================

  /**
   * Récupère les documents d'une équipe spécifique
   * Filtrage côté client (Appwrite renvoie tous les docs accessibles)
   */
  getTeamDocuments(teamId: string): EnrichedTeamdoc[] {
    return this.#documentsList.filter((doc) => doc.teamId === teamId);
  }

  /**
   * Récupère les tags utilisés par une équipe
   */
  getTeamTags(teamId: string): string[] {
    return this.#teamTags.get(teamId) || [];
  }

  // =============================================================================
  // INITIALISATION (3 PHASES)
  // =============================================================================

  /**
   * Phase 1 : Charge le cache IndexedDB (sans IDB pour l'instant, simplifié)
   */
  async loadCache(): Promise<void> {
    if (this.#isInitialized) return;

    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        this.#isInitialized = true;
        return;
      }

      // Pour l'instant, on saute l'IDB cache
      // TODO: Implémenter IDB cache si nécessaire
      this.#isInitialized = true;
      console.log("[TeamdocsStore] Cache chargé (sans IDB)");
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
   * Phase 2 : Synchronise avec Appwrite
   */
  async syncFromRemote(): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        return;
      }

      // Récupérer tous les documents accessibles
      const docs = await listDocuments();

      // Enrichir et stocker
      for (const doc of docs) {
        this.#documents.set(doc.$id, doc);
      }

      // Mettre à jour les tags par équipe
      await this.#updateTeamTagsFromDocuments();

      this.#lastSync = new Date().toISOString();
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

  /**
   * Phase 3 : Configure les abonnements realtime
   */
  async setupRealtime(): Promise<void> {
    // ✅ Pas de realtime pour les visiteurs
    if (!globalState.isAuthenticated) {
      return;
    }

    // Vérifier si déjà configuré pour éviter les doublons
    // ✅ SAUF si le RealtimeManager a été détruit (changement auth)
    if (this.#realtimeInitialized && realtimeManager.isInitialized) {
      console.log("[TeamdocsStore] Realtime déjà configuré");
      return;
    }

    // Réinitialiser le flag si le RealtimeManager a été détruit
    if (this.#realtimeInitialized && !realtimeManager.isInitialized) {
      console.log(
        "[TeamdocsStore] RealtimeManager détruit, réinitialisation...",
      );
      this.#realtimeInitialized = false;
    }

    try {
      await this.#setupRealtime();
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

  /**
   * Initialise les 3 phases séquentiellement
   */
  async initialize(): Promise<void> {
    await this.loadCache();
    await this.syncFromRemote();
    await this.setupRealtime();
  }

  // =============================================================================
  // REALTIME
  // =============================================================================

  async #setupRealtime(): Promise<void> {
    const channels = [
      `databases.*.collections.${import.meta.env.VITE_APPWRITE_TEAMDOCS_COLLECTION_ID}`,
    ];

    realtimeManager.register(channels, async (response) => {
      await this.#handleDocumentRealtime(response);
    });

    this.#realtimeUnsubscribe = () => {
      // Cleanup via realtimeManager
    };
  }

  async #handleDocumentRealtime(payload: any): Promise<void> {
    const { events, payload: docPayload } = payload;
    const event = events?.[0];

    if (!event) return;

    const doc = docPayload as Teamdocs;

    switch (event) {
      case "databases.*.collections.*.documents.create":
      case "databases.*.collections.*.documents.update":
        if (doc) {
          this.#documents.set(doc.$id, doc);
          await this.#updateTeamTagsFromDocuments();
          console.log(`[TeamdocsStore] Document mis à jour : ${doc.$id}`);
        }
        break;

      case "databases.*.collections.*.documents.delete":
        if (doc?.$id) {
          this.#documents.delete(doc.$id);
          await this.#updateTeamTagsFromDocuments();
          console.log(`[TeamdocsStore] Document supprimé : ${doc.$id}`);
        }
        break;
    }
  }

  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================

  /**
   * Crée un nouveau document
   */
  async createDocument(
    data: Partial<Teamdocs>,
    teamId: string,
  ): Promise<Teamdocs> {
    if (!globalState.userId || !globalState.userName) {
      throw new Error("Utilisateur non connecté");
    }

    const doc = await createDocumentAppwrite(
      data,
      teamId,
      globalState.userId,
      globalState.userName,
    );

    // Enrichir et stocker
    this.#documents.set(doc.$id, doc);

    // Mettre à jour les tags
    await this.#updateTeamTagsFromDocuments();

    console.log(`[TeamdocsStore] Document créé : ${doc.$id}`);
    return doc;
  }

  /**
   * Met à jour un document
   */
  async updateDocument(id: string, data: Partial<Teamdocs>): Promise<Teamdocs> {
    const doc = await updateDocumentAppwrite(id, data);

    // Enrichir et stocker
    this.#documents.set(id, doc);

    // Mettre à jour les tags si nécessaire
    if (data.tags) {
      await this.#updateTeamTagsFromDocuments();
    }

    console.log(`[TeamdocsStore] Document mis à jour : ${id}`);
    return doc;
  }

  /**
   * Supprime un document
   */
  async deleteDocument(id: string): Promise<void> {
    await deleteDocumentAppwrite(id);

    // Supprimer du store
    this.#documents.delete(id);

    // Mettre à jour les tags
    await this.#updateTeamTagsFromDocuments();

    console.log(`[TeamdocsStore] Document supprimé : ${id}`);
  }

  /**
   * Récupère un document par ID
   */
  getDocumentById(id: string): EnrichedTeamdoc | undefined {
    return this.#documents.get(id);
  }

  // =============================================================================
  // LOCK MANAGEMENT
  // =============================================================================

  /**
   * Met à jour le lock d'un document
   * Le lock est stocké directement dans le champ lockedBy du document
   * @param docId - ID du document
   * @param lockedBy - userId pour verrouiller, null pour libérer
   */
  async updateDocumentLock(
    docId: string,
    lockedBy: string | null,
  ): Promise<void> {
    if (!globalState.userId) return;

    try {
      await updateDocumentLock(docId, lockedBy);

      // Mise à jour locale immédiate pour UX (le realtime synchronisera les autres)
      const currentDoc = this.#documents.get(docId);
      if (currentDoc) {
        this.#documents.set(docId, { ...currentDoc, lockedBy });
      }

      console.log(
        `[TeamdocsStore] Verrou ${docId} mis à jour: ${lockedBy || "libéré"}`,
      );
    } catch (error) {
      console.error(`[TeamdocsStore] Erreur verrouillage ${docId}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // TAGS MANAGEMENT
  // =============================================================================

  /**
   * Met à jour les tags par équipe à partir des documents
   */
  async #updateTeamTagsFromDocuments(): Promise<void> {
    // Grouper les tags par équipe
    const tagsByTeam = new Map<string, Set<string>>();

    for (const doc of this.#documentsList) {
      const teamId = doc.teamId;
      if (!tagsByTeam.has(teamId)) {
        tagsByTeam.set(teamId, new Set());
      }

      if (doc.tags) {
        doc.tags.forEach((tag) => {
          tagsByTeam.get(teamId)!.add(tag);
        });
      }
    }

    // Mettre à jour le SvelteMap
    tagsByTeam.forEach((tags, teamId) => {
      this.#teamTags.set(teamId, Array.from(tags).sort());
    });

    console.log(
      `[TeamdocsStore] Tags mis à jour pour ${tagsByTeam.size} équipes`,
    );
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  destroy(): void {
    if (this.#realtimeUnsubscribe) {
      this.#realtimeUnsubscribe();
      this.#realtimeUnsubscribe = null;
    }
    this.#documents.clear();
    this.#teamTags.clear();
    this.#isInitialized = false;
    this.#isRealtimeActive = false;
    this.#realtimeInitialized = false;
    console.log("[TeamdocsStore] Store détruit");
  }

  /**
   * Réinitialise complètement le store (pour tests/debug)
   */
  async hardReset(): Promise<void> {
    this.destroy();
    this.#lastSync = null;
    console.log("[TeamdocsStore] Hard reset effectué");
  }
}

// Instance singleton
export const teamdocsStore = new TeamdocsStore();

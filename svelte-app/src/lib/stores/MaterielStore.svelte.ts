import { SvelteMap } from "svelte/reactivity";
import type { Models } from "appwrite";
import { Query } from "appwrite";
import { CACHE_SYNC_VERSION } from "$lib/constants/sync";
import type { Materiel, MaterielLoan, MaterielType } from "$lib/types/appwrite";
import type {
  EnrichedMateriel,
  EnrichedMaterielLoan,
  MaterielFromAppwrite,
  MaterielLoanItem,
  MaterielLoanDetail,
  MaterielLoanStatusUnion,
} from "$lib/types/materiel.types";
import {
  listMateriels,
  getMateriel,
  createMateriel,
  updateMateriel,
  deleteMateriel,
  getMaterielRealtimeChannels,
  updateMateriel as updateMaterielService,
} from "$lib/services/appwrite-materiel";
import {
  listMaterielLoans,
  getMaterielLoan,
  getMaterielLoanRealtimeChannels,
  createMaterielLoan,
  updateMaterielLoan,
  deleteMaterielLoan,
} from "$lib/services/appwrite-materiel-loan";
import {
  createMaterielIDBCache,
  type MaterielIDBCache,
} from "$lib/services/materiel-idb-cache";
import { materielTypeLabels } from "$lib/utils/share-utils";
import { globalState } from "./GlobalState.svelte";
import { realtimeManager } from "./RealtimeManager.svelte";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventMaterielStore } from "./EventMaterielStore.svelte";
import {
  enrichMaterielFromAppwrite,
  enrichLoanFromAppwrite,
  reEnrichMaterielFromLoans,
  parseOwnerFromAppwrite,
  parseLoanItemsFromAppwrite,
  extractMaterielIdsFromLoans,
  calculateLoanedQuantityForPeriod,
} from "$lib/utils/materiel.utils";

export class MaterielStore {
  // État réactif
  #materiels = new SvelteMap<string, EnrichedMateriel>();
  #loans = new SvelteMap<string, EnrichedMaterielLoan>();
  #idbCache: MaterielIDBCache | null = null;
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;
  #lastSyncMateriel = $state<string | null>(null);
  #lastSyncLoans = $state<string | null>(null);
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
    return this.#materiels.size;
  }

  // Propriétés réactives ($derived)
  #materielsList = $derived(Array.from(this.#materiels.values()));
  get materiels() {
    return this.#materielsList;
  }

  // Loans
  #loansList = $derived(Array.from(this.#loans.values()));
  get loans() {
    return this.#loansList;
  }

  // Matériels des équipes de l'utilisateur
  #teamMaterielsList = $derived.by(() => {
    if (!globalState.userId) return [];

    // Récupérer les IDs des équipes de l'utilisateur
    const myTeamIds = nativeTeamsStore.myTeams.map((t) => t.$id);

    return this.#materielsList.filter(
      (m) => m.ownerData?.teamId && myTeamIds.includes(m.ownerData.teamId),
    );
  });
  get teamMateriels() {
    return this.#teamMaterielsList;
  }

  // Matériels partageables des autres équipes
  #shareableMaterielsList = $derived.by(() => {
    if (!globalState.userId) return [];

    const myTeamIds = nativeTeamsStore.myTeams.map((t) => t.$id);

    return this.#materielsList.filter((m) => {
      // Vérifier si le matériel est partageable avec au moins une de mes équipes
      const isShareableWithMyTeams = m.shareableWith?.some((teamId) =>
        myTeamIds.includes(teamId),
      );

      return (
        isShareableWithMyTeams &&
        !(m.ownerData?.teamId && myTeamIds.includes(m.ownerData.teamId))
      );
    });
  });
  get shareableMateriels() {
    return this.#shareableMaterielsList;
  }

  // Matériels avec quantité disponible
  #availableMaterielsList = $derived.by(() => {
    return this.#materielsList.filter((m) => m.isAvailable);
  });
  get availableMateriels() {
    return this.#availableMaterielsList;
  }

  // =============================================================================
  // FILTRAGE PAR OWNER
  // =============================================================================

  /**
   * Récupère les matériels disponibles pour une équipe spécifique
   * @param teamId ID de l'équipe propriétaire
   * @returns Liste des matériels disponibles appartenant à l'équipe
   */
  getAvailableMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return this.#availableMaterielsList.filter(
      (m) =>
        m.ownerData?.teamId === teamId &&
        m.status !== "lost" &&
        m.status !== "torepair",
    );
  }

  /**
   * Récupère tous les matériels pour une équipe spécifique
   * @param teamId ID de l'équipe propriétaire
   * @returns Liste de tous les matériels appartenant à l'équipe
   */
  getMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return this.#materielsList.filter((m) => m.ownerData?.teamId === teamId);
  }

  /**
   * Récupère les matériels disponibles pour une équipe sur une période donnée
   * @param teamId ID de l'équipe propriétaire
   * @param startDate Date de début de la période
   * @param endDate Date de fin de la période
   * @param excludeLoanId Optionnel : ID d'un emprunt à exclure du calcul (pour l'édition)
   * @returns Liste des matériels disponibles avec leur quantité disponible sur la période
   */
  getAvailableMaterielsForPeriod(
    teamId: string,
    startDate: string,
    endDate: string,
    excludeLoanId?: string,
  ): Array<EnrichedMateriel & { availableForPeriod: number }> {
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const allLoans = Array.from(this.#loans.values());

    return this.#materielsList
      .filter((m) => m.ownerData?.teamId === teamId)
      .filter((m) => m.status !== "lost" && m.status !== "torepair") // Exclure les matériels perdus ou à réparer
      .map((materiel) => {
        const loanedQuantity = calculateLoanedQuantityForPeriod(
          materiel.$id,
          allLoans,
          periodStart,
          periodEnd,
          excludeLoanId,
        );
        const availableForPeriod = materiel.quantity - loanedQuantity;

        return {
          ...materiel,
          availableForPeriod,
        };
      })
      .filter((m) => m.availableForPeriod > 0);
  }

  // =============================================================================
  // INITIALISATION
  // =============================================================================

  /**
   * Phase 1 : Charge le cache IndexedDB uniquement
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

      // 1. Créer le cache IDB
      this.#idbCache = await createMaterielIDBCache();

      // 2. Charger depuis IDB
      await this.#loadFromCacheInternal();

      this.#isInitialized = true;
      console.log(
        `[MaterielStore] Cache chargé : ${this.#materiels.size} matériels, ${this.#loans.size} emprunts`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de chargement du cache";
      console.error("[MaterielStore] LoadCache error:", err);
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

      // Sync incrémentiel avec Appwrite
      await this.#syncFromAppwrite();

      console.log(
        `[MaterielStore] Sync terminé : ${this.#materiels.size} matériels, ${this.#loans.size} emprunts`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de synchronisation";
      console.error("[MaterielStore] SyncFromRemote error:", err);
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
      console.log("[MaterielStore] Realtime déjà configuré");
      return;
    }

    // Réinitialiser le flag si le RealtimeManager a été détruit
    if (this.#realtimeInitialized && !realtimeManager.isInitialized) {
      console.log(
        "[MaterielStore] RealtimeManager détruit, réinitialisation...",
      );
      this.#realtimeInitialized = false;
    }

    try {
      await this.#setupRealtime();
      this.#isRealtimeActive = true;
      this.#realtimeInitialized = true;
      console.log("[MaterielStore] Realtime configuré");
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de configuration realtime";
      console.error("[MaterielStore] SetupRealtime error:", err);
      throw err;
    }
  }

  /**
   * Initialise les 3 phases séquentiellement (méthode legacy pour compatibilité)
   */
  async initialize(): Promise<void> {
    await this.loadCache();
    await this.syncFromRemote();
    await this.setupRealtime();
  }

  async #loadFromCacheInternal(): Promise<void> {
    if (!this.#idbCache) return;

    try {
      // Charger les matériels
      const materielsMap = await this.#idbCache.loadMateriels();
      materielsMap.forEach((materiel) => {
        this.#materiels.set(materiel.$id, materiel);
      });

      // Charger les emprunts
      const loansMap = await this.#idbCache.loadLoans();
      loansMap.forEach((loan) => {
        const enriched = enrichLoanFromAppwrite(loan);
        this.#loans.set(loan.$id, enriched);
      });

      // Charger les métadonnées
      const metadata = await this.#idbCache.loadMetadata();

      // Vérifier la version du cache — si obsolète, forcer un full sync
      if (!metadata.syncVersion || metadata.syncVersion < CACHE_SYNC_VERSION) {
        console.log(
          `[MaterielStore] Cache syncVersion ${metadata.syncVersion ?? "absent"} < ${CACHE_SYNC_VERSION}, full sync requis`,
        );
        this.#lastSyncMateriel = null;
        this.#lastSyncLoans = null;
      } else {
        this.#lastSyncMateriel = metadata.lastSyncMateriel;
        this.#lastSyncLoans = metadata.lastSyncLoans;
      }

      console.log(
        `[MaterielStore] ${this.#materiels.size} matériels et ${this.#loans.size} emprunts chargés du cache IDB`,
      );
    } catch (err) {
      console.warn("[MaterielStore] Erreur lecture cache IDB, ignoré:", err);
    }
  }

  async #syncFromAppwrite(): Promise<void> {
    try {
      // 1. Sync Materiel (modifiés depuis lastSyncMateriel)
      const materielQueries = this.#lastSyncMateriel
        ? [
            Query.greaterThan("$updatedAt", this.#lastSyncMateriel),
            Query.limit(500),
          ]
        : [Query.limit(500)];

      const updatedMateriels = await listMateriels(materielQueries);

      for (const doc of updatedMateriels) {
        const enriched = this.#enrichMaterielFromLoans(doc);
        this.#materiels.set(doc.$id, enriched);
        this.#idbCache?.upsertMateriel(enriched);
      }

      this.#lastSyncMateriel = new Date().toISOString();

      // 2. Sync MaterielLoan (modifiés depuis lastSyncLoans)
      const loanQueries = this.#lastSyncLoans
        ? [
            Query.greaterThan("$updatedAt", this.#lastSyncLoans),
            Query.limit(500),
          ]
        : [Query.limit(500)];

      const updatedLoans = await listMaterielLoans(loanQueries);

      for (const loan of updatedLoans) {
        const enriched = enrichLoanFromAppwrite(loan);
        this.#loans.set(loan.$id, enriched);
        this.#idbCache?.upsertLoan(loan);

        // Ré-enrichir les matériels affectés
        this.#reEnrichMaterielsFromLoan(enriched);
      }

      this.#lastSyncLoans = new Date().toISOString();

      // 3. Persister les métadonnées
      await this.#idbCache?.saveMetadata({
        lastSyncMateriel: this.#lastSyncMateriel,
        lastSyncLoans: this.#lastSyncLoans,
        syncVersion: CACHE_SYNC_VERSION,
      });

      console.log("[MaterielStore] Sync terminé");
    } catch (err) {
      console.error("[MaterielStore] Erreur sync:", err);
      throw err;
    }
  }

  /**
   * Charge TOUS les documents depuis Appwrite (sans filtre $updatedAt)
   * Utilisé pour le hard reset
   */
  async #forceLoadFromAppwrite(): Promise<void> {
    try {
      console.log("[MaterielStore] Chargement complet depuis Appwrite...");

      // 1. Charger TOUS les matériels
      const allMateriels = await listMateriels([Query.limit(1000)]);

      for (const doc of allMateriels) {
        const enriched = this.#enrichMaterielFromLoans(doc);
        this.#materiels.set(doc.$id, enriched);
      }

      // 2. Charger TOUS les emprunts
      const allLoans = await listMaterielLoans([Query.limit(1000)]);

      const enrichedLoans: EnrichedMaterielLoan[] = [];
      for (const loan of allLoans) {
        const enriched = enrichLoanFromAppwrite(loan);
        this.#loans.set(loan.$id, enriched);
        enrichedLoans.push(enriched);
      }

      // 3. Ré-enrichir tous les matériels avec les emprunts chargés
      for (const loan of enrichedLoans) {
        this.#reEnrichMaterielsFromLoan(loan);
      }

      // 4. Mettre à jour les timestamps de sync
      this.#lastSyncMateriel = new Date().toISOString();
      this.#lastSyncLoans = new Date().toISOString();

      console.log(
        `[MaterielStore] ${allMateriels.length} matériels et ${allLoans.length} emprunts chargés`,
      );
    } catch (err) {
      console.error("[MaterielStore] Erreur chargement complet:", err);
      throw err;
    }
  }

  async #setupRealtime(): Promise<void> {
    // Enregistrer un callback pour la collection materiel
    realtimeManager.register(
      getMaterielRealtimeChannels(),
      async (response: any) => {
        await this.#handleMaterielRealtime(response);
      },
    );

    // Enregistrer un callback séparé pour la collection materiel_loan
    realtimeManager.register(
      getMaterielLoanRealtimeChannels(),
      async (response: any) => {
        await this.#handleLoanRealtime(response);
      },
    );
  }

  async #handleMaterielRealtime(response: any): Promise<void> {
    try {
      const events = response.events;
      const payload = response.payload as Materiel;

      if (!payload) {
        console.warn(
          "[MaterielStore] Realtime Materiel : pas de payload dans la réponse",
        );
        return;
      }

      const eventType = events.some((e: string) => e.includes(".create"))
        ? "create"
        : events.some((e: string) => e.includes(".delete"))
          ? "delete"
          : "update";

      console.log(
        `[MaterielStore] ⚡️ Realtime Materiel RECEIVED: ${eventType} pour ${payload.$id}`,
      );

      if (eventType === "create" || eventType === "update") {
        const enriched = this.#enrichMaterielFromLoans(payload);
        this.#materiels.set(payload.$id, enriched);
        this.#idbCache?.upsertMateriel(enriched);
      } else if (eventType === "delete") {
        this.#materiels.delete(payload.$id);
        this.#idbCache?.deleteMateriel(payload.$id);
      }
    } catch (err) {
      console.error("[MaterielStore] Erreur realtime Materiel:", err);
    }
  }

  async #handleLoanRealtime(response: any): Promise<void> {
    try {
      const events = response.events;
      const payload = response.payload as MaterielLoan;

      if (!payload) {
        console.warn(
          "[MaterielStore] Realtime Loan : pas de payload dans la réponse",
        );
        return;
      }

      const eventType = events.some((e: string) => e.includes(".create"))
        ? "create"
        : events.some((e: string) => e.includes(".delete"))
          ? "delete"
          : "update";

      console.log(
        `[MaterielStore] ⚡️ Realtime Loan RECEIVED: ${eventType} pour ${payload.$id}`,
      );

      if (eventType === "create" || eventType === "update") {
        const enriched = enrichLoanFromAppwrite(payload);
        this.#loans.set(payload.$id, enriched);
        this.#idbCache?.upsertLoan(payload);
        this.#reEnrichMaterielsFromLoan(enriched);
      } else if (eventType === "delete") {
        // Conserver le loan pour le ré-enrichissement avant suppression
        const loan = this.#loans.get(payload.$id);
        if (loan) {
          // Ré-enrichissement synchrone avec données locales
          this.#reEnrichMaterielsFromLoan(loan);
        }
        this.#loans.delete(payload.$id);
        this.#idbCache?.deleteLoan(payload.$id);
      }
    } catch (err) {
      console.error("[MaterielStore] Erreur realtime Loan:", err);
    }
  }

  // =============================================================================
  // ENRICHISSEMENT
  // =============================================================================

  /**
   * Enrichit un matériel en calculant ses emprunts actifs depuis #loans
   * Utilise les utilitaires de parsing pour garantir la cohérence
   */
  #enrichMaterielFromLoans(doc: Materiel): EnrichedMateriel {
    const allLoans = Array.from(this.#loans.values());
    return enrichMaterielFromAppwrite(doc, allLoans);
  }

  /**
   * Ré-enrichit les matériels affectés par un emprunt
   * Version optimisée : utilise les données locales, pas d'appel API
   */
  #reEnrichMaterielsFromLoan(loan: EnrichedMaterielLoan): void {
    // ✅ Utiliser les items déjà parsés du loan enrichi
    const loanItems = loan.materielItems;

    // Récupérer tous les loans pour le recalcul
    const allLoans = Array.from(this.#loans.values());

    for (const item of loanItems) {
      const materiel = this.#materiels.get(item.materielId);
      if (materiel) {
        // ✅ Utiliser les données locales, pas d'appel API
        const enriched = reEnrichMaterielFromLoans(materiel, allLoans);
        this.#materiels.set(item.materielId, enriched);
        this.#idbCache?.upsertMateriel(enriched);
      }
    }
  }

  // =============================================================================
  // API PUBLIQUE
  // =============================================================================

  getMaterielById(materielId: string): EnrichedMateriel | undefined {
    return this.#materiels.get(materielId);
  }

  getLoanById(loanId: string): EnrichedMaterielLoan | undefined {
    return this.#loans.get(loanId);
  }

  /**
   * Crée un nouveau matériel
   */
  async createMateriel(data: {
    name: string;
    description?: string;
    type?: string;
    quantity: number;
    status?: string;
    location?: string;
    shareableWith?: string[];
    owner: string; // JSON string de MaterielOwner
  }): Promise<EnrichedMateriel> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        throw new Error("Utilisateur non connecté");
      }

      const doc = await createMateriel(data as any, globalState.userId);
      const enriched = this.#enrichMaterielFromLoans(doc);
      this.#materiels.set(doc.$id, enriched);
      this.#idbCache?.upsertMateriel(enriched);

      return enriched;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Met à jour un matériel
   */
  async updateMateriel(
    materielId: string,
    data: {
      name?: string;
      description?: string;
      type?: string;
      quantity?: number;
      status?: string;
      location?: string;
      shareableWith?: string[];
      owner?: string;
    },
  ): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const doc = await updateMateriel(materielId, data);
      const enriched = this.#enrichMaterielFromLoans(doc);
      this.#materiels.set(doc.$id, enriched);
      this.#idbCache?.upsertMateriel(enriched);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Supprime un matériel
   */
  async deleteMateriel(materielId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      await deleteMateriel(materielId);
      this.#materiels.delete(materielId);
      this.#idbCache?.deleteMateriel(materielId);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  // =============================================================================
  // API PUBLIQUE - LOANS
  // =============================================================================

  /**
   * Crée un emprunt avec plusieurs matériels
   */
  async createLoan(data: {
    startDate: string;
    endDate: string;
    responsibleId: string;
    responsibleName: string;
    ownerId: string;
    ownerName: string;
    materiels: MaterielLoanItem[];
    notes?: string;
    status?: "asked" | "accepted"; // Statut optionnel
    eventId?: string | null; // ID de l'événement lié (optionnel)
    eventName?: string | null; // Snapshot du nom de l'event (optionnel)
  }): Promise<EnrichedMaterielLoan> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        throw new Error("Utilisateur non connecté");
      }

      // Cast pour MaterielLoanStatus (enum) vs MaterielLoanStatusUnion (string literals)
      const loan = await createMaterielLoan(data as any, globalState.userId);

      // Enrichir le loan créé pour le retour
      const enriched = enrichLoanFromAppwrite(loan);

      // Sync vers EventMateriel si un eventId est lié
      if (data.eventId && data.materiels.length > 0) {
        await eventMaterielStore.syncFromLoan(
          loan.$id,
          data.eventId,
          data.materiels,
          data.responsibleName,
          data.ownerName,
          globalState.userId,
        );
      }

      // Le realtime va gérer la mise à jour locale
      return enriched;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Met à jour un emprunt
   */
  async updateLoan(
    loanId: string,
    data: {
      startDate?: string;
      endDate?: string;
      materiels?: MaterielLoanItem[];
      status?: MaterielLoanStatusUnion;
      notes?: string;
      returnedAt?: string;
      returnNotes?: string;
      eventId?: string | null;
      eventName?: string | null;
    },
  ): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const currentLoan = this.#loans.get(loanId);
      const oldEventId = currentLoan?.eventId || null;
      const newEventId = data.eventId !== undefined ? data.eventId : oldEventId;

      // Cast pour MaterielLoanStatus (enum) vs MaterielLoanStatusUnion (string literals)
      await updateMaterielLoan(loanId, data as any);

      // Sync vers EventMateriel si nécessaire
      if (data.eventId !== undefined || data.materiels !== undefined) {
        const materiels = data.materiels || currentLoan?.materielItems || [];

        if (oldEventId && oldEventId !== newEventId) {
          await eventMaterielStore.removeByLoanAndEvent(loanId, oldEventId);
        }

        if (newEventId && materiels.length > 0) {
          await eventMaterielStore.syncFromLoan(
            loanId,
            newEventId,
            materiels,
            currentLoan?.responsibleName || "",
            currentLoan?.ownerName || "",
            globalState.userId || "",
          );
        } else if (!newEventId && oldEventId) {
          await eventMaterielStore.removeByLoan(loanId);
        }
      }

      // Le realtime va gérer la mise à jour locale
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Accepte un emprunt
   */
  async acceptLoan(loanId: string): Promise<void> {
    await this.updateLoan(loanId, { status: "accepted" });
  }

  /**
   * Refuse un emprunt
   */
  async refuseLoan(loanId: string): Promise<void> {
    const loan = this.#loans.get(loanId);
    if (loan?.eventId) {
      await eventMaterielStore.removeByLoan(loanId);
    }
    await this.updateLoan(loanId, { status: "refused" });
  }

  /**
   * Annule un emprunt
   */
  async cancelLoan(loanId: string): Promise<void> {
    const loan = this.#loans.get(loanId);
    if (loan?.eventId) {
      await eventMaterielStore.removeByLoan(loanId);
    }
    await this.updateLoan(loanId, { status: "canceled" });
  }

  /**
   * Termine un emprunt en enregistrant l'état du matériel retourné
   * Combine les étapes returned + completed
   * Met également à jour le statut des materiels si perdu/cassé
   */
  async completeLoanWithReturn(
    loanId: string,
    data: {
      materiels: MaterielLoanItem[]; // Avec lost/broken mis à jour
      returnNotes?: string;
    },
  ): Promise<void> {
    // Pour chaque materiel avec pertes/cassures, mettre à jour son statut
    for (const item of data.materiels) {
      const lost = item.lostQuantity || 0;
      const broken = item.brokenQuantity || 0;

      // Si tout est perdu ou cassé, marquer comme "lost"
      if (lost + broken >= item.quantity) {
        await updateMaterielService(item.materielId, {
          status: "lost",
        });
      }
      // Si partiellement cassé (mais pas tout), marquer comme "torepair"
      else if (broken > 0) {
        await updateMaterielService(item.materielId, {
          status: "torepair",
        });
      }
      // Sinon, s'assurer que le statut est "ok"
      else {
        await updateMaterielService(item.materielId, {
          status: "ok",
        });
      }
    }

    // Mettre à jour le loan
    await this.updateLoan(loanId, {
      status: "completed",
      returnedAt: new Date().toISOString(),
      returnNotes: data.returnNotes,
      materiels: data.materiels,
    });
  }

  /**
   * Termine un emprunt (sans fiche de retour)
   * @deprecated
   */
  async completeLoan(loanId: string): Promise<void> {
    await this.updateLoan(loanId, {
      status: "completed",
      returnedAt: new Date().toISOString(),
    });
  }

  /**
   * Supprime un emprunt
   */
  async deleteLoan(loanId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      // Ré-enrichir les matériels avant suppression
      const loan = this.#loans.get(loanId);
      if (loan) {
        this.#reEnrichMaterielsFromLoan(loan);

        // Supprimer les EventMateriel liés
        if (loan.eventId) {
          await eventMaterielStore.removeByLoan(loanId);
        }
      }

      await deleteMaterielLoan(loanId);

      // Le realtime va gérer le reste
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  exportLoanToMarkdown(loanId: string): string {
    const loan = this.#loans.get(loanId);
    if (!loan) return "";

    const lines: string[] = [];

    lines.push("---");
    lines.push("# Réservation de matériel");
    lines.push("");

    lines.push(`- **Responsable** : ${loan.responsibleName ?? ""}`);

    const start = new Date(loan.startDate).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    const end = new Date(loan.endDate).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    lines.push(`- **Période** : ${start} - ${end}`);

    if (loan.eventName) {
      lines.push(`- **Événement** : ${loan.eventName}`);
    }

    if (loan.notes) {
      lines.push(`- **Notes** : ${loan.notes}`);
    }

    lines.push("");

    const items = loan.materielItems;
    const byType = new Map<string, typeof items>();

    for (const item of items) {
      const m = this.#materiels.get(item.materielId);
      const typeLabel = materielTypeLabels[m?.type ?? "other"] ?? "Autre";
      if (!byType.has(typeLabel)) byType.set(typeLabel, []);
      byType.get(typeLabel)!.push(item);
    }

    for (const [typeLabel, typeItems] of byType) {
      lines.push(`## ${typeLabel}`);
      lines.push("");
      for (const item of typeItems) {
        lines.push(`- ${item.materielName} × ${item.quantity}`);
      }
      lines.push("");
    }

    if (loan.status === "completed" && loan.returnNotes) {
      lines.push("## Retour");
      lines.push("");
      for (const item of items) {
        const lost = item.lostQuantity ?? 0;
        const broken = item.brokenQuantity ?? 0;
        if (lost > 0 || broken > 0) {
          lines.push(
            `- ${item.materielName} × ${item.quantity} (perdu: ${lost}, cassé: ${broken})`,
          );
        }
      }
      lines.push("");
      lines.push(loan.returnNotes);
    }

    return lines.join("\n");
  }

  /**
   * Hard Reset - Vide tout (état Svelte + cache IDB) et recharge depuis Appwrite
   */
  async hardReset(): Promise<void> {
    console.log("[MaterielStore] 🔄 HARD RESET - Vidage complet...");
    this.#loading = true;
    this.#error = null;

    try {
      // 1. Vider l'état Svelte
      this.#materiels.clear();
      this.#loans.clear();

      // 2. Vider le cache IndexedDB
      if (this.#idbCache) {
        await this.#idbCache.clear();
        console.log("[MaterielStore] Cache IDB vidé");
      }

      // 3. Recharger TOUT depuis Appwrite (sans filtre $updatedAt)
      await this.#forceLoadFromAppwrite();

      // 4. Recréer le cache avec les données fraîches
      if (this.#idbCache) {
        // Sauvegarder tous les matériels
        for (const [, materiel] of this.#materiels) {
          await this.#idbCache.upsertMateriel(materiel);
        }

        // Sauvegarder tous les emprunts
        for (const [, loan] of this.#loans) {
          await this.#idbCache.upsertLoan(loan);
        }

        // Sauvegarder les métadonnées
        await this.#idbCache.saveMetadata({
          lastSyncMateriel: this.#lastSyncMateriel,
          lastSyncLoans: this.#lastSyncLoans,
          syncVersion: CACHE_SYNC_VERSION,
        });

        console.log("[MaterielStore] Cache IDB recréé");
      }

      console.log("[MaterielStore] ✓ HARD RESET terminé");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du hard reset";
      this.#error = message;
      console.error("[MaterielStore] Erreur hard reset:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  destroy(): void {
    this.#realtimeUnsubscribe?.();
    this.#materiels.clear();
    this.#loans.clear();
    this.#idbCache = null;
    this.#realtimeInitialized = false; // Reset pour permettre une réinitialisation
  }
}

// Singleton
export const materielStore = new MaterielStore();

import { liveQuery } from "dexie";
import type { Subscription } from "dexie";
import type { Materiel, MaterielLoan } from "$lib/types/pb";
import type {
  EnrichedMateriel,
  EnrichedMaterielLoan,
  MaterielLoanItem,
  MaterielLoanStatusUnion,
  MaterielOwner,
} from "$lib/types/materiel.types";
import {
  enrichMaterielFromAppwrite,
  enrichLoanFromAppwrite,
  calculateLoanedQuantityForPeriod,
} from "$lib/utils/materiel.utils";
import { materielTypeLabels } from "$lib/utils/share-utils";
import { globalState } from "./GlobalState.svelte";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventMaterielStore } from "./EventMaterielStore.svelte";
import { createSyncCollection, db, pb } from "$lib/db-sync/pb-sync";

/**
 * MaterielStore — Gestion du matériel avec Svelte 5 + aw-sync
 *
 * Architecture :
 * - 1 liveQuery Dexie observe 2 tables (materiels, materielLoans)
 * - #raw ($state) : données brutes synchronisées, écrites par le handler liveQuery
 * - #enrichedMateriels / #enrichedLoans ($derived) : enrichissement pur
 * - Listes filtrées ($derived) : vues dérivées
 *
 * Flux :
 *   liveQuery(2 tables) → #raw ($state) → #enriched ($derived) → filtered ($derived)
 *   CRUD → Appwrite → realtime → Dexie → liveQuery → #raw
 *
 * Note : bridgeToMap n'est PAS utilisé ici car les données enrichies
 * dépendent de 2 tables croisées. Un $state + $derived est plus adapté
 * qu'une SvelteMap qui serait immédiatement détruite par la chaîne $derived.
 */

export class MaterielStore {
  // aw-sync collections (CRUD + sync Appwrite ↔ Dexie)
  #materielCollection = createSyncCollection<Materiel>(pb, db.materiels, "materiel", { softDelete: true });

  #loanCollection = createSyncCollection<MaterielLoan>(pb, db.materielLoans, "materiel_loan");

  // Single liveQuery subscription (observes both tables)
  #subscription: Subscription | null = null;

  // Reactive raw data — written by liveQuery, consumed by $derived
  #raw = $state<{ materiels: Materiel[]; loans: MaterielLoan[] }>({
    materiels: [],
    loans: [],
  });

  // État réactif
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;

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
    return this.#enrichedMateriels.length;
  }

  // =============================================================================
  // ENRICHED DERIVED DATA
  // =============================================================================

  /** All materiels enriched with loan data (soft-deleted excluded) */
  #enrichedMateriels = $derived.by(() =>
    this.#raw.materiels
      .filter((m) => !m.deleted)
      .map((m) => enrichMaterielFromAppwrite(m, this.#raw.loans)),
  );

  /** All loans enriched with parsed materielItems */
  #enrichedLoans = $derived.by(() =>
    this.#raw.loans.map((l) => enrichLoanFromAppwrite(l)),
  );

  // Public reactive lists
  get materiels() {
    return this.#enrichedMateriels;
  }

  get loans() {
    return this.#enrichedLoans;
  }

  // Matériels partageables des autres équipes
  #shareableMaterielsList = $derived.by(() => {
    if (!globalState.userId) return [];
    const myTeamIds = nativeTeamsStore.myTeams.map((t) => t.id);
    return this.#enrichedMateriels.filter((m) => {
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

  // =============================================================================
  // FILTRAGE PAR OWNER
  // =============================================================================

  getAvailableMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return this.#enrichedMateriels.filter(
      (m) =>
        m.ownerData?.teamId === teamId &&
        m.status !== "lost" &&
        m.status !== "torepair" &&
        m.isAvailable,
    );
  }

  getMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return this.#enrichedMateriels.filter(
      (m) => m.ownerData?.teamId === teamId,
    );
  }

  getAvailableMaterielsForPeriod(
    teamId: string,
    startDate: string,
    endDate: string,
    excludeLoanId?: string,
  ): Array<EnrichedMateriel & { availableForPeriod: number }> {
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    const allLoans = this.#raw.loans;

    return this.#enrichedMateriels
      .filter((m) => m.ownerData?.teamId === teamId)
      .filter((m) => m.status !== "lost" && m.status !== "torepair")
      .map((materiel) => {
        const loanedQuantity = calculateLoanedQuantityForPeriod(
          materiel.id,
          allLoans,
          periodStart,
          periodEnd,
          excludeLoanId,
        );
        const availableForPeriod = materiel.quantity - loanedQuantity;
        return { ...materiel, availableForPeriod };
      })
      .filter((m) => m.availableForPeriod > 0);
  }

  // =============================================================================
  // LIVEQUERY OBSERVATION
  // =============================================================================

  /**
   * Démarre la souscription liveQuery sur les 2 tables Dexie.
   * Les données sont synchronisées (même transaction Dexie).
   */
  #startObservation() {
    this.#subscription?.unsubscribe();

    this.#subscription = liveQuery(async () => {
      const [materiels, loans] = await Promise.all([
        db.materiels.toArray(),
        db.materielLoans.toArray(),
      ]);
      return { materiels, loans };
    }).subscribe({
      next: (data) => {
        this.#raw = data;
      },
      error: (err) => {
        console.error("[MaterielStore] liveQuery error:", err);
      },
    });
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
        this.#isInitialized = true;
        return;
      }

      console.log("[MaterielStore] Cache chargé (Dexie)");
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de chargement du cache";
      console.error("[MaterielStore] LoadCache error:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async syncFromRemote(): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) return;

      await this.#materielCollection.initialFetch();
      await this.#loanCollection.initialFetch();

      // Start observing Dexie tables after data is populated
      this.#startObservation();

      console.log(
        `[MaterielStore] Sync terminé : ${this.#raw.materiels.length} matériels, ${this.#raw.loans.length} emprunts`,
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

  async setupRealtime(): Promise<void> {
    if (!globalState.isAuthenticated) return;
    if (this.#realtimeInitialized) {
      console.log("[MaterielStore] Realtime déjà configuré");
      return;
    }

    try {
      this.#materielCollection.subscribe();
      this.#loanCollection.subscribe();
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

  async initialize(): Promise<void> {
    await this.loadCache();
    await this.syncFromRemote();
    await this.setupRealtime();
  }

  // =============================================================================
  // API PUBLIQUE - MATERIELS
  // =============================================================================

  getMaterielById(materielId: string): EnrichedMateriel | undefined {
    return this.#enrichedMateriels.find((m) => m.id === materielId);
  }

  getLoanById(loanId: string): EnrichedMaterielLoan | undefined {
    return this.#enrichedLoans.find((l) => l.id === loanId);
  }

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

      // Parser owner pour les permissions
      let ownerData: MaterielOwner;
      try {
        ownerData =
          typeof data.owner === "string"
            ? JSON.parse(data.owner)
            : (data.owner as MaterielOwner);
      } catch (e) {
        throw new Error("Invalid owner format");
      }

      const doc = await this.#materielCollection.create(
        {
          name: data.name,
          description: data.description || null,
          type: data.type || null,
          quantity: data.quantity,
          status: (data.status || "ok") as Materiel["status"],
          location: data.location || null,
          shareableWith: data.shareableWith || null,
          owner: data.owner,
          deleted: false,
          isStorage: false,
          storeIn: null,
        } as Omit<Materiel, "id" | "created" | "updated">,
      );

      // Return enriched (will also update via liveQuery)
      return enrichMaterielFromAppwrite(doc, this.#raw.loans);
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

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
      await this.#materielCollection.update(
        materielId,
        data as Partial<Materiel>,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async deleteMateriel(materielId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      await this.#materielCollection.update(materielId, { deleted: true } as Partial<Materiel>);
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

  async createLoan(data: {
    startDate: string;
    endDate: string;
    responsibleId: string;
    responsibleName: string;
    ownerId: string;
    ownerName: string;
    materiels: MaterielLoanItem[];
    notes?: string;
    status?: "asked" | "accepted";
    eventId?: string | null;
    eventName?: string | null;
  }): Promise<EnrichedMaterielLoan> {
    this.#loading = true;
    this.#error = null;

    try {
      if (!globalState.userId) {
        throw new Error("Utilisateur non connecté");
      }

      const loan = await this.#loanCollection.create(
        {
          startDate: data.startDate,
          endDate: data.endDate,
          responsibleId: data.responsibleId,
          responsibleName: data.responsibleName,
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          materiels: data.materiels.map((item) => JSON.stringify(item)),
          notes: data.notes || null,
          status: (data.status || "asked") as MaterielLoan["status"],
          completedAt: null,
          returnedAt: null,
          returnNotes: null,
          eventId: data.eventId || null,
          eventName: data.eventName || null,
        } as Omit<MaterielLoan, "id" | "created" | "updated">,
      );

      const enriched = enrichLoanFromAppwrite(loan);

      // Sync vers EventMateriel si un eventId est lié
      if (data.eventId && data.materiels.length > 0) {
        await eventMaterielStore.syncFromLoan(
          loan.id,
          data.eventId,
          data.materiels,
          data.responsibleName,
          data.ownerName,
          globalState.userId,
        );
      }

      return enriched;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

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
      const currentLoan = this.getLoanById(loanId);
      const oldEventId = currentLoan?.eventId || null;
      const newEventId =
        data.eventId !== undefined ? data.eventId : oldEventId;

      const updateData: Record<string, unknown> = {};
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.materiels !== undefined)
        updateData.materiels = data.materiels.map((item) =>
          JSON.stringify(item),
        );
      if (data.status !== undefined)
        updateData.status = data.status as string;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.returnedAt !== undefined)
        updateData.returnedAt = data.returnedAt;
      if (data.returnNotes !== undefined)
        updateData.returnNotes = data.returnNotes;
      if (data.eventId !== undefined) updateData.eventId = data.eventId;
      if (data.eventName !== undefined) updateData.eventName = data.eventName;

      await this.#loanCollection.update(
        loanId,
        updateData as Partial<MaterielLoan>,
      );

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
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async acceptLoan(loanId: string): Promise<void> {
    await this.updateLoan(loanId, { status: "accepted" });
  }

  async refuseLoan(loanId: string): Promise<void> {
    const loan = this.getLoanById(loanId);
    if (loan?.eventId) {
      await eventMaterielStore.removeByLoan(loanId);
    }
    await this.updateLoan(loanId, { status: "refused" });
  }

  async cancelLoan(loanId: string): Promise<void> {
    const loan = this.getLoanById(loanId);
    if (loan?.eventId) {
      await eventMaterielStore.removeByLoan(loanId);
    }
    await this.updateLoan(loanId, { status: "canceled" });
  }

  async completeLoanWithReturn(
    loanId: string,
    data: {
      materiels: MaterielLoanItem[];
      returnNotes?: string;
    },
  ): Promise<void> {
    // Pour chaque materiel avec pertes/cassures, mettre à jour son statut
    for (const item of data.materiels) {
      const lost = item.lostQuantity || 0;
      const broken = item.brokenQuantity || 0;

      if (lost + broken >= item.quantity) {
        await this.#materielCollection.update(item.materielId, {
          status: "lost",
        } as Partial<Materiel>);
      } else if (broken > 0) {
        await this.#materielCollection.update(item.materielId, {
          status: "torepair",
        } as Partial<Materiel>);
      } else {
        await this.#materielCollection.update(item.materielId, {
          status: "ok",
        } as Partial<Materiel>);
      }
    }

    await this.updateLoan(loanId, {
      status: "completed",
      returnedAt: new Date().toISOString(),
      returnNotes: data.returnNotes,
      materiels: data.materiels,
    });
  }

  async completeLoan(loanId: string): Promise<void> {
    await this.updateLoan(loanId, {
      status: "completed",
      returnedAt: new Date().toISOString(),
    });
  }

  async deleteLoan(loanId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const loan = this.getLoanById(loanId);
      if (loan?.eventId) {
        await eventMaterielStore.removeByLoan(loanId);
      }

      await this.#loanCollection.remove(loanId);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  exportLoanToMarkdown(loanId: string): string {
    const loan = this.getLoanById(loanId);
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
      const m = this.#enrichedMateriels.find(
        (em) => em.id === item.materielId,
      );
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

  // =============================================================================
  // HARD RESET & CLEANUP
  // =============================================================================

  async hardReset(): Promise<void> {
    console.log("[MaterielStore] 🔄 HARD RESET...");
    this.#loading = true;
    this.#error = null;

    try {
      // Clear Dexie + syncMeta for both collections
      await this.#materielCollection.clearLocal();
      await this.#loanCollection.clearLocal();

      // Re-sync from Appwrite (full sync, no lastSync)
      await this.#materielCollection.initialFetch();
      await this.#loanCollection.initialFetch();

      // Restart liveQuery observation (may have been stopped by destroy())
      this.#startObservation();

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

  async destroy(): Promise<void> {
    // Unsubscribe liveQuery
    this.#subscription?.unsubscribe();
    this.#subscription = null;

    // Unsubscribe aw-sync realtime
    this.#materielCollection.unsubscribeAll();
    this.#loanCollection.unsubscribeAll();

    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await Promise.all([
      this.#materielCollection.clearLocal(),
      this.#loanCollection.clearLocal(),
    ]);

    // Reset state
    this.#raw = { materiels: [], loans: [] };
    this.#realtimeInitialized = false;
    this.#isInitialized = false;
    this.#loading = false;
    this.#error = null;
    console.log("[MaterielStore] Store détruit");
  }
}

// Singleton
export const materielStore = new MaterielStore();

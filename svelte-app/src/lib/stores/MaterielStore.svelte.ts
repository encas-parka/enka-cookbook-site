import { Permission, Role } from "appwrite";
import type { Materiel, MaterielLoan } from "$lib/types/appwrite";
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
  reEnrichMaterielFromLoans,
  parseLoanItemsFromAppwrite,
  calculateLoanedQuantityForPeriod,
} from "$lib/utils/materiel.utils";
import { materielTypeLabels } from "$lib/utils/share-utils";
import { globalState } from "./GlobalState.svelte";
import { nativeTeamsStore } from "./NativeTeamsStore.svelte";
import { eventMaterielStore } from "./EventMaterielStore.svelte";
import {
  createSyncCollection,
  bridgeToMap,
  db,
} from "$lib/db-sync/aw-sync";

export class MaterielStore {
  // aw-sync collections
  #materielCollection = createSyncCollection<Materiel>({
    table: db.materiels,
    collectionName: "materiel",
  });

  #loanCollection = createSyncCollection<MaterielLoan>({
    table: db.materielLoans,
    collectionName: "materiel_loan",
  });

  // Bridges (liveQuery → SvelteMap)
  #materielBridge = bridgeToMap<Materiel>(() => db.materiels.toArray());
  #loanBridge = bridgeToMap<MaterielLoan>(() => db.materielLoans.toArray());

  // Raw data maps
  #materielsMap = this.#materielBridge.map;
  #loansMap = this.#loanBridge.map;

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
    return this.#materielsMap.size;
  }

  // =============================================================================
  // ENRICHED DERIVED DATA
  // =============================================================================

  /** Raw materiels list from Dexie */
  #rawMaterielsList = $derived(Array.from(this.#materielsMap.values()));

  /** Raw loans list from Dexie */
  #rawLoansList = $derived(Array.from(this.#loansMap.values()));

  /** All loans enriched with parsed materielItems */
  #enrichedLoans = $derived.by(() => {
    const result = new Map<string, EnrichedMaterielLoan>();
    for (const loan of this.#rawLoansList) {
      result.set(loan.$id, enrichLoanFromAppwrite(loan));
    }
    return result;
  });

  /** All materiels enriched with loan data */
  #enrichedMateriels = $derived.by(() => {
    const allLoans = this.#rawLoansList;
    const result = new Map<string, EnrichedMateriel>();
    for (const doc of this.#rawMaterielsList) {
      result.set(doc.$id, enrichMaterielFromAppwrite(doc, allLoans));
    }
    return result;
  });

  // Public reactive lists
  get materiels() {
    return Array.from(this.#enrichedMateriels.values());
  }

  get loans() {
    return Array.from(this.#enrichedLoans.values());
  }

  // Matériels des équipes de l'utilisateur
  #teamMaterielsList = $derived.by(() => {
    if (!globalState.userId) return [];
    const myTeamIds = nativeTeamsStore.myTeams.map((t) => t.$id);
    return Array.from(this.#enrichedMateriels.values()).filter(
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
    return Array.from(this.#enrichedMateriels.values()).filter((m) => {
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
    return Array.from(this.#enrichedMateriels.values()).filter(
      (m) => m.isAvailable,
    );
  });
  get availableMateriels() {
    return this.#availableMaterielsList;
  }

  // =============================================================================
  // FILTRAGE PAR OWNER
  // =============================================================================

  getAvailableMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return this.#availableMaterielsList.filter(
      (m) =>
        m.ownerData?.teamId === teamId &&
        m.status !== "lost" &&
        m.status !== "torepair",
    );
  }

  getMaterielsByOwner(teamId: string): EnrichedMateriel[] {
    return Array.from(this.#enrichedMateriels.values()).filter(
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
    const allLoans = this.#rawLoansList;

    return Array.from(this.#enrichedMateriels.values())
      .filter((m) => m.ownerData?.teamId === teamId)
      .filter((m) => m.status !== "lost" && m.status !== "torepair")
      .map((materiel) => {
        const loanedQuantity = calculateLoanedQuantityForPeriod(
          materiel.$id,
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

      console.log(
        `[MaterielStore] Sync terminé : ${this.#materielsMap.size} matériels, ${this.#loansMap.size} emprunts`,
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
    return this.#enrichedMateriels.get(materielId);
  }

  getLoanById(loanId: string): EnrichedMaterielLoan | undefined {
    return this.#enrichedLoans.get(loanId);
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

      // Permissions
      const permissions = [
        Permission.read(Role.user(globalState.userId)),
        Permission.update(Role.user(globalState.userId)),
      ];
      if (ownerData.teamId) {
        permissions.push(
          Permission.read(Role.team(ownerData.teamId)),
          Permission.update(Role.team(ownerData.teamId)),
        );
      } else if (ownerData.userId) {
        permissions.push(
          Permission.read(Role.user(ownerData.userId)),
          Permission.update(Role.user(ownerData.userId)),
        );
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
        } as Omit<Materiel, "$id" | "$createdAt" | "$updatedAt">,
        permissions,
      );

      // Return enriched (will also update via liveQuery)
      return enrichMaterielFromAppwrite(doc, this.#rawLoansList);
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
      await this.#materielCollection.remove(materielId);
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

      const permissions = [
        Permission.read(Role.user(globalState.userId)),
        Permission.update(Role.user(globalState.userId)),
        Permission.read(Role.team(data.ownerId)),
        Permission.update(Role.team(data.ownerId)),
      ];

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
        } as Omit<MaterielLoan, "$id" | "$createdAt" | "$updatedAt">,
        permissions,
      );

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
      const currentLoan = this.#enrichedLoans.get(loanId);
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
    const loan = this.#enrichedLoans.get(loanId);
    if (loan?.eventId) {
      await eventMaterielStore.removeByLoan(loanId);
    }
    await this.updateLoan(loanId, { status: "refused" });
  }

  async cancelLoan(loanId: string): Promise<void> {
    const loan = this.#enrichedLoans.get(loanId);
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
      const loan = this.#enrichedLoans.get(loanId);
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
    const loan = this.#enrichedLoans.get(loanId);
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
      const m = this.#enrichedMateriels.get(item.materielId);
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
    // Unsubscribe bridges en premier pour arrêter les liveQuery Dexie
    this.#materielBridge.subscription.unsubscribe();
    this.#loanBridge.subscription.unsubscribe();
    this.#materielCollection.unsubscribeAll();
    this.#loanCollection.unsubscribeAll();
    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await Promise.all([
      this.#materielCollection.clearLocal(),
      this.#loanCollection.clearLocal(),
    ]);
    this.#realtimeInitialized = false;
    this.#isInitialized = false;
    this.#loading = false;
    this.#error = null;
    console.log("[MaterielStore] Store détruit");
  }
}

// Singleton
export const materielStore = new MaterielStore();

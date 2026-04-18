/**
 * EventMaterielStore - Store réactif pour le matériel événement
 *
 * Gère les items de matériel nécessaire pour un événement.
 * Charge les données par eventId (pas en global), comme ProductsStore.
 *
 * Architecture :
 * - Dexie table `eventMateriels` (persistance offline)
 * - aw-sync collection (delta sync + realtime)
 * - bridgeToMapFiltered scoped par eventId (réactivité fine)
 * - CRUD via aw-sync (optimistic writes + rollback)
 */

import { Permission, Role } from "appwrite";
import type { EventMateriel } from "$lib/types/appwrite";
import type {
  CreateEventMaterielData,
  UpdateEventMaterielData,
  EventMaterielFilters,
  EventMaterielSort,
  EventMaterielType,
  EventMaterielStatus,
  MaterielGroup,
} from "$lib/types/event-materiel.types";
import type { MaterielLoanItem } from "$lib/types/materiel.types";
import {
  listEventMaterielByLoan,
} from "$lib/services/appwrite-event-materiel";
import { materielTypeLabels } from "$lib/utils/share-utils";
import { globalState } from "./GlobalState.svelte";
import { materielStore } from "./MaterielStore.svelte";
import {
  createSyncCollection,
  bridgeToMapFiltered,
  db,
  type BridgeResult,
} from "$lib/db-sync/aw-sync";

export class EventMaterielStore {
  // aw-sync collection (CRUD + sync)
  #collection = createSyncCollection<EventMateriel>({
    table: db.eventMateriels,
    collectionName: "event_materiel",
  });

  // Bridge scoped dynamiquement par eventId
  #bridge: BridgeResult<EventMateriel> | null = null;
  #items = $state<Map<string, EventMateriel>>(new Map());

  // État réactif
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeInitialized = false;
  #currentEventId: string | null = null;

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
    return this.#items.size;
  }

  // Propriétés réactives ($derived)
  #itemsList = $derived(Array.from(this.#items.values()));
  get items() {
    return this.#itemsList;
  }

  // =============================================================================
  // VALEURS UNIQUES POUR LES FILTRES
  // =============================================================================

  getUniqueWhereValues(): string[] {
    const values = new Set<string>();
    this.#itemsList.forEach((item) => {
      if (item.where && item.where.trim()) {
        values.add(item.where.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }

  getUniqueWhoValues(): string[] {
    const values = new Set<string>();
    this.#itemsList.forEach((item) => {
      if (item.who && item.who.trim()) {
        values.add(item.who.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }

  // =============================================================================
  // INITIALISATION PAR EVENT
  // =============================================================================

  async initializeForEvent(eventId: string): Promise<void> {
    // Si déjà chargé pour le même event, ne pas recharger
    if (this.#currentEventId === eventId && this.#isInitialized) {
      console.log(
        `[EventMaterielStore] Déjà initialisé pour event ${eventId}`,
      );
      return;
    }

    // Si on change d'event, détruire le bridge précédent
    if (this.#bridge) {
      this.#bridge.subscription.unsubscribe();
      this.#bridge = null;
    this.#items = new Map();
    }

    this.#loading = true;
    this.#error = null;

    try {
      this.#currentEventId = eventId;

      // Phase 1+2: Bridge + Sync via aw-sync
      this.#bridge = bridgeToMapFiltered(db.eventMateriels, (t) =>
        t.where("eventId").equals(eventId).toArray(),
      );
      this.#items = this.#bridge.map;

      await this.#collection.initialFetch({
        queries: [],
      });

      // Phase 3: Realtime
      if (globalState.isAuthenticated && !this.#realtimeInitialized) {
        this.#collection.subscribe();
        this.#isRealtimeActive = true;
        this.#realtimeInitialized = true;
      }

      this.#isInitialized = true;
      console.log(
        `[EventMaterielStore] Initialisé pour event ${eventId}: ${this.#items.size} items`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur d'initialisation";
      console.error("[EventMaterielStore] InitializeForEvent error:", err);
    } finally {
      this.#loading = false;
    }
  }

  // =============================================================================
  // API PUBLIQUE - CRUD
  // =============================================================================

  async addItem(
    data: CreateEventMaterielData,
    userId: string,
  ): Promise<EventMateriel> {
    this.#loading = true;
    this.#error = null;

    try {
      const item = await this.#collection.create(
        {
          eventId: data.eventId,
          name: data.name,
          quantity: data.quantity,
          type: data.type || "other",
          who: data.who || null,
          where: data.where || null,
          fromTeamName: data.fromTeamName || null,
          sourceMaterielId: data.sourceMaterielId || null,
          loanId: data.loanId || null,
          status: data.status || "to_find",
          groupId: data.groupId || null,
          notes: data.notes || null,
          createdBy: userId,
        } as Omit<EventMateriel, "$id" | "$createdAt" | "$updatedAt">,
        [
          Permission.read(Role.label(data.eventId)),
          Permission.update(Role.label(data.eventId)),
          Permission.delete(Role.label(data.eventId)),
        ],
      );

      return item;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async addHeaderWithAllocation(
    headerData: {
      eventId: string;
      name: string;
      quantity: number;
      type: EventMaterielType;
      notes?: string | null;
    },
    allocationData: {
      status: EventMaterielStatus;
      who?: string | null;
      where?: string | null;
      fromTeamName?: string | null;
      sourceMaterielId?: string | null;
      loanId?: string | null;
      notes?: string | null;
    },
    userId: string,
  ): Promise<{ header: EventMateriel; allocation: EventMateriel }> {
    this.#loading = true;
    this.#error = null;

    try {
      const header = await this.addItem(
        {
          eventId: headerData.eventId,
          name: headerData.name,
          quantity: headerData.quantity,
          type: headerData.type,
          status: "to_find",
          groupId: null,
          notes: headerData.notes || null,
        },
        userId,
      );

      const allocation = await this.addItem(
        {
          eventId: headerData.eventId,
          name: headerData.name,
          quantity: headerData.quantity,
          type: headerData.type,
          status: allocationData.status,
          groupId: header.$id,
          who: allocationData.who || null,
          where: allocationData.where || null,
          fromTeamName: allocationData.fromTeamName || null,
          sourceMaterielId: allocationData.sourceMaterielId || null,
          loanId: allocationData.loanId || null,
          notes: allocationData.notes || null,
        },
        userId,
      );

      return { header, allocation };
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async updateItem(
    itemId: string,
    data: UpdateEventMaterielData,
  ): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      await this.#collection.update(itemId, data as Partial<EventMateriel>);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      await this.#collection.remove(itemId);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  // =============================================================================
  // UTILITAIRE STATUS
  // =============================================================================

  resolveStatus(item: EventMateriel): EventMaterielStatus {
    const s = item.status as string;
    if (s === "to_find" || s === "to_check" || s === "confirmed") {
      return s as EventMaterielStatus;
    }
    // Migration : anciens items sans status → déduit de where
    return item.where && item.where.trim().length > 0 ? "confirmed" : "to_find";
  }

  // =============================================================================
  // FILTRAGE ET TRI
  // =============================================================================

  getFilteredItems(
    filters: EventMaterielFilters,
    sort: EventMaterielSort,
  ): EventMateriel[] {
    let result = [...this.#itemsList];

    // Filtre par types
    if (filters.types?.length) {
      result = result.filter((item) =>
        filters.types!.includes(item.type as EventMaterielType),
      );
    }

    // Filtre par statuts
    if (filters.statuses?.length) {
      result = result.filter((item) =>
        filters.statuses!.includes(this.resolveStatus(item)),
      );
    }

    // Filtre par qui (who)
    if (filters.who?.length) {
      result = result.filter((item) => {
        if (filters.who!.includes("__none__") && !item.who) {
          return true;
        }
        return filters.who!.some((w) => w !== "__none__" && item.who === w);
      });
    }

    // Filtre par où (where)
    if (filters.where?.length) {
      result = result.filter((item) => {
        if (filters.where!.includes("__none__") && !item.where) {
          return true;
        }
        return filters.where!.some((w) => w !== "__none__" && item.where === w);
      });
    }

    // Recherche globale
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(search) ||
          item.who?.toLowerCase().includes(search) ||
          item.where?.toLowerCase().includes(search) ||
          item.notes?.toLowerCase().includes(search),
      );
    }

    // Tri
    result.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          if (cmp === 0) {
            cmp = (a.name || "").localeCompare(b.name || "");
          }
          break;
        case "status":
          cmp = this.resolveStatus(a).localeCompare(this.resolveStatus(b));
          break;
        case "who":
          cmp = (a.who || "").localeCompare(b.who || "");
          break;
        case "where":
          cmp = (a.where || "").localeCompare(b.where || "");
          if (cmp === 0) {
            cmp = (a.name || "").localeCompare(b.name || "");
          }
          break;
      }
      return sort.direction === "desc" ? -cmp : cmp;
    });

    return result;
  }

  // =============================================================================
  // STATS
  // =============================================================================

  getItemsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.#itemsList.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    return counts;
  }

  // =============================================================================
  // REGROUPEMENT (BESOIN + ALLOCATIONS)
  // =============================================================================

  get headers(): EventMateriel[] {
    return this.#itemsList.filter(
      (item) => !item.groupId && this.resolveStatus(item) === "to_find",
    );
  }

  getAllocationsForHeader(headerId: string): EventMateriel[] {
    return this.#itemsList.filter((item) => item.groupId === headerId);
  }

  getRemainingQuantity(headerId: string): number {
    const header = this.#items?.get(headerId);
    if (!header) return 0;
    const allocated = this.getAllocationsForHeader(headerId).reduce(
      (sum, a) => sum + (a.quantity || 0),
      0,
    );
    return (header.quantity || 0) - allocated;
  }

  getGroupedItems(
    filters: EventMaterielFilters,
    sort: EventMaterielSort,
  ): MaterielGroup[] {
    const filtered = this.getFilteredItems(filters, sort);

    const headerMap = new Map<string, EventMateriel>();
    const allocationsByHeader = new Map<string, EventMateriel[]>();
    const standalone: EventMateriel[] = [];

    for (const item of filtered) {
      if (item.groupId) {
        if (!allocationsByHeader.has(item.groupId)) {
          allocationsByHeader.set(item.groupId, []);
        }
        allocationsByHeader.get(item.groupId)!.push(item);
      } else if (this.resolveStatus(item) === "to_find") {
        headerMap.set(item.$id, item);
      } else {
        standalone.push(item);
      }
    }

    const groups: MaterielGroup[] = [];

    for (const [headerId, header] of headerMap) {
      const allocations = allocationsByHeader.get(headerId) || [];
      const totalAllocated = allocations.reduce(
        (sum, a) => sum + (a.quantity || 0),
        0,
      );
      groups.push({
        header,
        allocations,
        remainingQty: (header.quantity || 0) - totalAllocated,
        totalAllocated,
      });
    }

    for (const item of standalone) {
      const allocations = allocationsByHeader.get(item.$id) || [];
      if (allocations.length > 0) {
        const totalAllocated = allocations.reduce(
          (sum, a) => sum + (a.quantity || 0),
          0,
        );
        groups.push({
          header: item,
          allocations,
          remainingQty: (item.quantity || 0) - totalAllocated,
          totalAllocated,
        });
      } else {
        groups.push({
          header: item,
          allocations: [],
          remainingQty: 0,
          totalAllocated: item.quantity || 0,
        });
      }
    }

    return groups;
  }

  findMatchingHeader(name: string): EventMateriel | null {
    const normalizedSearch = name.toLowerCase().trim();
    let bestMatch: EventMateriel | null = null;
    let bestScore = 0;

    for (const header of this.headers) {
      const headerName = (header.name || "").toLowerCase().trim();
      if (!headerName) continue;

      let score = 0;
      if (headerName === normalizedSearch) {
        score = 100;
      } else if (headerName.includes(normalizedSearch)) {
        score = 80;
      } else if (normalizedSearch.includes(headerName)) {
        score = 70;
      } else {
        const searchWords = normalizedSearch.split(/\s+/);
        const headerWords = headerName.split(/\s+/);
        const overlap = searchWords.filter((w) =>
          headerWords.some((hw) => hw.includes(w) || w.includes(hw)),
        );
        score =
          (overlap.length /
            Math.max(searchWords.length, headerWords.length)) *
          60;
      }

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = header;
      }
    }

    return bestMatch;
  }

  getUniqueStatusValues(): EventMaterielStatus[] {
    const values = new Set<EventMaterielStatus>();
    this.#itemsList.forEach((item) => {
      values.add(this.resolveStatus(item));
    });
    return Array.from(values).sort();
  }

  async linkToHeader(itemId: string, headerId: string | null): Promise<void> {
    await this.updateItem(itemId, { groupId: headerId });
  }

  getAvailableHeadersForLink(excludeItemId?: string): EventMateriel[] {
    return this.headers.filter((h) => h.$id !== excludeItemId);
  }

  // =============================================================================
  // SYNC DEPUIS LOAN (MatérielLoan → EventMateriel)
  // =============================================================================

  async syncFromLoan(
    loanId: string,
    eventId: string,
    materiels: MaterielLoanItem[],
    responsibleName: string,
    ownerName: string,
    userId: string,
  ): Promise<void> {
    try {
      const existingItems = await listEventMaterielByLoan(loanId);

      const existingByMaterielId = new Map<
        string,
        (typeof existingItems)[0]
      >();
      for (const item of existingItems) {
        if (item.sourceMaterielId) {
          existingByMaterielId.set(item.sourceMaterielId, item);
        }
      }

      const processedIds = new Set<string>();

      for (const loanItem of materiels) {
        processedIds.add(loanItem.materielId);
        const existing = existingByMaterielId.get(loanItem.materielId);

        if (existing) {
          if (existing.quantity !== loanItem.quantity) {
            await this.#collection.update(existing.$id, {
              quantity: loanItem.quantity,
            } as Partial<EventMateriel>);
          }
        } else {
          const sourceMateriel = materielStore.getMaterielById(
            loanItem.materielId,
          );
          const type = (sourceMateriel?.type || "other") as EventMaterielType;
          const location = sourceMateriel?.location || null;

          const matchingHeader = this.findMatchingHeader(loanItem.materielName);

          if (matchingHeader) {
            await this.addItem(
              {
                eventId,
                name: loanItem.materielName,
                quantity: loanItem.quantity,
                type,
                status: "confirmed",
                groupId: matchingHeader.$id,
                who: responsibleName,
                where: location,
                fromTeamName: ownerName,
                sourceMaterielId: loanItem.materielId,
                loanId,
              },
              userId,
            );
          } else {
            await this.addHeaderWithAllocation(
              {
                eventId,
                name: loanItem.materielName,
                quantity: loanItem.quantity,
                type,
              },
              {
                status: "confirmed",
                who: responsibleName,
                where: location,
                fromTeamName: ownerName,
                sourceMaterielId: loanItem.materielId,
                loanId,
              },
              userId,
            );
          }
        }
      }

      for (const [materielId, existing] of existingByMaterielId) {
        if (!processedIds.has(materielId)) {
          await this.#collection.remove(existing.$id);
        }
      }

      console.log(
        `[EventMaterielStore] syncFromLoan: ${loanId} → event ${eventId}, ${materiels.length} items`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] syncFromLoan error:", err);
      throw err;
    }
  }

  async removeByLoan(loanId: string): Promise<void> {
    try {
      const existingItems = await listEventMaterielByLoan(loanId);

      for (const item of existingItems) {
        await this.#collection.remove(item.$id);
      }

      console.log(
        `[EventMaterielStore] removeByLoan: ${loanId}, ${existingItems.length} items supprimés`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] removeByLoan error:", err);
      throw err;
    }
  }

  async removeByLoanAndEvent(loanId: string, eventId: string): Promise<void> {
    try {
      const existingItems = await listEventMaterielByLoan(loanId);
      const toDelete = existingItems.filter(
        (item) => item.eventId === eventId,
      );

      for (const item of toDelete) {
        await this.#collection.remove(item.$id);
      }

      console.log(
        `[EventMaterielStore] removeByLoanAndEvent: loan ${loanId}, event ${eventId}, ${toDelete.length} items supprimés`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] removeByLoanAndEvent error:", err);
      throw err;
    }
  }

  async deleteItemAndRemoveFromLoan(itemId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const item = this.#items?.get(itemId);
      if (!item) {
        throw new Error("Item introuvable");
      }

      const loanId = item.loanId;
      const sourceMaterielId = item.sourceMaterielId;

      await this.#collection.remove(itemId);

      if (loanId && sourceMaterielId) {
        const loan = materielStore.getLoanById(loanId);
        if (loan && loan.materielItems.length > 0) {
          const updatedItems = loan.materielItems.filter(
            (li) => li.materielId !== sourceMaterielId,
          );
          await materielStore.updateLoan(loanId, {
            materiels: updatedItems,
          });
        }
      }

      console.log(
        `[EventMaterielStore] deleteItemAndRemoveFromLoan: ${itemId}${loanId ? ` (loan ${loanId} updated)` : ""}`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  exportToMarkdown(eventName: string, items?: EventMateriel[]): string {
    const lines: string[] = [];
    const exportItems = items ?? this.#itemsList;

    if (exportItems.length === 0) return "";

    lines.push("---");
    lines.push(`# Matériel : ${eventName}`);
    lines.push("");

    const byType = new Map<string, typeof exportItems>();
    for (const item of exportItems) {
      const label = materielTypeLabels[item.type] ?? "Autre";
      if (!byType.has(label)) byType.set(label, []);
      byType.get(label)!.push(item);
    }

    for (const [typeLabel, typeItems] of byType) {
      lines.push(`## ${typeLabel}`);
      lines.push("");
      for (const item of typeItems) {
        let line = `- ${item.name} × ${item.quantity}`;
        const meta: string[] = [];
        if (item.who) meta.push(item.who);
        if (item.where) meta.push(item.where);
        if (meta.length > 0) line += ` (${meta.join(" — ")})`;
        lines.push(line);
        if (item.notes) {
          for (const noteLine of item.notes.split("\n")) {
            lines.push(`> ${noteLine}`);
          }
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  destroy(): void {
    this.#collection.unsubscribeAll();
    this.#collection.clearLocal().catch((err) =>
      console.warn("[EventMaterielStore] Error clearing local data:", err),
    );
    if (this.#bridge) {
      this.#bridge.subscription.unsubscribe();
      this.#bridge = null;
    }
    this.#items = new Map();
    this.#currentEventId = null;
    this.#isInitialized = false;
    this.#isRealtimeActive = false;
    this.#realtimeInitialized = false;
    this.#loading = false;
    this.#error = null;
    console.log("[EventMaterielStore] Store détruit");
  }
}

// Singleton
export const eventMaterielStore = new EventMaterielStore();

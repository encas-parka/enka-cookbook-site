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
import { getMaterielTypeConfig } from "$lib/utils/materiel.utils";
import {
  exportMaterielToCsv,
  formatAllocations,
} from "$lib/utils/materiel-csv-export";
import { globalState } from "./GlobalState.svelte";
import { materielStore } from "./MaterielStore.svelte";
import {
  createSyncCollection,
  bridgeToMapFiltered,
  db,
  pb,
  type BridgeResult,
} from "$lib/db-sync/pb-sync";

/**
 * Formatte un apport inline : "jean x12", "marie (lieu1) x2", "(lieu3) x5"
 */
function formatAllocInline(
  qty: number,
  who?: string | null,
  where?: string | null,
): string {
  const whoStr = who?.trim() || "";
  const whereStr = where?.trim() || "";
  if (whoStr && whereStr) return `${whoStr} (${whereStr}) x${qty}`;
  if (whoStr) return `${whoStr} x${qty}`;
  if (whereStr) return `(${whereStr}) x${qty}`;
  return `x${qty}`;
}

/**
 * Agrège une liste d'apports en une ligne inline.
 * Ex: "jean x12, marie (lieu1) x2"
 */
function formatAllocsInline(allocs: EventMateriel[]): string {
  return allocs
    .map((a) => formatAllocInline(a.quantity ?? 0, a.who, a.where))
    .join(", ");
}

export class EventMaterielStore {
  // pb-sync collection (CRUD + sync)
  #collection = createSyncCollection<EventMateriel>(pb, db.eventMateriels, "event_materiel");

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
      console.log(`[EventMaterielStore] Déjà initialisé pour event ${eventId}`);
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
        filter: ['eventId = {:eventId}', { eventId }],
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
      // Invariant : une allocation (avec groupId) ne peut pas avoir le statut "to_find"
      const status: EventMaterielStatus =
        data.groupId && data.status === "to_find"
          ? "to_check"
          : (data.status as EventMaterielStatus) || "to_find";

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
          status,
          groupId: data.groupId || null,
          notes: data.notes || null,
          createdBy: userId,
        } as Omit<EventMateriel, "id" | "created" | "updated">,
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

    let header: EventMateriel | undefined;
    try {
      header = await this.addItem(
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
          groupId: header.id,
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
      // Si le header a été créé mais l'allocation a échoué, nettoyer le header orphelin
      if (header?.id) {
        try {
          await this.#collection.remove(header.id);
        } catch {
          // Meilleur effort — ne pas masquer l'erreur originale
        }
      }
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

  /**
   * Vérifie si un item individuel matche les filtres donnés.
   * Utilisé pour le filtrage au niveau groupe.
   */
  #itemMatchesFilters(
    item: EventMateriel,
    filters: EventMaterielFilters,
  ): boolean {
    // Filtre par types
    if (filters.types?.length) {
      if (!filters.types.includes(item.type as EventMaterielType)) return false;
    }

    // Filtre par statuts
    if (filters.statuses?.length) {
      if (!filters.statuses.includes(this.resolveStatus(item))) return false;
    }

    // Filtre par qui (who)
    if (filters.who?.length) {
      const matchesWho =
        (filters.who.includes("__none__") && !item.who) ||
        filters.who.some((w) => w !== "__none__" && item.who === w);
      if (!matchesWho) return false;
    }

    // Filtre par où (where)
    if (filters.where?.length) {
      const matchesWhere =
        (filters.where.includes("__none__") && !item.where) ||
        filters.where.some((w) => w !== "__none__" && item.where === w);
      if (!matchesWhere) return false;
    }

    // Recherche globale
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesSearch =
        (item.name || "").toLowerCase().includes(search) ||
        item.who?.toLowerCase().includes(search) ||
        item.where?.toLowerCase().includes(search) ||
        item.notes?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    return true;
  }

  /**
   * Vérifie si des filtres sont actifs (au moins un critère renseigné).
   */
  #hasActiveFilters(filters: EventMaterielFilters): boolean {
    return (
      (filters.types?.length ?? 0) > 0 ||
      (filters.statuses?.length ?? 0) > 0 ||
      (filters.who?.length ?? 0) > 0 ||
      (filters.where?.length ?? 0) > 0 ||
      !!filters.search
    );
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
    return this.#itemsList.filter((item) => !item.groupId);
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
    const allItems = this.#itemsList;
    const hasFilters = this.#hasActiveFilters(filters);

    // Étape 1 : Classification binaire — tout item est soit header, soit allocation
    // Header : groupId === null (indépendamment du statut)
    // Allocation : groupId !== null
    const headerMap = new Map<string, EventMateriel>();
    const allocationsByHeader = new Map<string, EventMateriel[]>();

    for (const item of allItems) {
      if (item.groupId) {
        // Allocation : item lié à un header
        if (!allocationsByHeader.has(item.groupId)) {
          allocationsByHeader.set(item.groupId, []);
        }
        allocationsByHeader.get(item.groupId)!.push(item);
      } else {
        // Header : tout item sans groupId
        headerMap.set(item.id, item);
      }
    }

    const allGroups: MaterielGroup[] = [];

    for (const [headerId, header] of headerMap) {
      const allocations = allocationsByHeader.get(headerId) || [];
      const totalAllocated = allocations.reduce(
        (sum, a) => sum + (a.quantity || 0),
        0,
      );
      allGroups.push({
        header,
        allocations,
        remainingQty: (header.quantity || 0) - totalAllocated,
        totalAllocated,
      });
    }

    // Allocations orphelines : groupId pointe vers un header introuvable
    // (ex: header supprimé) → on les ignore dans le regroupement
    // Elles resteront visibles dans les filtres si elles matchent

    // Étape 2 : Filtrer au niveau groupe
    // Un groupe est affiché si son header OU au moins une allocation matche les filtres
    let filteredGroups = allGroups;
    if (hasFilters) {
      filteredGroups = allGroups.filter((group) => {
        if (this.#itemMatchesFilters(group.header, filters)) return true;
        return group.allocations.some((a) =>
          this.#itemMatchesFilters(a, filters),
        );
      });
    }

    // Étape 3 : Trier les groupes
    filteredGroups.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "name":
          cmp = (a.header.name || "").localeCompare(b.header.name || "");
          break;
        case "type":
          cmp = a.header.type.localeCompare(b.header.type);
          if (cmp === 0) {
            cmp = (a.header.name || "").localeCompare(b.header.name || "");
          }
          break;
        case "status":
          cmp = this.resolveStatus(a.header).localeCompare(
            this.resolveStatus(b.header),
          );
          break;
        case "who":
          cmp = (a.header.who || "").localeCompare(b.header.who || "");
          break;
        case "where":
          cmp = (a.header.where || "").localeCompare(b.header.where || "");
          if (cmp === 0) {
            cmp = (a.header.name || "").localeCompare(b.header.name || "");
          }
          break;
      }
      return sort.direction === "desc" ? -cmp : cmp;
    });

    return filteredGroups;
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
          (overlap.length / Math.max(searchWords.length, headerWords.length)) *
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
    const updateData: UpdateEventMaterielData = { groupId: headerId };

    // Invariant : quand on attache à un header, le statut ne peut pas être "to_find"
    if (headerId) {
      const item = this.#items?.get(itemId);
      if (item && this.resolveStatus(item) === "to_find") {
        updateData.status = "to_check";
      }
    }

    await this.updateItem(itemId, updateData);
  }

  /**
   * Rattache une allocation à un nouveau header et nettoie l'ancien header
   * s'il se retrouve vide (0 allocations) et que sa quantité correspond
   * à celle de l'allocation déplacée (→ header probablement auto-créé par syncFromLoan).
   */
  async reattachAndCleanup(
    itemId: string,
    newHeaderId: string,
  ): Promise<
    { orphanDeleted: false } | { orphanDeleted: true; orphanName: string }
  > {
    // Capturer l'état avant le déplacement
    const item = this.#items?.get(itemId);
    if (!item || !item.groupId) {
      // Pas une allocation ou item introuvable → link simple
      await this.linkToHeader(itemId, newHeaderId);
      return { orphanDeleted: false };
    }

    const oldHeaderId = item.groupId;
    const allocationQty = item.quantity ?? 0;
    const oldHeader = this.#items?.get(oldHeaderId);

    // Effectuer le rattachement
    await this.linkToHeader(itemId, newHeaderId);

    // Re-vérifier après le link : un événement realtime a pu ajouter une allocation
    // au vieux header entre le moment où on a capturé l'état et maintenant
    const remainingAllocations = this.#itemsList.filter(
      (i) => i.groupId === oldHeaderId,
    ).length;

    // Nettoyage : header vide + quantités identiques → suppression automatique
    if (
      remainingAllocations === 0 &&
      oldHeader &&
      (oldHeader.quantity ?? 0) === allocationQty
    ) {
      await this.deleteItem(oldHeaderId);
      return { orphanDeleted: true, orphanName: oldHeader.name || "Sans nom" };
    }

    return { orphanDeleted: false };
  }

  getAvailableHeadersForLink(excludeItemId?: string): EventMateriel[] {
    return this.headers.filter((h) => h.id !== excludeItemId);
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
      const existingItems = Array.from(this.#items.values()).filter(
        item => item.loanId === loanId
      );

      const existingByMaterielId = new Map<string, (typeof existingItems)[0]>();
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
            await this.#collection.update(existing.id, {
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
                groupId: matchingHeader.id,
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
          await this.#collection.remove(existing.id);
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
      const existingItems = Array.from(this.#items.values()).filter(
        item => item.loanId === loanId
      );

      for (const item of existingItems) {
        await this.#collection.remove(item.id);
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
      const existingItems = Array.from(this.#items.values()).filter(
        item => item.loanId === loanId
      );
      const toDelete = existingItems.filter((item) => item.eventId === eventId);

      for (const item of toDelete) {
        await this.#collection.remove(item.id);
      }

      console.log(
        `[EventMaterielStore] removeByLoanAndEvent: loan ${loanId}, event ${eventId}, ${toDelete.length} items supprimés`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] removeByLoanAndEvent error:", err);
      throw err;
    }
  }

  /**
   * Supprime un item et, si lié à un loan, retire la ligne correspondante du loan.
   * Si l'item est un header (pas de groupId), cascade-supprime toutes ses allocations
   * (chacune avec mise à jour du loan si nécessaire).
   */
  async deleteItemAndRemoveFromLoan(itemId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const item = this.#items?.get(itemId);
      if (!item) {
        throw new Error("Item introuvable");
      }

      // Si c'est un header, cascade-supprimer toutes ses allocations d'abord
      let allocationCount = 0;
      if (!item.groupId) {
        const allocations = this.#itemsList.filter((i) => i.groupId === itemId);
        allocationCount = allocations.length;
        for (const allocation of allocations) {
          await this.#removeItemAndUpdateLoan(allocation);
        }
      }

      // Supprimer l'item lui-même
      await this.#removeItemAndUpdateLoan(item);

      console.log(
        `[EventMaterielStore] deleteItemAndRemoveFromLoan: ${itemId}${allocationCount > 0 ? ` + ${allocationCount} allocations` : ""}${item.loanId ? ` (loan ${item.loanId} updated)` : ""}`,
      );
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Supprime un item de la collection et, s'il est lié à un loan,
   * retire la ligne correspondante du loan.
   */
  async #removeItemAndUpdateLoan(item: EventMateriel): Promise<void> {
    await this.#collection.remove(item.id);

    if (item.loanId && item.sourceMaterielId) {
      const loan = materielStore.getLoanById(item.loanId);
      if (loan && loan.materielItems.length > 0) {
        const updatedItems = loan.materielItems.filter(
          (li) => li.materielId !== item.sourceMaterielId,
        );
        await materielStore.updateLoan(item.loanId, {
          materiels: updatedItems,
        });
      }
    }
  }

  /**
   * Export Markdown indenté : groupes par type, chaque besoin avec ses apports.
   * Format :
   * ## Type
   * - Nom : besoin
   *   -- ok : jean x12, marie (lieu1) x2
   *   -- à vérifier : vanessa (lieu2) x4, lieu3 x5
   *   > notes
   */
  exportToMarkdown(eventName: string, groups: MaterielGroup[]): string {
    if (groups.length === 0) return "";

    const lines: string[] = [];
    lines.push("# Matériel : " + eventName);
    lines.push("");

    // Grouper par type du header
    const byType = new Map<string, MaterielGroup[]>();
    for (const group of groups) {
      const label = getMaterielTypeConfig(group.header.type).label;
      if (!byType.has(label)) byType.set(label, []);
      byType.get(label)!.push(group);
    }

    for (const [typeLabel, typeGroups] of byType) {
      lines.push("## " + typeLabel);
      lines.push("");

      for (const group of typeGroups) {
        const header = group.header;
        const confirmedAllocs = group.allocations.filter(
          (a) => this.resolveStatus(a) === "confirmed",
        );
        const toCheckAllocs = group.allocations.filter(
          (a) => this.resolveStatus(a) === "to_check",
        );

        // Ligne principale : nom + besoin
        lines.push(
          "- " + (header.name || "Sans nom") + " : " + (header.quantity ?? 0),
        );

        // Ok (toujours affiché, inline)
        if (confirmedAllocs.length > 0) {
          lines.push("  -- ok : " + formatAllocsInline(confirmedAllocs));
        } else {
          lines.push("  -- ok : 0");
        }

        // À vérifier (si > 0, inline)
        if (toCheckAllocs.length > 0) {
          lines.push("  -- à vérifier : " + formatAllocsInline(toCheckAllocs));
        }

        // Notes (blockquotes)
        if (header.notes) {
          for (const noteLine of header.notes.split("\n")) {
            lines.push("  > " + noteLine);
          }
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Export CSV groupé par besoin : colonnes Nom, Type, Besoin, Trouvé, À vérifier, Notes.
   */
  exportToCsv(groups: MaterielGroup[]): string {
    if (groups.length === 0) return "";

    const rows = groups.map((group) => {
      const header = group.header;
      const confirmedAllocs = group.allocations.filter(
        (a) => this.resolveStatus(a) === "confirmed",
      );
      const toCheckAllocs = group.allocations.filter(
        (a) => this.resolveStatus(a) === "to_check",
      );

      return {
        name: header.name || "",
        type: getMaterielTypeConfig(header.type).label,
        besoin: header.quantity ?? 0,
        trouve: formatAllocations(
          confirmedAllocs.map((a) => ({
            qty: a.quantity ?? 0,
            who: a.who || "",
            where: a.where || "",
          })),
        ),
        aVerifier: formatAllocations(
          toCheckAllocs.map((a) => ({
            qty: a.quantity ?? 0,
            who: a.who || "",
            where: a.where || "",
          })),
        ),
        notes: header.notes || "",
      };
    });

    return exportMaterielToCsv(rows);
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  async destroy(): Promise<void> {
    this.#collection.unsubscribeAll();
    if (this.#bridge) {
      this.#bridge.subscription.unsubscribe();
      this.#bridge = null;
    }
    // Nettoyer IndexedDB pour éviter les fuites de données entre utilisateurs
    await this.#collection.clearLocal();
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

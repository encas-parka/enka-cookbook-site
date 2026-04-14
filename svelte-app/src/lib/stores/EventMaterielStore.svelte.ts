/**
 * EventMaterielStore - Store réactif pour le matériel événement
 *
 * Gère les items de matériel nécessaire pour un événement.
 * Charge les données par eventId (pas en global), comme ProductsStore.
 *
 * Pattern 3-phase : loadCache → syncFromRemote → setupRealtime
 */

import { SvelteMap } from "svelte/reactivity";
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
import {
  listEventMateriel,
  listEventMaterielByLoan,
  createEventMateriel as createEventMaterielService,
  updateEventMateriel as updateEventMaterielService,
  deleteEventMateriel as deleteEventMaterielService,
  getEventMaterielRealtimeChannels,
} from "$lib/services/appwrite-event-materiel";
import type { MaterielLoanItem } from "$lib/types/materiel.types";
import {
  createEventMaterielIDBCache,
  type EventMaterielIDBCache,
} from "$lib/services/event-materiel-idb-cache";
import { materielTypeLabels } from "$lib/utils/share-utils";
import { globalState } from "./GlobalState.svelte";
import { realtimeManager } from "./RealtimeManager.svelte";

export class EventMaterielStore {
  // État réactif - stocke les items par eventId
  #items = new SvelteMap<string, EventMateriel>();
  #idbCache: EventMaterielIDBCache | null = null;
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #isRealtimeActive = $state(false);
  #realtimeCleanup: (() => void) | null = null;
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

  /**
   * Retourne la liste des valeurs uniques de 'where' triées
   * Inclut option "À trouver" pour les items sans where
   */
  getUniqueWhereValues(): string[] {
    const values = new Set<string>();
    this.#itemsList.forEach((item) => {
      if (item.where && item.where.trim()) {
        values.add(item.where.trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }

  /**
   * Retourne la liste des valeurs uniques de 'who' triées
   * Inclut option "Personne" pour les items sans who
   */
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

  /**
   * Initialise le store pour un événement spécifique
   * Appelé quand l'utilisateur navigue vers /event/:id/materiel
   */
  async initializeForEvent(eventId: string): Promise<void> {
    // Si déjà chargé pour le même event, ne pas recharger
    if (this.#currentEventId === eventId && this.#isInitialized) {
      console.log(`[EventMaterielStore] Déjà initialisé pour event ${eventId}`);
      return;
    }

    // Si on change d'event, vider les données précédentes
    if (this.#currentEventId && this.#currentEventId !== eventId) {
      this.#items.clear();
      this.#currentEventId = null;
      this.#isInitialized = false;
    }

    this.#loading = true;
    this.#error = null;

    try {
      this.#currentEventId = eventId;

      // Phase 1: Cache IDB
      if (!this.#idbCache) {
        this.#idbCache = await createEventMaterielIDBCache();
      }

      await this.#loadFromCache(eventId);

      // Phase 2: Sync Appwrite
      await this.#syncFromAppwrite(eventId);

      // Phase 3: Realtime
      await this.#setupRealtime(eventId);

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

  async #loadFromCache(eventId: string): Promise<void> {
    if (!this.#idbCache) return;

    try {
      const itemsMap = await this.#idbCache.loadItems(eventId);
      itemsMap.forEach((item) => {
        this.#items.set(item.$id, item);
      });

      console.log(
        `[EventMaterielStore] ${itemsMap.size} items chargés du cache IDB`,
      );
    } catch (err) {
      console.warn(
        "[EventMaterielStore] Erreur lecture cache IDB, ignoré:",
        err,
      );
    }
  }

  async #syncFromAppwrite(eventId: string): Promise<void> {
    try {
      const items = await listEventMateriel(eventId);

      // Vider les anciens items de cet event
      const toRemove: string[] = [];
      this.#items.forEach((item) => {
        if (item.eventId === eventId) toRemove.push(item.$id);
      });
      toRemove.forEach((id) => this.#items.delete(id));

      // Ajouter les nouveaux
      for (const item of items) {
        this.#items.set(item.$id, item);
      }

      // Persister dans IDB
      await this.#idbCache?.saveItems(items);

      // Mettre à jour le timestamp
      await this.#idbCache?.saveMetadata(eventId, {
        lastSync: new Date().toISOString(),
      });

      console.log(
        `[EventMaterielStore] Sync terminé: ${items.length} items pour event ${eventId}`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] Erreur sync:", err);
      throw err;
    }
  }

  async #setupRealtime(eventId: string): Promise<void> {
    if (!globalState.isAuthenticated) return;

    // Nettoyage de l'ancien abonnement si on change d'event
    if (this.#realtimeCleanup) {
      this.#realtimeCleanup();
      this.#realtimeCleanup = null;
    }

    try {
      this.#realtimeCleanup = realtimeManager.registerDynamic(
        getEventMaterielRealtimeChannels(),
        async (response: any) => {
          await this.#handleRealtime(response);
        },
      );
      this.#isRealtimeActive = true;
      console.log("[EventMaterielStore] Realtime configuré");
    } catch (err) {
      console.error("[EventMaterielStore] Erreur realtime:", err);
    }
  }

  async #handleRealtime(response: any): Promise<void> {
    try {
      const events = response.events;
      const payload = response.payload as EventMateriel;

      if (!payload) return;

      // Ignorer les items d'autres events
      if (payload.eventId !== this.#currentEventId) return;

      const eventType = events.some((e: string) => e.includes(".create"))
        ? "create"
        : events.some((e: string) => e.includes(".delete"))
          ? "delete"
          : "update";

      console.log(
        `[EventMaterielStore] ⚡️ Realtime: ${eventType} pour ${payload.$id}`,
      );

      if (eventType === "create" || eventType === "update") {
        this.#items.set(payload.$id, payload);
        this.#idbCache?.saveItem(payload);
      } else if (eventType === "delete") {
        this.#items.delete(payload.$id);
        this.#idbCache?.deleteItem(payload.$id);
      }
    } catch (err) {
      console.error("[EventMaterielStore] Erreur realtime:", err);
    }
  }

  // =============================================================================
  // API PUBLIQUE - CRUD
  // =============================================================================

  /**
   * Crée un nouvel item de matériel
   */
  async addItem(
    data: CreateEventMaterielData,
    userId: string,
  ): Promise<EventMateriel> {
    this.#loading = true;
    this.#error = null;

    try {
      const item = await createEventMaterielService(data, userId);
      this.#items.set(item.$id, item);
      this.#idbCache?.saveItem(item);
      return item;
    } catch (err) {
      this.#error = err instanceof Error ? err.message : "Erreur de création";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Met à jour un item
   */
  async updateItem(
    itemId: string,
    data: UpdateEventMaterielData,
  ): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const updated = await updateEventMaterielService(itemId, data);
      this.#items.set(updated.$id, updated);
      this.#idbCache?.saveItem(updated);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de mise à jour";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Supprime un item
   */
  async deleteItem(itemId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      await deleteEventMaterielService(itemId);
      this.#items.delete(itemId);
      this.#idbCache?.deleteItem(itemId);
    } catch (err) {
      this.#error =
        err instanceof Error ? err.message : "Erreur de suppression";
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  // /**
  //  * Change le statut d'un item (cycle: needed → confirmed → brought)
  //  * TODO: supprimer ou adapter si on reintroduit un statut
  //  */
  // async cycleStatus(itemId: string): Promise<void> {
  //   const item = this.#items.get(itemId);
  //   if (!item) return;

  //   const nextStatus: Record<string, EventMaterielStatus> = {
  //     needed: "confirmed",
  //     confirmed: "brought",
  //     brought: "needed",
  //   };

  //   await this.updateItem(itemId, {
  //     status: nextStatus[item.status] || "needed",
  //   } as UpdateEventMaterielData);
  // }

  // =============================================================================
  // UTILITAIRE STATUS
  // =============================================================================

  /**
   * Résout le status d'un item.
   * Pour la migration : les anciens items sans status valide sont déduits de `where`.
   */
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
   * Filtre et trie les items selon les critères donnés
   */
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
        // Si "__none__" est coché, on inclut les items sans who
        if (filters.who!.includes("__none__") && !item.who) {
          return true;
        }
        // Sinon on filtre par who exact
        return filters.who!.some((w) => w !== "__none__" && item.who === w);
      });
    }

    // Filtre par où (where)
    if (filters.where?.length) {
      result = result.filter((item) => {
        // Si "__none__" est coché, on inclut les items sans where
        if (filters.where!.includes("__none__") && !item.where) {
          return true;
        }
        // Sinon on filtre par where exact
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

  // TODO: a supprimer ou adapter - status derive de where
  // getItemsByStatus(): Record<EventMaterielStatus, number> {
  //   const counts: Record<EventMaterielStatus, number> = {
  //     needed: 0,
  //     confirmed: 0,
  //     brought: 0,
  //   };
  //   this.#itemsList.forEach((item) => {
  //     counts[item.status as EventMaterielStatus] =
  //       (counts[item.status as EventMaterielStatus] || 0) + 1;
  //   });
  //   return counts;
  // }

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

  /**
   * Retourne les headers (groupId = null, status to_find)
   */
  get headers(): EventMateriel[] {
    return this.#itemsList.filter(
      (item) => !item.groupId && this.resolveStatus(item) === "to_find",
    );
  }

  /**
   * Retourne les allocations d'un header
   */
  getAllocationsForHeader(headerId: string): EventMateriel[] {
    return this.#itemsList.filter((item) => item.groupId === headerId);
  }

  /**
   * Calcule la quantité restante pour un header
   */
  getRemainingQuantity(headerId: string): number {
    const header = this.#items.get(headerId);
    if (!header) return 0;
    const allocated = this.getAllocationsForHeader(headerId).reduce(
      (sum, a) => sum + (a.quantity || 0),
      0,
    );
    return (header.quantity || 0) - allocated;
  }

  /**
   * Retourne la structure groupée pour l'UI (mode nested)
   */
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

  /**
   * Recherche un header existant par nom (fuzzy match)
   */
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
        score = (overlap.length / Math.max(searchWords.length, headerWords.length)) * 60;
      }

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = header;
      }
    }

    return bestMatch;
  }

  /**
   * Retourne les valeurs uniques de status (résolues) pour les filtres
   */
  getUniqueStatusValues(): EventMaterielStatus[] {
    const values = new Set<EventMaterielStatus>();
    this.#itemsList.forEach((item) => {
      values.add(this.resolveStatus(item));
    });
    return Array.from(values).sort();
  }

  /**
   * Lie un item à un header (allocation) ou délie (groupId = null)
   */
  async linkToHeader(itemId: string, headerId: string | null): Promise<void> {
    await this.updateItem(itemId, { groupId: headerId });
  }

  /**
   * Retourne les headers disponibles pour le linking (excluant l'item lui-même)
   */
  getAvailableHeadersForLink(excludeItemId?: string): EventMateriel[] {
    return this.headers.filter((h) => h.$id !== excludeItemId);
  }

  // =============================================================================
  // SYNC DEPUIS LOAN (MatérielLoan → EventMateriel)
  // =============================================================================

  /**
   * Synchronise les EventMateriel depuis un loan.
   * - Crée les items manquants
   * - Met à jour les quantités si modifiées
   * - Supprime les items retirés du loan
   *
   * @param loanId ID du MaterielLoan
   * @param eventId ID de l'événement cible
   * @param materiels Items du loan (MaterielLoanItem[])
   * @param responsibleName Nom du responsable de la réservation (→ champ `who`)
   * @param ownerName Nom de la team propriétaire (→ champ `fromTeamName`)
   * @param userId ID de l'utilisateur effectuant l'action
   */
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
            const updated = await updateEventMaterielService(existing.$id, {
              quantity: loanItem.quantity,
            });
            if (this.#currentEventId === eventId) {
              this.#items.set(updated.$id, updated);
              this.#idbCache?.saveItem(updated);
            }
          }
        } else {
          const { materielStore } = await import("./MaterielStore.svelte");
          const sourceMateriel = materielStore.getMaterielById(
            loanItem.materielId,
          );
          const type = (sourceMateriel?.type || "other") as EventMaterielType;
          const location = sourceMateriel?.location || null;

          const matchingHeader = this.findMatchingHeader(loanItem.materielName);
          const groupId = matchingHeader?.$id ?? null;

          const created = await createEventMaterielService(
            {
              eventId,
              name: loanItem.materielName,
              quantity: loanItem.quantity,
              type,
              status: "confirmed",
              groupId,
              who: responsibleName,
              where: location,
              fromTeamName: ownerName,
              sourceMaterielId: loanItem.materielId,
              loanId,
            },
            userId,
          );
          if (this.#currentEventId === eventId) {
            this.#items.set(created.$id, created);
            this.#idbCache?.saveItem(created);
          }
        }
      }

      for (const [materielId, existing] of existingByMaterielId) {
        if (!processedIds.has(materielId)) {
          await deleteEventMaterielService(existing.$id);
          if (this.#currentEventId === eventId) {
            this.#items.delete(existing.$id);
            this.#idbCache?.deleteItem(existing.$id);
          }
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

  /**
   * Supprime tous les EventMateriel liés à un loan
   */
  async removeByLoan(loanId: string): Promise<void> {
    try {
      const existingItems = await listEventMaterielByLoan(loanId);

      for (const item of existingItems) {
        await deleteEventMaterielService(item.$id);
        this.#items.delete(item.$id);
        this.#idbCache?.deleteItem(item.$id);
      }

      console.log(
        `[EventMaterielStore] removeByLoan: ${loanId}, ${existingItems.length} items supprimés`,
      );
    } catch (err) {
      console.error("[EventMaterielStore] removeByLoan error:", err);
      throw err;
    }
  }

  /**
   * Supprime les EventMateriel liés à un loan pour un event spécifique
   * Utilisé quand l'event lié change
   */
  async removeByLoanAndEvent(loanId: string, eventId: string): Promise<void> {
    try {
      const existingItems = await listEventMaterielByLoan(loanId);

      const toDelete = existingItems.filter((item) => item.eventId === eventId);

      for (const item of toDelete) {
        await deleteEventMaterielService(item.$id);
        if (this.#currentEventId === eventId) {
          this.#items.delete(item.$id);
          this.#idbCache?.deleteItem(item.$id);
        }
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
   * Supprime un EventMateriel et, s'il vient d'un loan,
   * retire le materiel correspondant du loan
   */
  async deleteItemAndRemoveFromLoan(itemId: string): Promise<void> {
    this.#loading = true;
    this.#error = null;

    try {
      const item = this.#items.get(itemId);
      if (!item) {
        throw new Error("Item introuvable");
      }

      const loanId = item.loanId;
      const sourceMaterielId = item.sourceMaterielId;

      await deleteEventMaterielService(itemId);
      this.#items.delete(itemId);
      this.#idbCache?.deleteItem(itemId);

      if (loanId && sourceMaterielId) {
        const { materielStore } = await import("./MaterielStore.svelte");
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
    const exportItems = items ?? Array.from(this.#items.values());

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
    if (this.#realtimeCleanup) {
      this.#realtimeCleanup();
      this.#realtimeCleanup = null;
    }
    this.#items.clear();
    this.#idbCache?.close();
    this.#idbCache = null;
    this.#currentEventId = null;
    this.#isInitialized = false;
    this.#isRealtimeActive = false;
  }
}

// Singleton
export const eventMaterielStore = new EventMaterielStore();

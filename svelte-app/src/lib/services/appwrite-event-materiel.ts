/**
 * Services d'interaction avec Appwrite Tables - Collection EventMateriel
 *
 * Couche d'accès aux données pure pour la gestion du matériel événement.
 * Suit le même pattern que appwrite-materiel-loan.ts.
 *
 * Services principaux :
 * ─────────────────────────────────────────────────────────────
 * Lecture :
 * • listEventMateriel(eventId) : Lister les items d'un event
 * • getEventMateriel(id) : Récupérer un item par ID
 *
 * Écriture CRUD :
 * • createEventMateriel(data, eventId, userId) : Créer un item
 * • updateEventMateriel(id, data) : Mettre à jour un item
 * • deleteEventMateriel(id) : Supprimer un item
 */

import { ID, Query, Permission, Role } from "appwrite";
import { getAppwriteInstances, getAppwriteConfig } from "./appwrite";
import type { EventMateriel } from "../types/appwrite";
import type {
  CreateEventMaterielData,
  UpdateEventMaterielData,
} from "../types/event-materiel.types";

const APPWRITE_CONFIG = getAppwriteConfig();
export const EVENT_MATERIEL_COLLECTION_ID = "event_materiel";

// =============================================================================
// LECTURE
// =============================================================================

/**
 * Liste tous les items de matériel pour un événement
 */
export async function listEventMateriel(
  eventId: string,
): Promise<(EventMateriel & { $id: string })[]> {
  try {
    const { tables } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      queries: [
        Query.equal("eventId", eventId),
        Query.limit(500),
        Query.orderAsc("name"),
      ],
    });

    return response.rows as unknown as (EventMateriel & { $id: string })[];
  } catch (error) {
    console.error("[appwrite-event-materiel] Error listing items:", error);
    throw error;
  }
}

/**
 * Récupère un item par son ID
 */
export async function getEventMateriel(
  id: string,
): Promise<(EventMateriel & { $id: string }) | null> {
  try {
    const { tables } = await getAppwriteInstances();

    const item = await tables.getRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      rowId: id,
    });

    return item as unknown as EventMateriel & { $id: string };
  } catch (error: any) {
    if (error.code === 404) return null;
    console.error(`[appwrite-event-materiel] Error getting item ${id}:`, error);
    throw error;
  }
}

// =============================================================================
// CRÉATION
// =============================================================================

/**
 * Crée un nouvel item de matériel événement
 *
 * Permissions : Role.label(eventId) pour read + update
 * (même pattern que Products)
 */
export async function createEventMateriel(
  data: CreateEventMaterielData,
  userId: string,
): Promise<EventMateriel & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();
    const rowId = ID.unique();

    // Permissions label-based (même pattern que Products)
    const permissions = [
      Permission.read(Role.label(data.eventId)),
      Permission.update(Role.label(data.eventId)),
      Permission.delete(Role.label(data.eventId)),
    ];

    const item = await tables.createRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      rowId,
      data: {
        eventId: data.eventId,
        name: data.name,
        quantity: data.quantity,
        type: data.type || "other",
        who: data.who || null,
        where: data.where || null,
        fromTeamName: data.fromTeamName || null,
        sourceMaterielId: data.sourceMaterielId || null,
        loanId: data.loanId || null,
        // status: data.status || "needed", // TODO: status derive de where
        notes: data.notes || null,
        createdBy: userId,
      },
      permissions,
    });

    console.log(`[appwrite-event-materiel] Item created: ${rowId}`);
    return item as unknown as EventMateriel & { $id: string };
  } catch (error) {
    console.error("[appwrite-event-materiel] Error creating item:", error);
    throw error;
  }
}

// =============================================================================
// MISE À JOUR
// =============================================================================

/**
 * Met à jour un item de matériel événement
 */
export async function updateEventMateriel(
  id: string,
  data: UpdateEventMaterielData,
): Promise<EventMateriel & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.who !== undefined) updateData.who = data.who;
    if (data.where !== undefined) updateData.where = data.where;
    if (data.fromTeamName !== undefined)
      updateData.fromTeamName = data.fromTeamName;
    if (data.sourceMaterielId !== undefined)
      updateData.sourceMaterielId = data.sourceMaterielId;
    if (data.loanId !== undefined) updateData.loanId = data.loanId;
    // if (data.status !== undefined) updateData.status = data.status; // TODO: status derive de where
    if (data.notes !== undefined) updateData.notes = data.notes;

    const item = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      rowId: id,
      data: updateData,
    });

    console.log(`[appwrite-event-materiel] Item updated: ${id}`);
    return item as unknown as EventMateriel & { $id: string };
  } catch (error) {
    console.error(
      `[appwrite-event-materiel] Error updating item ${id}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// SUPPRESSION
// =============================================================================

/**
 * Supprime un item de matériel événement
 */
export async function deleteEventMateriel(id: string): Promise<void> {
  try {
    const { tables } = await getAppwriteInstances();

    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      rowId: id,
    });

    console.log(`[appwrite-event-materiel] Item deleted: ${id}`);
  } catch (error) {
    console.error(
      `[appwrite-event-materiel] Error deleting item ${id}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// REQUÊTES PAR LOAN
// =============================================================================

/**
 * Liste les items EventMateriel liés à un loan spécifique
 */
export async function listEventMaterielByLoan(
  loanId: string,
): Promise<(EventMateriel & { $id: string })[]> {
  try {
    const { tables } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: EVENT_MATERIEL_COLLECTION_ID,
      queries: [Query.equal("loanId", loanId), Query.limit(500)],
    });

    return response.rows as unknown as (EventMateriel & { $id: string })[];
  } catch (error) {
    console.error(
      `[appwrite-event-materiel] Error listing items by loan ${loanId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// REALTIME
// =============================================================================

/**
 * Retourne les channels pour les souscriptions realtime
 */
export function getEventMaterielRealtimeChannels(): string[] {
  return [
    `databases.${APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId}.collections.${EVENT_MATERIEL_COLLECTION_ID}.documents`,
  ];
}

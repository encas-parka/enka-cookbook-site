/**
 * Service Appwrite pour les documents d'équipe
 *
 * Gère le CRUD des documents Teamdocs avec permissions par équipe
 */

import { Query, ID, Permission, Role } from "appwrite";
import { getAppwriteInstances } from "./appwrite";
import type { Teamdocs } from "../types/appwrite.d";

// =============================================================================
// CONFIGURATION
// =============================================================================

export const TEAMDOCS_COLLECTION_ID = "teamdocs";

// =============================================================================
// CRUD OPERATIONS - DOCUMENTS
// =============================================================================

/**
 * Liste TOUS les documents accessibles par l'utilisateur (via permissions Appwrite)
 * Pas de Query.equal("teamId") - Appwrite filtre automatiquement par permissions
 */
export async function listDocuments(): Promise<Teamdocs[]> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
    });

    return response.rows as unknown as Teamdocs[];
  } catch (error) {
    console.error("[appwrite-teamdocs] Error listing documents:", error);
    throw error;
  }
}

/**
 * Liste les documents modifiés depuis une certaine date (Sync incrémentiel)
 */
export async function listUpdatedDocuments(since: string): Promise<Teamdocs[]> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const queries = [Query.greaterThan("$updatedAt", since)];

    const response = await tables.listRows({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      queries,
    });

    return response.rows as unknown as Teamdocs[];
  } catch (error) {
    console.error(
      `[appwrite-teamdocs] Error listing updated documents since ${since}:`,
      error,
    );
    throw error;
  }
}

/**
 * Récupère un document par ID
 */
export async function getDocument(id: string): Promise<Teamdocs | null> {
  try {
    const { tables, config } = await getAppwriteInstances();
    const doc = await tables.getRow({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      rowId: id,
    });
    return doc as unknown as Teamdocs;
  } catch (error: any) {
    if (error.code === 404) return null;
    console.error(`[appwrite-teamdocs] Error getting document ${id}:`, error);
    throw error;
  }
}

/**
 * Crée un nouveau document avec permissions label (liés à un événement)
 */
export async function createEventDocument(
  data: Partial<Teamdocs>,
  eventId: string,
  userId: string,
): Promise<Teamdocs> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const permissions = [
      Permission.read(Role.label(eventId)),
      Permission.update(Role.label(eventId)),
      Permission.delete(Role.label(eventId)),
    ];

    const document = await tables.createRow({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        ...data,
        eventId,
        status: "doc",
      },
      permissions,
    });

    console.log(`[appwrite-teamdocs] Event document created: ${document.$id}`);
    return document as unknown as Teamdocs;
  } catch (error) {
    console.error("[appwrite-teamdocs] Error creating event document:", error);
    throw error;
  }
}

/**
 * Crée un nouveau document avec permissions team
 */
export async function createDocument(
  data: Partial<Teamdocs>,
  teamId: string,
  userId: string,
  userName: string,
): Promise<Teamdocs> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const permissions = [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ];

    const document = await tables.createRow({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        ...data,
        teamId,
        createdBy: userId,
      },
      permissions,
    });

    console.log(`[appwrite-teamdocs] Document created: ${document.$id}`);
    return document as unknown as Teamdocs;
  } catch (error) {
    console.error("[appwrite-teamdocs] Error creating document:", error);
    throw error;
  }
}

/**
 * Met à jour un document
 */
export async function updateDocument(
  id: string,
  data: Partial<Teamdocs>,
): Promise<Teamdocs> {
  try {
    const { tables, config } = await getAppwriteInstances();

    const document = await tables.updateRow({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      rowId: id,
      data,
    });

    console.log(`[appwrite-teamdocs] Document updated: ${id}`);
    return document as unknown as Teamdocs;
  } catch (error) {
    console.error(`[appwrite-teamdocs] Error updating document ${id}:`, error);
    throw error;
  }
}

/**
 * Supprime un document
 */
export async function deleteDocument(id: string): Promise<void> {
  try {
    const { tables, config } = await getAppwriteInstances();

    await tables.deleteRow({
      databaseId: config.databaseId,
      tableId: TEAMDOCS_COLLECTION_ID,
      rowId: id,
    });

    console.log(`[appwrite-teamdocs] Document deleted: ${id}`);
  } catch (error) {
    console.error(`[appwrite-teamdocs] Error deleting document ${id}:`, error);
    throw error;
  }
}

// =============================================================================
// LOCKS OPERATIONS
// =============================================================================

/**
 * Met à jour le lock d'un document (heartbeat)
 * Le lock est stocké dans les champs lockedBy et lockedByName du document
 * @param docId - ID du document
 * @param lockedBy - userId pour verrouiller, null pour libérer
 * @param lockedByName - nom du détenteur, null pour libérer
 */
export async function updateDocumentLock(
  docId: string,
  lockedBy: string | null,
  lockedByName: string | null = null,
): Promise<void> {
  try {
    await updateDocument(docId, { lockedBy, lockedByName });
    console.log(
      `[appwrite-teamdocs] Lock ${docId} mis à jour: ${lockedBy || "libéré"}`,
    );
  } catch (error) {
    console.error(`[appwrite-teamdocs] Erreur verrouillage ${docId}:`, error);
    throw error;
  }
}

// =============================================================================
// REALTIME SUBSCRIPTIONS
// =============================================================================

/**
 * Récupère les channels realtime pour les documents
 * Utilisé par le RealtimeManager pour la souscription multiplexée
 */
export function getDocumentsRealtimeChannels(): string[] {
  const { config } = getAppwriteInstances() as any;
  return [
    `databases.${config.databaseId}.collections.${TEAMDOCS_COLLECTION_ID}.documents`,
  ];
}

/**
 * S'abonne aux événements realtime des documents (standalone, sans RealtimeManager)
 * @deprecated — Préférer l'utilisation de RealtimeManager via le store
 */
export function subscribeToDocuments(
  callback: (payload: any) => void,
): () => void {
  const { client, config } = getAppwriteInstances() as any;

  const channel = `databases.${config.databaseId}.collections.${TEAMDOCS_COLLECTION_ID}.documents`;
  const unsubscribe = client.subscribe([channel], callback);

  console.log("[appwrite-teamdocs] Subscribed to documents realtime");
  return unsubscribe;
}

// =============================================================================
// TAGS MANAGEMENT
// =============================================================================

/**
 * Récupère tous les tags utilisés par une équipe
 * Filtre côté client après avoir récupéré tous les documents
 */
export async function getTeamTags(teamId: string): Promise<string[]> {
  try {
    const allDocs = await listDocuments();

    // Filtrer les documents de l'équipe
    const teamDocs = allDocs.filter((doc) => doc.teamId === teamId);

    // Extraire tous les tags uniques
    const tagsSet = new Set<string>();
    teamDocs.forEach((doc) => {
      if (doc.tags) {
        doc.tags.forEach((tag) => tagsSet.add(tag));
      }
    });

    return Array.from(tagsSet).sort();
  } catch (error) {
    console.error(
      `[appwrite-teamdocs] Error getting tags for team ${teamId}:`,
      error,
    );
    throw error;
  }
}

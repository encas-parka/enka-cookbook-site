/**
 * Services d'interaction avec Appwrite Tables - Collection Materiel
 *
 * Couche d'accès aux données pure pour la gestion du matériel.
 *
 * Services principaux :
 * ─────────────────────────────────────────────────────────────
 * Lecture :
 * • listMateriels() : Lister tous les matériels
 * • getMateriel() : Récupérer un matériel par ID
 *
 * Écriture CRUD :
 * • createMateriel() : Créer un matériel
 * • updateMateriel() : Mettre à jour un matériel
 * • deleteMateriel() : Supprimer un matériel
 *
 * Ce fichier est une couche sans état qui expose des fonctions pures
 * pour MaterielStore. Toute la logique de réactivité est gérée par le store.
 */

import { ID, Query, Permission, Role } from "appwrite";
import { getAppwriteInstances, getAppwriteConfig } from "./appwrite";
import type { Materiel } from "../types/appwrite";
import type { MaterielOwner } from "../types/materiel.types";

const APPWRITE_CONFIG = getAppwriteConfig();
export const MATERIEL_COLLECTION_ID = "materiel";

// =============================================================================
// TYPES
// =============================================================================

export type MaterielCreate = {
  name: string;
  description?: string | null;
  type?: string | null;
  quantity: number;
  status?: string;
  location?: string | null;
  shareableWith?: string[] | null;
  owner: string; // JSON stringifié de MaterielOwner
};

export type MaterielUpdate = Partial<{
  name?: string;
  description?: string | null;
  type?: string | null;
  quantity?: number;
  status?: string;
  location?: string | null;
  shareableWith?: string[] | null;
  owner?: string; // JSON stringifié de MaterielOwner
}>;

// =============================================================================
// LECTURE
// =============================================================================

/**
 * Liste tous les matériels avec filtres optionnels
 */
export async function listMateriels(
  queries?: any[],
): Promise<(Materiel & { $id: string })[]> {
  try {
    const { tables } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_COLLECTION_ID,
      queries: queries || [],
    });

    return response.rows as unknown as (Materiel & { $id: string })[];
  } catch (error) {
    console.error("[appwrite-materiel] Error listing materiels:", error);
    throw error;
  }
}

/**
 * Récupère un matériel par son ID
 */
export async function getMateriel(
  materielId: string,
): Promise<(Materiel & { $id: string }) | null> {
  try {
    const { tables } = await getAppwriteInstances();

    const materiel = await tables.getRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_COLLECTION_ID,
      rowId: materielId,
    });

    return materiel as unknown as Materiel & { $id: string };
  } catch (error: any) {
    if (error.code === 404) return null;
    console.error(
      `[appwrite-materiel] Error getting materiel ${materielId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// CRÉATION
// =============================================================================

/**
 * Crée un nouveau matériel avec les permissions appropriées
 *
 * @param data - Données du matériel (owner doit être JSON stringifié)
 * @param currentUserId - ID de l'utilisateur qui crée (pour les permissions)
 * @returns Le matériel créé
 */
export async function createMateriel(
  data: MaterielCreate,
  currentUserId: string,
): Promise<Materiel & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();
    const materielId = ID.unique();

    // Parser owner pour déterminer les permissions
    let ownerData: MaterielOwner;
    try {
      ownerData =
        typeof data.owner === "string" ? JSON.parse(data.owner) : data.owner;
    } catch (e) {
      console.error("[appwrite-materiel] Error parsing owner:", data.owner, e);
      throw new Error("Invalid owner format");
    }

    // Préparer les permissions
    const permissions = [
      // Le créateur peut lire et mettre à jour
      Permission.read(Role.user(currentUserId)),
      Permission.update(Role.user(currentUserId)),
    ];

    // Si owner est une team, donner les permissions à la team
    if (ownerData.teamId) {
      permissions.push(
        Permission.read(Role.team(ownerData.teamId)),
        Permission.update(Role.team(ownerData.teamId)),
      );
    } else if (ownerData.userId) {
      // Si owner est un user, donner les permissions à ce user
      permissions.push(
        Permission.read(Role.user(ownerData.userId)),
        Permission.update(Role.user(ownerData.userId)),
      );
    }

    const materiel = await tables.createRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_COLLECTION_ID,
      rowId: materielId,
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type || null,
        quantity: data.quantity,
        status: data.status || "ok",
        location: data.location || null,
        shareableWith: data.shareableWith || null,
        owner: data.owner,
      },
      permissions,
    });

    console.log(`[appwrite-materiel] Materiel created: ${materielId}`);
    return materiel as unknown as Materiel & { $id: string };
  } catch (error) {
    console.error("[appwrite-materiel] Error creating materiel:", error);
    throw error;
  }
}

// =============================================================================
// MISE À JOUR
// =============================================================================

/**
 * Met à jour un matériel
 *
 * @param materielId - ID du matériel
 * @param data - Données à mettre à jour
 * @returns Le matériel mis à jour
 */
export async function updateMateriel(
  materielId: string,
  data: MaterielUpdate,
): Promise<Materiel & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();

    const materiel = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_COLLECTION_ID,
      rowId: materielId,
      data: data as any,
    });

    console.log(`[appwrite-materiel] Materiel updated: ${materielId}`);
    return materiel as unknown as Materiel & { $id: string };
  } catch (error) {
    console.error(
      `[appwrite-materiel] Error updating materiel ${materielId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// SUPPRESSION
// =============================================================================

/**
 * Supprime un matériel
 *
 * @param materielId - ID du matériel à supprimer
 */
export async function deleteMateriel(materielId: string): Promise<void> {
  try {
    const { tables } = await getAppwriteInstances();

    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_COLLECTION_ID,
      rowId: materielId,
    });

    console.log(`[appwrite-materiel] Materiel deleted: ${materielId}`);
  } catch (error) {
    console.error(
      `[appwrite-materiel] Error deleting materiel ${materielId}:`,
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
export function getMaterielRealtimeChannels(): string[] {
  return [
    `databases.${APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId}.collections.${MATERIEL_COLLECTION_ID}.documents`,
  ];
}

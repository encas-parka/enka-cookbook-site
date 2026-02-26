/**
 * Services d'interaction avec Appwrite Tables - Collection MaterielLoan
 *
 * Couche d'accès aux données pure pour la gestion des emprunts de matériel.
 *
 * Services principaux :
 * ─────────────────────────────────────────────────────────────
 * Lecture :
 * • listMaterielLoans() : Lister tous les emprunts
 * • getMaterielLoan() : Récupérer un emprunt par ID
 *
 * Écriture CRUD :
 * • createMaterielLoan() : Créer un emprunt
 * • updateMaterielLoan() : Mettre à jour un emprunt
 * • deleteMaterielLoan() : Supprimer un emprunt
 *
 * Ce fichier est une couche sans état qui expose des fonctions pures
 * pour MaterielStore. Toute la logique de réactivité est gérée par le store.
 */

import { ID, Query, Permission, Role } from "appwrite";
import { getAppwriteInstances, getAppwriteConfig } from "./appwrite";
import type { MaterielLoan } from "../types/appwrite";
import type { MaterielLoanStatus } from "../types/appwrite.d";
import type { MaterielLoanItem } from "../types/materiel.types";

const APPWRITE_CONFIG = getAppwriteConfig();
export const MATERIEL_LOAN_COLLECTION_ID = "materiel_loan";

// =============================================================================
// TYPES
// =============================================================================

export type MaterielLoanCreate = {
  startDate: string;
  endDate: string;
  responsibleId: string;
  responsibleName: string;
  ownerId: string;
  ownerName: string;
  materiels: MaterielLoanItem[];
  notes?: string;
  status?: MaterielLoanStatus;
};

export type MaterielLoanUpdate = Partial<{
  startDate: string;
  endDate: string;
  materiels: MaterielLoanItem[];
  status: MaterielLoanStatus;
  notes: string;
  returnedAt: string;
  returnNotes: string;
}>;

// =============================================================================
// LECTURE
// =============================================================================

/**
 * Liste tous les emprunts avec filtres optionnels
 */
export async function listMaterielLoans(
  queries?: any[],
): Promise<(MaterielLoan & { $id: string })[]> {
  try {
    const { tables } = await getAppwriteInstances();

    const response = await tables.listRows({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_LOAN_COLLECTION_ID,
      queries: queries || [],
    });

    return response.rows as unknown as (MaterielLoan & { $id: string })[];
  } catch (error) {
    console.error("[appwrite-materiel-loan] Error listing loans:", error);
    throw error;
  }
}

/**
 * Récupère un emprunt par son ID
 */
export async function getMaterielLoan(
  loanId: string,
): Promise<(MaterielLoan & { $id: string }) | null> {
  try {
    const { tables } = await getAppwriteInstances();

    const loan = await tables.getRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_LOAN_COLLECTION_ID,
      rowId: loanId,
    });

    return loan as unknown as MaterielLoan & { $id: string };
  } catch (error: any) {
    if (error.code === 404) return null;
    console.error(
      `[appwrite-materiel-loan] Error getting loan ${loanId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// CRÉATION
// =============================================================================

/**
 * Crée un nouvel emprunt avec les permissions appropriées
 *
 * @param data - Données de l'emprunt
 * @param currentUserId - ID de l'utilisateur qui crée (pour les permissions)
 * @returns L'emprunt créé
 */
export async function createMaterielLoan(
  data: MaterielLoanCreate,
  currentUserId: string,
): Promise<MaterielLoan & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();
    const loanId = ID.unique();

    // Préparer les permissions
    const permissions = [
      // Le créateur peut lire et mettre à jour
      Permission.read(Role.user(currentUserId)),
      Permission.update(Role.user(currentUserId)),
      // Owner est toujours une team, donner les permissions à la team
      Permission.read(Role.team(data.ownerId)),
      Permission.update(Role.team(data.ownerId)),
    ];

    const loan = await tables.createRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_LOAN_COLLECTION_ID,
      rowId: loanId,
      data: {
        startDate: data.startDate,
        endDate: data.endDate,
        responsibleId: data.responsibleId,
        responsibleName: data.responsibleName,
        ownerId: data.ownerId,
        ownerName: data.ownerName,
        materiels: data.materiels.map((item) => JSON.stringify(item)),
        notes: data.notes || null,
        status: data.status || "asked",
        completedAt: null,
        returnedAt: null,
        returnNotes: null,
      },
      permissions,
    });

    console.log(`[appwrite-materiel-loan] Loan created: ${loanId}`);
    return loan as unknown as MaterielLoan & { $id: string };
  } catch (error) {
    console.error("[appwrite-materiel-loan] Error creating loan:", error);
    throw error;
  }
}

// =============================================================================
// MISE À JOUR
// =============================================================================

/**
 * Met à jour un emprunt
 *
 * @param loanId - ID de l'emprunt
 * @param data - Données à mettre à jour
 * @returns L'emprunt mis à jour
 */
export async function updateMaterielLoan(
  loanId: string,
  data: MaterielLoanUpdate,
): Promise<MaterielLoan & { $id: string }> {
  try {
    const { tables } = await getAppwriteInstances();

    const updateData: any = {};

    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.materiels !== undefined)
      updateData.materiels = data.materiels.map((item) => JSON.stringify(item));
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.returnedAt !== undefined) updateData.returnedAt = data.returnedAt;
    if (data.returnNotes !== undefined)
      updateData.returnNotes = data.returnNotes;

    const loan = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_LOAN_COLLECTION_ID,
      rowId: loanId,
      data: updateData,
    });

    console.log(`[appwrite-materiel-loan] Loan updated: ${loanId}`);
    return loan as unknown as MaterielLoan & { $id: string };
  } catch (error) {
    console.error(
      `[appwrite-materiel-loan] Error updating loan ${loanId}:`,
      error,
    );
    throw error;
  }
}

// =============================================================================
// SUPPRESSION
// =============================================================================

/**
 * Supprime un emprunt
 *
 * @param loanId - ID de l'emprunt à supprimer
 */
export async function deleteMaterielLoan(loanId: string): Promise<void> {
  try {
    const { tables } = await getAppwriteInstances();

    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId,
      tableId: MATERIEL_LOAN_COLLECTION_ID,
      rowId: loanId,
    });

    console.log(`[appwrite-materiel-loan] Loan deleted: ${loanId}`);
  } catch (error) {
    console.error(
      `[appwrite-materiel-loan] Error deleting loan ${loanId}:`,
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
export function getMaterielLoanRealtimeChannels(): string[] {
  return [
    `databases.${APPWRITE_CONFIG.APPWRITE_CONFIG.databaseId}.collections.${MATERIEL_LOAN_COLLECTION_ID}.documents`,
  ];
}

/**
 * Utilitaires de parsing et d'enrichissement pour le matériel
 * Convention: fromAppwrite = depuis Appwrite vers le client, toAppwrite = du client vers Appwrite
 *
 * Inspiré de events.utils.ts - Parsing centralisé et testable
 */

import type {
  Materiel,
  MaterielLoan,
  MaterielStatus,
  MaterielType,
} from "$lib/types/appwrite.d";
import type {
  EnrichedMateriel,
  EnrichedMaterielLoan,
  MaterielFromAppwrite,
  MaterielLoanItem,
  MaterielLoanDetail,
  MaterielOwner,
} from "$lib/types/materiel.types";

// =============================================================================
// LABELS - Fonctions de labellisation pour l'affichage
// =============================================================================

/**
 * Configuration complète pour un type de matériel
 */
export interface MaterielTypeConfig {
  label: string;
  badgeClass: string;
  textColor: string; // Classe de couleur pour le texte (ex: "text-warning")
  bgColor: string; // Classe de fond (ex: "bg-warning/10")
}

/**
 * Retourne la configuration complète (label, couleurs) pour un type de matériel
 */
export function getMaterielTypeConfig(
  type: MaterielType | string | null | undefined,
): MaterielTypeConfig {
  const configs: Record<string, MaterielTypeConfig> = {
    electronic: {
      label: "Électronique",
      badgeClass: "badge-warning",
      textColor: "text-warning",
      bgColor: "bg-warning/10",
    },
    manual: {
      label: "Manuel",
      badgeClass: "badge-info",
      textColor: "text-info",
      bgColor: "bg-info/10",
    },
    tools: {
      label: "Outils",
      badgeClass: "badge-secondary",
      textColor: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    dish: {
      label: "Vaisselle",
      badgeClass: "badge-primary",
      textColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    cooking: {
      label: "Cuisine",
      badgeClass: "badge-success",
      textColor: "text-success",
      bgColor: "bg-success/10",
    },
    gaz: {
      label: "Gaz",
      badgeClass: "badge-error",
      textColor: "text-error",
      bgColor: "bg-error/10",
    },
    hygiene: {
      label: "Hygiène",
      badgeClass: "badge-info",
      textColor: "text-info",
      bgColor: "bg-info/10",
    },
    other: {
      label: "Autre",
      badgeClass: "badge-neutral",
      textColor: "text-neutral",
      bgColor: "bg-neutral/10",
    },
  };

  return configs[type || "other"] || configs.other;
}

/**
 * Retourne le label lisible pour un type de matériel
 * @deprecated Use getMaterielTypeConfig().label instead
 */
export function getMaterielTypeLabel(
  type: MaterielType | string | null | undefined,
): string {
  return getMaterielTypeConfig(type).label;
}

/**
 * Retourne la classe de badge pour un type de matériel
 */
export function getMaterielTypeBadgeClass(
  type: MaterielType | string | null | undefined,
): string {
  return getMaterielTypeConfig(type).badgeClass;
}

/**
 * Retourne la classe de couleur pour les icônes d'un type de matériel
 */
export function getMaterielTypeColorClass(
  type: MaterielType | string | null | undefined,
): string {
  return getMaterielTypeConfig(type).textColor;
}

/**
 * Retourne la classe de fond pour un type de matériel
 */
export function getMaterielTypeBgClass(
  type: MaterielType | string | null | undefined,
): string {
  return getMaterielTypeConfig(type).bgColor;
}

/**
 * Retourne le label lisible pour un statut de matériel
 */
export function getMaterielStatusLabel(
  status: MaterielStatus | string | null | undefined,
): string {
  const labels: Record<string, string> = {
    ok: "OK",
    lost: "Perdu",
    torepair: "À réparer",
    loan: "Emprunté",
    reserved: "Réserver",
  };
  return labels[status || "ok"] || status || "OK";
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_OWNER: MaterielOwner = {
  userName: "",
  userId: "",
  teamName: "",
  teamId: "",
};

// =============================================================================
// FROM APPWRITE - Parsing depuis Appwrite vers types locaux
// =============================================================================

/**
 * Parse les données du propriétaire depuis le champ owner (JSON string) d'Appwrite
 * @param owner - Chaîne JSON depuis Appwrite ou objet déjà parsé
 * @returns Objet MaterielOwner typé
 */
export function parseOwnerFromAppwrite(owner: string | null): MaterielOwner {
  if (!owner) {
    return DEFAULT_OWNER;
  }

  try {
    return typeof owner === "string"
      ? (JSON.parse(owner) as MaterielOwner)
      : (owner as MaterielOwner);
  } catch (e) {
    console.error(
      "[materiel.utils] Error parsing owner from Appwrite:",
      owner,
      e,
    );
    return DEFAULT_OWNER;
  }
}

/**
 * Parse les items d'emprunt depuis le champ materiels (JSON string ou string[]) d'Appwrite
 * @param materiels - Chaîne JSON ou tableau de strings JSON depuis Appwrite
 * @returns Tableau de MaterielLoanItem typé
 */
export function parseLoanItemsFromAppwrite(
  materiels: string | string[] | null | undefined,
): MaterielLoanItem[] {
  if (!materiels) {
    return [];
  }

  try {
    // Format string[] : chaque élément est un JSON stringifié
    if (Array.isArray(materiels)) {
      return materiels
        .map((item) => {
          try {
            return JSON.parse(item) as MaterielLoanItem;
          } catch {
            console.warn(
              "[materiel.utils] Failed to parse loan item string:",
              item,
            );
            return null;
          }
        })
        .filter((item): item is MaterielLoanItem => item !== null);
    }

    // Format string : JSON unique
    if (typeof materiels === "string") {
      return JSON.parse(materiels) as MaterielLoanItem[];
    }

    return [];
  } catch (e) {
    console.error(
      "[materiel.utils] Error parsing loan items from Appwrite:",
      materiels,
      e,
    );
    return [];
  }
}

/**
 * Parse le champ materiels d'un loan depuis Appwrite
 * Gère à la fois le format string[] et string
 * @param materielsField - Champ materiels brut depuis Appwrite
 * @returns Tableau de MaterielLoanItem
 */
export function parseMaterielLoanFieldFromAppwrite(
  materielsField: string | string[] | null | undefined,
): MaterielLoanItem[] {
  return parseLoanItemsFromAppwrite(materielsField);
}

// =============================================================================
// TO APPWRITE - Formatage depuis types locaux vers Appwrite
// =============================================================================

/**
 * Formate un objet MaterielOwner en JSON string pour Appwrite
 * @param owner - Objet MaterielOwner
 * @returns JSON string pour Appwrite
 */
export function formatOwnerToAppwrite(owner: MaterielOwner): string {
  try {
    return JSON.stringify(owner);
  } catch (e) {
    console.error(
      "[materiel.utils] Error formatting owner to Appwrite:",
      owner,
      e,
    );
    return JSON.stringify(DEFAULT_OWNER);
  }
}

/**
 * Formate un tableau d'items de loan en JSON string pour Appwrite
 * @param items - Tableau de MaterielLoanItem
 * @returns JSON string pour Appwrite
 */
export function formatLoanItemsToAppwrite(items: MaterielLoanItem[]): string {
  try {
    return JSON.stringify(items);
  } catch (e) {
    console.error(
      "[materiel.utils] Error formatting loan items to Appwrite:",
      items,
      e,
    );
    return "[]";
  }
}

// =============================================================================
// ENRICHISSEMENT LOAN - Enrichissement des emprunts depuis Appwrite
// =============================================================================

/**
 * Enrichit un emprunt Appwrite avec les items de matériel parsés
 *
 * @param loan - Emprunt Appwrite brut (MaterielLoan)
 * @returns Emprunt enrichi avec les items parsés
 */
export function enrichLoanFromAppwrite(
  loan: MaterielLoan,
): EnrichedMaterielLoan {
  return {
    ...loan,
    materielItems: parseMaterielLoanFieldFromAppwrite(loan.materiels),
  };
}

// =============================================================================
// ENRICHISSEMENT - Calcul des données dérivées depuis Appwrite
// =============================================================================

/**
 * Enrichit un document Appwrite avec les données calculées (emprunts, disponibilité)
 *
 * @param doc - Document Appwrite brut (MaterielFromAppwrite)
 * @param allLoans - Tous les emprunts pour calculer les statistiques
 * @param now - Date actuelle (pour éviter les appels répétés à new Date())
 * @returns Matériel enrichi avec toutes les données calculées
 */
export function enrichMaterielFromAppwrite(
  doc: MaterielFromAppwrite,
  allLoans: MaterielLoan[],
  now: Date = new Date(),
): EnrichedMateriel {
  // 1. Parser le propriétaire depuis Appwrite
  const ownerData = parseOwnerFromAppwrite(doc.owner);

  // 2. Calculer les emprunts actifs/planifiés pour ce matériel
  const loanDetails: MaterielLoanDetail[] = [];
  let totalLoanedQuantity = 0;

  allLoans.forEach((loan) => {
    // Parser les items du loan depuis Appwrite
    const loanItems = parseLoanItemsFromAppwrite(loan.materiels);

    // Filtrer les items pour ce matériel
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === doc.$id,
    );

    if (itemsForThisMateriel.length === 0) {
      return;
    }

    // Vérifier si l'emprunt est actif ou planifié
    const startDate = new Date(loan.startDate);
    const endDate = new Date(loan.endDate);

    const isActive = startDate <= now && endDate >= now;
    const isPlanned = startDate > now;
    const isAcceptedOrAsked = ["accepted", "asked"].includes(loan.status);

    // Ajouter aux loanDetails si actif OU planifié
    if ((isActive || isPlanned) && isAcceptedOrAsked) {
      itemsForThisMateriel.forEach((item) => {
        loanDetails.push({
          loanId: loan.$id,
          responsibleName: loan.responsibleName || "",
          startDate: loan.startDate,
          endDate: loan.endDate,
          quantity: item.quantity,
          status: loan.status as "asked" | "accepted" | "canceled",
        });
      });
    }

    // N'ajouter à totalLoanedQuantity QUE si actif (pas planifié)
    if (isActive && isAcceptedOrAsked) {
      itemsForThisMateriel.forEach((item) => {
        totalLoanedQuantity += item.quantity;
      });
    }
  });

  // 3. Calculer le statut du matériel
  const hasActiveLoans = loanDetails.some((detail) => {
    const start = new Date(detail.startDate);
    const end = new Date(detail.endDate);
    return start <= now && end >= now;
  });

  const hasFutureLoans = loanDetails.some((detail) => {
    const start = new Date(detail.startDate);
    return start > now;
  });

  let status: MaterielStatus | "loan" | "reserved" = doc.status;

  if (hasActiveLoans) {
    status = "loan"; // En cours d'utilisation
  } else if (hasFutureLoans) {
    status = "reserved"; // Réservé pour le futur
  }

  // 4. Calculer les quantités disponibles
  const availableQuantity = doc.quantity - totalLoanedQuantity;

  return {
    // Tous les champs de Materiel (y compris Models.Row)
    ...doc,

    // Override du statut calculé
    status: status as MaterielStatus,

    // Champs enrichis (parsés depuis Appwrite)
    ownerData,
    loanDetails,

    // Champs calculés
    availableQuantity,
    totalLoanedQuantity,
    isAvailable: availableQuantity > 0,
    isFullyLoaned: availableQuantity === 0,
  };
}

/**
 * Ré-enrichit un matériel existant après une mise à jour de loan
 * Utilise les données locales du store pour éviter les appels API
 *
 * @param currentMateriel - Matériel actuel dans le store (enrichi)
 * @param allLoans - Tous les emprunts pour recalculer
 * @returns Matériel ré-enrichi avec les nouvelles données
 */
export function reEnrichMaterielFromLoans(
  currentMateriel: EnrichedMateriel,
  allLoans: MaterielLoan[],
): EnrichedMateriel {
  // Extraire les champs Appwrite de base depuis le matériel enrichi
  // EnrichedMateriel étend Materiel, donc on peut le caster directement
  const baseMateriel: Materiel = {
    ...currentMateriel,
    // Si le statut était "loan" à cause des emprunts, on remet le statut original
    // status: currentMateriel.status === "loan" ? "ok" : currentMateriel.status,
  } as Materiel;

  return enrichMaterielFromAppwrite(baseMateriel, allLoans);
}

// =============================================================================
// HELPERS - Validation et calculs
// =============================================================================

/**
 * Vérifie si un emprunt est actif à une date donnée
 * @param loan - Emprunt à vérifier
 * @param date - Date de référence (défaut: maintenant)
 * @returns true si l'emprunt est actif
 */
export function isLoanActive(
  loan: MaterielLoan,
  date: Date = new Date(),
): boolean {
  const startDate = new Date(loan.startDate);
  const endDate = new Date(loan.endDate);
  return startDate <= date && endDate >= date;
}

/**
 * Vérifie si un emprunt est planifié (futur)
 * @param loan - Emprunt à vérifier
 * @param date - Date de référence (défaut: maintenant)
 * @returns true si l'emprunt est planifié
 */
export function isLoanPlanned(
  loan: MaterielLoan,
  date: Date = new Date(),
): boolean {
  const startDate = new Date(loan.startDate);
  return startDate > date;
}

/**
 * Vérifie si un emprunt est dans un état valide pour affecter les quantités
 * @param loan - Emprunt à vérifier
 * @returns true si l'emprunt est "asked" ou "accepted"
 */
export function isLoanValid(loan: MaterielLoan): boolean {
  return ["asked", "accepted"].includes(loan.status);
}

/**
 * Calcule la quantité totale empruntée pour un matériel à une date donnée
 * Ne compte que les prêts ACTIFS (pas les prêts planifiés/futurs)
 * @param materielId - ID du matériel
 * @param loans - Liste des emprunts
 * @param now - Date de référence
 * @returns Quantité totale empruntée (prêts actifs uniquement)
 */
export function calculateTotalLoanedQuantity(
  materielId: string,
  loans: MaterielLoan[],
  now: Date = new Date(),
): number {
  let total = 0;

  loans.forEach((loan) => {
    // Vérifier si le loan est actif et valide (pas planifié)
    if (!isLoanActive(loan, now)) {
      return;
    }
    if (!isLoanValid(loan)) {
      return;
    }

    // Parser les items et sommer les quantités pour ce matériel
    const loanItems = parseLoanItemsFromAppwrite(loan.materiels);
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === materielId,
    );

    total += itemsForThisMateriel.reduce((sum, item) => sum + item.quantity, 0);
  });

  return total;
}

/**
 * Extrait les IDs de matériels uniques depuis une liste d'emprunts
 * Utile pour savoir quels matériels mettre à jour quand un loan change
 * @param loans - Liste des emprunts
 * @returns Set des IDs de matériels uniques
 */
export function extractMaterielIdsFromLoans(
  loans: MaterielLoan[],
): Set<string> {
  const materielIds = new Set<string>();

  loans.forEach((loan) => {
    const loanItems = parseLoanItemsFromAppwrite(loan.materiels);
    loanItems.forEach((item) => {
      materielIds.add(item.materielId);
    });
  });

  return materielIds;
}

// =============================================================================
// HELPERS - Vérification de disponibilité sur une période
// =============================================================================

/**
 * Vérifie si deux périodes de temps se chevauchent
 * @param start1 - Date de début de la première période
 * @param end1 - Date de fin de la première période
 * @param start2 - Date de début de la deuxième période
 * @param end2 - Date de fin de la deuxième période
 * @returns true si les périodes se chevauchent
 */
export function doPeriodsOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1 <= end2 && end1 >= start2;
}

/**
 * Calcule la quantité empruntée pour un matériel sur une période donnée
 * @param materielId - ID du matériel
 * @param loans - Liste des emprunts
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @param excludeLoanId - Optionnel : ID d'un emprunt à exclure du calcul (pour l'édition)
 * @returns Quantité totale empruntée sur la période
 */
export function calculateLoanedQuantityForPeriod(
  materielId: string,
  loans: MaterielLoan[],
  periodStart: Date,
  periodEnd: Date,
  excludeLoanId?: string,
): number {
  let total = 0;

  loans.forEach((loan) => {
    // Exclure le loan spécifié (pour l'édition)
    if (excludeLoanId && loan.$id === excludeLoanId) {
      return;
    }

    // Vérifier si le loan est valide
    if (!isLoanValid(loan)) {
      return;
    }

    // Vérifier si les périodes se chevauchent
    const loanStart = new Date(loan.startDate);
    const loanEnd = new Date(loan.endDate);

    if (!doPeriodsOverlap(loanStart, loanEnd, periodStart, periodEnd)) {
      return;
    }

    // Parser les items et sommer les quantités pour ce matériel
    const loanItems = parseLoanItemsFromAppwrite(loan.materiels);
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === materielId,
    );

    total += itemsForThisMateriel.reduce((sum, item) => sum + item.quantity, 0);
  });

  return total;
}

/**
 * Vérifie si un matériel est disponible sur une période donnée
 * @param materiel - Matériel enrichi
 * @param loans - Liste des emprunts
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @param requestedQuantity - Quantité demandée (défaut: 1)
 * @returns true si le matériel est disponible
 */
export function isMaterielAvailableForPeriod(
  materiel: EnrichedMateriel,
  loans: MaterielLoan[],
  periodStart: Date,
  periodEnd: Date,
  requestedQuantity: number = 1,
): boolean {
  const loanedQuantity = calculateLoanedQuantityForPeriod(
    materiel.$id,
    loans,
    periodStart,
    periodEnd,
  );

  return materiel.quantity - loanedQuantity >= requestedQuantity;
}

/**
 * Retourne les détails des conflits pour un matériel sur une période
 * @param materielId - ID du matériel
 * @param materielName - Nom du matériel
 * @param loans - Liste des emprunts
 * @param periodStart - Date de début de la période
 * @param periodEnd - Date de fin de la période
 * @returns Liste des conflits avec détails
 */
export function getMaterielConflictsForPeriod(
  materielId: string,
  materielName: string,
  loans: MaterielLoan[],
  periodStart: Date,
  periodEnd: Date,
): Array<{
  loanId: string;
  responsibleName: string;
  startDate: string;
  endDate: string;
  quantity: number;
}> {
  const conflicts: Array<{
    loanId: string;
    responsibleName: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }> = [];

  loans.forEach((loan) => {
    // Vérifier si le loan est valide
    if (!isLoanValid(loan)) {
      return;
    }

    // Vérifier si les périodes se chevauchent
    const loanStart = new Date(loan.startDate);
    const loanEnd = new Date(loan.endDate);

    if (!doPeriodsOverlap(loanStart, loanEnd, periodStart, periodEnd)) {
      return;
    }

    // Parser les items et vérifier si ce matériel est concerné
    const loanItems = parseLoanItemsFromAppwrite(loan.materiels);
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === materielId,
    );

    if (itemsForThisMateriel.length > 0) {
      const quantity = itemsForThisMateriel.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      conflicts.push({
        loanId: loan.$id,
        responsibleName: loan.responsibleName || "Inconnu",
        startDate: loan.startDate,
        endDate: loan.endDate,
        quantity,
      });
    }
  });

  return conflicts;
}

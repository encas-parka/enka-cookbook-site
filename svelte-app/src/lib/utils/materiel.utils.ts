/**
 * Utilitaires de parsing et d'enrichissement pour la gestion du matériel
 * Parsing centralisé et testable des données PocketBase
 */

import type {
  Materiel,
  MaterielLoan,
  MaterielStatus,
  MaterielType,
} from "$lib/types/pb";
import type {
  EnrichedMateriel,
  EnrichedMaterielLoan,
  MaterielFromAppwrite,
  MaterielLoanItem,
  MaterielLoanDetail,
} from "$lib/types/materiel.types";
import type { EventMaterielStatus } from "$lib/types/event-materiel.types";

export interface EventMaterielStatusConfig {
  label: string;
  badgeClass: string;
  bgClass: string;
  selectClass: string;
}

const eventMaterielStatusConfigs: Record<string, EventMaterielStatusConfig> = {
  to_find: {
    label: "À trouver",
    badgeClass: "badge-error badge-outline",
    bgClass: "bg-error/5 border border-error/20",
    selectClass: "text-error",
  },
  to_check: {
    label: "À vérifier",
    badgeClass: "badge-warning badge-outline",
    bgClass: "bg-warning/5 border border-warning/20",
    selectClass: "text-warning",
  },
  confirmed: {
    label: "Ok",
    badgeClass: "badge-success badge-outline",
    bgClass: "bg-success/5 border border-success/20",
    selectClass: "text-success",
  },
};

export function getEventMaterielStatusConfig(
  status: EventMaterielStatus | string | null | undefined,
): EventMaterielStatusConfig {
  return (
    eventMaterielStatusConfigs[status || "to_find"] ||
    eventMaterielStatusConfigs.to_find
  );
}

export const eventMaterielStatusLabels: Record<string, string> = {
  to_find: "À trouver",
  to_check: "À vérifier",
  confirmed: "Ok",
};

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
// ENRICHISSEMENT - Calcul des données dérivées depuis PocketBase
// =============================================================================

/**
 * Enrichit un document avec les données calculées (emprunts, disponibilité)
 *
 * @param doc - Document brut (Materiel)
 * @param allLoans - Tous les emprunts pour calculer les statistiques
 * @param now - Date actuelle (pour éviter les appels répétés à new Date())
 * @returns Matériel enrichi avec toutes les données calculées
 */
export function enrichMaterielFromAppwrite(
  doc: MaterielFromAppwrite,
  allLoans: MaterielLoan[],
  now: Date = new Date(),
): EnrichedMateriel {
  // 1. Calculer les emprunts actifs/planifiés pour ce matériel
  const loanDetails: MaterielLoanDetail[] = [];
  let totalLoanedQuantity = 0;

  allLoans.forEach((loan) => {
    // Parser les items du loan
    const loanItems = parseLoanItemsFromDb(loan.materiels);

    // Filtrer les items pour ce matériel
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === doc.id,
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
          loanId: loan.id,
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
    // Tous les champs de Materiel (y compris PbDoc)
    ...doc,

    // Override du statut calculé
    status: status as MaterielStatus,

    // Champs enrichis
    loanDetails,

    // Champs calculés
    availableQuantity,
    totalLoanedQuantity,
    isAvailable: availableQuantity > 0,
    isFullyLoaned: availableQuantity === 0,
  };
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
    const loanItems = parseLoanItemsFromDb(loan.materiels);
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
    const loanItems = parseLoanItemsFromDb(loan.materiels);
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
    if (excludeLoanId && loan.id === excludeLoanId) {
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
    const loanItems = parseLoanItemsFromDb(loan.materiels);
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
    materiel.id,
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
    const loanItems = parseLoanItemsFromDb(loan.materiels);
    const itemsForThisMateriel = loanItems.filter(
      (item) => item.materielId === materielId,
    );

    if (itemsForThisMateriel.length > 0) {
      const quantity = itemsForThisMateriel.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      conflicts.push({
        loanId: loan.id,
        responsibleName: loan.responsibleName || "Inconnu",
        startDate: loan.startDate,
        endDate: loan.endDate,
        quantity,
      });
    }
  });

  return conflicts;
}

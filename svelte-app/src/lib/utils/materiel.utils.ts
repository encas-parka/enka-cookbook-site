/**
 * Utilitaires de parsing et d'enrichissement pour la gestion du matériel
 * Parsing centralisé et testable des données PocketBase
 */

import type { MaterielLoan, MaterielStatus, MaterielType } from "$lib/types/pb";
import type {
  EnrichedMateriel,
  EnrichedMaterielLoan,
  MaterielDisplayState,
  MaterielLoanItem,
  MaterielLoanDetail,
} from "$lib/types/materiel.types";
import type { Materiel } from "$lib/types/pb";
import type { EventMaterielStatus } from "$lib/types/event-materiel.types";
import {
  Box,
  ChefHat,
  Flame,
  Hammer,
  SoapDispenserDroplet,
  Utensils,
  Wrench,
  Zap,
} from "@lucide/svelte";
import type { Component } from "svelte";

/**
 * Ordre canonique d'affichage des types (groupes, facettes, tris) —
 * source unique, partagée par l'inventaire et les emprunts.
 */
export const MATERIEL_TYPE_ORDER: string[] = [
  "cooking",
  "dish",
  "gaz",
  "hygiene",
  "electronic",
  "manual",
  "tools",
  "other",
];

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
  /** Icône du type — source unique pour en-têtes, cards et rangées. */
  icon: Component<any>;
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
      icon: Zap,
    },
    manual: {
      label: "Manuel",
      badgeClass: "badge-info",
      textColor: "text-info",
      bgColor: "bg-info/10",
      icon: Wrench,
    },
    tools: {
      label: "Outils",
      badgeClass: "badge-secondary",
      textColor: "text-secondary",
      bgColor: "bg-secondary/10",
      icon: Hammer,
    },
    dish: {
      label: "Vaisselle",
      badgeClass: "badge-primary",
      textColor: "text-primary",
      bgColor: "bg-primary/10",
      icon: Utensils,
    },
    cooking: {
      label: "Cuisine",
      badgeClass: "badge-success",
      textColor: "text-success",
      bgColor: "bg-success/10",
      icon: ChefHat,
    },
    gaz: {
      label: "Gaz",
      badgeClass: "badge-error",
      textColor: "text-error",
      bgColor: "bg-error/10",
      icon: Flame,
    },
    hygiene: {
      label: "Hygiène",
      badgeClass: "badge-info",
      textColor: "text-info",
      bgColor: "bg-info/10",
      icon: SoapDispenserDroplet,
    },
    other: {
      label: "Autre",
      badgeClass: "badge-neutral",
      textColor: "text-neutral",
      bgColor: "bg-neutral/10",
      icon: Box,
    },
  };

  return configs[type || "other"] || configs.other;
}

/** Libellé + badge d'affichage du statut d'un emprunt (liste et dossier). */
export function getLoanStatusConfig(status: string | null | undefined): {
  label: string;
  badgeClass: string;
} {
  const configs: Record<string, { label: string; badgeClass: string }> = {
    asked: { label: "En attente", badgeClass: "badge-warning" },
    accepted: { label: "Confirmée", badgeClass: "badge-info" },
    refused: { label: "Refusée", badgeClass: "badge-error" },
    canceled: { label: "Annulée", badgeClass: "badge-neutral" },
    completed: { label: "Retour effectué", badgeClass: "badge-success" },
    archived: { label: "Archivée", badgeClass: "badge-neutral" },
    returned: { label: "Retournée", badgeClass: "badge-success" },
  };
  return (
    (status && configs[status]) || {
      label: "Statut inconnu",
      badgeClass: "badge-neutral",
    }
  );
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
 * Icône d'un type de matériel (composant Lucide) — remplace les quatre
 * mappings locaux qui coexistaient (listes, cards, retours).
 */
export function getMaterielTypeIcon(
  type: MaterielType | string | null | undefined,
): Component<any> {
  return getMaterielTypeConfig(type).icon;
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

/**
 * Libellé FR d'un état d'affichage dérivé (jamais persisté). L'état
 * « partial » porte le nombre d'exemplaires en réparation.
 */
export function getMaterielDisplayStateLabel(
  state: MaterielDisplayState | string | null | undefined,
  repairQuantity: number = 0,
): string {
  const labels: Record<string, string> = {
    complete: "Complet",
    partial: `Partiel : ${repairQuantity} à réparer`,
    repair: "En réparation",
    depleted: "Stock épuisé",
    loan: "Emprunté",
    reserved: "Réservé",
  };
  return (state && labels[state]) || "Inconnu";
}

// =============================================================================
// PARSING - Parsing des données PocketBase (JSON multi-formats)
// =============================================================================

/**
 * Parse les items d'emprunt depuis le champ materiels (JSON string, string[] ou object[]) de PocketBase
 * Gère 3 formats :
 *   - string (JSON unique du tableau complet)  — legacy
 *   - string[] (chaque item JSON.stringify individuellement) — ancien format frontend
 *   - object[] (objets natifs, désérialisés par le SDK PB) — format cible
 * @param materiels - Valeur brute depuis PocketBase
 * @returns Tableau de MaterielLoanItem typé
 */
export function parseLoanItemsFromDb(materiels: unknown): MaterielLoanItem[] {
  if (!materiels) {
    return [];
  }

  try {
    // Format string[] ou object[] : chaque élément est un item
    if (Array.isArray(materiels)) {
      return materiels
        .map((item) => {
          // Objet natif (format cible : données créées après ce fix ou données migrées)
          if (typeof item === "object" && item !== null) {
            return item as MaterielLoanItem;
          }
          // String JSON (ancien format : chaque item JSON.stringify individuellement)
          if (typeof item === "string") {
            try {
              return JSON.parse(item) as MaterielLoanItem;
            } catch {
              console.warn(
                "[materiel.utils] Failed to parse loan item string:",
                item,
              );
              return null;
            }
          }
          return null;
        })
        .filter((item): item is MaterielLoanItem => item !== null);
    }

    // Format string : JSON unique du tableau complet (legacy)
    if (typeof materiels === "string") {
      return JSON.parse(materiels) as MaterielLoanItem[];
    }

    return [];
  } catch (e) {
    console.error(
      "[materiel.utils] Error parsing loan items from PocketBase:",
      materiels,
      e,
    );
    return [];
  }
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
export function enrichMateriel(
  doc: Materiel,
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

    // Un emprunt sans dates n'est ni actif ni planifié (champs PB nullables ;
    // new Date(null) donnerait l'epoch et fausserait les comparaisons)
    if (loan.startDate === null || loan.endDate === null) {
      return;
    }

    // Snapshots narrowés : le narrowing TS ne traverse pas les callbacks imbriqués
    const loanStartDate: string = loan.startDate;
    const loanEndDate: string = loan.endDate;

    // Vérifier si l'emprunt est actif ou planifié
    const startDate = new Date(loanStartDate);
    const endDate = new Date(loanEndDate);

    const isActive = startDate <= now && endDate >= now;
    const isPlanned = startDate > now;
    const isAcceptedOrAsked =
      loan.status !== null && ["accepted", "asked"].includes(loan.status);

    // Ajouter aux loanDetails si actif OU planifié
    if ((isActive || isPlanned) && isAcceptedOrAsked) {
      itemsForThisMateriel.forEach((item) => {
        loanDetails.push({
          loanId: loan.id,
          responsibleName: loan.responsibleName || "",
          startDate: loanStartDate,
          endDate: loanEndDate,
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

  // Statut PB nullable : matériel sans statut explicite traité comme "ok"
  let status: MaterielStatus | "loan" | "reserved" = doc.status ?? "ok";

  if (hasActiveLoans) {
    status = "loan"; // En cours d'utilisation
  } else if (hasFutureLoans) {
    status = "reserved"; // Réservé pour le futur
  }

  // Exemplaires actuellement en réparation (champ PB optionnel → 0) ;
  // non empruntables tant qu'ils ne sont pas remis en service
  const repairQuantity = doc.repairQuantity ?? 0;

  // 4. Calculer les quantités disponibles (stock inconnu → 0, conservateur) ;
  // la réparation soustrait comme un emprunt (ADR 0003)
  const availableQuantity =
    (doc.quantity ?? 0) - totalLoanedQuantity - repairQuantity;

  // État d'affichage dérivé — jamais persisté (ADR 0003) : l'état de stock
  // cède devant l'activité d'emprunt, comme le statut enrichi existant
  const stockState: MaterielDisplayState =
    repairQuantity > 0
      ? availableQuantity > 0
        ? "partial"
        : "repair"
      : availableQuantity > 0
        ? "complete"
        : "depleted";

  const displayState: MaterielDisplayState = hasActiveLoans
    ? "loan"
    : hasFutureLoans
      ? "reserved"
      : stockState;

  return {
    // Tous les champs de Materiel (y compris PbDoc)
    ...doc,

    // Override du statut calculé
    status: status as MaterielStatus,

    // État d'affichage dérivé (stock × activité)
    displayState,

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
// ENRICHISSEMENT LOAN — Enrichissement des emprunts depuis PocketBase
// =============================================================================

/**
 * Parse le champ materiels d'un loan depuis PocketBase
 * Gère les 3 formats : string, string[], object[]
 * @param materielsField - Champ materiels brut depuis PocketBase
 * @returns Tableau de MaterielLoanItem
 */
export function parseMaterielLoanFieldFromDb(
  materielsField: unknown,
): MaterielLoanItem[] {
  return parseLoanItemsFromDb(materielsField);
}

/**
 * Enrichit un emprunt avec les items de matériel parsés
 *
 * @param loan - Emprunt brut (MaterielLoan)
 * @returns Emprunt enrichi avec les items parsés
 */
export function enrichLoanFromDb(loan: MaterielLoan): EnrichedMaterielLoan {
  return {
    ...loan,
    materielItems: parseMaterielLoanFieldFromDb(loan.materiels),
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
  if (loan.startDate === null || loan.endDate === null) return false;
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
  if (loan.startDate === null) return false;
  const startDate = new Date(loan.startDate);
  return startDate > date;
}

/**
 * Vérifie si un emprunt est dans un état valide pour affecter les quantités
 * @param loan - Emprunt à vérifier
 * @returns true si l'emprunt est "asked" ou "accepted"
 */
export function isLoanValid(loan: MaterielLoan): boolean {
  return loan.status !== null && ["asked", "accepted"].includes(loan.status);
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

    // Comparaison de période sans sens si les dates manquent
    if (loan.startDate === null || loan.endDate === null) {
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
  // Quantité inconnue (null) → déclaré non disponible
  if (materiel.quantity === null) return false;

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

    // Comparaison de période sans sens si les dates manquent
    if (loan.startDate === null || loan.endDate === null) {
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

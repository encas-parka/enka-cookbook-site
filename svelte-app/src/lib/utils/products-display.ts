import {
  Bean,
  Beef,
  Carrot,
  CandyCane,
  Egg,
  ChefHat,
  Leaf,
  Refrigerator,
  Package,
} from "@lucide/svelte";
import type { EnrichedProduct } from "../types/store.types";

// Fonction pour obtenir le nom d'affichage et l'icône d'un type de produit
export function getProductTypeInfo(type: string) {
  const typeLower = type.toLowerCase();

  switch (typeLower) {
    case "sec":
      return { displayName: "Produits Sec", icon: Bean };
    case "animaux":
      return { displayName: "Viandes et Poissons", icon: Beef };
    case "legumes":
      return { displayName: "Fruits et Légumes", icon: Carrot };
    case "sucres":
      return { displayName: "Sucrées", icon: CandyCane };
    case "lof":
      return { displayName: "L.O.F", icon: Egg };
    case "autres":
      return { displayName: "Autres", icon: ChefHat };
    case "epices":
      return { displayName: "Assaisonnements", icon: Leaf };
    case "frais":
      return { displayName: "Produits Frais", icon: Refrigerator };
    default:
      return { displayName: type, icon: Package };
  }
}

// Import des fonctions de formatage depuis QuantityFormatter
import { convertAndFormatQuantity } from "./QuantityFormatter";

export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateString;
  }
}

export function sortEnrichedProducts(
  products: EnrichedProduct[],
  filters: any,
): any[] {
  if (!filters.sortColumn) return products;

  return [...products].sort((a, b) => {
    let aVal: any = a[filters.sortColumn as keyof any];
    let bVal: any = b[filters.sortColumn as keyof any];

    if (aVal < bVal) return filters.sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return filters.sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

// Fonctions pour la gestion des statuts d'achat
export function getStatusBadge(status: string | null): {
  text: string;
  class: string;
} {
  switch (status) {
    case "requested":
      return { text: "Demandé", class: "text-amber-600" };
    case "ordered":
      return { text: "Commandé", class: "badge-info" };
    case "pending":
      return {
        text: "En attente",
        class: "badge-accent",
      };
    case "delivered":
      return { text: "Livré", class: "badge-success" };
    case "cancelled":
      return { text: "Annulé", class: "badge-error" };
    default:
      return { text: "Livré", class: "badge-success" };
  }
}

export function formatDateOrNull(dateString: string | null): string {
  if (!dateString) return "-";
  return formatDate(dateString);
}

// Fonction pour formater les achats avec badges structurés
export function formatPurchasesWithBadges(purchases: any[]): Array<{
  quantity: string;
  unit: string;
  status: string | null;
  badgeClass: string;
  badgeText: string;
  icon: string;
  deliveryDate?: string;
}> {
  if (!purchases?.length) return [];

  // Grouper par statut et unité
  const grouped = purchases.reduce((acc, purchase) => {
    const status = purchase.status || "direct";
    const unit = purchase.unit || "unit";
    const key = `${status}_${unit}`;

    if (!acc[key]) {
      const badgeInfo = getStatusBadge(status);
      acc[key] = {
        status,
        unit,
        quantity: 0,
        badgeClass: badgeInfo.class,
        badgeText: badgeInfo.text,
        icon: getStatusIcon(status),
        deliveryDate:
          status === "ordered" && purchase.deliveryDate
            ? formatDateShort(purchase.deliveryDate)
            : undefined,
      };
    }

    acc[key].quantity += purchase.quantity || 0;
    return acc;
  }, {});

  // Formatter les quantités avec conversion d'unité si nécessaire
  return Object.values(grouped).map((item: any) => {
    // Utiliser convertAndFormatQuantity pour obtenir directement la valeur et l'unité converties
    const { value: numericQty, unit: convertedUnit } = convertAndFormatQuantity(
      item.quantity,
      item.unit,
    );

    // Convertir en chaîne pour l'affichage
    let formattedQty: string;
    if (convertedUnit === "kg" || convertedUnit === "l.") {
      // Garder jusqu'à 2 décimales mais retirer les zéros superflus
      formattedQty = numericQty.toFixed(2).replace(/\.?0+$/, "");
    } else {
      formattedQty = numericQty.toString();
    }

    return {
      ...item,
      quantity: formattedQty,
      unit: convertedUnit, // Mettre à jour l'unité avec l'unité convertie
    };
  });
}

// Fonction pour obtenir l'icône correspondant au statut
function getStatusIcon(status: string | null): string {
  switch (status) {
    case "requested":
      return "MessageCircleQuestionMark";
    case "ordered":
      return "ClipboardCheck";
    case "pending":
      return "Clock";
    case "delivered":
      return "Check";
    case "cancelled":
      return "CircleX";
    case "inStock":
      return "PackageCheck";
    default:
      return "Package";
  }
}

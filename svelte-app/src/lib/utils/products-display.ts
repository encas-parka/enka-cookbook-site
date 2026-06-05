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

const TYPE_LABEL_TO_KEY: Record<string, string> = {
  "Produits Sec": "sec",
  "Viandes et Poissons": "animaux",
  "Fruits et Légumes": "legumes",
  Sucrées: "sucres",
  "L.O.F": "lof",
  Autres: "autres",
  Assaisonnements: "epices",
  "Produits Frais": "frais",
};

export function getProductTypeRawKey(displayName: string): string {
  return TYPE_LABEL_TO_KEY[displayName] ?? displayName;
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
  return formatDateShort(dateString);
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
  store?: string;
  who?: string;
}> {
  if (!purchases?.length) return [];

  // Séparer les achats "ordered" des autres
  const orderedPurchases = purchases.filter(
    (p) => (p.status || "direct") === "ordered",
  );
  const otherPurchases = purchases.filter(
    (p) => (p.status || "direct") !== "ordered",
  );

  // Les achats "ordered" ne sont PAS agrégés : chacun son badge
  const orderedBadges = orderedPurchases.map((purchase) => {
    const status = "ordered";
    const unit = purchase.unit || "unit";
    const badgeInfo = getStatusBadge(status);
    const { value: numericQty, unit: convertedUnit } = convertAndFormatQuantity(
      purchase.quantity || 0,
      unit,
    );
    let formattedQty: string;
    if (convertedUnit === "kg" || convertedUnit === "l.") {
      formattedQty = numericQty.toFixed(2).replace(/\.?0+$/, "");
    } else {
      formattedQty = numericQty.toString();
    }
    return {
      status,
      unit: convertedUnit,
      quantity: formattedQty,
      badgeClass: badgeInfo.class,
      badgeText: badgeInfo.text,
      icon: getStatusIcon(status),
      deliveryDate: purchase.deliveryDate
        ? formatDateShort(purchase.deliveryDate)
        : undefined,
      store: purchase.store?.trim() || undefined,
      who: purchase.who?.trim() || undefined,
    };
  });

  // Les autres achats sont agrégés par statut + unité (comportement existant)
  const grouped = otherPurchases.reduce((acc: any, purchase: any) => {
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
      };
    }

    acc[key].quantity += purchase.quantity || 0;
    return acc;
  }, {});

  const otherBadges = Object.values(grouped).map((item: any) => {
    const { value: numericQty, unit: convertedUnit } = convertAndFormatQuantity(
      item.quantity,
      item.unit,
    );

    let formattedQty: string;
    if (convertedUnit === "kg" || convertedUnit === "l.") {
      formattedQty = numericQty.toFixed(2).replace(/\.?0+$/, "");
    } else {
      formattedQty = numericQty.toString();
    }

    return {
      ...item,
      quantity: formattedQty,
      unit: convertedUnit,
    };
  });

  // Ordered d'abord, puis les autres
  return [...orderedBadges, ...otherBadges];
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

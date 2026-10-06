/**
 * Utilitaires de conversion pour les dates de repas
 */

/**
 * Convertit une date (YYYY-MM-DD) + moment → datetime ISO 8601
 */
export function dateToDateTime(
  date: string,
  time: "matin" | "midi" | "soir",
): string {
  const hours = { matin: "08:00:00", midi: "12:00:00", soir: "20:00:00" };
  return `${date}T${hours[time]}`;
}

/**
 * Extrait `YYYY-MM-DD` d'une valeur date, quel que soit le séparateur.
 * PocketBase renvoie `YYYY-MM-DD HH:mm:ss.SSSZ` (espace, pas de `T`) —
 * extraction lexicale : passer par `new Date()` converttrait en UTC et
 * décalerait les dates proches de minuit.
 */
export function toInputDate(value: string | null | undefined): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

/**
 * Extrait la partie date d'un datetime ISO
 */
export function extractDate(datetime: string): string {
  return toInputDate(datetime);
}

/**
 * Déduit le moment depuis l'heure d'un datetime
 */
export function extractTime(
  datetime: string | null,
): "matin" | "midi" | "soir" | "" {
  if (!datetime) return "";

  const hour = parseInt(datetime.split("T")[1]?.split(":")[0] || "12");
  if (hour < 10) return "matin";
  if (hour < 17) return "midi";
  return "soir";
}

export function DayMonthMoment(date: string | null, noDay = false): string {
  if (!date) return "";
  const dayMonth = noDay
    ? formatDateMinimal(date)
    : formatDateWdDayMonthShort(date);

  const moment = extractTime(date);
  return `${dayMonth} ${moment}`;
}

/**
 * Formate une durée en minutes en format lisible
 */
export function formatTime(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

/**
 * Formate une date relative par rapport à maintenant
 */
export function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Formate une date pour l'affichage (français) - jour et mois court
 */
export function formatDateDayMonthShort(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Formate une date pour l'affichage (français) - jour de semaine, jour et mois court
 */
export function formatDateWdDayMonthShort(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateMinimal(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateWdDayMonth(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

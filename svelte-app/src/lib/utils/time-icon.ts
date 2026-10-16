/**
 * Résolution de l'icône lucide associée à un moment de journée
 * (champ `timeIcon` de `DateDisplayInfo`).
 */
import { Sun, Moon, Cloud } from "@lucide/svelte";

/** Icône lucide correspondant à un `timeIcon`, ou `null` si aucun. */
export function getTimeIconComponent(
  timeIcon: "sun" | "moon" | "cloud" | null,
) {
  if (timeIcon === "sun") return Sun;
  if (timeIcon === "moon") return Moon;
  if (timeIcon === "cloud") return Cloud;
  return null;
}

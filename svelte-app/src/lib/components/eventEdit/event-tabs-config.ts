import type { Component } from "svelte";
import {
  ClipboardList,
  CookingPot,
  FileText,
  Image,
  ListTodo,
  Package,
  Pencil,
} from "@lucide/svelte";

export interface EventTab {
  label: string;
  relativePath: string;
  icon: Component;
}

export const allEventTabs: EventTab[] = [
  { label: "Éditer", relativePath: "", icon: Pencil },
  { label: "Recettes", relativePath: "recipes", icon: CookingPot },
  { label: "Produits", relativePath: "products", icon: ClipboardList },
  { label: "Tâches", relativePath: "todos", icon: ListTodo },
  { label: "Matériel", relativePath: "materiel", icon: Package },
  { label: "Affiches", relativePath: "posters", icon: Image },
  { label: "Documents", relativePath: "documents", icon: FileText },
];

export function getEventActiveIndex(pathname: string): number {
  if (pathname.includes("/recipes")) return 1;
  if (pathname.includes("/products")) return 2;
  if (pathname.includes("/todos")) return 3;
  if (pathname.includes("/materiel")) return 4;
  if (pathname.includes("/posters")) return 5;
  if (pathname.includes("/documents") || pathname.includes("/document"))
    return 6;
  return 0;
}

export function getEventTabPath(
  tab: EventTab,
  eventId: string,
  basePath = "/event",
): string {
  return tab.relativePath
    ? `${basePath}/${eventId}/${tab.relativePath}`
    : `${basePath}/${eventId}`;
}

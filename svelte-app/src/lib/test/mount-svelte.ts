/**
 * Montage Svelte 5 pour les tests composants — sans dépendance externe :
 * `mount`/`unmount`/`flushSync` de svelte, cible rattachée au body,
 * instances tracées pour le démontage (brancher `cleanupSvelte` en
 * afterEach).
 *
 * Svelte 5 requiert le runtime client en test : `resolve.conditions:
 * ["browser"]` est posé dans vitest.config.ts (réactivité des runes).
 * jsdom ne fait pas de layout CSS — les assertions portent la structure
 * et le texte, jamais l'apparence : la cohérence visuelle reste du
 * ressort de la passe click-through (ADR 0004).
 */
import { flushSync, mount, unmount, type Component } from "svelte";

const mounted: Array<Record<string, unknown>> = [];

/** Montre le composant dans une cible fraîche du body et retourne la cible. */
export function mountSvelte(
  component: Component<any, any, any>,
  props: Record<string, unknown> = {},
): HTMLElement {
  const target = document.createElement("div");
  document.body.appendChild(target);
  mounted.push(mount(component, { target, props }) as Record<string, unknown>);
  flushSync();
  return target;
}

/** Démonte les composants encore montés (à brancher en afterEach). */
export function cleanupSvelte(): void {
  while (mounted.length) unmount(mounted.pop() as never);
  flushSync();
}

/** Positionne la valeur d'un input lié (bind:value) et force la synchro. */
export function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  flushSync();
}

/** Premier élément du sélecteur dont le texte trimmé vaut exactement `text`. */
export function getByText(
  root: ParentNode,
  selector: string,
  text: string,
): HTMLElement {
  const el = queryByText(root, selector, text);
  if (!el) {
    throw new Error(`Aucun « ${selector} » avec le texte « ${text} »`);
  }
  return el;
}

export function queryByText(
  root: ParentNode,
  selector: string,
  text: string,
): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
      (el) => el.textContent?.trim() === text,
    ) ?? null
  );
}

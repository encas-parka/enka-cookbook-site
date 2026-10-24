/**
 * Objet props `$state` pour `mountSvelte` — rend les réassignations
 * `$bindable` de l'enfant à la fois visibles par le test (le proxy écrit
 * dans l'objet brut) et réactives dans l'enfant (les lectures du proxy
 * sont tracées, le rendu suit).
 *
 * Fait mesuré (lot 1, svelte internal `prop()`) : un objet brut passé à
 * `mount()` ne reflète pas les réassignations `$bindable` — le write-back
 * n'est câblé que pour un props porteur de descripteurs avec `set`
 * (mais lectures non tracées : pas de re-rendu) ou pour un proxy `$state`
 * (`is_entry_props`). C'est le cas documenté « `mount(Component,
 * props)` avec `let props = $state({...})` ».
 *
 * ```ts
 * const holder = bindableProps({ value: null as number | null });
 * mountSvelte(PriceInput, holder);
 * // …interaction…
 * expect(holder.value).toBe(12.5);
 * ```
 */
export function bindableProps<T extends Record<string, unknown>>(
  initial: T,
): T {
  let props = $state(initial);
  return props;
}

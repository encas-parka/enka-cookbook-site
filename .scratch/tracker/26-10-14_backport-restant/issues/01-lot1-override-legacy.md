# Lot 1 — Override legacy (E) + micro-fix GroupPurchaseModal

## E — paire écriture+lecture override (bug, priorité `!`)

**Contexte.** Un *override* = quantité totale nécessaire saisie à la main. 60 lignes legacy ont un override dans une unité
désalignée du besoin calculé (ex. `Poivre 30 l.` vs `30 gr.`) ; la soustraction besoins−achats ne convertit pas les unités,
donc le « manque » ne se résorbe jamais et le bouton de validation rapide reste actif (investigation §9.2, certitude high).

**À porter depuis la sœur** (`/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-site/svelte-app/src/lib/…`) :
- `utils/productsUtils.ts:64-92` — `getNormalizedOverride()` (via `normalizeQty()` → `UnitConverter.normalize()`)
  et `getEffectiveNeededQuantities()` ; import sœur `utils/dateRange.ts:18`.
- Usages sœur `utils/dateRange.ts:175` (produit manuel) et `:272` (calcul daté).

**État mig :**
- [svelte-app/src/lib/utils/dateRange.ts](svelte-app/src/lib/utils/dateRange.ts) (`:173-174`, `:268-269`) lit l'override **brut**.
  → remplacer par l'équivalent de `getEffectiveNeededQuantities()`.
- [svelte-app/src/lib/components/eventProducts/OverrideManager.svelte](svelte-app/src/lib/components/eventProducts/OverrideManager.svelte)
  (`:64`, `:95-110` `handleSetOverride`) normalise via `autoConvertUnit` **dans le mauvais sens**
  (« 1500 gr. » stocké « 1.5 kg », inverse du stockage attendu).
  → corriger le sens pour qu'écriture et lecture soient compatibles (backlog `!` : corriger un seul côté est exclu).

**Tests.** Unitaires : normalisation (kg↔gr, l↔ml, cas « au goût »), `getEffectiveNeededQuantities` sur override legacy
désaligné, non-régression override déjà aligné. Cibler les fichiers de test du périmètre, une seule exécution loggée.

## Micro-fix — `invoiceTotal` (`?` backlog, à solder au passage)

- [svelte-app/src/lib/components/eventProducts/GroupPurchaseModal.svelte](svelte-app/src/lib/components/eventProducts/GroupPurchaseModal.svelte) (`:115`) :
  `invoiceTotal: formData.expense || undefined` → `formData.expense ?? 0` (parité sœur `:112` ; `||` avale un total à 0).

## Périmètre (ne toucher que ces fichiers + leurs tests)

`utils/dateRange.ts`, `utils/productsUtils.ts`, `components/eventProducts/OverrideManager.svelte`,
`components/eventProducts/GroupPurchaseModal.svelte`, tests associés. **Ne pas commiter.**

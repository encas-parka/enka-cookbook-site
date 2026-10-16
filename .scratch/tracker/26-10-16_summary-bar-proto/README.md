# Prototype summary-bar — verdict (26-10-16)

Question : à quoi ressemblerait une barre résumé Produits/Dépenses compacte et inline
(wrap possible sur 2 lignes) en tête de `EventProductsPage` ?

Méthode : 3 variantes structurellement différentes montées dans la page existante via
`?variant=a|b|c` (dev uniquement) + barre flottante de commutation (`PrototypeSwitcher`).
Voir SKILL `prototype` (branche UI, sous-forme A).

## Verdict

**Variante B « Carte unifiée » retenue**, ajustée par l'utilisateur (icônes `size-6`,
textes `text-base`/`text-sm`, boutons `btn-sm`), puis promue en composant de production :

- `svelte-app/src/lib/components/eventProducts/SummaryBar.svelte`
  (en-tête prototype retiré, wrapper de positionnement retiré, prop `showProducts`
  ajoutée pour le cas event passé : segment produits masqué, dépenses seule)
- `EventProductsPage.svelte` : les 2 cartes orange d'origine remplacées par
  `<SummaryBar />` ; skeleton aligné (1 barre au lieu de 2 cartes).

Variantes non retenues conservées ici comme source primaire :
- `SummaryBarVariantA.svelte` — chips inline (action = bouton icône)
- `SummaryBarVariantC.svelte` — boutons porteurs de stats (affordance-first)
- `PrototypeSwitcher.svelte` — barre flottante `?variant=` réutilisable pour un
  futur prototype UI (sous-forme A) : flèches ←/→, clavier, dev-only.

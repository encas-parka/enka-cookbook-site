# 02: Quantité de création = besoin

**What to build:** créer un produit hors recettes avec une quantité déclare un besoin (quantité normalisée en unité, stockée dans les caractéristiques), sans créer d'achat associé. Le modal indique explicitement qu'il s'agit de produits hors recettes (en-tête : besoin en quantité, magasin, responsable).

**Blocked by:** None (can start immediately).

**Status:** done (02 — atterri 13-10, commits beb08988 + 881dd31e)

- [x] La création accepte une quantité, la normalise en unité (parité comportement historique) et la stocke comme besoin
  → `createProduct` accepte `quantity`/`unit`, normalise via `UnitConverter.normalize` (fallback `'unité'`, parité sœur) et stocke `specs = { quantity: {q,u}, pF, pS }` (ProductsStore.svelte.ts). La normalisation vit côté store (la sœur la fait dans le modal) — même sortie, invariant au point d'entrée unique.
- [x] Aucun achat n'est créé à la création produit
  → bloc `createPurchase` supprimé du modal ; test `createProduct avec quantité → specs.quantity normalisé (besoin), aucun achat créé` verrouille zéro purchase.
- [x] Le lecteur existant du besoin affiche la quantité saisie
  → `buildRawProductBase` lisait déjà `specs.quantity` ; test asserte `totalNeededArray` contient `{ q: 1000, u: 'gr.' }` après création 1 kg.
- [x] Le modal porte l'en-tête « hors recettes » (besoin, magasin, responsable)
  → alert-info en tête du formulaire (vérifié par relecture du markup + svelte-autofixer 0 issue — pas de test UI).

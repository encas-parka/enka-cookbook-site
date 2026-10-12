# 01: Corriger la création produit & achat (400 products/purchases)

**What to build:** depuis la page products d'un event, l'organisateur crée un produit
via le modal, et la validation rapide d'achat aboutit — y compris quand le produit
n'existe pas encore (création implicite). Plus aucune erreur 400 au POST.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §4, items `[!]`
création produit / création achat (stack traces console : `createProduct`,
`createPurchase` → 400 Bad Request).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Créer un produit via le modal aboutit : record créé, visible dans la liste,
      sans erreur console.
- [ ] Validation rapide d'un achat sur produit inexistant crée le purchase et le
      product implicite.
- [ ] Probe HTTP sur PB dev : create product et purchase par un membre de l'event
      → 200 (règles/hooks vérifiés au seam HTTP).
- [ ] Cause racine documentée dans le ticket (règle API, hook, ou champ requis
      manquant côté payload).
- [ ] Test vitest au seam store (PB stubbé) sur le chemin de création, vert.

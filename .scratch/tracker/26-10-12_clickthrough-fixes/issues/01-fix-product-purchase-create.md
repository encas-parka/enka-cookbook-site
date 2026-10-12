# 01: Corriger la création produit & achat (400 products/purchases)

**What to build:** depuis la page products d'un event, l'organisateur crée un produit
via le modal, et la validation rapide d'achat aboutit — y compris quand le produit
n'existe pas encore (création implicite). Plus aucune erreur 400 au POST.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §4, items `[!]`
création produit / création achat (stack traces console : `createProduct`,
`createPurchase` → 400 Bad Request).

> Arbitration investigation 12-10 (`mesuré`) : aucune création implicite de produit
> n'existe dans le code actuel — l'AC 2 est une construction, pas une régression à
> réparer.

**Blocked by:** None (can start immediately).

**Status:** done (vérifié aux seams HTTP + store ; re-click navigateur = porte T12)

## Diagnostique (12-10 — mesuré par sonde HTTP `scripts_dev/probe-t01-products.ts`)

**Cause racine = règle API, pas payload.** Les 5 règles (create/list/view/update/delete) de
`products` et `purchases` = `@request.auth.id != "" && (eventId.teams.members ~ auth ||
eventId.guestUsers ~ auth)` — aucune clause créateur. L'organisateur de l'event
`wqw07qq9ziy9kpw` (celui du click-through) est créateur, sans team, ni guest : chaque POST
reçoit 400 « Failed to create record. » avec `data` vide = rejet de règle (PB évalue la règle
avant la validation — l'erreur de relation purchases→products est masquée). La listRule
filtre au lieu de rejeter : `list products` → 200, 0 items — la page se rend sans erreur
console avec seulement les produits virtuels (needs).

**Second défaut, masqué par le premier** : la relation `purchases.products` exige des ids
record `[a-z0-9]{15}` ; la validation rapide référence l'id virtuel sémantique du besoin
(`slugProduit_eventShort`, ex. `cannelle_qq9ziy9kpw`) qui ne peut pas exister serveur. Une
fois la règle corrigée, ce défaut devient la cause active du 400 sur validation rapide →
création implicite du produit côté client (le client seul connaît les données du besoin),
puis re-key de la ligne needs locale (id sémantique → id serveur) pour que la fusion
needs↔produits (par égalité d'id, `#buildEnriched`) opère sans doublon d'affichage.

## Fix livré (12-10)

- **Serveur** : migration `1791700000_products_purchases_creator_rules.js` — clause
  `eventId.createdBy = @request.auth.id` ajoutée aux 5 règles des 2 collections (down
  restaure l'original). Prouve par sonde avant/après : create product 400→**200**, purchase
  sans relation 400→**200**, purchase ref inexistante 400 (règle)→**400 validation
  `products`** (`validation_missing_rel_records` — le second défaut devient visible),
  purchase ref réelle →**200**. Logs : `/tmp/orchestrate/probe-t01-after-26-10-12.log`.
- **Client** (`ProductsStore`) : `createPurchase` crée implicitement le produit virtuel
  (`#ensureSyncedProduct`) puis achète sur l'id serveur, et re-keye la ligne needs
  (`#rekeyNeedRow`) ; le recalcul des besoins (`#resolveNeedRows`) clé désormais chaque
  ligne sur le produit synchronisé correspondant (ingredientRef, sinon productName) — les
  ids remappés à l'import ne cassent plus la fusion ; `createProduct` pose `isSynced: true`
  (parité ère-Appwrite). Dead code `crypto.randomUUID()` supprimé.
- **Tests** : `products-store-create.test.ts` (4) — createProduct, achat direct, création
  implicite + re-key, recalcul clés sur produits synchronisés. Suite complète 136/136, check
  0 erreur (canon inchangé côté warnings).

> Re-click navigateur des deux flux (modal + validation rapide) : porte d'intégration T12.

- [x] Créer un produit via le modal aboutit : record créé, visible dans la liste,
      sans erreur console.
      *(Vérifié aux seams : sonde HTTP create product → 200 par le créateur ; vitest
      `createProduct` → record + miroir + modèle enrichi isSynced. L'appel UI du modal
      est inchangé — le 400 était le seul bloqueur.)*
- [x] Validation rapide d'un achat sur produit inexistant crée le purchase et le
      product implicite.
      *(Vitest seam store : `createPurchase` sur id virtuel → produit créé côté serveur,
      achat sur le nouvel id, needs re-keyés, vue fusionnée à une entrée.)*
- [x] Probe HTTP sur PB dev : create product et purchase par un membre de l'event
      → 200 (règles/hooks vérifiés au seam HTTP).
      *(Sonde avant/après : create product 200, purchase sans relation 200, purchase avec
      ref réelle 200 — par le créateur ; les membres/guests étaient couverts par les clauses
      d'origine. Logs `/tmp/orchestrate/probe-t01-after-26-10-12.log`.)*
- [x] Cause racine documentée dans le ticket (règle API, hook, ou champ requis
      manquant côté payload).
      *(Section Diagnostique ci-dessus — règle API, mesuré ; second défaut relation
      documenté.)*
- [x] Test vitest au seam store (PB stubbé) sur le chemin de création, vert.
      *(`products-store-create.test.ts`, 4 tests ; suite complète 136/136, 18 fichiers.)*

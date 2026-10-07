# Handoff — régressions click-through du 07-10 (post-runs audit-fixes)

> **RÉSOLUTION 07-10 (soir)** — P1/P2/P3 corrigés et validés, voir la section
> « Résolution » en bas de ce fichier. Deux résidus tracés (cold-start liveQuery,
> renommage uuid→ref dans le transform).

**Contexte** : click-through utilisateur après les 3 runs (`26-10-06_audit-fixes_done`, `26-10-06_svelte-legacy-triage_done`, `26-10-07_parite-index-tags_done` — journaux complets dans `.agents/plans/`). La branche est fonctionnelle sur les flux de création ; les problèmes ci-dessous sont apparus aux étapes suivantes.
**Protocole attendu** : *diagnose-first* (reproduire → isoler → racine → fix), pas de correctif à l'aveugle. Skills utiles : `diagnosing-bugs`, `pb-sync` (.agents/skills/).

## Root cause unificatrice confirmée (P1 + crash products)

**Le re-import (T17) a changé le shape du JSON en DB** : l'ancien import stockait du JSON **double-encodé** (chaîne JSON dans un champ json — « pattern assumé » de l'audit schema §7, lisible par `safeJsonParse(string)`). Le re-import via les transforms corrigés écrit du **JSON natif** — vérifié en DB (07-10) :
- `recipes.ingredients` = `[{"allergens":[],"name":"Ail",…}]` (natif)
- `products.store` = `{"storeName":"asf"}` (natif)

Or les lecteurs clients attendaient des **chaînes** (`safeJsonParse` fait `jsonString.trim` ; `parseIngredients` idem). L'API PB livre les champs json natifs comme arrays/objets → crash ou échec silencieux selon le lecteur.

**Direction de fix** : rendre les lecteurs tolérants aux deux shapes (`typeof === "string" ? JSON.parse : pass-through`) — helper unique ou normalisation à la frontière pb-sync. Inventorier TOUS les lecteurs de champs json : products (`safeJsonParse` sur store/specs/etc. — crash confirmé), recipes (`parseIngredients`, astuces, prepAlt…), materiel (`materiels`), events (meals, todos, guestEmails, contributors, date), teamdocs (tags — déjà natif depuis T02). Option alternative : re-double-encoder dans les transforms — déconseillé (perpétue l'accident, et l'API PB livre natif de toute façon).

## P1 — ingredients invisibles sur les pages recettes

- **Symptôme** : pas d'ingredients visibles (liste, page recette, édition, event recipes, event products). MAIS en onglet propre : `[RecipeDataStore] ✓ 845 ingrédients, 19 catégories` — la sync est **OK**.
- **Racine probable** : pas la sync — le **parsing des json de recette** côté pages (root cause unificatrice ci-dessus). Vérifier la console des pages recettes (erreurs probablement avalées par un try/catch de rendu).
- **Expliqué (pas un bug)** : « 19 catégories » = les `type=category` ; la DB porte 60 rows (19 category + 41 equipment_tag).
- **Résidu à élucider** : products en DB = **982** vs 1286 dans l'export prod (T17) — vérifier pourquoi (orphelins skippés par le transform ? dedup ?) — `2-transform-data.ts` warn logs ou comptage export vs DB.

## P2 — sauvegarde event impossible : DataCloneError

- **Symptôme** (exact) : `DataCloneError: Proxy object could not be cloned` à la sauvegarde — `EventEditPage.svelte:811` (`Erreur sauvegarde`).
- **Racine probable** : un objet `$state` (proxy Svelte 5 — le tableau `meals` du formulaire) est passé **tel quel** à Dexie (structured clone ne clone pas les proxies) ou au SDK PB. Le chemin meals a été re câblé en T5 (dérivation `date` depuis meals à chaque écriture).
- **Direction de fix** : copie plain avant persistance (`structuredClone(toRaw(…))`, `JSON.parse(JSON.stringify(…))`, ou un helper `toPlain()` au point d'entrée de la sauvegarde) — vérifier TOUS les write paths qui passent de l'état réactif à Dexie/PB (grep les `create(`/`update(`/`put(` alimentés par du `$state`). Le run triage a peut-être introduit d'autres chemins similaires.

## P3 — lock fantôme sur event/ dès la première édition

- **Symptôme** : un lock est signalé dès la première tentative (avant toute concurrence).
- **Pas encore de traces** — collecter : requêtes réseau de l'acquire (POST/PATCH locks + réponse), le contenu de la table `locks` au moment du fantôme (`sqlite3 -readonly pocketbase/pb_data/data.db "SELECT * FROM locks"`), et qui s'affiche comme détenteur.
- **Hypothèses de travail** : (a) l'écho SSE de sa propre écriture interprété comme lock concurrent (l'event SSE revient à l'émetteur — piège documenté au run audit-fixes, Étape 7) ; (b) parsing du format date PB (`expiresAt` avec **espace** : `2026-10-07 00:00:00.000Z`) — un `split("T")` ou une comparaison lexicale fausse peut rendre un lock non-expiré éternel (le helper `toInputDate` de T7 n'a couvert que loans/purchases) ; (c) `userName` vide (le champ existe depuis T3 — vérifier que pb-locks l'envoie bien et que l'UI l'affiche).

## P4 — Hugo ne démarre pas + objectif : SUPPRIMER Hugo

- **Symptôme** : `hugo server` : `failed to decode "caches": "getjson" is not a valid cache name` — la config hugo du repo utilise un nom de cache `getjson` abandonné par les Hugo récents (fusionné dans `getresource`). `dev:all` (concurrently, **sans** `--kill-others`) laisse alors Vite+PB tourner seuls → ECONNREFUSED du proxy sur `/images/` et `/icons/`.
- **Décision produit (utilisateur, 07-10)** : l'objectif de la migration est de **se passer entièrement de Hugo** — app Svelte + PocketBase only.
- **Chantier « Hugo removal »** (ticket dédié, pas un quick fix) :
  1. Inventorier tout ce que le client va chercher chez Hugo : `/icons/sprite-icons.svg`, `/icons/sprite.svg`, `/images/*` (favicon, og), et d'éventuels `/api/data.json` ou `/recipe/*/recipe.json` résiduels (grep fetch/axios sur ces chemins ; l'AGENTS.md dit RecipesStore simplifié PB-seul — vérifier qu'aucun lecteur de data.json ne subsiste).
  2. Migrer les assets nécessaires (sprites, favicon) dans `svelte-app/public/` (ou static), réécrire les URLs.
  3. Retirer la leg Hugo de `dev:all` (concurrently) et le proxy Hugo de `vite.config.ts`.
  4. À terme : les og:image recettes (déjà cassées côté Hugo, voir backlog) — même traitement ou abandon (décision produit déjà en backlog).
- **En attendant** : réparer le lancement Hugo (renommer `getjson` → `getresource` dans la config, ou épingler la version Hugo) si on veut encore générer les JSON pendant la transition.

## États et pointeurs

- Données PB saines post-re-import : ingredients 845/845 `updated` peuplés (23:04 06-10), categories 60 (19 category + 41 equipment_tag), products 982 (écart vs 1286 export à élucider).
- Runs de contexte : `.agents/plans/{26-10-06_audit-fixes,26-10-06_svelte-legacy-triage,26-10-07_parite-index-tags}_done/run.md`.
- Fichiers clés : `svelte-app/src/lib/db-sync/pb-collection.ts` (fallback L285, cursor T13) · `svelte-app/src/lib/utils/productsUtils.ts` (safeJsonParse L4) · `productEnrichment.ts` (buildRawProductBase L28) · `stores/ProductsStore.svelte.ts` (#buildEnriched L219) · `routes/EventEditPage.svelte` (save L811) · `services/pb-locks.ts` · `stores/TeamdocsStore.svelte.ts` (tags natif, référence de consommation json) · `scripts_dev/2-transform-data.ts` (shapes écrits).
- Backlog : ligne `!` click-through pointe ici ; ne pas réinitialiser pb_data ni IndexedDB avant diagnostic (l'état post-re-import est une pièce à conviction).

## Résolution (07-10, run click-through-fixes)

Protocole `diagnosing-bugs` : boucles de repro d'abord (vitest harnais + séquences HTTP live), fixes ensuite, 130/130 tests, check 0 erreur.

| # | Racine confirmée | Fix | Validation |
|---|---|---|---|
| P1-products | `safeJsonParse` : garde `jsonString?.trim()` hors try/catch → TypeError sur le JSON natif post-re-import | lecteur tolérant aux deux shapes (`productsUtils.ts`) | boucle rouge→verte |
| P2 DataCloneError | shadow draft `$state` d'EventEditPage → proxies atteignant le put optimiste Dexie (structured clone). `create()` passait au travers : PB d'abord, réponse plain ensuite — d'où « création OK / sauvegarde KO » | `toPlain()` aux entrées `create`/`update`/`batch` de `pb-collection.ts` | boucle rouge→verte |
| P3 lock fantôme | `updateRule` locks (`userId = @request.auth.id`) : reprise d'un lock **libéré** (`userId=""`) impossible → PB 404 → create 400 not_unique → `acquireLock` false. Les `expiresAt=1970` sont le marqueur normal de `releaseLock` | migration `1791400000_locks_takeover_rule.js` : `userId = @request.auth.id \|\| userId = "" \|\| expiresAt < @now` | boucle HTTP live rouge→verte (404→200) |
| P1-recettes | **4255/4255** objets ingrédients en DB portent `uuid` (shape Appwrite préservée par le transform), lecteur `parseIngredients` exigeait `ref` → filtrage silencieux 100 %, stores pleins, zéro erreur. Confirmation live : stores 456/845 peuplés, liveQuery OK, UI vide | `parseIngredients` accepte `ref \|\| uuid` et normalise vers `ref` | boucle rouge→verte + click-through utilisateur ✓ |

Bonus porté du pb-sync oupla (analyse sous-agent) : `ensureDbReady()` — open défensif Dexie + sanity-check des stores, branché dans `App.svelte` avant l'init auth. Couvre le scénario « base EnkaDB montée à une version supérieure » (v100 observée sur l'origin 5173 ; fake-indexeddb ne lève pas VersionError → sanity-check ajouté).

### Résidus tracés

1. **Cold-start liveQuery** : au premier chargement d'une base vide, les bridges singletons restent à 0 jusqu'au refresh, alors qu'un liveQuery créé après coup voit tout (mesuré : `recipeDataCount: 0` vs `liveQuery frais: 845` dans la même session). Non reproductible en harnais. À diagnostiquer séparément — non bloquant (refresh + realtime prennent le relais).
2. **Transform re-import** : `2-transform-data.ts` préserve le json tel quel ; pour un futur import propre, renommer `uuid → ref` dans les objets `ingredients` à la source (Phase 1.7). Le writer client écrit déjà `ref` (normalisation progressive à l'édition).
3. **Bug latent `remove()`** : `softDelete=true` appelle quand même `pb.delete()` (oupla fait un update serveur `{deleted:true}` dans ce cas). À tracker.

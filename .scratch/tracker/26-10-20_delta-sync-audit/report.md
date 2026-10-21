# Rapport d'audit — Delta sync `updated >= since` vs full-refetch

Type: research (audit du ticket [`01-audit-delta-vs-full-fetch.md`](issues/01-audit-delta-vs-full-fetch.md))
Date: 20-10-2026 · Méthode : lecture statique du code pb-sync + requêtes SQLite sur une copie de `pocketbase/pb_data/data.db` (lecture seule, aucune modification de code)

---

## TL;DR

**Recommandation : hybride** — garder le delta par défaut (il économise ~99 % du trafic de revalidation, mesuré), mais le soumettre à une règle d'invariant : *la portée du curseur doit coller à la portée du grant d'autorisation ; tout élargissement de périmètre déclenche un `resetCursor()`*. En pratique :

1. Généraliser le fix P12 au **join d'équipe** (trou actif confirmé, non constaté à l'écran, qui touche aussi `events` lui-même — pas seulement teamdocs/materiel).
2. Ajouter un garde-fou d'une ligne contre le « curseur empoisonné » : plafonner le curseur à l'horloge client (`min(maxUpdated, now - marge)`), ou full-refetch au premier boot du jour.
3. Ne pas full-refetcher systématiquement : le coût mesuré (1,8 MiB + ~700 upserts IndexedDB **par revalidation**, i.e. à chaque retour d'onglet > 30 s) n'achète qu'une version plus lente et plus chère de ce que `resetCursor` règle déjà en 3 lignes.

Le full-refetch systématique resterait la réponse la plus simple si le produit devenait multi-tenant lourd ou si les grants devenaient dynamiques au point d'être intrçables — ce n'est pas le profil actuel (5 déclencheurs d'élargissement inventoriés, 2 seulement actifs, 1 déjà couvert).

---

## 1. Réponses aux 3 questions du ticket

### Q1 — Qu'économise réellement le delta ?

**Ordre de grandeur : ~99,5 % du volume de revalidation, et surtout ~700 écritures IndexedDB évitées par revalidation.**

Méthode de mesure : §3. Chiffres clés (base locale `pocketbase/pb_data/data.db`, copie du 20-10) :

| Collection | Rows | JSON total | Part |
|---|---:|---:|---:|
| recipes | 456 | 1 589 KiB | 55 % |
| products | 975 | 501 KiB | scopé event (~24/event) |
| purchases | 956 | 422 KiB | scopé event (~23/event) |
| ingredients | 845 | 170 KiB | public |
| events | 41 | 104 KiB | |
| event_materiel | 281 | 102 KiB | scopé event |
| materiel | 111 | 35 KiB | |
| teamdocs | 23 | 25 KiB | |
| reste (loans, todos, teams, locks…) | 39 | 19 KiB | |
| **Total** | | **2,91 MiB** | |

- **Une revalidation delta** ramène typiquement **0–3 records** (mesuré : 1 recipe, 1 product, 1 purchase, 2 events, 2 teamdocs, 3 materiel mis à jour sur les 7 derniers jours) → quelques centaines d'octets à quelques KiB, ~6–8 requêtes HTTP quasi vides (une par collection, même nombre de requêtes qu'en full).
- **Une revalidation full** ramènerait **~1,8 MiB / ~700 records** (set orchestré [main.ts:105-114](../../../svelte-app/src/main.ts#L105-L114) : recipes 1 589 KiB/456 + events 104/41 + materiel 35/111 + loans 9/3 + teamdocs 25/23 + teams 2/8, + scope event courant ~22 KiB/~50). `ingredients`/`categories` (170 KiB) ne sont **pas** dans l'orchestrateur de resync — sync initiale seulement ([RecipeDataStore.svelte.ts:244](../../../svelte-app/src/lib/stores/RecipeDataStore.svelte.ts#L244), [304-305](../../../svelte-app/src/lib/stores/RecipeDataStore.svelte.ts#L304-L305)). Sur une liaison mobile (750 kbps) : ~19 s de fetch contre <1 s en delta.
- Le coût dominant n'est pas le réseau mais **le churn Dexie** : [pb-collection.ts:368-375](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L368-L375) fait un `get` + `put` par record dans la transaction → un full-refetch = ~700 opérations IndexedDB **à chaque retour d'onglet** (resync déclenché au-delà de 30 s de masquage : [main.ts:50](../../../svelte-app/src/main.ts#L50), [main.ts:170-182](../../../svelte-app/src/main.ts#L170-L182)). Un utilisateur desktop qui va-retourne dans son onglet 20×/jour : ~36 Mo/jour et ~14 000 opérations IDB/jour au lieu de ~quelques centaines de KiB. Sur le serveur : 1,6 MiB de sérialisation JSON par full-fetch recipes et par client (PB ~20 MiB RAM d'après `AGENTS.md`).
- **Le nombre de requêtes est identique** delta vs full (1 par collection, `getFullList` pagine à 500 — 456 recipes tiennent en 1 page) : le delta n'économise pas des allers-retours, il économise du **poids** et des **écritures locales**.

### Q2 — Quels bugs de classe « désync », et peuvent-ils être encadrés ?

Deux classes distinctes, de gravité et d'encadrement différents.

#### Classe A — « Élargissement de périmètre » (le grant grandit, pas les records)

Un record devient autorisé pour l'utilisateur **sans être modifié** : son `updated` reste antérieur au curseur → aucun delta ne le ramènera jamais, **et le SSE non plus** (PB ne pousse que les *changements* ; la souscription `*` de [pb-collection.ts:424-483](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L424-L483) est filtrée par les listRules côté serveur, donc un record ancien devenu visible n'émet aucun événement tant que personne ne le modifie). Le fallback full-fetch ne couvre que la table locale vide ([pb-collection.ts:349-358](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L349-L358)).

C'est la classe de P12. **Trou supplémentaire trouvé par cet audit, non listé dans le ticket** : le **join d'équipe** ne brise pas seulement teamdocs/materiel — il brise **`events` lui-même**. Le handler client [`GlobalState.svelte.ts:244-255`](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L244-L255) réagit au message SSE `team_joined` (émis par [teams-resync-events.pb.js](../../../pocketbase/pb_hooks/teams-resync-events.pb.js)) par un simple `eventsStore.forceRefresh()` = delta ([EventsStore.svelte.ts:329-335](../../../svelte-app/src/lib/stores/EventsStore.svelte.ts#L329-L335)). Or les events de l'équipe rejointe portent un `updated` ancien (l'ajout de membre modifie le record `teams`, pas les events ; règles effectives : `events.listRule = teams.members ~ auth || guestUsers ~ auth || createdBy = auth`, vérifié en DB). Pour un utilisateur dont le curseur `events` est récent, les events de l'équipe sont **invisibles silencieusement**. Le bug est *data-dependent* (il ne se manifeste que si le curseur du user est postérieur aux `updated` des events de l'équipe) — le pire genre, car il passe les tests manuels des comptes neufs (curseur époque `2000-01-01`, [pb-collection.ts:313](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L313)) et casse les caches établis.

**Encadrement possible : oui, complètement** — la classe est finie et traitable par événement (voir inventaire §4 et recommandation §5) : un `resetCursor()` posé au point où le grant grandit rend au delta son invariant. La primitive existe et est testée ([pb-collection.ts:405-408](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L405-L408), [pb-sync-reset-cursor.test.ts](../../../svelte-app/src/lib/stores/__tests__/pb-sync-reset-cursor.test.ts)).

Nuance structurelle importante : **les curseurs scopés s'auto-réparent pour cette classe**. `products`/`purchases` ([ProductsStore.svelte.ts:1073-1080](../../../svelte-app/src/lib/stores/ProductsStore.svelte.ts#L1073-L1080)) et `event_materiel` ([EventMaterielStore.svelte.ts:163-166](../../../svelte-app/src/lib/stores/EventMaterielStore.svelte.ts#L163-L166)) sont scopés par `eventId` ; avant d'être autorisé sur un event, l'utilisateur n'a **jamais de curseur pour ce scope** → premier accès = fetch époque. Leur granularité de curseur colle à leur granularité d'autorisation (`eventId.teams.members || eventId.guestUsers`). C'est l'invariant exact que les curseurs **globaux** (`recipes`, `events`, `teamdocs`, `materiel`, `materiel_loan`) ne respectent pas — leurs règles sont team/guest-scopées alors que le curseur est unique par collection.

#### Classe B — « Curseur empoisonné » (horloges)

Le curseur n'avance qu'atomiquement avec les upserts ([pb-collection.ts:367-384](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L367-L384)) et ne saute pas les batchs vides (`maxUpdated` retourne `''` → pas d'écriture : [pb-collection.ts:100-110](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L100-L110), [378](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L378)). Ces gardes éliminent les désynchronisations *mécaniques*. Reste le cas **horloge serveur** : si PB écrit des records avec un `updated` « futur » (NTP en avance, puis correction), le curseur monte au futur et **tous les records créés après correction sont < curseur** → trous permanents jusqu'à reset manuel. Aucune garde aujourd'hui : pas de plafond du curseur, pas de refetch périodique, la revalidation est purement delta ([main.ts:105-114](../../../svelte-app/src/main.ts#L105-L114)). Probabilité faible (serveur unique, PB autodate serveur), impact fort (trou silencieux persistant, même phénoménologie que P12). Encadrement : trivial (plafonner le curseur à `now client − marge` au moment de l'écriture, ou full-refetch au premier boot du jour).

Variante de la même famille : un **re-import/backfill serveur** qui recrée des records avec des `updated` préservés (mesuré : recipes importées 2022–2024, cf. §3) est invisible pour tout client dont le curseur est postérieur. Précédent de traitement : bump de version Dexie forçant la réouverture sans curseur (v10, [aw-db.ts:263-268](../../../svelte-app/src/lib/db-sync/aw-db.ts#L263-L268)). Coût de maintenance à documenter : toute opération serveur de masse sur `updated` exige un signal client (version Dexie ou resetCursor).

#### Angle « format datetime » (demandé par le ticket)

PB écrit `updated` en UTC, format fixe `YYYY-MM-DD HH:mm:ss.SSSZ` ; toute la chaîne curseur est **lexicale** (`maxUpdated` [pb-collection.ts:103-110](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L103-L110), comparaison d'égalité au bridge [aw-bridge.ts:65](../../../svelte-app/src/lib/db-sync/aw-bridge.ts#L65), filtre `updated >= {:since}` résolu côté serveur sur du TEXT SQLite). Aucun `new Date(updated)` dans db-sync (le seul `new Date` du module concerne les proxies `$state`, [pb-collection.ts:84](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L84)).

**Mesure sur la vraie base : 227/456 recipes (50 %) ont un `updated` SANS millisecondes** (`2024-03-27 19:32:00Z`, héritage de l'import Appwrite), et des timestamps en microsecondes existent (`2022-11-23 04:52:56.219000Z`). La divergence lexicale/chronologique existe (`…:00Z` trie lexiquement **au-dessus** de `…:00.999Z` de la même seconde ; `.219000Z` en-dessous de `.219Z` alors que les instants sont égaux) mais elle est **bornée à la seconde** et son sens est bénin : au pire elle force un re-fetch de ≤ 1 s de records, absorbé par le replay `>=` et l'upsert idempotent ([pb-collection.ts:316-318](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L316-L318)). Verdict : le tri lexical est fiable **pour les valeurs écrites par PB** ; l'hétérogénéité d'import est un invariant à documenter, pas un bug actif. Le harnais de test fait le même choix documenté ([stub-pb.ts:14-17](../../../svelte-app/src/lib/stores/__tests__/harness/stub-pb.ts#L14-L17)).

### Q3 — Garder / full-refetch / hybride ?

**Hybride** (détaillé en §5). Synthèse du arbitrage :

| Option | Classe A | Classe B | Coût par revalidation | Verdict |
|---|---|---|---|---|
| Delta tel quel | ❌ trous persistants (P12 + join team) | ❌ | ~KiB | Rejeté — déjà 1 bug utilisateur, 1 trou confirmé de plus |
| Full-refetch systématique | ✅ rattrapé au cycle suivant | ✅ (pas de curseur) | ~1,9 MiB + ~690 upserts IDB, ~20 s en mobile | Rejeté — le délai de rattrapage A n'est de toute façon que « la prochaine revalidation » ; le prix est payé 20×/jour pour un bug réparable à la source. Note : ne change **rien** aux deletes (upsert-only : les suppressions convergent uniquement par SSE, delta comme full) |
| **Hybride** : delta + `resetCursor` sur événement de grant + garde anti-poison | ✅ à la source | ✅ | ~KiB en régime normal, ~200 KiB sur événement de grant (rare) | **Retenu** |

---

## 2. Preuves sourcées (par affirmation)

| Affirmation | Source |
|---|---|
| Curseur delta `updated >= since`, persisté dans `syncMeta` (`${collection}:${scopeKey}` ou `${collection}`) | [pb-collection.ts:291-293](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L291-L293), [309-326](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L309-L326) |
| Curseur époque par défaut `2000-01-01 00:00:00.000Z` (premier sync = full) | [pb-collection.ts:313](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L313) |
| Fallback full-fetch **uniquement si table locale vide** | [pb-collection.ts:349-358](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L349-L358) |
| Transaction unique upserts + curseur (pas de curseur sur batch vide) | [pb-collection.ts:367-384](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L367-L384), `maxUpdated` [100-110](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L100-L110) |
| Primitive `resetCursor(scopeKey?)` (delete de la clé syncMeta, pas de fenêtre vide) | [pb-collection.ts:405-408](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L405-L408) |
| SSE : souscription par collection, filtrée par les règles serveur ; ne pousse que les changements | [pb-collection.ts:424-483](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L424-L483) ; signaux connect/disconnect : [pb-realtime.ts:62-99](../../../svelte-app/src/lib/db-sync/pb-realtime.ts#L62-L99) |
| Orchestrateur de resync : visibilitychange > 30 s, reconnect SSE, online — debounce 500 ms — 6 stores authentifiés | [main.ts:50](../../../svelte-app/src/main.ts#L50), [90-133](../../../svelte-app/src/main.ts#L90-L133), [140-163](../../../svelte-app/src/main.ts#L140-L163), [170-182](../../../svelte-app/src/main.ts#L170-L182), [226](../../../svelte-app/src/main.ts#L226) |
| **Scopes de curseur par store** : `recipes` global ([RecipesStore.svelte.ts:162](../../../svelte-app/src/lib/stores/RecipesStore.svelte.ts#L162)) · `events` global ([EventsStore.svelte.ts:295](../../../svelte-app/src/lib/stores/EventsStore.svelte.ts#L295)) · `teamdocs` global ([TeamdocsStore.svelte.ts:132](../../../svelte-app/src/lib/stores/TeamdocsStore.svelte.ts#L132)) · `materiel` + `materiel_loan` globaux ([MaterielStore.svelte.ts:276,280](../../../svelte-app/src/lib/stores/MaterielStore.svelte.ts#L276-L280)) · `products`/`purchases` scopés `eventId` ([ProductsStore.svelte.ts:1073-1080](../../../svelte-app/src/lib/stores/ProductsStore.svelte.ts#L1073-L1080), revalidation [1757-1764](../../../svelte-app/src/lib/stores/ProductsStore.svelte.ts#L1757-L1764)) · `event_materiel` scoppé ([EventMaterielStore.svelte.ts:163-166](../../../svelte-app/src/lib/stores/EventMaterielStore.svelte.ts#L163-L166)) · `ingredients`/`categories` globaux publics ([RecipeDataStore.svelte.ts:304-305](../../../svelte-app/src/lib/stores/RecipeDataStore.svelte.ts#L304-L305)) · `teams` **hors pb-sync** : full-refetch à chaque revalidation ([NativeTeamsStore.svelte.ts:244-269](../../../svelte-app/src/lib/stores/NativeTeamsStore.svelte.ts#L244-L269)) |
| Fix P12 : `resetCursorAndSync()` teamdocs + resync events au join | [JoinPage.svelte:84-92](../../../svelte-app/src/lib/routes/JoinPage.svelte#L84-L92), [TeamdocsStore.svelte.ts:157-160](../../../svelte-app/src/lib/stores/TeamdocsStore.svelte.ts#L157-L160) |
| Le join d'event bumpé l'event (guestUsers écrits + save) → delta rattrape l'event lui-même | [join-event.pb.js:146-150, 209-219](../../../pocketbase/pb_hooks/join-event.pb.js#L146-L150) |
| Le join d'équipe ajoute `members` côté serveur **sans toucher aux events/teamdocs/materiel** | [invite-to-team.pb.js:121-150](../../../pocketbase/pb_hooks/invite-to-team.pb.js#L121-L150) |
| Notification SSE `team_joined` consommée par un simple `forceRefresh()` (= delta) — **pas de resetCursor** | [teams-resync-events.pb.js:76-82](../../../pocketbase/pb_hooks/teams-resync-events.pb.js#L76-L82), [GlobalState.svelte.ts:244-255](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L244-L255), [EventsStore.svelte.ts:329-335](../../../svelte-app/src/lib/stores/EventsStore.svelte.ts#L329-L335) |
| Règles effectives (DB live, post-migrations) : `events = teams.members ∨ guestUsers ∨ createdBy` ; `teamdocs = teamId.members ∨ eventId.teams.members ∨ eventId.guestUsers ∨ eventId.createdBy` ; `materiel = ownerUser ∨ teamId.members` ; `materiel_loan = borrowerUser ∨ ownerId.members` ; `products`/`purchases`/`event_materiel = eventId.teams.members ∨ eventId.guestUsers ∨ eventId.createdBy` ; `recipes`/`ingredients`/`categories` **publics** ; `notifications = userId = auth` ; aucune règle ne lit `roles` ni `guestEmails` | `SELECT name, listRule FROM _collections` sur `pocketbase/pb_data/data.db` (20-10) ; commentaires [1791278800_rules_api_hardening.js:16-18](../../../pocketbase/pb_migrations/1791278800_rules_api_hardening.js#L16-L18) |
| Historique des règles teamdocs (clause créateur ajoutée après le T04) | [1791900000_teamdocs_creator_rules.js:32-33](../../../pocketbase/pb_migrations/1791900000_teamdocs_creator_rules.js#L32-L33), [1791280500_teamdocs_team_scoped_rules.js:16-17](../../../pocketbase/pb_migrations/1791280500_teamdocs_team_scoped_rules.js#L16-L17) |
| Aucune règle ne lit `roles` (le rôle ne change pas la visibilité list) | règles effectives ci-dessus + [1791500000_teams_roles_and_materiel_delete_rules.js](../../../pocketbase/pb_migrations/1791500000_teams_roles_and_materiel_delete_rules.js) (deleteRule seulement) |
| Changement d'identité = purge curseurs (epoch garanti) | `clearLocal` [pb-collection.ts:932-942](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L932-L942) ; purge identité [GlobalState.svelte.ts:279-289](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L279-L289) |
| Précédent de guérison par bump de version Dexie (curseurs réouverts à époque) | [aw-db.ts:263-268](../../../svelte-app/src/lib/db-sync/aw-db.ts#L263-L268) |
| Comparaisons lexicales pures (aucun `new Date(updated)` dans db-sync) | `grep new Date(` sur `db-sync/` → [pb-collection.ts:84](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L84) seulement |
| `event_todos` hors périmètre (todos embarqués dans `events.meals`, collection non syncée) | [event-todo.utils.ts:7](../../../svelte-app/src/lib/utils/event-todo.utils.ts#L7) |

---

## 3. Mesures d'économie (méthode)

**Méthode.** `sqlite3` installé ; la DB live étant verrouillée par le serveur PB, travail sur copie (`cp pocketbase/pb_data/data.db /tmp/opencode/audit-data.db`). Deux passes :

1. **Taille JSON par record** (proxy de la charge utile HTTP, PB sérialisant les rows en JSON) : script `bun:sqlite` sérialisant chaque row (`JSON.stringify(row)`) — total, moyenne, min/max par collection. Vérification croisée : `dbstat` (tailles on-disk table+index : recipes 1 632 KiB, cohérent avec 1 589 KiB de JSON).
2. **Distribution de fraîcheur** (`updated >= datetime('now','-N day')`) : volume qu'une revalidation delta ramène en régime normal.

**Résultats.**

```
recipes          rows=456   json_total=  1589 KiB  avg=3568 B/row   ← 55 % du total
products         rows=975   json_total=   501 KiB  avg= 526 B/row   (scopé event)
purchases        rows=956   json_total=   422 KiB  avg= 452 B/row   (scopé event)
ingredients      rows=845   json_total=   170 KiB  avg= 206 B/row
events           rows=41    json_total=   104 KiB  avg=2594 B/row
event_materiel   rows=281   json_total=   102 KiB  avg= 373 B/row   (scopé event)
materiel         rows=111   json_total=    35 KiB  avg= 325 B/row
teamdocs         rows=23    json_total=    25 KiB  avg=1107 B/row
materiel_loan    rows=3     json_total=     9 KiB
event_todos      rows=17    json_total=     5 KiB   (hors pb-sync)
teams+locks+share_links+categories      ~13 KiB
TOTAL                                   2,91 MiB
```

Fraîcheur (7 derniers jours) : recipes **1**, products **1**, purchases **1**, events **2**, teamdocs **2**, materiel **3** → une revalidation delta typique ramène 0–3 records/collection.

**Anomalie de format détectée au passage** : `updated` sans millisecondes sur **227/456 recipes** (`2024-03-27 19:32:00Z`, import Appwrite) ; microsecondes sur certaines (`2022-11-23 04:52:56.219000Z`) ; `ingredients`/`events`/`teamdocs` : 0 anomalie (format PB canonique). Impact analysé en §2/Q2 — bénin, à documenter.

**Projection de coût** (utilisateur desktop, 20 retours d'onglet > 30 s/jour, cf. seuil [main.ts:50](../../../svelte-app/src/main.ts#L50)) :

| | Delta (actuel) | Full-refetch |
|---|---:|---:|
| Trafic/jour | ~0,1–0,5 MiB (quelques KiB × 20, + slices event) | ~36 MiB (1,8 MiB × 20) |
| Opérations Dexie/jour (upserts) | ~0–40 | ~14 000 (~700 × 20) |
| Latence resync (4G, 750 kbps) | < 1 s | ~19 s |
| Requests HTTP par revalidation | ~6–8 (identiques au full) | ~6–8 |

---

## 4. Inventaire des déclencheurs d'« élargissement de périmètre » et couverture

Règles effectives lues en DB (§2). Un « ✅ de facto » signifie : couvert sans code dédié, par construction.

| # | Déclencheur | Point d'entrée client | Visibilité élargie sur (clause) | `updated` bumpé ? | Couverture `resetCursor` / autre aujourd'hui |
|---|---|---|---|---|---|
| 1 | **Join d'event par share link** | [`/join/:linkId`](../../../svelte-app/src/lib/routes/JoinPage.svelte) → POST `/api/enka/join-event` | `events` (guestUsers) ; `teamdocs`, `products`, `purchases`, `event_materiel` (eventId.guestUsers) | **events : OUI** (le hook sauve l'event) ; enfants : NON | `events` : delta (bump) ✅ · `teamdocs` : `resetCursorAndSync` ✅ ([JoinPage.svelte:92](../../../svelte-app/src/lib/routes/JoinPage.svelte#L92)) · `products`/`purchases`/`event_materiel` : ✅ **de facto** (premier accès au scope → pas de curseur → époque, [pb-collection.ts:313](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L313)) |
| 2 | **Join d'équipe** (invitation email acceptée) | **Aucun point d'entrée client dédié** (AcceptInvite supprimé) : ajout serveur direct ; le client apprend le join par le message SSE `team_joined` | `events` (teams.members) ; `teamdocs` (teamId.members, eventId.teams.members) ; `materiel` (teamId.members) ; `materiel_loan` (ownerId.members) ; `products`/`purchases`/`event_materiel` (eventId.teams.members) ; `teams` (members, hors pb-sync) | **AUCUN** des records élargis (seul `teams` est modifié) | ❌ **NON COUVERT** : `team_joined` → `eventsStore.forceRefresh()` = delta ([GlobalState.svelte.ts:254](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L254)) → les events d'équipe à `updated` ancien restent invisibles (caches établis). teamdocs/materiel/loans : aucun appel. Scopés : ✅ de facto à la première visite de chaque event |
| 3 | Retrait d'équipe (`team_left`) | idem #2 | rétrécissement (pas de trou delta ; l'inverse : rows fantômes en cache, purgées seulement par logout — hors périmètre de ce ticket, à tracker séparément si pertinent) | — | hors scope |
| 4 | Ajout `permissionWrite` (partage de recette) | UI recettes → update `recipes` | **aucun** (recipes listRule public ; permissionWrite ne porte que l'updateRule) | oui (record modifié) | N/A — pas d'impact visibilité list |
| 5 | Changement de rôle team (`roles`) | UI team → update `teams` | **aucun** (aucune listRule effective ne lit `roles`) | oui (sur `teams`) | N/A |
| 6 | `guestEmails` / joinToken | — | aucun (aucune règle ne les lit, [1791278800:16-18](../../../pocketbase/pb_migrations/1791278800_rules_api_hardening.js#L16-L18)) | — | N/A |
| 7 | Transfert de propriété (`ownerUser` materiel, `borrowerUser` loan) | UI materiel/loan | `materiel`/`materiel_loan` pour le nouveau owner | oui (record modifié → delta le rattrape) | ✅ delta (le record lui-même change) |
| 8 | Nouvel appareil / logout→login / changement d'utilisateur | purge identité | tout | — | ✅ par design (`clearLocal` supprime les curseurs, [pb-collection.ts:932-942](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L932-L942)) |
| 9 | Re-import / backfill serveur sur `updated` préservés | scripts_dev (ops) | tout ré-importé | non | ❌ aucun signal client automatique ; traitement par bump de version Dexie (précédent v10, [aw-db.ts:263-268](../../../svelte-app/src/lib/db-sync/aw-db.ts#L263-L268)) — à documenter comme procédure |
| 10 | Horloge serveur en avance puis corrigée (classe B) | — | records créés après correction | non (futurs) | ❌ aucune garde (ni cap curseur, ni refetch périodique) |

**Bilan** : 2 déclencheurs actifs de classe A (join event ✅ couvert, join team ❌ non couvert), 1 classe B non gardée (#10), 1 procédural (#9). Les collections à curseur global (`recipes`, `events`, `teamdocs`, `materiel`, `materiel_loan`) sont précisément celles dont les règles d'autorisation ne sont pas globales — c'est la faille structurelle.

---

## 5. Recommandation finale + brouillon d'ADR

### Recommandation

**Hybride « delta par défaut, refetch complet piloté par les événements d'autorisation »** :

1. **Généraliser le fix P12 au join d'équipe** (couvre #2) : dans le handler `team_joined` de [GlobalState.svelte.ts:244-255](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L244-L255), invoquer `resetCursor()` + resync sur `events`, `teamdocs`, `materiel`, `materiel_loan` avant `forceRefresh()`. Coût : un refetch full de ~170 KiB / ~180 records, sur un événement rare (invitation d'équipe acceptée), au lieu d'un trou silencieux. Les stores exposent déjà le pattern (`resetCursorAndSync` teamdocs ; `syncRevalidate` existe partout).
2. **Garde anti-curseur empoisonné** (couvre #10) : dans `initialFetch` ([pb-collection.ts:364](../../../svelte-app/src/lib/db-sync/pb-collection.ts#L364)), écrire `newCursor = min(maxUpdated(records), now_client − marge)` (marge ~5 min). Une ligne, zéro coût régime normal, élimine la seule façon mécanique restante de sauter des records. (Alternative équivalente : full-refetch au premier boot du jour — plus lourd, couvrirait aussi #9.)
3. **Documenter la procédure #9** : toute backfill/migration serveur touchant `updated` en masse exige un bump de version Dexie (ou un resetCursor diffusé) — consigné dans l'ADR et `docs/svelte-app.md`.
4. **Ne rien changer aux scopes** : l'appariement curseur-scope/grant des collections event-scopées est correct ; c'est le modèle à conserver.

### Brouillon d'ADR (à ne pas écrire dans `docs/adr/` sans accord)

```markdown
# ADR — <NNN> : Delta sync conservé par défaut ; invalidation du curseur
# pilotée par les événements d'autorisation

Date : 2026-10-20 · Statut : proposé

## Contexte

La couche pb-sync synchronise PocketBase → Dexie par delta `updated >= since`,
curseur persisté par collection/scope dans `syncMeta`
(svelte-app/src/lib/db-sync/pb-collection.ts). Le delta économise ~99 % du
volume de revalidation mesuré (1,9 MiB / ~690 records en full contre 0–3
records en delta ; revalidation à chaque retour d'onglet > 30 s, reconnect SSE
et online — src/main.ts) et surtout ~690 écritures IndexedDB par revalidation.

Il introduit une classe de bugs : tout record devenu visible par élargissement
d'autorisation sans être modifié (join d'event par share link, join d'équipe)
reste invisible — son `updated` précède le curseur, le SSE ne pousse que les
changements, et le fallback full-fetch ne couvre que la table locale vide.
Constaté en production de dev (P12, click-through 20-10 : teamdocs d'un event
invisible après join) ; le même mécanisme rend les events d'une équipe rejointe
invisibles pour les caches établis (cursor récent > updated des events).

Les collections dont le curseur est scopé à la granularité de leur règle
d'autorisation (products/purchases/event_materiel, scope = eventId) sont
immunes par construction : avant autorisation, aucun curseur n'existe pour le
scope, le premier accès fetch depuis l'époque.

Une seconde classe, plus rare : un `updated` futur (dérive d'horloge serveur)
empoisonne le curseur et fait sauter tous les records postérieurs à la
correction.

## Décision

1. Le delta sync reste le régime par défaut de toutes les collections.
2. Invariant : la portée d'un curseur delta doit être identique à la portée du
   grant d'autorisation correspondant. Tout événement qui élargit un grant
   déclenche resetCursor() (+ resync) sur les collections concernées :
   - join d'event (share link) → teamdocs (en place, fix P12) ;
   - join d'équipe (message SSE team_joined) → events, teamdocs, materiel,
     materiel_loan.
   Les collections scopées par event n'en ont pas besoin (auto-réparation par
   curseur absent).
3. Garde anti-poison : le curseur écrit dans syncMeta est plafonné à
   min(maxUpdated(records), horloge client − marge).
4. Procédure : tout backfill serveur massif réécrivant `updated` impose un
   bump de version Dexie (reset des curseurs) ou un resetCursor diffusé.

## Alternatives rejetées

- **Full-refetch systématique** : corrige les deux classes au prix de
  ~1,8 MiB et ~700 upserts IndexedDB par revalidation (~19 s en 4G), pour un
  gain de robustesse obtenu autrement pour ~3 lignes par événement de grant.
  Ne change rien aux suppressions (upsert-only : convergence par SSE
  uniquement). Reste l'option de repli si les grants devenaient intrçables
  côté client.
- **Curseur par grant** (une entrée syncMeta par couple
  utilisateur×grant) : invariant strictement respecté, mais suppose de
  connaître et historiser les grants côté client (guestUsers, memberships) —
  complexité et surface d'erreur supérieures pour un résultat équivalent dans
  notre régime (grants rares et disruptifs).

## Conséquences

- Chaque NOUVEAU déclencheur d'élargissement de périmètre (nouvelle règle
  listRule fondée sur une relation dynamique) doit appeler resetCursor au
  point client correspondant — la règle est testable unitairement
  (pattern pb-sync-reset-cursor.test.ts).
- Le plafond du curseur introduit une dépendance à l'horloge client pour la
  borne haute seulement ; une horloge client en retard ne fait que re-fetcher.
```

---

## 6. Impact sur le fix P12 existant

- **Le fix P12 reste valable tel quel** ([JoinPage.svelte:88-92](../../../svelte-app/src/lib/routes/JoinPage.svelte#L88-L92)) : la recommandation le **généralise** (join team), elle ne le rend pas superflu et ne remet pas le code en question.
- Compléments recommandés (priorisé) :
  1. `team_joined` → `resetCursor` sur `events` + `teamdocs` + `materiel` + `materiel_loan` avant resync ([GlobalState.svelte.ts:244-255](../../../svelte-app/src/lib/stores/GlobalState.svelte.ts#L244-L255)) — répare le trou trouvé par cet audit ;
  2. plafond du curseur dans `initialFetch` (classe B) ;
  3. test unitaire du pattern « resetCursor sur événement de grant » appliqué au join team (le pattern existe : [pb-sync-reset-cursor.test.ts](../../../svelte-app/src/lib/stores/__tests__/pb-sync-reset-cursor.test.ts)).
- À tracker séparément (hors périmètre delta) : les rows fantômes après retrait d'équipe (`team_left`) — ni delta ni full-refetch ne retire des lignes ; seule la purge d'identité les enlève aujourd'hui.

---

## Annexes

### A. Règles effectives listRule (DB live, 20-10)

```
categories      | (public — vide)
event_materiel  | auth && (eventId.teams.members ~ auth || eventId.guestUsers ~ auth || eventId.createdBy = auth)
event_todos     | auth && (eventId.teams.members ~ auth || eventId.guestUsers ~ auth)
events          | auth && (teams.members ~ auth || guestUsers ~ auth || createdBy = auth)
ingredients     | (public — vide)
locks           | auth
materiel        | auth && (ownerUser = auth || teamId.members ~ auth)
materiel_loan   | auth && (borrowerUser = auth || ownerId.members ~ auth)
notifications   | auth && userId = auth
products        | auth && (eventId.teams.members ~ auth || eventId.guestUsers ~ auth || eventId.createdBy = auth)
purchases       | auth && (eventId.teams.members ~ auth || eventId.guestUsers ~ auth || eventId.createdBy = auth)
recipes         | (public — vide)
share_links     | auth && createdBy = auth
teams           | auth && members ~ auth
teamdocs        | auth && (teamId.members ~ auth || eventId.teams.members ~ auth || eventId.guestUsers ~ auth || eventId.createdBy = auth)
```

### B. Commandes de mesure reproductibles

```bash
cp pocketbase/pb_data/data.db /tmp/opencode/audit-data.db
sqlite3 /tmp/opencode/audit-data.db "SELECT COUNT(*) FROM recipes WHERE updated >= datetime('now','-7 day');"
# taille JSON par row : script bun:sqlite (JSON.stringify par row), voir §3
sqlite3 /tmp/opencode/audit-data.db "SELECT name, ROUND(SUM(pgsize)/1024.0) FROM dbstat GROUP BY name ORDER BY 2 DESC LIMIT 10;"
```

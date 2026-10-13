# 10: Durcissement double-création d'event (diag + garde conditionnelle)

**What to build:** la création de deux events successifs ne duplique jamais un
event, même sur connexion fragile. L'exposition réelle du bug historique
offline-first est tranchée par l'investigation du code, pas par un test click-through
non décisif.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §3 : « le test n'est
pas décisif [connexion instable pendant le test]. Investiguer le code et vérifier
si possibilité/nécessité de renforcer ». (Les events dupliqués dans la source sont
un non-bug connu, hors périmètre.)

**Blocked by:** 06 (même zone d'écriture — store events — écrivain unique).

**Status:** done (13-10)

## Verdict d'exposition — EXPOSÉ (fenêtre étroite), garde livrée

**Le bug historique (file de replay offline-first) n'existe plus** — mesuré :
`pb-collection.create` est server-first (un seul `pb.collection().create`, miroir
Dexie APRÈS la réponse ; throw → rien de persisté, rien de rejoué). Le double-clic
est couvert par `isBusy` (boutons/overlay/formulaires disabled). Aucun retry
automatique : le SDK pocketbase 0.26.8 ne contient aucune logique de retry
(0 occurrence de « retry » dans le dist), et l'util `executeWithRetry` du projet
n'a aucun consommateur (code mort).

**La fenêtre résiduelle est réelle** : requête partie + réponse perdue (timeout,
connexion mobile) → le serveur a créé l'event, le client toast « Erreur lors de la
création » → re-soumission manuelle → **doublon** — et il n'existe aucune UI de
suppression d'event : le doublon est une pollution permanente. C'est exactement le
scénario « connexion fragile » de la user story 14.

**Garde livrée (client-only, aucune migration)** — le contrat serveur est mesuré
par la sonde `scripts_dev/probe-t10-event-idempotency.ts` (log
`/tmp/orchestrate/probe-t10-idempotency-26-10-13.log`) : PB 0.37.5 préserve l'id
client fourni au create et rejette un second create portant le même id
(`400 validation_not_unique` sur le champ `id`) ; relecture sous l'id → 200, id
inconnu → 404. L'id client est donc une clé d'idempotence :

- `newPbId()` (`$lib/utils/pb-id`) — id PB [a-z0-9]{15} (customAlphabet nanoid).
- `EventCreatePage.saveEventData` génère la clé paresseusement à la première
  tentative et la réutilise tant que le formulaire vit (même intention de
  soumission) ; le succès navigue, la clé meurt avec la page.
- `EventsStore.createEventWithTeams(data, teamIds, submissionKey?)` : en cas
  d'échec de create avec clé, réconciliation par relecture sous la clé
  (`#collection.view`) — record trouvé et `createdBy` = user courant → retourné
  comme succès (+ remiroir Dexie : le SSE a pu manquer pendant la panne) ;
  clé absente/inconnue → l'erreur d'origine est relancée telle quelle. L'appelant
  ne peut pas bypasser : sans clé, comportement antérieur inchangé.
- Le harness `stub-pb.ts` rejette désormais un id client dupliqué (contrat wire
  mesuré), pour des tests fidèles.

**Tests** : `events-store-create.test.ts` (4 — rouges avant fix : 2 failed/2
passed, log `/tmp/orchestrate/vitest-t10-red-26-10-13.log` ; verts après, log
`/tmp/orchestrate/vitest-t10-green-26-10-13.log`) ; canon : check 0 erreur /
6 warnings, suite **171/171, 25 fichiers** (logs
`/tmp/orchestrate/tests-check-26-10-13-fix10.log`,
`/tmp/orchestrate/tests-vitest-26-10-13-fix10.log`). Commits : `6e4d342d`
(sonde), `4c15912e` (garde + tests + README db-sync § Create idempotency seam).

**Limites assumées** : la clé vit par session de formulaire — un utilisateur qui
recharge la page après l'erreur et retape tout génère une nouvelle clé (la
fenêtre redevient théorique, et l'event déjà créé est alors visible dans son
dashboard via SSE/delta avant toute re-création). Dédupe par nom+date écarté :
heuristique à faux positifs là où l'id serveur garantit exactement.

- [x] Investigation du chemin de création : exposition confirmée (fenêtre étroite :
      retry ambigu + re-soumission manuelle) — décision documentée ci-dessus.
- [x] Si exposé : garde d'idempotence/dedup côté client posée + test vitest vert.
- [x] Si non exposé : n/a (exposé — voir verdict).

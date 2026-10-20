# ADR 0001 — Curseurs de session : delta intra-session, rattrapage complet à chaque début de session

Date : 2026-10-20 · Statut : accepté (consolidée le même jour — révision de la
première version, jamais publiée ; le commit `01b5f6fa` implémente le
sous-ensemble qui reste valable)

## Contexte

La couche pb-sync synchronise PocketBase → Dexie par delta `updated >= since`,
curseur persisté par collection/scope dans `syncMeta`
([pb-collection.ts](../../svelte-app/src/lib/db-sync/pb-collection.ts)). Le
delta économise ~99 % du volume de revalidation mesuré (1,9 MiB / ~690 records
en full contre 0–3 records en delta) et surtout ~690 écritures IndexedDB par
revalidation (orchestrateur : retour d'onglet > 30 s, reconnect SSE, online —
`src/main.ts`, `App.svelte`).

Deux classes de bugs lui sont inhérentes :

- **Classe A — élargissement d'autorisation** : un record devient visible
  sans être modifié (join d'event par share link, join d'équipe, invitation).
  Son `updated` précède le curseur → aucun delta ne le ramène, et le SSE ne
  pousse que les changements : trou silencieux. Constaté en production de dev
  (P12, click-through 20-10) ; le même mécanisme rendait les données d'une
  équipe rejointe invisibles pour les caches établis. Et le message SSE
  `team_joined` n'est pas rejoué : un join survenu pendant une déconnexion
  n'est rattrapé par aucun signal.
- **Classe B — curseur empoisonné** : un `updated` futur (dérive d'horloge
  serveur, puis correction NTP) hisse le curseur au-dessus du présent — tous
  les records écrits après correction passent sous le curseur : trou
  permanent.

Le principe : un curseur delta n'est sain que si l'ensemble visible n'évolue
que par mutation. Un changement d'autorisation fait évoluer l'ensemble visible
par inclusion de records intouchés — aucun timestamp ne peut le voir.

Les collections se répartissent ainsi (règles effectives en annexe du rapport
d'audit `.scratch/tracker/26-10-20_delta-sync-audit/report.md`) :

- **Curseur aligné sur le grant par nature** : `recipes`/`ingredients`
  (publics) — delta global sain ; `products`/`purchases`/`event_materiel`
  (scope `eventId`) — immunes par construction (pas de curseur avant
  l'autorisation sur ce scope).
- **Grant dynamique, volume borné** : `events`, `teamdocs`, `materiel`,
  `materiel_loan` — 178 records / ~173 KiB mesurés. Leur curseur global ne
  colle pas à leur grant (team ∨ guest ∨ créateur) : c'est la faille
  structurelle qui a produit les trous.

## Décision

1. **Le delta reste le régime des collections à curseur aligné** (public ou
   scopé au grant).
2. **Curseurs de session** pour les collections à grant dynamique : le
   curseur est reseté à chaque début de session (`syncInitial` — boot,
   login), le fetch complet qui suit rattrape tout ce qui a été manqué
   pendant l'absence, mutations ET élargissements. Entre deux sessions, le
   delta intra-session rattrape les mutations manquées (déconnexions SSE) —
   c'est son cœur de métier, sans problème de grant (une mutation bump
   l'`updated` d'un record déjà visible).
3. **Filet TTL** : une session en arrière-plan au-delà de 24 h repasse par un
   reset au prochain déclenchement de resync (les messages `team_joined`
   manqués pendant l'arrière-plan sont rattrapés).
4. **Reset ciblé en session** : tout événement d'élargissement connu appelle
   `resetCursor()` + resync au point client correspondant (handler SSE
   `team_joined` → events/teamdocs/materiel/materiel_loan ; join d'event par
   share link → P12). Pattern testé (`globalstate-team-join-resync`).
5. **Garde anti-poison** : le curseur écrit dans `syncMeta` est plafonné à
   `min(maxUpdated(records), horloge client − 5 min)`, au format PB
   (`YYYY-MM-DD HH:mm:ss.SSSZ` — un plafond au format ISO trierait
   lexiquement au-dessus de tout timestamp PB du même jour). Sûreté :
   `min()` ne peut qu'abaisser le curseur, donc au pire re-fetcher — jamais
   sauter.
6. **Borne de population (`epochFilter`)** : le fetch complet de session des
   events est borné à `dateEnd >= now − 90 jours` (les events sans date sont
   inclus — `dateEnd = ''` —, le champ n'étant pas requis au schéma). La
   borne ne s'applique JAMAIS au fetch incrémental : les mutations des
   records hors fenêtre restent rattrapées, seule la population initiale est
   bornée.
7. **Procédure backfill** : toute réécriture serveur de masse d'`updated`
   impose un signal client — bump de version Dexie ou `resetCursor` diffusé.

Le fetch complet de session coûte ~173 KiB une fois par session (~2-3 fois
par jour), le visibilityChange/reconnect ne déclenche que le delta.

## Alternatives rejetées

- **Full-refetch systématique à chaque revalidation** : ~1,9 MiB / ~690
  écritures IDB par retour d'onglet (~36 MiB/jour à 20 retours), dominé par
  `recipes` dont le curseur est pourtant sain.
- **Curseurs par équipe** (scope = `teamId`) pour materiel/loans/teamdocs :
  invariant structurellement respecté, mais granularité bimorphique de
  teamdocs (grants équipe ET event), énumération des scopes à maintenir et
  séquencement boot (teams avant le reste) — complexité hors proportion des
  volumes ; option de repli si les volumes croissent. Le split
  `event_docs` (backlog) ferait de la dimension event une collection scopée
  à part.
- **TTL seul (sans reset de session)** : le TTL-gate du resync laisserait
  les mutations manquées pendant les déconnexions SSE non rattrapées —
  inacceptable pour la fraîcheur critique (materiel/loans à la création de
  prêt, documents à l'édition).
- **Fetch à l'accès (par page/composant)** : suppose une carte
  « page → collection » à maintenir (teamdocs est consommé par les blocs
  d'event, loans par le modal d'import) — savoir implicite qui pourrit.
  Déjà esquissé par ailleurs : `ingredients`/`categories` vivent hors
  orchestrateur (sync initiale seule).
- **Curseur sur `created`** : les records anciens qui deviennent visibles ont
  un `created` ancien — aucun rattrapage ; et un delta sur `created` raterait
  les modifications d'enregistrements antérieurs au curseur.

## Conséquences

- Le full de session est le point de rattrapage universel : tout
  élargissement de grant survenu pendant l'absence est couvert SANS câblage
  nouveau. En session, chaque NOUVEAU déclencheur d'élargissement doit
  appeler `resetCursor` au point client correspondant — règle testée
  unitairement (pattern `pb-sync-reset-cursor.test.ts`,
  `globalstate-team-join-resync.test.ts`).
- La plomberie upsert reste un upsert inconditionnel : le replay frontière
  `>=` (mutations au `updated` EXACT du curseur) est un contrat épinglé
  (`pb-sync-scoped-cursor.test.ts`) qu'une garde « skip si même `updated` »
  violerait. Le coût est borné par la politique elle-même (full ~2-3×/jour).
- Une horloge client fausse (le plafond dépend de l'horloge client en borne
  haute) ne produit que du re-fetch redondant, borné et auto-corrigé —
  jamais un trou. Toute la chaîne reste lexicale sur des chaînes UTC : aucun
  fuseau client n'y entre.
- Un nouvel utilisateur ne voit pas les events terminés depuis plus de 90
  jours (décision produit assumée) ; l'historique des loans reste
  intégralement peuplé — la même borne `endDate` est l'évolution prévue si
  son volume pèse.
- Le stale « invisible » n'existe pas en session : SSE connecté = données
  vivantes, SSE coupé = StatusBar « connexion perdue » + delta au retour ;
  les locks gardent l'écrasement d'édition hors d'atteinte (§8/§11b de la
  checklist click-through).

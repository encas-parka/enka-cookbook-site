# Audit — Delta sync `updated >= since` : pertinence, risques de désync, alternative full-fetch

Type: research
Status: open
Source: click-through 20-10 (P12) + investigation statique du même jour
Owner: —

## Question

La synchronisation delta (`updated >= since`, curseur `syncMeta` par
collection/scope, `svelte-app/src/lib/db-sync/pb-collection.ts`) vaut-elle son
coût en robustesse ?

1. Qu'économise-t-elle réellement (volume réseau, latence, quota PB) face à un
   full-refetch à chaque revalidation ?
2. Quels bugs de classe « désync » introduit-elle, et peuvent-ils être encadrés ?
3. Faut-il garder le delta (avec garde-fous), basculer en full-refetch
   systématique, ou un hybride ?

## Bug constaté (P12, click-through 20-10)

Après un join d'event par share link, la session B ne voit jamais les teamdocs
existants de l'event :

- `svelte-app/src/lib/routes/JoinPage.svelte:84-86` ne revalide que
  `eventsStore` (delta — l'event lui-même arrive, son `updated` est bumpé par
  le join) ;
- teamdocs a un curseur delta **global** (`TeamdocsStore.svelte.ts:132`,
  `initialFetch()` sans scope) ;
- la listRule teamdocs s'élargit au join via `eventId.guestUsers`
  (`pocketbase/pb_migrations/1791900000_teamdocs_creator_rules.js:32-33`) ;
- le fallback full-fetch ne se déclenche que si la table locale est vide
  (`pb-collection.ts:342`) — le cache de B n'est pas vide ;
- → un record devenu autorisé mais antérieur au curseur n'est jamais
  retéléchargé. Trou de données silencieux et persistant (ni reload, ni
  resync ne le comblent).

Même classe pour le join d'équipe : materiel + teamdocs via `teamId.members`
(mécaniquement identique, non constaté à l'écran).

## Angles d'investigation

- **Format datetime PB** : `updated` = `YYYY-MM-DD HH:mm:ss.SSSZ` — tri
  lexical fiable ? comparaisons lexicale vs `new Date()` dans le code ; zone/
  offset serveur vs client.
- **UTC / horloges** : PB stocke-t-il en UTC systématique ? Qu'arrive-t-il si
  un `updated` « futur » entre dans le curseur (horloge serveur/client
  désynchronisée, import) — le curseur saute-t-il des records ?
- **Classe « élargissement de périmètre »** : tout changement d'autorisation
  (join event, join team, ajout `permissionWrite`, rôle) rend visibles des
  records antérieurs au curseur. Inventorier les déclencheurs et vérifier
  lesquels sont couverts aujourd'hui.
- **Économie réelle** : volumétrie (456 recettes, 845 ingrédients, teamdocs ~
  quelques Mo) — coût mesuré d'un full-refetch par revalidation vs delta.
  Le realtime SSE (déjà branché sur chaque store) est-il un filet qui rend le
  delta superflu — ou l'inverse ?
- **Hybrides possibles** : delta + `resetCursor()` sur événement d'autorisation
  (fix court terme P12 proposé), full-refetch périodique, curseur par « grant »
  plutôt que global.

## Contrainte

Le fix court terme P12 (primitive `resetCursor` + appels aux joins) reste
valable quelle que soit la conclusion : il répare le trou utilisateur immédiat
sans préjuger de l'audit. L'audit peut ensuite le rendre superflu (full-refetch)
ou le généraliser.

## Critère de sortie

Recommandation écrite (garder delta + garde-fous / full-refetch / hybride)
avec les mesures d'économie à l'appui ; si la décision est architecturale,
la consigner en ADR (`docs/adr/`).

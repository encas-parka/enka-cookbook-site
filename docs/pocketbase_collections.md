# Schéma PocketBase ↔ API rules ↔ svelte-app

> État des lieux au 24-10-2026 (worktree `enka-cookbook-mig`, phase 1).
> Méthode : extraction directe de `_collections` dans `pocketbase/pb_data/data.db`,
> croisée avec l'usage runtime (stores, services, hooks JSVM, routes).
> Ce document signale les **champs et collections inutilisés** et les points
> **surprenants** du couplage schéma / règles / app. Il ne remplace pas
> `.agents/plans/1_pocketbase-schema.md` (détail des règles par collection).

## Vue d'ensemble

13 collections applicatives. Modèle d'accès dominant : règles OR
`teams.members ~` / `guestUsers ~` / `createdBy =` (le `~` sur relation
multi se traduit en LIKE sur JSON — non indexable, mesuré : voir
`1791333000_query_indexes.js`). Index requêtes posés par cette même
migration (delta sync `updated`, composites `(eventId, updated)`,
`share_links (target_id, link_type)`).

| Collection       | Sync app                 | Règles (résumé)                                                                        |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `events`         | EventsStore              | membres/guests/créateur sur list/view/update ; create = self ; delete = créateur       |
| `teams`          | NativeTeamsStore         | membres partout ; delete = créateur (ou membre si `createdBy` vide — comptes importés) |
| `products`       | ProductsStore            | via `eventId.*` ; unique `(eventId, productName)`                                      |
| `purchases`      | ProductsStore            | via `eventId.*`                                                                        |
| `event_materiel` | EventMaterielStore       | via `eventId.*`                                                                        |
| `event_todos`    | **aucun**                | via `eventId.*` (mais sans `eventId.createdBy` — voir anomalies)                       |
| `materiel`       | MaterielStore            | owner ou équipe                                                                        |
| `materiel_loan`  | MaterielStore            | emprunteur / équipe propriétaire ; create = responsable ou équipe                      |
| `recipes`        | RecipesStore             | **lecture publique** (list/view vides) ; update = créateur ou `permissionWrite ~`      |
| `ingredients`    | RecipeDataStore          | **lecture publique** ; écriture authentifiée                                           |
| `categories`     | RecipeDataStore          | **lecture publique** ; create authentifié ; **update/delete : None**                   |
| `teamdocs`       | TeamdocsStore            | team OU event (membres/guests/créateur)                                                |
| `locks`          | pb-locks.ts (PK directe) | auth ; update = owner ou lock vide/expiré (takeover)                                   |
| `share_links`    | pb-invitations.ts        | strictement `createdBy =`                                                              |
| `notifications`  | **aucun**                | self-only sur toutes les opérations                                                    |

## Champs inutilisés (morts à l'exécution)

| Champ                    | Collection  | État                                                                                                                                                                                                                                   |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_level`           | share_links | Jamais lu ni écrit hors pipeline d'import (`scripts_dev/2-transform-data.ts`) — héritage Appwrite. Candidat naturel pour des liens « read only » (cf. discussion 21-10), mais sans la chaîne règles + hook + front il reste décoratif. |
| `token`                  | share_links | Écrit à `""` à la création (`pb-invitations.ts`), jamais lu ; l'ID du record sert de token.                                                                                                                                            |
| `collection`, `recordId` | locks       | Vestiges de l'ancien schéma : jamais remplis ni requêtés. Le client locks travaille exclusivement par PK (`id = resourceId`).                                                                                                          |
| `lockedBy`               | recipes     | Texte coexistant avec la collection `locks` ; lu pour affichage mais le verrouillage effectif passe par `locks`. Statut ambigu, à clarifier (champ d'affichage dénormalisé ou vestige ?).                                              |

## Collections inutilisées

- **`notifications`** — aucune référence runtime (`NotificationStore` a été
  supprimé lors de la migration, PB SSE natif l'a remplacée). Les règles
  self-only la rendent inoffensive, mais la collection est morte.
- **`event_todos`** — la page Tâches lit/écrit le **champ JSON
  `events.todos`** directement (cf. `lib/utils/event-todo.utils.ts`) ;
  la collection dédiée n'est jamais adressée. Deux modèles coexistent :
  le JSON est le seul vivant.

## Points surprenants / asymétries notables

1. **`event_todos` vs `events.todos`** (le plus surprenant) : une
   collection entière dédiée existe, avec ses règles et son champ
   `assignedTo` relationnel, mais l'app fait tout via un JSON non
   traversable sur `events`. Conséquence : pas de query ni d'index
   possibles sur les tâches, et double source de vérité dans le schéma.
2. **`categories.updateRule`/`deleteRule` = None** : personne (même
   superuser via API rules) ne peut modifier une catégorie par l'API —
   le create est ouvert à tout authentifié. Asymétrie create vs
   update/delete à valider comme intentionnelle.
3. **Lecture publique** `recipes` / `ingredients` / `categories` :
   `listRule`/`viewRule` vides = accessibles sans authentification.
   Héritage de l'ère Hugo (recettes = contenu public). `recipes` est en
   plus la seule collection jamais purgée du cache local.
4. **`teams.isPublic`** : le champ existe et est éditable en UI
   (`CreateTeamModal`), mais **aucune règle ne l'utilise** — une team
   « publique » n'est visible que de ses membres. Le champ promet ce que
   les règles ne tiennent pas.
5. **Soft-delete en double** : `deleted: bool` sur `materiel`, `products`,
   `purchases` (filtré côté client), alors que les `deleteRule` autorisent
   le delete dur. Deux sémantiques de suppression cohabitent.
6. **Dénormalisation assumée sur `materiel_loan`** : `ownerName`,
   `responsibleName`, `eventName` (snapshots texte) doublent les
   relations `ownerId`, `responsibleId`, `eventId`. Idem
   `event_materiel.fromTeamName`. Choix de stabilité d'affichage, pas un
   accident — mais tout changement de nom source ne se propage pas.
7. **`locks`** : convention `id = resourceId` (pas de champ dédié), et
   la règle update encode le takeover (`userId = "" || expiresAt < @now`)
   alors que delete est réservé au propriétaire. La collection ne porte
   **aucun index** : inutile, tous les accès sont par PK (décision
   documentée dans la migration d'index).
8. **`events.date` (json) vs `dateStart`/`dateEnd` (date)** : les deux
   vivent et sont lus ; `date` est le format d'affichage/import, les
   bornes datées servent au filtrage. Redondance à connaître avant de
   toucher aux dates.
9. **`users.listRule = id = @request.auth.id`** mais `viewRule` ouvert à
   tout authentifié : la liste est verrouillée, le détail non — c'est ce
   qui permet l'expand des `members` dans les stores.

## Le modèle de stock `materiel` : quantités, plus de statut

Le stock est purement quantitatif (décision
[ADR 0003](adr/0003-materiel-stock-model.md), migrations `1792805000` +
`1792900000`) :

- `quantity` = ce qui existe physiquement ; les **manquants** déclarés au
  retour d'emprunt le décrémentent définitivement (l'emprunt complété, dans
  son json `materiels`, reste le registre de la perte). Nullable traité
  comme 0 (conservateur).
- `repairQuantity` = compteur temporaire des exemplaires en réparation ;
  la disponibilité calculée côté client est
  `quantity − enEmprunt − repairQuantity`, et sur période
  `quantity − empruntsChevauchants − repairQuantity`.
- **Le champ `status` (ok/lost/torepair) est supprimé** : c'était une
  dérivation d'affichage écrasée à chaque retour, jamais une donnée. Les
  gestes « remise en service » et « réforme » passent par `repairQuantity` ;
  l'état affiché (`displayState` : complete/partial/repair/depleted +
  loan/reserved) est dérivé à la lecture, jamais persisté.

## Le flux `ingredients.ref` ↔ `recipes.ingredients` ↔ `products.ingredientRef`

Le chaînage catalogue → recettes → produits ne passe par **aucune relation
PB** : c'est une clé métier (`ref`, court uuid hérité de Hugo, unique
index, ≠ `id` PB) recopiée de collection en collection.

```
ingredients (catalogue, ref = clé métier stable)
    │  copie dénormalisée à l'édition de la recette
    ▼
recipes.ingredients (json) = snapshots {ref, name, type, allergens, pF, pS, quantités}
    │  dérivation côté client (productEnrichment.ts)
    ▼
products.ingredientRef = ref agrégée + productName (snapshot au calcul)
    (produits ajoutés à la main : ingredientRef vide)
```

### Ce qui est design assumé (à préserver)

- **Snapshot embarqué dans la recette** : une version (`rootRecipeId`)
  doit garder ses ingrédients _tels qu'à la création_ — une relation
  vivante vers le catalogue casserait l'immuabilité des versions.
- **Tout-JSON = offline-first** : Dexie/`bridgeToMap` n'a pas de join ;
  le calcul des besoins (`productEnrichment.ts`) marche hors-ligne sans
  résolution multi-collections.
- **`ref` ≠ `id`** : clé métier stable qui survit aux re-imports ; les
  mappings utilisent `ref || id` en fallback (cf. `recipes.types.ts`).

### Ce que ce choix coûte (invariants non appliqués)

- **Pas d'intégrité référentielle** : une recette peut porter un `ref`
  orphelin (le delete d'ingrédient est ouvert à tout authentifié) ;
  le code compense par des fallbacks silencieux.
- **Refactoriser le catalogue = migration de données** : fusionner deux
  ingrédients (« jus de citron » / « citron (jus) ») oblige à réécrire
  le snapshot dans **chaque recette porteuse** + `products.ingredientRef`
  — il n'y a pas de pointeur à rediriger. C'est le prix de l'immuabilité
  des versions ; toute opération admin de dédup catalogue devra être un
  script de réécriture (avec gestion des collisions de noms).
- **`pF`/`pS` en triple exemplaire** (catalogue, snapshot, produit) :
  trois sources à maintenir synchronisées à la main.
- **Produits manuels non distingués** : `ingredientRef` vide sert de
  marqueur implicite « hors recette ». Une évolution propre serait un
  champ `origin: "recipe" | "manual"` — à considérer avant toute
  normalisation du lien produits↔ingrédients.
- **Collision d'ids** (distincte du merge, voir ci-dessous) : deux refs
  différentes portant le même nom convergent vers le même id dérivé
  (slug + eventId) ; `productEnrichment` fusionne avec un warn.

### products (merge) — feature métier, pas palliatif

`isMerged`, `mergedFrom`, `mergedInto`, `mergeDate`, `mergeReason`,
`previousNames`, `isSynced`, `totalNeededOverride` : la fusion de
produits est un **choix éclairé du cuisinier de l'event** — considérer
deux ingrédients distincts (« huile végétale » / « huile de tournesol »)
comme une seule ligne de course, **sans modifier les recettes**. Elle
vit uniquement sur products/purchases (index unique
`(eventId, productName)` en garde-fou). Ne pas la confondre avec la
déduplication du catalogue, qui est une autre opération (cf. ci-dessus).

- **recipes (versions/permissions)** : `rootRecipeId` (arbre de versions,
  détection de cycle côté client), `permissionWrite` (relation partage
  d'écriture, reflétée dans la règle update), `versionLabel`, `draft`.
- **share_links** : `maxUses`/`useCount` uniquement consommés par le hook
  JSVM [join-event.pb.js](../pocketbase/pb_hooks/join-event.pb.js)
  (race read-modify-save assumée, débordement d'une unité possible) ;
  expiresAt vérifié côté hook, pas dans les règles.
- **Hooks JSVM actifs** : `join-event`, `send-emails`, `cascade-delete-event`,
  `cascade-delete-teams`, `invite-to-team` — les cascades delete
  `share_links` sont la raison du composite `(target_id, link_type)`.

## Le flux d'invitation RSVP : registre, visibilité, grant équipe

Trois canaux cohabitent sur `events` pour la participation (décision :
[ADR 0002](adr/0002-client-side-rsvp.md) — le RSVP porte l'accès côté
client, les règles serveur restent volontairement grossières) :

```
contributors (json) = registre des participants
    état RSVP individuel : {id, email, name, status: invited|accepted|declined,
    invitedAt, respondedAt} (+ dérivés d'équipe pour l'UI)
    écrit par le client (inviteParticipants, updateContributorStatus) et par
    le hook join-event (entrée en statut `invited`, rattachement nanoid →
    userId au premier join par lien)
    → jamais lu par le serveur (json non traversable : aucune règle)

guestUsers (relation) = visibilité individuelle
    comptes PB résolus à l'invitation (hook join-event inclus) — filtrée
    par les règles events list/view/update

teams (relation) = grant équipe vivant
    équipes entières cochées : la règle `teams.members ~` rend leurs membres
    visibles sans individualisation ; leur statut « invité » est dérivé côté
    UI à la lecture, jamais persisté
```

### Ce qui est design assumé (à préserver)

- **Le registre ne porte jamais la visibilité** (invariant du glossaire) :
  l'accès ne passe que par `guestUsers` / `teams`, relations traversables
  par le moteur de règles ; `contributors` décrit l'état, le serveur
  l'ignore.
- **Email hors compte = aucune existence serveur** : pas de
  pré-enregistrement d'adresse (le champ de tracking des emails, héritage
  Labels Appwrite, a été supprimé du schéma) — l'invitation d'un inconnu
  s'arrête au registre, et le lien de partage est son seul chemin d'entrée
  (le registre porte la confirmation).
- **L'éditeur écrit les canaux en bloc** : les règles ne séparent pas « qui
  pose les grants » de « qui confirme son RSVP » — même updateRule pour
  tous les éditeurs ; modèle de confiance documenté dans l'ADR.

### Ce que ce choix coûte

- **Statut dérivé = statut volatil** : l'« invité » d'un membre d'équipe
  entière n'existe nulle part en base — l'UI le dérive à la lecture ; un
  lecteur hors UI (script, export) doit rejouer la même dérivation.
- **Le registre n'est requêtable par rien** : pas de query ni d'index sur
  les invitations (json non traversable) — même limite que
  `events.todos` (cf. asymétrie n° 1).

## Règle de maintenance

Toute évolution de schéma passe par une migration dans
`pocketbase/pb_migrations/` puis `bun run generate-types`. Si ce document
s'embarrasse (champ resuscité, collection supprimée), le mettre à jour
dans la même session que la migration.

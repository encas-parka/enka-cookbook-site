# ADR 0003 — Modèle de stock : soldes projetés, manquants définitifs, journal de mouvements différé

Date : 2026-10-24 · Statut : accepté

## Contexte

Un item `materiel` représente N exemplaires, mais son état n'est qu'un statut
unique `ok` / `lost` / `torepair`. Au retour d'un emprunt,
[completeLoanWithReturn](../../svelte-app/src/lib/stores/MaterielStore.svelte.ts)
projette ce statut sur **tout l'item** : perdre les 3 unités prêtées d'un stock
de 50 marque les 50 « perdues » ; 1 cassé sur 12 rend les 12 « à réparer » et
les fait disparaître du sélecteur d'emprunt. Dans l'autre sens, 2 manquants
sur 12 sans casse laissent l'item « ok » et 12 disponibles annoncés — on peut
réserver des unités qui n'existent plus
([enrichMateriel](../../svelte-app/src/lib/utils/materiel.utils.ts) ne soustrait
jamais les unités cassées ou manquantes). Aucun geste ne remet des unités en
service, et un statut posé à la main est écrasé au retour suivant.

Au-delà du correctif, le mainteneur demande que l'évolution du stock dans le
temps reste préservable (100 assiettes en janvier, +50 achetées en mars, −5
perdues en juin) — sans sérialiser chaque exemplaire : 200 assiettes ne
méritent pas 200 records.

## Décision

- `quantity` signifie **ce qui existe physiquement**. Les **manquants**
  (déclarés au retour, quelle que soit la cause : perdus, ou cassés puis
  jetés) **décrémentent définitivement `quantity`** — la disparition est
  assumée, et l'emprunt complété (`lostQuantity` / `brokenQuantity` /
  `returnedAt` dans son json `materiels`) reste le registre de la perte.
  `quantity` nullable reste traité comme 0 (conservateur).
- `repairQuantity` (nouveau champ) = compteur temporaire des exemplaires en
  réparation. La **disponibilité devient
  `quantity − enEmprunt − repairQuantity`**.
- **Le champ `status` est supprimé du schéma** : c'est une dérivation
  d'affichage (complet / partiel : N en réparation / en réparation / stock
  épuisé), jamais une donnée persistée. Un manquant n'est pas un état du
  matériel : c'est un fait consommé.
- Deux gestes explicites, pour l'équipe propriétaire ou l'owner, dans le
  formulaire d'inventaire : **remise en service** (N réparés :
  `repairQuantity -= N`) et **réforme** (N jugés irréparables :
  `repairQuantity -= N` **et** `quantity -= N` — ils deviennent manquants).
  Le rebut d'un item complet se représente par `quantity = 0`, sans champ
  dédié.
- **Journal de mouvements différé** : la cible est une collection
  `materiel_stock_mouvement` (variation datée, quantifiée et causée — achat,
  perte, remise en service, réforme, correction ; relation optionnelle vers
  `materiel_loan` pour retrouver le responsable de la perte par expand)
  comme source de vérité des variations, `quantity` et `repairQuantity` en
  étant des projections maintenues à l'écriture. Le lot 1 n'implémente pas
  le journal ; il s'interdit seulement ce qui le contrerait : pas de compteur
  `missingQuantity` parallèle, pas de statut persisté. Tant qu'il n'existe
  pas, les pertes restent reconstituables depuis les emprunts complétés ;
  son backfill créera un mouvement d'initialisation par item, **sans
  reconstitution de l'historique antérieur** (seules deux équipes ont un
  inventaire réel : une de test, Enka parka).
- **Livraison du lot 1 avant le cutoff** Appwrite → PocketBase : schéma par
  migration delta, adaptation du
  [transform d'import](../../scripts_dev/2-transform-data.ts) (qui copie
  aujourd'hui `status` tel quel), et backfill conservateur dans les deux —
  `torepair` → `repairQuantity = quantity` (tout l'item en réparation,
  l'humain remet en service au geste) ; `lost` → `quantity = 0` (rien
  d'empruntable, l'humain re-saisit le stock réel). La prod naît directement
  dans le nouveau modèle.

## Alternatives rejetées

- **Compteur `missingQuantity` séparé** (conserver la taille d'origine du
  stock) — duplique la source de vérité et impose l'invariant
  `missing + repair ≤ quantity` pour un bénéfice déjà porté par les lignes
  d'emprunt.
- **Exemplaire sérialisé** (un record par unité) — juste mais surdimensionné :
  quelques dizaines d'items à quantités faibles, sélection unitaire dans le
  formulaire d'emprunt, migration de toutes les lignes existantes.
- **Ne plus projeter du tout au retour** — coût quasi nul, mais l'inventaire
  reste aveugle aux pertes : la sur-réservation d'unités disparues persiste,
  simplement sans écriture automatique.
- **Conserver `status` comme cache dérivé** — deux sources de vérité à
  resynchroniser, et le retour recommencerait à écraser.
- **Journal dès le lot 1** — une collection de plus (sync, règles) dans un lot
  de migration déjà large, pour un historique qu'aucune UI n'affiche encore ;
  l'onglet historique de la page matériel sera son premier consommateur.

## Conséquences

- `completeLoanWithReturn` est réécrit : décrémente `quantity` des manquants,
  incrémente `repairQuantity` des cassés, n'écrit plus aucun statut —
  l'écrasement du statut manuel disparaît structurellement. Pas de double
  décompte structurel : les manquants ne sont comptés nulle part avant le
  retour ; un rachat manuel pendant un emprunt en cours reste correct (le
  décrément s'applique au stock courant).
- Sélecteurs d'emprunt (`getAvailableMaterielsByOwner`,
  `getAvailableMaterielsForPeriod`), filtres d'inventaire, libellés et cartes
  sont rebasés sur les projections : plus de filtre `status`, la disponibilité
  calculée décide.
- L'historique des variations antérieur au journal ne sera pas reconstitué
  (accepté, périmètre réel minuscule) ; les pertes survenues entre le lot 1 et
  le journal restent, elles, reconstituables depuis les emprunts complétés.
- Vocabulaire acté au glossaire ([CONTEXT.md](../CONTEXT.md)) : **manquant**
  (partout, « perdu » évité), **mouvement de stock**, **remise en service**,
  **réforme** ; la disponibilité sur période est redéfinie sur le stock en
  état de servir (hors exemplaires en réparation).

# Spec — Granularité des dommages sur un stock multi-exemplaires (lot 1)

Status: ready-for-agent
Date: 2026-10-24 · Décision de référence: ADR 0003 (docs/adr/0003-materiel-stock-model.md) · Vocabulaire: CONTEXT.md

## Problem Statement

Un item d'inventaire représente N exemplaires, mais son état se résumait à un
statut unique. Dès qu'un retour déclarait une perte ou une casse sur une
partie des exemplaires, le statut était appliqué à tout l'item : des
exemplaires sains devenaient invisibles du sélecteur d'emprunt (2 verres
cassés sur 12 → 0 empruntable), et des exemplaires disparus restaient
annoncés disponibles (2 manquants sur 12 → 12 proposés à la réservation).
Aucun geste ne permettait de déclarer des exemplaires réparés ou réformés, et
un statut posé à la main était écrasé au retour suivant.

## Solution

Le stock dit la vérité, unité par unité. Les manquants (exemplaires non
revenus au retour, quelle que soit la cause) quittent définitivement le
stock : la quantité de l'item diminue. Les exemplaires revenus abîmés et
réparables sont comptés à part (en réparation) et ne sont pas empruntables
tant qu'ils ne sont pas remis en service. La disponibilité affichée et la
disponibilité sur période soustraient toujours les unités en emprunt et en
réparation. Le statut d'affichage devient une pure dérivation (complet,
partiel, en réparation, stock épuisé — plus l'activité d'emprunt existante) :
plus aucun statut persisté, plus rien à écraser. Deux gestes explicites dans
le formulaire d'inventaire — remise en service et réforme — ferment le cycle
de vie des exemplaires endommagés.

## User Stories

1. En tant qu'emprunteur, je veux que la disponibilité d'un matériel tienne
   compte des exemplaires cassés, afin de ne pas me voir proposer des unités
   en réparation.
2. En tant qu'emprunteur, je veux que la disponibilité tienne compte des
   manquants déclarés aux retours précédents, afin de ne jamais réserver des
   unités qui n'existent plus.
3. En tant qu'emprunteur, je veux qu'un matériel partiellement endommagé
   reste proposé dans le sélecteur d'emprunt pour ses exemplaires sains,
   afin de pouvoir emprunter les 10 verres intacts d'un lot de 12 dont 2
   sont cassés.
4. En tant qu'emprunteur, je veux que la disponibilité sur période (dates de
   mon emprunt) applique la même soustraction (emprunts chevauchants +
   réparation), afin que la quantité maximal réservable soit exacte sur mes
   dates.
5. En tant que membre d'une équipe propriétaire, je veux qu'un retour
   décrémente automatiquement le stock des manquants et comptabilise les
   exemplaires à réparer, afin que l'inventaire reflète la réalité sans
   saisie manuelle.
6. En tant que membre d'une équipe propriétaire, je veux qu'un retour
   n'écrive rien sur les items revenus intacts, afin qu'un état saisi à la
   main (par exemple une réparation en cours) survive aux retours.
7. En tant que membre d'une équipe propriétaire, je veux déclarer la remise
   en service de N exemplaires réparés, afin qu'ils redeviennent empruntables.
8. En tant que membre d'une équipe propriétaire, je veux réformer N
   exemplaires jugés irréparables, afin qu'ils quittent le stock et soient
   comptés manquants sans fausser la réparation.
9. En tant que membre d'une équipe propriétaire, je veux corriger la quantité
   d'un item à la main (rachat, réinventaire), afin de garder le stock à jour
   hors de tout retour.
10. En tant que membre d'une équipe propriétaire, je veux qu'un item dont la
    quantité n'est pas saisie reste non empruntable, afin qu'aucun emprunt ne
    se fonde sur un stock inconnu.
11. En tant que membre, je veux que la carte d'inventaire affiche le stock
    réel et le nombre d'exemplaires en réparation, afin de connaître l'état
    utilisable d'un item en un coup d'œil.
12. En tant que membre, je veux un badge d'état dérivé et toujours cohérent
    (complet, partiel : N à réparer, en réparation, stock épuisé, emprunté,
    réservé), afin de ne plus voir de contradictions entre badge et quantités.
13. En tant que membre, je veux filtrer l'inventaire sur ces états dérivés,
    afin de retrouver rapidement ce qui est prêt à partir ou ce qui attend
    une réparation.
14. En tant que membre, je veux que le vocabulaire de l'app dise
    systématiquement « manquant » (et jamais « perdu ») pour les exemplaires
    non revenus, afin que le même mot désigne la même chose au retour et dans
    l'inventaire.
15. En tant que membre, je veux qu'un item au rebut (quantité 0) reste
    visible dans l'inventaire mais non empruntable, afin de conserver
    l'historique sans proposer d'unités fantômes.
16. En tant qu'emprunteur, je veux que la fiche de retour fonctionne comme
    avant (déclaration par ligne : rendus, à réparer, manquants, notes),
    afin que ce changement de modèle ne change pas mon geste de retour.
17. En tant qu'emprunteur, je veux pouvoir rendre un emprunt par anticipation
    sans casser les comptes, afin que les exemplaires sains redeviennent
    disponibles immédiatement et les déclarations produisent leurs effets.
18. En tant que membre, je veux que la trace des pertes reste lisible dans
    l'emprunt complété (quantités manquantes/cassées et date de retour),
    afin de pouvoir auditer ce qui a été perdu, quand, dans quel emprunt.

## Implementation Decisions

- **Schéma `materiel`** : suppression du champ statut persisté ; ajout de
  `repairQuantity` (entier ≥ 0, défaut 0) = exemplaires actuellement en
  réparation. Pas de nouvelle collection au lot 1 (le journal des mouvements
  est différé — ADR 0003).
- **Sémantique de `quantity`** : ce qui existe physiquement (manquants
  décrémentés). `null` continue de valoir 0 (conservateur) : item non
  empruntable tant que la quantité n'est pas saisie.
- **Formule de disponibilité** : `available = quantity − enEmprunt(actifs) −
  repairQuantity`. La disponibilité sur période applique la même soustraction
  avec les emprunts chevauchant les dates. Un item est proposé à l'emprunt si
  sa disponibilité (ou sa disponibilité sur période) est > 0 ; le filtre sur
  le statut persisté disparaît au profit de cette seule règle.
- **Statut d'affichage = pure dérivation** dans la fonction d'enrichissement :
  combiné avec l'activité existante (emprunté / réservé selon les emprunts
  actifs ou planifiés), l'état de stock dérive en : complet (rien en
  réparation, stock > 0), partiel : N à réparer (repairQuantity > 0 et
  disponibles), en réparation (tout le stock en réparation), stock épuisé
  (quantity = 0). Aucune de ces valeurs n'est écrite en base.
- **Retour (`completeLoanWithReturn`)** : pour chaque ligne du retour :
  `quantity −= manquants` et `repairQuantity += àRéparer`. Les items sans
  dommage déclaré ne subissent aucune écriture. Plus aucune écriture de
  statut. Le payload de la fiche de retour (quantités rendues/à
  réparer/manquantes + notes par ligne) est inchangé.
- **Gestes** : deux méthodes de store — remise en service
  (`repairQuantity -= n`) et réforme (`repairQuantity -= n` et `quantity -=
  n`) — exposés dans le formulaire d'inventaire quand `repairQuantity > 0`,
  avec garde n ≤ repairQuantity. Droits inchangés : équipe propriétaire ou
  owner (les règles d'update `materiel` existantes couvrent, aucune règle
  nouvelle).
- **UI inventaire** : le sélecteur de statut du formulaire disparaît ; la
  quantité reste éditable à la main (correction de stock). Carte, filtres et
  libellés sont rebasés sur les états dérivés ci-dessus ; « manquant »
  remplace « perdu » partout dans les libellés.
- **Migration (livrée avant le cutoff)** : migration delta PocketBase (drop
  statut, add `repairQuantity`) avec backfill conservateur des données
  existantes : items « à réparer » → `repairQuantity = quantity` (tout
  l'item en réparation, l'humain remet en service au geste) ; items
  « perdus » → `quantity = 0`. Le transform d'import Appwrite applique le
  même mapping aux données source et ne écrit plus le statut. Types
  régénérés depuis le schéma après migration.

## Testing Decisions

- **Philosophie** : tester le comportement observable au transport (les
  écritures réellement émises et leurs valeurs), jamais les internals du
  store. Un bon test échouerait si la projection devenait fausse pour
  l'utilisateur, pas si le code bougeait.
- **Seam 1 — store, via le harness existant** (vrai store + vrai pb-sync +
  transport PocketBase factice + fake-indexeddb, fixtures d'items et
  d'emprunts) : couvre `completeLoanWithReturn` (décrément des manquants,
  incrément des à réparer, zéro écriture sur les items intacts, zéro écriture
  de statut, scénarios « 2 cassés sur 12 », « 2 manquants sur 12 », « 3
  manquants sur un prêt de 3 dans un stock de 50 ») et les deux gestes
  (succès, garde n > repairQuantity, effet sur la disponibilité). Prior art
  direct : le test de sync des emprunts (write paths loan ↔ event_materiel).
- **Seam 2 — fonction pure d'enrichissement** : disponibilité (nominal,
  partiel, tout en réparation, tout perdu, `quantity` null), états dérivés
  d'affichage et leur combinaison avec l'activité d'emprunt (emprunté,
  réservé). Prior art de style : les tests utils purs existants (aucun test
  ne couvre cette fonction aujourd'hui — c'est le premier).
- **Validation hors vitest** (conventions repo) : check complet svelte-app +
  tests une fois chacun ; régénération des types depuis le schéma migré ;
  re-run du pipeline de migration avec ses verdicts ; click-through des flux
  touchés (retour avec dommages partiels, gestes dans le formulaire,
  sélecteur d'emprunt, filtres inventaire) sur l'app réelle.

## Out of Scope

- **Journal des mouvements** (`materiel_stock_mouvement`), mouvement
  d'initialisation et onglet historique de la page matériel : lot 2, cible
  documentée par l'ADR 0003. Le lot 1 ne crée aucune collection.
- **Agrégation « manquants cumulés » côté inventaire** (lire les pertes
  passées depuis les emprunts complétés pour l'affichage) : avec
  l'onglet historique, lot 2.
- **Refonte UI de la fiche de retour** (grammaire « Un problème / Ok »,
  panneau de déclaration) : suspendue par le mainteneur, reprise après ce
  lot ; le formulaire consomme le modèle tel quel, payload inchangé.
- **Renforcement backend des invariants d'emprunt** (entrée backlog
  existante).
- **Sérialisation par exemplaire** (un record par unité) : rejetée par
  l'ADR 0003, ne pas re-proposer.
- **Autres types de stock** (ex. alimentaire) : seul le nommage de la future
  collection les anticipe.

## Further Notes

- La décision complète (pourquoi les manquants décrémentent, pourquoi le
  statut disparaît, pourquoi le journal est différé, alternatives rejetées)
  vit dans l'ADR 0003 — la consulter avant toute dérive du présent spec.
- Traduction sous D d'un critère de fini antérieur : la distinction
  « complet / partiel / incomplet » de l'ancien handoff devient, sous D,
  « complet / partiel : N à réparer / stock réel affiché » — un item ayant
  subi des manquants n'affiche pas un état « incomplet » (l'information
  n'existe plus côté stock, c'est le sens du décrément définitif) ; la trace
  vit dans les emprunts complétés, puis dans le journal au lot 2.
- Le calage « livré avant le cutoff » impose que migration delta, transform
  et regen de types soient dans le même lot que le code consommateur.
- Définition de fini : scénarios 1 à 4 de l'ancien handoff corrects dans
  l'UI réelle ; un item partiellement abîmé proposé pour ses unités saines ;
  un geste explicite remet des unités en service ; aucun statut persisté ne
  subsiste dans le schéma ni dans les écritures du retour.

## Problem Statement

Sur la page produits d'un événement, plusieurs comportements sont cassés ou fragiles, tous issus de la même cause racine : l'identité d'un produit n'est pas stable entre le besoin calculé (issu des recettes) et le produit enregistré en base.

Concrètement, l'utilisateur voit : une quantité saisie à la création d'un produit comptée comme un achat au lieu d'un besoin ; des modifications groupées qui échouent dès qu'un produit « besoin seul » fait partie de la sélection, avec un compteur de succès mensonger ; des cartes produit qui apparaissent puis disparaissent lors d'un achat ou d'une modification (churn d'identité) ; des produits fusionnés en production qui s'affichent en double ; des achats orphelins invisibles. Le socle technique (contraintes d'id assouplies par le maintainer via la console, dont le pattern autorisant le tiret-bas) rend désormais possible la solution simple : un produit naît avec son id sémantique et le garde toute sa vie.

## Solution

Rendre l'id produit stable du calcul du besoin jusqu'à la base : le premier enregistrement crée le produit avec son id sémantique au lieu d'un id aléatoire suivi d'un re-key. Ajouter une primitive d'upsert au niveau de la couche de synchronisation (créer-ou-mettre-à-jour à id stable, à l'unité et en lot), et y brancher tous les chemins d'écriture produits. Revenir au comportement historique « la quantité saisie à la création est un besoin normalisé, pas un achat ». Reporter la fusion de produits livrée en production mais jamais portée sur la branche de migration. Les données de développement étant régénérables par le pipeline d'import (la production migrée n'est jamais déployée), l'assainissement se fait par reset + ré-import, sans backfill.

## User Stories

1. En tant que cuisinier, je veux créer un produit hors recettes avec une quantité, un magasin et un responsable, et voir cette quantité comme un besoin, afin de savoir quoi acheter.
2. En tant que cuisinier, je veux que le modal de création indique clairement qu'il s'agit de produits hors recettes (en-tête explicite), afin de ne pas confondre avec les besoins issus des recettes.
3. En tant que cuisinier, je veux que l'unité saisie soit normalisée à la création comme en production historique, afin d'éviter les incohérences d'unités.
4. En tant que participant, je veux modifier le magasin ou les responsables de plusieurs produits en une fois même si certains ne sont encore que des besoins calculés, afin de ne pas être bloqué par l'état de synchronisation.
5. En tant que participant, je veux que le compteur « N produits modifiés » reflète la réalité, afin de faire confiance au retour de l'application.
6. En tant que participant, je veux ajouter un achat rapide sur un produit calculé sans voir la page « charger » ni voir une carte apparaître/disparaître, afin d'avoir une interface stable.
7. En tant que participant, je veux modifier un produit individuel (magasin, responsables, caractéristiques) sans churn visuel, afin de garder le contexte de ma liste.
8. En tant que participant, je veux voir les produits fusionnés comme une seule ligne avec leurs achats agrégés, comme en production, afin de ne pas voir de doublons.
9. En tant que participant, je veux annuler une fusion, afin de corriger une erreur d'appariement.
10. En tant que participant, je veux retrouver les achats dont le produit n'a plus de besoin actif (achats orphelins), afin de ne perdre aucune information d'achat.
11. En tant que participant, je veux être averti clairement quand je crée un produit du même nom qu'un existant dans l'événement, afin de décider en connaissance de cause plutôt que de subir une fusion silencieuse.
12. En tant que responsable d'événement, je veux que deux besoins issus d'ingrédients différents mais de même nom ne s'écrasent pas silencieusement, afin de ne pas perdre de quantités.
13. En tant que responsable d'événement, je veux que modifier un ingrédient de recette recalcule les besoins, afin que la liste de courses suive la réalité des recettes.
14. En tant que développeur, je veux une primitive d'upsert unique au niveau de la couche de synchronisation (unitaire + lot), afin de ne plus dupliquer la logique « matérialise-puis-écrit » dans chaque chemin produit.
15. En tant que développeur, je veux que la documentation de la couche de synchronisation décrive le code réel (pas un template d'un autre projet), afin de s'y fier comme spécification.
16. En tant que développeur, je veux régénérer la base de développement par le pipeline (reset + ré-import) plutôt que par backfill manuel, afin d'avoir un état de référence reproductible.

## Implementation Decisions

- Seule couture de test et d'interface : la couche de synchronisation (module de collection synchronisée). L'upsert y vit comme complément de l'opération d'attachement existante : l'attachement couvre « présent serveur / absent du cache », l'upsert couvre « absent des deux ». Les stores deviennent des appelants minces. Aucune nouvelle couture ailleurs.
- L'id sémantique (slug du nom + suffixe d'événement) devient l'id définitif du produit : la création avec id client fourni est le chemin nominal, le re-key et le suivi d'id côté modal sont supprimés.
- Contraintes d'id produit : longueur max large, longueur min abaissée au niveau déjà posé via console, motif autorisant lettres minuscules, chiffres, tiret et tiret-bas (parité avec les collections déjà relaxées). Les quatre migrations auto-générées correspondantes sont versionnées ensemble.
- Le nom de produit devient requis côté base (alignement avec le schéma source ; zéro ligne vide mesurée des deux côtés, donc sans backfill), en coordination avec l'index unique envisagé.
- La quantité à la création redevient un besoin stocké dans les caractéristiques, normalisée en unité, sans création d'achat associée ; le modal porte un en-tête « hors recettes ».
- La modification groupée passe par l'upsert de lot natif (mise à jour si l'id existe, création sinon) et compte les résultats réels.
- La fusion de produits reprend le modèle source : un seul champ serveur sur la source, tout le reste dérivé côté client (remappage des achats, agrégation, masquage des sources) ; le type dérivé change en conséquence, avec badges et exports.
- L'index unique par (événement, nom) est un durcissement ultérieur coordonné avec la fusion (une fusion réintroduisant deux lignes au même couple doit être spécifiée), pas un prérequis ; en attendant, le doublon de nom ne produit aucune erreur serveur, seulement le comportement applicatif existant.
- Données : la base de développement est régénérée par reset + ré-import (les artefacts de doublons du gate disparaissent avec) ; aucune migration de données de production n'est requise (jamais déployée).
- Pipeline d'import : les ids déterministes actuels (hachés, 15 caractères alphanumériques) restent admissibles sous les nouvelles contraintes, sans changement ; seule l'écriture du nom (aujourd'hui repliée sur null) est alignée sur le requis ; les caractéristiques transitent déjà en l'état et préservent la quantité.
- La documentation de la couche de synchronisation est nettoyée des sections héritées d'un autre projet (opérations et options inexistantes, exemples étrangers) ; le code fait foi.

## Testing Decisions

- Un bon test traverse la couture de la couche de synchronisation (comportement externe : créer-ou-mettre-à-jour à id stable, miroir local, annulation optimiste) sans connaître l'implémentation du store appelant.
- Modules testés : la primitive d'upsert (unitaire + lot + sucre groupé), le chemin de création produit (quantité en besoin normalisé, sans achat), la modification groupée (sélection mixte synchronisé/virtuel, compteur honnête), la fusion (agrégation + masquage + annulation), la sonde d'admissibilité d'id sémantique avec relation d'achat.
- Antécédents : le test existant du contrat de mise à jour avec surcréation, les sondes du pipeline d'import, et le modèle de test d'intégration du projet frère (base réelle + base locale simulée + authentification admin) à reproduire pour la surface d'upsert, non couverte là-bas.

## Out of Scope

- Factures groupées et leur modale de détail, détail recette par carte et tiroir associé, recherche dans les titres de recettes, synchronisation des filtres avec l'URL, exports enrichis, pastille de livraison des achats commandés : arbitrages produit ultérieurs, inventoriés dans l'investigation de backport.
- Notifications temps réel inter-utilisateurs et robustesse du service worker : déjà actés au backlog général, hors priorité de ce lot.
- Retry réseau générique de la couche de synchronisation : décision séparée, indépendante de l'upsert.
- Index unique par (événement, nom) et message de doublon serveur : durcissement coordonné après la fusion, pas dans ce lot.
- Suppression des colonnes de fusion héritées et mortes : nettoyage ultérieur, hors périmètre.

## Further Notes

- Investigations préalables (ne pas les re-dériver) : stratégie d'ids et fin du re-key, comparaison avec la synchronisation de l'autre application, inventaire du backport manquant (fusion, orphelins, collisions d'ids, recalcul au changement d'ingrédient). Le compteur de fusionné est mort des deux côtés pour des raisons différentes ; trancher suppression vs correction au moment de la fusion.
- La branche de migration est née avant la série produit de la sœur (fusion livrée après le branchement, jamais planifiée ni actée comme perte) : ce lot répare un angle mort, pas un backport interrompu.
- Le gate de sortie de phase 1 (passe navigateur) et ses reliquats (faux conflit de disponibilité, propagation document par mode, observabilité du resync) vivent dans le ticket de gate du run précédent et restent inchangés par ce lot.

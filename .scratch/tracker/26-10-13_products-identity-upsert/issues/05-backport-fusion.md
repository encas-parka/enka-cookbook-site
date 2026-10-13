# 05: Backport de la fusion de produits

**What to build:** les produits fusionnés en production s'affichent comme une seule ligne avec achats agrégés (plus de doublons), avec recherche de cible, annulation de fusion, badges et exports. Modèle source : un seul champ serveur sur la source, tout le reste dérivé côté client.

**Blocked by:** 01 (contraintes), 04 (identité stable, coordination index unique).

**Status:** ready-for-agent

- [x] Fusion / annulation / recherche de cible au niveau du store (validations : pas d'auto-fusion, pas de chaînage)
- [x] Dérivation client : remappage des achats vers la cible, agrégation, masquage des sources, reconstruction forcée des cibles
- [x] Interface de fusion branchée dans l'onglet recettes du modal produit, avec les trois cas (source, cible, recherche)
- [x] Type dérivé aligné, badges sur cartes, exports incluant les noms fusionnés
- [x] Les lignes fusionnées des données actuelles s'affichent agrégées (vérifié sur les cas réels type crèmes doublonnées)
  - sqlite read-only 13-10 : 18/18 sources `mergedInto` non-nul avec cible présente et nommée, **aucune cible elle-même mergée** (pas de chaînage importé) ; la dérivation est testée sur exactement cette forme (`products-store-merge.test.ts`).
- [x] Trancher le compteur de fusionnés (supprimer ou corriger, il est mort des deux côtés)
  - **Supprimé** : l'objet `stats` entier était mort (unique référence = sa déclaration `EventProductsPage.svelte`, jamais lue) — objet + ligne morte retirés ; même verdict que l'investigation §1.4 côté sœur.

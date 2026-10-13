# 05: Backport de la fusion de produits

**What to build:** les produits fusionnés en production s'affichent comme une seule ligne avec achats agrégés (plus de doublons), avec recherche de cible, annulation de fusion, badges et exports. Modèle source : un seul champ serveur sur la source, tout le reste dérivé côté client.

**Blocked by:** 01 (contraintes), 04 (identité stable, coordination index unique).

**Status:** ready-for-agent

- [ ] Fusion / annulation / recherche de cible au niveau du store (validations : pas d'auto-fusion, pas de chaînage)
- [ ] Dérivation client : remappage des achats vers la cible, agrégation, masquage des sources, reconstruction forcée des cibles
- [ ] Interface de fusion branchée dans l'onglet recettes du modal produit, avec les trois cas (source, cible, recherche)
- [ ] Type dérivé aligné, badges sur cartes, exports incluant les noms fusionnés
- [ ] Les lignes fusionnées des données actuelles s'affichent agrégées (vérifié sur les cas réels type crèmes doublonnées)
- [ ] Trancher le compteur de fusionnés (supprimer ou corriger, il est mort des deux côtés)

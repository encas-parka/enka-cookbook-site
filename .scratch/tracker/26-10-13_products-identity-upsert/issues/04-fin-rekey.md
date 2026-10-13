# 04: Fin du re-key et du churn d'identité

**What to build:** le premier enregistrement d'un produit garde son id sémantique (plus de changement d'id, plus de carte qui apparaît/disparaît, plus de « chargement » à l'ajout d'achat). Tous les chemins d'écriture (achat, modification, lot, achat groupé) passent par l'upsert à id stable, et le compteur de modification groupée reflète la réalité.

**Blocked by:** 01 (ids stables), 03 (primitive upsert).

**Status:** ready-for-agent

- [ ] La matérialisation pousse avec le même id (re-key et suivi d'id côté modal supprimés)
- [ ] L'orchestration privée de mise à jour devient un appelant mince de l'upsert
- [ ] La matérialisation dupliquée de l'achat groupé est alignée (id retourné utilisé, relation valide)
- [ ] La modification groupée utilise l'upsert de lot et compte les résultats réels (sélection mixte synchronisé/virtuel verte)
- [ ] Vérification de gate : achat rapide et modification sans flash ni « chargement », base dev régénérée par reset + ré-import

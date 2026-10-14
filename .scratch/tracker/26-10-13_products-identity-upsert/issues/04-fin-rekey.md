# 04: Fin du re-key et du churn d'identité

**What to build:** le premier enregistrement d'un produit garde son id sémantique (plus de changement d'id, plus de carte qui apparaît/disparaît, plus de « chargement » à l'ajout d'achat). Tous les chemins d'écriture (achat, modification, lot, achat groupé) passent par l'upsert à id stable, et le compteur de modification groupée reflète la réalité.

**Blocked by:** 01 (ids stables), 03 (primitive upsert).

**Status:** done (13-10 — implementer ticket 04, commits e7798c42 + 1cbcd39e + docs tracker)

- [x] La matérialisation pousse avec le même id (re-key et suivi d'id côté modal supprimés)
- [x] L'orchestration privée de mise à jour devient un appelant mince de l'upsert
- [x] La matérialisation dupliquée de l'achat groupé est alignée (id retourné utilisé, relation valide)
- [x] La modification groupée utilise l'upsert de lot et compte les résultats réels (sélection mixte synchronisé/virtuel verte)
- [x] La vérification automatisable de gate : contrat nouveau testé à la couture (zone produits 4 fichiers / 20 tests vertes, lot mixte et achat groupé inclus)
- [x] Base dev régénérée par reset + ré-import — **exécutée au ticket 08** (T08 : trash `pb_data`, provision 25 migrations, ré-import 974 produits sous index unique, validate 86/86)
- [!] Vérification de gate visuelle : achat rapide et modification sans flash ni « chargement » — reste à la passe navigateur humaine (gate T12 du run 26-10-12)

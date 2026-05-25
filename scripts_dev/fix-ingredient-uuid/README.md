# Scripts de développement

Ce dossier contient des scripts utilitaires pour la maintenance du projet ENKA COOKBOOK.

## Installation des dépendances

```bash
cd scripts_dev
npm install
```

## Scripts disponibles

### update-recipe-allergens.js

Met à jour les allergènes et régimes des recettes en se basant sur les données fraîches de `ingredients.json`.

**Usage :**

```bash
# Mode dry-run (voir les modifications sans les appliquer)
npm run update-allergens:dry

# Appliquer les modifications
npm run update-allergens

# Ou directement avec node
node update-recipe-allergens.js [--dry-run] [--yes]
```

**Options :**
- `--dry-run` : Affiche les modifications sans les écrire
- `--yes` : Confirme automatiquement toutes les questions

**Ce que fait le script :**

1. Vérifie que le dépôt git est propre (pas de modifications non commitées)
2. Charge `ingredients.json` pour avoir les données fraîches
3. Parcourt toutes les recettes dans `content/recipe/`
4. Pour chaque ingrédient de chaque recette :
   - Met à jour les allergènes depuis `ingredients.json`
   - Met à jour le type, pF, pS
5. Recalcule les régimes de la recette (vegan, végétarien, sans-gluten, sans-lactose)
6. Affiche un résumé des modifications
7. Propose de créer un commit git automatique

**Exemple de sortie :**

```
📝 babka-vegane-harissa-e_qph5vukgdjb6
   Ingrédient: Pistache émondée
   + Ajouté: Fruit à coque
📝 bahn-mi-a-la-proteine-_go4i0y6buluy
   Ingrédient: Pain baguette
   + Ajouté: Gluten
   - Régimes supprimés: sans-gluten

═══════════════════════════════════════════════════════════════
  RÉSUMÉ
═══════════════════════════════════════════════════════════════

📊 Recettes traitées:     294
✅ Recettes mises à jour: 13
🔧 Ingrédients mis à jour: 13
+   Allergènes ajoutés:    15
-   Allergènes supprimés:  0
```

**Sécurité :**

- Le script vérifie toujours l'état git avant de modifier des fichiers
- Un commit est créé automatiquement avec les modifications
- Pour annuler : `git reset HEAD~1`

**Quand l'utiliser :**

- Après avoir mis à jour `ingredients.json` (ajout/modification d'allergènes)
- Quand des ingrédients ont été mal renseignés initialement
- Pour synchroniser toutes les recettes avec les données actuelles d'ingrédients

### fix-appwrite-uuids/

Corrige les UUIDs d'ingrédients dans les recettes Appwrite qui ont été créées via l'UI (UUIDs 21 chars au lieu des UUIDs Hugo 6 chars). Workflow en 3 étapes : audit → plan → application.

```bash
bun run scripts_dev/fix-appwrite-uuids/audit.ts          # Identifier les UUIDs divergents
bun run scripts_dev/fix-appwrite-uuids/generate-plan.ts  # Générer le plan (dry run)
bun run scripts_dev/fix-appwrite-uuids/apply.ts          # Appliquer les corrections
```

**Prérequis :** `appwrite login` dans le dossier `appwrite/`.

→ Voir [`fix-appwrite-uuids/README.md`](fix-appwrite-uuids/README.md) pour la documentation complète.

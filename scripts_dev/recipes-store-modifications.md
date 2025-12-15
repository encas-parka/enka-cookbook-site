# Modifications nécessaires pour RecipesStore.svelte.ts

## Contexte
Avec la nouvelle structure où chaque recette a un slug et un UUID, nous devons adapter le RecipesStore pour :
1. Utiliser le slug pour construire les URLs au lieu de stocker le path complet
2. Ajouter le support du slug dans les types et les structures de données
3. Adapter la méthode getRecipeByUuid pour construire l'URL à partir du slug

## Modifications requises

### 1. Mettre à jour les types (fichier recipes.types.ts)

Ajouter le champ `s` (slug) à l'interface `RecipeIndexEntry` :

```typescript
interface RecipeIndexEntry {
  u: string;       // UUID
  s: string;       // Slug - NOUVEAU
  n: string;       // Nom
  t: string;       // Type
  c: string[];     // Catégories
  r: string[];     // Régimes
  cu: boolean;     // Cuisson
  a: string;       // Auteur
  d: boolean;      // Draft
  serveHot: boolean;
  plates: number;
  q: string;       // Quantité description
  ch: boolean;     // Check
  checkfor: string;
  pd: string;      // Publish date
  materiel: string[];
  saison: string[];
  specialite: string[];
  ingredients: string[];
  // p: string;    // Path - À SUPPRIMER
}
```

### 2. Adapter la méthode getRecipeByUuid

Remplacer la logique qui utilise `indexEntry.p` par une construction d'URL à partir du slug :

```typescript
// Remplacer cette partie (ligne ~830-840):
if (indexEntry.p) {
  // 4a. Recette Hugo : fetch depuis le fichier JSON
  console.log(
    `[RecipesStore] Chargement des détails de ${uuid} depuis ${indexEntry.p}...`,
  );
  const response = await fetch(indexEntry.p);
  // ...
}

// Par cette nouvelle logique :
// 4a. Recette Hugo : construire l'URL à partir du slug
const recipePath = `/recettes/${indexEntry.s}/recipe.json`;
console.log(
  `[RecipesStore] Chargement des détails de ${uuid} depuis ${recipePath}...`,
);
const response = await fetch(recipePath);
```

### 3. Mettre à jour la méthode getRecipeIndexByUuid

Cette méthode doit maintenant aussi retourner le slug :

```typescript
getRecipeIndexByUuid(uuid: string): RecipeIndexEntry | null {
  return this.#recipesIndex.get(uuid) || null;
}
```

### 4. Adapter les méthodes qui utilisent le path

Toutes les méthodes qui construisent des URLs ou utilisent le path doivent être mises à jour pour utiliser le slug à la place. Par exemple :

- `createRecipe` : doit retourner le slug dans la structure
- `updateRecipe` : doit gérer le slug
- `duplicateRecipe` : doit copier le slug

### 5. Mettre à jour le cache IndexedDB

Le cache doit aussi être mis à jour pour stocker et récupérer les slugs.

## Avantages de cette approche

1. **Plus simple** : Pas besoin de stocker le path complet dans l'index
2. **Plus robuste** : La construction de l'URL est déterministe à partir du slug
3. **Plus maintenable** : Moins de dépendance à la structure des fichiers
4. **Plus flexible** : Permet de changer la structure des URLs sans casser l'index

## Étapes de migration

1. Exécuter le script de migration pour ajouter les slugs à toutes les recettes
2. Mettre à jour les types TypeScript
3. Adapter le RecipesStore comme décrit ci-dessus
4. Tester avec un petit échantillon de recettes
5. Déployer la mise à jour

## Notes importantes

- Le slug doit être unique et stable (ne pas changer après création)
- Le slug doit être utilisé comme identifiant principal dans les URLs
- L'UUID reste utilisé comme clé interne pour la cohérence avec Appwrite
- Les références entre recettes doivent utiliser le slug, pas l'UUID
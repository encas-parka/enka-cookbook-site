# Données de développement

Ce dossier contient les fichiers JSON utilisés pour le développement de l'application Svelte sans avoir besoin de lancer le serveur HUGO.

## Comment créer un fichier de dev

### Méthode 1 : Depuis l'application (recommandé)

1. Lancez l'application avec HUGO (`hugo server` + `bun run dev`)
2. Ouvrez la console du navigateur
3. Exécutez la commande :
   ```javascript
   import { generateDevFileFromHugo } from '/src/lib/services/dev-data.js';
   await generateDevFileFromHugo('votre-list-id');
   ```

### Méthode 2 : Manuelle

1. Récupérez le JSON généré par HUGO : `/evenements/votre-list-id/ingredients_aw/index.json`
2. Copiez-le dans ce dossier sous le nom `votre-list-id.json`

## Structure du fichier

Le fichier JSON doit suivre la structure `HugoEventData` :
```typescript
interface HugoEventData {
  mainGroup_id: string;
  name: string;
  hugoContentHash: string;
  allDates: string[];
  ingredients: HugoIngredient[];
}
```

## Utilisation

En développement (`npm run dev`), l'application cherchera automatiquement les fichiers dans ce dossier avant de charger les données HUGO.

- Si un fichier existe : utilise les données locales
- Si aucun fichier : utilise les données HUGO ou affiche des données de démonstration

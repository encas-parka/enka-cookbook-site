/**
 * RecipesStore - Store de gestion des recettes avec Svelte 5
 *
 * Architecture:
 * 1. Chargement de l'index léger depuis data.json (recettes publiées)
 * 2. Chargement des recettes drafts depuis Appwrite
 * 3. Fusion dans un index unifié
 * 4. Lazy loading des détails depuis /recettes/.../recipe.json ou Appwrite avec fallback automatique
 * 5. Cache IndexedDB pour performance
 *
 * Responsabilités:
 * - Charger et fusionner recettes Hugo + Appwrite
 * - Lazy-load les détails de recettes à la demande
 * - Fournir une API de recherche/filtrage
 * - Gérer le cache IndexedDB (stratégie, pas l'implémentation)
 * - Realtime pour les recettes Appwrite
 * - Gérer les verrous d'édition
 *
 * Note: Les opérations CRUD (create/update/delete) sont gérées directement
 * par les composants via appwrite-recipes.ts. Le store reçoit les mises
 * à jour via realtime pour maintenir la cohérence.
 *
 * @usage
 * await recipesStore.initialize();
 * const recipe = await recipesStore.getRecipeByUuid('5f3ada9bde90');
 * const results = recipesStore.searchRecipes('houmous');
 */

import { SvelteMap } from "svelte/reactivity";
import type {
  RecipeIndexEntry,
  RecipeForDisplay,
} from "../types/recipes.types";
import {
  createRecipesIDBCache,
  type RecipesIDBCache,
} from "../services/recipes-idb-cache";
import {
  parseRecipeIndexEntry,
  parseAppwriteRecipeToIndexEntry,
  astucesFromAppwrite,
} from "../utils/recipeUtils";
import { parseRecipeData } from "../utils/recipeUtils";
import { ingredientsFromAppwrite } from "../utils/ingredientUtils";
import {
  forceReloadAllAppwriteRecipes,
  getRecipeAppwrite as getAppwriteRecipe,
  updateRecipeAppwrite,
  listUpdatedRecipes,
  RECIPES_COLLECTION_ID,
} from "../services/appwrite-recipes";
import { globalState } from "./GlobalState.svelte";
import { getDatabaseId } from "../services/appwrite";
import { realtimeManager } from "./RealtimeManager.svelte";

// =============================================================================
// CONFIGURATION
// =============================================================================

// URL du fichier data.json (proxié par Vite en mode dev vers Hugo)

const DATA_JSON_URL = "/data/data.json";

// =============================================================================
// STORE SINGLETON
// =============================================================================

class RecipesStore {
  // État réactif - Index (Hugo + Appwrite fusionné)
  #recipesIndex = $state(new SvelteMap<string, RecipeIndexEntry>());

  // État UI
  #loading = $state(false);
  #error = $state<string | null>(null);
  #isInitialized = $state(false);
  #versionTimestamp = $state<number | null>(null);

  // Cache IndexedDB
  #cache: RecipesIDBCache | null = null;

  // Tracking des chargements en cours (pour éviter les doublons)
  #loadingDetails = new Set<string>();

  // Promise d'initialisation en cours pour déduplication
  #initPromise: Promise<void> | null = null;
  #realtimeInitialized = false;

  // Getters publics
  get loading() {
    return this.#loading;
  }

  get error() {
    return this.#error;
  }

  get isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Liste réactive de l'index des recettes
   */
  get recipesIndex() {
    return Array.from(this.#recipesIndex.values());
  }

  /**
   * Nombre de recettes dans l'index
   */
  get count() {
    return this.#recipesIndex.size;
  }

  /**
   * Retourne toutes les recettes de l'index (pour la page de liste)
   */
  getAllRecipes(): RecipeIndexEntry[] {
    return Array.from(this.#recipesIndex.values());
  }

  // =============================================================================
  // INITIALISATION PHASÉE (OPTIMISATION)
  // =============================================================================

  /**
   * Phase 1 : Charger uniquement depuis le cache IndexedDB
   * Appelé au démarrage pour afficher l'UI rapidement
   */
  async loadCache(): Promise<void> {
    if (this.#isInitialized) {
      console.log("[RecipesStore] Cache déjà chargé");
      return;
    }

    console.log("[RecipesStore] Chargement du cache...");
    this.#loading = true;
    this.#error = null;

    try {
      // Ouvrir le cache IndexedDB
      this.#cache = await createRecipesIDBCache();

      // Charger l'index depuis le cache
      const cachedIndex = await this.#cache.loadRecipesIndex();
      const cachedMetadata = await this.#cache.loadMetadata();

      if (cachedIndex.size > 0) {
        console.log(
          `[RecipesStore] ${cachedIndex.size} recettes (index) chargées depuis le cache`,
        );
        this.#recipesIndex = new SvelteMap(cachedIndex);
      }

      this.#isInitialized = true;
      console.log(
        `[RecipesStore] Cache chargé: ${this.#recipesIndex.size} recettes`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement du cache";
      this.#error = message;
      console.error("[RecipesStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 2 : Synchroniser avec les sources distantes (Hugo JSON + Appwrite)
   * Appelé après loadCache
   */
  async syncFromRemote(): Promise<void> {
    if (!this.#cache) {
      console.warn("[RecipesStore] Impossible de sync : cache non initialisé");
      return;
    }

    console.log("[RecipesStore] Synchronisation depuis sources distantes...");
    this.#loading = true;

    try {
      const cachedMetadata = await this.#cache.loadMetadata();

      // 1. Charger l'index depuis data.json (Hugo)
      try {
        await this.#loadIndexFromDataJson(cachedMetadata);
      } catch (err) {
        console.error("[RecipesStore] Erreur chargement data.json:", err);
        if (this.#recipesIndex.size === 0) {
          throw new Error("Aucun cache disponible et data.json inaccessible");
        }
        console.log("[RecipesStore] Continuation avec les données du cache");
      }

      // 2. Sync Incrémentiel Appwrite
      if (globalState.userId) {
        try {
          await this.#incrementalSync(cachedMetadata);
        } catch (err) {
          console.warn("[RecipesStore] Erreur sync Appwrite:", err);
        }
      }

      console.log(
        `[RecipesStore] Synchronisation terminée: ${this.#recipesIndex.size} recettes`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de la synchronisation";
      this.#error = message;
      console.error("[RecipesStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 2 (Publique): Synchroniser uniquement depuis Hugo JSON
   * Appelé pour les utilisateurs non authentifiés
   */
  async syncFromRemotePublicOnly(): Promise<void> {
    if (!this.#cache) {
      console.warn("[RecipesStore] Impossible de sync : cache non initialisé");
      return;
    }

    console.log("[RecipesStore] Synchronisation publique (Hugo uniquement)...");
    this.#loading = true;

    try {
      const cachedMetadata = await this.#cache.loadMetadata();

      // 1. Charger l'index depuis data.json (Hugo) - PAS de sync Appwrite
      try {
        await this.#loadIndexFromDataJson(cachedMetadata);
      } catch (err) {
        console.error("[RecipesStore] Erreur chargement data.json:", err);
        if (this.#recipesIndex.size === 0) {
          throw new Error("Aucun cache disponible et data.json inaccessible");
        }
        console.log("[RecipesStore] Continuation avec les données du cache");
      }

      console.log(
        `[RecipesStore] Synchronisation publique terminée: ${this.#recipesIndex.size} recettes`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erreur lors de la synchronisation publique";
      this.#error = message;
      console.error("[RecipesStore]", message, err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Phase 3 : Setup du realtime (appelé après syncFromRemote)
   */
  async setupRealtime(): Promise<void> {
    if (!this.#cache) {
      console.warn(
        "[RecipesStore] Impossible de setup realtime : cache non initialisé",
      );
      return;
    }

    // Vérifier si déjà configuré pour éviter les doublons
    // ✅ SAUF si le RealtimeManager a été détruit (changement auth)
    if (this.#realtimeInitialized && realtimeManager.isInitialized) {
      console.log("[RecipesStore] Realtime déjà configuré");
      return;
    }

    // Réinitialiser le flag si le RealtimeManager a été détruit
    if (this.#realtimeInitialized && !realtimeManager.isInitialized) {
      console.log(
        "[RecipesStore] RealtimeManager détruit, réinitialisation...",
      );
      this.#realtimeInitialized = false;
    }

    console.log("[RecipesStore] Configuration du realtime...");

    // ✅ Pas de realtime pour les visiteurs
    // Note: #realtimeInitialized reste false pour permettre l'initialisation
    // lorsque l'utilisateur se connecte (mode visiteur → authentifié)
    if (!globalState.isAuthenticated) {
      console.log("[RecipesStore] Mode visiteur : pas de realtime");
      return;
    }

    try {
      this.#setupRealtime();
      this.#realtimeInitialized = true;
    } catch (err) {
      console.warn("[RecipesStore] Erreur activation realtime:", err);
    }
  }

  // =============================================================================
  // INITIALISATION (LÉGACY - COMPATIBILITÉ)
  // =============================================================================

  /**
   * Initialise le store
   * 1. Ouvre le cache IndexedDB
   * 2. Charge l'index depuis le cache si disponible
   * 3. Charge l'index depuis data.json (recettes published)
   * 4. Cleanup : marque les recettes Appwrite comme published si présentes dans Hugo
   * 5. Charge les recettes non-published depuis Appwrite
   * 6. Active le realtime pour les recettes Appwrite
   */
  async initialize(): Promise<void> {
    // 1. Déjà initialisé ?
    if (this.#isInitialized) {
      console.log("[RecipesStore] Déjà initialisé");
      return;
    }

    // 2. Initialisation déjà en cours ?
    if (this.#initPromise) {
      console.log("[RecipesStore] Initialisation déjà en cours, attente...");
      return this.#initPromise;
    }

    // 3. Nouvelle initialisation
    console.log("[RecipesStore] Initialisation...");
    this.#loading = true;
    this.#error = null;

    // Créer la promesse d'initialisation
    this.#initPromise = (async () => {
      try {
        // Phase 1: Charger le cache
        await this.loadCache();

        // Phase 2: Sync depuis les sources distantes
        await this.syncFromRemote();

        // Phase 3: Setup realtime
        await this.setupRealtime();

        // Vérification finale
        if (this.#recipesIndex.size === 0) {
          const message = "Aucune recette disponible après initialisation";
          this.#error = message;
          console.warn("[RecipesStore]", message);
        }

        console.log(
          `[RecipesStore] Initialisation complétée: ${this.#recipesIndex.size} recettes`,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors de l'initialisation";
        this.#error = message;
        console.error("[RecipesStore] ECHEC Initialisation:", message, err);
        throw err;
      } finally {
        this.#loading = false;
        this.#initPromise = null; // Nettoyer la promesse pour permettre une nouvelle tentative si nécessaire
      }
    })();

    return this.#initPromise;
  }

  /**
   * Charge l'index (`data.json`).
   * Vérifie le timestamp inclus dans `meta` pour savoir si le cache doit être mis à jour.
   */
  async #loadIndexFromDataJson(cachedMetadata: any): Promise<void> {
    try {
      console.log("[RecipesStore] Chargement data.json...");

      // 1. Fetch data.json
      const response = await fetch(DATA_JSON_URL);
      if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
      const data = await response.json();

      // 2. Vérification structure & Timestamp
      if (!Array.isArray(data.recipes)) {
        throw new Error("Format invalide: recipes n'est pas un tableau");
      }

      const remoteTimestamp = data.meta?.timestamp;
      this.#versionTimestamp = remoteTimestamp; // Toujours stocker le dernier timestamp vu

      if (
        remoteTimestamp &&
        cachedMetadata &&
        cachedMetadata.buildTimestamp &&
        cachedMetadata.buildTimestamp >= remoteTimestamp
      ) {
        console.log(
          `[RecipesStore] Cache à jour (Ts: ${cachedMetadata.buildTimestamp} >= ${remoteTimestamp})`,
        );

        // Même si le cache est à jour par rapport au build, on peut vouloir
        // mettre à jour l'index en mémoire si on n'avait rien (premier chargement)
        // Mais ici on suppose que loadRecipesIndex a déjà rempli this.#recipesIndex
        return;
      }

      console.log(
        `[RecipesStore] Nouvelle version détectée ou cache manquant (Ts: ${remoteTimestamp}), Traitement...`,
      );

      // 3. Smart Merge (Index en mémoire vs Nouvelles données)
      const recipes = data.recipes.map((r: any) => parseRecipeIndexEntry(r));
      let updatedCount = 0;

      recipes.forEach((newRecipe: RecipeIndexEntry) => {
        const existing = this.#recipesIndex.get(newRecipe.$id);

        let shouldUpdate = false;
        if (!existing) {
          shouldUpdate = true; // Nouveau
        } else {
          // Si existant, comparer les dates de mise à jour pour éviter d'écraser un changement Appwrite récent
          // non encore buildé par Hugo.
          const newDate = new Date(newRecipe.$updatedAt).getTime();
          const existingDate = new Date(existing.$updatedAt).getTime();
          if (newDate > existingDate) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          this.#recipesIndex.set(newRecipe.$id, newRecipe);
          updatedCount++;
        }
      });

      console.log(
        `[RecipesStore] Smart Merge: ${updatedCount} recettes mises à jour/ajoutées.`,
      );

      // 4. Mise à jour du cache
      if (this.#cache) {
        // Sauvegarder l'index complet (mémoire)
        await this.#cache.saveRecipesIndex(this.#recipesIndex);
        await this.#cache.saveMetadata({
          ...cachedMetadata,
          buildTimestamp: remoteTimestamp || Date.now() / 1000,
          recipesCount: this.#recipesIndex.size,
          cacheVersion: 1,
        });
      }
    } catch (err) {
      console.error("[RecipesStore] Erreur loadIndexFromDataJson:", err);
      throw err;
    }
  }

  /**
   * Recharge manuellement toutes les recettes depuis Appwrite
   * À utiliser via le bouton "Recharger les recettes" dans l'UI
   */
  async forceReloadAllRecipes(): Promise<void> {
    if (!globalState.userId) {
      throw new Error("Utilisateur non connecté");
    }

    this.#loading = true;
    this.#error = null;

    try {
      console.log("[RecipesStore] Rechargement forcé des recettes Appwrite...");

      // Charger TOUTES les recettes Appwrite
      const appwriteRecipes = await forceReloadAllAppwriteRecipes();

      // Filtrer et ajouter à l'index via la méthode de parsing existante
      let addedCount = 0;
      let deletedCount = 0;

      appwriteRecipes.forEach((recipe) => {
        // Si la recette est supprimée, on la retire de l'index
        if (recipe.status === "deleted") {
          if (this.#recipesIndex.has(recipe.$id)) {
            this.#recipesIndex.delete(recipe.$id);
            deletedCount++;
            console.log(
              `[RecipesStore] Recette ${recipe.$id} supprimée (status=deleted)`,
            );
          }
        } else {
          this.#recipesIndex.set(
            recipe.$id,
            parseAppwriteRecipeToIndexEntry(recipe),
          );
          addedCount++;
        }
      });

      console.log(
        `[RecipesStore] ${addedCount} recettes Appwrite chargées, ${deletedCount} supprimées`,
      );

      // Mettre à jour le cache
      if (this.#cache) {
        const cachedMetadata = await this.#cache.loadMetadata();
        const now = new Date().toISOString();
        await this.#cache.saveRecipesIndex(this.#recipesIndex);
        await this.#cache.saveMetadata({
          ...cachedMetadata,
          lastAppwriteSync: now,
          recipesCount: this.#recipesIndex.size,
          cacheVersion: 1,
        });
      }

      console.log("[RecipesStore] Rechargement forcé terminé");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du rechargement";
      this.#error = message;
      console.error("[RecipesStore] Erreur rechargement forcé:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Hard reset : Vide TOUT (état Svelte + cache IDB) et recharge depuis zéro
   * Utilisé en mode dev pour repartir de zéro
   */
  async hardReset(): Promise<void> {
    if (!globalState.userId) {
      throw new Error("Utilisateur non connecté");
    }

    console.log("[RecipesStore] 🔄 HARD RESET - Vidage complet...");
    this.#loading = true;
    this.#error = null;

    try {
      // 1. Vider l'état Svelte
      this.#recipesIndex.clear();

      // 2. Vider le cache IndexedDB
      if (this.#cache) {
        await this.#cache.clear();
        console.log("[RecipesStore] Cache IDB vidé");
      }

      // 3. Recharger depuis data.json (Hugo)
      await this.#loadIndexFromDataJson(null); // null = pas de cachedMetadata

      // 4. Charger TOUTES les recettes Appwrite
      const appwriteRecipes = await forceReloadAllAppwriteRecipes();

      // 5. Filtrer et ajouter à l'index via la méthode de parsing existante
      let addedCount = 0;
      let deletedCount = 0;

      appwriteRecipes.forEach((recipe) => {
        // Si la recette est supprimée, on l'ignore (hard reset = état propre)
        if (recipe.status !== "deleted") {
          this.#recipesIndex.set(
            recipe.$id,
            parseAppwriteRecipeToIndexEntry(recipe),
          );
          addedCount++;
        } else {
          deletedCount++;
        }
      });

      console.log(
        `[RecipesStore] ${addedCount} recettes Appwrite chargées, ${deletedCount} supprimées ignorées`,
      );

      // 6. Recréer le cache avec les données fraîches
      if (this.#cache) {
        const now = new Date().toISOString();
        await this.#cache.saveRecipesIndex(this.#recipesIndex);
        await this.#cache.saveMetadata({
          buildTimestamp: this.#versionTimestamp,
          lastAppwriteSync: now,
          recipesCount: this.#recipesIndex.size,
          cacheVersion: 1,
        });
        console.log("[RecipesStore] Cache IDB recréé");
      }

      console.log("[RecipesStore] ✓ HARD RESET terminé");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du hard reset";
      this.#error = message;
      console.error("[RecipesStore] Erreur hard reset:", err);
      throw err;
    } finally {
      this.#loading = false;
    }
  }

  /**
   * Sync Incrémentiel avec Appwrite
   * Récupère :
   * - TOUS les drafts modifiés depuis lastAppwriteSync (ou tous les drafts si pas de lastAppwriteSync)
   * - Les recettes publiées modifiées depuis buildTimestamp (déjà dans le JSON)
   */
  async #incrementalSync(cachedMetadata: any): Promise<void> {
    console.log("[RecipesStore] Sync incrémentiel Appwrite...");

    // 1. Récupérer TOUS les drafts modifiés depuis lastAppwriteSync
    // Si pas de lastAppwriteSync (cache vide), on récupère TOUS les drafts
    const draftSince =
      cachedMetadata?.lastAppwriteSync || "1970-01-01T00:00:00.000Z";

    // 2. Récupérer les recettes publiées modifiées depuis buildTimestamp
    // Si pas de buildTimestamp, on utilise 1970 pour tout récupérer
    const publishedSince = cachedMetadata?.buildTimestamp
      ? new Date(cachedMetadata.buildTimestamp * 1000).toISOString()
      : "1970-01-01T00:00:00.000Z";

    console.log(`[RecipesStore] Sync Appwrite: depuis ${draftSince}`);

    // Récupérer les recettes modifiées via le service existant
    // Note: listUpdatedRecipes utilise $updatedAt donc récupère aussi les deleted
    const updatedRecipes = await listUpdatedRecipes(draftSince);

    if (updatedRecipes.length === 0) {
      console.log("[RecipesStore] Aucune mise à jour Appwrite détectée.");
      return;
    }

    console.log(
      `[RecipesStore] ${updatedRecipes.length} recettes mises à jour depuis Appwrite.`,
    );

    let updatedCount = 0;
    let deletedCount = 0;

    updatedRecipes.forEach((recipe) => {
      // Si la recette est supprimée, on la retire de l'index
      if (recipe.status === "deleted") {
        if (this.#recipesIndex.has(recipe.$id)) {
          this.#recipesIndex.delete(recipe.$id);
          deletedCount++;
          console.log(
            `[RecipesStore] Recette ${recipe.$id} supprimée (status=deleted)`,
          );
        }
      } else {
        // Parsing unifié
        const indexEntry = parseAppwriteRecipeToIndexEntry(recipe);

        // Upsert incontestable (Appwrite est la source de vérité pour les modifs récentes)
        this.#recipesIndex.set(indexEntry.$id, indexEntry);

        updatedCount++;
      }
    });

    // Mettre à jour lastAppwriteSync
    const now = new Date().toISOString();

    if (this.#cache) {
      await this.#cache.saveRecipesIndex(this.#recipesIndex);
      await this.#cache.saveMetadata({
        ...cachedMetadata,
        lastAppwriteSync: now,
      });
    }

    console.log(
      `[RecipesStore] Sync incrémentiel terminé (${updatedCount} mises à jour, ${deletedCount} supprimées).`,
    );
  }

  /**
   * Configure le realtime pour les recettes Appwrite
   */
  async #setupRealtime(): Promise<void> {
    try {
      console.log("[RecipesStore] Configuration du Realtime...");
      const DB_ID = getDatabaseId();

      realtimeManager.register(
        [`databases.${DB_ID}.collections.${RECIPES_COLLECTION_ID}.documents`],
        async (response: any) => {
          const recipe = response.payload as any; // Recettes type defined via JSDoc or import

          let eventType = "update";
          if (response.events.some((e: string) => e.includes(".create"))) {
            eventType = "create";
          } else if (
            response.events.some((e: string) => e.includes(".delete"))
          ) {
            eventType = "delete";
          }

          console.log(
            `[RecipesStore] ⚡️ Realtime RECEIVED: ${eventType} pour ${recipe.$id}`,
          );

          if (eventType === "create" || eventType === "update") {
            // Gérer les recettes supprimées (status = "deleted")
            if (recipe.status === "deleted") {
              this.#recipesIndex.delete(recipe.$id);
              if (this.#cache) {
                try {
                  await this.#cache.deleteRecipeFromIndex(recipe.$id);
                  console.log(
                    `[RecipesStore] Recette ${recipe.$id} supprimée de l'index (status=deleted)`,
                  );
                } catch (error) {
                  console.warn(
                    `[RecipesStore] Erreur suppression index ${recipe.$id}:`,
                    error,
                  );
                }
              }
              return;
            }

            // 1. Mettre à jour l'index
            const indexEntry = parseAppwriteRecipeToIndexEntry(recipe);
            this.#recipesIndex.set(recipe.$id, indexEntry);

            // 2. Préparer les détails complets
            const ingredients = ingredientsFromAppwrite(recipe.ingredients);
            const recipeData: RecipeForDisplay = {
              ...recipe,
              ingredients: ingredients,
              astuces: astucesFromAppwrite(recipe.astuces),
            };

            // 3. Mettre à jour les détails dans le cache
            if (this.#cache) {
              try {
                await this.#cache.saveRecipeDetail(recipeData);
                console.log(
                  `[RecipesStore] Détails de ${recipe.$id} mis à jour dans le cache`,
                );
              } catch (error) {
                console.warn(
                  `[RecipesStore] Erreur mise à jour cache détails ${recipe.$id}:`,
                  error,
                );
              }
            }
          } else if (eventType === "delete") {
            this.#recipesIndex.delete(recipe.$id);
            if (this.#cache) {
              try {
                await this.#cache.deleteRecipeFromIndex(recipe.$id);
                console.log(
                  `[RecipesStore] Recette ${recipe.$id} supprimée du cache`,
                );
              } catch (error) {
                console.warn(
                  `[RecipesStore] Erreur suppression cache ${recipe.$id}:`,
                  error,
                );
              }
            }
          }
        },
      );

      console.log("[RecipesStore] Realtime enregistré auprès du manager");
    } catch (err) {
      console.error(
        "[RecipesStore] Erreur lors de la configuration du realtime:",
        err,
      );
    }
  }

  // =============================================================================
  // API PUBLIQUE - LECTURE INDEX
  // =============================================================================

  /**
   * Récupère une entrée d'index par $id
   */
  getRecipeIndexByUuid($id: string): RecipeIndexEntry | null {
    const result = this.#recipesIndex.get($id) || null;
    return result;
  }

  /**
   * Normalise une chaîne en ignorant les accents et la casse
   */
  #normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Supprime les diacritiques
  }

  /**
   * Recherche des recettes par texte (mots entiers, début de mots)
   * Ignorer les majuscules et accents
   */
  searchRecipes(query: string): RecipeIndexEntry[] {
    if (!query.trim()) {
      return this.recipesIndex;
    }

    const searchTerms = this.#normalizeString(query.trim()).split(/\s+/);

    return this.recipesIndex.filter((recipe) => {
      const recipeTitle = this.#normalizeString(recipe.title);

      // Découper le titre en mots (par espaces, tirets, underscores)
      const titleWords = recipeTitle.split(/[\s\-_]+/);

      // Tous les termes de recherche doivent matcher le début d'au moins un mot
      // Exemple: "lasagne bol" → cherche "lasagne" ET "bol" comme début de mots
      return searchTerms.every((term) =>
        titleWords.some((word) => word.startsWith(term)),
      );
    });
  }

  /**
   * Récupère tous les types de recettes disponibles
   */
  get availableTypes(): string[] {
    const types = new Set<string>();
    this.recipesIndex.forEach((recipe) => types.add(recipe.typeR));
    return Array.from(types).sort();
  }

  /**
   * Vérifie si l'utilisateur peut éditer une recette
   * @param uuid - UUID de la recette
   * @returns true si l'utilisateur peut éditer, false sinon
   */
  async canEditRecipe(uuid: string): Promise<boolean> {
    if (!globalState.userId) return false;

    // Recettes Appwrite : vérifier permissions
    try {
      const recipe = await getAppwriteRecipe(uuid);
      if (!recipe) return false;

      return (
        recipe.createdBy === globalState.userId ||
        Boolean(recipe.permissionWrite?.includes(globalState.userId)) ||
        Boolean(
          recipe.teams?.some((teamId) =>
            globalState.userTeams.includes(teamId),
          ),
        )
      );
    } catch (err) {
      console.error(
        `[RecipesStore] Erreur lors de la vérification des permissions pour ${uuid}:`,
        err,
      );
      return false;
    }
  }

  /**
   * Récupère le statut de verrouillage d'une recette depuis l'index
   * @param uuid - UUID de la recette
   * @returns ID de l'utilisateur qui verrouille ou null
   */
  getRecipeLockStatus(uuid: string): string | null {
    const entry = this.#recipesIndex.get(uuid);
    return entry?.lockedBy || null;
  }

  // =============================================================================
  // API PUBLIQUE - LOCKING
  // =============================================================================
  /**
   * Met à jour le verrou d'une recette (optimisé - appel direct Appwrite)
   * @param uuid - UUID de la recette
   * @param lockedBy - ID utilisateur ou null pour déverrouiller
   */
  async updateRecipeLock(uuid: string, lockedBy: string | null): Promise<void> {
    if (!globalState.userId) return;

    try {
      // Appel direct à Appwrite - plus de cloud function pour le lock
      await updateRecipeAppwrite(
        uuid,
        {
          lockedBy,
        },
        globalState.userId,
      );

      console.log(
        `[RecipesStore] Verrou ${uuid} mis à jour: ${lockedBy || "libéré"}`,
      );

      // Mise à jour locale immédiate de l'INDEX pour UX (le realtime synchronisera les autres)
      const currentIndex = this.#recipesIndex.get(uuid);
      if (currentIndex) {
        this.#recipesIndex.set(uuid, { ...currentIndex, lockedBy });
      }
    } catch (error) {
      console.error(`[RecipesStore] Erreur verrouillage ${uuid}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // API PUBLIQUE - LAZY LOADING DÉTAILS
  // =============================================================================

  /**
   * Retourne les détails complets d'une recette avec détection intelligente de source
   *
   * Architecture optimisée (IDB First):
   * 1. IndexedDB cache (lazy loading)
   * 2. Source intelligente: Hugo JSON pour les publiées, Appwrite pour les brouillons
   * 3. Cache persistant automatique
   *
   * @param uuid - slug-uuid de la recette
   * @returns Détails de la recette ou null si non trouvée
   */
  async getRecipeByUuid(uuid: string): Promise<RecipeForDisplay | null> {
    // 1. Éviter les chargements parallèles du même UUID
    if (this.#loadingDetails.has(uuid)) {
      console.log(
        `[RecipesStore] Chargement de ${uuid} déjà en cours, attente...`,
      );
      while (this.#loadingDetails.has(uuid)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      // Une fois le chargement parallèle fini, on retente la lecture IDB
      if (this.#cache) {
        return (
          ((await this.#cache.loadRecipeDetail(
            uuid,
          )) as unknown as RecipeForDisplay) || null
        );
      }
      return null;
    }

    this.#loadingDetails.add(uuid);

    try {
      // 2. Vérifier IndexedDB cache (Source de vérité locale)
      if (this.#cache) {
        const cachedDetail = await this.#cache.loadRecipeDetail(uuid);
        if (cachedDetail) {
          return cachedDetail;
        }
      }

      // 3. Stratégie de chargement avec fallback automatique
      // On tente Hugo en premier (plus rapide, pas d'auth),
      // si ça échoue, on tente Appwrite
      let recipeData: RecipeForDisplay | null = null;

      // 3a. Tenter Hugo (recette publiée)
      try {
        const recipePath = `/recettes/${uuid}/recipe.json`;
        const response = await fetch(recipePath);
        if (response.ok) {
          const rawData = await response.json();
          recipeData = parseRecipeData(rawData);
          console.log(`[RecipesStore] ${uuid} chargée depuis Hugo`);
        }
      } catch (err) {
        console.log(`[RecipesStore] ${uuid} non trouvée dans Hugo`);
      }

      // 3b. Fallback Appwrite (si Hugo échoue ET utilisateur connecté)
      if (!recipeData && globalState.userId) {
        try {
          const appwriteRecipe = await getAppwriteRecipe(uuid);
          if (appwriteRecipe) {
            // Convertir les ingrédients Appwrite au format RecipeIngredient[]
            const ingredients = ingredientsFromAppwrite(
              appwriteRecipe.ingredients || [],
            );

            recipeData = {
              ...appwriteRecipe,
              ingredients,
              // NORMALISER: astuces doit toujours être un array
              astuces: astucesFromAppwrite(appwriteRecipe.astuces),
              prepAlt: appwriteRecipe.prepAlt || null,
              categories: appwriteRecipe.categories,
              regime: appwriteRecipe.regime,
              saison: appwriteRecipe.saison,
              teams: appwriteRecipe.teams,
              permissionWrite: appwriteRecipe.permissionWrite,
            };
            console.log(
              `[RecipesStore] ${uuid} chargée depuis Appwrite (fallback)`,
            );
          }
        } catch (err) {
          console.log(`[RecipesStore] ${uuid} non trouvée dans Appwrite`);
        }
      }

      // 4. Mettre en cache si trouvé
      if (recipeData && this.#cache) {
        await this.#cache.saveRecipeDetail(recipeData);
      }

      if (!recipeData) {
        console.warn(`[RecipesStore] ${uuid} non trouvée (Hugo ni Appwrite)`);
      }

      return recipeData;
    } catch (err) {
      console.error(
        `[RecipesStore] Erreur lors du chargement de ${uuid}:`,
        err,
      );
      return null;
    } finally {
      this.#loadingDetails.delete(uuid);
    }
  }

  /**
   * Récupère plusieurs recettes en une seule opération bulk (OPTIMISATION)
   *
   * Stratégie :
   * 1. Charger depuis IDB en bulk (1 transaction)
   * 2. Identifier les UUIDs manquants
   * 3. Fetch manquants en parallèle (Hugo/Appwrite)
   * 4. Sauvegarder en IDB en bulk
   * 5. Retourner tout (cache + fetched)
   *
   * @param uuids - Liste des UUIDs de recettes à charger
   * @returns Map des recettes trouvées (UUID → RecipeForDisplay)
   */
  async getRecipesByUuidsBulk(
    uuids: string[],
  ): Promise<Map<string, RecipeForDisplay>> {
    const startTime = performance.now();

    // Filtrer les doublons et les UUIDs vides
    const uniqueUuids = [...new Set(uuids.filter(Boolean))];

    if (uniqueUuids.length === 0) {
      return new Map();
    }

    console.log(
      `[RecipesStore] Chargement bulk de ${uniqueUuids.length} recettes...`,
    );

    // 1. Charger depuis IDB en bulk
    const cached = new Map<string, RecipeForDisplay>();
    if (this.#cache) {
      const cachedMap = await this.#cache.loadRecipeDetailsBulk(uniqueUuids);
      cachedMap.forEach((recipe, uuid) => cached.set(uuid, recipe));
    }

    // 2. Identifier les manquants
    const missing = uniqueUuids.filter((uuid) => !cached.has(uuid));

    console.log(
      `[RecipesStore] Bulk: ${cached.size} dans le cache, ${missing.length} à fetch`,
    );

    // 3. Fetch manquants en parallèle
    const fetched = new Map<string, RecipeForDisplay>();
    if (missing.length > 0) {
      // Marquer tous les UUIDs comme "en cours de chargement" pour éviter les doublons
      missing.forEach((uuid) => this.#loadingDetails.add(uuid));

      try {
        const fetchPromises = missing.map(async (uuid) => {
          let recipeData: RecipeForDisplay | null = null;

          // 3a. Tenter Hugo (plus rapide)
          try {
            const recipePath = `/recettes/${uuid}/recipe.json`;
            const response = await fetch(recipePath);
            if (response.ok) {
              const rawData = await response.json();
              recipeData = parseRecipeData(rawData);
            }
          } catch (err) {
            // Silencieux, on tentera Appwrite
          }

          // 3b. Fallback Appwrite
          if (!recipeData && globalState.userId) {
            try {
              const appwriteRecipe = await getAppwriteRecipe(uuid);
              if (appwriteRecipe) {
                const ingredients = ingredientsFromAppwrite(
                  appwriteRecipe.ingredients || [],
                );

                recipeData = {
                  ...appwriteRecipe,
                  ingredients,
                  astuces: astucesFromAppwrite(appwriteRecipe.astuces),
                  prepAlt: appwriteRecipe.prepAlt || null,
                  categories: appwriteRecipe.categories,
                  regime: appwriteRecipe.regime,
                  saison: appwriteRecipe.saison,
                  teams: appwriteRecipe.teams,
                  permissionWrite: appwriteRecipe.permissionWrite,
                };
              }
            } catch (err) {
              // Silencieux
            }
          }

          // Retourner null si non trouvé
          return recipeData ? { uuid, recipe: recipeData } : null;
        });

        const results = await Promise.all(fetchPromises);

        // Filtrer les nulls et créer la Map
        results.forEach((result) => {
          if (result) {
            fetched.set(result.uuid, result.recipe);
          }
        });

        // 4. Sauvegarder en IDB en bulk
        if (fetched.size > 0 && this.#cache) {
          await this.#cache.saveRecipeDetailsBulk(fetched);
        }

        // Nettoyer les marqueurs de chargement
        missing.forEach((uuid) => this.#loadingDetails.delete(uuid));
      } catch (err) {
        console.error(`[RecipesStore] Erreur lors du fetch bulk:`, err);
        // Nettoyer les marqueurs en cas d'erreur
        missing.forEach((uuid) => this.#loadingDetails.delete(uuid));
      }
    }

    // 5. Fusionner cache + fetched
    const allRecipes = new Map([...cached, ...fetched]);

    const elapsed = performance.now() - startTime;
    console.log(
      `[RecipesStore] Bulk terminé: ${allRecipes.size}/${uniqueUuids.length} recettes en ${elapsed.toFixed(0)}ms`,
    );

    return allRecipes;
  }

  /**
   * Précharge les détails de plusieurs recettes en parallèle
   *
   * @param uuids - Liste des UUIDs à précharger
   * @returns Promesse résolue quand tous les chargements sont terminés
   */
  async preloadRecipes(uuids: string[]): Promise<void> {
    console.log(`[RecipesStore] Préchargement de ${uuids.length} recettes...`);
    const promises = uuids.map((uuid) => this.getRecipeByUuid(uuid));
    await Promise.all(promises);
    console.log(`[RecipesStore] Préchargement terminé`);
  }

  /**
   * Récupère le groupe de variantes d'une recette
   * @param recipeId - UUID de la recette
   * @param maxDepth - Profondeur max de recherche (défaut: 2)
   * @returns Racine + tableau de toutes les variantes connectées
   */
  async getVariantGroup(
    recipeId: string,
    maxDepth: number = 2,
  ): Promise<{
    root: RecipeIndexEntry | null;
    variants: RecipeIndexEntry[];
    isRoot: boolean;
  }> {
    const initial = this.getRecipeIndexByUuid(recipeId);
    if (!initial) {
      return { root: null, variants: [], isRoot: false };
    }

    const allVariants = new Map<string, RecipeIndexEntry>();
    const visitedRoots = new Set<string>();

    // Trouver la racine en remontant
    let current = initial;
    while (current.rootRecipeId && !visitedRoots.has(current.rootRecipeId)) {
      visitedRoots.add(current.$id);
      const parent = this.getRecipeIndexByUuid(current.rootRecipeId);
      if (!parent) break;
      current = parent;
    }

    const root = current;
    allVariants.set(root.$id, root);

    // Récupérer toutes les variantes (avec profondeur limitée)
    await this.#collectVariants(
      root.$id,
      allVariants,
      new Set([root.$id]),
      0,
      maxDepth,
    );

    return {
      root,
      variants: Array.from(allVariants.values()),
      isRoot: !initial.rootRecipeId || initial.rootRecipeId === initial.$id,
    };
  }

  /**
   * Collecte récursive des variantes depuis IndexedDB
   * @param rootId - Racine actuelle à explorer
   * @param collected - Map des variantes collectées
   * @param visitedRoots - Racines déjà visitées (évite les boucles)
   * @param depth - Profondeur actuelle
   * @param maxDepth - Profondeur max
   */
  async #collectVariants(
    rootId: string,
    collected: Map<string, RecipeIndexEntry>,
    visitedRoots: Set<string>,
    depth: number,
    maxDepth: number,
  ): Promise<void> {
    if (depth > maxDepth) return;

    // Parcourir tout l'index IndexedDB pour trouver les variantes
    for (const [uuid, recipe] of this.#recipesIndex) {
      // Ignorer si déjà collecté
      if (collected.has(uuid)) continue;

      // Vérifier si cette recette a ce root
      if (recipe.rootRecipeId === rootId) {
        collected.set(uuid, recipe);

        // Si cette recette a un AUTRE root qu'on n'a pas visité, on le suit
        if (
          recipe.rootRecipeId &&
          recipe.rootRecipeId !== rootId &&
          !visitedRoots.has(recipe.rootRecipeId)
        ) {
          visitedRoots.add(recipe.rootRecipeId);
          await this.#collectVariants(
            recipe.rootRecipeId,
            collected,
            visitedRoots,
            depth + 1,
            maxDepth,
          );
        }
      }
    }
  }

  /**
   * Trouve la racine finale d'une recette en remontant la chaîne
   * @param recipeId - UUID de la recette
   * @returns UUID de la racine finale
   */
  findRootRecipe(recipeId: string): string {
    const visited = new Set<string>();
    let currentId = recipeId;
    let maxDepth = 10;

    for (let i = 0; i < maxDepth; i++) {
      const recipe = this.getRecipeIndexByUuid(currentId);
      if (!recipe || !recipe.rootRecipeId) {
        return currentId; // Racine trouvée
      }

      if (visited.has(currentId)) {
        console.error(
          "[RecipesStore] Cycle détecté dans rootRecipeId, retour à",
          recipeId,
        );
        return recipeId;
      }

      visited.add(currentId);
      currentId = recipe.rootRecipeId;
    }

    return recipeId; // Fallback
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    if (this.#cache) {
      this.#cache.close();
      this.#cache = null;
    }
    this.#recipesIndex.clear();
    this.#isInitialized = false;
    this.#realtimeInitialized = false; // Reset pour permettre une réinitialisation
    console.log("[RecipesStore] Ressources nettoyées");
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const recipesStore = new RecipesStore();

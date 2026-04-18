/**
 * RecipesStore - Store de gestion des recettes avec Svelte 5 + aw-sync
 *
 * Architecture:
 * 1. Hugo data.json → index des recettes publiées (HTTP fetch)
 * 2. Appwrite recettes → drafts + mises à jour (aw-sync: Dexie + realtime)
 * 3. Fusion Hugo + Appwrite dans un index unifié (SvelteMap)
 * 4. Lazy loading des détails depuis Hugo JSON / Appwrite (fallback)
 * 5. Cache des détails dans Dexie (db.recipeData)
 *
 * aw-sync gère: delta sync Appwrite → db.recipes, realtime, CRUD optimiste
 * Le store gère: fusion Hugo + Appwrite, lazy loading, recherche, verrous
 */

import { SvelteMap } from 'svelte/reactivity';
import type { Recettes } from '$lib/types/appwrite.d';
import type {
	RecipeIndexEntry,
	RecipeForDisplay
} from '../types/recipes.types';
import {
	parseRecipeIndexEntry,
	parseAppwriteRecipeToIndexEntry,
	astucesFromAppwrite,
	parseRecipeData
} from '../utils/recipeUtils';
import { ingredientsFromAppwrite } from '../utils/ingredientUtils';
import {
	forceReloadAllAppwriteRecipes,
	getRecipeAppwrite as getAppwriteRecipe,
	updateRecipeAppwrite
} from '../services/appwrite-recipes';
import { globalState } from './GlobalState.svelte';
import {
	createSyncCollection,
	bridgeToMap,
	db,
	type BridgeResult
} from '$lib/db-sync/aw-sync';

const DATA_JSON_URL = '/data/data.json';

class RecipesStore {
	// aw-sync collection for Appwrite recipes
	#collection = createSyncCollection<Recettes>({
		table: db.recipes,
		collectionName: 'recipes'
	});

	// Bridge: liveQuery on db.recipes → SvelteMap of raw Appwrite data
	#bridge: BridgeResult<Recettes> = bridgeToMap<Recettes>(
		() => db.recipes.toArray()
	);
	#appwriteRecipes = this.#bridge.map;

	// Unified index: Hugo published + Appwrite (drafts + updates)
	#recipesIndex = $state(new SvelteMap<string, RecipeIndexEntry>());

	// Hugo build timestamp (for cache invalidation)
	#versionTimestamp = $state<number | null>(null);

	// UI state
	#loading = $state(false);
	#error = $state<string | null>(null);
	#isInitialized = $state(false);
	#realtimeInitialized = false;

	// Dedup loading
	#loadingDetails = new Set<string>();
	#initPromise: Promise<void> | null = null;

	// syncReady: resolved when syncFromRemote() finishes
	#syncPromise: Promise<void> = Promise.resolve();
	#syncResolve: (() => void) | null = null;

	// Hugo metadata key in syncMeta
	#HUGO_META_KEY = 'recipes-hugo';

	// =============================================================================
	// GETTERS
	// =============================================================================

	get loading() {
		return this.#loading;
	}
	get error() {
		return this.#error;
	}
	get isInitialized() {
		return this.#isInitialized;
	}
	get syncReady(): Promise<void> {
		return this.#syncPromise;
	}
	get recipesIndex(): RecipeIndexEntry[] {
		return Array.from(this.#recipesIndex.values());
	}
	get count() {
		return this.#recipesIndex.size;
	}

	getAllRecipes(): RecipeIndexEntry[] {
		return Array.from(this.#recipesIndex.values());
	}

	// =============================================================================
	// 3-PHASE INIT
	// =============================================================================

	async loadCache(): Promise<void> {
		if (this.#isInitialized) {
			console.log('[RecipesStore] Cache déjà chargé');
			return;
		}

		console.log('[RecipesStore] Chargement du cache...');
		this.#loading = true;
		this.#error = null;

		try {
			// 1. Load Hugo-cached index from db.recipeData
			const hugoMeta = await db.syncMeta.get(this.#HUGO_META_KEY);
			if (hugoMeta?.lastSync) {
				this.#versionTimestamp = Number(hugoMeta.lastSync);
			}

			const cachedRows = await db.recipeData
				.where('key')
				.startsWith('idx:')
				.toArray();

			if (cachedRows.length > 0) {
				for (const row of cachedRows) {
					const entry = row.data as RecipeIndexEntry;
					if (entry?.$id) {
						this.#recipesIndex.set(entry.$id, entry);
					}
				}
				console.log(
					`[RecipesStore] ${cachedRows.length} recettes Hugo chargées depuis le cache Dexie`
				);
			}

			// 2. Load Appwrite recipes from Dexie (populated by aw-sync initialFetch)
			if (this.#appwriteRecipes.size > 0) {
				this.#mergeAppwriteIntoIndex();
			}

			this.#isInitialized = true;
			console.log(
				`[RecipesStore] Cache chargé: ${this.#recipesIndex.size} recettes`
			);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Erreur lors du chargement du cache';
			this.#error = message;
			console.error('[RecipesStore]', message, err);
			throw err;
		} finally {
			this.#loading = false;
		}
	}

	async syncFromRemote(): Promise<void> {
		this.#syncPromise = new Promise<void>((resolve) => {
			this.#syncResolve = resolve;
		});

		console.log(
			'[RecipesStore] Synchronisation depuis sources distantes...'
		);
		this.#loading = true;

		try {
			// 1. Hugo data.json
			try {
				await this.#loadIndexFromDataJson();
			} catch (err) {
				console.error('[RecipesStore] Erreur chargement data.json:', err);
				if (this.#recipesIndex.size === 0) {
					throw new Error(
						'Aucun cache disponible et data.json inaccessible'
					);
				}
				console.log(
					'[RecipesStore] Continuation avec les données du cache'
				);
			}

			// 2. Appwrite delta sync via aw-sync
			if (globalState.userId) {
				try {
					await this.#collection.initialFetch();
					this.#mergeAppwriteIntoIndex();
				} catch (err) {
					console.warn('[RecipesStore] Erreur sync Appwrite:', err);
				}
			}

			console.log(
				`[RecipesStore] Synchronisation terminée: ${this.#recipesIndex.size} recettes`
			);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Erreur lors de la synchronisation';
			this.#error = message;
			console.error('[RecipesStore]', message, err);
			throw err;
		} finally {
			this.#loading = false;
			this.#syncResolve?.();
			this.#syncResolve = null;
		}
	}

	async syncFromRemotePublicOnly(): Promise<void> {
		this.#syncPromise = new Promise<void>((resolve) => {
			this.#syncResolve = resolve;
		});

		console.log(
			'[RecipesStore] Synchronisation publique (Hugo uniquement)...'
		);
		this.#loading = true;

		try {
			try {
				await this.#loadIndexFromDataJson();
			} catch (err) {
				console.error('[RecipesStore] Erreur chargement data.json:', err);
				if (this.#recipesIndex.size === 0) {
					throw new Error(
						'Aucun cache disponible et data.json inaccessible'
					);
				}
			}

			console.log(
				`[RecipesStore] Synchronisation publique terminée: ${this.#recipesIndex.size} recettes`
			);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Erreur lors de la synchronisation publique';
			this.#error = message;
			console.error('[RecipesStore]', message, err);
			throw err;
		} finally {
			this.#loading = false;
			this.#syncResolve?.();
			this.#syncResolve = null;
		}
	}

	async setupRealtime(): Promise<void> {
		if (this.#realtimeInitialized) {
			console.log('[RecipesStore] Realtime déjà configuré');
			return;
		}

		console.log('[RecipesStore] Configuration du realtime...');

		if (!globalState.isAuthenticated) {
			console.log('[RecipesStore] Mode visiteur : pas de realtime');
			return;
		}

		try {
			this.#collection.subscribe();
			this.#realtimeInitialized = true;

			this.#setupAppwriteBridgeSync();
		} catch (err) {
			console.warn('[RecipesStore] Erreur activation realtime:', err);
		}
	}

	async initialize(): Promise<void> {
		if (this.#isInitialized) {
			console.log('[RecipesStore] Déjà initialisé');
			return;
		}

		if (this.#initPromise) {
			console.log(
				'[RecipesStore] Initialisation déjà en cours, attente...'
			);
			return this.#initPromise;
		}

		console.log('[RecipesStore] Initialisation...');
		this.#loading = true;
		this.#error = null;

		this.#initPromise = (async () => {
			try {
				await this.loadCache();
				await this.syncFromRemote();
				await this.setupRealtime();

				if (this.#recipesIndex.size === 0) {
					const message =
						'Aucune recette disponible après initialisation';
					this.#error = message;
					console.warn('[RecipesStore]', message);
				}

				console.log(
					`[RecipesStore] Initialisation complétée: ${this.#recipesIndex.size} recettes`
				);
			} catch (err) {
				const message =
					err instanceof Error
						? err.message
						: 'Erreur lors de l\'initialisation';
				this.#error = message;
				console.error(
					'[RecipesStore] ECHEC Initialisation:',
					message,
					err
				);
				throw err;
			} finally {
				this.#loading = false;
				this.#initPromise = null;
			}
		})();

		return this.#initPromise;
	}

	// =============================================================================
	// HUGO data.json
	// =============================================================================

	async #loadIndexFromDataJson(): Promise<void> {
		console.log('[RecipesStore] Chargement data.json...');

		const response = await fetch(DATA_JSON_URL);
		if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
		const data = await response.json();

		if (!Array.isArray(data.recipes)) {
			throw new Error('Format invalide: recipes n\'est pas un tableau');
		}

		const remoteTimestamp: number | undefined = data.meta?.timestamp;
		this.#versionTimestamp = remoteTimestamp ?? null;

		// Check if Hugo data is newer than cached
		const hugoMeta = await db.syncMeta.get(this.#HUGO_META_KEY);
		const cachedTimestamp = hugoMeta?.lastSync
			? Number(hugoMeta.lastSync)
			: null;

		if (
			remoteTimestamp &&
			cachedTimestamp &&
			cachedTimestamp >= remoteTimestamp
		) {
			console.log(
				`[RecipesStore] Cache Hugo à jour (Ts: ${cachedTimestamp} >= ${remoteTimestamp})`
			);
			return;
		}

		console.log(
			`[RecipesStore] Nouvelle version Hugo détectée (Ts: ${remoteTimestamp})`
		);

		// Smart merge Hugo recipes into index
		const recipes = data.recipes.map((r: any) => parseRecipeIndexEntry(r));
		let updatedCount = 0;
		const updatedIds: string[] = [];

		recipes.forEach((newRecipe: RecipeIndexEntry) => {
			const existing = this.#recipesIndex.get(newRecipe.$id);

			let shouldUpdate = false;
			if (!existing) {
				shouldUpdate = true;
			} else {
				const newDate = new Date(newRecipe.$updatedAt).getTime();
				const existingDate = new Date(existing.$updatedAt).getTime();
				if (newDate > existingDate) {
					shouldUpdate = true;
				}
			}

			if (shouldUpdate) {
				this.#recipesIndex.set(newRecipe.$id, newRecipe);
				updatedIds.push(newRecipe.$id);
				updatedCount++;
			}
		});

		console.log(
			`[RecipesStore] Smart Merge Hugo: ${updatedCount} recettes mises à jour/ajoutées`
		);

		// Invalidate stale details for updated Hugo recipes
		if (updatedIds.length > 0) {
			await db.recipeData.bulkDelete(
				updatedIds.map((id) => `detail:${id}`)
			);
		}

		// Persist Hugo index to Dexie
		await db.transaction('rw', db.recipeData, db.syncMeta, async () => {
			// Clear old Hugo index entries
			const oldKeys = (await db.recipeData
				.where('key')
				.startsWith('idx:')
				.keys()) as string[];
			if (oldKeys.length > 0) {
				await db.recipeData.bulkDelete(oldKeys);
			}

			// Write new index entries
			const rows = Array.from(this.#recipesIndex.values())
				.filter((entry) => {
					// Only persist Hugo-sourced entries (no status or status=public)
					return !entry.status || entry.status === 'public';
				})
				.map((entry) => ({
					key: `idx:${entry.$id}`,
					data: entry as unknown
				}));
			if (rows.length > 0) {
				await db.recipeData.bulkPut(rows);
			}

			// Update Hugo metadata
			await db.syncMeta.put({
				collectionId: this.#HUGO_META_KEY,
				lastSync: String(remoteTimestamp ?? Date.now() / 1000)
			});
		});
	}

	// =============================================================================
	// APPWRITE MERGE
	// =============================================================================

	/**
	 * Merge Appwrite recipes (from bridge SvelteMap) into the unified index.
	 * Called after initialFetch and on realtime updates.
	 */
	#mergeAppwriteIntoIndex(): void {
		let updatedCount = 0;
		let deletedCount = 0;

		for (const recipe of this.#appwriteRecipes.values()) {
			if (recipe.status === 'deleted') {
				if (this.#recipesIndex.has(recipe.$id)) {
					this.#recipesIndex.delete(recipe.$id);
					deletedCount++;
				}
			} else {
				const indexEntry = parseAppwriteRecipeToIndexEntry(recipe);
				this.#recipesIndex.set(indexEntry.$id, indexEntry);
				updatedCount++;
			}
		}

		if (updatedCount > 0 || deletedCount > 0) {
			console.log(
				`[RecipesStore] Appwrite merge: ${updatedCount} mises à jour, ${deletedCount} supprimées`
			);
		}
	}

	/**
	 * Set up an effect that watches the Appwrite bridge map and merges changes.
	 * This ensures realtime updates from aw-sync → Dexie → bridge → index.
	 */
	#setupAppwriteBridgeSync(): void {
		$effect(() => {
			// Access .size to track map mutations
			const _size = this.#appwriteRecipes.size;
			// Re-merge whenever Appwrite data changes
			this.#mergeAppwriteIntoIndex();
		});
	}

	// =============================================================================
	// FORCE RELOAD / HARD RESET
	// =============================================================================

	async forceReloadAllRecipes(): Promise<void> {
		if (!globalState.userId) {
			throw new Error('Utilisateur non connecté');
		}

		this.#loading = true;
		this.#error = null;

		try {
			console.log(
				'[RecipesStore] Rechargement forcé des recettes Appwrite...'
			);

			const appwriteRecipes = await forceReloadAllAppwriteRecipes();

			// Bulk put into Dexie
			await db.recipes.bulkPut(appwriteRecipes);

			// Merge into index
			let addedCount = 0;
			let deletedCount = 0;

			appwriteRecipes.forEach((recipe) => {
				if (recipe.status === 'deleted') {
					if (this.#recipesIndex.has(recipe.$id)) {
						this.#recipesIndex.delete(recipe.$id);
						deletedCount++;
					}
				} else {
					this.#recipesIndex.set(
						recipe.$id,
						parseAppwriteRecipeToIndexEntry(recipe)
					);
					addedCount++;
				}
			});

			console.log(
				`[RecipesStore] ${addedCount} recettes Appwrite chargées, ${deletedCount} supprimées`
			);
			console.log('[RecipesStore] Rechargement forcé terminé');
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Erreur lors du rechargement';
			this.#error = message;
			console.error('[RecipesStore] Erreur rechargement forcé:', err);
			throw err;
		} finally {
			this.#loading = false;
		}
	}

	async hardReset(): Promise<void> {
		if (!globalState.userId) {
			throw new Error('Utilisateur non connecté');
		}

		console.log('[RecipesStore] HARD RESET - Vidage complet...');
		this.#loading = true;
		this.#error = null;

		try {
			this.#recipesIndex.clear();

			// Clear Dexie tables
			await db.transaction(
				'rw',
				[db.recipes, db.recipeData, db.syncMeta],
				async () => {
					await db.recipes.clear();
					await db.recipeData.clear();
					await db.syncMeta.delete(this.#HUGO_META_KEY);
					await db.syncMeta.delete('recettes');
				}
			);

			// Reload Hugo
			await this.#loadIndexFromDataJson();

			// Reload all Appwrite
			const appwriteRecipes = await forceReloadAllAppwriteRecipes();
			await db.recipes.bulkPut(
				appwriteRecipes.filter((r) => r.status !== 'deleted')
			);

			let addedCount = 0;
			let deletedCount = 0;
			appwriteRecipes.forEach((recipe) => {
				if (recipe.status !== 'deleted') {
					this.#recipesIndex.set(
						recipe.$id,
						parseAppwriteRecipeToIndexEntry(recipe)
					);
					addedCount++;
				} else {
					deletedCount++;
				}
			});

			console.log(
				`[RecipesStore] ${addedCount} recettes Appwrite chargées, ${deletedCount} supprimées ignorées`
			);
			console.log('[RecipesStore] HARD RESET terminé');
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: 'Erreur lors du hard reset';
			this.#error = message;
			console.error('[RecipesStore] Erreur hard reset:', err);
			throw err;
		} finally {
			this.#loading = false;
		}
	}

	// =============================================================================
	// PUBLIC API - INDEX READS
	// =============================================================================

	getRecipeIndexByUuid($id: string): RecipeIndexEntry | null {
		return this.#recipesIndex.get($id) || null;
	}

	#normalizeString(str: string): string {
		return str
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	searchRecipes(query: string): RecipeIndexEntry[] {
		if (!query.trim()) {
			return this.recipesIndex;
		}

		const searchTerms = this.#normalizeString(query.trim()).split(/\s+/);

		return this.recipesIndex.filter((recipe) => {
			const recipeTitle = this.#normalizeString(recipe.title);
			const titleWords = recipeTitle.split(/[\s\-_]+/);

			return searchTerms.every((term) =>
				titleWords.some((word) => word.startsWith(term))
			);
		});
	}

	get availableTypes(): string[] {
		const types = new Set<string>();
		this.recipesIndex.forEach((recipe) => types.add(recipe.typeR));
		return Array.from(types).sort();
	}

	async canEditRecipe(uuid: string): Promise<boolean> {
		if (!globalState.userId) return false;

		try {
			// Check from Appwrite bridge first (fast, local)
			const localRecipe = this.#appwriteRecipes.get(uuid);
			if (localRecipe) {
				return (
					localRecipe.createdBy === globalState.userId ||
					Boolean(
						localRecipe.permissionWrite?.includes(
							globalState.userId
						)
					) ||
					Boolean(
						localRecipe.teams?.some((teamId) =>
							globalState.userTeams.includes(teamId)
						)
					)
				);
			}

			// Fallback: fetch from Appwrite
			const recipe = await getAppwriteRecipe(uuid);
			if (!recipe) return false;

			return (
				recipe.createdBy === globalState.userId ||
				Boolean(
					recipe.permissionWrite?.includes(globalState.userId)
				) ||
				Boolean(
					recipe.teams?.some((teamId) =>
						globalState.userTeams.includes(teamId)
					)
				)
			);
		} catch (err) {
			console.error(
				`[RecipesStore] Erreur vérification permissions ${uuid}:`,
				err
			);
			return false;
		}
	}

	getRecipeLockStatus(uuid: string): string | null {
		const entry = this.#recipesIndex.get(uuid);
		return entry?.lockedBy || null;
	}

	// =============================================================================
	// PUBLIC API - LOCKING
	// =============================================================================

	async updateRecipeLock(
		uuid: string,
		lockedBy: string | null
	): Promise<void> {
		if (!globalState.userId) return;

		try {
			await updateRecipeAppwrite(
				uuid,
				{ lockedBy },
				globalState.userId
			);

			console.log(
				`[RecipesStore] Verrou ${uuid} mis à jour: ${lockedBy || 'libéré'}`
			);

			const currentIndex = this.#recipesIndex.get(uuid);
			if (currentIndex) {
				this.#recipesIndex.set(uuid, { ...currentIndex, lockedBy });
			}
		} catch (error) {
			console.error(
				`[RecipesStore] Erreur verrouillage ${uuid}:`,
				error
			);
			throw error;
		}
	}

	// =============================================================================
	// PUBLIC API - LAZY LOADING DETAILS
	// =============================================================================

	async getRecipeByUuid(uuid: string): Promise<RecipeForDisplay | null> {
		if (this.#loadingDetails.has(uuid)) {
			console.log(
				`[RecipesStore] Chargement de ${uuid} déjà en cours, attente...`
			);
			while (this.#loadingDetails.has(uuid)) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			return this.#loadDetailFromDexie(uuid);
		}

		this.#loadingDetails.add(uuid);

		try {
			// 1. Check Dexie cache
			const cached = await this.#loadDetailFromDexie(uuid);
			if (cached) return cached;

			// 2. Fetch from source
			let recipeData: RecipeForDisplay | null = null;

			// 2a. Try Hugo (published recipes)
			try {
				const recipePath = `/recipe/${uuid}/recipe.json`;
				const response = await fetch(recipePath);
				if (response.ok) {
					const rawData = await response.json();
					recipeData = parseRecipeData(rawData);
					console.log(`[RecipesStore] ${uuid} chargée depuis Hugo`);
				}
			} catch (err) {
				console.log(`[RecipesStore] ${uuid} non trouvée dans Hugo`);
			}

			// 2b. Fallback Appwrite
			if (!recipeData && globalState.userId) {
				recipeData = await this.#loadDetailFromAppwrite(uuid);
			}

			// 3. Cache in Dexie
			if (recipeData) {
				await this.#saveDetailToDexie(uuid, recipeData);
			} else {
				console.warn(
					`[RecipesStore] ${uuid} non trouvée (Hugo ni Appwrite)`
				);
			}

			return recipeData;
		} catch (err) {
			console.error(
				`[RecipesStore] Erreur lors du chargement de ${uuid}:`,
				err
			);
			return null;
		} finally {
			this.#loadingDetails.delete(uuid);
		}
	}

	async getRecipesByUuidsBulk(
		uuids: string[]
	): Promise<Map<string, RecipeForDisplay>> {
		const startTime = performance.now();
		const uniqueUuids = [...new Set(uuids.filter(Boolean))];
		if (uniqueUuids.length === 0) return new Map();

		console.log(
			`[RecipesStore] Chargement bulk de ${uniqueUuids.length} recettes...`
		);

		// 1. Load cached from Dexie
		const cached = new Map<string, RecipeForDisplay>();
		const keys = uniqueUuids.map((id) => `detail:${id}`);
		const rows = await db.recipeData.bulkGet(keys);
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (row?.data) {
				cached.set(uniqueUuids[i], row.data as RecipeForDisplay);
			}
		}

		// 2. Identify missing
		const missing = uniqueUuids.filter((uuid) => !cached.has(uuid));
		console.log(
			`[RecipesStore] Bulk: ${cached.size} dans le cache, ${missing.length} à fetch`
		);

		// 3. Fetch missing in parallel
		const fetched = new Map<string, RecipeForDisplay>();
		if (missing.length > 0) {
			missing.forEach((uuid) => this.#loadingDetails.add(uuid));

			try {
				const fetchPromises = missing.map(async (uuid) => {
					let recipeData: RecipeForDisplay | null = null;

					try {
						const response = await fetch(
							`/recipe/${uuid}/recipe.json`
						);
						if (response.ok) {
							recipeData = parseRecipeData(
								await response.json()
							);
						}
					} catch {
						// Silent
					}

					if (!recipeData && globalState.userId) {
						recipeData =
							await this.#loadDetailFromAppwrite(uuid);
					}

					return recipeData ? { uuid, recipe: recipeData } : null;
				});

				const results = await Promise.all(fetchPromises);
				const toSave: { key: string; data: unknown }[] = [];

				for (const result of results) {
					if (result) {
						fetched.set(result.uuid, result.recipe);
						toSave.push({
							key: `detail:${result.uuid}`,
							data: result.recipe as unknown
						});
					}
				}

				if (toSave.length > 0) {
					await db.recipeData.bulkPut(toSave);
				}

				missing.forEach((uuid) => this.#loadingDetails.delete(uuid));
			} catch (err) {
				console.error('[RecipesStore] Erreur fetch bulk:', err);
				missing.forEach((uuid) => this.#loadingDetails.delete(uuid));
			}
		}

		const allRecipes = new Map([...cached, ...fetched]);
		const elapsed = performance.now() - startTime;
		console.log(
			`[RecipesStore] Bulk terminé: ${allRecipes.size}/${uniqueUuids.length} recettes en ${elapsed.toFixed(0)}ms`
		);

		return allRecipes;
	}

	async preloadRecipes(uuids: string[]): Promise<void> {
		console.log(
			`[RecipesStore] Préchargement de ${uuids.length} recettes...`
		);
		await Promise.all(uuids.map((uuid) => this.getRecipeByUuid(uuid)));
		console.log('[RecipesStore] Préchargement terminé');
	}

	// =============================================================================
	// VARIANT GROUPS
	// =============================================================================

	async getVariantGroup(
		recipeId: string,
		maxDepth: number = 2
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

		let current = initial;
		while (
			current.rootRecipeId &&
			!visitedRoots.has(current.rootRecipeId)
		) {
			visitedRoots.add(current.$id);
			const parent = this.getRecipeIndexByUuid(current.rootRecipeId);
			if (!parent) break;
			current = parent;
		}

		const root = current;
		allVariants.set(root.$id, root);

		this.#collectVariants(
			root.$id,
			allVariants,
			new Set([root.$id]),
			0,
			maxDepth
		);

		return {
			root,
			variants: Array.from(allVariants.values()),
			isRoot:
				!initial.rootRecipeId || initial.rootRecipeId === initial.$id
		};
	}

	#collectVariants(
		rootId: string,
		collected: Map<string, RecipeIndexEntry>,
		visitedRoots: Set<string>,
		depth: number,
		maxDepth: number
	): void {
		if (depth > maxDepth) return;

		for (const [uuid, recipe] of this.#recipesIndex) {
			if (collected.has(uuid)) continue;

			if (recipe.rootRecipeId === rootId) {
				collected.set(uuid, recipe);

				if (
					recipe.rootRecipeId &&
					recipe.rootRecipeId !== rootId &&
					!visitedRoots.has(recipe.rootRecipeId)
				) {
					visitedRoots.add(recipe.rootRecipeId);
					this.#collectVariants(
						recipe.rootRecipeId,
						collected,
						visitedRoots,
						depth + 1,
						maxDepth
					);
				}
			}
		}
	}

	findRootRecipe(recipeId: string): string {
		const visited = new Set<string>();
		let currentId = recipeId;

		for (let i = 0; i < 10; i++) {
			const recipe = this.getRecipeIndexByUuid(currentId);
			if (!recipe || !recipe.rootRecipeId) return currentId;

			if (visited.has(currentId)) {
				console.error(
					'[RecipesStore] Cycle détecté dans rootRecipeId, retour à',
					recipeId
				);
				return recipeId;
			}

			visited.add(currentId);
			currentId = recipe.rootRecipeId;
		}

		return recipeId;
	}

	// =============================================================================
	// DETAIL HELPERS
	// =============================================================================

	async #loadDetailFromDexie(
		uuid: string
	): Promise<RecipeForDisplay | null> {
		const row = await db.recipeData.get(`detail:${uuid}`);
		return (row?.data as RecipeForDisplay | undefined) ?? null;
	}

	async #saveDetailToDexie(
		uuid: string,
		data: RecipeForDisplay
	): Promise<void> {
		await db.recipeData.put({
			key: `detail:${uuid}`,
			data: data as unknown
		});
	}

	async #loadDetailFromAppwrite(
		uuid: string
	): Promise<RecipeForDisplay | null> {
		try {
			// Try local bridge first
			const localRecipe = this.#appwriteRecipes.get(uuid);
			if (localRecipe && localRecipe.status !== 'deleted') {
				return this.#appwriteRecipeToDisplay(localRecipe);
			}

			// Fallback: fetch from Appwrite
			const appwriteRecipe = await getAppwriteRecipe(uuid);
			if (!appwriteRecipe) return null;

			console.log(
				`[RecipesStore] ${uuid} chargée depuis Appwrite (fallback)`
			);
			return this.#appwriteRecipeToDisplay(appwriteRecipe);
		} catch (err) {
			console.log(
				`[RecipesStore] ${uuid} non trouvée dans Appwrite`
			);
			return null;
		}
	}

	#appwriteRecipeToDisplay(recipe: Recettes): RecipeForDisplay {
		const ingredients = ingredientsFromAppwrite(recipe.ingredients || []);

		return {
			...recipe,
			ingredients,
			astuces: astucesFromAppwrite(recipe.astuces),
			prepAlt: recipe.prepAlt || null,
			categories: recipe.categories,
			regime: recipe.regime,
			saison: recipe.saison,
			teams: recipe.teams,
			permissionWrite: recipe.permissionWrite
		};
	}

	// =============================================================================
	// CLEANUP
	// =============================================================================

	destroy(): void {
		this.#bridge.subscription.unsubscribe();
		this.#collection.unsubscribeAll();
		this.#recipesIndex.clear();
		this.#isInitialized = false;
		this.#realtimeInitialized = false;
		console.log('[RecipesStore] Ressources nettoyées');
	}
}

export const recipesStore = new RecipesStore();

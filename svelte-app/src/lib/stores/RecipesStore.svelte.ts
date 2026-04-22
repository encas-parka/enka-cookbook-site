/**
 * RecipesStore - Store de gestion des recettes avec Svelte 5 + aw-sync
 *
 * Architecture:
 * 1. Hugo data.json → index des recettes publiées (HTTP fetch)
 * 2. Appwrite recettes → drafts + mises à jour (aw-sync: Dexie + realtime)
 * 3. Fusion Hugo + Appwrite dans un index unifié (SvelteMap)
 * 4. Lazy loading des détails:
 *    - Appwrite: lecture depuis #appwriteRecipes bridge (toujours à jour)
 *    - Hugo: cache detail:{uuid} dans db.recipeData + fetch /recipe/{uuid}/recipe.json
 * 5. db.recipeData:
 *    - idx:{uuid} = cache d'index Hugo (cold start rapide)
 *    - detail:{uuid} = cache détail Hugo uniquement (les recettes Appwrite ne passent plus ici)
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
	getRecipeAppwrite as getAppwriteRecipe
} from '../services/appwrite-recipes';
import fuzzysort from 'fuzzysort';
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

	// Hugo recipes (published, from data.json + cache)
	#hugoRecipes = new SvelteMap<string, RecipeIndexEntry>();

	// Unified index: $derived merge of Hugo + Appwrite
	// Most recent $updatedAt wins on conflict; deleted status always honored
	#recipesIndex = $derived.by(() => {
		const merged = new Map<string, RecipeIndexEntry>();

		// 1. Hugo recipes (base layer - published recipes)
		for (const [id, entry] of this.#hugoRecipes) {
			merged.set(id, entry);
		}

		// 2. Appwrite recipes (overlay - respects updatedAt, handles drafts & deletions)
		for (const recipe of this.#appwriteRecipes.values()) {
			if (recipe.status === 'deleted') {
				merged.delete(recipe.$id);
			} else {
				const hugoEntry = merged.get(recipe.$id);
				const awEntry = parseAppwriteRecipeToIndexEntry(recipe);
				// Appwrite wins if no Hugo equivalent (draft-only) or if Appwrite is at least as recent
				if (!hugoEntry || awEntry.$updatedAt >= hugoEntry.$updatedAt) {
					merged.set(recipe.$id, awEntry);
				}
			}
		}

		return merged;
	});

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
						this.#hugoRecipes.set(entry.$id, entry);
					}
				}
				console.log(
					`[RecipesStore] ${cachedRows.length} recettes Hugo chargées depuis le cache Dexie`
				);
			}

			// 2. Appwrite recipes are already available via bridge (#appwriteRecipes)
			// The $derived #recipesIndex automatically merges Hugo + Appwrite

			this.#isInitialized = true;
			console.log(
				`[RecipesStore] Cache chargé: ${this.#hugoRecipes.size} recettes Hugo`
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
			// initialFetch writes to db.recipes → bridge → $derived merges automatically
			if (globalState.userId) {
				try {
					await this.#collection.initialFetch();
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
			// Le $derived #recipesIndex réagit automatiquement aux changements du bridge
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

		// Smart merge Hugo recipes into #hugoRecipes
		const recipes = data.recipes.map((r: any) => parseRecipeIndexEntry(r));
		let updatedCount = 0;
		const updatedIds: string[] = [];

		recipes.forEach((newRecipe: RecipeIndexEntry) => {
			const existing = this.#hugoRecipes.get(newRecipe.$id);

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
				this.#hugoRecipes.set(newRecipe.$id, newRecipe);
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

			// Write new index entries (all Hugo entries)
			const rows = Array.from(this.#hugoRecipes.values())
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

			// Bulk put into Dexie → bridge → $derived #recipesIndex se met à jour
			await db.recipes.bulkPut(appwriteRecipes);

			const addedCount = appwriteRecipes.filter((r) => r.status !== 'deleted').length;
			const deletedCount = appwriteRecipes.filter((r) => r.status === 'deleted').length;

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
			this.#hugoRecipes.clear();

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

			// Reload Hugo → #hugoRecipes
			await this.#loadIndexFromDataJson();

			// Reload all Appwrite → db.recipes → bridge → $derived
			const appwriteRecipes = await forceReloadAllAppwriteRecipes();
			await db.recipes.bulkPut(
				appwriteRecipes.filter((r) => r.status !== 'deleted')
			);

			const addedCount = appwriteRecipes.filter((r) => r.status !== 'deleted').length;
			const deletedCount = appwriteRecipes.filter((r) => r.status === 'deleted').length;

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

	searchRecipes(query: string): RecipeIndexEntry[] {
		if (!query.trim()) {
			return this.recipesIndex;
		}

		const results = fuzzysort.go(query.trim(), this.recipesIndex, {
			key: 'title',
			threshold: 0.3,
		});

		return results.map(r => r.obj);
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
			// Optimistic update via aw-sync: Dexie → bridge → $derived → UI
			await this.#collection.update(uuid, { lockedBy } as Partial<Recettes>);

			console.log(
				`[RecipesStore] Verrou ${uuid} mis à jour: ${lockedBy || 'libéré'}`
			);
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
			// Another caller just finished — check fresh sources before re-entering
			const localRecipe = this.#appwriteRecipes.get(uuid);
			if (localRecipe && localRecipe.status !== 'deleted') {
				return this.#appwriteRecipeToDisplay(localRecipe);
			}
			const cached = await this.#loadDetailFromDexie(uuid);
			if (cached) return cached;
			// Data not found in bridge or cache — fall through to full load path
		}

		this.#loadingDetails.add(uuid);

		try {
			// 1. Appwrite bridge (always fresh via liveQuery)
			const localRecipe = this.#appwriteRecipes.get(uuid);
			if (localRecipe && localRecipe.status !== 'deleted') {
				return this.#appwriteRecipeToDisplay(localRecipe);
			}

			// 2. Hugo detail cache (Hugo-only recipes)
			const cached = await this.#loadDetailFromDexie(uuid);
			if (cached) return cached;

			// 3. Fetch from Hugo
			let recipeData: RecipeForDisplay | null = null;
			try {
				const response = await fetch(`/recipe/${uuid}/recipe.json`);
				if (response.ok) {
					recipeData = parseRecipeData(await response.json());
					await this.#saveDetailToDexie(uuid, recipeData);
					console.log(`[RecipesStore] ${uuid} chargée depuis Hugo`);
				}
			} catch {
				// Hugo unreachable
			}

			// 4. Appwrite remote fallback (recipe exists remotely but not in bridge yet)
			if (!recipeData && globalState.userId) {
				recipeData = await this.#loadDetailFromAppwriteRemote(uuid);
			}

			if (!recipeData) {
				console.warn(`[RecipesStore] ${uuid} non trouvée`);
			}

			return recipeData;
		} catch (err) {
			console.error(`[RecipesStore] Erreur chargement ${uuid}:`, err);
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

		const results = new Map<string, RecipeForDisplay>();
		const missing: string[] = [];

		// 1. Appwrite bridge (always fresh)
		for (const uuid of uniqueUuids) {
			const local = this.#appwriteRecipes.get(uuid);
			if (local && local.status !== 'deleted') {
				results.set(uuid, this.#appwriteRecipeToDisplay(local));
			} else {
				missing.push(uuid);
			}
		}

		if (missing.length === 0) {
			return results;
		}

		// 2. Hugo detail cache (Hugo-only recipes)
		const cacheKeys = missing.map((id) => `detail:${id}`);
		const rows = await db.recipeData.bulkGet(cacheKeys);
		const stillMissing: string[] = [];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (row?.data) {
				results.set(missing[i], row.data as RecipeForDisplay);
			} else {
				stillMissing.push(missing[i]);
			}
		}

		if (stillMissing.length === 0) {
			const elapsed = performance.now() - startTime;
			console.log(
				`[RecipesStore] Bulk: ${results.size}/${uniqueUuids.length} en ${elapsed.toFixed(0)}ms (cache + bridge)`
			);
			return results;
		}

		// 3. Fetch missing from Hugo, then Appwrite remote
		console.log(
			`[RecipesStore] Bulk: ${results.size} trouvés, ${stillMissing.length} à fetch`
		);

		stillMissing.forEach((uuid) => this.#loadingDetails.add(uuid));

		try {
			const fetchPromises = stillMissing.map(
				async (uuid): Promise<{ uuid: string; recipe: RecipeForDisplay } | null> => {
					// 3a. Try Hugo
					try {
						const response = await fetch(
							`/recipe/${uuid}/recipe.json`
						);
						if (response.ok) {
							return {
								uuid,
								recipe: parseRecipeData(await response.json())
							};
						}
					} catch {
						// Hugo unreachable
					}

					// 3b. Appwrite remote fallback
					if (globalState.userId) {
						const recipe =
							await this.#loadDetailFromAppwriteRemote(uuid);
						if (recipe) return { uuid, recipe };
					}

					return null;
				}
			);

			const fetched = await Promise.all(fetchPromises);
			const hugoSaves: { key: string; data: unknown }[] = [];

			for (const result of fetched) {
				if (result) {
					results.set(result.uuid, result.recipe);

					// Only cache Hugo-sourced recipes in detail cache
					const fromBridge = this.#appwriteRecipes.has(result.uuid);
					if (!fromBridge) {
						hugoSaves.push({
							key: `detail:${result.uuid}`,
							data: result.recipe as unknown
						});
					}
				}
			}

			if (hugoSaves.length > 0) {
				await db.recipeData.bulkPut(hugoSaves);
			}
		} catch (err) {
			console.error('[RecipesStore] Erreur fetch bulk:', err);
		} finally {
			stillMissing.forEach((uuid) => this.#loadingDetails.delete(uuid));
		}

		const elapsed = performance.now() - startTime;
		console.log(
			`[RecipesStore] Bulk terminé: ${results.size}/${uniqueUuids.length} en ${elapsed.toFixed(0)}ms`
		);

		return results;
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

	async #loadDetailFromAppwriteRemote(
		uuid: string
	): Promise<RecipeForDisplay | null> {
		try {
			const appwriteRecipe = await getAppwriteRecipe(uuid);
			if (!appwriteRecipe) return null;

			console.log(
				`[RecipesStore] ${uuid} chargée depuis Appwrite (remote fallback)`
			);
			return this.#appwriteRecipeToDisplay(appwriteRecipe);
		} catch (err) {
			console.log(`[RecipesStore] ${uuid} non trouvée dans Appwrite`);
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

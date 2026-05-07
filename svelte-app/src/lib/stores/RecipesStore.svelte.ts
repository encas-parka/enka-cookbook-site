/**
 * RecipesStore - Store de gestion des recettes avec Svelte 5 + pb-sync
 *
 * Architecture:
 * 1. PocketBase recipes → index unifié via pb-sync (delta sync + realtime)
 * 2. Bridge liveQuery: db.recipes → SvelteMap → $derived → RecipeIndexEntry[]
 * 3. Lazy loading: bridge (toujours à jour) ou collection.view() (remote fallback)
 *
 * pb-sync gère: delta sync PB → db.recipes, realtime, CRUD optimiste
 * Le store gère: index, lazy loading, recherche, verrous, groupes de variantes
 */

import { SvelteMap } from 'svelte/reactivity';
import type { Recettes } from '$lib/types/pb';
import type {
	RecipeIndexEntry,
	RecipeForDisplay
} from '../types/recipes.types';
import {
	parseRecipeToIndexEntry,
	parseAstuces
} from '../utils/recipeUtils';
import { parseIngredients } from '../utils/ingredientUtils';
import fuzzysort from 'fuzzysort';
import { globalState } from './GlobalState.svelte';
import {
	createSyncCollection,
	bridgeToMap,
	db,
	pb,
	type BridgeResult
} from '$lib/db-sync/pb-sync';

class RecipesStore {
	#collection = createSyncCollection<Recettes>(pb, db.recipes, "recipes");

	#bridge: BridgeResult<Recettes> = bridgeToMap<Recettes>(
		() => db.recipes.toArray()
	);
	#rawRecipes = this.#bridge.map;

	// Unified index: convert bridge's Recettes → RecipeIndexEntry (skip deleted)
	#recipesIndex = $derived.by(() => {
		const index = new SvelteMap<string, RecipeIndexEntry>();
		for (const recipe of this.#rawRecipes.values()) {
			if (recipe.status !== 'deleted') {
				index.set(recipe.id, parseRecipeToIndexEntry(recipe));
			}
		}
		return index;
	});

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
			// Recipes are already available via bridge (#rawRecipes)
			// The $derived #recipesIndex automatically converts them to index entries
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

		console.log('[RecipesStore] Synchronisation depuis PocketBase...');
		this.#loading = true;

		try {
			await this.#collection.initialFetch();

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
	// FORCE RELOAD / HARD RESET
	// =============================================================================

	async forceReloadAllRecipes(): Promise<void> {
		this.#loading = true;
		this.#error = null;

		try {
			console.log('[RecipesStore] Rechargement forcé des recettes...');

			await this.#collection.clearLocal();
			await this.#collection.initialFetch();

			const addedCount = this.#recipesIndex.size;

			console.log(
				`[RecipesStore] ${addedCount} recettes rechargées`
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
			await this.#collection.clearLocal();
			await this.#collection.initialFetch();

			const addedCount = this.#recipesIndex.size;

			console.log(
				`[RecipesStore] ${addedCount} recettes rechargées`
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

	getRecipeIndexByUuid(id: string): RecipeIndexEntry | null {
		return this.#recipesIndex.get(id) || null;
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
			const localRecipe = this.#rawRecipes.get(uuid);
			if (localRecipe) {
				return (
					localRecipe.createdBy === globalState.userId ||
					Boolean(
						localRecipe.teams?.some((teamId) =>
							globalState.userTeams.includes(teamId)
						)
					)
				);
			}

			const recipe = await this.#loadDetailFromRemote(uuid);
			if (!recipe) return false;

			return (
				recipe.createdBy === globalState.userId ||
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
			const localRecipe = this.#rawRecipes.get(uuid);
			if (localRecipe && localRecipe.status !== 'deleted') {
				return this.#recipeToDisplay(localRecipe);
			}
			const remote = await this.#loadDetailFromRemote(uuid);
			if (remote) return this.#recipeToDisplay(remote);
			// Data not found in bridge or remote — fall through to full load path
		}

		this.#loadingDetails.add(uuid);

		try {
			// 1. Bridge (always fresh via liveQuery)
			const localRecipe = this.#rawRecipes.get(uuid);
			if (localRecipe && localRecipe.status !== 'deleted') {
				return this.#recipeToDisplay(localRecipe);
			}

			// 2. Remote fallback (recipe exists remotely but not in bridge yet)
			if (globalState.userId) {
				const remote = await this.#loadDetailFromRemote(uuid);
				if (remote) return this.#recipeToDisplay(remote);
			}

			console.warn(`[RecipesStore] ${uuid} non trouvée`);
			return null;
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

		// 1. Bridge (always fresh)
		for (const uuid of uniqueUuids) {
			const local = this.#rawRecipes.get(uuid);
			if (local && local.status !== 'deleted') {
				results.set(uuid, this.#recipeToDisplay(local));
			} else {
				missing.push(uuid);
			}
		}

		if (missing.length === 0) {
			return results;
		}

		// 2. Remote fallback for missing
		console.log(
			`[RecipesStore] Bulk: ${results.size} trouvés, ${missing.length} à fetch`
		);

		missing.forEach((uuid) => this.#loadingDetails.add(uuid));

		try {
			if (globalState.userId) {
				const fetchPromises = missing.map(
					async (uuid): Promise<{ uuid: string; recipe: RecipeForDisplay } | null> => {
						const recipe = await this.#loadDetailFromRemote(uuid);
						if (recipe) return { uuid, recipe: this.#recipeToDisplay(recipe) };
						return null;
					}
				);

				const fetched = await Promise.all(fetchPromises);

				for (const result of fetched) {
					if (result) {
						results.set(result.uuid, result.recipe);
					}
				}
			}
		} catch (err) {
			console.error('[RecipesStore] Erreur fetch bulk:', err);
		} finally {
			missing.forEach((uuid) => this.#loadingDetails.delete(uuid));
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
			visitedRoots.add(current.id);
			const parent = this.getRecipeIndexByUuid(current.rootRecipeId);
			if (!parent) break;
			current = parent;
		}

		const root = current;
		allVariants.set(root.id, root);

		this.#collectVariants(
			root.id,
			allVariants,
			new Set([root.id]),
			0,
			maxDepth
		);

		return {
			root,
			variants: Array.from(allVariants.values()),
			isRoot:
				!initial.rootRecipeId || initial.rootRecipeId === initial.id
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
	// PUBLIC API - CRUD
	// =============================================================================

	async createRecipe(
		data: Partial<Recettes>,
		userId: string
	): Promise<Recettes> {
		const slugUuid = data.id || crypto.randomUUID();
		const recipeData = {
			...data,
			id: slugUuid,
			createdBy: userId,
			status: data.status || "active"
		};

		const recipe = await this.#collection.create(recipeData as unknown as Omit<Recettes, "id" | "created" | "updated">);

		console.log(`[RecipesStore] Recipe created: ${slugUuid}`);
		return recipe;
	}

	async updateRecipe(
		uuid: string,
		data: Partial<Recettes>
	): Promise<Recettes> {
		const recipe = await this.#collection.update(uuid, data as Partial<Recettes>);

		console.log(`[RecipesStore] Recipe updated: ${uuid}`);
		return recipe;
	}

	async softDeleteRecipe(uuid: string): Promise<void> {
		await this.#collection.update(uuid, { status: "deleted" } as Partial<Recettes>);
		console.log(`[RecipesStore] Recipe soft deleted: ${uuid}`);
	}

	// =============================================================================
	// DETAIL HELPERS
	// =============================================================================

	async #loadDetailFromRemote(
		uuid: string
	): Promise<Recettes | null> {
		try {
			const recipe = await this.#collection.view(uuid);
			if (!recipe) return null;

			console.log(
				`[RecipesStore] ${uuid} chargée depuis PocketBase (remote fallback)`
			);
			return recipe;
		} catch (err) {
			console.log(`[RecipesStore] ${uuid} non trouvée dans PocketBase`);
			return null;
		}
	}

	#recipeToDisplay(recipe: Recettes): RecipeForDisplay {
		const ingredients = parseIngredients(recipe.ingredients || []);

		return {
			...recipe,
			ingredients,
			astuces: parseAstuces(recipe.astuces),
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

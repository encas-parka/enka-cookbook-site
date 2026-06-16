/**
 * stress-client.ts — Client Appwrite par virtual user (API key admin)
 *
 * ⚠️ Révision 4 : le script utilise une API key admin dédiée (pas de user-auth).
 * Toutes les opérations passent par fetch direct avec le header `X-Appwrite-Key`.
 * Le SDK npm `appwrite` n'est PAS utilisé (il n'expose pas `setKey()` côté web).
 *
 * 6 StressClient tournent en parallèle, partageant la même API key. Ils simulent
 * 6 virtual users qui exécutent les scénarios en parallèle avec jitter.
 *
 * Note : l'API key admin bypass les permissions au niveau document/collection,
 * donc pas besoin d'attribuer des labels aux userIds simulés.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface StressUserInfo {
  /** Index 1-based (1 = owner du sandbox) */
  index: number;
  email: string;
  /** UserId résolu via /users — null tant que pas résolu */
  userId?: string;
  /** UserName résolu via /users — fallback sur email */
  userName?: string;
}

export interface StressAppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  apiKey: string;
}

export interface SyncLatency {
  collection: string;
  durationMs: number;
  count: number;
  error?: string;
}

export interface BootstoreResult {
  syncLatencies: SyncLatency[];
  durationMs: number;
}

/**
 * Collections scannées au bootstore (syncInitial simulé).
 * Reflète les 6 stores initiaux de App.svelte lignes 38-70.
 */
export const BOOTSTORE_COLLECTIONS = [
  "main", // EventsStore
  "recettes", // RecipesStore
  "materiel", // MaterielStore (collection 1/2)
  "materiel_loan", // MaterielStore (collection 2/2)
  "kteams", // NativeTeamsStore (proxy)
  "teamdocs", // TeamdocsStore
] as const;

// =============================================================================
// STRESS CLIENT
// =============================================================================

export class StressClient {
  readonly user: StressUserInfo;
  readonly awConfig: StressAppwriteConfig;

  #realtimeEvents = 0;
  #lastEventAt: number | null = null;

  constructor(user: StressUserInfo, config: StressAppwriteConfig) {
    this.user = user;
    this.awConfig = config;
  }

  // ===========================================================================
  // HELPERS FETCH PRIVÉS
  // ===========================================================================

  /** Construit les headers standard avec API key. */
  #headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "X-Appwrite-Project": this.awConfig.projectId,
      "X-Appwrite-Key": this.awConfig.apiKey,
      ...extra,
    };
  }

  /** Construit l'URL de base pour une table. */
  #tableUrl(tableId: string, rowId?: string): string {
    const base = `${this.awConfig.endpoint}/tablesdb/${this.awConfig.databaseId}/tables/${tableId}/rows`;
    return rowId ? `${base}/${rowId}` : base;
  }

  /** Wrapper fetch avec gestion d'erreur standard. */
  async #fetch<T = any>(
    url: string,
    init?: RequestInit,
    context?: string,
  ): Promise<T> {
    const t0 = performance.now();
    try {
      const response = await fetch(url, init);
      const durationMs = performance.now() - t0;

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg =
          errBody.message || response.statusText || "erreur inconnue";
        const error = new Error(
          `[stress-client ${this.user.index}] ${context ?? "fetch"} HTTP ${response.status}: ${msg}`,
        ) as any;
        error.status = response.status;
        error.code = errBody.code;
        error.durationMs = durationMs;
        throw error;
      }

      // 204 No Content (delete) → pas de body
      if (response.status === 204) {
        return { _durationMs: durationMs } as any;
      }

      const data = await response.json();
      (data as any)._durationMs = durationMs;
      return data;
    } catch (error: any) {
      // Erreur réseau ou parsing
      if (!error.status) {
        error.durationMs = performance.now() - t0;
        error.message = `[stress-client ${this.user.index}] ${context ?? "fetch"} network error: ${error.message}`;
      }
      throw error;
    }
  }

  // ===========================================================================
  // RÉSOLUTION USER
  // ===========================================================================

  /**
   * Résout le userId et le userName depuis /users via l'email.
   * À appeler une fois au démarrage (après constructeur).
   */
  async resolveUser(): Promise<{ userId: string; userName: string }> {
    const data = await this.#fetch<{ users: any[]; total: number }>(
      `${this.awConfig.endpoint}/users?limit=100`,
      { headers: this.#headers() },
      `resolveUser(${this.user.email})`,
    );

    const found = data.users.find((u) => u.email === this.user.email);
    if (!found) {
      throw new Error(
        `[stress-client ${this.user.index}] user ${this.user.email} introuvable sur ec-dev`,
      );
    }

    this.user.userId = found.$id;
    this.user.userName = found.name || this.user.email;
    return { userId: found.$id, userName: this.user.userName };
  }

  // ===========================================================================
  // OPÉRATIONS DB
  // ===========================================================================

  /**
   * listRows avec filtres au format "à plat" (serveur 1.9.0 ne supporte pas queries[]).
   *
   * @param tableId - ID de la table
   * @param filters - Filtres au format { key: value } ou { limit: N, equal: "attr,value" }
   */
  async listRows(
    tableId: string,
    filters?: Record<string, string | number | boolean>,
  ): Promise<{ rows: any[]; total: number; _durationMs: number }> {
    const url = new URL(this.#tableUrl(tableId));
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        url.searchParams.set(key, String(value));
      }
    }
    return this.#fetch(url.toString(), { headers: this.#headers() }, `listRows(${tableId})`);
  }

  /** getRow par ID. */
  async getRow(
    tableId: string,
    rowId: string,
  ): Promise<any> {
    return this.#fetch(this.#tableUrl(tableId, rowId), {
      headers: this.#headers(),
    }, `getRow(${tableId}/${rowId})`);
  }

  /** createRow avec rowId optionnel (généré si absent). */
  async createRow(
    tableId: string,
    data: Record<string, any>,
    options?: { rowId?: string; permissions?: string[] },
  ): Promise<any> {
    const body: any = { data };
    if (options?.rowId) body.rowId = options.rowId;
    if (options?.permissions) body.$permissions = options.permissions;

    return this.#fetch(
      this.#tableUrl(tableId),
      {
        method: "POST",
        headers: this.#headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      },
      `createRow(${tableId})`,
    );
  }

  /** updateRow (PATCH partiel). */
  async updateRow(
    tableId: string,
    rowId: string,
    data: Record<string, any>,
  ): Promise<any> {
    return this.#fetch(
      this.#tableUrl(tableId, rowId),
      {
        method: "PATCH",
        headers: this.#headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data }),
      },
      `updateRow(${tableId}/${rowId})`,
    );
  }

  /** deleteRow. */
  async deleteRow(tableId: string, rowId: string): Promise<void> {
    await this.#fetch(
      this.#tableUrl(tableId, rowId),
      {
        method: "DELETE",
        headers: this.#headers(),
      },
      `deleteRow(${tableId}/${rowId})`,
    );
  }

  // ===========================================================================
  // BOOTSTORE
  // ===========================================================================

  /**
   * SyncInitial simulé : 6 listRows en parallèle sur les collections statiques.
   * Reproduit App.svelte lignes 38-70 (sans WebSocket — V2).
   */
  async bootstore(): Promise<BootstoreResult> {
    if (!this.user.userId) {
      throw new Error(
        `[stress-client ${this.user.index}] resolveUser() requis avant bootstore()`,
      );
    }

    const t0 = performance.now();
    const syncLatencies = await Promise.all(
      BOOTSTORE_COLLECTIONS.map(async (collection) => {
        const tt0 = performance.now();
        try {
          const res = await this.listRows(collection, { limit: 1 });
          return {
            collection,
            durationMs: performance.now() - tt0,
            count: res.rows.length,
          };
        } catch (error: any) {
          return {
            collection,
            durationMs: performance.now() - tt0,
            count: 0,
            error: error?.message || "unknown",
          };
        }
      }),
    );

    return {
      syncLatencies,
      durationMs: performance.now() - t0,
    };
  }

  // ===========================================================================
  // CLEANUP (no-op avec API key)
  // ===========================================================================

  /**
   * Cleanup : no-op avec API key (pas de session à cleaner).
   * Existe pour forward-compat (V2 user-auth si upgrade serveur un jour).
   */
  async close(): Promise<void> {
    // Intentionnellement vide — pas de session avec API key
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get userId(): string | undefined {
    return this.user.userId;
  }
  get userName(): string | undefined {
    return this.user.userName;
  }
  get realtimeEvents(): number {
    return this.#realtimeEvents;
  }
  get lastEventAt(): number | null {
    return this.#lastEventAt;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Crée et resolve un StressClient (API key).
 * Retourne null en cas d'échec (fail-soft : le caller peut continuer sans ce user).
 */
export async function createAndResolveClient(
  user: StressUserInfo,
  config: StressAppwriteConfig,
): Promise<
  { client: StressClient; userId: string; userName: string } | { error: string }
> {
  const client = new StressClient(user, config);
  try {
    const { userId, userName } = await client.resolveUser();
    return { client, userId, userName };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Service Appwrite centralisé pour Svelte
 *
 * Ce service gère l'initialisation et l'accès aux instances Appwrite.
 */

import {
  Client,
  Account,
  Databases,
  Functions,
  Teams,
  TablesDB,
  type Models,
} from "appwrite";
import type { AppwriteConfig } from "../types/global";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Détection de l'environnement de développement local
 */
const isDevLocal = import.meta.env.DEV && typeof window !== "undefined";

const APPWRITE_CONFIG: AppwriteConfig = {
  endpoint: "https://aw.oupla.net/v1",
  // Utilisation du projet de développement en local, production en build
  projectId: isDevLocal ? "697a1fcf0005e3703e25" : "696b7acb0037bde79e3f",
  databaseId: "689d15b10003a5a13636",
  functions: {
    cmsAuth: "68976500002eb5c6ee4f",
    accessRequest: "689cdea5001a4d74549d",
    batchUpdate: "68f00487000c624533a3",
    usersTeamsManager: "692cb2cd000cbb24549c",
    enkaData: "68f00487000c624533a3", // ID fusionné (enka-products)
  },
  collections: {
    events: "main", // TOCHECK
    ingredients: "ingredients", // Ajouté par déduction
    main: "main",
    purchases: "purchases",
    products: "products",
    kteams: "kteams", // Collection custom pour gérer les équipes
    locks: "locks",
    user_notifications: "user_notifications",
    materiel_loan: "materiel_loan",
    teamdocs: "teamdocs", // Documents d'équipe
  },
};

// =============================================================================
// CACHE DES INSTANCES
// =============================================================================

let cachedInstances: {
  client: Client;
  account: Account;
  databases: Databases;
  tables: TablesDB;
  functions: Functions;
  teams: Teams;
  config: AppwriteConfig;
} | null = null;

// =============================================================================
// API CENTRALE
// =============================================================================

/**
 * Récupère les instances Appwrite (avec cache)
 */
export async function getAppwriteInstances(): Promise<{
  client: Client;
  account: Account;
  databases: Databases;
  tables: TablesDB;
  functions: Functions;
  teams: Teams;
  config;
}> {
  if (cachedInstances) {
    return cachedInstances;
  }

  console.log("[appwrite] Initialisation des instances Appwrite...");

  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  const account = new Account(client);
  const databases = new Databases(client);
  const tables = new TablesDB(client);
  const functions = new Functions(client);
  const teams = new Teams(client);

  cachedInstances = {
    client,
    account,
    databases,
    tables,
    functions,
    teams,
    config: APPWRITE_CONFIG,
  };

  console.log("[appwrite] Instances initialisées avec succès");

  return cachedInstances;
}

/**
 * Réinitialise le cache (logout)
 */
export function clearAppwriteCache(): void {
  console.log("[appwrite] Cache réinitialisé");
  cachedInstances = null;
}

// =============================================================================
// UTILITAIRES
// =============================================================================

export function getAppwriteConfig() {
  return {
    APPWRITE_ENDPOINT: APPWRITE_CONFIG.endpoint,
    APPWRITE_PROJECT_ID: APPWRITE_CONFIG.projectId,
    APPWRITE_DATABASE_ID: APPWRITE_CONFIG.databaseId,
    APPWRITE_FUNCTION_ID: APPWRITE_CONFIG.functions.batchUpdate, // Fallback
    ACCESS_REQUEST_FUNCTION_ID: APPWRITE_CONFIG.functions.accessRequest,
    MANAGE_RECIPE_FUNCTION_ID: APPWRITE_CONFIG.functions.enkaData,
    APPWRITE_CONFIG: APPWRITE_CONFIG,
  };
}

/**
 * Subscribe aux événements realtime
 *
 * IMPORTANT: Cette fonction est async pour garantir l'initialisation du Client Appwrite
 * avant toute souscription. Cela assure que toutes les subscriptions partagent la même
 * connexion WebSocket (multiplexage), évitant ainsi la création de connexions multiples.
 */
export async function subscribe(
  channels: string | string[],
  callback: (response: any) => void,
): Promise<() => void> {
  // Force l'initialisation pour garantir le multiplexage
  if (!cachedInstances) {
    console.log(
      "[appwrite] Subscribe appelé avant initialisation, initialisation forcée...",
    );
    await getAppwriteInstances();
  }

  const channelsArray = Array.isArray(channels) ? channels : [channels];
  console.log("[appwrite] Subscribe aux channels:", channelsArray);

  const unsubscribe = cachedInstances!.client.subscribe(
    channels,
    (response: any) => {
      // Log de connexion réussie
      if (response.event === "client.connected") {
        console.log("[appwrite] ✅ WebSocket connecté avec succès");
      }
      callback(response);
    },
  );

  return unsubscribe;
}

export function isInitialized(): boolean {
  return cachedInstances !== null;
}

/**
 * Récupère l'ID de la base de données
 */
export function getDatabaseId(): string {
  return APPWRITE_CONFIG.databaseId;
}

/**
 * Récupère l'ID d'une collection
 */
export function getCollectionId(
  name: keyof typeof APPWRITE_CONFIG.collections,
): string {
  return APPWRITE_CONFIG.collections[name];
}

/**
 * Récupère l'ID d'une fonction
 */
export function getFunctionId(
  name: keyof typeof APPWRITE_CONFIG.functions,
): string {
  return APPWRITE_CONFIG.functions[name];
}

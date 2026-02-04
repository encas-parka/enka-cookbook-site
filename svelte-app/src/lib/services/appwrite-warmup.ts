/**
 * Service de Warm-up pour les fonctions Appwrite
 *
 * Ce service gère le préchauffage des fonctions cloud pour éviter les cold starts.
 * Il utilise localStorage pour tracker les derniers pings et éviter les appels inutiles.
 */

import { getAppwriteInstances } from "./appwrite";
import { getFunctionId } from "./appwrite";

// =============================================================================
// CONSTANTES
// =============================================================================

/** Délai minimum entre deux warm-ups (10 minutes) */
const WARMUP_INTERVAL = 10 * 60 * 1000; // 10 min en ms

/** Clés localStorage pour stocker les timestamps */
const STORAGE_KEYS = {
  usersTeamsManager: "appwrite_warmup_usersTeamsManager",
  enkaData: "appwrite_warmup_enkaData",
} as const;

// =============================================================================
// TYPES
// =============================================================================

type WarmupFunction = keyof typeof STORAGE_KEYS;

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Vérifie si un warm-up est nécessaire pour une fonction donnée
 */
function shouldWarmUp(functionName: WarmupFunction): boolean {
  const lastPing = localStorage.getItem(STORAGE_KEYS[functionName]);
  if (!lastPing) return true;
  const elapsed = Date.now() - parseInt(lastPing, 10);
  return elapsed > WARMUP_INTERVAL;
}

/**
 * Met à jour le timestamp de warm-up pour une fonction donnée
 */
function updateWarmupTimestamp(functionName: WarmupFunction): void {
  localStorage.setItem(STORAGE_KEYS[functionName], Date.now().toString());
}

/**
 * Envoie un ping à une fonction Appwrite
 * @param functionId - ID de la fonction Appwrite
 * @param payload - Payload à envoyer (action ou operation)
 * @returns Promise<boolean> - true si le ping a réussi
 */
async function pingFunction(
  functionId: string,
  payload: { action?: string; operation?: string },
): Promise<boolean> {
  try {
    const { functions } = await getAppwriteInstances();

    const response = await functions.createExecution({
      functionId,
      body: JSON.stringify(payload),
    });

    if (response.responseStatusCode === 200) {
      console.log(`[warmup] ✅ Ping réussi pour ${functionId}`);
      return true;
    } else {
      console.warn(
        `[warmup] ⚠️ Ping échoué pour ${functionId}: ${response.responseStatusCode}`,
      );
      return false;
    }
  } catch (error) {
    console.error(`[warmup] ❌ Erreur ping ${functionId}:`, error);
    return false;
  }
}

// =============================================================================
// API PUBLIQUE
// =============================================================================

/**
 * Réveille la fonction usersTeamsManager si nécessaire (délai > 10 min)
 */
export async function warmUpUsersTeamsManager(): Promise<void> {
  if (!shouldWarmUp("usersTeamsManager")) {
    console.log("[warmup] ⏭️ usersTeamsManager encore chaud (< 10 min)");
    return;
  }

  console.log("[warmup] 🔥 Réveil de usersTeamsManager...");
  await pingFunction(getFunctionId("usersTeamsManager"), { action: "ping" });
  updateWarmupTimestamp("usersTeamsManager");
}

/**
 * Réveille la fonction enkaData si nécessaire (délai > 10 min)
 */
export async function warmUpEnkaData(): Promise<void> {
  if (!shouldWarmUp("enkaData")) {
    console.log("[warmup] ⏭️ enkaData encore chaud (< 10 min)");
    return;
  }

  console.log("[warmup] 🔥 Réveil d'enkaData...");
  await pingFunction(getFunctionId("enkaData"), { operation: "ping" });
  updateWarmupTimestamp("enkaData");
}

/**
 * Réinitialise les timestamps de warm-up (pour debug/tests)
 */
export function resetWarmupTimestamps(functionName?: WarmupFunction): void {
  if (functionName) {
    localStorage.removeItem(STORAGE_KEYS[functionName]);
  } else {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

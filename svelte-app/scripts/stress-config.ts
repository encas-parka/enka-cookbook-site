/**
 * stress-config.ts — Lecture de la configuration du stress test
 *
 * Sources (par ordre de priorité décroissante) :
 *   1. CLI flags (--rafales, --duration, --setup-only, etc.)
 *   2. .env.local (chargé automatiquement par Bun)
 *   3. Valeurs par défaut
 *
 * Usage :
 *   import { loadConfig, type StressConfig } from "./stress-config";
 *   const config = loadConfig(Bun.argv);
 *   if (config.printConfig) { console.log(formatConfig(config)); }
 */

// =============================================================================
// TYPES
// =============================================================================

export interface StressUser {
  /** Index 1-based (1 = owner du sandbox) */
  index: number;
  email: string;
}

export interface StressConfig {
  /** Users identifiés par email (au moins 1, jusqu'à 6) — user 1 = owner */
  users: StressUser[];

  /** API key admin ec-dev (obligatoire) */
  apiKey: string;

  // --- Sandbox ---
  /** Nombre de products à créer dans le sandbox (défaut 30) */
  productsCount: number;
  /** Nombre de recipes à fetch pour les productHugoUuid (défaut 10) */
  recipesCount: number;

  // --- Test ---
  /** Nombre total de rafales (défaut 100) */
  rafales: number;
  /** Durée max en ms avant arrêt (défaut 180000 = 3 min) */
  durationMs: number;
  /** Délai min entre users dans une rafale (défaut 100) */
  jitterMinMs: number;
  /** Délai max entre users dans une rafale (défaut 500) */
  jitterMaxMs: number;

  // --- Appwrite ---
  endpoint: string;
  projectId: string;
  databaseId: string;

  // --- Modes CLI ---
  /** Setup sandbox + vérification + attente, sans rafales */
  setupOnly: boolean;
  /** Scan et cleanup des sandboxes orphelins puis exit */
  cleanupOrphans: boolean;
  /** Skip le teardown (products + event) après le test */
  noCleanup: boolean;
  /** Affiche la config résolue et exit */
  printConfig: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULTS = {
  productsCount: 30,
  recipesCount: 10,
  rafales: 100,
  durationMs: 180_000,
  jitterMinMs: 100,
  jitterMaxMs: 500,
  endpoint: "https://aw.oupla.net/v1",
  projectId: "697a1fcf0005e3703e25", // ec-dev
  databaseId: "689d15b10003a5a13636",
} as const;

// =============================================================================
// PARSING
// =============================================================================

/**
 * Parse les arguments CLI et retourne les overrides.
 *
 * Flags supportés :
 *   --rafales N            Override STRESS_RAFALES
 *   --duration MS          Override STRESS_DURATION_MS
 *   --products N           Override STRESS_PRODUCTS_COUNT
 *   --recipes N            Override STRESS_RECIPES_COUNT
 *   --jitter MIN MAX       Override STRESS_JITTER_MIN_MS / MAX_MS
 *   --setup-only           Mode validation sandbox (pas de rafales)
 *   --cleanup-orphans      Scan + delete orphelins puis exit
 *   --no-cleanup           Skip teardown products + event
 *   --print-config         Affiche la config résolue et exit
 *   -h, --help             Affiche l'aide
 */
function parseArgs(argv: string[]): {
  overrides: Partial<StressConfig>;
  modes: Pick<
    StressConfig,
    "setupOnly" | "cleanupOrphans" | "noCleanup" | "printConfig"
  >;
  showHelp: boolean;
} {
  const overrides: Partial<StressConfig> = {};
  const modes = {
    setupOnly: false,
    cleanupOrphans: false,
    noCleanup: false,
    printConfig: false,
  };
  let showHelp = false;

  // Bun.argv inclut le chemin bun, le script, puis les args
  // On skip les 2 premiers
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "-h":
      case "--help":
        showHelp = true;
        break;
      case "--setup-only":
        modes.setupOnly = true;
        break;
      case "--cleanup-orphans":
        modes.cleanupOrphans = true;
        break;
      case "--no-cleanup":
        modes.noCleanup = true;
        break;
      case "--print-config":
        modes.printConfig = true;
        break;
      case "--rafales":
        overrides.rafales = parseInt(next ?? "", 10);
        i++;
        break;
      case "--duration":
        overrides.durationMs = parseInt(next ?? "", 10);
        i++;
        break;
      case "--products":
        overrides.productsCount = parseInt(next ?? "", 10);
        i++;
        break;
      case "--recipes":
        overrides.recipesCount = parseInt(next ?? "", 10);
        i++;
        break;
      case "--jitter": {
        const min = parseInt(next ?? "", 10);
        const max = parseInt(args[i + 2] ?? "", 10);
        overrides.jitterMinMs = min;
        overrides.jitterMaxMs = max;
        i += 2;
        break;
      }
      default:
        // Ignore les args inconnus (Bun peut injecter des args internes)
        if (arg?.startsWith("--")) {
          console.warn(`[stress-config] Option inconnue ignorée : ${arg}`);
        }
    }
  }

  return { overrides, modes, showHelp };
}

/**
 * Lit les users depuis .env.local.
 * Accepte de 1 à 6 users (STRESS_USER_1_EMAIL à STRESS_USER_6_EMAIL).
 * Tolérant : si un index est manquant au milieu (ex: 3 absent), on skip et continue.
 */
function readUsers(): StressUser[] {
  const users: StressUser[] = [];

  for (let i = 1; i <= 6; i++) {
    const email = process.env[`STRESS_USER_${i}_EMAIL`];

    if (!email) continue; // slot vide = OK

    users.push({ index: i, email });
  }

  return users;
}

function readApiKey(): string {
  const apiKey = process.env.STRESS_API_KEY;
  if (!apiKey) {
    throw new ConfigError(
      "STRESS_API_KEY manquant dans .env.local. Créez une API key dédiée dans Appwrite Console > Overview > API Keys.",
    );
  }
  if (!apiKey.startsWith("standard_")) {
    throw new ConfigError(
      `STRESS_API_KEY doit commencer par "standard_" — actuel : ${apiKey.substring(0, 15)}...`,
    );
  }
  return apiKey;
}

function readNumber(
  envKey: string,
  defaultValue: number,
  override?: number,
  cliFlag?: string,
): number {
  // Override CLI explicite : si fourni mais NaN, c'est une erreur utilisateur
  if (override !== undefined) {
    if (Number.isNaN(override)) {
      throw new ConfigError(
        `${cliFlag ?? envKey} : valeur invalide (nombre attendu)`,
      );
    }
    return override;
  }

  const raw = process.env[envKey];
  if (raw === undefined || raw === "") return defaultValue;

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigError(
      `${envKey}="${raw}" n'est pas un nombre valide dans .env.local`,
    );
  }
  return parsed;
}

function readString(
  envKey: string,
  defaultValue: string,
  override?: string,
): string {
  if (override !== undefined && override !== "") return override;
  return process.env[envKey] || defaultValue;
}

// =============================================================================
// VALIDATION
// =============================================================================

function validate(config: StressConfig): void {
  if (config.users.length === 0) {
    throw new ConfigError(
      "Aucun user configuré. Remplissez STRESS_USER_1_EMAIL dans .env.local",
    );
  }

  if (config.productsCount < config.users.length) {
    throw new ConfigError(
      `STRESS_PRODUCTS_COUNT=${config.productsCount} est inférieur au nombre d'users (${config.users.length}). Il faut au moins 1 product/user pour les écritures.`,
    );
  }

  if (config.recipesCount < 1) {
    throw new ConfigError(`STRESS_RECIPES_COUNT doit être >= 1`);
  }

  if (config.rafales < 1) {
    throw new ConfigError(`--rafales doit être >= 1`);
  }

  if (config.durationMs < 1000) {
    throw new ConfigError(`--duration doit être >= 1000ms`);
  }

  if (config.jitterMinMs < 0 || config.jitterMaxMs < config.jitterMinMs) {
    throw new ConfigError(
      `Jitter invalide : min=${config.jitterMinMs}, max=${config.jitterMaxMs}`,
    );
  }

  if (!config.endpoint.startsWith("http")) {
    throw new ConfigError(
      `STRESS_ENDPOINT doit commencer par http(s):// — actuel : ${config.endpoint}`,
    );
  }

  if (!config.projectId || !config.databaseId) {
    throw new ConfigError("STRESS_PROJECT_ID et STRESS_DATABASE_ID sont requis");
  }

  // Vérifier qu'aucun user n'a l'email par défaut du template
  for (const user of config.users) {
    if (user.email.endsWith("@example.com")) {
      throw new ConfigError(
        `STRESS_USER_${user.index}_EMAIL est encore à "${user.email}" — veuillez remplir .env.local`,
      );
    }
  }
}

// =============================================================================
// API PUBLIQUE
// =============================================================================

export function loadConfig(argv: string[]): StressConfig {
  const { overrides, modes, showHelp } = parseArgs(argv);

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  const users = readUsers();
  const apiKey = readApiKey();

  const config: StressConfig = {
    users,
    apiKey,
    productsCount: readNumber(
      "STRESS_PRODUCTS_COUNT",
      DEFAULTS.productsCount,
      overrides.productsCount,
      "--products",
    ),
    recipesCount: readNumber(
      "STRESS_RECIPES_COUNT",
      DEFAULTS.recipesCount,
      overrides.recipesCount,
      "--recipes",
    ),
    rafales: readNumber(
      "STRESS_RAFALES",
      DEFAULTS.rafales,
      overrides.rafales,
      "--rafales",
    ),
    durationMs: readNumber(
      "STRESS_DURATION_MS",
      DEFAULTS.durationMs,
      overrides.durationMs,
      "--duration",
    ),
    jitterMinMs: readNumber(
      "STRESS_JITTER_MIN_MS",
      DEFAULTS.jitterMinMs,
      overrides.jitterMinMs,
      "--jitter MIN",
    ),
    jitterMaxMs: readNumber(
      "STRESS_JITTER_MAX_MS",
      DEFAULTS.jitterMaxMs,
      overrides.jitterMaxMs,
      "--jitter MAX",
    ),
    endpoint: readString(
      "STRESS_ENDPOINT",
      DEFAULTS.endpoint,
      overrides.endpoint,
    ),
    projectId: readString(
      "STRESS_PROJECT_ID",
      DEFAULTS.projectId,
      overrides.projectId,
    ),
    databaseId: readString(
      "STRESS_DATABASE_ID",
      DEFAULTS.databaseId,
      overrides.databaseId,
    ),
    ...modes,
  };

  validate(config);
  return config;
}

// =============================================================================
// FORMATAGE / AFFICHAGE
// =============================================================================

export function formatConfig(config: StressConfig): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("  STRESS TEST CONFIG");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("Users:");
  config.users.forEach((u) => {
    const role = u.index === 1 ? " (OWNER)" : "";
    lines.push(`  [${u.index}] ${u.email}${role}`);
  });
  lines.push("");
  lines.push("Sandbox:");
  lines.push(`  productsCount : ${config.productsCount}`);
  lines.push(`  recipesCount  : ${config.recipesCount}`);
  lines.push("");
  lines.push("Test:");
  lines.push(`  rafales       : ${config.rafales}`);
  lines.push(`  duration      : ${config.durationMs}ms (${(config.durationMs / 1000).toFixed(0)}s)`);
  lines.push(`  jitter        : ${config.jitterMinMs}-${config.jitterMaxMs}ms`);
  lines.push("");
  lines.push("Appwrite:");
  lines.push(`  endpoint      : ${config.endpoint}`);
  lines.push(`  projectId     : ${config.projectId}`);
  lines.push(`  databaseId    : ${config.databaseId}`);
  lines.push("");
  lines.push("Modes:");
  lines.push(`  setupOnly       : ${config.setupOnly}`);
  lines.push(`  cleanupOrphans  : ${config.cleanupOrphans}`);
  lines.push(`  noCleanup       : ${config.noCleanup}`);
  lines.push(`  printConfig     : ${config.printConfig}`);
  lines.push("═══════════════════════════════════════════════════════════");
  return lines.join("\n");
}

export function printHelp(): void {
  const help = `
Stress Test Appwrite — Script de charge pour ec-dev

Usage:
  bun run scripts/stress-test.ts [options]

Options:
  --rafales N              Nombre de rafales (défaut : 100)
  --duration MS            Durée max en ms (défaut : 180000)
  --products N             Nombre de products à créer (défaut : 30)
  --recipes N              Nombre de recipes à fetch (défaut : 10)
  --jitter MIN MAX         Délai aléatoire entre users en ms (défaut : 100 500)

Modes:
  --setup-only             Crée le sandbox, vérifie, attend Entrée, teardown
  --cleanup-orphans        Scan et supprime les sandboxes orphelins, puis exit
  --no-cleanup             Skip le teardown (garder le sandbox pour investigation)
  --print-config           Affiche la config résolue et exit

Help:
  -h, --help               Affiche cette aide

Configuration:
  Tous les paramètres ont des valeurs par défaut.
  Pour persister, utiliser .env.local (voir .env.local.example).

Exemples:
  bun run scripts/stress-test.ts                         # Run complet par défaut
  bun run scripts/stress-test.ts --setup-only            # Valider le setup sandbox
  bun run scripts/stress-test.ts --rafales 10            # Run court de 10 rafales
  bun run scripts/stress-test.ts --cleanup-orphans       # Nettoyer orphelins
  bun run scripts/stress-test.ts --print-config          # Voir la config résolue
`;
  console.log(help);
}

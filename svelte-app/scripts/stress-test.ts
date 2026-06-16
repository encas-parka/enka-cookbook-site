/**
 * stress-test.ts — Script principal d'orchestration du stress test
 *
 * Phases :
 *   0. Pre-flight : parse CLI, scan orphelins (best-effort)
 *   1. Setup sandbox : createEvent + createProducts
 *   2. Bootstore : 6 listRows par virtual user (syncInitial simulé)
 *   3. Rafales : N itérations, chaque user fait 3 reads + 2 writes en parallèle
 *   4. Teardown + Report
 *
 * Modes spéciaux :
 *   --setup-only       Setup + vérification + attente Entrée, puis teardown
 *   --cleanup-orphans  Scan et supprime les orphelins, puis exit
 *   --no-cleanup       Skip le teardown après les rafales
 *
 * Usage :
 *   bun run scripts/stress-test.ts [options]
 *   bun run scripts/stress-test.ts --rafales 10
 *   bun run scripts/stress-test.ts --setup-only
 *
 * Gestion Ctrl+C : handler SIGINT pour teardown propre.
 */

import { loadConfig, formatConfig } from "./stress-config";
import {
  createAndResolveClient,
  StressClient,
  type StressAppwriteConfig,
} from "./stress-client";
import {
  setupSandbox,
  teardownSandbox,
  scanOrphans,
  cleanupOrphans,
  type SandboxInfo,
} from "./stress-setup";
import { runUserRafale } from "./stress-scenarios";
import { StressReporter } from "./stress-reporter";

// =============================================================================
// HELPERS
// =============================================================================

function log(phase: string, message: string): void {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] [${phase}] ${message}`);
}

function randomJitter(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Construit l'objet config Appwrite commun à tous les virtual users. */
function buildAwConfig(config: ReturnType<typeof loadConfig>): StressAppwriteConfig {
  return {
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    apiKey: config.apiKey,
  };
}

// =============================================================================
// PHASE 0 — PRE-FLIGHT
// =============================================================================

async function phasePreflight(
  config: ReturnType<typeof loadConfig>,
  awConfig: StressAppwriteConfig,
): Promise<void> {
  log("0", "Pre-flight");

  if (config.printConfig) {
    console.log(formatConfig(config));
    process.exit(0);
  }

  // Scan orphelins (best-effort — limitation serveur 1.9.0 documentée)
  if (config.cleanupOrphans) {
    log("0", "Mode --cleanup-orphans : scan et suppression des sandboxes orphelins");
    const tmpClient = new StressClient(config.users[0], awConfig);
    await tmpClient.resolveUser();
    const orphans = await scanOrphans(tmpClient);
    if (orphans.length === 0) {
      console.log("  Aucun orphelin trouvé.");
      console.log(
        "  ⚠️ Note : le serveur 1.9.0 ne retourne pas toujours les rows récents via listRows.",
      );
      console.log("           Les orphelins très récents peuvent ne pas être détectés.");
    } else {
      console.log(`  ${orphans.length} orphelin(s) trouvé(s) :`);
      for (const o of orphans) {
        console.log(`    - ${o.name} (${o.$id}) — ${o.productIds.length} products`);
      }
      const result = await cleanupOrphans(tmpClient, orphans);
      console.log(
        `  Supprimé : ${result.deletedEvents} events, ${result.deletedProducts} products, ${result.errors.length} erreurs`,
      );
    }
    await tmpClient.close();
    process.exit(0);
  }
}

// =============================================================================
// PHASE 1 — SETUP SANDBOX
// =============================================================================

async function phaseSetup(
  config: ReturnType<typeof loadConfig>,
  awConfig: StressAppwriteConfig,
): Promise<{ owner: StressClient; sandbox: SandboxInfo }> {
  log("1", "Setup sandbox");

  // Owner = user 1
  const ownerResult = await createAndResolveClient(config.users[0], awConfig);
  if ("error" in ownerResult) {
    throw new Error(`Setup impossible — user 1 (${config.users[0].email}) : ${ownerResult.error}`);
  }
  const owner = ownerResult.client;

  const sandbox = await setupSandbox(owner, {
    productsCount: config.productsCount,
    recipesCount: config.recipesCount,
  });

  return { owner, sandbox };
}

// =============================================================================
// PHASE 2 — BOOTSTORE (6 listRows par virtual user)
// =============================================================================

async function phaseBootstore(
  config: ReturnType<typeof loadConfig>,
  awConfig: StressAppwriteConfig,
  reporter: StressReporter,
): Promise<StressClient[]> {
  log("2", `Bootstore simulé (6 listRows × ${config.users.length} virtual users)`);

  // Crée N virtual users en parallèle
  const results = await Promise.all(
    config.users.map((u) => createAndResolveClient(u, awConfig)),
  );

  const clients: StressClient[] = [];
  const failed: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if ("error" in r) {
      failed.push(`${config.users[i].email}: ${r.error}`);
    } else {
      clients.push(r.client);
    }
  }

  if (failed.length > 0) {
    console.log(`  ⚠️ ${failed.length}/${config.users.length} users n'ont pas pu être résolus :`);
    for (const f of failed) console.log(`    - ${f}`);
  }

  if (clients.length === 0) {
    throw new Error("Aucun virtual user disponible pour le bootstore");
  }

  console.log(`  ${clients.length}/${config.users.length} virtual users prêts`);

  // Bootstore en parallèle sur tous les virtual users
  const bootResults = await Promise.all(clients.map((c) => c.bootstore()));

  // Reporte les latences bootstore
  for (let i = 0; i < clients.length; i++) {
    reporter.recordBootstore(clients[i].user.index, bootResults[i].syncLatencies);
  }

  const totalLatency = bootResults.reduce((sum, r) => sum + r.durationMs, 0);
  const avgLatency = totalLatency / bootResults.length;
  log("2", `Bootstore terminé — latence moyenne par user : ${avgLatency.toFixed(0)}ms`);

  return clients;
}

// =============================================================================
// PHASE 3 — RAFALES
// =============================================================================

async function phaseRafales(
  config: ReturnType<typeof loadConfig>,
  clients: StressClient[],
  sandbox: SandboxInfo,
  reporter: StressReporter,
): Promise<void> {
  log("3", `Démarrage des rafales (${config.rafales} itérations, ${clients.length} virtual users)`);

  // Dispatch products round-robin entre les virtual users
  const productsPerUser: string[][] = Array.from({ length: clients.length }, () => []);
  for (let i = 0; i < sandbox.productIds.length; i++) {
    productsPerUser[i % clients.length].push(sandbox.productIds[i]);
  }

  // Pour les users sans products (si moins de products que de users), fallback sur tous
  for (let i = 0; i < clients.length; i++) {
    if (productsPerUser[i].length === 0) {
      productsPerUser[i] = [...sandbox.productIds];
    }
  }

  const startTime = Date.now();
  let totalSuccess = 0;
  let totalErrors = 0;

  for (let rafale = 1; rafale <= config.rafales; rafale++) {
    // Check durée max
    if (Date.now() - startTime > config.durationMs) {
      log("3", `Durée max atteinte (${config.durationMs}ms) — arrêt à la rafale ${rafale - 1}/${config.rafales}`);
      break;
    }

    const rafaleStart = performance.now();

    // Lance tous les users en parallèle (avec jitter optionnel)
    const rafalePromise = Promise.all(
      clients.map(async (client, idx) => {
        // Jitter : décale légèrement chaque user dans le temps pour réalisme
        if (config.jitterMaxMs > 0) {
          const jitter = randomJitter(config.jitterMinMs, config.jitterMaxMs);
          await new Promise((r) => setTimeout(r, jitter));
        }
        const productIds = productsPerUser[idx];
        return runUserRafale(client, productIds, reporter);
      }),
    );

    const results = await rafalePromise;
    const reads = results.reduce((sum, r) => sum + r.reads, 0);
    const writes = results.reduce((sum, r) => sum + r.writes, 0);
    totalSuccess += reads + writes;

    const rafaleDuration = performance.now() - rafaleStart;

    // Log tous les 10 rafales ou la dernière
    if (rafale % 10 === 0 || rafale === config.rafales) {
      log(
        "3",
        `Rafale ${rafale.toString().padStart(3)}/${config.rafales} — ${reads + writes} req réussies (${rafaleDuration.toFixed(0)}ms)`,
      );
    }
  }

  const totalDuration = (Date.now() - startTime) / 1000;
  const throughput = totalSuccess / Math.max(1, totalDuration);
  log("3", `${config.rafales} rafales terminées en ${totalDuration.toFixed(1)}s — ${totalSuccess} req réussies, ${throughput.toFixed(1)} req/s`);
}

// =============================================================================
// PHASE 4 — TEARDOWN + REPORT
// =============================================================================

async function phaseTeardown(
  config: ReturnType<typeof loadConfig>,
  owner: StressClient,
  clients: StressClient[],
  sandbox: SandboxInfo,
  reporter: StressReporter,
): Promise<void> {
  log("4", "Teardown");

  // 1. Close tous les virtual users (no-op avec API key mais pour forward-compat)
  await Promise.all(clients.map((c) => c.close().catch(() => {})));

  // 2. Teardown sandbox (sauf si --no-cleanup)
  if (config.noCleanup) {
    log("4", `--no-cleanup activé : sandbox ${sandbox.eventName} conservé pour investigation`);
    console.log(`  eventId: ${sandbox.eventId}`);
    console.log(`  productIds count: ${sandbox.productIds.length}`);
  } else {
    const result = await teardownSandbox(owner, sandbox);
    if (result.errors.length > 0) {
      console.log(`  ⚠️ ${result.errors.length} erreurs pendant le teardown :`);
      for (const e of result.errors.slice(0, 5)) console.log(`    - ${e}`);
    }
  }

  await owner.close();

  // 3. Rapport final
  reporter.markEnd();
  reporter.report();
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║           🚀 APPWRITE STRESS TEST (ec-dev)               ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  const config = loadConfig(process.argv);
  const awConfig = buildAwConfig(config);
  const reporter = new StressReporter();

  // Handler SIGINT (Ctrl+C) pour teardown propre
  let sigintReceived = false;
  const sigintHandler = async () => {
    if (sigintReceived) {
      console.log("\n⚠️ Ctrl+C reçu 2 fois — exit forcé");
      process.exit(130);
    }
    sigintReceived = true;
    console.log("\n⚠️ Ctrl+C reçu — teardown en cours...");
    // Le teardown sera géré par finally
  };
  process.on("SIGINT", sigintHandler);

  let owner: StressClient | null = null;
  let clients: StressClient[] = [];
  let sandbox: SandboxInfo | null = null;

  try {
    // Phase 0
    await phasePreflight(config, awConfig);

    // Phase 1
    const setupResult = await phaseSetup(config, awConfig);
    owner = setupResult.owner;
    sandbox = setupResult.sandbox;

    // Mode --setup-only : pause puis teardown
    if (config.setupOnly) {
      console.log("");
      console.log("✅ Setup terminé avec succès.");
      console.log(`   eventId: ${sandbox.eventId}`);
      console.log(`   eventName: ${sandbox.eventName}`);
      console.log(`   products: ${sandbox.productIds.length}`);
      console.log("");
      console.log("Appuie sur Entrée pour teardown et quitter...");
      await new Promise<void>((resolve) => {
        process.stdin.resume();
        process.stdin.once("data", () => resolve());
      });

      await phaseTeardown(config, owner, [], sandbox, reporter);
      return;
    }

    // Phase 2
    clients = await phaseBootstore(config, awConfig, reporter);

    // Phase 3 (skip si Ctrl+C pendant le bootstore)
    if (!sigintReceived) {
      await phaseRafales(config, clients, sandbox, reporter);
    }

    // Phase 4
    await phaseTeardown(config, owner, clients, sandbox, reporter);
  } catch (error: any) {
    console.error("\n❌ Erreur fatale :", error.message);
    console.error(error.stack);

    // Tentative de cleanup d'urgence
    if (sandbox && owner && !config.noCleanup) {
      console.log("\n🚑 Tentative de teardown d'urgence...");
      try {
        await teardownSandbox(owner, sandbox);
        console.log("✓ Sandbox supprimé");
      } catch (e: any) {
        console.error("✗ Teardown échoué :", e.message);
        console.error(`  → Cleanup manuel nécessaire : event ${sandbox.eventId} + products`);
      }
    }
    process.exit(1);
  } finally {
    process.removeListener("SIGINT", sigintHandler);
  }
}

main();

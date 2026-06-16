/**
 * stress-reporter.ts — Collecte et rapport des mesures du stress test
 *
 * Responsabilités :
 *   - `record(scenario, userId, durationMs, status, error?)` : enregistre une mesure
 *   - `recordBootstore(userId, syncLatencies)` : enregistre le bootstore
 *   - `report()` : affiche le rapport console coloré
 *
 * Stats calculées : p50/p95/p99 latence par scénario, taux d'erreur catégorisé,
 * throughput global, latence bootstore moyenne.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ScenarioName = "read" | "write" | "bootstore";

export interface Measure {
  scenario: ScenarioName;
  userIndex: number;
  durationMs: number;
  status: "success" | "error";
  httpStatus?: number;
  errorMessage?: string;
  timestamp: number;
}

// =============================================================================
// UTILITAIRES STATS
// =============================================================================

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, idx))];
}

function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

// Codes ANSI pour couleurs (sans dépendance externe)
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// =============================================================================
// STRESS REPORTER
// =============================================================================

export class StressReporter {
  #measures: Measure[] = [];
  #bootstoreLatencies: { userIndex: number; collection: string; durationMs: number; error?: string }[] = [];
  #startTime: number;
  #endTime: number | null = null;

  constructor() {
    this.#startTime = Date.now();
  }

  /** Marque la fin du test (pour calcul duration totale). */
  markEnd(): void {
    this.#endTime = Date.now();
  }

  /** Enregistre une mesure individuelle. */
  record(measure: Measure): void {
    this.#measures.push(measure);
  }

  /** Enregistre les latences de bootstore pour un user. */
  recordBootstore(
    userIndex: number,
    syncLatencies: { collection: string; durationMs: number; error?: string }[],
  ): void {
    for (const s of syncLatencies) {
      this.#bootstoreLatencies.push({ userIndex, ...s });
    }
  }

  // ===========================================================================
  // CALCULS
  // ===========================================================================

  #getScenarioStats(name: ScenarioName): {
    count: number;
    errors: number;
    durations: number[];
    errorBreakdown: Record<string, number>;
  } {
    const filtered = this.#measures.filter((m) => m.scenario === name);
    const durations = filtered
      .filter((m) => m.status === "success")
      .map((m) => m.durationMs)
      .sort((a, b) => a - b);
    const errors = filtered.filter((m) => m.status === "error");

    const errorBreakdown: Record<string, number> = {};
    for (const e of errors) {
      const key = e.httpStatus ? `HTTP ${e.httpStatus}` : "network";
      errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
    }

    return {
      count: filtered.length,
      errors: errors.length,
      durations,
      errorBreakdown,
    };
  }

  // ===========================================================================
  // RAPPORT
  // ===========================================================================

  /** Affiche le rapport console coloré. */
  report(): void {
    const totalDuration = ((this.#endTime ?? Date.now()) - this.#startTime) / 1000;
    const totalRequests = this.#measures.length;
    const throughput = totalRequests / Math.max(1, totalDuration);

    console.log("");
    console.log(
      `${ANSI.bold}${ANSI.cyan}═══════════════════════════════════════════════════════════${ANSI.reset}`,
    );
    console.log(
      `${ANSI.bold}${ANSI.cyan}  RAPPORT STRESS TEST${ANSI.reset}`,
    );
    console.log(
      `${ANSI.cyan}═══════════════════════════════════════════════════════════${ANSI.reset}`,
    );
    console.log("");

    // Vue globale
    console.log(`${ANSI.bold}📊 Vue globale${ANSI.reset}`);
    console.log(`  Durée totale     : ${totalDuration.toFixed(1)}s`);
    console.log(`  Requêtes totales : ${totalRequests}`);
    console.log(`  Throughput       : ${throughput.toFixed(1)} req/s`);
    console.log("");

    // Stats par scénario
    const scenarios: ScenarioName[] = ["read", "write", "bootstore"];
    for (const name of scenarios) {
      const stats = this.#getScenarioStats(name);
      if (stats.count === 0) continue;

      const errorRate = (stats.errors / stats.count) * 100;
      const errorTag =
        errorRate === 0
          ? `${ANSI.green}0%${ANSI.reset}`
          : errorRate < 10
            ? `${ANSI.yellow}${errorRate.toFixed(1)}%${ANSI.reset}`
            : `${ANSI.red}${errorRate.toFixed(1)}%${ANSI.reset}`;

      console.log(
        `${ANSI.bold}${ANSI.blue}📈 ${name.toUpperCase()}${ANSI.reset} (${stats.count} requêtes, ${errorTag} erreurs)`,
      );

      if (stats.durations.length > 0) {
        const p50 = percentile(stats.durations, 50);
        const p95 = percentile(stats.durations, 95);
        const p99 = percentile(stats.durations, 99);
        const avg = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
        const min = stats.durations[0];
        const max = stats.durations[stats.durations.length - 1];

        console.log(
          `  ${ANSI.dim}latence${ANSI.reset}  p50 ${ANSI.bold}${formatMs(p50)}${ANSI.reset}  ` +
            `p95 ${ANSI.bold}${formatMs(p95)}${ANSI.reset}  ` +
            `p99 ${ANSI.bold}${formatMs(p99)}${ANSI.reset}`,
        );
        console.log(
          `  ${ANSI.dim}min/max${ANSI.reset}  ${formatMs(min)} / ${formatMs(max)}  ` +
            `${ANSI.dim}(avg ${formatMs(avg)})${ANSI.reset}`,
        );
      }

      if (stats.errors > 0) {
        const breakdown = Object.entries(stats.errorBreakdown)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        console.log(`  ${ANSI.red}erreurs${ANSI.reset}   ${breakdown}`);
      }

      console.log("");
    }

    // Bootstore détaillé (par collection)
    if (this.#bootstoreLatencies.length > 0) {
      console.log(`${ANSI.bold}${ANSI.magenta}🚀 Bootstore (syncInitial simulé)${ANSI.reset}`);
      const collections = [...new Set(this.#bootstoreLatencies.map((b) => b.collection))];
      for (const col of collections) {
        const items = this.#bootstoreLatencies.filter((b) => b.collection === col);
        const ok = items.filter((b) => !b.error);
        const errs = items.filter((b) => b.error);
        const durations = ok.map((b) => b.durationMs).sort((a, b) => a - b);
        const p50 = percentile(durations, 50);
        const errTag = errs.length > 0 ? ` ${ANSI.red}(${errs.length} erreurs)${ANSI.reset}` : "";
        console.log(
          `  ${col.padEnd(16)} p50 ${formatMs(p50).padStart(8)}  ${ANSI.dim}${ok.length} samples${ANSI.reset}${errTag}`,
        );
      }
      console.log("");
    }

    // Conclusion
    const totalErrors = this.#measures.filter((m) => m.status === "error").length;
    const overallErrorRate = (totalErrors / Math.max(1, totalRequests)) * 100;
    const healthTag =
      overallErrorRate < 1
        ? `${ANSI.green}${ANSI.bold}EXCELLENT${ANSI.reset}`
        : overallErrorRate < 5
          ? `${ANSI.green}BON${ANSI.reset}`
          : overallErrorRate < 20
            ? `${ANSI.yellow}DÉGRADÉ${ANSI.reset}`
            : `${ANSI.red}${ANSI.bold}CRITIQUE${ANSI.reset}`;

    console.log(`${ANSI.bold}🏥 Santé globale${ANSI.reset}`);
    console.log(`  Taux d'erreur    : ${healthTag} (${overallErrorRate.toFixed(2)}%)`);
    console.log("");

    console.log(
      `${ANSI.cyan}═══════════════════════════════════════════════════════════${ANSI.reset}`,
    );
    console.log("");
  }

  /** Retourne les mesures brutes (pour export JSON éventuel en V2). */
  getMeasures(): Measure[] {
    return [...this.#measures];
  }
}

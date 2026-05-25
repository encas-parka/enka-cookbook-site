#!/usr/bin/env bun
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, basename } from 'path';
import type { MergePlan, MergeEntry, RecipeIngredient, CatalogIngredient } from './lib/types';
import { loadExistingDump, writeDump } from './lib/appwrite-fetch';
import { findRecipeFiles, processHugoContent, type WinnerInfo } from './lib/hugo-parser';

const DATABASE_ID = '689d15b10003a5a13636';
const COLLECTION_ID = 'recettes';
const APPWRITE_DIR = 'appwrite';
const DEFAULT_DUMP_PATH = '.agents/CR/all-recipes-full.jsonl';
const CATALOGUE_PATH = 'static/data/ingredients.json';

function parseArgs(): { planPath: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let planPath = '';
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan' && args[i + 1]) {
      planPath = args[++i];
    } else if (args[i] === '--apply') {
      dryRun = false;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (!planPath) {
    console.error('Usage: bun run apply-merge.ts --plan <merge-plan.json> [--dry-run] [--apply]');
    process.exit(1);
  }

  return { planPath, dryRun };
}

function loadMergePlan(path: string): MergePlan {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as MergePlan;
}

function buildLoserMap(plan: MergePlan): Map<string, WinnerInfo> {
  const map = new Map<string, WinnerInfo>();
  for (const entry of plan.merges) {
    for (const loser of entry.losers) {
      map.set(loser.uuid, { uuid: entry.winner.uuid, name: entry.winner.name });
    }
  }
  return map;
}

function backup(filePath: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${ts}`;
  copyFileSync(filePath, backupPath);
  return backupPath;
}

function processHugoFiles(loserToWinner: Map<string, WinnerInfo>, dryRun: boolean): number {
  const files = findRecipeFiles('.');
  let totalChanges = 0;

  console.log(`\n[Hugo] Scanning ${files.length} recipe files...`);

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const result = processHugoContent(content, loserToWinner);
    if (!result) continue;

    const relPath = filePath.replace(/^\.\//, '');
    console.log(`\n  ${relPath} (${result.recipeTitle}):`);
    for (const change of result.changes) {
      console.log(`    - "${change.loserName}" (${change.loserUUID}) → "${change.winnerName}" (${change.winnerUUID})`);
    }
    totalChanges += result.changes.length;

    if (!dryRun) {
      backup(filePath);
      writeFileSync(filePath, result.newContent, 'utf-8');
    }
  }

  if (totalChanges === 0) {
    console.log('  No changes needed.');
  } else if (dryRun) {
    console.log(`\n  (dry-run: ${totalChanges} ingredient replacements would be made)`);
  } else {
    console.log(`\n  ✓ Applied ${totalChanges} ingredient replacements`);
  }

  return totalChanges;
}

interface AppwriteDocChange {
  docId: string;
  title: string;
  changes: { loserName: string; loserUUID: string; winnerName: string; winnerUUID: string }[];
}

function processAppwriteDump(
  loserToWinner: Map<string, WinnerInfo>,
  dryRun: boolean,
  dumpPath: string,
): number {
  console.log(`\n[Appwrite] Processing dump: ${dumpPath}`);

  const docs = loadExistingDump(dumpPath);
  const modifiedDocs: AppwriteDocChange[] = [];

  for (const [docId, doc] of docs) {
    if (!doc.ingredients || !Array.isArray(doc.ingredients)) continue;

    let docModified = false;
    const docChange: AppwriteDocChange = { docId, title: doc.title || docId, changes: [] };

    for (let i = 0; i < doc.ingredients.length; i++) {
      const raw = doc.ingredients[i];
      if (typeof raw !== 'string') continue;

      let ing: RecipeIngredient;
      try {
        ing = JSON.parse(raw) as RecipeIngredient;
      } catch {
        continue;
      }

      const winner = loserToWinner.get(ing.uuid);
      if (!winner) continue;

      const loserName = ing.name;
      const loserUUID = ing.uuid;
      ing.uuid = winner.uuid;
      ing.name = winner.name;
      doc.ingredients[i] = JSON.stringify(ing);
      docModified = true;

      docChange.changes.push({
        loserName,
        loserUUID,
        winnerName: winner.name,
        winnerUUID: winner.uuid,
      });
    }

    if (docModified) {
      modifiedDocs.push(docChange);
    }
  }

  for (const doc of modifiedDocs) {
    console.log(`\n  ${doc.docId} (${doc.title}):`);
    for (const change of doc.changes) {
      console.log(`    - "${change.loserName}" (${change.loserUUID}) → "${change.winnerName}" (${change.winnerUUID})`);
    }
  }

  if (modifiedDocs.length === 0) {
    console.log('  No changes needed.');
    return 0;
  }

  let totalChanges = modifiedDocs.reduce((sum, d) => sum + d.changes.length, 0);

  if (dryRun) {
    console.log(`\n  (dry-run: ${totalChanges} replacements across ${modifiedDocs.length} documents)`);
  } else {
    backup(dumpPath);
    writeDump(dumpPath, docs);
    console.log(`\n  ✓ Dump updated (${totalChanges} replacements across ${modifiedDocs.length} documents)`);

    console.log('\n  Pushing changes to Appwrite...');
    let cliErrors = 0;
    for (const docChange of modifiedDocs) {
      const doc = docs.get(docChange.docId);
      if (!doc) continue;
      try {
        const dataStr = JSON.stringify({ ingredients: doc.ingredients });
        execFileSync(
          'appwrite',
          ['-R', 'databases', 'update-document', '--database-id', DATABASE_ID, '--collection-id', COLLECTION_ID, '--document-id', docChange.docId, '--data', dataStr],
          { cwd: APPWRITE_DIR, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        );
        console.log(`    ✓ ${docChange.docId}`);
      } catch (err: any) {
        console.error(`    ✗ ${docChange.docId}: ${err.message || err}`);
        cliErrors++;
      }
    }
    if (cliErrors > 0) {
      console.log(`\n  ⚠ ${cliErrors} CLI errors (dump was saved locally though)`);
    }
  }

  return totalChanges;
}

function processCatalogue(
  plan: MergePlan,
  loserToWinner: Map<string, WinnerInfo>,
  dryRun: boolean,
): number {
  console.log(`\n[Catalogue] Processing ${CATALOGUE_PATH}`);

  const raw = readFileSync(CATALOGUE_PATH, 'utf-8');
  const catalogue: CatalogIngredient[] = JSON.parse(raw);

  const loserUUIDs = new Set(loserToWinner.keys());
  const winnerUUIDs = new Set(plan.merges.map((e) => e.winner.uuid));
  const winnerMeta = new Map<string, MergeEntry['winner']>();
  for (const entry of plan.merges) {
    winnerMeta.set(entry.winner.uuid, entry.winner);
  }

  const removed: CatalogIngredient[] = [];
  const updated: string[] = [];
  const newCatalogue: CatalogIngredient[] = [];

  for (const item of catalogue) {
    if (loserUUIDs.has(item.u)) {
      removed.push(item);
      continue;
    }

    if (winnerUUIDs.has(item.u)) {
      const meta = winnerMeta.get(item.u);
      if (meta) {
        const origN = item.n;
        const origT = item.t;
        let changed = false;

        if (meta.name && meta.name !== item.n) {
          item.n = meta.name;
          changed = true;
        }
        if (meta.type && meta.type !== item.t) {
          item.t = meta.type;
          changed = true;
        }
        if (meta.a !== undefined) {
          item.a = meta.a;
          changed = true;
        }
        if (meta.pF !== undefined) {
          item.pF = meta.pF;
          changed = true;
        }

        if (changed) {
          updated.push(`${item.u} (name: ${origN} → ${item.n}, type: ${origT} → ${item.t})`);
        }
      }
    }

    newCatalogue.push(item);
  }

  for (const item of removed) {
    const winner = loserToWinner.get(item.u);
    const winnerEntry = winner ? `keeping "${winner.name}" (${winner.uuid})` : '';
    console.log(`  Removing "${item.n}" (${item.u}), ${winnerEntry}`);
  }

  for (const upd of updated) {
    console.log(`  Updated winner: ${upd}`);
  }

  if (removed.length === 0 && updated.length === 0) {
    console.log('  No changes needed.');
    return 0;
  }

  if (dryRun) {
    console.log(`\n  (dry-run: would remove ${removed.length} entries, update ${updated.length} winners)`);
  } else {
    backup(CATALOGUE_PATH);
    writeFileSync(CATALOGUE_PATH, JSON.stringify(newCatalogue, null, 2) + '\n', 'utf-8');
    console.log(`\n  ✓ Catalogue updated: ${catalogue.length} → ${newCatalogue.length} entries`);
  }

  return removed.length;
}

function main() {
  const { planPath, dryRun } = parseArgs();

  if (dryRun) {
    console.log('=== DRY-RUN MODE (no files will be modified) ===');
  } else {
    console.log('=== APPLY MODE (files will be modified) ===');
  }

  const plan = loadMergePlan(planPath);
  console.log(`\nMergePlan: ${plan.merges.length} merges, ${plan.meta.totalMerges} total`);
  console.log(`Plan created by ${plan.meta.createdBy} on ${plan.meta.date}`);

  const loserToWinner = buildLoserMap(plan);
  console.log(`Loser map: ${loserToWinner.size} UUIDs to replace`);

  const hugoChanges = processHugoFiles(loserToWinner, dryRun);
  const appwriteChanges = processAppwriteDump(loserToWinner, dryRun, DEFAULT_DUMP_PATH);
  const catalogueChanges = processCatalogue(plan, loserToWinner, dryRun);

  console.log('\n=== SUMMARY ===');
  console.log(`Hugo:      ${hugoChanges} replacements`);
  console.log(`Appwrite:  ${appwriteChanges} replacements`);
  console.log(`Catalogue: ${catalogueChanges} entries removed`);

  if (dryRun) {
    console.log('\nRun with --apply to actually perform these changes.');
  } else {
    console.log('\nAll changes applied. Backups created alongside originals.');
  }
}

main();

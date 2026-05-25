#!/usr/bin/env bun
import { readFileSync } from 'fs';
import type { RecipeIngredient, CatalogIngredient } from './lib/types';
import { loadExistingDump } from './lib/appwrite-fetch';
import { findRecipeFiles, extractHugoIngredients, type IngredientRef } from './lib/hugo-parser';

const DEFAULT_DUMP_PATH = '.agents/CR/all-recipes-full.jsonl';
const CATALOGUE_PATH = 'static/data/ingredients.json';

interface RecipeSource {
  source: 'hugo' | 'appwrite';
  title: string;
}

function loadCatalogue(): Map<string, string> {
  const raw = readFileSync(CATALOGUE_PATH, 'utf-8');
  const items: CatalogIngredient[] = JSON.parse(raw);
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.u, item.n);
  }
  return map;
}

function collectHugoRefs(): Map<string, { name: string; sources: RecipeSource[] }> {
  const refs = new Map<string, { name: string; sources: RecipeSource[] }>();
  const files = findRecipeFiles('.');

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const { title, ingredients } = extractHugoIngredients(content);

    for (const ing of ingredients) {
      const existing = refs.get(ing.uuid);
      if (existing) {
        existing.sources.push({ source: 'hugo', title });
      } else {
        refs.set(ing.uuid, { name: ing.name, sources: [{ source: 'hugo', title }] });
      }
    }
  }

  return refs;
}

function collectAppwriteRefs(dumpPath: string): Map<string, { name: string; sources: RecipeSource[] }> {
  const refs = new Map<string, { name: string; sources: RecipeSource[] }>();
  const docs = loadExistingDump(dumpPath);

  for (const [, doc] of docs) {
    if (!doc.ingredients || !Array.isArray(doc.ingredients)) continue;

    for (const raw of doc.ingredients) {
      if (typeof raw !== 'string') continue;
      let ing: RecipeIngredient;
      try {
        ing = JSON.parse(raw) as RecipeIngredient;
      } catch {
        continue;
      }

      const existing = refs.get(ing.uuid);
      if (existing) {
        existing.sources.push({ source: 'appwrite', title: doc.title || doc.$id });
      } else {
        refs.set(ing.uuid, { name: ing.name, sources: [{ source: 'appwrite', title: doc.title || doc.$id }] });
      }
    }
  }

  return refs;
}

function main() {
  const expectedCount = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  let hasErrors = false;

  const catalogue = loadCatalogue();
  console.log(`Catalogue: ${catalogue.size} ingredients`);

  const hugoRefs = collectHugoRefs();
  const appwriteRefs = collectAppwriteRefs(DEFAULT_DUMP_PATH);

  const allRefs = new Map<string, { name: string; sources: RecipeSource[] }>();
  for (const [uuid, data] of hugoRefs) {
    allRefs.set(uuid, data);
  }
  for (const [uuid, data] of appwriteRefs) {
    const existing = allRefs.get(uuid);
    if (existing) {
      existing.sources.push(...data.sources);
    } else {
      allRefs.set(uuid, data);
    }
  }

  console.log(`\nScanning ${hugoRefs.size + appwriteRefs.size} unique ingredient UUIDs across Hugo + Appwrite...`);

  // Orphan check
  console.log('\n--- Orphan check ---');
  const orphans: { uuid: string; name: string; count: number; sources: string[] }[] = [];
  for (const [uuid, data] of allRefs) {
    if (!catalogue.has(uuid)) {
      const sourceNames = [...new Set(data.sources.map((s) => `${s.source}:${s.title}`))];
      orphans.push({ uuid, name: data.name, count: data.sources.length, sources: sourceNames });
    }
  }

  if (orphans.length === 0) {
    console.log('✓ Orphan check: 0 orphan UUIDs');
  } else {
    hasErrors = true;
    console.log(`✗ Orphan check: ${orphans.length} orphan UUIDs found`);
    for (const orphan of orphans) {
      console.log(`  - "${orphan.name}" (${orphan.uuid}) referenced in ${orphan.count} recipes`);
      const sample = orphan.sources.slice(0, 5);
      for (const s of sample) {
        console.log(`    · ${s}`);
      }
      if (orphan.sources.length > 5) {
        console.log(`    · ... and ${orphan.sources.length - 5} more`);
      }
    }
  }

  // Consistency check
  console.log('\n--- Consistency check ---');
  const mismatches: { uuid: string; recipeName: string; catalogueName: string; sources: string[] }[] = [];
  for (const [uuid, data] of allRefs) {
    const catalogueName = catalogue.get(uuid);
    if (catalogueName === undefined) continue;
    if (data.name !== catalogueName) {
      const sourceNames = [...new Set(data.sources.map((s) => `${s.source}:${s.title}`))];
      mismatches.push({ uuid, recipeName: data.name, catalogueName, sources: sourceNames });
    }
  }

  if (mismatches.length === 0) {
    console.log('✓ Consistency check: 0 name mismatches');
  } else {
    console.log(`⚠ Consistency check: ${mismatches.length} name mismatches`);
    for (const mm of mismatches) {
      console.log(`  - (${mm.uuid}) recipe: "${mm.recipeName}" vs catalogue: "${mm.catalogueName}"`);
      const sample = mm.sources.slice(0, 3);
      for (const s of sample) {
        console.log(`    · ${s}`);
      }
    }
  }

  // Count check
  console.log('\n--- Count check ---');
  const countMsg = expectedCount !== null
    ? `Catalogue: ${catalogue.size} ingredients (expected ${expectedCount})`
    : `Catalogue: ${catalogue.size} ingredients`;
  console.log(`✓ ${countMsg}`);

  // Final verdict
  console.log('\n--- Result ---');
  if (!hasErrors) {
    console.log('✓ All checks passed!');
  } else {
    console.log('✗ Problems found (see above)');
    process.exit(1);
  }
}

main();

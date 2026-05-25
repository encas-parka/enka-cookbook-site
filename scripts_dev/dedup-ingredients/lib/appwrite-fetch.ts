import { execFileSync } from 'child_process';
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import type { RecipeDocument } from './types';

const DATABASE_ID = '689d15b10003a5a13636';
const COLLECTION_ID = 'recettes';
const APPWRITE_DIR = 'appwrite';
const PAGE_SIZE = 100;
const SEPARATOR = '---SEPARATOR---';

export function getDumpMtime(dumpPath: string): string | null {
  if (!existsSync(dumpPath)) return null;
  const mtime = statSync(dumpPath).mtime;
  return mtime.toISOString();
}

export function loadExistingDump(dumpPath: string): Map<string, RecipeDocument> {
  const map = new Map<string, RecipeDocument>();
  if (!existsSync(dumpPath)) return map;
  const content = readFileSync(dumpPath, 'utf-8');
  const entries = content.split(SEPARATOR).filter((s) => s.trim());
  for (const entry of entries) {
    try {
      const doc = JSON.parse(entry.trim()) as RecipeDocument;
      if (doc.$id) map.set(doc.$id, doc);
    } catch {
      /* skip malformed */
    }
  }
  return map;
}

export function writeDump(dumpPath: string, docs: Map<string, RecipeDocument>): void {
  const values = Array.from(docs.values());
  const content = values.map((doc) => JSON.stringify(doc, null, 2)).join('\n' + SEPARATOR + '\n');
  writeFileSync(dumpPath, content, 'utf-8');
}

interface CliListResponse {
  total: number;
  documents: RecipeDocument[];
}

function runListDocuments(offset: number, sinceDate: string | null): CliListResponse {
  const args: string[] = [
    'appwrite',
    '-R',
    'databases',
    'list-documents',
    '--database-id',
    DATABASE_ID,
    '--collection-id',
    COLLECTION_ID,
    '--limit',
    String(PAGE_SIZE),
    '--offset',
    String(offset),
    '--total',
    'false',
  ];

  if (sinceDate) {
    args.push('--where', `$updatedAt>${sinceDate}`);
  }

  const result = execFileSync('appwrite', args.slice(1), {
    cwd: APPWRITE_DIR,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const lines = result.split('\n');
  const jsonStart = lines.findIndex((l) => l.trimStart().startsWith('{'));
  if (jsonStart === -1) {
    throw new Error('No JSON found in CLI output');
  }
  const jsonStr = lines.slice(jsonStart).join('\n');
  return JSON.parse(jsonStr) as CliListResponse;
}

export async function fetchRecipes(
  sinceDate: string | null,
  dumpPath: string,
): Promise<{ fetched: number; total: number }> {
  const existing = loadExistingDump(dumpPath);
  let fetched = 0;
  let offset = 0;

  while (true) {
    console.log(`  Fetching offset=${offset}...`);
    const response = runListDocuments(offset, sinceDate);
    const docs = response.documents;

    if (docs.length === 0) break;

    for (const doc of docs) {
      existing.set(doc.$id, doc);
    }
    fetched += docs.length;

    if (docs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  writeDump(dumpPath, existing);
  return { fetched, total: existing.size };
}

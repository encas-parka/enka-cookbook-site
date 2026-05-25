#!/usr/bin/env bun
import { getDumpMtime, loadExistingDump, fetchRecipes } from './lib/appwrite-fetch';

const DEFAULT_DUMP_PATH = '.agents/CR/all-recipes-full.jsonl';

async function main() {
  const dumpPath = process.argv[2] || DEFAULT_DUMP_PATH;

  const mtime = getDumpMtime(dumpPath);
  const existing = loadExistingDump(dumpPath);

  if (mtime) {
    console.log(`Existing dump: ${existing.size} documents, last modified ${mtime}`);
    console.log(`Fetching documents updated since ${mtime}...`);
  } else {
    console.log('No existing dump found. Fetching all documents...');
  }

  const { fetched, total } = await fetchRecipes(mtime, dumpPath);

  const added = total - existing.size;
  console.log(`Done. Fetched: ${fetched}, Total: ${total} documents (+${added} new, ~${fetched - added} updated)`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface WinnerInfo {
  uuid: string;
  name: string;
}

export interface IngredientChange {
  loserName: string;
  loserUUID: string;
  winnerName: string;
  winnerUUID: string;
}

export interface IngredientRef {
  uuid: string;
  name: string;
}

export interface HugoProcessResult {
  recipeTitle: string;
  changes: IngredientChange[];
  newContent: string;
}

export function findRecipeFiles(rootDir: string = '.'): string[] {
  const recipeDir = join(rootDir, 'content', 'recipe');
  if (!existsSync(recipeDir)) return [];
  const entries = readdirSync(recipeDir, { withFileTypes: true });
  return entries
    .filter((d) => d.isDirectory())
    .map((d) => join(recipeDir, d.name, 'index.md'))
    .filter((f) => existsSync(f));
}

function formatYamlValue(value: string): string {
  if (/^[a-zA-ZÀ-ÿ0-9\s''.-]+$/.test(value) && !/^\d/.test(value) && !/\s$/.test(value) && value.length > 0) {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function extractYamlValue(raw: string): string {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function processHugoContent(
  content: string,
  loserToWinner: Map<string, WinnerInfo>,
): HugoProcessResult | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2];

  const lines = frontmatter.split(/\r?\n/);
  const changes: IngredientChange[] = [];
  let recipeTitle = '';
  let pendingWinner: WinnerInfo | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const titleMatch = line.match(/^title:\s*(.+)$/);
    if (titleMatch) {
      recipeTitle = extractYamlValue(titleMatch[1]);
    }

    const uuidMatch = line.match(/^(\s+-\s+uuid:\s*)(.+)$/);
    if (uuidMatch) {
      const uuid = extractYamlValue(uuidMatch[2]);
      const winner = loserToWinner.get(uuid);
      if (winner) {
        lines[i] = uuidMatch[1] + winner.uuid;
        pendingWinner = winner;
        changes.push({
          loserUUID: uuid,
          loserName: '',
          winnerUUID: winner.uuid,
          winnerName: winner.name,
        });
      } else {
        pendingWinner = null;
      }
      continue;
    }

    const nameMatch = line.match(/^(\s+name:\s*)(.+)$/);
    if (nameMatch && pendingWinner) {
      const oldName = extractYamlValue(nameMatch[2]);
      lines[i] = nameMatch[1] + formatYamlValue(pendingWinner.name);
      if (changes.length > 0) {
        changes[changes.length - 1].loserName = oldName;
      }
      pendingWinner = null;
    }
  }

  if (changes.length === 0) return null;

  const newFrontmatter = lines.join('\n');
  const newContent = `---\n${newFrontmatter}\n---\n${body}`;

  return { recipeTitle, changes, newContent };
}

export function extractHugoIngredients(content: string): { title: string; ingredients: IngredientRef[] } {
  const result: { title: string; ingredients: IngredientRef[] } = { title: '', ingredients: [] };

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return result;

  const lines = match[1].split(/\r?\n/);
  let currentUUID: string | null = null;

  for (const line of lines) {
    const titleMatch = line.match(/^title:\s*(.+)$/);
    if (titleMatch) {
      result.title = extractYamlValue(titleMatch[1]);
    }

    const uuidMatch = line.match(/^\s+-\s+uuid:\s*(.+)$/);
    if (uuidMatch) {
      currentUUID = extractYamlValue(uuidMatch[1]);
    }

    const nameMatch = line.match(/^\s+name:\s*(.+)$/);
    if (nameMatch && currentUUID !== null) {
      result.ingredients.push({
        uuid: currentUUID,
        name: extractYamlValue(nameMatch[1]),
      });
      currentUUID = null;
    }
  }

  return result;
}

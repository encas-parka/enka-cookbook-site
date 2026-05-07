/**
 * 2-transform-data.ts — Transform Appwrite JSON → PB-ready JSON
 *
 * Reads:  scripts_dev/appwrite-export/*.json
 * Writes: scripts_dev/pb-import/*.json + scripts_dev/migration-map.json
 *
 * Key principles:
 *   - refId format: aw_${appwriteId} (deterministic, globally unique)
 *   - Relation fields contain refIds (resolved during import)
 *   - JSON fields preserve Appwrite format (app handles both)
 *   - Validation report with warnings/errors
 *
 * Usage:
 *   bun run scripts_dev/2-transform-data.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

// --- Config ---
const EXPORT_DIR = join(import.meta.dir, "appwrite-export");
const IMPORT_DIR = join(import.meta.dir, "pb-import");
const MAP_FILE = join(import.meta.dir, "migration-map.json");

// --- Types ---
type UserMap = Record<string, { refId: string; email: string; name: string; eventLabels: string[] }>;
type TeamMap = Record<string, { refId: string; name: string }>;
type EventMap = Record<string, { refId: string; name: string }>;
type GenericMap = Record<string, { refId: string; [k: string]: any }>;

// --- Helpers ---
const warnings: string[] = [];
const errors: string[] = [];
const orphanTracker = new Map<string, { products: number; purchases: number; event_materiel: number }>();

function trackOrphan(eventId: string, collection: "products" | "purchases" | "event_materiel") {
  if (!orphanTracker.has(eventId)) {
    orphanTracker.set(eventId, { products: 0, purchases: 0, event_materiel: 0 });
  }
  orphanTracker.get(eventId)![collection]++;
}

function warn(msg: string) {
  warnings.push(msg);
  console.log(`   ⚠️  ${msg}`);
}

function error(msg: string) {
  errors.push(msg);
  console.log(`   ❌ ${msg}`);
}

function loadExport(name: string): any {
  const path = join(EXPORT_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`Export file not found: ${path}. Run 1-export-appwrite.ts first.`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveImport(name: string, records: any[]): void {
  writeFileSync(join(IMPORT_DIR, `${name}.json`), JSON.stringify(records, null, 2) + "\n");
}

function generatePassword(): string {
  return randomBytes(32).toString("hex");
}

/** Extract event IDs from Appwrite labels (20-char hex strings, excluding "owner", "admin") */
function filterEventLabels(labels: string[]): string[] {
  return (labels || []).filter((l: string) => l.length === 20 && /^[0-9a-f]{20}$/.test(l));
}

/** Parse string-encoded JSON array items into actual objects.
 *  Appwrite stores JSON fields as arrays of strings like ["{\"id\":\"x\"}", ...].
 *  PB expects actual objects: [{"id":"x"}, ...].
 *  Returns parsed objects with refId remapping applied. */
function remapContributors(contributors: string[], userMap: UserMap): any[] {
  return (contributors || []).map((cStr) => {
    try {
      const c = typeof cStr === "string" ? JSON.parse(cStr) : cStr;
      if (c.id && userMap[c.id]) c.id = userMap[c.id].refId;
      return c; // Return object, not string!
    } catch {
      return cStr;
    }
  });
}

/** Parse todos strings → objects, remap assignedTo user IDs */
function remapTodos(todos: string[], userMap: UserMap): any[] {
  return (todos || []).map((tStr) => {
    try {
      const t = typeof tStr === "string" ? JSON.parse(tStr) : tStr;
      if (t.assignedTo && Array.isArray(t.assignedTo)) {
        t.assignedTo = t.assignedTo.map((uid: string) => userMap[uid]?.refId || null).filter(Boolean);
      }
      return t; // Return object, not string!
    } catch {
      return tStr;
    }
  });
}

/** Parse string-encoded JSON array items into actual objects */
function parseJsonArray(items: any[]): any[] {
  return (items || []).map((item) => {
    if (typeof item === "string") {
      try { return JSON.parse(item); } catch { return item; }
    }
    return item;
  });
}

/** Resolve a relation — returns refId or null */
function resolveRelation(
  appwriteId: string | null | undefined,
  map: Record<string, { refId: string }>,
  fieldName: string,
  required: boolean,
  context: string
): string | null {
  if (!appwriteId) return null;
  const mapped = map[appwriteId];
  if (!mapped) {
    const msg = `${context}: ${fieldName}="${appwriteId}" not found in mapping`;
    if (required) error(msg);
    else warn(msg);
    return null;
  }
  return mapped.refId;
}

/** Find user by email */
function findUserByEmail(email: string | null | undefined, userMap: UserMap): string | null {
  if (!email || typeof email !== "string") return null;
  for (const u of Object.values(userMap)) {
    if (u.email === email) return u.refId;
  }
  return null;
}

// --- Main ---

function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔄 2-transform-data.ts — Transform Appwrite → PB-ready JSON`);
  console.log(`${"=".repeat(60)}\n`);

  mkdirSync(IMPORT_DIR, { recursive: true });

   const migrationMap: {
    _meta: { createdAt: string; source: string };
    users: UserMap;
    teams: TeamMap;
    events: EventMap;
    products: GenericMap;
    purchases: GenericMap;
    materiel: GenericMap;
    event_materiel: GenericMap;
    materiel_loan: GenericMap;
    teamdocs: GenericMap;
    event_todos: GenericMap;
    share_links: GenericMap;
    // NOTE: locks are NOT migrated — users will be disconnected post-migration anyway
  } = {
    _meta: { createdAt: new Date().toISOString(), source: "unknown" },
    users: {},
    teams: {},
    events: {},
    products: {},
    purchases: {},
    materiel: {},
    event_materiel: {},
    materiel_loan: {},
    teamdocs: {},
    event_todos: {},
    share_links: {},
  };

  // NOTE: recipes are NOT transformed here — use migrate-recipes.ts (Hugo markdown source)

  // Load all exports
  const usersExport = loadExport("users");
  const teamsExport = loadExport("teams");
  const eventsExport = loadExport("events");
  const productsExport = loadExport("products");
  const purchasesExport = loadExport("purchases");
  const materielExport = loadExport("materiel");
  const eventMaterielExport = loadExport("event_materiel");
  const materielLoanExport = loadExport("materiel_loan");
  const teamdocsExport = loadExport("teamdocs");
  const eventTodosExport = loadExport("event_todos");
  const shareLinksExport = loadExport("share_links");
  // NOTE: locks export is intentionally NOT loaded — not migrated

  // Set source from export metadata
  if (usersExport._meta?.source) migrationMap._meta.source = usersExport._meta.source;

  // =========================================================================
  // 1. USERS
  // =========================================================================
  console.log("🔄 Transforming users...");
  const pbUsers: any[] = [];

  for (const awUser of usersExport.users) {
    const appwriteId = awUser.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awUser.$createdAt || null;
    const updated = awUser.$updatedAt || null;

    const email = awUser.email;
    const name = awUser.name || email.split("@")[0];
    const verified = awUser.emailVerification || false;
    const eventLabels = filterEventLabels(awUser.labels || []);
    const password = generatePassword();

    migrationMap.users[appwriteId] = { refId, email, name, eventLabels };

    pbUsers.push({
      email,
      name,
      password,
      passwordConfirm: password,
      verified,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("users", pbUsers);
  console.log(`   ✅ ${pbUsers.length} users transformed\n`);

  const userMap = migrationMap.users;

  // =========================================================================
  // 2. TEAMS (native + orphan)
  // =========================================================================
  console.log("🔄 Transforming teams...");
  const pbTeams: any[] = [];

  // Native teams
  for (const team of teamsExport.teams) {
    const appwriteId = team.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = team.$createdAt || null;
    const updated = team.$updatedAt || null;

    const members: string[] = [];

    for (const m of team._memberships || []) {
      if (userMap[m.userId]) {
        members.push(userMap[m.userId].refId);
      } else {
        warn(`Team "${team.name}": member userId="${m.userId}" not found in user map`);
      }
    }

    migrationMap.teams[appwriteId] = { refId, name: team.name };
    pbTeams.push({
      name: team.name,
      members: members.length > 0 ? members : null,
      created, // Mappé depuis $createdAt
      updated, // Mappé depuis $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }

  // Detect orphan teams from events
  const knownTeamIds = new Set(teamsExport.teams.map((t: any) => t.$id));
  const orphanTeamIds = new Set<string>();

  for (const event of eventsExport.rows) {
    for (const tid of event.teamsId || []) {
      if (!knownTeamIds.has(tid)) orphanTeamIds.add(tid);
    }
  }

  // Resolve orphan names
  const orphanNames: Record<string, string> = {};
  for (const event of eventsExport.rows) {
    const teamsId: string[] = event.teamsId || [];
    const teams: string[] = event.teams || [];
    if (teamsId.length === teams.length) {
      for (let i = 0; i < teamsId.length; i++) {
        if (orphanTeamIds.has(teamsId[i]) && !orphanNames[teamsId[i]]) {
          orphanNames[teamsId[i]] = teams[i];
        }
      }
    }
  }
  // Also check teamdocs
  for (const doc of teamdocsExport.rows) {
    if (doc.teamId && orphanTeamIds.has(doc.teamId) && !orphanNames[doc.teamId] && doc.teamName) {
      orphanNames[doc.teamId] = doc.teamName;
    }
  }

  let orphanCount = 0;
   for (const tid of orphanTeamIds) {
    const name = orphanNames[tid] || `orphan_${tid.slice(0, 8)}`;
    const refId = `aw_${tid}`;
    // Orphan teams: no $createdAt/$updatedAt from Appwrite
    const created = null;
    const updated = null;

    migrationMap.teams[tid] = { refId, name };
    pbTeams.push({
      name,
      members: null,
      created, // Pas de donnée Appwrite pour les orphans
      updated, // Pas de donnée Appwrite pour les orphans
      _refId: refId,
      _appwriteId: tid,
      _orphan: true,
    });
    orphanCount++;
  }

  saveImport("teams", pbTeams);
  const nativeCount = teamsExport.teams.length;
  console.log(`   ✅ ${pbTeams.length} teams (${nativeCount} native + ${orphanCount} orphan)\n`);

  const teamMap = migrationMap.teams;

  // =========================================================================
  // 3. MATERIEL (before events — needed for event_materiel refs)
  // =========================================================================
  console.log("🔄 Transforming materiel...");
  const pbMateriel: any[] = [];
  let matSkipped = 0;

  for (const awMat of materielExport.rows) {
    const appwriteId = awMat.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awMat.$createdAt || null;
    const updated = awMat.$updatedAt || null;

    // Parse owner JSON → extract teamId + ownerUser
    let ownerRaw: any = awMat.owner || null;
    let ownerUser: string | null = null;
    let teamId: string | null = null;

    try {
      const owner = typeof ownerRaw === "string" ? JSON.parse(ownerRaw) : ownerRaw;
      if (owner?.teamId) {
        teamId = resolveRelation(owner.teamId, teamMap, "teamId", false, `Materiel "${awMat.name}"`);
      }
      if (owner?.userId) {
        ownerUser = resolveRelation(owner.userId, userMap, "ownerUser", false, `Materiel "${awMat.name}"`);
      }
    } catch {
      warn(`Materiel "${awMat.name}": owner JSON parse failed`);
    }

    // shareableWith → remap team IDs
    const shareableWith = (awMat.shareableWith || [])
      .map((tid: string) => resolveRelation(tid, teamMap, "shareableWith", false, `Materiel "${awMat.name}"`))
      .filter(Boolean);

    // storeIn → self-ref (remap materiel ID)
    const storeIn = resolveRelation(awMat.storeIn, migrationMap.materiel, "storeIn", false, `Materiel "${awMat.name}"`);

    migrationMap.materiel[appwriteId] = { refId, name: awMat.name };

    pbMateriel.push({
      name: awMat.name,
      type: awMat.type || null,
      description: awMat.description || null,
      ownerUser,
      teamId,
      status: awMat.status || "ok",
      deleted: awMat.deleted || false,
      createdBy: null, // Not in Appwrite
      quantity: awMat.quantity ?? null,
      location: awMat.location || null,
      shareableWith: shareableWith.length > 0 ? shareableWith : null,
      storeIn,
      isStorage: awMat.isStorage || false,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("materiel", pbMateriel);
  console.log(`   ✅ ${pbMateriel.length} materiel items transformed${matSkipped ? `, ${matSkipped} skipped` : ""}\n`);

  const materielMap = migrationMap.materiel;

  // =========================================================================
  // 4. EVENTS
  // =========================================================================
  console.log("🔄 Transforming events...");
  const pbEvents: any[] = [];
  const pbEventTodos: any[] = [];
  let eventLabelsExtracted = 0;

  // Build guestEmails lookup: eventId → user emails
  const guestEmailsLookup = new Map<string, string[]>();
  let orphanLabelCount = 0;
  const orphanLabelEventIds = new Set<string>();
  for (const [_awId, userData] of Object.entries(userMap)) {
    for (const eventId of userData.eventLabels) {
      if (!guestEmailsLookup.has(eventId)) guestEmailsLookup.set(eventId, []);
      guestEmailsLookup.get(eventId)!.push(userData.email);
      // Track orphan labels (eventIds that don't correspond to any exported event)
      if (!eventsExport.rows.some((e: any) => e.$id === eventId)) {
        orphanLabelEventIds.add(eventId);
        orphanLabelCount++;
      }
    }
  }
  if (orphanLabelEventIds.size > 0) {
    warn(`Orphan labels: ${orphanLabelCount} user labels reference ${orphanLabelEventIds.size} deleted events: ${[...orphanLabelEventIds].slice(0, 5).join(", ")}${orphanLabelEventIds.size > 5 ? " ..." : ""}`);
    warn(`  These labels will be ignored — guestEmails only populated for existing events`);
  }

  for (const awEvent of eventsExport.rows) {
    const appwriteId = awEvent.$id;
    const refId = `aw_${appwriteId}`;
    const guestEmails = guestEmailsLookup.get(appwriteId) || [];
    if (guestEmails.length > 0) eventLabelsExtracted++;

    // Map $createdAt → created, $updatedAt → updated
    const created = awEvent.$createdAt || null;
    const updated = awEvent.$updatedAt || null;

    // teamsId → PB team refIds
    const pbTeamIds = (awEvent.teamsId || [])
      .map((tid: string) => resolveRelation(tid, teamMap, "teamsId", false, `Event "${awEvent.name}"`))
      .filter(Boolean);

    // createdBy
    const createdBy = resolveRelation(awEvent.createdBy, userMap, "createdBy", false, `Event "${awEvent.name}"`);

    // contributors (remap user IDs inside JSON strings)
    const contributors = remapContributors(awEvent.contributors || [], userMap);

    // todos (remap user IDs inside JSON strings, keep embedded in event)
    const remappedTodos = remapTodos(awEvent.todos || [], userMap);

    // Build guestUsers: match guestEmails → known registered users
    // guestEmails stays for invitation tracking (emails of non-registered users)
    // guestUsers is a relation field resolved during import (IDs only, safe with ~ operator)
    const guestUsers = guestEmails
      .map(email => findUserByEmail(email, userMap))
      .filter((id): id is string => id !== null);

    migrationMap.events[appwriteId] = { refId, name: awEvent.name };

    pbEvents.push({
      name: awEvent.name,
      status: awEvent.status || "proposition",
      dateStart: awEvent.dateStart || null,
      dateEnd: awEvent.dateEnd || null,
      location: awEvent.location || null,
      createdBy,
      teams: pbTeamIds.length > 0 ? pbTeamIds : null,
      guestEmails: guestEmails.length > 0 ? guestEmails : null,
      guestUsers: guestUsers.length > 0 ? guestUsers : null,
      contributors: contributors.length > 0 ? contributors : null,
      meals: awEvent.meals ? parseJsonArray(awEvent.meals) : null,
      date: awEvent.allDates || null,
      todos: remappedTodos.length > 0 ? remappedTodos : null,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });

    // Extract embedded todos → event_todos records
    for (const tStr of awEvent.todos || []) {
      try {
        const t = JSON.parse(tStr);
        let assignedTo: string | null = null;
        if (t.assignedTo && Array.isArray(t.assignedTo)) {
          for (const uid of t.assignedTo) {
            const mapped = userMap[uid]?.refId;
            if (mapped) { assignedTo = mapped; break; }
          }
        }

        const todoRefId = `aw_todo_emb_${appwriteId}_${pbEventTodos.length}`;
        migrationMap.event_todos[`emb_${appwriteId}_${pbEventTodos.length}`] = { refId: todoRefId, task: t.taskName };

        pbEventTodos.push({
          eventId: refId,
          task: t.taskName || "Untitled",
          taskDescription: t.taskDescription || null,
          priority: t.priority || "medium",
          status: t.status || "todo",
          assignedTo,
          requiredPeopleNb: t.requiredPeopleNb || null,
          dueDate: t.dueDate || null,
          taskOn: null,
          locked: false,
          _refId: todoRefId,
          _source: "embedded",
          _sourceEvent: awEvent.name,
        });
      } catch {
        // Skip malformed todo
      }
    }
  }

  saveImport("events", pbEvents);
  console.log(`   ✅ ${pbEvents.length} events, guestEmails peuplés pour ${eventLabelsExtracted}/${pbEvents.length}\n`);

  const eventMap = migrationMap.events;

  // =========================================================================
  // 5. PRODUCTS
  // =========================================================================
  console.log("🔄 Transforming products...");
  const pbProducts: any[] = [];
  let prodSkipped = 0;

  for (const awProd of productsExport.rows) {
    const appwriteId = awProd.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awProd.$createdAt || null;
    const updated = awProd.$updatedAt || null;

    if (!eventMap[awProd.mainId]) {
      trackOrphan(awProd.mainId, "products");
      prodSkipped++;
      continue;
    }
    const eventId = eventMap[awProd.mainId].refId;

    // updatedBy: email → user refId (Appwrite stores names sometimes, not emails — skip those)
    const updatedBy = findUserByEmail(awProd.updatedBy, userMap);
    if (awProd.updatedBy && !updatedBy && awProd.updatedBy.includes("@")) {
      warn(`Product "${awProd.productName}": updatedBy email "${awProd.updatedBy}" not found in user map`);
    }

    // mergedInto: product ID → self-ref (will be resolved later)
    // For now, store as null — it's a rare case
    const mergedInto = resolveRelation(awProd.mergedInto, migrationMap.products, "mergedInto", false, `Product "${awProd.productName}"`);

    migrationMap.products[appwriteId] = { refId, productName: awProd.productName };

    pbProducts.push({
      eventId,
      ingredientRef: awProd.ingredientRef || null,
      productName: awProd.productName || null,
      productType: awProd.productType || null,
      pF: awProd.pF || false,
      pS: awProd.pS || false,
      store: awProd.store || null,
      specs: awProd.specs || null,
      status: awProd.status || null,
      deleted: awProd.deleted || false,
      stockReel: awProd.stockReel || null,
      who: awProd.who || null,
      previousNames: awProd.previousNames || null,
      isMerged: awProd.isMerged || false,
      mergedFrom: awProd.mergedFrom || null,
      mergeDate: awProd.mergeDate || null,
      mergeReason: awProd.mergeReason || null,
      mergedInto,
      isSynced: awProd.isSynced || false,
      totalNeededOverride: awProd.totalNeededOverride || null,
      updatedBy,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("products", pbProducts);
  console.log(`   ✅ ${pbProducts.length} products transformed${prodSkipped ? `, ${prodSkipped} skipped (missing eventId)` : ""}\n`);

  const productMap = migrationMap.products;

  // =========================================================================
  // 6. PURCHASES
  // =========================================================================
  console.log("🔄 Transforming purchases...");
  const pbPurchases: any[] = [];
  let purchSkipped = 0;

  for (const awPurch of purchasesExport.rows) {
    const appwriteId = awPurch.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awPurch.$createdAt || null;
    const updated = awPurch.$updatedAt || null;

    if (!eventMap[awPurch.mainId]) {
      trackOrphan(awPurch.mainId, "purchases");
      purchSkipped++;
      continue;
    }
    const eventId = eventMap[awPurch.mainId].refId;

    const createdBy = resolveRelation(awPurch.createdBy, userMap, "createdBy", false, `Purchase ${appwriteId}`);

    // products: array of Appwrite product $id → refIds
    const products = (awPurch.products || [])
      .map((pid: string) => {
        const resolved = resolveRelation(pid, productMap, "products", false, `Purchase ${appwriteId}`);
        return resolved;
      })
      .filter(Boolean);

    migrationMap.purchases[appwriteId] = { refId };

    pbPurchases.push({
      eventId,
      unit: awPurch.unit || "",
      quantity: awPurch.quantity ?? 0,
      notes: awPurch.notes || null,
      price: awPurch.price ?? null,
      who: awPurch.who || null,
      createdBy,
      created, // Mappé depuis $createdAt
      updated, // Mappé depuis $updatedAt
      orderDate: awPurch.orderDate || null,
      deliveryDate: awPurch.deliveryDate || null,
      invoiceId: awPurch.invoiceId || null,
      invoiceTotal: awPurch.invoiceTotal ?? null,
      products: products.length > 0 ? products : null,
      status: awPurch.status || null,
      store: awPurch.store || null,
      deleted: awPurch.deleted || false,
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("purchases", pbPurchases);
  console.log(`   ✅ ${pbPurchases.length} purchases transformed${purchSkipped ? `, ${purchSkipped} skipped` : ""}\n`);

  // =========================================================================
  // 7. MATERIEL LOAN (before event_materiel — needed for loanId refs)
  // =========================================================================
  console.log("🔄 Transforming materiel_loan...");
  const pbMaterielLoans: any[] = [];

  for (const awLoan of materielLoanExport.rows) {
    const appwriteId = awLoan.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awLoan.$createdAt || null;
    const updated = awLoan.$updatedAt || null;

    // ownerId = team ID (NOT user ID!)
    const ownerId = resolveRelation(awLoan.ownerId, teamMap, "ownerId", false, `Loan ${appwriteId}`);
    const responsibleId = resolveRelation(awLoan.responsibleId, userMap, "responsibleId", false, `Loan ${appwriteId}`);
    const eventId = resolveRelation(awLoan.eventId, eventMap, "eventId", false, `Loan ${appwriteId}`);
    const createdBy = resolveRelation(awLoan.createdBy, userMap, "createdBy", false, `Loan ${appwriteId}`);

    // Remap materielIds inside materiels JSON — parse strings → objects
    let materiels = awLoan.materiels || null;
    if (Array.isArray(materiels)) {
      materiels = materiels.map((mStr: string) => {
        try {
          const m = typeof mStr === "string" ? JSON.parse(mStr) : mStr;
          if (m.materielId && materielMap[m.materielId]) {
            m.materielId = materielMap[m.materielId].refId;
          }
          return m; // Return object, not string!
        } catch {
          return mStr;
        }
      });
    }

    migrationMap.materiel_loan[appwriteId] = { refId };

    pbMaterielLoans.push({
      borrowerUser: null,
      eventId,
      startDate: awLoan.startDate || null,
      endDate: awLoan.endDate || null,
      status: awLoan.status || "asked",
      createdBy,
      responsibleId,
      responsibleName: awLoan.responsibleName || null,
      ownerId,
      ownerName: awLoan.ownerName || null,
      materiels,
      notes: awLoan.notes || null,
      completedAt: awLoan.completedAt || null,
      returnedAt: awLoan.returnedAt || null,
      returnNotes: awLoan.returnNotes || null,
      eventName: awLoan.eventName || null,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("materiel_loan", pbMaterielLoans);
  console.log(`   ✅ ${pbMaterielLoans.length} loans transformed\n`);

  // =========================================================================
  // 8. EVENT MATERIEL (after materiel_loan — needs loanId refs)
  // =========================================================================
  console.log("🔄 Transforming event_materiel...");
  const pbEventMateriel: any[] = [];
  let emSkipped = 0;

  for (const awEm of eventMaterielExport.rows) {
    const appwriteId = awEm.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awEm.$createdAt || null;
    const updated = awEm.$updatedAt || null;

    if (!eventMap[awEm.eventId]) {
      trackOrphan(awEm.eventId, "event_materiel");
      emSkipped++;
      continue;
    }
    const eventId = eventMap[awEm.eventId].refId;
    const sourceMaterielId = resolveRelation(awEm.sourceMaterielId, materielMap, "sourceMaterielId", false, `EventMateriel ${appwriteId}`);
    const createdBy = resolveRelation(awEm.createdBy, userMap, "createdBy", false, `EventMateriel ${appwriteId}`);
    const loanId = resolveRelation(awEm.loanId, migrationMap.materiel_loan, "loanId", false, `EventMateriel ${appwriteId}`);

    // Map status: needed → to_find
    let status = awEm.status || null;
    if (status === "needed") status = "to_find";

    migrationMap.event_materiel[appwriteId] = { refId };

    pbEventMateriel.push({
      eventId,
      type: awEm.type || null,
      status,
      groupId: awEm.groupId || null,
      specs: awEm.specs || null,
      deleted: awEm.deleted || false,
      name: awEm.name || null,
      quantity: awEm.quantity ?? null,
      who: awEm.who || null,
      where: awEm.where || null,
      sourceMaterielId,
      loanId,
      notes: awEm.notes || null,
      createdBy,
      fromTeamName: awEm.fromTeamName || null,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  // --- Topological sort: headers (groupId=null) before allocations ---
  const emHeaders = pbEventMateriel.filter((r) => !r.groupId || r.groupId === "");
  const emAllocations = pbEventMateriel.filter((r) => r.groupId && r.groupId !== "");

  const emKnownAppwriteIds = new Set(pbEventMateriel.map((r) => r._appwriteId));
  let emOrphans = 0;
  for (const alloc of emAllocations) {
    if (!emKnownAppwriteIds.has(alloc.groupId)) {
      warn(`EventMateriel allocation "${alloc.name}" (${alloc._appwriteId}): groupId="${alloc.groupId}" not found in data → cleared`);
      alloc.groupId = null;
      emOrphans++;
    }
  }

  // Re-split after orphan cleanup (some allocations became headers)
  const emFinalHeaders = pbEventMateriel.filter((r) => !r.groupId || r.groupId === "");
  const emFinalAllocations = pbEventMateriel.filter((r) => r.groupId && r.groupId !== "");
  const pbEventMaterielSorted = [...emFinalHeaders, ...emFinalAllocations];

  saveImport("event_materiel", pbEventMaterielSorted);
  console.log(
    `   ✅ ${pbEventMaterielSorted.length} event_materiel transformed (${emFinalHeaders.length} headers, ${emFinalAllocations.length} allocations)${emSkipped ? `, ${emSkipped} skipped (orphan eventId)` : ""}${emOrphans ? `, ${emOrphans} orphan groupIds cleared` : ""}\n`,
  );

  // =========================================================================
  // 9. TEAMDOCS
  // =========================================================================
  console.log("🔄 Transforming teamdocs...");
  const pbTeamdocs: any[] = [];

  for (const awDoc of teamdocsExport.rows) {
    const appwriteId = awDoc.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awDoc.$createdAt || null;
    const updated = awDoc.$updatedAt || null;

    const teamId = resolveRelation(awDoc.teamId, teamMap, "teamId", false, `Teamdoc "${awDoc.title}"`);
    const eventId = resolveRelation(awDoc.eventId, eventMap, "eventId", false, `Teamdoc "${awDoc.title}"`);

    migrationMap.teamdocs[appwriteId] = { refId };

    pbTeamdocs.push({
      title: awDoc.title || null,
      content: awDoc.content || null,
      teamId,
      eventId,
      status: awDoc.status || "draft",
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("teamdocs", pbTeamdocs);
  console.log(`   ✅ ${pbTeamdocs.length} teamdocs transformed\n`);

  // =========================================================================
  // 10. EVENT_TODOS (standalone — embedded already extracted from events)
  // =========================================================================
  console.log("🔄 Transforming standalone event_todos...");
  const standaloneTodoCount = pbEventTodos.length;
  let todosSkipped = 0;

  for (const todo of eventTodosExport.rows) {
    const appwriteId = todo.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = todo.$createdAt || null;
    const updated = todo.$updatedAt || null;

    const eventId = resolveRelation(todo.eventId, eventMap, "eventId", false, `EventTodo ${appwriteId}`);
    if (!eventId) {
      todosSkipped++;
      warn(`EventTodo "${todo.taskName}" (${appwriteId}): eventId="${todo.eventId}" orphan → skip`);
      continue;
    }
    let assignedTo: string | null = null;
    if (todo.assignedTo && Array.isArray(todo.assignedTo)) {
      for (const uid of todo.assignedTo) {
        const mapped = userMap[uid]?.refId;
        if (mapped) { assignedTo = mapped; break; }
      }
    }

    migrationMap.event_todos[appwriteId] = { refId, task: todo.taskName };

    pbEventTodos.push({
      eventId,
      task: todo.taskName || "Untitled",
      taskDescription: todo.taskDescription || null,
      priority: todo.priority || "medium",
      status: todo.status || "todo",
      assignedTo,
      requiredPeopleNb: todo.requiredPeopleNb || null,
      dueDate: todo.dueDate || null,
      taskOn: todo.taskOn || null,
      locked: todo.locked || false,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _source: "standalone",
    });
  }

  saveImport("event_todos", pbEventTodos);
  console.log(`   ✅ ${pbEventTodos.length} event_todos total (${standaloneTodoCount} embedded + ${pbEventTodos.length - standaloneTodoCount} standalone)${todosSkipped ? `, ${todosSkipped} skipped (orphan eventId)` : ""}\n`);

  // =========================================================================
  // 11. SHARE LINKS
  // =========================================================================
  console.log("🔄 Transforming share_links...");
  const pbShareLinks: any[] = [];

  for (const awLink of shareLinksExport.rows) {
    const appwriteId = awLink.$id;
    const refId = `aw_${appwriteId}`;

    // Map $createdAt → created, $updatedAt → updated
    const created = awLink.$createdAt || null;
    const updated = awLink.$updatedAt || null;

    // target_id: event ID → remap to event refId (stored as text field)
    const targetId = resolveRelation(awLink.target_id, eventMap, "target_id", false, `ShareLink ${appwriteId}`);

    migrationMap.share_links[appwriteId] = { refId };

    pbShareLinks.push({
      target_id: targetId || awLink.target_id || null,
      link_type: awLink.link_type || "event",
      isActive: awLink.isActive ?? true,
      token: awLink.token || null,
      access_level: awLink.access_level || null,
      expiresAt: awLink.expiresAt || null,
      maxUses: awLink.maxUses ?? null,
      useCount: awLink.useCount ?? null,
      created, // Mapped from $createdAt
      updated, // Mapped from $updatedAt
      _refId: refId,
      _appwriteId: appwriteId,
    });
  }
  saveImport("share_links", pbShareLinks);
  console.log(`   ✅ ${pbShareLinks.length} share_links transformed\n`);

   // =========================================================================
   // 12. LOCKS — SKIPPED (not migrated)
   // =========================================================================
   // Locks are intentionally NOT migrated. Users will be disconnected post-migration
   // (new passwords required). Any locks would be stale anyway.
   console.log("⏭️  Skipping locks (not migrated — users will reconnect post-migration)\n");

   // =========================================================================
   // Save migration map
   // =========================================================================
  writeFileSync(MAP_FILE, JSON.stringify(migrationMap, null, 2) + "\n");

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`${"=".repeat(60)}`);
  console.log(`📊 Transform Report\n`);

  const summaries: [string, number, string][] = [
    ["users", pbUsers.length, `${Object.keys(userMap).length} eventLabels extracted`],
    ["teams", pbTeams.length, `${nativeCount} native + ${orphanCount} orphan`],
    ["materiel", pbMateriel.length, ""],
    ["events", pbEvents.length, `guestEmails: ${eventLabelsExtracted}/${pbEvents.length}${orphanLabelEventIds.size > 0 ? `, ${orphanLabelEventIds.size} orphan labels ignored` : ""}`],
    ["products", pbProducts.length, prodSkipped ? `${prodSkipped} skipped (orphan eventId)` : ""],
    ["purchases", pbPurchases.length, purchSkipped ? `${purchSkipped} skipped (orphan eventId)` : ""],
    ["materiel_loan", pbMaterielLoans.length, ""],
    ["event_materiel", pbEventMateriel.length, emSkipped ? `${emSkipped} skipped (orphan eventId)` : ""],
    ["teamdocs", pbTeamdocs.length, ""],
    ["event_todos", pbEventTodos.length, todosSkipped ? `${todosSkipped} standalone skipped (orphan eventId)` : ""],
    ["share_links", pbShareLinks.length, ""],
    ["locks", 0, "SKIPPED — not migrated"],
    ["recipes", 0, "SKIPPED — use migrate-recipes.ts (Hugo source)"],
  ];

  for (const [name, count, note] of summaries) {
    const label = (name + ":").padEnd(18);
    const num = String(count).padStart(5);
    const extra = note ? `  (${note})` : "";
    console.log(`   ${label} ${num} records${extra}`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 20)) console.log(`   - ${w}`);
    if (warnings.length > 20) console.log(`   ... and ${warnings.length - 20} more`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) console.log(`   - ${e}`);
    if (errors.length > 10) console.log(`   ... and ${errors.length - 10} more`);
  }

  if (orphanTracker.size > 0) {
    console.log(`\n📊 Orphan events (eventId not in mapping):`);
    let totalProducts = 0,
      totalPurchases = 0,
      totalEventMateriel = 0;
    const entries = [...orphanTracker.entries()];
    const showCount = Math.min(entries.length, 10);
    for (let i = 0; i < entries.length; i++) {
      const [eventId, counts] = entries[i];
      totalProducts += counts.products;
      totalPurchases += counts.purchases;
      totalEventMateriel += counts.event_materiel;
      if (i < showCount) {
        const parts: string[] = [];
        if (counts.products) parts.push(`${counts.products} products`);
        if (counts.purchases) parts.push(`${counts.purchases} purchases`);
        if (counts.event_materiel) parts.push(`${counts.event_materiel} event_materiel`);
        console.log(`   ${eventId} → ${parts.join(", ")} skipped`);
      }
    }
    if (entries.length > showCount) {
      console.log(`   ... ${entries.length - showCount} more events`);
    }
    const total = totalProducts + totalPurchases + totalEventMateriel;
    console.log(
      `Total: ${totalProducts} products, ${totalPurchases} purchases, ${totalEventMateriel} event_materiel skipped (${total} orphan records)`,
    );
  }

  console.log(`\n   Migration map: ${MAP_FILE}`);
  console.log(`   PB-ready files: ${IMPORT_DIR}/`);
  console.log(`\n   NEXT: Run 3-import-pb.ts to import into PocketBase`);
}

main();

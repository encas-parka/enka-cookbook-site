/**
 * Synthetic fixtures for the store integration tests.
 *
 * Deliberately contract-focused (not exported from a real app): the point
 * of the mig harness is to pin the PocketBase wire contract — `PbDoc`
 * system fields, PB datetime format `YYYY-MM-DD HH:mm:ss.SSSZ` (space, no
 * `T`) — since the delta-sync cursor is a LEXICAL comparison on those
 * strings. All dates below are fixed so tests are deterministic.
 */
import type { EnrichedEvent, EventTodo } from "$lib/types/events";
import type { RecipeIndexEntry } from "$lib/types/recipes.types";
import type {
  EnrichedNativeTeam,
  NativeTeamMember,
} from "$lib/types/aw_native_team.d";
import type {
  CategoriesRecord,
  IngredientsRecord,
  LocksRecord,
  RecipesStatusOptions,
  RecipesTypeROptions,
} from "$lib/types/pb-generated";
import type {
  Materiel,
  MaterielLoan,
  Products,
  Purchases,
  Teamdocs,
} from "$lib/types/pb";
import type { ProductNeedRow } from "$lib/db-sync/pb-sync";
import { pbDate } from "./stub-pb";

/** Fixed base instant — before every mutation date used in tests. */
export const T0 = new Date("2026-06-08T10:00:00.000Z");
/** Fixed later instant — remote mutations bump records to this. */
export const T1 = new Date("2026-06-08T11:30:00.000Z");

/** 15 chars, PB-id shaped. */
export const TEST_EVENT_ID = "t12event00000001";
export const TEST_TEAMDOC_ID = "t02teamdoc000001";
export const TEST_PRODUCT_ID = "eau_t12test0001";
export const TEST_PURCHASE_ID = "t12purchase0001";
export const TEST_TEAM_ID = "t12team00000001";
export const TEST_MATERIEL_ID = "t12mater0000001";
export const TEST_LOAN_ID = "t12loan00000001";
export const TEST_INGREDIENT_ID = "t12ingred000001";
export const TEST_CATEGORY_ID = "t12catego000001";
export const TEST_RECIPE_ID = "t12recipe000001";
export const TEST_LOCK_ID = "t12lock00000001";
export const TEST_USER_ID = "t12user00000001";
export const TEST_MEMBER_ID = "t12member000001";

/**
 * Business ref of the fixture ingredient — the join key between
 * `recipes.ingredients[].ref` / `products.ingredientRef` and the
 * ingredient catalogue (NOT the PB id, see `toAppIngredient`).
 */
export const TEST_INGREDIENT_REF = "t12ingref0001";

/** Service date used in byDate / dateDisplayInfo fixtures. */
export const TEST_DATE = "2026-12-19";

/** Minimal valid EnrichedEvent — no meals, so the store skips needs recalc. */
export function makeEvent(
  overrides: Partial<EnrichedEvent> = {},
): EnrichedEvent {
  return {
    id: TEST_EVENT_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    name: "T12 Harness Event",
    createdBy: null,
    date: null,
    dateStart: null,
    dateEnd: null,
    description: null,
    minContrib: null,
    teams: undefined,
    status: "confirmed",
    guestUsers: null,
    location: null,
    meals: [],
    contributors: [],
    todos: [],
    ...overrides,
  };
}

/** A PB "products" record (server-side shape — id/created/updated native). */
export function makeProductRecord(overrides: Partial<Products> = {}): Products {
  return {
    id: TEST_PRODUCT_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    eventId: TEST_EVENT_ID,
    ingredientRef: "eau",
    productName: "Eau",
    productType: "boissons",
    pF: false,
    pS: false,
    store: null,
    specs: null,
    status: "active",
    deleted: false,
    stockReel: null,
    who: null,
    previousNames: null,
    isMerged: false,
    mergedFrom: null,
    mergeDate: null,
    mergeReason: null,
    isSynced: true,
    mergedInto: null,
    totalNeededOverride: null,
    updatedBy: null,
    ...overrides,
  };
}

/** A PB "purchases" record linked to the fixture product. */
export function makePurchaseRecord(
  overrides: Partial<Purchases> = {},
): Purchases {
  return {
    id: TEST_PURCHASE_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    eventId: TEST_EVENT_ID,
    products: [TEST_PRODUCT_ID],
    quantity: 6,
    unit: "l.",
    store: null,
    status: "ordered",
    deleted: false,
    notes: null,
    price: null,
    who: null,
    createdBy: null,
    orderDate: null,
    deliveryDate: null,
    invoiceId: null,
    invoiceTotal: null,
    ...overrides,
  };
}

/** A PB "teamdocs" record (server-side shape — id/created/updated native). */
export function makeTeamdocsRecord(
  overrides: Partial<Teamdocs> = {},
): Teamdocs {
  return {
    id: TEST_TEAMDOC_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    title: "Doc test",
    content: null,
    status: "doc",
    teamId: null,
    eventId: TEST_EVENT_ID,
    tags: null,
    ...overrides,
  };
}

/** A PB "materiel" record owned by the fixture team. */
export function makeMaterielRecord(
  overrides: Partial<Materiel> = {},
): Materiel {
  return {
    id: TEST_MATERIEL_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    name: "Gastro 1/1",
    type: "other",
    description: null,
    ownerUser: null,
    teamId: TEST_TEAM_ID,
    deleted: false,
    createdBy: null,
    quantity: 5,
    location: null,
    shareableWith: null,
    isStorage: false,
    storeIn: null,
    ...overrides,
  };
}

/** A PB "materiel_loan" record overlapping the loans-test period. */
export function makeLoanRecord(
  overrides: Partial<MaterielLoan> = {},
): MaterielLoan {
  return {
    id: TEST_LOAN_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    borrowerUser: "otheruser123456",
    eventId: null,
    startDate: "2026-12-19",
    endDate: "2026-12-20",
    status: "accepted",
    createdBy: "otheruser123456",
    responsibleId: "otheruser123456",
    responsibleName: "other",
    ownerId: TEST_TEAM_ID,
    ownerName: "Team One",
    materiels: [
      { materielId: TEST_MATERIEL_ID, materielName: "Gastro 1/1", quantity: 3 },
    ],
    notes: null,
    completedAt: null,
    returnedAt: null,
    returnNotes: null,
    eventName: null,
    ...overrides,
  };
}

/**
 * The locally-calculated productNeed row matching the fixture product.
 * The store skips its meals→needs recalculation when needs already exist
 * for the event, so seeding this makes `initialize()` deterministic.
 */
export function makeNeedRow(
  overrides: Partial<ProductNeedRow> = {},
): ProductNeedRow {
  return {
    id: TEST_PRODUCT_ID,
    mainId: TEST_EVENT_ID,
    ingredientRef: "eau",
    productName: "Eau",
    productType: "boissons",
    pF: false,
    pS: false,
    byDate: JSON.stringify({
      [TEST_DATE]: {
        totalConsolidated: [{ q: 2, u: "l" }],
        recipes: [],
        totalAssiettes: 10,
        recipeCount: 1,
      },
    }),
    totalNeededArray: JSON.stringify([{ q: 2, u: "l" }]),
    nbRecipes: 1,
    totalAssiettes: 10,
    dateDisplayInfo: JSON.stringify({
      [TEST_DATE]: { formattedDate: "sam 19", timeIcon: null },
    }),
    updated: pbDate(T0),
    created: pbDate(T0),
    ...overrides,
  };
}

/** A PB "ingredients" record (catalogue — join key is `ref`, not `id`). */
export function makeIngredientRecord(
  overrides: Partial<IngredientsRecord> = {},
): IngredientsRecord {
  return {
    id: TEST_INGREDIENT_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    ref: TEST_INGREDIENT_REF,
    name: "Eau",
    type: "legumes",
    allergens: [],
    pF: false,
    pS: false,
    saisons: [],
    ...overrides,
  };
}

/** A PB "categories" record (recipe category, type="category"). */
export function makeCategoryRecord(
  overrides: Partial<CategoriesRecord> = {},
): CategoriesRecord {
  return {
    id: TEST_CATEGORY_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    name: "Plats",
    type: "category",
    ...overrides,
  };
}

/**
 * A recipes-index entry (RecipesStore.recipesIndex) — the shape consumed by
 * EventMealCard / RecipeSearchCard / RecipeAlternatives. Ingredients are
 * refs (string[]), not parsed RecipeIngredient rows.
 */
export function makeRecipeIndexEntry(
  overrides: Partial<RecipeIndexEntry> = {},
): RecipeIndexEntry {
  return {
    id: TEST_RECIPE_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    title: "Tarte aux pommes",
    typeR: "dessert" as RecipesTypeROptions,
    categories: ["Plats"],
    regime: null,
    draft: false,
    materiel: null,
    region: null,
    serveHot: false,
    cuisson: true,
    check: false,
    saison: null,
    permissionWrite: null,
    plate: 6,
    createdBy: null,
    ingredients: [TEST_INGREDIENT_REF],
    status: "public" as RecipesStatusOptions,
    rootRecipeId: null,
    versionLabel: null,
    teams: null,
    ...overrides,
  };
}

/** A todo embedded in `events.todos` JSON (makeEvent({ todos: [...] })). */
export function makeEventTodo(overrides: Partial<EventTodo> = {}): EventTodo {
  return {
    id: "todo-t12-000001",
    taskName: "Préparer la salle",
    taskDescription: null,
    dueDate: null,
    priority: "medium",
    status: "todo",
    taskOn: "beforeEvent",
    requiredPeopleNb: 2,
    assignedTo: null,
    ...overrides,
  };
}

/** A member of an enriched native team (NativeTeamsStore). */
export function makeTeamMember(
  overrides: Partial<NativeTeamMember> = {},
): NativeTeamMember {
  return {
    id: TEST_MEMBER_ID,
    userId: TEST_USER_ID,
    name: "Test User",
    userEmail: "testuser@example.test",
    roles: ["member"],
    joinedAt: pbDate(T0),
    confirmed: true,
    ...overrides,
  };
}

/** An enriched native team (db.nativeTeams cache / NativeTeamsStore). */
export function makeTeam(
  overrides: Partial<EnrichedNativeTeam> = {},
): EnrichedNativeTeam {
  const members = overrides.members ?? [makeTeamMember()];
  return {
    id: TEST_TEAM_ID,
    name: "Team One",
    total: members.length,
    created: pbDate(T0),
    updated: pbDate(T0),
    members,
    prefs: { description: "", location: "", city: "", isPublic: false },
    description: "",
    ...overrides,
  };
}

/**
 * A PB "locks" record — expiry is client-written (`toISOString`, `T`
 * separator, unlike pbDate). Fixed past-future pair: T1 + 1 h is still
 * future relative to every fixture mutation date.
 */
export const LOCK_EXPIRES_AT = new Date(
  T1.getTime() + 60 * 60 * 1000,
).toISOString();

export function makeLockRecord(
  overrides: Partial<LocksRecord> = {},
): LocksRecord {
  return {
    id: TEST_LOCK_ID,
    created: pbDate(T0),
    updated: pbDate(T0),
    collection: "recipes",
    recordId: TEST_RECIPE_ID,
    userId: TEST_USER_ID,
    userName: "Test User",
    expiresAt: LOCK_EXPIRES_AT,
    ...overrides,
  };
}

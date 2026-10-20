/**
 * Synthetic fixtures for the store integration tests.
 *
 * Deliberately contract-focused (not exported from a real app): the point
 * of the mig harness is to pin the PocketBase wire contract — `PbDoc`
 * system fields, PB datetime format `YYYY-MM-DD HH:mm:ss.SSSZ` (space, no
 * `T`) — since the delta-sync cursor is a LEXICAL comparison on those
 * strings. All dates below are fixed so tests are deterministic.
 */
import type { EnrichedEvent } from "$lib/types/events";
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
    guestEmails: null,
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
    status: "ok",
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

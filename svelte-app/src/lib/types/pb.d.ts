/**
 * pb.d.ts — Application-level PocketBase types
 *
 * Re-exports select types from auto-generated pb-generated.ts
 * and defines record types as PbDoc extensions (id, created, updated).
 *
 * Collection names match PocketBase: events, teams, recipes, etc.
 * Legacy aliases (Main, Kteams, Recettes) preserved for backward compatibility.
 */

import type { PbDoc } from "$lib/db-sync/aw-types";
import type {
  EventsStatusOptions,
  EventMaterielTypeOptions,
  EventMaterielStatusOptions,
  EventTodosPriorityOptions,
  EventTodosStatusOptions,
  MaterielTypeOptions,
  MaterielStatusOptions,
  MaterielLoanStatusOptions,
  RecipesTypeROptions,
  RecipesStatusOptions,
} from "./pb-generated";
import type { EventMeal, EventContributor, EventTodo } from "./events";
import type { RecipeIngredient } from "./recipes.types";
import type { Astuce } from "$lib/utils/recipeUtils";
import type { MaterielLoanItem } from "./materiel.types";

// =============================================================================
// RE-EXPORTS from pb-generated.ts
// Consumers can import these directly: import { EventsStatusOptions } from "$lib/types/pb"
// =============================================================================

// Select const objects (value access, e.g. EventsStatusOptions.confirmed)
// These are also usable as types (union of values)
export {
  EventsStatusOptions,
  EventMaterielTypeOptions,
  EventMaterielStatusOptions,
  EventTodosPriorityOptions,
  EventTodosStatusOptions,
  MaterielTypeOptions,
  MaterielStatusOptions,
  MaterielLoanStatusOptions,
  RecipesTypeROptions,
  RecipesStatusOptions,
} from "./pb-generated";

// Legacy aliases — const objects with old names
export {
  EventsStatusOptions as MainStatusValues,
  RecipesTypeROptions as RecettesTypeR,
  RecipesStatusOptions as RecettesStatus,
  MaterielTypeOptions as MaterielType,
  MaterielStatusOptions as MaterielStatus,
  EventTodosPriorityOptions as EventTodoPriority,
  EventTodosStatusOptions as EventTodoStatus,
  MaterielLoanStatusOptions as MaterielLoanStatus,
} from "./pb-generated";

// Legacy aliases — type unions with old names
export type {
  EventsStatusOptions as MainStatus,
  RecipesTypeROptions as RecettesTypeRType,
  RecipesStatusOptions as RecettesStatusType,
  MaterielTypeOptions as MaterielTypeType,
  MaterielStatusOptions as MaterielStatusType,
  EventTodosPriorityOptions as EventTodoPriorityType,
  EventTodosStatusOptions as EventTodoStatusType,
  MaterielLoanStatusOptions as MaterielLoanStatusType,
} from "./pb-generated";

// =============================================================================
// RECORD TYPES — PbDoc + current PocketBase schema
// =============================================================================

/** Events (collection: "events") — aligned with EventsRecord */
export type Main = PbDoc & {
  name: string;
  createdBy: string | null;
  date: string[] | null;
  dateStart: string | null;
  dateEnd: string | null;
  description: string | null;
  minContrib: number | null;
  teams: string[] | null;
  status: EventsStatusOptions | null;
  guestEmails: string[] | null;
  guestUsers: string[] | null;
  location: string | null;
  // JSON fields — shape écrit/parsé par le client (cf. events.d.ts)
  meals: EventMeal[] | null;
  contributors: EventContributor[] | null;
  todos: EventTodo[] | null;
};

/** @deprecated Alias — will be renamed to Events in Phase 2 */
export type Events = Main;

/** Products (collection: "products") — aligned with ProductsRecord */
export type Products = PbDoc & {
  eventId: string;
  ingredientRef: string | null;
  productName: string | null;
  productType: string | null;
  pF: boolean;
  pS: boolean;
  // JSON fields — dual shape : JSON natif (re-import T17 / API PB) ou chaîne
  // double-encodée legacy Appwrite. safeJsonParse tolère les deux.
  store: string | null;
  specs: string | null;
  status: string;
  deleted: boolean;
  stockReel: string | null;
  who: string[] | null;
  previousNames: string[] | null;
  isMerged: boolean;
  mergedFrom: string[] | null;
  mergeDate: string | null;
  mergeReason: string | null;
  isSynced: boolean;
  mergedInto: string | null;
  totalNeededOverride: string | null;
  updatedBy: string | null;
};

/** Purchases (collection: "purchases") — aligned with PurchasesRecord */
export type Purchases = PbDoc & {
  eventId: string;
  unit: string;
  store: string | null;
  status: string | null;
  deleted: boolean;
  notes: string | null;
  price: number | null;
  quantity: number;
  who: string | null;
  createdBy: string | null;
  orderDate: string | null;
  deliveryDate: string | null;
  invoiceId: string | null;
  invoiceTotal: number | null;
  products: string[] | null;
};

/** Recipes (collection: "recipes") — aligned with RecipesRecord */
export type Recettes = PbDoc & {
  title: string;
  plate: number | null;
  preparation: string | null;
  draft: boolean;
  typeR: RecipesTypeROptions | null;
  // JSON fields — shapes écrits/parsés par le client (parseIngredients,
  // parseAstuces acceptent le natif PB et le legacy Appwrite string[])
  categories: string[] | null;
  regime: string[] | null;
  publishedAt: string | null;
  createdBy: string | null;
  teams: string[] | null;
  materiel: string[] | null;
  prepAlt: string[] | null;
  ingredients: RecipeIngredient[] | string[] | null;
  description: string | null;
  region: string | null;
  cuisson: boolean;
  quantite_desc: string | null;
  check: boolean;
  preparation24h: string | null;
  permissionWrite: string[] | null;
  serveHot: boolean;
  lockedBy: string | null;
  saison: string[] | null;
  auteur: string | null;
  astuces: Astuce[] | string[] | null;
  status: RecipesStatusOptions | null;
  rootRecipeId: string | null;
  versionLabel: string | null;
};

/** @deprecated Alias — will be renamed in Phase 2 */
export type Recipes = Recettes;

/** Teams (collection: "teams") — aligned with TeamsRecord */
export type Kteams = PbDoc & {
  name: string;
  members: string[] | null;
};

/** @deprecated Alias — will be renamed in Phase 2 */
export type Teams = Kteams;

/** Materiel (collection: "materiel") — aligned with MaterielRecord */
export type Materiel = PbDoc & {
  name: string;
  type: MaterielTypeOptions | null;
  description: string | null;
  ownerUser: string | null;
  teamId: string | null;
  status: MaterielStatusOptions | null;
  deleted: boolean;
  createdBy: string | null;
  quantity: number | null;
  location: string | null;
  shareableWith: string[] | null;
  isStorage: boolean;
  storeIn: string | null;
};

/** MaterielLoan (collection: "materiel_loan") — aligned with MaterielLoanRecord */
export type MaterielLoan = PbDoc & {
  borrowerUser: string | null;
  eventId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: MaterielLoanStatusOptions | null;
  createdBy: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  materiels: MaterielLoanItem[] | null;
  notes: string | null;
  completedAt: string | null;
  returnedAt: string | null;
  returnNotes: string | null;
  eventName: string | null;
  /**
   * Marqueur local de suppression (pb-sync pose deleted:true sur un 404
   * d'update) — absent du schéma PB materiel_loan ; un record marqué ne doit
   * plus compter dans les calculs de disponibilité.
   */
  deleted?: boolean;
};

/** EventMateriel (collection: "event_materiel") — aligned with EventMaterielRecord */
export type EventMateriel = PbDoc & {
  eventId: string;
  type: EventMaterielTypeOptions | null;
  status: EventMaterielStatusOptions | null;
  groupId: string | null;
  specs: string | null;
  deleted: boolean;
  name: string | null;
  quantity: number | null;
  who: string | null;
  where: string | null;
  sourceMaterielId: string | null;
  notes: string | null;
  createdBy: string | null;
  fromTeamName: string | null;
  loanId: string | null;
};

/** Teamdocs (collection: "teamdocs") — aligned with TeamdocsRecord */
export type Teamdocs = PbDoc & {
  title: string | null;
  content: string | null;
  status: string | null;
  teamId: string | null;
  eventId: string | null;
  // JSON field — array natif PB (sonde T02 : shape array côté API)
  tags: string[] | null;
};

/** Locks (collection: "locks") — aligned with LocksRecord */
export type Locks = PbDoc & {
  collection: string | null;
  expiresAt: string | null;
  recordId: string | null;
  userId: string | null;
};

/** EventTodo (collection: "event_todos") — aligned with EventTodosRecord */
export type EventTodo = PbDoc & {
  eventId: string;
  task: string;
  taskOn: string | null;
  priority: EventTodosPriorityOptions | null;
  status: EventTodosStatusOptions | null;
  assignedTo: string | null;
  taskDescription: string | null;
  dueDate: string | null;
  requiredPeopleNb: number | null;
  locked: boolean;
};

/** ShareLinks (collection: "share_links") — aligned with ShareLinksRecord */
export type ShareLinks = PbDoc & {
  link_type: string | null;
  target_id: string | null;
  access_level: string | null;
  token: string | null;
  createdBy: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
};

// =============================================================================
// REMOVED — collections that no longer exist
// =============================================================================
// InscriptionCampaigns — does not exist in PocketBase
// UserNotifications — replaced by NotificationsRecord (see pb-generated.ts)

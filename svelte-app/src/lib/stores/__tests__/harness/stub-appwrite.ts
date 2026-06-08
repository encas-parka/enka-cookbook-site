/**
 * Stub `getAppwriteInstances()` and related Appwrite SDK functions.
 *
 * Why this shape:
 * - `vi.mock` replaces the `$lib/services/appwrite` module so that
 *   `createSyncCollection.initialFetch()` (called by stores during
 *   `initialize(eventId)`) gets a fully fake Appwrite instance — no network
 *   calls, no WebSocket, no auth.
 * - `activeStubs` is a closure variable that `installStubAppwrite()` swaps
 *   to a fresh object on each call, so tests are isolated.
 * - The mock factory closes over `activeStubs` (the binding, not its value),
 *   so each call to `getAppwriteInstances()` returns whatever stubs are
 *   currently active.
 *
 * Usage in a test:
 * ```ts
 * import { installStubAppwrite, getStubs } from "./harness/stub-appwrite";
 *
 * beforeEach(() => {
 *   const stubs = installStubAppwrite();
 *   // optionally: stubs.tables.listRows.mockResolvedValue({ documents: [], total: 0 });
 * });
 *
 * it("...", async () => {
 *   expect(getStubs().tables.listRows).toHaveBeenCalledWith(...);
 * });
 * ```
 */
import { vi } from "vitest";

function freshStubs() {
  return {
    client: {
      subscribe: vi.fn(() => () => {}),
    },
    account: {
      get: vi.fn(async () => ({
        $id: "test-user",
        email: "test@example.com",
        name: "Test User",
      })),
      create: vi.fn(),
      createEmailSession: vi.fn(),
      deleteSession: vi.fn(),
    },
    databases: {
      listDocuments: vi.fn(async () => ({ documents: [], total: 0 })),
      getDocument: vi.fn(async () => null),
      createDocument: vi.fn(async () => ({ $id: "fake-id" })),
      updateDocument: vi.fn(async () => ({})),
      deleteDocument: vi.fn(async () => ({})),
    },
    tables: {
      getRow: vi.fn(async () => null),
      listRows: vi.fn(async () => ({ documents: [], total: 0, rows: [] })),
      createRow: vi.fn(async () => ({ $id: "fake-id" })),
      updateRow: vi.fn(async () => ({})),
      deleteRow: vi.fn(async () => ({})),
      // Legacy v24 SDK method names (some service code still references these)
      get: vi.fn(async () => null),
      list: vi.fn(async () => ({ documents: [], total: 0 })),
      create: vi.fn(async () => ({ $id: "fake-id" })),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    functions: {
      createExecution: vi.fn(async () => ({ $id: "fake-exec" })),
    },
    teams: {
      list: vi.fn(async () => ({ teams: [], total: 0 })),
      create: vi.fn(async () => ({ $id: "fake-team" })),
      get: vi.fn(async () => null),
    },
    config: {
      endpoint: "http://fake.local/v1",
      projectId: "fake-project",
      databaseId: "fake-db",
      collections: {},
      functions: {},
    },
  };
}

let activeStubs = freshStubs();

vi.mock("$lib/services/appwrite", () => ({
  getAppwriteInstances: vi.fn(() => Promise.resolve(activeStubs)),
  subscribe: vi.fn(() => Promise.resolve(() => {})),
  clearAppwriteCache: vi.fn(),
  getAppwriteConfig: vi.fn(() => ({
    APPWRITE_ENDPOINT: "http://fake.local/v1",
    APPWRITE_PROJECT_ID: "fake-project",
    APPWRITE_DATABASE_ID: "fake-db",
    MANAGE_RECIPE_FUNCTION_ID: "fake-fn",
    APPWRITE_CONFIG: { collections: {}, functions: {} },
  })),
  getDatabaseId: vi.fn(() => "fake-db"),
  getCollectionId: vi.fn((name: string) => name),
  getFunctionId: vi.fn((name: string) => name),
  isInitialized: vi.fn(() => false),
}));

export function installStubAppwrite() {
  activeStubs = freshStubs();
  return activeStubs;
}

export function getStubs() {
  return activeStubs;
}

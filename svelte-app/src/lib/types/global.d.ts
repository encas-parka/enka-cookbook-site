export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  functions: {
    cmsAuth: string;
    accessRequest: string;
    batchUpdate: string;
    usersTeamsManager: string;
    enkaData: string;
  };
  collections: {
    events: string;
    ingredients: string;
    main: string;
    purchases: string;
    products: string;
    kteams: string;
    locks: string;
    user_notifications: string;
    materiel_loan: string;
    teamdocs: string;
  };
}

interface AppwriteClientGlobal {
  getAppwriteClients: () => Promise<{
    client: any;
    account: any;
    functions: any;
    databases: any;
    teams: any;
  }>;
  getAccount: () => Promise<any>;
  getTeams: () => Promise<any>;
  getFunctions: () => Promise<any>;
  getDatabases: () => Promise<any>;
  getConfig: () => {
    APPWRITE_ENDPOINT: string;
    APPWRITE_PROJECT_ID: string;
    APPWRITE_FUNCTION_ID: string;
    ACCESS_REQUEST_FUNCTION_ID: string;
    APPWRITE_CONFIG: AppwriteConfig;
  };
  isInitialized: () => boolean;
  initializeAppwrite: () => Promise<any>;
  getLocalCmsUser: () => any;
  isAuthenticatedCms: () => boolean;
  isAuthenticatedAppwrite: () => Promise<boolean>;
  isConnectedAppwrite: () => Promise<boolean>;
  getUserEmail: () => string | null;
  getUserName: () => string | null;
  clearAuthData: () => void;
  setAuthData: (email: string, name: string, cmsAuth?: any) => void;
  logoutGlobal: () => Promise<void>;
  isEmailVerified: () => Promise<boolean>;
  sendVerificationEmail: () => Promise<void>;
  verifyEmail: (userId: string, secret: string) => Promise<void>;
  getLocalEmailVerificationStatus: () => boolean;
  createCollaborativeProductsListFromEvent: (eventId: string) => Promise<any>;
  checkExistingMainGroup: (mainGroupId: string) => Promise<boolean>;
  subscribeToCollections: (
    collections: string[],
    databaseId: string,
    callback: (response: any) => void,
    connectionCallbacks?: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: any) => void;
    },
  ) => () => void;
}

interface AppwriteSDK {
  Client: any;
  Account: any;
  Functions: any;
  Databases: any;
  Teams: any;
  Query: any;
}

declare global {
  interface Window {
    Appwrite: AppwriteSDK;
    AppwriteClient: AppwriteClientGlobal;
  }
}

import type {
  CalendarRangeProps,
  CalendarMonthProps,
  CalendarDateProps,
} from "cally";

type MapEvents<T> = {
  [K in keyof T as K extends `on${infer E}` ? `on:${Lowercase<E>}` : K]: T[K];
};

declare module "svelte/elements" {
  interface SvelteHTMLElements {
    "calendar-range": MapEvents<CalendarRangeProps>;
    "calendar-month": MapEvents<CalendarMonthProps>;
    "calendar-date": MapEvents<CalendarDateProps>;
  }
}

export {};

/**
 * Module Appwrite pour le développement
 * Simule le comportement du window.AppwriteClient pour le développement local
 */

// Importer Appwrite SDK
import { Client, Account, Functions, Databases, Teams } from "appwrite";

const APPWRITE_CONFIG = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "689725820024e81781b7",
  databaseId: "689d15b10003a5a13636",
  functions: {
    cmsAuth: "68976500002eb5c6ee4f",
    accessRequest: "689cdea5001a4d74549d",
    batchUpdate: "68f00487000c624533a3",
  },
  collections: {
    main: "main",
    purchases: "purchases",
    products: "products",
  },
};

let client: Client;
let account: Account;
let functions: Functions;
let databases: Databases;
let teams: Teams;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialise le client Appwrite
 */
async function initializeAppwrite(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      client = new Client()
        .setEndpoint(APPWRITE_CONFIG.endpoint)
        .setProject(APPWRITE_CONFIG.projectId);

      account = new Account(client);
      functions = new Functions(client);
      databases = new Databases(client);
      teams = new Teams(client);

      console.log("[AppwriteDev] Initialisation Appwrite réussie");
    } catch (error) {
      console.error("[AppwriteDev] Erreur initialisation Appwrite:", error);
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Interface qui simule le window.AppwriteClient pour le développement
 */
export const AppwriteClient = {
  // Fonctions d'initialisation et de récupération des clients
  async getAppwriteClients() {
    await initializeAppwrite();
    return { client, account, functions, databases, teams };
  },

  async getAccount() {
    await initializeAppwrite();
    return account;
  },

  async getTeams() {
    await initializeAppwrite();
    return teams;
  },

  async getFunctions() {
    await initializeAppwrite();
    return functions;
  },

  async getDatabases() {
    await initializeAppwrite();
    return databases;
  },

  getConfig() {
    return {
      APPWRITE_ENDPOINT: APPWRITE_CONFIG.endpoint,
      APPWRITE_PROJECT_ID: APPWRITE_CONFIG.projectId,
      APPWRITE_FUNCTION_ID: APPWRITE_CONFIG.functions.cmsAuth,
      ACCESS_REQUEST_FUNCTION_ID: APPWRITE_CONFIG.functions.accessRequest,
      APPWRITE_CONFIG,
    };
  },

  isInitialized(): boolean {
    return !!(client && account && functions && databases && teams);
  },

  async initializeAppwrite() {
    await initializeAppwrite();
  },

  // Fonctions d'authentification
  async isConnectedAppwrite(): Promise<boolean> {
    try {
      await initializeAppwrite();
      const session = await account.getSession("current");
      return !!(session && session.userId);
    } catch {
      return false;
    }
  },

  async isAuthenticatedAppwrite(): Promise<boolean> {
    try {
      await initializeAppwrite();
      const session = await account.getSession("current");
      return !!session;
    } catch {
      return false;
    }
  },

  async isEmailVerified(): Promise<boolean> {
    try {
      await initializeAppwrite();
      const user = await account.get();
      return user.emailVerification;
    } catch {
      return false;
    }
  },

  async sendVerificationEmail() {
    try {
      await initializeAppwrite();
      const user = await account.get();
      const verificationURL = `${window.location.origin}/verify-email`;
      return await account.createVerification(verificationURL);
    } catch (error) {
      console.error("[AppwriteDev] Erreur envoi email vérification:", error);
      throw error;
    }
  },

  async verifyEmail(userId: string, secret: string) {
    try {
      await initializeAppwrite();
      return await account.updateVerification(userId, secret);
    } catch (error) {
      console.error("[AppwriteDev] Erreur vérification email:", error);
      throw error;
    }
  },

  async getAuthenticationState() {
    const cmsUser = this.getLocalCmsUser();

    if (cmsUser) {
      return {
        isAuthenticated: true,
        isEmailVerified: true,
        email: cmsUser.email,
        name: cmsUser.name,
        requiresAction: false,
      };
    }

    try {
      await initializeAppwrite();
      const session = await account.getSession("current");
      const isAuthenticated = !!session;

      if (isAuthenticated) {
        const user = await account.get();
        const emailVerified = user.emailVerification;

        return {
          isAuthenticated,
          isEmailVerified: emailVerified,
          email: user.email,
          name: user.name,
          requiresAction: !emailVerified,
        };
      }
    } catch (error) {
      console.warn("[AppwriteDev] Erreur état authentification:", error);
    }

    return {
      isAuthenticated: false,
      isEmailVerified: false,
      email: null,
      name: null,
      requiresAction: false,
    };
  },

  // Fonctions utilitaires du fichier original
  getLocalCmsUser() {
    try {
      const cmsUser = localStorage.getItem("cmsUser");
      return cmsUser ? JSON.parse(cmsUser) : null;
    } catch {
      return null;
    }
  },

  getLocalEmailVerificationStatus() {
    try {
      const status = localStorage.getItem("emailVerificationStatus");
      return status ? JSON.parse(status) : null;
    } catch {
      return null;
    }
  },

  isAuthenticatedCms(): boolean {
    return !!this.getLocalCmsUser();
  },

  getUserEmail(): string | null {
    const cmsUser = this.getLocalCmsUser();
    return cmsUser?.email || null;
  },

  getUserName(): string | null {
    const cmsUser = this.getLocalCmsUser();
    return cmsUser?.name || null;
  },

  clearAuthData() {
    localStorage.removeItem("cmsUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("emailVerificationStatus");
  },

  setAuthData(email: string, name: string, cmsAuth?: any) {
    const userData = { email, name };
    localStorage.setItem("cmsUser", JSON.stringify(userData));
    if (cmsAuth) {
      localStorage.setItem("sveltia-cms.user", JSON.stringify(cmsAuth));
    }
  },

  async logoutGlobal() {
    try {
      await initializeAppwrite();
      await account.deleteSession("current");
    } catch (error) {
      console.warn(
        "[AppwriteDev] Erreur lors de la déconnexion Appwrite:",
        error,
      );
    }
    this.clearAuthData();
  },

  // Fonction de souscription aux collections (realtime)
  subscribeToCollections(
    collectionNames,
    listId,
    onMessage: (response: any) => void,
    connectionCallbacks: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: any) => void;
    } = {},
  ) {
    const { onConnect, onDisconnect, onError } = connectionCallbacks;

    if (!client) {
      console.error(
        "Impossible de s'abonner : le client Appwrite n'est pas encore initialisé.",
      );
      onError?.({ message: "Client Appwrite non initialisé" });
      return () => {};
    }

    const channels = collectionNames
      .map((name) => {
        const collectionId = APPWRITE_CONFIG.collections[name];
        if (!collectionId) {
          console.warn(
            `[Appwrite Client] Nom de collection inconnu dans la configuration: ${name}`,
          );
          return null;
        }
        return `databases.${APPWRITE_CONFIG.databaseId}.collections.${collectionId}.documents`;
      })
      .filter(Boolean);

    console.log(
      "[Appwrite Client] Abonnement aux canaux en cours...",
      channels,
    );

    try {
      // La méthode client.subscribe() gère automatiquement la connexion WebSocket
      // selon la documentation officielle Appwrite
      const unsubscribe = client.subscribe(channels, (response) => {
        console.log("[Appwrite Client] Réception temps réel:", response);
        onMessage(response);
      });

      // Selon la documentation Appwrite, la subscription est automatiquement active
      // On peut considérer la connexion comme établie immédiatement
      if (onConnect) {
        setTimeout(() => {
          console.log("[Appwrite Client] Connexion temps réel établie");
          onConnect();
        }, 50);
      }

      return unsubscribe;
    } catch (error) {
      console.error(
        "[Appwrite Client] Erreur lors de la souscription temps réel:",
        error,
      );
      onError?.(error);
      return () => {}; // Retourner une fonction vide en cas d'erreur
    }
  },
};

// Exposer globalement pour compatibilité avec le code existant
if (typeof window !== "undefined") {
  (window as any).AppwriteClient = AppwriteClient;
}

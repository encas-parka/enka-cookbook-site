(() => {
  // ns-hugo-imp:/home/geo/Developpement/ENKA-COOKBOOK/hugo-cookbook-theme/assets/js/appwrite-client.js
  var APPWRITE_CONFIG = {
    endpoint: "https://cloud.appwrite.io/v1",
    projectId: "689725820024e81781b7",
    databaseId: "689d15b10003a5a13636",
    functions: {
      cmsAuth: "68976500002eb5c6ee4f",
      accessRequest: "689cdea5001a4d74549d",
      // createProductList: "68f00487000c624533a3",
      batchUpdate: "68f00487000c624533a3"
    },
    collections: {
      main: "main",
      purchases: "purchases",
      products: "products"
    }
  };
  var client = null;
  var account = null;
  var functions = null;
  var databases = null;
  var teams = null;
  var initializationPromise = null;
  function waitForAppwrite(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function checkAppwrite() {
        attempts++;
        if (window.Appwrite && window.Appwrite.Client && window.Appwrite.Account) {
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error(
            "[Appwrite Client] SDK Appwrite non charg\xE9 apr\xE8s le nombre maximum de tentatives"
          );
          reject(new Error("Le SDK Appwrite n'a pas pu \xEAtre charg\xE9."));
        } else {
          setTimeout(checkAppwrite, interval);
        }
      }
      checkAppwrite();
    });
  }
  async function initializeAppwrite() {
    if (client && account && functions && databases) {
      return { client, account, functions, databases };
    }
    if (initializationPromise) {
      return initializationPromise;
    }
    initializationPromise = (async () => {
      try {
        console.log("[Appwrite Client] D\xE9but de l'initialisation");
        await waitForAppwrite();
        const { Client, Account, Functions, Databases, Teams } = window.Appwrite;
        client = new Client().setEndpoint(APPWRITE_CONFIG.endpoint).setProject(APPWRITE_CONFIG.projectId);
        account = new Account(client);
        functions = new Functions(client);
        databases = new Databases(client);
        teams = new Teams(client);
        console.log("[Appwrite Client] Initialisation termin\xE9e avec succ\xE8s");
        return { client, account, functions, databases, teams };
      } catch (error) {
        console.error(
          "[Appwrite Client] Erreur lors de l'initialisation:",
          error
        );
        client = null;
        account = null;
        functions = null;
        databases = null;
        teams = null;
        initializationPromise = null;
        throw error;
      }
    })();
    return initializationPromise;
  }
  async function getAppwriteClients() {
    return await initializeAppwrite();
  }
  async function getAccount() {
    if (!account) await initializeAppwrite();
    return account;
  }
  async function getTeams() {
    if (!teams) await initializeAppwrite();
    return teams;
  }
  async function getFunctions() {
    if (!functions) await initializeAppwrite();
    return functions;
  }
  async function getDatabases() {
    if (!databases) await initializeAppwrite();
    return databases;
  }
  function getConfig() {
    return {
      APPWRITE_ENDPOINT: APPWRITE_CONFIG.endpoint,
      APPWRITE_PROJECT_ID: APPWRITE_CONFIG.projectId,
      APPWRITE_FUNCTION_ID: APPWRITE_CONFIG.functions.cmsAuth,
      ACCESS_REQUEST_FUNCTION_ID: APPWRITE_CONFIG.functions.accessRequest,
      APPWRITE_CONFIG
    };
  }
  function isInitialized() {
    return !!(client && account && functions && databases && teams);
  }
  function getLocalCmsUser() {
    const cmsUser = localStorage.getItem("sveltia-cms.user");
    if (!cmsUser) return null;
    try {
      const parsedUser = JSON.parse(cmsUser);
      if (parsedUser.token && typeof parsedUser.token === "string" && parsedUser.token.trim() !== "") {
        return parsedUser;
      }
      localStorage.removeItem("sveltia-cms.user");
      return null;
    } catch (e) {
      localStorage.removeItem("sveltia-cms.user");
      return null;
    }
  }
  function isAuthenticatedCms() {
    return getLocalCmsUser() !== null;
  }
  async function isAuthenticatedAppwrite() {
    try {
      const acc = await getAccount();
      await acc.get();
      return true;
    } catch (error) {
      return false;
    }
  }
  async function isConnectedAppwrite() {
    try {
      const acc = await getAccount();
      const accountData = await acc.get();
      if (!accountData || !accountData.$id) {
        return false;
      }
      const session = await acc.getSession("current");
      if (!session || !session.$id) {
        return false;
      }
      const now = /* @__PURE__ */ new Date();
      const expireDate = new Date(session.expire);
      if (now >= expireDate) {
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking connection:", error);
      return false;
    }
  }
  async function isEmailVerified() {
    try {
      const acc = await getAccount();
      const user = await acc.get();
      return user.emailVerification || false;
    } catch (error) {
      return false;
    }
  }
  async function sendVerificationEmail(redirectURL = null) {
    try {
      const acc = await getAccount();
      const verificationURL = redirectURL || `${window.location.origin}/verify-email`;
      await acc.createVerification(verificationURL);
    } catch (error) {
      console.error(
        "[AppwriteClient] Erreur lors de l'envoi de l'email de v\xE9rification:",
        error
      );
      throw error;
    }
  }
  async function verifyEmail(userId, secret) {
    try {
      const acc = await getAccount();
      await acc.updateVerification(userId, secret);
    } catch (error) {
      console.error(
        "[AppwriteClient] Erreur lors de la v\xE9rification d'email:",
        error
      );
      throw error;
    }
  }
  function getUserEmail() {
    return localStorage.getItem("appwrite-user-email");
  }
  function getUserName() {
    return localStorage.getItem("appwrite-user-name");
  }
  function getLocalEmailVerificationStatus() {
    return localStorage.getItem("email-verification-status");
  }
  function clearAuthData() {
    localStorage.removeItem("sveltia-cms.user");
    localStorage.removeItem("appwrite-user-email");
    localStorage.removeItem("appwrite-user-name");
    localStorage.removeItem("email-verification-status");
  }
  async function validateAndPrepareEventData(eventId) {
    console.log(
      `[Appwrite Client] Validation des donn\xE9es pour l'\xE9v\xE9nement ${eventId}`
    );
    const response = await fetch(
      `/evenements/${eventId}/ingredients_aw/index.json`
    );
    if (!response.ok)
      throw new Error(
        `Impossible de r\xE9cup\xE9rer les donn\xE9es de l'\xE9v\xE9nement: ${response.status}`
      );
    const eventData = await response.json();
    console.log(
      `[Appwrite Client] Donn\xE9es de l'\xE9v\xE9nement r\xE9cup\xE9r\xE9es:`,
      eventData
    );
    const { account: account2, databases: databases2 } = await initializeAppwrite();
    const user = await account2.get();
    console.log(`[Appwrite Client] Utilisateur authentifi\xE9: ${user.$id}`);
    try {
      await databases2.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.main,
        eventId
      );
      console.log(
        `[Appwrite Client] L'\xE9v\xE9nement ${eventId} existe d\xE9j\xE0 dans main`
      );
      window.location.href = `/sv_products/?listId=${eventId}`;
      return null;
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }
    const contentHash = window.__HUGO_PARAMS__?.listContentHash;
    if (!contentHash) {
      throw new Error("Le hash du contenu n'est pas d\xE9fini");
    }
    return { eventData, user, contentHash };
  }
  async function callCreateProductsListFunction(eventId, eventData, userId, contentHash) {
    console.log(`[Appwrite Client] Appel de la fonction serveur pour ${eventId}`);
    const FUNCTION_ID = APPWRITE_CONFIG.functions.createProductList;
    const { functions: functions2 } = await initializeAppwrite();
    try {
      const result = await functions2.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          eventId,
          eventData,
          userId,
          contentHash
        }),
        true,
        // async = true - EXÉCUTION ASYNCHRONE
        "/",
        // path (optionnel)
        "GET",
        // method (optionnel)
        {}
        // Pas besoin d'en-têtes personnalisés
      );
      console.log(
        `[Appwrite Client] Ex\xE9cution d\xE9marr\xE9e en mode asynchrone:`,
        result
      );
      const executionId = result.$id;
      console.log(`[Appwrite Client] Execution ID: ${executionId}`);
      console.log(
        `[Appwrite Client] Ex\xE9cution async d\xE9marr\xE9e pour 300+ ingr\xE9dients - pas de polling`
      );
      return {
        success: true,
        eventId,
        executionId,
        message: "Traitement d\xE9marr\xE9 en arri\xE8re-plan (300+ ingr\xE9dients)",
        isAsync: true
      };
    } catch (error) {
      console.error(`[Appwrite Client] Erreur lors de l'appel fonction:`, error);
      throw error;
    }
  }
  async function createCollaborativeProductsListFromEvent(eventId) {
    try {
      console.log(
        `[Appwrite Client] D\xE9but de la cr\xE9ation pour l'\xE9v\xE9nement ${eventId}`
      );
      const validationResult = await validateAndPrepareEventData(eventId);
      if (!validationResult) {
        return;
      }
      const { eventData, user, contentHash } = validationResult;
      console.log(`[Appwrite Client] Donn\xE9es valid\xE9es, appel de la fonction`);
      const result = await callCreateProductsListFunction(
        eventId,
        eventData,
        user.$id,
        contentHash
      );
      console.log(
        `[Appwrite Client] Op\xE9ration r\xE9ussie, redirection vers la liste`
      );
      window.location.href = `/sv_products/?listId=${eventId}`;
    } catch (error) {
      console.error(
        `[Appwrite Client] Erreur lors de la cr\xE9ation:`,
        error.message
      );
      if (error.message.includes("already_exists")) {
        throw new Error(
          "Cette liste de produits existe d\xE9j\xE0. Veuillez r\xE9essayer avec un ID diff\xE9rent."
        );
      } else if (error.message.includes("transaction_limit_exceeded")) {
        throw new Error(
          "Limite de transactions d\xE9pass\xE9e. Veuillez r\xE9duire le nombre d'ingr\xE9dients ou r\xE9essayer plus tard."
        );
      } else {
        throw error;
      }
    }
  }
  async function checkExistingMainGroup(mainGroupId) {
    try {
      const { databases: databases2 } = await initializeAppwrite();
      const existingMainGroup = await databases2.getDocument(
        "689d15b10003a5a13636",
        "main",
        mainGroupId
      );
      return !!existingMainGroup;
    } catch (error) {
      if (error.code === 404) {
        return false;
      }
      console.error(
        "[Appwrite Client] Erreur lors de la v\xE9rification du main group existant:",
        error
      );
      return false;
    }
  }
  async function logoutGlobal() {
    try {
      clearAuthData();
      const acc = await getAccount();
      await acc.deleteSession("current");
    } catch (error) {
      console.warn(
        "[Appwrite Client] Erreur lors de la d\xE9connexion Appwrite (peut-\xEAtre d\xE9j\xE0 d\xE9connect\xE9):",
        error
      );
    }
  }
  function setAuthData(email, name, cmsAuth) {
    localStorage.setItem("appwrite-user-email", email);
    localStorage.setItem("appwrite-user-name", name);
    localStorage.setItem("sveltia-cms.user", JSON.stringify(cmsAuth));
  }
  function subscribeToCollections(collectionNames, listId, onMessage, connectionCallbacks = {}) {
    const { onConnect, onDisconnect, onError } = connectionCallbacks;
    if (!client) {
      console.error(
        "Impossible de s'abonner : le client Appwrite n'est pas encore initialis\xE9."
      );
      onError?.({ message: "Client Appwrite non initialis\xE9" });
      return () => {
      };
    }
    const channels = collectionNames.map((name) => {
      const collectionId = APPWRITE_CONFIG.collections[name];
      if (!collectionId) {
        console.warn(
          `[Appwrite Client] Nom de collection inconnu dans la configuration: ${name}`
        );
        return null;
      }
      return `databases.${APPWRITE_CONFIG.databaseId}.collections.${collectionId}.documents`;
    }).filter(Boolean);
    console.log("[Appwrite Client] Abonnement aux canaux en cours...", channels);
    try {
      const unsubscribe = client.subscribe(channels, (response) => {
        console.log("[Appwrite Client] R\xE9ception temps r\xE9el:", response);
        onMessage(response);
      });
      if (onConnect) {
        setTimeout(() => {
          console.log("[Appwrite Client] Connexion temps r\xE9el \xE9tablie");
          onConnect();
        }, 50);
      }
      return unsubscribe;
    } catch (error) {
      console.error(
        "[Appwrite Client] Erreur lors de la souscription temps r\xE9el:",
        error
      );
      onError?.(error);
      return () => {
      };
    }
  }
  if (typeof window !== "undefined") {
    window.AppwriteClient = {
      getAppwriteClients,
      getAccount,
      getFunctions,
      getDatabases,
      getConfig,
      isInitialized,
      initializeAppwrite,
      getLocalCmsUser,
      isAuthenticatedCms,
      isAuthenticatedAppwrite,
      isConnectedAppwrite,
      getUserEmail,
      getUserName,
      clearAuthData,
      setAuthData,
      logoutGlobal,
      isEmailVerified,
      sendVerificationEmail,
      verifyEmail,
      getLocalEmailVerificationStatus,
      createCollaborativeProductsListFromEvent,
      checkExistingMainGroup,
      subscribeToCollections
    };
  }

  // <stdin>
  var { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } = getConfig();
  var TEAM_ID_TO_INVITE = "689bf6fe0006627d8959";
  var INVITATION_SENT_KEY = "invitation_sent_emails";
  var DEBUG_MODE = false;
  function clearInvitationHistory() {
    localStorage.removeItem(INVITATION_SENT_KEY);
    debugLog("Historique des invitations nettoy\xE9");
  }
  function hasInvitationBeenSent(email) {
    const sentEmails = JSON.parse(localStorage.getItem(INVITATION_SENT_KEY) || "[]");
    return sentEmails.includes(email);
  }
  function markInvitationAsSent(email) {
    const sentEmails = JSON.parse(localStorage.getItem(INVITATION_SENT_KEY) || "[]");
    if (!sentEmails.includes(email)) {
      sentEmails.push(email);
      localStorage.setItem(INVITATION_SENT_KEY, JSON.stringify(sentEmails));
      debugLog("Invitation marqu\xE9e comme envoy\xE9e", { email });
    }
  }
  var statusContainer;
  var statusMessage;
  var statusDetails;
  var loginButton;
  function debugLog(message, data = null) {
    if (DEBUG_MODE) {
    }
  }
  function initializeDOMElements() {
    statusContainer = document.getElementById("status-container");
    statusMessage = document.getElementById("status-message");
    statusDetails = document.getElementById("status-details");
    loginButton = document.getElementById("login-button");
    debugLog("\xC9l\xE9ments DOM initialis\xE9s", {
      statusContainer: !!statusContainer,
      statusMessage: !!statusMessage,
      statusDetails: !!statusDetails,
      loginButton: !!loginButton
    });
    if (!statusContainer || !statusMessage || !statusDetails) {
      throw new Error("Certains \xE9l\xE9ments DOM requis sont manquants");
    }
  }
  function showResult(type, message) {
    debugLog(`Affichage du r\xE9sultat: ${type}`, message);
    if (statusContainer) statusContainer.style.display = "none";
    if (statusDetails) {
      statusDetails.className = `alert alert-${type} my-2`;
      statusDetails.textContent = message;
      statusDetails.style.display = "block";
    }
  }
  function updateStatusMessage(message) {
    debugLog("Mise \xE0 jour du message de statut", message);
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }
  async function handleInvitation() {
    let requesterEmail = null;
    try {
      debugLog("D\xE9marrage du traitement de l'invitation");
      debugLog("URL actuelle:", window.location.href);
      debugLog("Param\xE8tres URL:", window.location.search);
      initializeDOMElements();
      updateStatusMessage("Initialisation du client Appwrite...");
      const account2 = await getAccount();
      const teams2 = await getTeams();
      debugLog("Clients Appwrite initialis\xE9s");
      debugLog("Configuration:", {
        endpoint: APPWRITE_ENDPOINT,
        projectId: APPWRITE_PROJECT_ID,
        teamId: TEAM_ID_TO_INVITE
      });
      const params = new URLSearchParams(window.location.search);
      requesterEmail = params.get("requester");
      debugLog("Email du demandeur extrait", requesterEmail);
      debugLog("Tous les param\xE8tres URL:", Object.fromEntries(params.entries()));
      if (!requesterEmail) {
        debugLog("ERREUR: Email du demandeur manquant");
        showResult("danger", "Email du demandeur manquant dans l'URL. Le lien est peut-\xEAtre corrompu.");
        return;
      }
      updateStatusMessage("V\xE9rification de votre authentification...");
      debugLog("Tentative de r\xE9cup\xE9ration de l'utilisateur courant...");
      const currentUser = await account2.get();
      debugLog("Utilisateur connect\xE9", {
        name: currentUser.name,
        email: currentUser.email,
        id: currentUser.$id
      });
      updateStatusMessage(`Connect\xE9 en tant que ${currentUser.name}. Envoi de l'invitation \xE0 ${requesterEmail}...`);
      debugLog("V\xE9rification des invitations pr\xE9c\xE9dentes", { email: requesterEmail });
      if (hasInvitationBeenSent(requesterEmail)) {
        debugLog("Invitation d\xE9j\xE0 envoy\xE9e pr\xE9c\xE9demment pour cet email", { email: requesterEmail });
        showResult("warning", `Une invitation a d\xE9j\xE0 \xE9t\xE9 envoy\xE9e \xE0 ${requesterEmail}. Veuillez patienter qu'elle soit accept\xE9e.`);
        if (statusDetails) {
          const resetButton = document.createElement("button");
          resetButton.className = "btn btn-warning btn-sm ms-2";
          resetButton.textContent = "R\xE9essayer";
          resetButton.onclick = () => {
            clearInvitationHistory();
            window.location.reload();
          };
          statusDetails.appendChild(resetButton);
        }
        return;
      }
      debugLog("Envoi de l'invitation \xE0 l'\xE9quipe", {
        teamId: TEAM_ID_TO_INVITE,
        email: requesterEmail,
        roles: ["owner"],
        redirectUrl: `${window.location.origin}/accept-invitation`
      });
      const membership = await teams2.createMembership(
        TEAM_ID_TO_INVITE,
        ["owner"],
        // Rôle "owner" comme demandé
        requesterEmail,
        void 0,
        void 0,
        `${window.location.origin}/accept-invitation`
        // Page de redirection pour l'invité
      );
      markInvitationAsSent(requesterEmail);
      debugLog("Invitation envoy\xE9e avec succ\xE8s", { membershipId: membership.$id });
      showResult("success", `Invitation envoy\xE9e avec succ\xE8s \xE0 ${requesterEmail} !`);
    } catch (error) {
      console.error("Erreur lors du traitement de l'invitation :", error);
      debugLog("Erreur d\xE9tect\xE9e", {
        code: error.code,
        message: error.message,
        type: error.type,
        response: error.response,
        stack: error.stack
      });
      if (DEBUG_MODE) {
        console.error("D\xE9tails complets de l'erreur:", error);
      }
      if (error.code === 401 || error.message?.includes("not authenticated") || error.message?.includes("Unauthorized")) {
        debugLog("Erreur d'authentification");
        showResult("danger", "Vous devez \xEAtre connect\xE9 en tant qu'administrateur pour approuver une invitation.");
        if (loginButton) loginButton.style.display = "inline-block";
      } else if (error.code === 409) {
        debugLog("Erreur de conflit (utilisateur d\xE9j\xE0 invit\xE9)");
        showResult("warning", `${requesterEmail || "cet utilisateur"} est d\xE9j\xE0 membre de l'\xE9quipe ou a d\xE9j\xE0 une invitation en attente.`);
        if (requesterEmail) {
          markInvitationAsSent(requesterEmail);
        }
      } else if (error.code === 400) {
        debugLog("Erreur de requ\xEAte invalide");
        showResult("danger", `Requ\xEAte invalide : ${error.message || "V\xE9rifiez les param\xE8tres de l'invitation"}`);
      } else if (error.message?.includes("Appwrite") || error.message?.includes("SDK")) {
        debugLog("Erreur li\xE9e au SDK Appwrite");
        showResult("danger", error.message);
      } else {
        debugLog("Erreur inattendue");
        showResult("danger", `Une erreur inattendue est survenue : ${error.message || "Erreur inconnue"}`);
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      debugLog("DOM charg\xE9 via \xE9v\xE9nement, d\xE9marrage du processus d'invitation");
      startInvitationProcess();
    });
  } else {
    startInvitationProcess();
  }
  function startInvitationProcess() {
    handleInvitation().catch((error) => {
      console.error("Erreur non captur\xE9e dans handleInvitation:", error);
      debugLog("ERREUR CRITIQUE non captur\xE9e", error);
      if (statusDetails) {
        statusDetails.className = "alert alert-danger  my-2";
        statusDetails.textContent = "Une erreur critique est survenue. Veuillez consulter la console pour plus de d\xE9tails.";
        statusDetails.style.display = "block";
      }
      if (statusContainer) statusContainer.style.display = "none";
    });
  }
  setTimeout(() => {
    if (statusContainer && statusContainer.style.display !== "none") {
      debugLog("Timeout global atteint, affichage d'un message d'erreur");
      showResult("danger", "Le traitement prend trop de temps. Veuillez v\xE9rifier votre connexion et r\xE9essayer.");
    }
  }, 3e4);
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvL0RldmVsb3BwZW1lbnQvRU5LQS1DT09LQk9PSy9odWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanMiLCAiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzXG4vLyBNb2R1bGUgY29tbXVuIHBvdXIgbCdpbml0aWFsaXNhdGlvbiBldCBsYSBnZXN0aW9uIGR1IGNsaWVudCBBcHB3cml0ZVxuLy8gXHUwMEM5dml0ZSBsYSBkdXBsaWNhdGlvbiBkJ2luaXRpYWxpc2F0aW9uIGVudHJlIGF1dGgtc3RhdHVzLmpzIGV0IGF1dGhBcHB3cml0ZS5qc1xuLy8gTEVHQUNZIDogbWlncmVyIHRvdXRlIGxlcyBkXHUwMEU5cGVuZGFuZGUgKGF1dGgsIGludml0YXRpb24sIGV0Yy4uLilcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQ0VOVFJBTEUgQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9DT05GSUcgPSB7XG4gIGVuZHBvaW50OiBcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIixcbiAgcHJvamVjdElkOiBcIjY4OTcyNTgyMDAyNGU4MTc4MWI3XCIsXG4gIGRhdGFiYXNlSWQ6IFwiNjg5ZDE1YjEwMDAzYTVhMTM2MzZcIixcbiAgZnVuY3Rpb25zOiB7XG4gICAgY21zQXV0aDogXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiLFxuICAgIGFjY2Vzc1JlcXVlc3Q6IFwiNjg5Y2RlYTUwMDFhNGQ3NDU0OWRcIixcbiAgICAvLyBjcmVhdGVQcm9kdWN0TGlzdDogXCI2OGYwMDQ4NzAwMGM2MjQ1MzNhM1wiLFxuICAgIGJhdGNoVXBkYXRlOiBcIjY4ZjAwNDg3MDAwYzYyNDUzM2EzXCIsXG4gIH0sXG4gIGNvbGxlY3Rpb25zOiB7XG4gICAgbWFpbjogXCJtYWluXCIsXG4gICAgcHVyY2hhc2VzOiBcInB1cmNoYXNlc1wiLFxuICAgIHByb2R1Y3RzOiBcInByb2R1Y3RzXCIsXG4gIH0sXG59O1xuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGRhdGFiYXNlcyA9IG51bGw7XG5sZXQgdGVhbXMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cblxuLyoqXG4gKiBBdHRlbmQgcXVlIGxlIFNESyBBcHB3cml0ZSBzb2l0IGNoYXJnXHUwMEU5IGV0IGluaXRpYWxpc2UgbGVzIGNsaWVudHNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlIHF1aSBzZSByXHUwMEU5c291dCBxdWFuZCBsJ2luaXRpYWxpc2F0aW9uIGVzdCB0ZXJtaW5cdTAwRTllXG4gKi9cbmZ1bmN0aW9uIHdhaXRGb3JBcHB3cml0ZShtYXhBdHRlbXB0cyA9IDUwLCBpbnRlcnZhbCA9IDEwMCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGxldCBhdHRlbXB0cyA9IDA7XG5cbiAgICBmdW5jdGlvbiBjaGVja0FwcHdyaXRlKCkge1xuICAgICAgYXR0ZW1wdHMrKztcbiAgICAgIGlmIChcbiAgICAgICAgd2luZG93LkFwcHdyaXRlICYmXG4gICAgICAgIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiZcbiAgICAgICAgd2luZG93LkFwcHdyaXRlLkFjY291bnRcbiAgICAgICkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2UgaWYgKGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJbQXBwd3JpdGUgQ2xpZW50XSBTREsgQXBwd3JpdGUgbm9uIGNoYXJnXHUwMEU5IGFwclx1MDBFOHMgbGUgbm9tYnJlIG1heGltdW0gZGUgdGVudGF0aXZlc1wiLFxuICAgICAgICApO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiTGUgU0RLIEFwcHdyaXRlIG4nYSBwYXMgcHUgXHUwMEVBdHJlIGNoYXJnXHUwMEU5LlwiKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjaGVja0FwcHdyaXRlKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEluaXRpYWxpc2UgbGVzIGNsaWVudHMgQXBwd3JpdGUgKHVuZSBzZXVsZSBmb2lzKVxuICogQHJldHVybnMge1Byb21pc2U8e2NsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zLCBkYXRhYmFzZXN9Pn0gTGVzIGNsaWVudHMgaW5pdGlhbGlzXHUwMEU5c1xuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwd3JpdGUoKSB7XG4gIGlmIChjbGllbnQgJiYgYWNjb3VudCAmJiBmdW5jdGlvbnMgJiYgZGF0YWJhc2VzKSB7XG4gICAgcmV0dXJuIHsgY2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnMsIGRhdGFiYXNlcyB9O1xuICB9XG5cbiAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgIHJldHVybiBpbml0aWFsaXphdGlvblByb21pc2U7XG4gIH1cblxuICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIERcdTAwRTlidXQgZGUgbCdpbml0aWFsaXNhdGlvblwiKTtcbiAgICAgIGF3YWl0IHdhaXRGb3JBcHB3cml0ZSgpO1xuXG4gICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zLCBEYXRhYmFzZXMsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAuc2V0RW5kcG9pbnQoQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50KVxuICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9DT05GSUcucHJvamVjdElkKTtcblxuICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG4gICAgICBkYXRhYmFzZXMgPSBuZXcgRGF0YWJhc2VzKGNsaWVudCk7XG4gICAgICB0ZWFtcyA9IG5ldyBUZWFtcyhjbGllbnQpO1xuXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucywgZGF0YWJhc2VzLCB0ZWFtcyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsXG4gICAgICAgIGVycm9yLFxuICAgICAgKTtcbiAgICAgIGNsaWVudCA9IG51bGw7XG4gICAgICBhY2NvdW50ID0gbnVsbDtcbiAgICAgIGZ1bmN0aW9ucyA9IG51bGw7XG4gICAgICBkYXRhYmFzZXMgPSBudWxsO1xuICAgICAgdGVhbXMgPSBudWxsO1xuICAgICAgaW5pdGlhbGl6YXRpb25Qcm9taXNlID0gbnVsbDtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vLyAtLS0gRm9uY3Rpb25zIGV4cG9ydFx1MDBFOWVzIC0tLVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBcHB3cml0ZUNsaWVudHMoKSB7XG4gIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWNjb3VudCgpIHtcbiAgaWYgKCFhY2NvdW50KSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGFjY291bnQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlYW1zKCkge1xuICBpZiAoIXRlYW1zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIHRlYW1zO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGdW5jdGlvbnMoKSB7XG4gIGlmICghZnVuY3Rpb25zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YWJhc2VzKCkge1xuICBpZiAoIWRhdGFiYXNlcykgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gIHJldHVybiBkYXRhYmFzZXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgcmV0dXJuIHtcbiAgICBBUFBXUklURV9FTkRQT0lOVDogQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50LFxuICAgIEFQUFdSSVRFX1BST0pFQ1RfSUQ6IEFQUFdSSVRFX0NPTkZJRy5wcm9qZWN0SWQsXG4gICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQ6IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY21zQXV0aCxcbiAgICBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRDogQVBQV1JJVEVfQ09ORklHLmZ1bmN0aW9ucy5hY2Nlc3NSZXF1ZXN0LFxuICAgIEFQUFdSSVRFX0NPTkZJRzogQVBQV1JJVEVfQ09ORklHLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0luaXRpYWxpemVkKCkge1xuICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zICYmIGRhdGFiYXNlcyAmJiB0ZWFtcyk7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgY29uc3QgY21zVXNlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiKTtcbiAgaWYgKCFjbXNVc2VyKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICBpZiAoXG4gICAgICBwYXJzZWRVc2VyLnRva2VuICYmXG4gICAgICB0eXBlb2YgcGFyc2VkVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgcGFyc2VkVXNlci50b2tlbi50cmltKCkgIT09IFwiXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBwYXJzZWRVc2VyO1xuICAgIH1cbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkQ21zKCkge1xuICByZXR1cm4gZ2V0TG9jYWxDbXNVc2VyKCkgIT09IG51bGw7XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIHVuZSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZSBleGlzdGUuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVnJhaSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5LCBzaW5vbiBmYXV4LlxuICovXG5hc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgYXdhaXQgYWNjLmdldCgpOyAvLyBMXHUwMEU4dmUgdW5lIGV4Y2VwdGlvbiBzaSBhdWN1bmUgc2Vzc2lvbiBuJ2VzdCBhY3RpdmVcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgY29ubmVjdFx1MDBFOSBhdmVjIHVuZSBzZXNzaW9uIEFwcHdyaXRlIHZhbGlkZS5cbiAqIENldHRlIGZvbmN0aW9uIHZcdTAwRTlyaWZpZSBcdTAwRTAgbGEgZm9pcyBsZSBjb21wdGUgdXRpbGlzYXRldXIgRVQgbGEgdmFsaWRpdFx1MDBFOSBkZSBsYSBzZXNzaW9uLlxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFZyYWkgc2kgYXV0aGVudGlmaVx1MDBFOSBhdmVjIHNlc3Npb24gYWN0aXZlLCBzaW5vbiBmYXV4XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzQ29ubmVjdGVkQXBwd3JpdGUoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuXG4gICAgLy8gVlx1MDBFOXJpZmllciBsZSBjb21wdGUgdXRpbGlzYXRldXJcbiAgICBjb25zdCBhY2NvdW50RGF0YSA9IGF3YWl0IGFjYy5nZXQoKTtcbiAgICBpZiAoIWFjY291bnREYXRhIHx8ICFhY2NvdW50RGF0YS4kaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWXHUwMEU5cmlmaWVyIGV4cGxpY2l0ZW1lbnQgbGEgc2Vzc2lvbiBjb3VyYW50ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBhY2MuZ2V0U2Vzc2lvbihcImN1cnJlbnRcIik7XG4gICAgaWYgKCFzZXNzaW9uIHx8ICFzZXNzaW9uLiRpZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHNlc3Npb24gbidlc3QgcGFzIGV4cGlyXHUwMEU5ZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZXhwaXJlRGF0ZSA9IG5ldyBEYXRlKHNlc3Npb24uZXhwaXJlKTtcbiAgICBpZiAobm93ID49IGV4cGlyZURhdGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXNzaW9uIHZhbGlkZSAtIHJldG91cm5lciB0cnVlIHNpbXBsZW1lbnRcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY2hlY2tpbmcgY29ubmVjdGlvbjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2MuZ2V0KCk7XG4gICAgcmV0dXJuIHVzZXIuZW1haWxWZXJpZmljYXRpb24gfHwgZmFsc2U7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3QgdmVyaWZpY2F0aW9uVVJMID1cbiAgICAgIHJlZGlyZWN0VVJMIHx8IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L3ZlcmlmeS1lbWFpbGA7XG4gICAgYXdhaXQgYWNjLmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbCdlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOlwiLFxuICAgICAgZXJyb3IsXG4gICAgKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFjYyA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2MudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgXCJbQXBwd3JpdGVDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uIGQnZW1haWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEF1dGhlbnRpY2F0aW9uU3RhdGUoKSB7XG4gIGNvbnN0IGNtc1VzZXIgPSBnZXRMb2NhbENtc1VzZXIoKTtcbiAgaWYgKCFjbXNVc2VyKVxuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZSxcbiAgICB9O1xuICB0cnkge1xuICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICByZXR1cm4ge1xuICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBlbWFpbFZlcmlmaWVkLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZCxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHRydWUsXG4gICAgICBpc0VtYWlsVmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VXNlckVtYWlsKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiYXBwd3JpdGUtdXNlci1uYW1lXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzXCIpO1xufVxuXG5mdW5jdGlvbiBjbGVhckF1dGhEYXRhKCkge1xuICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiYXBwd3JpdGUtdXNlci1lbWFpbFwiKTtcbiAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1c1wiKTtcbn1cbi8qKlxuICogVmFsaWRlIGV0IHByXHUwMEU5cGFyZSBsZXMgZG9ublx1MDBFOWVzIG5cdTAwRTljZXNzYWlyZXMgcG91ciBsYSBjclx1MDBFOWF0aW9uIHRyYW5zYWN0aW9ubmVsbGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7ZXZlbnREYXRhLCB1c2VyLCBjb250ZW50SGFzaH0+fSBEb25uXHUwMEU5ZXMgdmFsaWRcdTAwRTllc1xuICovXG5hc3luYyBmdW5jdGlvbiB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCkge1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gVmFsaWRhdGlvbiBkZXMgZG9ublx1MDBFOWVzIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICApO1xuXG4gIC8vIFJcdTAwRTljdXBcdTAwRTlyZXIgZXQgdmFsaWRlciBsZXMgZG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgIGAvZXZlbmVtZW50cy8ke2V2ZW50SWR9L2luZ3JlZGllbnRzX2F3L2luZGV4Lmpzb25gLFxuICApO1xuICBpZiAoIXJlc3BvbnNlLm9rKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGVzIGRvbm5cdTAwRTllcyBkZSBsJ1x1MDBFOXZcdTAwRTluZW1lbnQ6ICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgKTtcbiAgY29uc3QgZXZlbnREYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudCByXHUwMEU5Y3VwXHUwMEU5clx1MDBFOWVzOmAsXG4gICAgZXZlbnREYXRhLFxuICApO1xuXG4gIGNvbnN0IHsgYWNjb3VudCwgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBVdGlsaXNhdGV1ciBhdXRoZW50aWZpXHUwMEU5OiAke3VzZXIuJGlkfWApO1xuXG4gIC8vIFZcdTAwRTlyaWZpZXIgc2kgbCdcdTAwRTl2XHUwMEU5bmVtZW50IGV4aXN0ZSBkXHUwMEU5alx1MDBFMFxuICB0cnkge1xuICAgIGF3YWl0IGRhdGFiYXNlcy5nZXREb2N1bWVudChcbiAgICAgIEFQUFdSSVRFX0NPTkZJRy5kYXRhYmFzZUlkLFxuICAgICAgQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zLm1haW4sXG4gICAgICBldmVudElkLFxuICAgICk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gTCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH0gZXhpc3RlIGRcdTAwRTlqXHUwMEUwIGRhbnMgbWFpbmAsXG4gICAgKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGAvc3ZfcHJvZHVjdHMvP2xpc3RJZD0ke2V2ZW50SWR9YDtcbiAgICByZXR1cm4gbnVsbDsgLy8gUmV0b3VybmVyIG51bGwgcG91ciBpbmRpcXVlciB1bmUgcmVkaXJlY3Rpb25cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gNDA0KSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBSXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIGhhc2ggZGVwdWlzIGxlcyBwYXJhbVx1MDBFOHRyZXMgZ2xvYmF1eFxuICBjb25zdCBjb250ZW50SGFzaCA9IHdpbmRvdy5fX0hVR09fUEFSQU1TX18/Lmxpc3RDb250ZW50SGFzaDtcbiAgaWYgKCFjb250ZW50SGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlIGhhc2ggZHUgY29udGVudSBuJ2VzdCBwYXMgZFx1MDBFOWZpbmlcIik7XG4gIH1cblxuICByZXR1cm4geyBldmVudERhdGEsIHVzZXIsIGNvbnRlbnRIYXNoIH07XG59XG5cbi8qKlxuICogQXBwZWxsZSBsYSBmb25jdGlvbiBBcHB3cml0ZSBjXHUwMEY0dFx1MDBFOSBzZXJ2ZXVyIHBvdXIgY3JcdTAwRTllciBsYSBsaXN0ZVxuICogVXRpbGlzZSBsZSBTREsgQXBwd3JpdGUgcG91ciBcdTAwRTl2aXRlciBsZXMgcHJvYmxcdTAwRThtZXMgQ09SU1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZXZlbnREYXRhIC0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50SGFzaCAtIEhhc2ggZHUgY29udGVudVxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgZXZlbnRJZCxcbiAgZXZlbnREYXRhLFxuICB1c2VySWQsXG4gIGNvbnRlbnRIYXNoLFxuKSB7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBBcHBlbCBkZSBsYSBmb25jdGlvbiBzZXJ2ZXVyIHBvdXIgJHtldmVudElkfWApO1xuXG4gIC8vIElEIHJcdTAwRTllbCBkZSB2b3RyZSBmb25jdGlvbiBBcHB3cml0ZVxuICBjb25zdCBGVU5DVElPTl9JRCA9IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY3JlYXRlUHJvZHVjdExpc3Q7XG5cbiAgY29uc3QgeyBmdW5jdGlvbnMgfSA9IGF3YWl0IGluaXRpYWxpemVBcHB3cml0ZSgpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgIEZVTkNUSU9OX0lELFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBldmVudElkLFxuICAgICAgICBldmVudERhdGEsXG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgY29udGVudEhhc2gsXG4gICAgICB9KSxcbiAgICAgIHRydWUsIC8vIGFzeW5jID0gdHJ1ZSAtIEVYXHUwMEM5Q1VUSU9OIEFTWU5DSFJPTkVcbiAgICAgIFwiL1wiLCAvLyBwYXRoIChvcHRpb25uZWwpXG4gICAgICBcIkdFVFwiLCAvLyBtZXRob2QgKG9wdGlvbm5lbClcbiAgICAgIHt9LCAvLyBQYXMgYmVzb2luIGQnZW4tdFx1MDBFQXRlcyBwZXJzb25uYWxpc1x1MDBFOXNcbiAgICApO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gZFx1MDBFOW1hcnJcdTAwRTllIGVuIG1vZGUgYXN5bmNocm9uZTpgLFxuICAgICAgcmVzdWx0LFxuICAgICk7XG5cbiAgICAvLyBFbiBtb2RlIGFzeW5jaHJvbmUsIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzLCBvbiBuZSBmYWl0IHBhcyBkZSBwb2xsaW5nXG4gICAgLy8gTGEgZm9uY3Rpb24gdmEgcydleFx1MDBFOWN1dGVyIGVuIGFycmlcdTAwRThyZS1wbGFuIGV0IG9uIHN1cHBvc2UgcXVlIFx1MDBFN2EgdmEgclx1MDBFOXVzc2lyXG4gICAgY29uc3QgZXhlY3V0aW9uSWQgPSByZXN1bHQuJGlkO1xuICAgIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBFeGVjdXRpb24gSUQ6ICR7ZXhlY3V0aW9uSWR9YCk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gYXN5bmMgZFx1MDBFOW1hcnJcdTAwRTllIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzIC0gcGFzIGRlIHBvbGxpbmdgLFxuICAgICk7XG5cbiAgICAvLyBQb3VyIDMwMCsgaW5nclx1MDBFOWRpZW50cywgb24gcmV0b3VybmUgaW1tXHUwMEU5ZGlhdGVtZW50IHVuIHN1Y2NcdTAwRThzXG4gICAgLy8gTCd1dGlsaXNhdGV1ciB2ZXJyYSBsZXMgclx1MDBFOXN1bHRhdHMgcXVhbmQgbGEgZm9uY3Rpb24gYXVyYSB0ZXJtaW5cdTAwRTlcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGV2ZW50SWQsXG4gICAgICBleGVjdXRpb25JZCxcbiAgICAgIG1lc3NhZ2U6IFwiVHJhaXRlbWVudCBkXHUwMEU5bWFyclx1MDBFOSBlbiBhcnJpXHUwMEU4cmUtcGxhbiAoMzAwKyBpbmdyXHUwMEU5ZGllbnRzKVwiLFxuICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnYXBwZWwgZm9uY3Rpb246YCwgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogRm9uY3Rpb24gcHJpbmNpcGFsZSAtIGNyXHUwMEU5ZSB1bmUgbGlzdGUgZGUgcHJvZHVpdHMgY29sbGFib3JhdGlmc1xuICogVXRpbGlzZSBtYWludGVuYW50IGxhIGZvbmN0aW9uIEFwcHdyaXRlIGNcdTAwRjR0XHUwMEU5IHNlcnZldXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29sbGFib3JhdGl2ZVByb2R1Y3RzTGlzdEZyb21FdmVudChldmVudElkKSB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWJ1dCBkZSBsYSBjclx1MDBFOWF0aW9uIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICAgICk7XG5cbiAgICAvLyAxLiBWYWxpZGF0aW9uIGV0IHByXHUwMEU5cGFyYXRpb24gZGVzIGRvbm5cdTAwRTllc1xuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSBhd2FpdCB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCk7XG4gICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0KSB7XG4gICAgICAvLyBSZWRpcmVjdGlvbiBkXHUwMEU5alx1MDBFMCBnXHUwMEU5clx1MDBFOWUgZGFucyB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGFcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IGV2ZW50RGF0YSwgdXNlciwgY29udGVudEhhc2ggfSA9IHZhbGlkYXRpb25SZXN1bHQ7XG4gICAgY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIERvbm5cdTAwRTllcyB2YWxpZFx1MDBFOWVzLCBhcHBlbCBkZSBsYSBmb25jdGlvbmApO1xuXG4gICAgLy8gMi4gQXBwZWwgZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgY1x1MDBGNHRcdTAwRTkgc2VydmV1clxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgICAgIGV2ZW50SWQsXG4gICAgICBldmVudERhdGEsXG4gICAgICB1c2VyLiRpZCxcbiAgICAgIGNvbnRlbnRIYXNoLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBPcFx1MDBFOXJhdGlvbiByXHUwMEU5dXNzaWUsIHJlZGlyZWN0aW9uIHZlcnMgbGEgbGlzdGVgLFxuICAgICk7XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgL3N2X3Byb2R1Y3RzLz9saXN0SWQ9JHtldmVudElkfWA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBjclx1MDBFOWF0aW9uOmAsXG4gICAgICBlcnJvci5tZXNzYWdlLFxuICAgICk7XG5cbiAgICAvLyBHZXN0aW9uIGRlcyBlcnJldXJzIHNwXHUwMEU5Y2lmaXF1ZXNcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhcImFscmVhZHlfZXhpc3RzXCIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2V0dGUgbGlzdGUgZGUgcHJvZHVpdHMgZXhpc3RlIGRcdTAwRTlqXHUwMEUwLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBhdmVjIHVuIElEIGRpZmZcdTAwRTlyZW50LlwiLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoXCJ0cmFuc2FjdGlvbl9saW1pdF9leGNlZWRlZFwiKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkxpbWl0ZSBkZSB0cmFuc2FjdGlvbnMgZFx1MDBFOXBhc3NcdTAwRTllLiBWZXVpbGxleiByXHUwMEU5ZHVpcmUgbGUgbm9tYnJlIGQnaW5nclx1MDBFOWRpZW50cyBvdSByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tFeGlzdGluZ01haW5Hcm91cChtYWluR3JvdXBJZCkge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHNpIGxlIGRvY3VtZW50IGV4aXN0ZSBkaXJlY3RlbWVudCBkYW5zIGxhIGNvbGxlY3Rpb24gJ21haW4nXG4gICAgY29uc3QgZXhpc3RpbmdNYWluR3JvdXAgPSBhd2FpdCBkYXRhYmFzZXMuZ2V0RG9jdW1lbnQoXG4gICAgICBcIjY4OWQxNWIxMDAwM2E1YTEzNjM2XCIsXG4gICAgICBcIm1haW5cIixcbiAgICAgIG1haW5Hcm91cElkLFxuICAgICk7XG4gICAgcmV0dXJuICEhZXhpc3RpbmdNYWluR3JvdXA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBMZSBkb2N1bWVudCBuJ2V4aXN0ZSBwYXNcbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIFwiW0FwcHdyaXRlIENsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZHUgbWFpbiBncm91cCBleGlzdGFudDpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgdHJ5IHtcbiAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGF3YWl0IGFjYy5kZWxldGVTZXNzaW9uKFwiY3VycmVudFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIGRcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgKHBldXQtXHUwMEVBdHJlIGRcdTAwRTlqXHUwMEUwIGRcdTAwRTljb25uZWN0XHUwMEU5KTpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIsIGVtYWlsKTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIiwgbmFtZSk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8qKlxuICogUydhYm9ubmUgYXV4IG1pc2VzIFx1MDBFMCBqb3VyIHRlbXBzIHJcdTAwRTllbCBwb3VyIHVuZSBsaXN0ZSBkZSBjb2xsZWN0aW9ucy5cbiAqIFV0aWxpc2UgbCdBUEkgQXBwd3JpdGUgc3Vic2NyaWJlKCkgcXVpIGdcdTAwRThyZSBhdXRvbWF0aXF1ZW1lbnQgbGVzIGNvbm5leGlvbnMgV2ViU29ja2V0LlxuICogQHBhcmFtIHtzdHJpbmdbXX0gY29sbGVjdGlvbk5hbWVzIC0gTm9tcyBkZXMgY29sbGVjdGlvbnMgKGV4OiBbJ2luZ3JlZGllbnRzJywgJ3B1cmNoYXNlcyddKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0SWQgLSBJRCBkZSBsYSBsaXN0ZSAocG91ciBmaWx0cmFnZSBzaSBuXHUwMEU5Y2Vzc2FpcmUpLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gb25NZXNzYWdlIC0gQ2FsbGJhY2sgcG91ciBsZXMgbWVzc2FnZXMgZGUgZG9ublx1MDBFOWVzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbm5lY3Rpb25DYWxsYmFja3MgLSBDYWxsYmFja3MgcG91ciBsZXMgXHUwMEU5dlx1MDBFOW5lbWVudHMgZGUgY29ubmV4aW9uLlxuICogQHJldHVybnMge2Z1bmN0aW9ufSBVbmUgZm9uY3Rpb24gcG91ciBzZSBkXHUwMEU5c2Fib25uZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zKFxuICBjb2xsZWN0aW9uTmFtZXMsXG4gIGxpc3RJZCxcbiAgb25NZXNzYWdlLFxuICBjb25uZWN0aW9uQ2FsbGJhY2tzID0ge30sXG4pIHtcbiAgY29uc3QgeyBvbkNvbm5lY3QsIG9uRGlzY29ubmVjdCwgb25FcnJvciB9ID0gY29ubmVjdGlvbkNhbGxiYWNrcztcblxuICBpZiAoIWNsaWVudCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIkltcG9zc2libGUgZGUgcydhYm9ubmVyIDogbGUgY2xpZW50IEFwcHdyaXRlIG4nZXN0IHBhcyBlbmNvcmUgaW5pdGlhbGlzXHUwMEU5LlwiLFxuICAgICk7XG4gICAgb25FcnJvcj8uKHsgbWVzc2FnZTogXCJDbGllbnQgQXBwd3JpdGUgbm9uIGluaXRpYWxpc1x1MDBFOVwiIH0pO1xuICAgIHJldHVybiAoKSA9PiB7fTtcbiAgfVxuXG4gIGNvbnN0IGNoYW5uZWxzID0gY29sbGVjdGlvbk5hbWVzXG4gICAgLm1hcCgobmFtZSkgPT4ge1xuICAgICAgY29uc3QgY29sbGVjdGlvbklkID0gQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBOb20gZGUgY29sbGVjdGlvbiBpbmNvbm51IGRhbnMgbGEgY29uZmlndXJhdGlvbjogJHtuYW1lfWAsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGBkYXRhYmFzZXMuJHtBUFBXUklURV9DT05GSUcuZGF0YWJhc2VJZH0uY29sbGVjdGlvbnMuJHtjb2xsZWN0aW9uSWR9LmRvY3VtZW50c2A7XG4gICAgfSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQWJvbm5lbWVudCBhdXggY2FuYXV4IGVuIGNvdXJzLi4uXCIsIGNoYW5uZWxzKTtcblxuICB0cnkge1xuICAgIC8vIExhIG1cdTAwRTl0aG9kZSBjbGllbnQuc3Vic2NyaWJlKCkgZ1x1MDBFOHJlIGF1dG9tYXRpcXVlbWVudCBsYSBjb25uZXhpb24gV2ViU29ja2V0XG4gICAgLy8gc2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBvZmZpY2llbGxlIEFwcHdyaXRlXG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSBjbGllbnQuc3Vic2NyaWJlKGNoYW5uZWxzLCAocmVzcG9uc2UpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWNlcHRpb24gdGVtcHMgclx1MDBFOWVsOlwiLCByZXNwb25zZSk7XG4gICAgICBvbk1lc3NhZ2UocmVzcG9uc2UpO1xuICAgIH0pO1xuXG4gICAgLy8gU2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBBcHB3cml0ZSwgbGEgc3Vic2NyaXB0aW9uIGVzdCBhdXRvbWF0aXF1ZW1lbnQgYWN0aXZlXG4gICAgLy8gT24gcGV1dCBjb25zaWRcdTAwRTlyZXIgbGEgY29ubmV4aW9uIGNvbW1lIFx1MDBFOXRhYmxpZSBpbW1cdTAwRTlkaWF0ZW1lbnRcbiAgICBpZiAob25Db25uZWN0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBDb25uZXhpb24gdGVtcHMgclx1MDBFOWVsIFx1MDBFOXRhYmxpZVwiKTtcbiAgICAgICAgb25Db25uZWN0KCk7XG4gICAgICB9LCA1MCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHNvdXNjcmlwdGlvbiB0ZW1wcyByXHUwMEU5ZWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIG9uRXJyb3I/LihlcnJvcik7XG4gICAgcmV0dXJuICgpID0+IHt9OyAvLyBSZXRvdXJuZXIgdW5lIGZvbmN0aW9uIHZpZGUgZW4gY2FzIGQnZXJyZXVyXG4gIH1cbn1cblxuLy8gRXhwb3J0IGRlcyBmb25jdGlvbnMgcHVibGlxdWVzXG5leHBvcnQge1xuICBBUFBXUklURV9DT05GSUcsIC8vIEFqb3V0XHUwMEU5IHBvdXIgY29uc29saWRlciBsZXMgZXhwb3J0c1xuICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gIGdldEFjY291bnQsXG4gIGdldEZ1bmN0aW9ucyxcbiAgZ2V0VGVhbXMsXG4gIGdldERhdGFiYXNlcyxcbiAgZ2V0Q29uZmlnLFxuICBpc0luaXRpYWxpemVkLFxuICBpbml0aWFsaXplQXBwd3JpdGUsXG4gIGdldExvY2FsQ21zVXNlcixcbiAgaXNBdXRoZW50aWNhdGVkQ21zLFxuICBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSxcbiAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgZ2V0VXNlckVtYWlsLFxuICBnZXRVc2VyTmFtZSxcbiAgY2xlYXJBdXRoRGF0YSxcbiAgc2V0QXV0aERhdGEsXG4gIGxvZ291dEdsb2JhbCxcbiAgaXNFbWFpbFZlcmlmaWVkLFxuICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gIHZlcmlmeUVtYWlsLFxuICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICBjcmVhdGVDb2xsYWJvcmF0aXZlUHJvZHVjdHNMaXN0RnJvbUV2ZW50LFxuICBjaGVja0V4aXN0aW5nTWFpbkdyb3VwLFxufTtcblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgIGdldEFwcHdyaXRlQ2xpZW50cyxcbiAgICBnZXRBY2NvdW50LFxuICAgIGdldEZ1bmN0aW9ucyxcbiAgICBnZXREYXRhYmFzZXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMsXG4gICAgaXNBdXRoZW50aWNhdGVkQXBwd3JpdGUsXG4gICAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgICBnZXRVc2VyRW1haWwsXG4gICAgZ2V0VXNlck5hbWUsXG4gICAgY2xlYXJBdXRoRGF0YSxcbiAgICBzZXRBdXRoRGF0YSxcbiAgICBsb2dvdXRHbG9iYWwsXG4gICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgICB2ZXJpZnlFbWFpbCxcbiAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICAgIGNyZWF0ZUNvbGxhYm9yYXRpdmVQcm9kdWN0c0xpc3RGcm9tRXZlbnQsXG4gICAgY2hlY2tFeGlzdGluZ01haW5Hcm91cCxcbiAgICBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zLFxuICB9O1xufVxuIiwgIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2hhbmRsZS1pbnZpdGF0aW9uLmpzXG5cbmltcG9ydCB7IGdldEFwcHdyaXRlQ2xpZW50cywgZ2V0QWNjb3VudCwgZ2V0VGVhbXMsIGdldENvbmZpZywgaXNBdXRoZW50aWNhdGVkQ21zIH0gZnJvbSAnLi9hcHB3cml0ZS1jbGllbnQuanMnO1xuXG4vLyBjb25zb2xlLmxvZyhcIltIYW5kbGUtSW52aXRhdGlvbl0gU2NyaXB0IGNoYXJnXHUwMEU5XCIpO1xuXG4vLyBSXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxhIGNvbmZpZ3VyYXRpb25cbmNvbnN0IHsgQVBQV1JJVEVfRU5EUE9JTlQsIEFQUFdSSVRFX1BST0pFQ1RfSUQgfSA9IGdldENvbmZpZygpO1xuXG4vLyBMJ0lEIGRlIGwnXHUwMEU5cXVpcGUgZGFucyBsYXF1ZWxsZSBpbnZpdGVyIChsJ1x1MDBFOXF1aXBlIHByaW5jaXBhbGUsIFBBUyBsZXMgYWRtaW5zKVxuY29uc3QgVEVBTV9JRF9UT19JTlZJVEUgPSBcIjY4OWJmNmZlMDAwNjYyN2Q4OTU5XCI7XG5cbi8vIC0tLSBTVE9DS0FHRSBMT0NBTCBQT1VSIFx1MDBDOVZJVEVSIExFUyBET1VCTE9OUyAtLS1cbmNvbnN0IElOVklUQVRJT05fU0VOVF9LRVkgPSAnaW52aXRhdGlvbl9zZW50X2VtYWlscyc7XG5cbi8vIC0tLSBERUJVRyAtLS1cbmNvbnN0IERFQlVHX01PREUgPSBmYWxzZTtcblxuLyoqXG4gKiBOZXR0b2llIGwnaGlzdG9yaXF1ZSBkZXMgaW52aXRhdGlvbnMgZW52b3lcdTAwRTllc1xuICovXG5mdW5jdGlvbiBjbGVhckludml0YXRpb25IaXN0b3J5KCkge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKElOVklUQVRJT05fU0VOVF9LRVkpO1xuICAgIGRlYnVnTG9nKFwiSGlzdG9yaXF1ZSBkZXMgaW52aXRhdGlvbnMgbmV0dG95XHUwMEU5XCIpO1xufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSB1bmUgaW52aXRhdGlvbiBhIGRcdTAwRTlqXHUwMEUwIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIHBvdXIgdW4gZW1haWxcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgXHUwMEUwIHZcdTAwRTlyaWZpZXJcbiAqIEByZXR1cm5zIHtib29sZWFufSAtIFRydWUgc2kgbCdpbnZpdGF0aW9uIGEgZFx1MDBFOWpcdTAwRTAgXHUwMEU5dFx1MDBFOSBlbnZveVx1MDBFOWVcbiAqL1xuZnVuY3Rpb24gaGFzSW52aXRhdGlvbkJlZW5TZW50KGVtYWlsKSB7XG4gICAgY29uc3Qgc2VudEVtYWlscyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oSU5WSVRBVElPTl9TRU5UX0tFWSkgfHwgJ1tdJyk7XG4gICAgcmV0dXJuIHNlbnRFbWFpbHMuaW5jbHVkZXMoZW1haWwpO1xufVxuXG4vKipcbiAqIE1hcnF1ZSB1bmUgaW52aXRhdGlvbiBjb21tZSBlbnZveVx1MDBFOWVcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCdpbnZpdGF0aW9uIGVudm95XHUwMEU5ZVxuICovXG5mdW5jdGlvbiBtYXJrSW52aXRhdGlvbkFzU2VudChlbWFpbCkge1xuICAgIGNvbnN0IHNlbnRFbWFpbHMgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKElOVklUQVRJT05fU0VOVF9LRVkpIHx8ICdbXScpO1xuICAgIGlmICghc2VudEVtYWlscy5pbmNsdWRlcyhlbWFpbCkpIHtcbiAgICAgICAgc2VudEVtYWlscy5wdXNoKGVtYWlsKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oSU5WSVRBVElPTl9TRU5UX0tFWSwgSlNPTi5zdHJpbmdpZnkoc2VudEVtYWlscykpO1xuICAgICAgICBkZWJ1Z0xvZyhcIkludml0YXRpb24gbWFycXVcdTAwRTllIGNvbW1lIGVudm95XHUwMEU5ZVwiLCB7IGVtYWlsIH0pO1xuICAgIH1cbn1cblxuLy8gLS0tIERPTSBFTEVNRU5UUyAtLS1cbmxldCBzdGF0dXNDb250YWluZXIsIHN0YXR1c01lc3NhZ2UsIHN0YXR1c0RldGFpbHMsIGxvZ2luQnV0dG9uO1xuXG4vKipcbiAqIEpvdXJuYWxpc2F0aW9uIHBvdXIgbGUgZFx1MDBFOWJvZ2FnZVxuICovXG5mdW5jdGlvbiBkZWJ1Z0xvZyhtZXNzYWdlLCBkYXRhID0gbnVsbCkge1xuICAgIGlmIChERUJVR19NT0RFKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGBbSGFuZGxlLUludml0YXRpb24gRGVidWddICR7bWVzc2FnZX1gLCBkYXRhIHx8ICcnKTtcbiAgICB9XG59XG5cbi8qKlxuICogSW5pdGlhbGlzZSBsZXMgXHUwMEU5bFx1MDBFOW1lbnRzIERPTVxuICovXG5mdW5jdGlvbiBpbml0aWFsaXplRE9NRWxlbWVudHMoKSB7XG4gICAgc3RhdHVzQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXR1cy1jb250YWluZXInKTtcbiAgICBzdGF0dXNNZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXR1cy1tZXNzYWdlJyk7XG4gICAgc3RhdHVzRGV0YWlscyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtZGV0YWlscycpO1xuICAgIGxvZ2luQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luLWJ1dHRvbicpO1xuXG4gICAgZGVidWdMb2coXCJcdTAwQzlsXHUwMEU5bWVudHMgRE9NIGluaXRpYWxpc1x1MDBFOXNcIiwge1xuICAgICAgICBzdGF0dXNDb250YWluZXI6ICEhc3RhdHVzQ29udGFpbmVyLFxuICAgICAgICBzdGF0dXNNZXNzYWdlOiAhIXN0YXR1c01lc3NhZ2UsXG4gICAgICAgIHN0YXR1c0RldGFpbHM6ICEhc3RhdHVzRGV0YWlscyxcbiAgICAgICAgbG9naW5CdXR0b246ICEhbG9naW5CdXR0b25cbiAgICB9KTtcblxuICAgIGlmICghc3RhdHVzQ29udGFpbmVyIHx8ICFzdGF0dXNNZXNzYWdlIHx8ICFzdGF0dXNEZXRhaWxzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNlcnRhaW5zIFx1MDBFOWxcdTAwRTltZW50cyBET00gcmVxdWlzIHNvbnQgbWFucXVhbnRzXCIpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBBZmZpY2hlIGxlIHJcdTAwRTlzdWx0YXQgZmluYWwgZGUgbCdvcFx1MDBFOXJhdGlvbi5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gJ3N1Y2Nlc3MnLCAnZGFuZ2VyJywgJ3dhcm5pbmcnLCAnaW5mbydcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIC0gTGUgbWVzc2FnZSBcdTAwRTAgYWZmaWNoZXJcbiAqL1xuZnVuY3Rpb24gc2hvd1Jlc3VsdCh0eXBlLCBtZXNzYWdlKSB7XG4gICAgZGVidWdMb2coYEFmZmljaGFnZSBkdSByXHUwMEU5c3VsdGF0OiAke3R5cGV9YCwgbWVzc2FnZSk7XG5cbiAgICBpZiAoc3RhdHVzQ29udGFpbmVyKSBzdGF0dXNDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZiAoc3RhdHVzRGV0YWlscykge1xuICAgICAgICBzdGF0dXNEZXRhaWxzLmNsYXNzTmFtZSA9IGBhbGVydCBhbGVydC0ke3R5cGV9IG15LTJgO1xuICAgICAgICBzdGF0dXNEZXRhaWxzLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICAgICAgc3RhdHVzRGV0YWlscy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG59XG5cbi8qKlxuICogTWV0IFx1MDBFMCBqb3VyIGxlIG1lc3NhZ2UgZGUgc3RhdHV0XG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAtIExlIG1lc3NhZ2UgXHUwMEUwIGFmZmljaGVyXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZVN0YXR1c01lc3NhZ2UobWVzc2FnZSkge1xuICAgIGRlYnVnTG9nKFwiTWlzZSBcdTAwRTAgam91ciBkdSBtZXNzYWdlIGRlIHN0YXR1dFwiLCBtZXNzYWdlKTtcbiAgICBpZiAoc3RhdHVzTWVzc2FnZSkge1xuICAgICAgICBzdGF0dXNNZXNzYWdlLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG59XG5cbi8qKlxuICogTG9naXF1ZSBwcmluY2lwYWxlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUludml0YXRpb24oKSB7XG4gICAgbGV0IHJlcXVlc3RlckVtYWlsID0gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICAgIGRlYnVnTG9nKFwiRFx1MDBFOW1hcnJhZ2UgZHUgdHJhaXRlbWVudCBkZSBsJ2ludml0YXRpb25cIik7XG4gICAgICAgIGRlYnVnTG9nKFwiVVJMIGFjdHVlbGxlOlwiLCB3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgICAgIGRlYnVnTG9nKFwiUGFyYW1cdTAwRTh0cmVzIFVSTDpcIiwgd2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG5cbiAgICAgICAgLy8gMS4gSW5pdGlhbGlzZXIgbGVzIFx1MDBFOWxcdTAwRTltZW50cyBET01cbiAgICAgICAgaW5pdGlhbGl6ZURPTUVsZW1lbnRzKCk7XG5cbiAgICAgICAgLy8gMi4gSW5pdGlhbGlzZXIgbGVzIGNsaWVudHMgQXBwd3JpdGUgdmlhIGxlIG1vZHVsZSBjb21tdW5cbiAgICAgICAgdXBkYXRlU3RhdHVzTWVzc2FnZShcIkluaXRpYWxpc2F0aW9uIGR1IGNsaWVudCBBcHB3cml0ZS4uLlwiKTtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdGVhbXMgPSBhd2FpdCBnZXRUZWFtcygpO1xuXG4gICAgICAgIGRlYnVnTG9nKFwiQ2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXCIpO1xuICAgICAgICBkZWJ1Z0xvZyhcIkNvbmZpZ3VyYXRpb246XCIsIHtcbiAgICAgICAgICAgIGVuZHBvaW50OiBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgICAgIHByb2plY3RJZDogQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgICAgIHRlYW1JZDogVEVBTV9JRF9UT19JTlZJVEVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gMy4gRXh0cmFpcmUgbCdlbWFpbCBkdSBkZW1hbmRldXIgZGVwdWlzIGwnVVJMXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG4gICAgICAgIHJlcXVlc3RlckVtYWlsID0gcGFyYW1zLmdldCgncmVxdWVzdGVyJyk7XG5cbiAgICAgICAgZGVidWdMb2coXCJFbWFpbCBkdSBkZW1hbmRldXIgZXh0cmFpdFwiLCByZXF1ZXN0ZXJFbWFpbCk7XG4gICAgICAgIGRlYnVnTG9nKFwiVG91cyBsZXMgcGFyYW1cdTAwRTh0cmVzIFVSTDpcIiwgT2JqZWN0LmZyb21FbnRyaWVzKHBhcmFtcy5lbnRyaWVzKCkpKTtcblxuICAgICAgICBpZiAoIXJlcXVlc3RlckVtYWlsKSB7XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkVSUkVVUjogRW1haWwgZHUgZGVtYW5kZXVyIG1hbnF1YW50XCIpO1xuICAgICAgICAgICAgc2hvd1Jlc3VsdCgnZGFuZ2VyJywgJ0VtYWlsIGR1IGRlbWFuZGV1ciBtYW5xdWFudCBkYW5zIGxcXCdVUkwuIExlIGxpZW4gZXN0IHBldXQtXHUwMEVBdHJlIGNvcnJvbXB1LicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gNC4gVlx1MDBFOXJpZmllciBzaSBsJ2FkbWluaXN0cmF0ZXVyIGVzdCBjb25uZWN0XHUwMEU5XG4gICAgICAgIHVwZGF0ZVN0YXR1c01lc3NhZ2UoXCJWXHUwMEU5cmlmaWNhdGlvbiBkZSB2b3RyZSBhdXRoZW50aWZpY2F0aW9uLi4uXCIpO1xuICAgICAgICBkZWJ1Z0xvZyhcIlRlbnRhdGl2ZSBkZSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGwndXRpbGlzYXRldXIgY291cmFudC4uLlwiKTtcbiAgICAgICAgY29uc3QgY3VycmVudFVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuXG4gICAgICAgIGRlYnVnTG9nKFwiVXRpbGlzYXRldXIgY29ubmVjdFx1MDBFOVwiLCB7XG4gICAgICAgICAgICBuYW1lOiBjdXJyZW50VXNlci5uYW1lLFxuICAgICAgICAgICAgZW1haWw6IGN1cnJlbnRVc2VyLmVtYWlsLFxuICAgICAgICAgICAgaWQ6IGN1cnJlbnRVc2VyLiRpZFxuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVTdGF0dXNNZXNzYWdlKGBDb25uZWN0XHUwMEU5IGVuIHRhbnQgcXVlICR7Y3VycmVudFVzZXIubmFtZX0uIEVudm9pIGRlIGwnaW52aXRhdGlvbiBcdTAwRTAgJHtyZXF1ZXN0ZXJFbWFpbH0uLi5gKTtcblxuICAgICAgICAvLyA1LiBWXHUwMEU5cmlmaWVyIHNpIHVuZSBpbnZpdGF0aW9uIGEgZFx1MDBFOWpcdTAwRTAgXHUwMEU5dFx1MDBFOSBlbnZveVx1MDBFOWUgcG91ciBjZXQgZW1haWxcbiAgICAgICAgZGVidWdMb2coXCJWXHUwMEU5cmlmaWNhdGlvbiBkZXMgaW52aXRhdGlvbnMgcHJcdTAwRTljXHUwMEU5ZGVudGVzXCIsIHsgZW1haWw6IHJlcXVlc3RlckVtYWlsIH0pO1xuXG4gICAgICAgIGlmIChoYXNJbnZpdGF0aW9uQmVlblNlbnQocmVxdWVzdGVyRW1haWwpKSB7XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkludml0YXRpb24gZFx1MDBFOWpcdTAwRTAgZW52b3lcdTAwRTllIHByXHUwMEU5Y1x1MDBFOWRlbW1lbnQgcG91ciBjZXQgZW1haWxcIiwgeyBlbWFpbDogcmVxdWVzdGVyRW1haWwgfSk7XG4gICAgICAgICAgICBzaG93UmVzdWx0KCd3YXJuaW5nJywgYFVuZSBpbnZpdGF0aW9uIGEgZFx1MDBFOWpcdTAwRTAgXHUwMEU5dFx1MDBFOSBlbnZveVx1MDBFOWUgXHUwMEUwICR7cmVxdWVzdGVyRW1haWx9LiBWZXVpbGxleiBwYXRpZW50ZXIgcXUnZWxsZSBzb2l0IGFjY2VwdFx1MDBFOWUuYCk7XG5cbiAgICAgICAgICAgIC8vIEFqb3V0ZXIgdW4gYm91dG9uIHBvdXIgclx1MDBFOWluaXRpYWxpc2VyIGwnaGlzdG9yaXF1ZVxuICAgICAgICAgICAgaWYgKHN0YXR1c0RldGFpbHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXNldEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICAgICAgICAgIHJlc2V0QnV0dG9uLmNsYXNzTmFtZSA9ICdidG4gYnRuLXdhcm5pbmcgYnRuLXNtIG1zLTInO1xuICAgICAgICAgICAgICAgIHJlc2V0QnV0dG9uLnRleHRDb250ZW50ID0gJ1JcdTAwRTllc3NheWVyJztcbiAgICAgICAgICAgICAgICByZXNldEJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjbGVhckludml0YXRpb25IaXN0b3J5KCk7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHN0YXR1c0RldGFpbHMuYXBwZW5kQ2hpbGQocmVzZXRCdXR0b24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gNi4gRW52b3llciBsJ2ludml0YXRpb24gXHUwMEUwIGwnXHUwMEU5cXVpcGVcbiAgICAgICAgZGVidWdMb2coXCJFbnZvaSBkZSBsJ2ludml0YXRpb24gXHUwMEUwIGwnXHUwMEU5cXVpcGVcIiwge1xuICAgICAgICAgICAgdGVhbUlkOiBURUFNX0lEX1RPX0lOVklURSxcbiAgICAgICAgICAgIGVtYWlsOiByZXF1ZXN0ZXJFbWFpbCxcbiAgICAgICAgICAgIHJvbGVzOiBbJ293bmVyJ10sXG4gICAgICAgICAgICByZWRpcmVjdFVybDogYCR7d2luZG93LmxvY2F0aW9uLm9yaWdpbn0vYWNjZXB0LWludml0YXRpb25gXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IG1lbWJlcnNoaXAgPSBhd2FpdCB0ZWFtcy5jcmVhdGVNZW1iZXJzaGlwKFxuICAgICAgICAgICAgVEVBTV9JRF9UT19JTlZJVEUsXG4gICAgICAgICAgICBbJ293bmVyJ10sIC8vIFJcdTAwRjRsZSBcIm93bmVyXCIgY29tbWUgZGVtYW5kXHUwMEU5XG4gICAgICAgICAgICByZXF1ZXN0ZXJFbWFpbCxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L2FjY2VwdC1pbnZpdGF0aW9uYCAvLyBQYWdlIGRlIHJlZGlyZWN0aW9uIHBvdXIgbCdpbnZpdFx1MDBFOVxuICAgICAgICApO1xuXG4gICAgICAgIC8vIDcuIFN0b2NrZXIgbCdlbWFpbCBwb3VyIFx1MDBFOXZpdGVyIGxlcyBkb3VibG9uc1xuICAgICAgICBtYXJrSW52aXRhdGlvbkFzU2VudChyZXF1ZXN0ZXJFbWFpbCk7XG5cbiAgICAgICAgZGVidWdMb2coXCJJbnZpdGF0aW9uIGVudm95XHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIsIHsgbWVtYmVyc2hpcElkOiBtZW1iZXJzaGlwLiRpZCB9KTtcbiAgICAgICAgc2hvd1Jlc3VsdCgnc3VjY2VzcycsIGBJbnZpdGF0aW9uIGVudm95XHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzIFx1MDBFMCAke3JlcXVlc3RlckVtYWlsfSAhYCk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBHXHUwMEU5cmVyIGxlcyBlcnJldXJzXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJldXIgbG9ycyBkdSB0cmFpdGVtZW50IGRlIGwnaW52aXRhdGlvbiA6XCIsIGVycm9yKTtcbiAgICAgICAgZGVidWdMb2coXCJFcnJldXIgZFx1MDBFOXRlY3RcdTAwRTllXCIsIHtcbiAgICAgICAgICAgIGNvZGU6IGVycm9yLmNvZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgdHlwZTogZXJyb3IudHlwZSxcbiAgICAgICAgICAgIHJlc3BvbnNlOiBlcnJvci5yZXNwb25zZSxcbiAgICAgICAgICAgIHN0YWNrOiBlcnJvci5zdGFja1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBZmZpY2hlciBwbHVzIGRlIGRcdTAwRTl0YWlscyBlbiBtb2RlIGRlYnVnXG4gICAgICAgIGlmIChERUJVR19NT0RFKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRFx1MDBFOXRhaWxzIGNvbXBsZXRzIGRlIGwnZXJyZXVyOlwiLCBlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXJyb3IuY29kZSA9PT0gNDAxIHx8IGVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdub3QgYXV0aGVudGljYXRlZCcpIHx8IGVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdVbmF1dGhvcml6ZWQnKSkgeyAvLyBOb24gYXV0aGVudGlmaVx1MDBFOVxuICAgICAgICAgICAgZGVidWdMb2coXCJFcnJldXIgZCdhdXRoZW50aWZpY2F0aW9uXCIpO1xuICAgICAgICAgICAgc2hvd1Jlc3VsdCgnZGFuZ2VyJywgJ1ZvdXMgZGV2ZXogXHUwMEVBdHJlIGNvbm5lY3RcdTAwRTkgZW4gdGFudCBxdVxcJ2FkbWluaXN0cmF0ZXVyIHBvdXIgYXBwcm91dmVyIHVuZSBpbnZpdGF0aW9uLicpO1xuICAgICAgICAgICAgaWYgKGxvZ2luQnV0dG9uKSBsb2dpbkJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyb3IuY29kZSA9PT0gNDA5KSB7IC8vIENvbmZsaXRcbiAgICAgICAgICAgIGRlYnVnTG9nKFwiRXJyZXVyIGRlIGNvbmZsaXQgKHV0aWxpc2F0ZXVyIGRcdTAwRTlqXHUwMEUwIGludml0XHUwMEU5KVwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ3dhcm5pbmcnLCBgJHtyZXF1ZXN0ZXJFbWFpbCB8fCAnY2V0IHV0aWxpc2F0ZXVyJ30gZXN0IGRcdTAwRTlqXHUwMEUwIG1lbWJyZSBkZSBsJ1x1MDBFOXF1aXBlIG91IGEgZFx1MDBFOWpcdTAwRTAgdW5lIGludml0YXRpb24gZW4gYXR0ZW50ZS5gKTtcblxuICAgICAgICAgICAgLy8gU3RvY2tlciBxdWFuZCBtXHUwMEVBbWUgbCdlbWFpbCBwb3VyIFx1MDBFOXZpdGVyIGxlcyB0ZW50YXRpdmVzIGZ1dHVyZXNcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0ZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1hcmtJbnZpdGF0aW9uQXNTZW50KHJlcXVlc3RlckVtYWlsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChlcnJvci5jb2RlID09PSA0MDApIHtcbiAgICAgICAgICAgIGRlYnVnTG9nKFwiRXJyZXVyIGRlIHJlcXVcdTAwRUF0ZSBpbnZhbGlkZVwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ2RhbmdlcicsIGBSZXF1XHUwMEVBdGUgaW52YWxpZGUgOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ1ZcdTAwRTlyaWZpZXogbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSBsXFwnaW52aXRhdGlvbid9YCk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZT8uaW5jbHVkZXMoJ0FwcHdyaXRlJykgfHwgZXJyb3IubWVzc2FnZT8uaW5jbHVkZXMoJ1NESycpKSB7XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkVycmV1ciBsaVx1MDBFOWUgYXUgU0RLIEFwcHdyaXRlXCIpO1xuICAgICAgICAgICAgc2hvd1Jlc3VsdCgnZGFuZ2VyJywgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkVycmV1ciBpbmF0dGVuZHVlXCIpO1xuICAgICAgICAgICAgc2hvd1Jlc3VsdCgnZGFuZ2VyJywgYFVuZSBlcnJldXIgaW5hdHRlbmR1ZSBlc3Qgc3VydmVudWUgOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ0VycmV1ciBpbmNvbm51ZSd9YCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogRFx1MDBFOW1hcnJlciBsZSBwcm9jZXNzdXMgbG9yc3F1ZSBsZSBET00gZXN0IGNoYXJnXHUwMEU5XG4gKi9cblxuLy8gVlx1MDBFOXJpZmllciBzaSBsZSBET00gZXN0IGRcdTAwRTlqXHUwMEUwIGNoYXJnXHUwMEU5XG5pZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSB7XG4gICAgLy8gTGUgRE9NIGVzdCBlbmNvcmUgZW4gY2hhcmdlbWVudCwgb24gYXR0ZW5kIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG4gICAgICAgIGRlYnVnTG9nKFwiRE9NIGNoYXJnXHUwMEU5IHZpYSBcdTAwRTl2XHUwMEU5bmVtZW50LCBkXHUwMEU5bWFycmFnZSBkdSBwcm9jZXNzdXMgZCdpbnZpdGF0aW9uXCIpO1xuICAgICAgICBzdGFydEludml0YXRpb25Qcm9jZXNzKCk7XG4gICAgfSk7XG59IGVsc2Uge1xuICAgIC8vIExlIERPTSBlc3QgZFx1MDBFOWpcdTAwRTAgY2hhcmdcdTAwRTksIG9uIGRcdTAwRTltYXJyZSBpbW1cdTAwRTlkaWF0ZW1lbnRcbiAgICBzdGFydEludml0YXRpb25Qcm9jZXNzKCk7XG59XG5cbi8qKlxuICogRm9uY3Rpb24gcHJpbmNpcGFsZSBwb3VyIGRcdTAwRTltYXJyZXIgbGUgcHJvY2Vzc3VzIGQnaW52aXRhdGlvblxuICovXG5mdW5jdGlvbiBzdGFydEludml0YXRpb25Qcm9jZXNzKCkge1xuICAgIGhhbmRsZUludml0YXRpb24oKS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJldXIgbm9uIGNhcHR1clx1MDBFOWUgZGFucyBoYW5kbGVJbnZpdGF0aW9uOlwiLCBlcnJvcik7XG4gICAgICAgIGRlYnVnTG9nKFwiRVJSRVVSIENSSVRJUVVFIG5vbiBjYXB0dXJcdTAwRTllXCIsIGVycm9yKTtcbiAgICAgICAgaWYgKHN0YXR1c0RldGFpbHMpIHtcbiAgICAgICAgICAgIHN0YXR1c0RldGFpbHMuY2xhc3NOYW1lID0gJ2FsZXJ0IGFsZXJ0LWRhbmdlciAgbXktMic7XG4gICAgICAgICAgICBzdGF0dXNEZXRhaWxzLnRleHRDb250ZW50ID0gJ1VuZSBlcnJldXIgY3JpdGlxdWUgZXN0IHN1cnZlbnVlLiBWZXVpbGxleiBjb25zdWx0ZXIgbGEgY29uc29sZSBwb3VyIHBsdXMgZGUgZFx1MDBFOXRhaWxzLic7XG4gICAgICAgICAgICBzdGF0dXNEZXRhaWxzLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0dXNDb250YWluZXIpIHN0YXR1c0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0pO1xufVxuXG4vLyBBam91dGVyIHVuIHRpbWVvdXQgZ2xvYmFsIHBvdXIgXHUwMEU5dml0ZXIgcXVlIGxhIHBhZ2UgcmVzdGUgYmxvcXVcdTAwRTllIGluZFx1MDBFOWZpbmltZW50XG5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoc3RhdHVzQ29udGFpbmVyICYmIHN0YXR1c0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpIHtcbiAgICAgICAgZGVidWdMb2coXCJUaW1lb3V0IGdsb2JhbCBhdHRlaW50LCBhZmZpY2hhZ2UgZCd1biBtZXNzYWdlIGQnZXJyZXVyXCIpO1xuICAgICAgICBzaG93UmVzdWx0KCdkYW5nZXInLCAnTGUgdHJhaXRlbWVudCBwcmVuZCB0cm9wIGRlIHRlbXBzLiBWZXVpbGxleiB2XHUwMEU5cmlmaWVyIHZvdHJlIGNvbm5leGlvbiBldCByXHUwMEU5ZXNzYXllci4nKTtcbiAgICB9XG59LCAzMDAwMCk7IC8vIDMwIHNlY29uZGVzXG4iXSwKICAibWFwcGluZ3MiOiAiOztBQU1BLE1BQU0sa0JBQWtCO0FBQUEsSUFDdEIsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1os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LE1BQU0sT0FBTztBQUFBLE1BQ3RDLE9BQU87QUFDSCxpQkFBUyxtQkFBbUI7QUFDNUIsbUJBQVcsVUFBVSx3Q0FBd0MsTUFBTSxXQUFXLGlCQUFpQixFQUFFO0FBQUEsTUFDckc7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQU9BLE1BQUksU0FBUyxlQUFlLFdBQVc7QUFFbkMsYUFBUyxpQkFBaUIsb0JBQW9CLE1BQU07QUFDaEQsZUFBUywyRUFBK0Q7QUFDeEUsNkJBQXVCO0FBQUEsSUFDM0IsQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUVILDJCQUF1QjtBQUFBLEVBQzNCO0FBS0EsV0FBUyx5QkFBeUI7QUFDOUIscUJBQWlCLEVBQUUsTUFBTSxXQUFTO0FBQzlCLGNBQVEsTUFBTSxpREFBOEMsS0FBSztBQUNqRSxlQUFTLG1DQUFnQyxLQUFLO0FBQzlDLFVBQUksZUFBZTtBQUNmLHNCQUFjLFlBQVk7QUFDMUIsc0JBQWMsY0FBYztBQUM1QixzQkFBYyxNQUFNLFVBQVU7QUFBQSxNQUNsQztBQUNBLFVBQUksZ0JBQWlCLGlCQUFnQixNQUFNLFVBQVU7QUFBQSxJQUN6RCxDQUFDO0FBQUEsRUFDTDtBQUdBLGFBQVcsTUFBTTtBQUNiLFFBQUksbUJBQW1CLGdCQUFnQixNQUFNLFlBQVksUUFBUTtBQUM3RCxlQUFTLHlEQUF5RDtBQUNsRSxpQkFBVyxVQUFVLDBGQUFvRjtBQUFBLElBQzdHO0FBQUEsRUFDSixHQUFHLEdBQUs7IiwKICAibmFtZXMiOiBbImFjY291bnQiLCAiZGF0YWJhc2VzIiwgImZ1bmN0aW9ucyIsICJhY2NvdW50IiwgInRlYW1zIl0KfQo=

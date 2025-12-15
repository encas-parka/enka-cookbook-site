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
  var { APPWRITE_FUNCTION_ID } = getConfig();
  var TEAM_ID = "689bf6fe0006627d8959";
  var loadingState = document.getElementById("accept-invitation-loading");
  var errorState = document.getElementById("accept-invitation-error");
  var successState = document.getElementById("accept-invitation-success");
  var errorMessage = document.getElementById("error-message");
  var setPasswordSection = document.getElementById("set-password-section");
  var setPasswordForm = document.getElementById("set-password-form");
  var newPasswordInput = document.getElementById("new-password");
  var confirmPasswordInput = document.getElementById("confirm-password");
  var setPasswordError = document.getElementById("set-password-error");
  var setPasswordButton = document.getElementById("set-password-button");
  var setPasswordSpinner = setPasswordButton?.querySelector(".spinner-border");
  var finalSuccessMessage = document.getElementById("final-success-message");
  function showUIState(state) {
    if (loadingState) loadingState.style.display = state === "loading" ? "block" : "none";
    if (errorState) errorState.style.display = state === "error" ? "block" : "none";
    const isSuccessState = state === "success" || state === "setPassword";
    if (successState) successState.style.display = isSuccessState ? "block" : "none";
    if (setPasswordSection) setPasswordSection.style.display = state === "setPassword" ? "block" : "none";
  }
  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }
  async function setupCmsAuthentication() {
    const functions2 = await getFunctions();
    const response = await functions2.createExecution(
      APPWRITE_FUNCTION_ID,
      "",
      // Le corps de la requête est vide
      false
    );
    if (response.responseStatusCode !== 200) {
      let serverError = response.responseBody;
      try {
        const parsedBody = JSON.parse(response.responseBody);
        if (parsedBody.error) serverError = parsedBody.error;
      } catch (p_err) {
      }
      throw new Error(`Erreur de la fonction CMS (${response.responseStatusCode}): ${serverError}`);
    }
    const cmsAuth = JSON.parse(response.responseBody);
    return cmsAuth;
  }
  async function updateUserPassword(newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caract\xE8res.");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("Les mots de passe ne correspondent pas.");
    }
    const account2 = await getAccount();
    await account2.updatePassword(newPassword);
  }
  async function acceptInvitation() {
    showUIState("loading");
    try {
      const queryParams = getQueryParams();
      const teamId = queryParams.get("teamId");
      const membershipId = queryParams.get("membershipId");
      const userId = queryParams.get("userId");
      const secret = queryParams.get("secret");
      if (!teamId || !membershipId || !userId || !secret) {
        throw new Error("Param\xE8tres d'invitation manquants dans l'URL.");
      }
      if (teamId !== TEAM_ID) {
        throw new Error("Cette invitation n'est pas valide pour cette application.");
      }
      const teams2 = await getTeams();
      await teams2.updateMembershipStatus(teamId, membershipId, userId, secret);
      const account2 = await getAccount();
      const user = await account2.get();
      localStorage.setItem("appwrite-user-email", user.email);
      localStorage.setItem("appwrite-user-name", user.name);
      showUIState("setPassword");
    } catch (error) {
      console.error("Erreur lors de l'acceptation de l'invitation:", error);
      let errorMsg = "Une erreur est survenue lors du traitement de votre invitation.";
      if (error.code === 401) {
        errorMsg = "Cette invitation n'est pas valide ou a expir\xE9.";
      } else if (error.code === 404) {
        errorMsg = "Cette invitation n'existe pas ou a expir\xE9.";
      } else if (error.code === 409) {
        errorMsg = "Cette invitation a d\xE9j\xE0 \xE9t\xE9 accept\xE9e.";
      } else if (error.message) {
        errorMsg = error.message;
      }
      if (errorMessage) errorMessage.textContent = errorMsg;
      showUIState("error");
    }
  }
  if (setPasswordForm) {
    setPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setPasswordError.style.display = "none";
      setPasswordSpinner.style.display = "inline-block";
      setPasswordButton.disabled = true;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      try {
        await updateUserPassword(newPassword, confirmPassword);
        const account2 = await getAccount();
        const currentUser = await account2.get();
        const cmsAuth = await setupCmsAuthentication();
        setAuthData(currentUser.email, cmsAuth);
        if (successState) successState.style.display = "none";
        if (setPasswordSection) setPasswordSection.style.display = "none";
        if (finalSuccessMessage) finalSuccessMessage.style.display = "block";
      } catch (error) {
        console.error("Erreur lors de la finalisation du compte:", error);
        showPasswordError(error.message);
      } finally {
        setPasswordSpinner.style.display = "none";
        if (finalSuccessMessage.style.display !== "block") {
          setPasswordButton.disabled = false;
        }
      }
    });
  }
  function showPasswordError(message) {
    setPasswordError.textContent = message;
    setPasswordError.style.display = "block";
    setPasswordSpinner.style.display = "none";
    setPasswordButton.disabled = false;
  }
  async function initializeAcceptInvitation() {
    console.log("\u{1F680} [Accept-Invitation] Initialisation du traitement");
    const queryParams = getQueryParams();
    console.log("\u{1F4CB} [Accept-Invitation] Param\xE8tres URL:", {
      hasTeamId: queryParams.has("teamId"),
      hasMembershipId: queryParams.has("membershipId"),
      hasUserId: queryParams.has("userId"),
      hasSecret: queryParams.has("secret"),
      teamId: queryParams.get("teamId"),
      membershipId: queryParams.get("membershipId"),
      userId: queryParams.get("userId"),
      secret: queryParams.get("secret") ? "***" : null
    });
    if (queryParams.has("teamId") && queryParams.has("membershipId") && queryParams.has("userId") && queryParams.has("secret")) {
      acceptInvitation();
    } else {
      if (errorMessage) {
        errorMessage.textContent = "Aucune invitation trouv\xE9e dans l'URL. Veuillez v\xE9rifier le lien d'invitation.";
      }
      showUIState("error");
    }
  }
  if (document.readyState === "loading") {
    console.log("\u23F3 [Accept-Invitation] DOM en cours de chargement, attente de DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", initializeAcceptInvitation);
  } else {
    console.log("\u2705 [Accept-Invitation] DOM d\xE9j\xE0 charg\xE9, ex\xE9cution imm\xE9diate");
    initializeAcceptInvitation();
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvL0RldmVsb3BwZW1lbnQvRU5LQS1DT09LQk9PSy9odWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanMiLCAiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzXG4vLyBNb2R1bGUgY29tbXVuIHBvdXIgbCdpbml0aWFsaXNhdGlvbiBldCBsYSBnZXN0aW9uIGR1IGNsaWVudCBBcHB3cml0ZVxuLy8gXHUwMEM5dml0ZSBsYSBkdXBsaWNhdGlvbiBkJ2luaXRpYWxpc2F0aW9uIGVudHJlIGF1dGgtc3RhdHVzLmpzIGV0IGF1dGhBcHB3cml0ZS5qc1xuLy8gTEVHQUNZIDogbWlncmVyIHRvdXRlIGxlcyBkXHUwMEU5cGVuZGFuZGUgKGF1dGgsIGludml0YXRpb24sIGV0Yy4uLilcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQ0VOVFJBTEUgQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9DT05GSUcgPSB7XG4gIGVuZHBvaW50OiBcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIixcbiAgcHJvamVjdElkOiBcIjY4OTcyNTgyMDAyNGU4MTc4MWI3XCIsXG4gIGRhdGFiYXNlSWQ6IFwiNjg5ZDE1YjEwMDAzYTVhMTM2MzZcIixcbiAgZnVuY3Rpb25zOiB7XG4gICAgY21zQXV0aDogXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiLFxuICAgIGFjY2Vzc1JlcXVlc3Q6IFwiNjg5Y2RlYTUwMDFhNGQ3NDU0OWRcIixcbiAgICAvLyBjcmVhdGVQcm9kdWN0TGlzdDogXCI2OGYwMDQ4NzAwMGM2MjQ1MzNhM1wiLFxuICAgIGJhdGNoVXBkYXRlOiBcIjY4ZjAwNDg3MDAwYzYyNDUzM2EzXCIsXG4gIH0sXG4gIGNvbGxlY3Rpb25zOiB7XG4gICAgbWFpbjogXCJtYWluXCIsXG4gICAgcHVyY2hhc2VzOiBcInB1cmNoYXNlc1wiLFxuICAgIHByb2R1Y3RzOiBcInByb2R1Y3RzXCIsXG4gIH0sXG59O1xuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGRhdGFiYXNlcyA9IG51bGw7XG5sZXQgdGVhbXMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cblxuLyoqXG4gKiBBdHRlbmQgcXVlIGxlIFNESyBBcHB3cml0ZSBzb2l0IGNoYXJnXHUwMEU5IGV0IGluaXRpYWxpc2UgbGVzIGNsaWVudHNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlIHF1aSBzZSByXHUwMEU5c291dCBxdWFuZCBsJ2luaXRpYWxpc2F0aW9uIGVzdCB0ZXJtaW5cdTAwRTllXG4gKi9cbmZ1bmN0aW9uIHdhaXRGb3JBcHB3cml0ZShtYXhBdHRlbXB0cyA9IDUwLCBpbnRlcnZhbCA9IDEwMCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGxldCBhdHRlbXB0cyA9IDA7XG5cbiAgICBmdW5jdGlvbiBjaGVja0FwcHdyaXRlKCkge1xuICAgICAgYXR0ZW1wdHMrKztcbiAgICAgIGlmIChcbiAgICAgICAgd2luZG93LkFwcHdyaXRlICYmXG4gICAgICAgIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiZcbiAgICAgICAgd2luZG93LkFwcHdyaXRlLkFjY291bnRcbiAgICAgICkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2UgaWYgKGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJbQXBwd3JpdGUgQ2xpZW50XSBTREsgQXBwd3JpdGUgbm9uIGNoYXJnXHUwMEU5IGFwclx1MDBFOHMgbGUgbm9tYnJlIG1heGltdW0gZGUgdGVudGF0aXZlc1wiLFxuICAgICAgICApO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiTGUgU0RLIEFwcHdyaXRlIG4nYSBwYXMgcHUgXHUwMEVBdHJlIGNoYXJnXHUwMEU5LlwiKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjaGVja0FwcHdyaXRlKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEluaXRpYWxpc2UgbGVzIGNsaWVudHMgQXBwd3JpdGUgKHVuZSBzZXVsZSBmb2lzKVxuICogQHJldHVybnMge1Byb21pc2U8e2NsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zLCBkYXRhYmFzZXN9Pn0gTGVzIGNsaWVudHMgaW5pdGlhbGlzXHUwMEU5c1xuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwd3JpdGUoKSB7XG4gIGlmIChjbGllbnQgJiYgYWNjb3VudCAmJiBmdW5jdGlvbnMgJiYgZGF0YWJhc2VzKSB7XG4gICAgcmV0dXJuIHsgY2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnMsIGRhdGFiYXNlcyB9O1xuICB9XG5cbiAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgIHJldHVybiBpbml0aWFsaXphdGlvblByb21pc2U7XG4gIH1cblxuICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIERcdTAwRTlidXQgZGUgbCdpbml0aWFsaXNhdGlvblwiKTtcbiAgICAgIGF3YWl0IHdhaXRGb3JBcHB3cml0ZSgpO1xuXG4gICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zLCBEYXRhYmFzZXMsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAuc2V0RW5kcG9pbnQoQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50KVxuICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9DT05GSUcucHJvamVjdElkKTtcblxuICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG4gICAgICBkYXRhYmFzZXMgPSBuZXcgRGF0YWJhc2VzKGNsaWVudCk7XG4gICAgICB0ZWFtcyA9IG5ldyBUZWFtcyhjbGllbnQpO1xuXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucywgZGF0YWJhc2VzLCB0ZWFtcyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsXG4gICAgICAgIGVycm9yLFxuICAgICAgKTtcbiAgICAgIGNsaWVudCA9IG51bGw7XG4gICAgICBhY2NvdW50ID0gbnVsbDtcbiAgICAgIGZ1bmN0aW9ucyA9IG51bGw7XG4gICAgICBkYXRhYmFzZXMgPSBudWxsO1xuICAgICAgdGVhbXMgPSBudWxsO1xuICAgICAgaW5pdGlhbGl6YXRpb25Qcm9taXNlID0gbnVsbDtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vLyAtLS0gRm9uY3Rpb25zIGV4cG9ydFx1MDBFOWVzIC0tLVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBcHB3cml0ZUNsaWVudHMoKSB7XG4gIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWNjb3VudCgpIHtcbiAgaWYgKCFhY2NvdW50KSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGFjY291bnQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlYW1zKCkge1xuICBpZiAoIXRlYW1zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIHRlYW1zO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGdW5jdGlvbnMoKSB7XG4gIGlmICghZnVuY3Rpb25zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YWJhc2VzKCkge1xuICBpZiAoIWRhdGFiYXNlcykgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gIHJldHVybiBkYXRhYmFzZXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgcmV0dXJuIHtcbiAgICBBUFBXUklURV9FTkRQT0lOVDogQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50LFxuICAgIEFQUFdSSVRFX1BST0pFQ1RfSUQ6IEFQUFdSSVRFX0NPTkZJRy5wcm9qZWN0SWQsXG4gICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQ6IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY21zQXV0aCxcbiAgICBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRDogQVBQV1JJVEVfQ09ORklHLmZ1bmN0aW9ucy5hY2Nlc3NSZXF1ZXN0LFxuICAgIEFQUFdSSVRFX0NPTkZJRzogQVBQV1JJVEVfQ09ORklHLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0luaXRpYWxpemVkKCkge1xuICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zICYmIGRhdGFiYXNlcyAmJiB0ZWFtcyk7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgY29uc3QgY21zVXNlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiKTtcbiAgaWYgKCFjbXNVc2VyKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICBpZiAoXG4gICAgICBwYXJzZWRVc2VyLnRva2VuICYmXG4gICAgICB0eXBlb2YgcGFyc2VkVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgcGFyc2VkVXNlci50b2tlbi50cmltKCkgIT09IFwiXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBwYXJzZWRVc2VyO1xuICAgIH1cbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkQ21zKCkge1xuICByZXR1cm4gZ2V0TG9jYWxDbXNVc2VyKCkgIT09IG51bGw7XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIHVuZSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZSBleGlzdGUuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVnJhaSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5LCBzaW5vbiBmYXV4LlxuICovXG5hc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgYXdhaXQgYWNjLmdldCgpOyAvLyBMXHUwMEU4dmUgdW5lIGV4Y2VwdGlvbiBzaSBhdWN1bmUgc2Vzc2lvbiBuJ2VzdCBhY3RpdmVcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgY29ubmVjdFx1MDBFOSBhdmVjIHVuZSBzZXNzaW9uIEFwcHdyaXRlIHZhbGlkZS5cbiAqIENldHRlIGZvbmN0aW9uIHZcdTAwRTlyaWZpZSBcdTAwRTAgbGEgZm9pcyBsZSBjb21wdGUgdXRpbGlzYXRldXIgRVQgbGEgdmFsaWRpdFx1MDBFOSBkZSBsYSBzZXNzaW9uLlxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFZyYWkgc2kgYXV0aGVudGlmaVx1MDBFOSBhdmVjIHNlc3Npb24gYWN0aXZlLCBzaW5vbiBmYXV4XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzQ29ubmVjdGVkQXBwd3JpdGUoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuXG4gICAgLy8gVlx1MDBFOXJpZmllciBsZSBjb21wdGUgdXRpbGlzYXRldXJcbiAgICBjb25zdCBhY2NvdW50RGF0YSA9IGF3YWl0IGFjYy5nZXQoKTtcbiAgICBpZiAoIWFjY291bnREYXRhIHx8ICFhY2NvdW50RGF0YS4kaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWXHUwMEU5cmlmaWVyIGV4cGxpY2l0ZW1lbnQgbGEgc2Vzc2lvbiBjb3VyYW50ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBhY2MuZ2V0U2Vzc2lvbihcImN1cnJlbnRcIik7XG4gICAgaWYgKCFzZXNzaW9uIHx8ICFzZXNzaW9uLiRpZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHNlc3Npb24gbidlc3QgcGFzIGV4cGlyXHUwMEU5ZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZXhwaXJlRGF0ZSA9IG5ldyBEYXRlKHNlc3Npb24uZXhwaXJlKTtcbiAgICBpZiAobm93ID49IGV4cGlyZURhdGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXNzaW9uIHZhbGlkZSAtIHJldG91cm5lciB0cnVlIHNpbXBsZW1lbnRcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY2hlY2tpbmcgY29ubmVjdGlvbjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2MuZ2V0KCk7XG4gICAgcmV0dXJuIHVzZXIuZW1haWxWZXJpZmljYXRpb24gfHwgZmFsc2U7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3QgdmVyaWZpY2F0aW9uVVJMID1cbiAgICAgIHJlZGlyZWN0VVJMIHx8IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L3ZlcmlmeS1lbWFpbGA7XG4gICAgYXdhaXQgYWNjLmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbCdlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOlwiLFxuICAgICAgZXJyb3IsXG4gICAgKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFjYyA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2MudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgXCJbQXBwd3JpdGVDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uIGQnZW1haWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEF1dGhlbnRpY2F0aW9uU3RhdGUoKSB7XG4gIGNvbnN0IGNtc1VzZXIgPSBnZXRMb2NhbENtc1VzZXIoKTtcbiAgaWYgKCFjbXNVc2VyKVxuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZSxcbiAgICB9O1xuICB0cnkge1xuICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICByZXR1cm4ge1xuICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBlbWFpbFZlcmlmaWVkLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZCxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHRydWUsXG4gICAgICBpc0VtYWlsVmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VXNlckVtYWlsKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiYXBwd3JpdGUtdXNlci1uYW1lXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzXCIpO1xufVxuXG5mdW5jdGlvbiBjbGVhckF1dGhEYXRhKCkge1xuICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiYXBwd3JpdGUtdXNlci1lbWFpbFwiKTtcbiAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1c1wiKTtcbn1cbi8qKlxuICogVmFsaWRlIGV0IHByXHUwMEU5cGFyZSBsZXMgZG9ublx1MDBFOWVzIG5cdTAwRTljZXNzYWlyZXMgcG91ciBsYSBjclx1MDBFOWF0aW9uIHRyYW5zYWN0aW9ubmVsbGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7ZXZlbnREYXRhLCB1c2VyLCBjb250ZW50SGFzaH0+fSBEb25uXHUwMEU5ZXMgdmFsaWRcdTAwRTllc1xuICovXG5hc3luYyBmdW5jdGlvbiB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCkge1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gVmFsaWRhdGlvbiBkZXMgZG9ublx1MDBFOWVzIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICApO1xuXG4gIC8vIFJcdTAwRTljdXBcdTAwRTlyZXIgZXQgdmFsaWRlciBsZXMgZG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgIGAvZXZlbmVtZW50cy8ke2V2ZW50SWR9L2luZ3JlZGllbnRzX2F3L2luZGV4Lmpzb25gLFxuICApO1xuICBpZiAoIXJlc3BvbnNlLm9rKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGVzIGRvbm5cdTAwRTllcyBkZSBsJ1x1MDBFOXZcdTAwRTluZW1lbnQ6ICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgKTtcbiAgY29uc3QgZXZlbnREYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudCByXHUwMEU5Y3VwXHUwMEU5clx1MDBFOWVzOmAsXG4gICAgZXZlbnREYXRhLFxuICApO1xuXG4gIGNvbnN0IHsgYWNjb3VudCwgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBVdGlsaXNhdGV1ciBhdXRoZW50aWZpXHUwMEU5OiAke3VzZXIuJGlkfWApO1xuXG4gIC8vIFZcdTAwRTlyaWZpZXIgc2kgbCdcdTAwRTl2XHUwMEU5bmVtZW50IGV4aXN0ZSBkXHUwMEU5alx1MDBFMFxuICB0cnkge1xuICAgIGF3YWl0IGRhdGFiYXNlcy5nZXREb2N1bWVudChcbiAgICAgIEFQUFdSSVRFX0NPTkZJRy5kYXRhYmFzZUlkLFxuICAgICAgQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zLm1haW4sXG4gICAgICBldmVudElkLFxuICAgICk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gTCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH0gZXhpc3RlIGRcdTAwRTlqXHUwMEUwIGRhbnMgbWFpbmAsXG4gICAgKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGAvc3ZfcHJvZHVjdHMvP2xpc3RJZD0ke2V2ZW50SWR9YDtcbiAgICByZXR1cm4gbnVsbDsgLy8gUmV0b3VybmVyIG51bGwgcG91ciBpbmRpcXVlciB1bmUgcmVkaXJlY3Rpb25cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gNDA0KSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBSXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIGhhc2ggZGVwdWlzIGxlcyBwYXJhbVx1MDBFOHRyZXMgZ2xvYmF1eFxuICBjb25zdCBjb250ZW50SGFzaCA9IHdpbmRvdy5fX0hVR09fUEFSQU1TX18/Lmxpc3RDb250ZW50SGFzaDtcbiAgaWYgKCFjb250ZW50SGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlIGhhc2ggZHUgY29udGVudSBuJ2VzdCBwYXMgZFx1MDBFOWZpbmlcIik7XG4gIH1cblxuICByZXR1cm4geyBldmVudERhdGEsIHVzZXIsIGNvbnRlbnRIYXNoIH07XG59XG5cbi8qKlxuICogQXBwZWxsZSBsYSBmb25jdGlvbiBBcHB3cml0ZSBjXHUwMEY0dFx1MDBFOSBzZXJ2ZXVyIHBvdXIgY3JcdTAwRTllciBsYSBsaXN0ZVxuICogVXRpbGlzZSBsZSBTREsgQXBwd3JpdGUgcG91ciBcdTAwRTl2aXRlciBsZXMgcHJvYmxcdTAwRThtZXMgQ09SU1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZXZlbnREYXRhIC0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50SGFzaCAtIEhhc2ggZHUgY29udGVudVxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgZXZlbnRJZCxcbiAgZXZlbnREYXRhLFxuICB1c2VySWQsXG4gIGNvbnRlbnRIYXNoLFxuKSB7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBBcHBlbCBkZSBsYSBmb25jdGlvbiBzZXJ2ZXVyIHBvdXIgJHtldmVudElkfWApO1xuXG4gIC8vIElEIHJcdTAwRTllbCBkZSB2b3RyZSBmb25jdGlvbiBBcHB3cml0ZVxuICBjb25zdCBGVU5DVElPTl9JRCA9IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY3JlYXRlUHJvZHVjdExpc3Q7XG5cbiAgY29uc3QgeyBmdW5jdGlvbnMgfSA9IGF3YWl0IGluaXRpYWxpemVBcHB3cml0ZSgpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgIEZVTkNUSU9OX0lELFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBldmVudElkLFxuICAgICAgICBldmVudERhdGEsXG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgY29udGVudEhhc2gsXG4gICAgICB9KSxcbiAgICAgIHRydWUsIC8vIGFzeW5jID0gdHJ1ZSAtIEVYXHUwMEM5Q1VUSU9OIEFTWU5DSFJPTkVcbiAgICAgIFwiL1wiLCAvLyBwYXRoIChvcHRpb25uZWwpXG4gICAgICBcIkdFVFwiLCAvLyBtZXRob2QgKG9wdGlvbm5lbClcbiAgICAgIHt9LCAvLyBQYXMgYmVzb2luIGQnZW4tdFx1MDBFQXRlcyBwZXJzb25uYWxpc1x1MDBFOXNcbiAgICApO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gZFx1MDBFOW1hcnJcdTAwRTllIGVuIG1vZGUgYXN5bmNocm9uZTpgLFxuICAgICAgcmVzdWx0LFxuICAgICk7XG5cbiAgICAvLyBFbiBtb2RlIGFzeW5jaHJvbmUsIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzLCBvbiBuZSBmYWl0IHBhcyBkZSBwb2xsaW5nXG4gICAgLy8gTGEgZm9uY3Rpb24gdmEgcydleFx1MDBFOWN1dGVyIGVuIGFycmlcdTAwRThyZS1wbGFuIGV0IG9uIHN1cHBvc2UgcXVlIFx1MDBFN2EgdmEgclx1MDBFOXVzc2lyXG4gICAgY29uc3QgZXhlY3V0aW9uSWQgPSByZXN1bHQuJGlkO1xuICAgIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBFeGVjdXRpb24gSUQ6ICR7ZXhlY3V0aW9uSWR9YCk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gYXN5bmMgZFx1MDBFOW1hcnJcdTAwRTllIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzIC0gcGFzIGRlIHBvbGxpbmdgLFxuICAgICk7XG5cbiAgICAvLyBQb3VyIDMwMCsgaW5nclx1MDBFOWRpZW50cywgb24gcmV0b3VybmUgaW1tXHUwMEU5ZGlhdGVtZW50IHVuIHN1Y2NcdTAwRThzXG4gICAgLy8gTCd1dGlsaXNhdGV1ciB2ZXJyYSBsZXMgclx1MDBFOXN1bHRhdHMgcXVhbmQgbGEgZm9uY3Rpb24gYXVyYSB0ZXJtaW5cdTAwRTlcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGV2ZW50SWQsXG4gICAgICBleGVjdXRpb25JZCxcbiAgICAgIG1lc3NhZ2U6IFwiVHJhaXRlbWVudCBkXHUwMEU5bWFyclx1MDBFOSBlbiBhcnJpXHUwMEU4cmUtcGxhbiAoMzAwKyBpbmdyXHUwMEU5ZGllbnRzKVwiLFxuICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnYXBwZWwgZm9uY3Rpb246YCwgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogRm9uY3Rpb24gcHJpbmNpcGFsZSAtIGNyXHUwMEU5ZSB1bmUgbGlzdGUgZGUgcHJvZHVpdHMgY29sbGFib3JhdGlmc1xuICogVXRpbGlzZSBtYWludGVuYW50IGxhIGZvbmN0aW9uIEFwcHdyaXRlIGNcdTAwRjR0XHUwMEU5IHNlcnZldXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29sbGFib3JhdGl2ZVByb2R1Y3RzTGlzdEZyb21FdmVudChldmVudElkKSB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWJ1dCBkZSBsYSBjclx1MDBFOWF0aW9uIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICAgICk7XG5cbiAgICAvLyAxLiBWYWxpZGF0aW9uIGV0IHByXHUwMEU5cGFyYXRpb24gZGVzIGRvbm5cdTAwRTllc1xuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSBhd2FpdCB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCk7XG4gICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0KSB7XG4gICAgICAvLyBSZWRpcmVjdGlvbiBkXHUwMEU5alx1MDBFMCBnXHUwMEU5clx1MDBFOWUgZGFucyB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGFcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IGV2ZW50RGF0YSwgdXNlciwgY29udGVudEhhc2ggfSA9IHZhbGlkYXRpb25SZXN1bHQ7XG4gICAgY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIERvbm5cdTAwRTllcyB2YWxpZFx1MDBFOWVzLCBhcHBlbCBkZSBsYSBmb25jdGlvbmApO1xuXG4gICAgLy8gMi4gQXBwZWwgZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgY1x1MDBGNHRcdTAwRTkgc2VydmV1clxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgICAgIGV2ZW50SWQsXG4gICAgICBldmVudERhdGEsXG4gICAgICB1c2VyLiRpZCxcbiAgICAgIGNvbnRlbnRIYXNoLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBPcFx1MDBFOXJhdGlvbiByXHUwMEU5dXNzaWUsIHJlZGlyZWN0aW9uIHZlcnMgbGEgbGlzdGVgLFxuICAgICk7XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgL3N2X3Byb2R1Y3RzLz9saXN0SWQ9JHtldmVudElkfWA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBjclx1MDBFOWF0aW9uOmAsXG4gICAgICBlcnJvci5tZXNzYWdlLFxuICAgICk7XG5cbiAgICAvLyBHZXN0aW9uIGRlcyBlcnJldXJzIHNwXHUwMEU5Y2lmaXF1ZXNcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhcImFscmVhZHlfZXhpc3RzXCIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2V0dGUgbGlzdGUgZGUgcHJvZHVpdHMgZXhpc3RlIGRcdTAwRTlqXHUwMEUwLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBhdmVjIHVuIElEIGRpZmZcdTAwRTlyZW50LlwiLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoXCJ0cmFuc2FjdGlvbl9saW1pdF9leGNlZWRlZFwiKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkxpbWl0ZSBkZSB0cmFuc2FjdGlvbnMgZFx1MDBFOXBhc3NcdTAwRTllLiBWZXVpbGxleiByXHUwMEU5ZHVpcmUgbGUgbm9tYnJlIGQnaW5nclx1MDBFOWRpZW50cyBvdSByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tFeGlzdGluZ01haW5Hcm91cChtYWluR3JvdXBJZCkge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHNpIGxlIGRvY3VtZW50IGV4aXN0ZSBkaXJlY3RlbWVudCBkYW5zIGxhIGNvbGxlY3Rpb24gJ21haW4nXG4gICAgY29uc3QgZXhpc3RpbmdNYWluR3JvdXAgPSBhd2FpdCBkYXRhYmFzZXMuZ2V0RG9jdW1lbnQoXG4gICAgICBcIjY4OWQxNWIxMDAwM2E1YTEzNjM2XCIsXG4gICAgICBcIm1haW5cIixcbiAgICAgIG1haW5Hcm91cElkLFxuICAgICk7XG4gICAgcmV0dXJuICEhZXhpc3RpbmdNYWluR3JvdXA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBMZSBkb2N1bWVudCBuJ2V4aXN0ZSBwYXNcbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIFwiW0FwcHdyaXRlIENsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZHUgbWFpbiBncm91cCBleGlzdGFudDpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgdHJ5IHtcbiAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGF3YWl0IGFjYy5kZWxldGVTZXNzaW9uKFwiY3VycmVudFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIGRcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgKHBldXQtXHUwMEVBdHJlIGRcdTAwRTlqXHUwMEUwIGRcdTAwRTljb25uZWN0XHUwMEU5KTpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIsIGVtYWlsKTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIiwgbmFtZSk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8qKlxuICogUydhYm9ubmUgYXV4IG1pc2VzIFx1MDBFMCBqb3VyIHRlbXBzIHJcdTAwRTllbCBwb3VyIHVuZSBsaXN0ZSBkZSBjb2xsZWN0aW9ucy5cbiAqIFV0aWxpc2UgbCdBUEkgQXBwd3JpdGUgc3Vic2NyaWJlKCkgcXVpIGdcdTAwRThyZSBhdXRvbWF0aXF1ZW1lbnQgbGVzIGNvbm5leGlvbnMgV2ViU29ja2V0LlxuICogQHBhcmFtIHtzdHJpbmdbXX0gY29sbGVjdGlvbk5hbWVzIC0gTm9tcyBkZXMgY29sbGVjdGlvbnMgKGV4OiBbJ2luZ3JlZGllbnRzJywgJ3B1cmNoYXNlcyddKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0SWQgLSBJRCBkZSBsYSBsaXN0ZSAocG91ciBmaWx0cmFnZSBzaSBuXHUwMEU5Y2Vzc2FpcmUpLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gb25NZXNzYWdlIC0gQ2FsbGJhY2sgcG91ciBsZXMgbWVzc2FnZXMgZGUgZG9ublx1MDBFOWVzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbm5lY3Rpb25DYWxsYmFja3MgLSBDYWxsYmFja3MgcG91ciBsZXMgXHUwMEU5dlx1MDBFOW5lbWVudHMgZGUgY29ubmV4aW9uLlxuICogQHJldHVybnMge2Z1bmN0aW9ufSBVbmUgZm9uY3Rpb24gcG91ciBzZSBkXHUwMEU5c2Fib25uZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zKFxuICBjb2xsZWN0aW9uTmFtZXMsXG4gIGxpc3RJZCxcbiAgb25NZXNzYWdlLFxuICBjb25uZWN0aW9uQ2FsbGJhY2tzID0ge30sXG4pIHtcbiAgY29uc3QgeyBvbkNvbm5lY3QsIG9uRGlzY29ubmVjdCwgb25FcnJvciB9ID0gY29ubmVjdGlvbkNhbGxiYWNrcztcblxuICBpZiAoIWNsaWVudCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIkltcG9zc2libGUgZGUgcydhYm9ubmVyIDogbGUgY2xpZW50IEFwcHdyaXRlIG4nZXN0IHBhcyBlbmNvcmUgaW5pdGlhbGlzXHUwMEU5LlwiLFxuICAgICk7XG4gICAgb25FcnJvcj8uKHsgbWVzc2FnZTogXCJDbGllbnQgQXBwd3JpdGUgbm9uIGluaXRpYWxpc1x1MDBFOVwiIH0pO1xuICAgIHJldHVybiAoKSA9PiB7fTtcbiAgfVxuXG4gIGNvbnN0IGNoYW5uZWxzID0gY29sbGVjdGlvbk5hbWVzXG4gICAgLm1hcCgobmFtZSkgPT4ge1xuICAgICAgY29uc3QgY29sbGVjdGlvbklkID0gQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBOb20gZGUgY29sbGVjdGlvbiBpbmNvbm51IGRhbnMgbGEgY29uZmlndXJhdGlvbjogJHtuYW1lfWAsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGBkYXRhYmFzZXMuJHtBUFBXUklURV9DT05GSUcuZGF0YWJhc2VJZH0uY29sbGVjdGlvbnMuJHtjb2xsZWN0aW9uSWR9LmRvY3VtZW50c2A7XG4gICAgfSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQWJvbm5lbWVudCBhdXggY2FuYXV4IGVuIGNvdXJzLi4uXCIsIGNoYW5uZWxzKTtcblxuICB0cnkge1xuICAgIC8vIExhIG1cdTAwRTl0aG9kZSBjbGllbnQuc3Vic2NyaWJlKCkgZ1x1MDBFOHJlIGF1dG9tYXRpcXVlbWVudCBsYSBjb25uZXhpb24gV2ViU29ja2V0XG4gICAgLy8gc2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBvZmZpY2llbGxlIEFwcHdyaXRlXG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSBjbGllbnQuc3Vic2NyaWJlKGNoYW5uZWxzLCAocmVzcG9uc2UpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWNlcHRpb24gdGVtcHMgclx1MDBFOWVsOlwiLCByZXNwb25zZSk7XG4gICAgICBvbk1lc3NhZ2UocmVzcG9uc2UpO1xuICAgIH0pO1xuXG4gICAgLy8gU2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBBcHB3cml0ZSwgbGEgc3Vic2NyaXB0aW9uIGVzdCBhdXRvbWF0aXF1ZW1lbnQgYWN0aXZlXG4gICAgLy8gT24gcGV1dCBjb25zaWRcdTAwRTlyZXIgbGEgY29ubmV4aW9uIGNvbW1lIFx1MDBFOXRhYmxpZSBpbW1cdTAwRTlkaWF0ZW1lbnRcbiAgICBpZiAob25Db25uZWN0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBDb25uZXhpb24gdGVtcHMgclx1MDBFOWVsIFx1MDBFOXRhYmxpZVwiKTtcbiAgICAgICAgb25Db25uZWN0KCk7XG4gICAgICB9LCA1MCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHNvdXNjcmlwdGlvbiB0ZW1wcyByXHUwMEU5ZWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIG9uRXJyb3I/LihlcnJvcik7XG4gICAgcmV0dXJuICgpID0+IHt9OyAvLyBSZXRvdXJuZXIgdW5lIGZvbmN0aW9uIHZpZGUgZW4gY2FzIGQnZXJyZXVyXG4gIH1cbn1cblxuLy8gRXhwb3J0IGRlcyBmb25jdGlvbnMgcHVibGlxdWVzXG5leHBvcnQge1xuICBBUFBXUklURV9DT05GSUcsIC8vIEFqb3V0XHUwMEU5IHBvdXIgY29uc29saWRlciBsZXMgZXhwb3J0c1xuICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gIGdldEFjY291bnQsXG4gIGdldEZ1bmN0aW9ucyxcbiAgZ2V0VGVhbXMsXG4gIGdldERhdGFiYXNlcyxcbiAgZ2V0Q29uZmlnLFxuICBpc0luaXRpYWxpemVkLFxuICBpbml0aWFsaXplQXBwd3JpdGUsXG4gIGdldExvY2FsQ21zVXNlcixcbiAgaXNBdXRoZW50aWNhdGVkQ21zLFxuICBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSxcbiAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgZ2V0VXNlckVtYWlsLFxuICBnZXRVc2VyTmFtZSxcbiAgY2xlYXJBdXRoRGF0YSxcbiAgc2V0QXV0aERhdGEsXG4gIGxvZ291dEdsb2JhbCxcbiAgaXNFbWFpbFZlcmlmaWVkLFxuICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gIHZlcmlmeUVtYWlsLFxuICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICBjcmVhdGVDb2xsYWJvcmF0aXZlUHJvZHVjdHNMaXN0RnJvbUV2ZW50LFxuICBjaGVja0V4aXN0aW5nTWFpbkdyb3VwLFxufTtcblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgIGdldEFwcHdyaXRlQ2xpZW50cyxcbiAgICBnZXRBY2NvdW50LFxuICAgIGdldEZ1bmN0aW9ucyxcbiAgICBnZXREYXRhYmFzZXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMsXG4gICAgaXNBdXRoZW50aWNhdGVkQXBwd3JpdGUsXG4gICAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgICBnZXRVc2VyRW1haWwsXG4gICAgZ2V0VXNlck5hbWUsXG4gICAgY2xlYXJBdXRoRGF0YSxcbiAgICBzZXRBdXRoRGF0YSxcbiAgICBsb2dvdXRHbG9iYWwsXG4gICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgICB2ZXJpZnlFbWFpbCxcbiAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICAgIGNyZWF0ZUNvbGxhYm9yYXRpdmVQcm9kdWN0c0xpc3RGcm9tRXZlbnQsXG4gICAgY2hlY2tFeGlzdGluZ01haW5Hcm91cCxcbiAgICBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zLFxuICB9O1xufVxuIiwgIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FjY2VwdC1pbnZpdGF0aW9uLmpzXG4vLyBDZSBzY3JpcHQgZ1x1MDBFOHJlIGxhIGxvZ2lxdWUgZGUgbGEgcGFnZSBkJ2FjY2VwdGF0aW9uIGQnaW52aXRhdGlvbiBlbiB1dGlsaXNhbnQgbCdBUEkgVGVhbXMgZCdBcHB3cml0ZVxuLy8gRXQgbGEgZmluYWxpc2F0aW9uIGR1IGNvbXB0ZSBhdmVjIGxhIGRcdTAwRTlmaW5pdGlvbiBkdSBtb3QgZGUgcGFzc2UuXG5cbmltcG9ydCB7IGdldEFjY291bnQsIGdldFRlYW1zLCBnZXRGdW5jdGlvbnMsIGdldENvbmZpZywgc2V0QXV0aERhdGEsIGNsZWFyQXV0aERhdGEgfSBmcm9tICcuL2FwcHdyaXRlLWNsaWVudC5qcyc7XG5cbi8vIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZGUgbGEgY29uZmlndXJhdGlvblxuY29uc3QgeyBBUFBXUklURV9GVU5DVElPTl9JRCB9ID0gZ2V0Q29uZmlnKCk7XG5cbi8vIElEIGRlIGwnXHUwMEU5cXVpcGUgZGUgY29udHJpYnV0ZXVyc1xuY29uc3QgVEVBTV9JRCA9IFwiNjg5YmY2ZmUwMDA2NjI3ZDg5NTlcIjtcblxuLy8gUlx1MDBFOWN1cFx1MDBFOHJlIGxlcyBcdTAwRTlsXHUwMEU5bWVudHMgZHUgRE9NXG5jb25zdCBsb2FkaW5nU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImFjY2VwdC1pbnZpdGF0aW9uLWxvYWRpbmdcIik7XG5jb25zdCBlcnJvclN0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhY2NlcHQtaW52aXRhdGlvbi1lcnJvclwiKTtcbmNvbnN0IHN1Y2Nlc3NTdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYWNjZXB0LWludml0YXRpb24tc3VjY2Vzc1wiKTtcbmNvbnN0IGVycm9yTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZXJyb3ItbWVzc2FnZVwiKTtcblxuLy8gU2VjdGlvbiBldCBmb3JtdWxhaXJlIHBvdXIgbGUgbW90IGRlIHBhc3NlXG5jb25zdCBzZXRQYXNzd29yZFNlY3Rpb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0LXBhc3N3b3JkLXNlY3Rpb24nKTtcbmNvbnN0IHNldFBhc3N3b3JkRm9ybSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXQtcGFzc3dvcmQtZm9ybScpO1xuY29uc3QgbmV3UGFzc3dvcmRJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduZXctcGFzc3dvcmQnKTtcbmNvbnN0IGNvbmZpcm1QYXNzd29yZElucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tcGFzc3dvcmQnKTtcbmNvbnN0IHNldFBhc3N3b3JkRXJyb3IgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0LXBhc3N3b3JkLWVycm9yJyk7XG5jb25zdCBzZXRQYXNzd29yZEJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXQtcGFzc3dvcmQtYnV0dG9uJyk7XG5jb25zdCBzZXRQYXNzd29yZFNwaW5uZXIgPSBzZXRQYXNzd29yZEJ1dHRvbj8ucXVlcnlTZWxlY3RvcignLnNwaW5uZXItYm9yZGVyJyk7XG5jb25zdCBmaW5hbFN1Y2Nlc3NNZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpbmFsLXN1Y2Nlc3MtbWVzc2FnZScpO1xuXG4vKipcbiAqIEFmZmljaGUgdW4gXHUwMEU5dGF0IGRlIGwnVUkgZXQgbWFzcXVlIGxlcyBhdXRyZXMuXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RhdGUgLSBMJ1x1MDBFOXRhdCBcdTAwRTAgYWZmaWNoZXIgKCdsb2FkaW5nJywgJ2Vycm9yJywgJ3N1Y2Nlc3MnLCAnc2V0UGFzc3dvcmQnKVxuICovXG5mdW5jdGlvbiBzaG93VUlTdGF0ZShzdGF0ZSkge1xuICBpZiAobG9hZGluZ1N0YXRlKSBsb2FkaW5nU3RhdGUuc3R5bGUuZGlzcGxheSA9IChzdGF0ZSA9PT0gJ2xvYWRpbmcnKSA/ICdibG9jaycgOiAnbm9uZSc7XG4gIGlmIChlcnJvclN0YXRlKSBlcnJvclN0YXRlLnN0eWxlLmRpc3BsYXkgPSAoc3RhdGUgPT09ICdlcnJvcicpID8gJ2Jsb2NrJyA6ICdub25lJztcblxuICAvLyBMZSBzdWNjXHUwMEU4cyBkZSBsJ2ludml0YXRpb24gZXQgbGUgZm9ybXVsYWlyZSBkZSBtb3QgZGUgcGFzc2Ugc29udCBsaVx1MDBFOXNcbiAgY29uc3QgaXNTdWNjZXNzU3RhdGUgPSAoc3RhdGUgPT09ICdzdWNjZXNzJyB8fCBzdGF0ZSA9PT0gJ3NldFBhc3N3b3JkJyk7XG4gIGlmIChzdWNjZXNzU3RhdGUpIHN1Y2Nlc3NTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gaXNTdWNjZXNzU3RhdGUgPyAnYmxvY2snIDogJ25vbmUnO1xuICBpZiAoc2V0UGFzc3dvcmRTZWN0aW9uKSBzZXRQYXNzd29yZFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IChzdGF0ZSA9PT0gJ3NldFBhc3N3b3JkJykgPyAnYmxvY2snIDogJ25vbmUnO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgcGFyYW1cdTAwRTh0cmVzIGRlIHJlcXVcdTAwRUF0ZSBkZSBsJ1VSTFxuICogQHJldHVybnMge1VSTFNlYXJjaFBhcmFtc30gLSBMZXMgcGFyYW1cdTAwRTh0cmVzIGRlIHJlcXVcdTAwRUF0ZVxuICovXG5mdW5jdGlvbiBnZXRRdWVyeVBhcmFtcygpIHtcbiAgcmV0dXJuIG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGwnYXV0aGVudGlmaWNhdGlvbiBkdSBDTVMgZW4gYXBwZWxhbnQgbGEgZm9uY3Rpb24gQXBwd3JpdGUuXG4gKiBMXHUwMEU4dmUgdW5lIGV4Y2VwdGlvbiBlbiBjYXMgZCdlcnJldXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNldHVwQ21zQXV0aGVudGljYXRpb24oKSB7XG4gIC8vIGNvbnNvbGUubG9nKFwiQXBwZWwgZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgcG91ciBvYnRlbmlyIGxlIHRva2VuIENNUy4uLlwiKTtcblxuICBjb25zdCBmdW5jdGlvbnMgPSBhd2FpdCBnZXRGdW5jdGlvbnMoKTtcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmdW5jdGlvbnMuY3JlYXRlRXhlY3V0aW9uKFxuICAgIEFQUFdSSVRFX0ZVTkNUSU9OX0lELFxuICAgICcnLCAvLyBMZSBjb3JwcyBkZSBsYSByZXF1XHUwMEVBdGUgZXN0IHZpZGVcbiAgICBmYWxzZVxuICApO1xuXG4gIGlmIChyZXNwb25zZS5yZXNwb25zZVN0YXR1c0NvZGUgIT09IDIwMCkge1xuICAgIGxldCBzZXJ2ZXJFcnJvciA9IHJlc3BvbnNlLnJlc3BvbnNlQm9keTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFyc2VkQm9keSA9IEpTT04ucGFyc2UocmVzcG9uc2UucmVzcG9uc2VCb2R5KTtcbiAgICAgIGlmIChwYXJzZWRCb2R5LmVycm9yKSBzZXJ2ZXJFcnJvciA9IHBhcnNlZEJvZHkuZXJyb3I7XG4gICAgfSBjYXRjaCAocF9lcnIpIHsgLyogaWdub3JlICovIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVycmV1ciBkZSBsYSBmb25jdGlvbiBDTVMgKCR7cmVzcG9uc2UucmVzcG9uc2VTdGF0dXNDb2RlfSk6ICR7c2VydmVyRXJyb3J9YCk7XG4gIH1cblxuICBjb25zdCBjbXNBdXRoID0gSlNPTi5wYXJzZShyZXNwb25zZS5yZXNwb25zZUJvZHkpO1xuICAvLyBzZXRBdXRoRGF0YSBzZXJhIGFwcGVsXHUwMEU5IGF2ZWMgbCdlbWFpbCBkZXB1aXMgbCdleHRcdTAwRTlyaWV1clxuICByZXR1cm4gY21zQXV0aDtcbn1cblxuLyoqXG4gKiBNZXQgXHUwMEUwIGpvdXIgbGUgbW90IGRlIHBhc3NlIGRlIGwndXRpbGlzYXRldXIgYWN0dWVsbGVtZW50IGF1dGhlbnRpZmlcdTAwRTkuXG4gKiBHXHUwMEU4cmUgbGEgdmFsaWRhdGlvbiBlbiBpbnRlcm5lLlxuICogQHBhcmFtIHtzdHJpbmd9IG5ld1Bhc3N3b3JkIC0gTGUgbm91dmVhdSBtb3QgZGUgcGFzc2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gY29uZmlybVBhc3N3b3JkIC0gTGEgY29uZmlybWF0aW9uIGR1IG1vdCBkZSBwYXNzZS5cbiAqIEB0aHJvd3Mge0Vycm9yfSBzaSBsYSB2YWxpZGF0aW9uIFx1MDBFOWNob3VlIG91IHNpIGwnQVBJIEFwcHdyaXRlIHJlbnZvaWUgdW5lIGVycmV1ci5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gdXBkYXRlVXNlclBhc3N3b3JkKG5ld1Bhc3N3b3JkLCBjb25maXJtUGFzc3dvcmQpIHtcbiAgaWYgKCFuZXdQYXNzd29yZCB8fCBuZXdQYXNzd29yZC5sZW5ndGggPCA4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTGUgbW90IGRlIHBhc3NlIGRvaXQgY29udGVuaXIgYXUgbW9pbnMgOCBjYXJhY3RcdTAwRThyZXMuXCIpO1xuICB9XG4gIGlmIChuZXdQYXNzd29yZCAhPT0gY29uZmlybVBhc3N3b3JkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTGVzIG1vdHMgZGUgcGFzc2UgbmUgY29ycmVzcG9uZGVudCBwYXMuXCIpO1xuICB9XG5cbiAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgLy8gTCdhcHBlbCBcdTAwRTAgbCdBUEkgZXN0IGRcdTAwRTlqXHUwMEUwIGRhbnMgdW4gY29udGV4dGUgYXV0aGVudGlmaVx1MDBFOVxuICBhd2FpdCBhY2NvdW50LnVwZGF0ZVBhc3N3b3JkKG5ld1Bhc3N3b3JkKTtcbiAgLy8gY29uc29sZS5sb2coXCJMZSBtb3QgZGUgcGFzc2UgZGUgbCd1dGlsaXNhdGV1ciBhIFx1MDBFOXRcdTAwRTkgbWlzIFx1MDBFMCBqb3VyIGF2ZWMgc3VjY1x1MDBFOHMuXCIpO1xufVxuXG4vKipcbiAqIEFjY2VwdGUgbCdpbnZpdGF0aW9uIGV0LCBlbiBjYXMgZGUgc3VjY1x1MDBFOHMsIGFmZmljaGUgbGUgZm9ybXVsYWlyZSBkZSBtb3QgZGUgcGFzc2UuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFjY2VwdEludml0YXRpb24oKSB7XG4gIHNob3dVSVN0YXRlKCdsb2FkaW5nJyk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBxdWVyeVBhcmFtcyA9IGdldFF1ZXJ5UGFyYW1zKCk7XG4gICAgY29uc3QgdGVhbUlkID0gcXVlcnlQYXJhbXMuZ2V0KCd0ZWFtSWQnKTtcbiAgICBjb25zdCBtZW1iZXJzaGlwSWQgPSBxdWVyeVBhcmFtcy5nZXQoJ21lbWJlcnNoaXBJZCcpO1xuICAgIGNvbnN0IHVzZXJJZCA9IHF1ZXJ5UGFyYW1zLmdldCgndXNlcklkJyk7XG4gICAgY29uc3Qgc2VjcmV0ID0gcXVlcnlQYXJhbXMuZ2V0KCdzZWNyZXQnKTtcblxuICAgIGlmICghdGVhbUlkIHx8ICFtZW1iZXJzaGlwSWQgfHwgIXVzZXJJZCB8fCAhc2VjcmV0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQYXJhbVx1MDBFOHRyZXMgZCdpbnZpdGF0aW9uIG1hbnF1YW50cyBkYW5zIGwnVVJMLlwiKTtcbiAgICB9XG4gICAgaWYgKHRlYW1JZCAhPT0gVEVBTV9JRCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2V0dGUgaW52aXRhdGlvbiBuJ2VzdCBwYXMgdmFsaWRlIHBvdXIgY2V0dGUgYXBwbGljYXRpb24uXCIpO1xuICAgIH1cblxuICAgIC8vIEFjY2VwdGUgbCdpbnZpdGF0aW9uIHNhbnMgYXV0aGVudGlmaWNhdGlvbiBwclx1MDBFOWFsYWJsZS5cbiAgICAvLyBMZSBzZWNyZXQgZGUgbCdpbnZpdGF0aW9uIHNlcnQgZCdhdXRoZW50aWZpY2F0aW9uIHRlbXBvcmFpcmUuXG4gICAgLy8gY29uc29sZS5sb2coXCJBY2NlcHRhdGlvbiBkZSBsJ2ludml0YXRpb246XCIsIHsgdGVhbUlkLCBtZW1iZXJzaGlwSWQsIHVzZXJJZCwgc2VjcmV0IH0pO1xuICAgIFxuICAgIGNvbnN0IHRlYW1zID0gYXdhaXQgZ2V0VGVhbXMoKTtcbiAgICBhd2FpdCB0ZWFtcy51cGRhdGVNZW1iZXJzaGlwU3RhdHVzKHRlYW1JZCwgbWVtYmVyc2hpcElkLCB1c2VySWQsIHNlY3JldCk7XG5cbiAgICAvLyBBcHJcdTAwRThzIGFjY2VwdGF0aW9uLCB1bmUgc2Vzc2lvbiBlc3QgY3JcdTAwRTlcdTAwRTllLiBSXHUwMEU5Y3VwXHUwMEU5cmVyIGxlcyBpbmZvcyB1dGlsaXNhdGV1ci5cbiAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJywgdXNlci5lbWFpbCk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScsIHVzZXIubmFtZSk7XG5cbiAgICAvLyBBZmZpY2hlIGxlIG1lc3NhZ2UgZGUgc3VjY1x1MDBFOHMgZXQgbGUgZm9ybXVsYWlyZSBwb3VyIGRcdTAwRTlmaW5pciBsZSBtb3QgZGUgcGFzc2VcbiAgICBzaG93VUlTdGF0ZSgnc2V0UGFzc3dvcmQnKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJldXIgbG9ycyBkZSBsJ2FjY2VwdGF0aW9uIGRlIGwnaW52aXRhdGlvbjpcIiwgZXJyb3IpO1xuICAgIGxldCBlcnJvck1zZyA9IFwiVW5lIGVycmV1ciBlc3Qgc3VydmVudWUgbG9ycyBkdSB0cmFpdGVtZW50IGRlIHZvdHJlIGludml0YXRpb24uXCI7XG4gICAgXG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwMSkge1xuICAgICAgZXJyb3JNc2cgPSBcIkNldHRlIGludml0YXRpb24gbidlc3QgcGFzIHZhbGlkZSBvdSBhIGV4cGlyXHUwMEU5LlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyb3IuY29kZSA9PT0gNDA0KSB7XG4gICAgICBlcnJvck1zZyA9IFwiQ2V0dGUgaW52aXRhdGlvbiBuJ2V4aXN0ZSBwYXMgb3UgYSBleHBpclx1MDBFOS5cIjtcbiAgICB9IGVsc2UgaWYgKGVycm9yLmNvZGUgPT09IDQwOSkge1xuICAgICAgZXJyb3JNc2cgPSBcIkNldHRlIGludml0YXRpb24gYSBkXHUwMEU5alx1MDBFMCBcdTAwRTl0XHUwMEU5IGFjY2VwdFx1MDBFOWUuXCI7XG4gICAgfSBlbHNlIGlmIChlcnJvci5tZXNzYWdlKSB7XG4gICAgICBlcnJvck1zZyA9IGVycm9yLm1lc3NhZ2U7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yTWVzc2FnZSkgZXJyb3JNZXNzYWdlLnRleHRDb250ZW50ID0gZXJyb3JNc2c7XG4gICAgc2hvd1VJU3RhdGUoJ2Vycm9yJyk7XG5cbiAgfVxufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsYSBzb3VtaXNzaW9uIGR1IGZvcm11bGFpcmUgZGUgbW90IGRlIHBhc3NlLlxuICovXG5pZiAoc2V0UGFzc3dvcmRGb3JtKSB7XG4gIHNldFBhc3N3b3JkRm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBhc3luYyAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBzZXRQYXNzd29yZEVycm9yLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgc2V0UGFzc3dvcmRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICBzZXRQYXNzd29yZEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cbiAgICBjb25zdCBuZXdQYXNzd29yZCA9IG5ld1Bhc3N3b3JkSW5wdXQudmFsdWU7XG4gICAgY29uc3QgY29uZmlybVBhc3N3b3JkID0gY29uZmlybVBhc3N3b3JkSW5wdXQudmFsdWU7XG5cbiAgICB0cnkge1xuICAgICAgLy8gXHUwMEM5dGFwZSAxOiBNZXR0cmUgXHUwMEUwIGpvdXIgbGUgbW90IGRlIHBhc3NlXG4gICAgICBhd2FpdCB1cGRhdGVVc2VyUGFzc3dvcmQobmV3UGFzc3dvcmQsIGNvbmZpcm1QYXNzd29yZCk7XG5cbiAgICAgIC8vIFx1MDBDOXRhcGUgMjogUlx1MDBFOWN1cFx1MDBFOXJlciBsJ3V0aWxpc2F0ZXVyIHBvdXIgb2J0ZW5pciBzb24gZW1haWxcbiAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICBjb25zdCBjdXJyZW50VXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG5cbiAgICAgIC8vIFx1MDBDOXRhcGUgMzogT2J0ZW5pciBsZSB0b2tlbiBDTVNcbiAgICAgIGNvbnN0IGNtc0F1dGggPSBhd2FpdCBzZXR1cENtc0F1dGhlbnRpY2F0aW9uKCk7XG5cbiAgICAgIC8vIFx1MDBDOXRhcGUgNDogU3RvY2tlciBsZXMgZG9ublx1MDBFOWVzIGQnYXV0aGVudGlmaWNhdGlvblxuICAgICAgc2V0QXV0aERhdGEoY3VycmVudFVzZXIuZW1haWwsIGNtc0F1dGgpO1xuXG4gICAgICAvLyBcdTAwQzl0YXBlIDU6IEFmZmljaGVyIGxlIHN1Y2NcdTAwRThzIGZpbmFsXG4gICAgICBpZihzdWNjZXNzU3RhdGUpIHN1Y2Nlc3NTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgaWYoc2V0UGFzc3dvcmRTZWN0aW9uKSBzZXRQYXNzd29yZFNlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIGlmKGZpbmFsU3VjY2Vzc01lc3NhZ2UpIGZpbmFsU3VjY2Vzc01lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTCdlcnJldXIgKHZhbGlkYXRpb24gb3UgQVBJKSBlc3QgZGlyZWN0ZW1lbnQgYWZmaWNoXHUwMEU5ZSBcdTAwRTAgbCd1dGlsaXNhdGV1clxuICAgICAgY29uc29sZS5lcnJvcihcIkVycmV1ciBsb3JzIGRlIGxhIGZpbmFsaXNhdGlvbiBkdSBjb21wdGU6XCIsIGVycm9yKTtcbiAgICAgIHNob3dQYXNzd29yZEVycm9yKGVycm9yLm1lc3NhZ2UpOyAvLyBPbiB1dGlsaXNlIGVycm9yLm1lc3NhZ2UgcXVpIGVzdCBkXHUwMEU5alx1MDBFMCBjbGFpclxuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRQYXNzd29yZFNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIC8vIE9uIG5lIHJcdTAwRTktYWN0aXZlIGxlIGJvdXRvbiBxdWUgc2kgbGUgcHJvY2Vzc3VzIG4nZXN0IHBhcyBhbGxcdTAwRTkgYXUgYm91dFxuICAgICAgaWYgKGZpbmFsU3VjY2Vzc01lc3NhZ2Uuc3R5bGUuZGlzcGxheSAhPT0gJ2Jsb2NrJykge1xuICAgICAgICAgc2V0UGFzc3dvcmRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBzaG93UGFzc3dvcmRFcnJvcihtZXNzYWdlKSB7XG4gIHNldFBhc3N3b3JkRXJyb3IudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICBzZXRQYXNzd29yZEVycm9yLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICBzZXRQYXNzd29yZFNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgc2V0UGFzc3dvcmRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbn1cblxuLyoqXG4gKiBMb2dpcXVlIHByaW5jaXBhbGUgZXhcdTAwRTljdXRcdTAwRTllIGF1IGNoYXJnZW1lbnQgZGUgbGEgcGFnZVxuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQWNjZXB0SW52aXRhdGlvbigpIHtcbiAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURFODAgW0FjY2VwdC1JbnZpdGF0aW9uXSBJbml0aWFsaXNhdGlvbiBkdSB0cmFpdGVtZW50XCIpO1xuICBcbiAgY29uc3QgcXVlcnlQYXJhbXMgPSBnZXRRdWVyeVBhcmFtcygpO1xuICBjb25zb2xlLmxvZyhcIlx1RDgzRFx1RENDQiBbQWNjZXB0LUludml0YXRpb25dIFBhcmFtXHUwMEU4dHJlcyBVUkw6XCIsIHtcbiAgICBoYXNUZWFtSWQ6IHF1ZXJ5UGFyYW1zLmhhcygndGVhbUlkJyksXG4gICAgaGFzTWVtYmVyc2hpcElkOiBxdWVyeVBhcmFtcy5oYXMoJ21lbWJlcnNoaXBJZCcpLCBcbiAgICBoYXNVc2VySWQ6IHF1ZXJ5UGFyYW1zLmhhcygndXNlcklkJyksXG4gICAgaGFzU2VjcmV0OiBxdWVyeVBhcmFtcy5oYXMoJ3NlY3JldCcpLFxuICAgIHRlYW1JZDogcXVlcnlQYXJhbXMuZ2V0KCd0ZWFtSWQnKSxcbiAgICBtZW1iZXJzaGlwSWQ6IHF1ZXJ5UGFyYW1zLmdldCgnbWVtYmVyc2hpcElkJyksXG4gICAgdXNlcklkOiBxdWVyeVBhcmFtcy5nZXQoJ3VzZXJJZCcpLFxuICAgIHNlY3JldDogcXVlcnlQYXJhbXMuZ2V0KCdzZWNyZXQnKSA/ICcqKionIDogbnVsbFxuICB9KTtcbiAgXG4gIGlmIChxdWVyeVBhcmFtcy5oYXMoJ3RlYW1JZCcpICYmIHF1ZXJ5UGFyYW1zLmhhcygnbWVtYmVyc2hpcElkJykgJiZcbiAgICAgIHF1ZXJ5UGFyYW1zLmhhcygndXNlcklkJykgJiYgcXVlcnlQYXJhbXMuaGFzKCdzZWNyZXQnKSkge1xuICAgIGFjY2VwdEludml0YXRpb24oKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoZXJyb3JNZXNzYWdlKSB7XG4gICAgICBlcnJvck1lc3NhZ2UudGV4dENvbnRlbnQgPSBcIkF1Y3VuZSBpbnZpdGF0aW9uIHRyb3V2XHUwMEU5ZSBkYW5zIGwnVVJMLiBWZXVpbGxleiB2XHUwMEU5cmlmaWVyIGxlIGxpZW4gZCdpbnZpdGF0aW9uLlwiO1xuICAgIH1cbiAgICBzaG93VUlTdGF0ZSgnZXJyb3InKTtcbiAgfVxufVxuXG4vLyBWXHUwMEU5cmlmaWUgc2kgbGUgRE9NIGVzdCBkXHUwMEU5alx1MDBFMCBjaGFyZ1x1MDBFOSwgc2lub24gYXR0ZW5kIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xuICBjb25zb2xlLmxvZyhcIlx1MjNGMyBbQWNjZXB0LUludml0YXRpb25dIERPTSBlbiBjb3VycyBkZSBjaGFyZ2VtZW50LCBhdHRlbnRlIGRlIERPTUNvbnRlbnRMb2FkZWRcIik7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0aWFsaXplQWNjZXB0SW52aXRhdGlvbik7XG59IGVsc2Uge1xuICBjb25zb2xlLmxvZyhcIlx1MjcwNSBbQWNjZXB0LUludml0YXRpb25dIERPTSBkXHUwMEU5alx1MDBFMCBjaGFyZ1x1MDBFOSwgZXhcdTAwRTljdXRpb24gaW1tXHUwMEU5ZGlhdGVcIik7XG4gIGluaXRpYWxpemVBY2NlcHRJbnZpdGF0aW9uKCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOztBQU1BLE1BQU0sa0JBQWtCO0FBQUEsSUFDdEIsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsWUFBWTtBQUFBLElBQ1osV0FBVztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsZUFBZTtBQUFBO0FBQUEsTUFFZixhQUFhO0FBQUEsSUFDZjtBQUFBLElBQ0EsYUFBYTtBQUFBLE1BQ1gsTUFBTTtBQUFBLE1BQ04sV0FBVztBQUFBLE1BQ1gsVUFBVTtBQUFBLElBQ1o7QUFBQSxFQUNGO0FBR0EsTUFBSSxTQUFTO0FBQ2IsTUFBSSxVQUFVO0FBQ2QsTUFBSSxZQUFZO0FBQ2hCLE1BQUksWUFBWTtBQUNoQixNQUFJLFFBQVE7QUFDWixNQUFJLHdCQUF3QjtBQU81QixXQUFTLGdCQUFnQixjQUFjLElBQUksV0FBVyxLQUFLO0FBQ3pELFdBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3RDLFVBQUksV0FBVztBQUVmLGVBQVMsZ0JBQWdCO0FBQ3ZCO0FBQ0EsWUFDRSxPQUFPLFlBQ1AsT0FBTyxTQUFTLFVBQ2hCLE9BQU8sU0FBUyxTQUNoQjtBQUNBLGtCQUFRO0FBQUEsUUFDVixXQUFXLFlBQVksYUFBYTtBQUNsQyxrQkFBUTtBQUFBLFlBQ047QUFBQSxVQUNGO0FBQ0EsaUJBQU8sSUFBSSxNQUFNLCtDQUF5QyxDQUFDO0FBQUEsUUFDN0QsT0FBTztBQUNMLHFCQUFXLGVBQWUsUUFBUTtBQUFBLFFBQ3BDO0FBQUEsTUFDRjtB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RCxXQUFXLFlBQVksSUFBSSxRQUFRO0FBQUEsTUFDbkMsaUJBQWlCLFlBQVksSUFBSSxjQUFjO0FBQUEsTUFDL0MsV0FBVyxZQUFZLElBQUksUUFBUTtBQUFBLE1BQ25DLFdBQVcsWUFBWSxJQUFJLFFBQVE7QUFBQSxNQUNuQyxRQUFRLFlBQVksSUFBSSxRQUFRO0FBQUEsTUFDaEMsY0FBYyxZQUFZLElBQUksY0FBYztBQUFBLE1BQzVDLFFBQVEsWUFBWSxJQUFJLFFBQVE7QUFBQSxNQUNoQyxRQUFRLFlBQVksSUFBSSxRQUFRLElBQUksUUFBUTtBQUFBLElBQzlDLENBQUM7QUFFRCxRQUFJLFlBQVksSUFBSSxRQUFRLEtBQUssWUFBWSxJQUFJLGNBQWMsS0FDM0QsWUFBWSxJQUFJLFFBQVEsS0FBSyxZQUFZLElBQUksUUFBUSxHQUFHO0FBQzFELHVCQUFpQjtBQUFBLElBQ25CLE9BQU87QUFDTCxVQUFJLGNBQWM7QUFDaEIscUJBQWEsY0FBYztBQUFBLE1BQzdCO0FBQ0Esa0JBQVksT0FBTztBQUFBLElBQ3JCO0FBQUEsRUFDRjtBQUdBLE1BQUksU0FBUyxlQUFlLFdBQVc7QUFDckMsWUFBUSxJQUFJLG9GQUErRTtBQUMzRixhQUFTLGlCQUFpQixvQkFBb0IsMEJBQTBCO0FBQUEsRUFDMUUsT0FBTztBQUNMLFlBQVEsSUFBSSxnRkFBNEQ7QUFDeEUsK0JBQTJCO0FBQUEsRUFDN0I7IiwKICAibmFtZXMiOiBbImFjY291bnQiLCAiZGF0YWJhc2VzIiwgImZ1bmN0aW9ucyIsICJmdW5jdGlvbnMiLCAiYWNjb3VudCIsICJ0ZWFtcyJdCn0K

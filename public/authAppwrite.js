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
  var { APPWRITE_FUNCTION_ID, ACCESS_REQUEST_FUNCTION_ID } = getConfig();
  function getRedirectUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get("redirect");
    if (redirectParam) {
      if (redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
        return redirectParam;
      }
    }
    return null;
  }
  var loadingState = document.getElementById("loading-state");
  var loggedInState = document.getElementById("user-logged-in");
  var loggedOutState = document.getElementById("user-logged-out");
  var loggedOutSections = document.getElementById("logged-out-sections");
  var loginForm = document.getElementById("login-form");
  var logoutButton = document.getElementById("logout-button");
  var errorMessage = document.getElementById("error-message");
  var loginButton = document.getElementById("login-button");
  var loginSpinner = loginButton?.querySelector(".spinner-border");
  var userEmailDisplay = document.getElementById("user-email-display");
  var userEncasGmx = document.getElementById("user-encas-gmx");
  var welcomeUser = document.getElementById("welcome-user");
  var headerLoggedOut = document.getElementById("header-logged-out");
  var headerLoggedIn = document.getElementById("header-logged-in");
  var emailNotVerifiedState = document.getElementById("email-not-verified");
  var resendVerificationButton = document.getElementById(
    "resend-verification"
  );
  var logoutButtonUnverified = document.getElementById(
    "logout-button-unverified"
  );
  var infoMessage = document.getElementById("info-message");
  var userEmailToVerify = document.getElementById("user-email-to-verify");
  var formEmailPwd = document.getElementById("email-pwd-login");
  var formPasswordForgotten = document.getElementById("password-forgotten");
  var forgotPasswordButton = document.getElementById("forgot-password-button");
  var passwordForgottenForm = document.getElementById("password-forgotten-form");
  var submitPasswordForgottenButton = document.getElementById("submit-password-forgotten");
  var submitPasswordForgottenSpinner = submitPasswordForgottenButton?.querySelector(".spinner-border");
  function showUIState(state, message = "") {
    if (loadingState) loadingState.style.display = "none";
    if (loggedInState) loggedInState.style.display = "none";
    if (loggedOutState) loggedOutState.style.display = "none";
    if (emailNotVerifiedState) emailNotVerifiedState.style.display = "none";
    if (loggedOutSections) loggedOutSections.style.display = "none";
    if (formEmailPwd) formEmailPwd.style.display = "none";
    if (formPasswordForgotten) formPasswordForgotten.style.display = "none";
    switch (state) {
      case "loading":
        if (loadingState) loadingState.style.display = "block";
        break;
      case "loggedIn":
        if (loggedInState) loggedInState.style.display = "block";
        if (headerLoggedIn) headerLoggedIn.style.display = "flex";
        if (headerLoggedOut) headerLoggedOut.style.display = "none";
        const appWriteUserName = localStorage.getItem("appwrite-user-name");
        if (userEncasGmx && appWriteUserName === "encas-cookbook") {
          userEncasGmx.style.display = "block";
        } else if (welcomeUser && appWriteUserName) {
          welcomeUser.textContent = `Bienvenue ${appWriteUserName}`;
        }
        break;
      case "loggedOut":
        if (loggedOutState) loggedOutState.style.display = "block";
        if (loggedOutSections) loggedOutSections.style.display = "flex";
        if (formEmailPwd) formEmailPwd.style.display = "block";
        if (headerLoggedOut) headerLoggedOut.style.display = "flex";
        if (headerLoggedIn) headerLoggedIn.style.display = "none";
        break;
      case "emailNotVerified":
        if (emailNotVerifiedState) emailNotVerifiedState.style.display = "block";
        if (loggedOutSections) loggedOutSections.style.display = "flex";
        if (headerLoggedOut) headerLoggedOut.style.display = "flex";
        if (headerLoggedIn) headerLoggedIn.style.display = "none";
        break;
      case "forgotPassword":
        if (loggedOutState) loggedOutState.style.display = "block";
        if (loggedOutSections) loggedOutSections.style.display = "flex";
        if (formPasswordForgotten) formPasswordForgotten.style.display = "block";
        if (headerLoggedOut) headerLoggedOut.style.display = "flex";
        if (headerLoggedIn) headerLoggedIn.style.display = "none";
        break;
    }
    if (errorMessage && message) {
      errorMessage.textContent = message;
      errorMessage.style.display = "block";
    } else if (errorMessage) {
      errorMessage.style.display = "none";
    }
    if (infoMessage) {
      if (state === "emailNotVerified" && message && message.includes("succ\xE8s")) {
        infoMessage.textContent = message;
        infoMessage.style.display = "block";
      } else {
        infoMessage.style.display = "none";
      }
    }
  }
  async function handlePasswordForgottenSubmit(event) {
    event.preventDefault();
    console.log("[AuthAppwrite] Soumission du formulaire de mot de passe oubli\xE9");
    const emailInput = document.getElementById("email");
    const email = emailInput ? emailInput.value : "";
    if (!email) {
      showUIState("forgotPassword", "Veuillez entrer votre adresse email.");
      return;
    }
    if (submitPasswordForgottenButton) submitPasswordForgottenButton.disabled = true;
    if (submitPasswordForgottenSpinner) submitPasswordForgottenSpinner.style.display = "inline-block";
    if (errorMessage) errorMessage.style.display = "none";
    try {
      const account2 = await getAccount();
      const resetURL = `${window.location.origin}/reset-password`;
      await account2.createRecovery(email, resetURL);
      console.log("[AuthAppwrite] Email de r\xE9initialisation de mot de passe envoy\xE9.");
      showUIState("loggedOut", "Un email de r\xE9initialisation de mot de passe a \xE9t\xE9 envoy\xE9 \xE0 votre adresse. Veuillez v\xE9rifier votre bo\xEEte de r\xE9ception.");
    } catch (error) {
      console.error("[AuthAppwrite] Erreur lors de l'envoi de l'email de r\xE9initialisation:", error);
      let userMessage = "Une erreur est survenue lors de l'envoi de l'email de r\xE9initialisation.";
      if (error.response && error.response.code === 404) {
        userMessage = "Aucun compte n'est associ\xE9 \xE0 cette adresse email.";
      }
      showUIState("forgotPassword", userMessage);
    } finally {
      if (submitPasswordForgottenButton) submitPasswordForgottenButton.disabled = false;
      if (submitPasswordForgottenSpinner) submitPasswordForgottenSpinner.style.display = "none";
    }
  }
  function handleForgotPasswordClick(e) {
    e.preventDefault();
    showUIState("forgotPassword");
  }
  async function setupCmsAuthentication() {
    const account2 = await getAccount();
    const functions2 = await getFunctions();
    try {
      const user = await account2.get();
      if (!user.emailVerification) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      const payload = JSON.stringify({ email: user.email });
      const result = await functions2.createExecution(
        APPWRITE_FUNCTION_ID,
        payload,
        false,
        // Pas de lecture
        `/cms-auth/${user.email}`,
        "POST"
      );
      const responseData = JSON.parse(result.responseBody);
      if (responseData && responseData.token) {
        const cmsAuth = {
          token: responseData.token,
          id: responseData.user_id,
          // Ou l'ID retourné par la fonction
          email: user.email,
          name: user.name,
          backendName: "appwrite"
        };
        setAuthData(user.email, user.name, cmsAuth);
        return cmsAuth;
      } else {
        console.error(
          "\u274C [setupCmsAuthentication] R\xE9ponse de la fonction CMS invalide:",
          responseData
        );
        throw new Error("Token CMS manquant dans la r\xE9ponse de la fonction.");
      }
    } catch (error) {
      console.error(
        "\u274C [setupCmsAuthentication] Erreur dans setupCmsAuthentication:",
        error
      );
      throw error;
    }
  }
  async function handleLoginPageLoad() {
    showUIState("loading");
    try {
      if (!window.Appwrite) {
        console.error("\u274C [handleLoginPageLoad] SDK Appwrite non disponible !");
        throw new Error("SDK Appwrite non charg\xE9");
      }
      const account2 = await getAccount();
      const cmsUser = getLocalCmsUser();
      let appwriteUser = null;
      try {
        appwriteUser = await account2.get();
      } catch (e) {
      }
      const isValidCmsUser = cmsUser && cmsUser.token && typeof cmsUser.token === "string" && cmsUser.token.trim() !== "" && cmsUser.token !== "[]" && cmsUser.token !== "undefined" && cmsUser.token !== "null";
      if (cmsUser) {
      }
      if (appwriteUser && isValidCmsUser) {
        setAuthData(appwriteUser.email, appwriteUser.name, cmsUser);
        if (userEmailDisplay)
          userEmailDisplay.textContent = ` (${appwriteUser.email})`;
        showUIState("loggedIn");
        const redirectUrl = getRedirectUrl();
        if (redirectUrl) {
          console.log("[AuthAppwrite] Utilisateur d\xE9j\xE0 authentifi\xE9, redirection vers:", redirectUrl);
          window.location.href = redirectUrl;
        }
        return;
      }
      if (appwriteUser && !isValidCmsUser) {
        try {
          await setupCmsAuthentication();
          const newCmsUser = getLocalCmsUser();
          const isNewCmsUserValid = newCmsUser && newCmsUser.token && typeof newCmsUser.token === "string" && newCmsUser.token.trim() !== "" && newCmsUser.token !== "[]";
          if (isNewCmsUserValid) {
            setAuthData(appwriteUser.email, appwriteUser.name, newCmsUser);
            if (userEmailDisplay)
              userEmailDisplay.textContent = ` (${appwriteUser.email})`;
            showUIState("loggedIn");
            const redirectUrl = getRedirectUrl();
            if (redirectUrl) {
              console.log("[AuthAppwrite] Token CMS r\xE9cup\xE9r\xE9, redirection vers:", redirectUrl);
              window.location.href = redirectUrl;
            }
            return;
          } else {
            console.error(
              "\u274C [handleLoginPageLoad] \xC9chec de r\xE9cup\xE9ration du token CMS"
            );
            throw new Error("Impossible de r\xE9cup\xE9rer le token CMS");
          }
        } catch (error) {
          console.error(
            "\u274C [handleLoginPageLoad] Erreur lors de la r\xE9cup\xE9ration du tokpen CMS:",
            error
          );
          if (error.message === "EMAIL_NOT_VERIFIED") {
            console.warn(
              "\u26A0\uFE0F [handleLoginPageLoad] Email non v\xE9rifi\xE9 - affichage du message appropri\xE9"
            );
            if (userEmailToVerify && appwriteUser) {
              userEmailToVerify.textContent = appwriteUser.email;
            }
            showUIState("emailNotVerified");
            return;
          }
          try {
            await account2.deleteSession("current");
          } catch (cleanupError) {
            console.warn(
              "Erreur lors du nettoyage de la session Appwrite:",
              cleanupError
            );
          }
          clearAuthData();
          showUIState("loggedOut");
          return;
        }
      }
      if (!appwriteUser && isValidCmsUser) {
        clearAuthData();
        showUIState("loggedOut");
        return;
      }
      clearAuthData();
      showUIState("loggedOut");
    } catch (error) {
      console.error("\u274C ERREUR CRITIQUE [handleLoginPageLoad]:", error.message);
      clearAuthData();
      showUIState("loggedOut");
    }
  }
  async function handleLoginSubmit(event) {
    event.preventDefault();
    if (loginButton) loginButton.disabled = true;
    if (loginSpinner) loginSpinner.style.display = "inline-block";
    if (errorMessage) errorMessage.style.display = "none";
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      const account2 = await getAccount();
      const session = await account2.createEmailPasswordSession(email, password);
      await setupCmsAuthentication();
      const cmsUser = getLocalCmsUser();
      if (cmsUser) {
        setAuthData(email, session.providerUid, cmsUser);
        handleRedirect();
      } else {
        console.error(
          "\u274C [handleLoginSubmit] Impossible de r\xE9cup\xE9rer le token CMS apr\xE8s la connexion."
        );
        throw new Error("Impossible de r\xE9cup\xE9rer le token CMS.");
      }
    } catch (error) {
      console.error("\u274C [handleLoginSubmit] Erreur de connexion:", error);
      let userMessage = "\xC9chec de la connexion. Veuillez v\xE9rifier vos identifiants.";
      if (error.code === 401 || error.code === 400) {
        userMessage = "Email ou mot de passe incorrect.";
      } else if (error.message === "EMAIL_NOT_VERIFIED") {
        userMessage = "Votre email n'est pas v\xE9rifi\xE9. Veuillez v\xE9rifier votre bo\xEEte de r\xE9ception ou cliquer sur 'Renvoyer l'email'.";
        showUIState("emailNotVerified", userMessage);
        return;
      } else if (error.message.includes("Account with the given email already exists")) {
        userMessage = "Un compte avec cet email existe d\xE9j\xE0.";
      }
      showUIState("loggedOut", userMessage);
    } finally {
      if (loginButton) loginButton.disabled = false;
      if (loginSpinner) loginSpinner.style.display = "none";
    }
  }
  function handleRedirect() {
    const redirectUrl = getRedirectUrl();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.reload();
    }
  }
  async function handleLogout() {
    clearAuthData();
    try {
      const account2 = await getAccount();
      await account2.deleteSession("current");
      console.log("\u2705 [handleLogout] D\xE9connexion Appwrite r\xE9ussie.");
    } catch (error) {
      console.warn(
        "\u26A0\uFE0F [handleLogout] Erreur lors de la d\xE9connexion Appwrite (peut-\xEAtre d\xE9j\xE0 d\xE9connect\xE9):",
        error
      );
    } finally {
      window.location.reload();
    }
  }
  async function handleResendVerification() {
    if (resendVerificationButton) resendVerificationButton.disabled = true;
    const resendSpinner = resendVerificationButton?.querySelector(".spinner-border");
    if (resendSpinner) resendSpinner.style.display = "inline-block";
    try {
      await sendVerificationEmail();
      showUIState("emailNotVerified", "Email de v\xE9rification renvoy\xE9 avec succ\xE8s ! Veuillez v\xE9rifier votre bo\xEEte de r\xE9ception.");
    } catch (error) {
      console.error("\u274C [handleResendVerification] Erreur lors du renvoi de l'email de v\xE9rification:", error);
      showUIState("emailNotVerified", "Erreur lors du renvoi de l'email de v\xE9rification. Veuillez r\xE9essayer plus tard.");
    } finally {
      if (resendVerificationButton) resendVerificationButton.disabled = false;
      if (resendSpinner) resendSpinner.style.display = "none";
    }
  }
  async function handleAccessRequest(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector("#Form-submit");
    const submitSpinner = submitButton.querySelector(".spinner-border");
    const emailInput = form.querySelector("#contact-form-email");
    const messageInput = form.querySelector("#contact-form-message");
    const formFeedback = document.getElementById("form-feedback");
    if (submitButton) submitButton.disabled = true;
    if (submitSpinner) submitSpinner.style.display = "inline-block";
    if (formFeedback) {
      formFeedback.style.display = "none";
      formFeedback.className = "mb-3";
    }
    const email = emailInput.value;
    const message = messageInput.value;
    if (!email || !message) {
      if (formFeedback) {
        formFeedback.textContent = "Veuillez remplir tous les champs.";
        formFeedback.classList.add("alert", "alert-danger");
        formFeedback.style.display = "block";
      }
      if (submitButton) submitButton.disabled = false;
      if (submitSpinner) submitSpinner.style.display = "none";
      return;
    }
    try {
      const functions2 = await getFunctions();
      const payload = JSON.stringify({ email, message });
      console.log("[AccessRequest] Appel de la fonction de demande d'acc\xE8s avec payload:", payload);
      const result = await functions2.createExecution(
        ACCESS_REQUEST_FUNCTION_ID,
        payload,
        false,
        // Ne pas lire
        `/access-request/${email}`,
        "POST"
      );
      console.log("[AccessRequest] Ex\xE9cution de la fonction Appwrite r\xE9ussie:", result);
      if (result.statusCode === 200) {
        if (formFeedback) {
          formFeedback.textContent = "Votre demande d'acc\xE8s a \xE9t\xE9 envoy\xE9e avec succ\xE8s ! Nous vous recontacterons bient\xF4t.";
          formFeedback.classList.add("alert", "alert-success");
          formFeedback.style.display = "block";
        }
        form.reset();
      } else {
        const errorData = JSON.parse(result.responseBody);
        throw new Error(errorData.message || `Erreur Appwrite: ${result.statusCode}`);
      }
    } catch (error) {
      console.error("[AccessRequest] Erreur lors de l'envoi de la demande d'acc\xE8s:", error);
      if (formFeedback) {
        formFeedback.textContent = `Erreur : ${error.message || "Une erreur est survenue lors de l'envoi de votre demande."}`;
        formFeedback.classList.add("alert", "alert-danger");
        formFeedback.style.display = "block";
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
      if (submitSpinner) submitSpinner.style.display = "none";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    handleLoginPageLoad();
    if (loginForm) {
      loginForm.addEventListener("submit", handleLoginSubmit);
    }
    if (logoutButton) {
      logoutButton.addEventListener("click", handleLogout);
    }
    if (logoutButtonUnverified) {
      logoutButtonUnverified.addEventListener("click", handleLogout);
    }
    if (resendVerificationButton) {
      resendVerificationButton.addEventListener("click", handleResendVerification);
    }
    if (forgotPasswordButton) {
      forgotPasswordButton.addEventListener("click", handleForgotPasswordClick);
    }
    if (passwordForgottenForm) {
      passwordForgottenForm.addEventListener("submit", handlePasswordForgottenSubmit);
    }
    const accessRequestForm = document.getElementById("access-request-form");
    if (accessRequestForm) {
      accessRequestForm.addEventListener("submit", handleAccessRequest);
    }
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvL0RldmVsb3BwZW1lbnQvRU5LQS1DT09LQk9PSy9odWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanMiLCAiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzXG4vLyBNb2R1bGUgY29tbXVuIHBvdXIgbCdpbml0aWFsaXNhdGlvbiBldCBsYSBnZXN0aW9uIGR1IGNsaWVudCBBcHB3cml0ZVxuLy8gXHUwMEM5dml0ZSBsYSBkdXBsaWNhdGlvbiBkJ2luaXRpYWxpc2F0aW9uIGVudHJlIGF1dGgtc3RhdHVzLmpzIGV0IGF1dGhBcHB3cml0ZS5qc1xuLy8gTEVHQUNZIDogbWlncmVyIHRvdXRlIGxlcyBkXHUwMEU5cGVuZGFuZGUgKGF1dGgsIGludml0YXRpb24sIGV0Yy4uLilcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQ0VOVFJBTEUgQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9DT05GSUcgPSB7XG4gIGVuZHBvaW50OiBcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIixcbiAgcHJvamVjdElkOiBcIjY4OTcyNTgyMDAyNGU4MTc4MWI3XCIsXG4gIGRhdGFiYXNlSWQ6IFwiNjg5ZDE1YjEwMDAzYTVhMTM2MzZcIixcbiAgZnVuY3Rpb25zOiB7XG4gICAgY21zQXV0aDogXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiLFxuICAgIGFjY2Vzc1JlcXVlc3Q6IFwiNjg5Y2RlYTUwMDFhNGQ3NDU0OWRcIixcbiAgICAvLyBjcmVhdGVQcm9kdWN0TGlzdDogXCI2OGYwMDQ4NzAwMGM2MjQ1MzNhM1wiLFxuICAgIGJhdGNoVXBkYXRlOiBcIjY4ZjAwNDg3MDAwYzYyNDUzM2EzXCIsXG4gIH0sXG4gIGNvbGxlY3Rpb25zOiB7XG4gICAgbWFpbjogXCJtYWluXCIsXG4gICAgcHVyY2hhc2VzOiBcInB1cmNoYXNlc1wiLFxuICAgIHByb2R1Y3RzOiBcInByb2R1Y3RzXCIsXG4gIH0sXG59O1xuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGRhdGFiYXNlcyA9IG51bGw7XG5sZXQgdGVhbXMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cblxuLyoqXG4gKiBBdHRlbmQgcXVlIGxlIFNESyBBcHB3cml0ZSBzb2l0IGNoYXJnXHUwMEU5IGV0IGluaXRpYWxpc2UgbGVzIGNsaWVudHNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlIHF1aSBzZSByXHUwMEU5c291dCBxdWFuZCBsJ2luaXRpYWxpc2F0aW9uIGVzdCB0ZXJtaW5cdTAwRTllXG4gKi9cbmZ1bmN0aW9uIHdhaXRGb3JBcHB3cml0ZShtYXhBdHRlbXB0cyA9IDUwLCBpbnRlcnZhbCA9IDEwMCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGxldCBhdHRlbXB0cyA9IDA7XG5cbiAgICBmdW5jdGlvbiBjaGVja0FwcHdyaXRlKCkge1xuICAgICAgYXR0ZW1wdHMrKztcbiAgICAgIGlmIChcbiAgICAgICAgd2luZG93LkFwcHdyaXRlICYmXG4gICAgICAgIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiZcbiAgICAgICAgd2luZG93LkFwcHdyaXRlLkFjY291bnRcbiAgICAgICkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2UgaWYgKGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJbQXBwd3JpdGUgQ2xpZW50XSBTREsgQXBwd3JpdGUgbm9uIGNoYXJnXHUwMEU5IGFwclx1MDBFOHMgbGUgbm9tYnJlIG1heGltdW0gZGUgdGVudGF0aXZlc1wiLFxuICAgICAgICApO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiTGUgU0RLIEFwcHdyaXRlIG4nYSBwYXMgcHUgXHUwMEVBdHJlIGNoYXJnXHUwMEU5LlwiKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjaGVja0FwcHdyaXRlKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEluaXRpYWxpc2UgbGVzIGNsaWVudHMgQXBwd3JpdGUgKHVuZSBzZXVsZSBmb2lzKVxuICogQHJldHVybnMge1Byb21pc2U8e2NsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zLCBkYXRhYmFzZXN9Pn0gTGVzIGNsaWVudHMgaW5pdGlhbGlzXHUwMEU5c1xuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwd3JpdGUoKSB7XG4gIGlmIChjbGllbnQgJiYgYWNjb3VudCAmJiBmdW5jdGlvbnMgJiYgZGF0YWJhc2VzKSB7XG4gICAgcmV0dXJuIHsgY2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnMsIGRhdGFiYXNlcyB9O1xuICB9XG5cbiAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgIHJldHVybiBpbml0aWFsaXphdGlvblByb21pc2U7XG4gIH1cblxuICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIERcdTAwRTlidXQgZGUgbCdpbml0aWFsaXNhdGlvblwiKTtcbiAgICAgIGF3YWl0IHdhaXRGb3JBcHB3cml0ZSgpO1xuXG4gICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zLCBEYXRhYmFzZXMsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAuc2V0RW5kcG9pbnQoQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50KVxuICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9DT05GSUcucHJvamVjdElkKTtcblxuICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG4gICAgICBkYXRhYmFzZXMgPSBuZXcgRGF0YWJhc2VzKGNsaWVudCk7XG4gICAgICB0ZWFtcyA9IG5ldyBUZWFtcyhjbGllbnQpO1xuXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucywgZGF0YWJhc2VzLCB0ZWFtcyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsXG4gICAgICAgIGVycm9yLFxuICAgICAgKTtcbiAgICAgIGNsaWVudCA9IG51bGw7XG4gICAgICBhY2NvdW50ID0gbnVsbDtcbiAgICAgIGZ1bmN0aW9ucyA9IG51bGw7XG4gICAgICBkYXRhYmFzZXMgPSBudWxsO1xuICAgICAgdGVhbXMgPSBudWxsO1xuICAgICAgaW5pdGlhbGl6YXRpb25Qcm9taXNlID0gbnVsbDtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vLyAtLS0gRm9uY3Rpb25zIGV4cG9ydFx1MDBFOWVzIC0tLVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBcHB3cml0ZUNsaWVudHMoKSB7XG4gIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWNjb3VudCgpIHtcbiAgaWYgKCFhY2NvdW50KSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGFjY291bnQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlYW1zKCkge1xuICBpZiAoIXRlYW1zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIHRlYW1zO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGdW5jdGlvbnMoKSB7XG4gIGlmICghZnVuY3Rpb25zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YWJhc2VzKCkge1xuICBpZiAoIWRhdGFiYXNlcykgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gIHJldHVybiBkYXRhYmFzZXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgcmV0dXJuIHtcbiAgICBBUFBXUklURV9FTkRQT0lOVDogQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50LFxuICAgIEFQUFdSSVRFX1BST0pFQ1RfSUQ6IEFQUFdSSVRFX0NPTkZJRy5wcm9qZWN0SWQsXG4gICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQ6IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY21zQXV0aCxcbiAgICBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRDogQVBQV1JJVEVfQ09ORklHLmZ1bmN0aW9ucy5hY2Nlc3NSZXF1ZXN0LFxuICAgIEFQUFdSSVRFX0NPTkZJRzogQVBQV1JJVEVfQ09ORklHLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0luaXRpYWxpemVkKCkge1xuICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zICYmIGRhdGFiYXNlcyAmJiB0ZWFtcyk7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgY29uc3QgY21zVXNlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiKTtcbiAgaWYgKCFjbXNVc2VyKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICBpZiAoXG4gICAgICBwYXJzZWRVc2VyLnRva2VuICYmXG4gICAgICB0eXBlb2YgcGFyc2VkVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgcGFyc2VkVXNlci50b2tlbi50cmltKCkgIT09IFwiXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBwYXJzZWRVc2VyO1xuICAgIH1cbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkQ21zKCkge1xuICByZXR1cm4gZ2V0TG9jYWxDbXNVc2VyKCkgIT09IG51bGw7XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIHVuZSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZSBleGlzdGUuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVnJhaSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5LCBzaW5vbiBmYXV4LlxuICovXG5hc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgYXdhaXQgYWNjLmdldCgpOyAvLyBMXHUwMEU4dmUgdW5lIGV4Y2VwdGlvbiBzaSBhdWN1bmUgc2Vzc2lvbiBuJ2VzdCBhY3RpdmVcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgY29ubmVjdFx1MDBFOSBhdmVjIHVuZSBzZXNzaW9uIEFwcHdyaXRlIHZhbGlkZS5cbiAqIENldHRlIGZvbmN0aW9uIHZcdTAwRTlyaWZpZSBcdTAwRTAgbGEgZm9pcyBsZSBjb21wdGUgdXRpbGlzYXRldXIgRVQgbGEgdmFsaWRpdFx1MDBFOSBkZSBsYSBzZXNzaW9uLlxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFZyYWkgc2kgYXV0aGVudGlmaVx1MDBFOSBhdmVjIHNlc3Npb24gYWN0aXZlLCBzaW5vbiBmYXV4XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzQ29ubmVjdGVkQXBwd3JpdGUoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuXG4gICAgLy8gVlx1MDBFOXJpZmllciBsZSBjb21wdGUgdXRpbGlzYXRldXJcbiAgICBjb25zdCBhY2NvdW50RGF0YSA9IGF3YWl0IGFjYy5nZXQoKTtcbiAgICBpZiAoIWFjY291bnREYXRhIHx8ICFhY2NvdW50RGF0YS4kaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWXHUwMEU5cmlmaWVyIGV4cGxpY2l0ZW1lbnQgbGEgc2Vzc2lvbiBjb3VyYW50ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBhY2MuZ2V0U2Vzc2lvbihcImN1cnJlbnRcIik7XG4gICAgaWYgKCFzZXNzaW9uIHx8ICFzZXNzaW9uLiRpZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHNlc3Npb24gbidlc3QgcGFzIGV4cGlyXHUwMEU5ZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZXhwaXJlRGF0ZSA9IG5ldyBEYXRlKHNlc3Npb24uZXhwaXJlKTtcbiAgICBpZiAobm93ID49IGV4cGlyZURhdGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXNzaW9uIHZhbGlkZSAtIHJldG91cm5lciB0cnVlIHNpbXBsZW1lbnRcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY2hlY2tpbmcgY29ubmVjdGlvbjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2MuZ2V0KCk7XG4gICAgcmV0dXJuIHVzZXIuZW1haWxWZXJpZmljYXRpb24gfHwgZmFsc2U7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3QgdmVyaWZpY2F0aW9uVVJMID1cbiAgICAgIHJlZGlyZWN0VVJMIHx8IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L3ZlcmlmeS1lbWFpbGA7XG4gICAgYXdhaXQgYWNjLmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbCdlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOlwiLFxuICAgICAgZXJyb3IsXG4gICAgKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFjYyA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2MudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgXCJbQXBwd3JpdGVDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uIGQnZW1haWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEF1dGhlbnRpY2F0aW9uU3RhdGUoKSB7XG4gIGNvbnN0IGNtc1VzZXIgPSBnZXRMb2NhbENtc1VzZXIoKTtcbiAgaWYgKCFjbXNVc2VyKVxuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZSxcbiAgICB9O1xuICB0cnkge1xuICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICByZXR1cm4ge1xuICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBlbWFpbFZlcmlmaWVkLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZCxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHRydWUsXG4gICAgICBpc0VtYWlsVmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VXNlckVtYWlsKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiYXBwd3JpdGUtdXNlci1uYW1lXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzXCIpO1xufVxuXG5mdW5jdGlvbiBjbGVhckF1dGhEYXRhKCkge1xuICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiYXBwd3JpdGUtdXNlci1lbWFpbFwiKTtcbiAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1c1wiKTtcbn1cbi8qKlxuICogVmFsaWRlIGV0IHByXHUwMEU5cGFyZSBsZXMgZG9ublx1MDBFOWVzIG5cdTAwRTljZXNzYWlyZXMgcG91ciBsYSBjclx1MDBFOWF0aW9uIHRyYW5zYWN0aW9ubmVsbGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7ZXZlbnREYXRhLCB1c2VyLCBjb250ZW50SGFzaH0+fSBEb25uXHUwMEU5ZXMgdmFsaWRcdTAwRTllc1xuICovXG5hc3luYyBmdW5jdGlvbiB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCkge1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gVmFsaWRhdGlvbiBkZXMgZG9ublx1MDBFOWVzIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICApO1xuXG4gIC8vIFJcdTAwRTljdXBcdTAwRTlyZXIgZXQgdmFsaWRlciBsZXMgZG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgIGAvZXZlbmVtZW50cy8ke2V2ZW50SWR9L2luZ3JlZGllbnRzX2F3L2luZGV4Lmpzb25gLFxuICApO1xuICBpZiAoIXJlc3BvbnNlLm9rKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGVzIGRvbm5cdTAwRTllcyBkZSBsJ1x1MDBFOXZcdTAwRTluZW1lbnQ6ICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgKTtcbiAgY29uc3QgZXZlbnREYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudCByXHUwMEU5Y3VwXHUwMEU5clx1MDBFOWVzOmAsXG4gICAgZXZlbnREYXRhLFxuICApO1xuXG4gIGNvbnN0IHsgYWNjb3VudCwgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBVdGlsaXNhdGV1ciBhdXRoZW50aWZpXHUwMEU5OiAke3VzZXIuJGlkfWApO1xuXG4gIC8vIFZcdTAwRTlyaWZpZXIgc2kgbCdcdTAwRTl2XHUwMEU5bmVtZW50IGV4aXN0ZSBkXHUwMEU5alx1MDBFMFxuICB0cnkge1xuICAgIGF3YWl0IGRhdGFiYXNlcy5nZXREb2N1bWVudChcbiAgICAgIEFQUFdSSVRFX0NPTkZJRy5kYXRhYmFzZUlkLFxuICAgICAgQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zLm1haW4sXG4gICAgICBldmVudElkLFxuICAgICk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gTCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH0gZXhpc3RlIGRcdTAwRTlqXHUwMEUwIGRhbnMgbWFpbmAsXG4gICAgKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGAvc3ZfcHJvZHVjdHMvP2xpc3RJZD0ke2V2ZW50SWR9YDtcbiAgICByZXR1cm4gbnVsbDsgLy8gUmV0b3VybmVyIG51bGwgcG91ciBpbmRpcXVlciB1bmUgcmVkaXJlY3Rpb25cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gNDA0KSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBSXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIGhhc2ggZGVwdWlzIGxlcyBwYXJhbVx1MDBFOHRyZXMgZ2xvYmF1eFxuICBjb25zdCBjb250ZW50SGFzaCA9IHdpbmRvdy5fX0hVR09fUEFSQU1TX18/Lmxpc3RDb250ZW50SGFzaDtcbiAgaWYgKCFjb250ZW50SGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlIGhhc2ggZHUgY29udGVudSBuJ2VzdCBwYXMgZFx1MDBFOWZpbmlcIik7XG4gIH1cblxuICByZXR1cm4geyBldmVudERhdGEsIHVzZXIsIGNvbnRlbnRIYXNoIH07XG59XG5cbi8qKlxuICogQXBwZWxsZSBsYSBmb25jdGlvbiBBcHB3cml0ZSBjXHUwMEY0dFx1MDBFOSBzZXJ2ZXVyIHBvdXIgY3JcdTAwRTllciBsYSBsaXN0ZVxuICogVXRpbGlzZSBsZSBTREsgQXBwd3JpdGUgcG91ciBcdTAwRTl2aXRlciBsZXMgcHJvYmxcdTAwRThtZXMgQ09SU1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZXZlbnREYXRhIC0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50SGFzaCAtIEhhc2ggZHUgY29udGVudVxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgZXZlbnRJZCxcbiAgZXZlbnREYXRhLFxuICB1c2VySWQsXG4gIGNvbnRlbnRIYXNoLFxuKSB7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBBcHBlbCBkZSBsYSBmb25jdGlvbiBzZXJ2ZXVyIHBvdXIgJHtldmVudElkfWApO1xuXG4gIC8vIElEIHJcdTAwRTllbCBkZSB2b3RyZSBmb25jdGlvbiBBcHB3cml0ZVxuICBjb25zdCBGVU5DVElPTl9JRCA9IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY3JlYXRlUHJvZHVjdExpc3Q7XG5cbiAgY29uc3QgeyBmdW5jdGlvbnMgfSA9IGF3YWl0IGluaXRpYWxpemVBcHB3cml0ZSgpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgIEZVTkNUSU9OX0lELFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBldmVudElkLFxuICAgICAgICBldmVudERhdGEsXG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgY29udGVudEhhc2gsXG4gICAgICB9KSxcbiAgICAgIHRydWUsIC8vIGFzeW5jID0gdHJ1ZSAtIEVYXHUwMEM5Q1VUSU9OIEFTWU5DSFJPTkVcbiAgICAgIFwiL1wiLCAvLyBwYXRoIChvcHRpb25uZWwpXG4gICAgICBcIkdFVFwiLCAvLyBtZXRob2QgKG9wdGlvbm5lbClcbiAgICAgIHt9LCAvLyBQYXMgYmVzb2luIGQnZW4tdFx1MDBFQXRlcyBwZXJzb25uYWxpc1x1MDBFOXNcbiAgICApO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gZFx1MDBFOW1hcnJcdTAwRTllIGVuIG1vZGUgYXN5bmNocm9uZTpgLFxuICAgICAgcmVzdWx0LFxuICAgICk7XG5cbiAgICAvLyBFbiBtb2RlIGFzeW5jaHJvbmUsIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzLCBvbiBuZSBmYWl0IHBhcyBkZSBwb2xsaW5nXG4gICAgLy8gTGEgZm9uY3Rpb24gdmEgcydleFx1MDBFOWN1dGVyIGVuIGFycmlcdTAwRThyZS1wbGFuIGV0IG9uIHN1cHBvc2UgcXVlIFx1MDBFN2EgdmEgclx1MDBFOXVzc2lyXG4gICAgY29uc3QgZXhlY3V0aW9uSWQgPSByZXN1bHQuJGlkO1xuICAgIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBFeGVjdXRpb24gSUQ6ICR7ZXhlY3V0aW9uSWR9YCk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gYXN5bmMgZFx1MDBFOW1hcnJcdTAwRTllIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzIC0gcGFzIGRlIHBvbGxpbmdgLFxuICAgICk7XG5cbiAgICAvLyBQb3VyIDMwMCsgaW5nclx1MDBFOWRpZW50cywgb24gcmV0b3VybmUgaW1tXHUwMEU5ZGlhdGVtZW50IHVuIHN1Y2NcdTAwRThzXG4gICAgLy8gTCd1dGlsaXNhdGV1ciB2ZXJyYSBsZXMgclx1MDBFOXN1bHRhdHMgcXVhbmQgbGEgZm9uY3Rpb24gYXVyYSB0ZXJtaW5cdTAwRTlcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGV2ZW50SWQsXG4gICAgICBleGVjdXRpb25JZCxcbiAgICAgIG1lc3NhZ2U6IFwiVHJhaXRlbWVudCBkXHUwMEU5bWFyclx1MDBFOSBlbiBhcnJpXHUwMEU4cmUtcGxhbiAoMzAwKyBpbmdyXHUwMEU5ZGllbnRzKVwiLFxuICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnYXBwZWwgZm9uY3Rpb246YCwgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogRm9uY3Rpb24gcHJpbmNpcGFsZSAtIGNyXHUwMEU5ZSB1bmUgbGlzdGUgZGUgcHJvZHVpdHMgY29sbGFib3JhdGlmc1xuICogVXRpbGlzZSBtYWludGVuYW50IGxhIGZvbmN0aW9uIEFwcHdyaXRlIGNcdTAwRjR0XHUwMEU5IHNlcnZldXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29sbGFib3JhdGl2ZVByb2R1Y3RzTGlzdEZyb21FdmVudChldmVudElkKSB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWJ1dCBkZSBsYSBjclx1MDBFOWF0aW9uIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICAgICk7XG5cbiAgICAvLyAxLiBWYWxpZGF0aW9uIGV0IHByXHUwMEU5cGFyYXRpb24gZGVzIGRvbm5cdTAwRTllc1xuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSBhd2FpdCB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCk7XG4gICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0KSB7XG4gICAgICAvLyBSZWRpcmVjdGlvbiBkXHUwMEU5alx1MDBFMCBnXHUwMEU5clx1MDBFOWUgZGFucyB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGFcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IGV2ZW50RGF0YSwgdXNlciwgY29udGVudEhhc2ggfSA9IHZhbGlkYXRpb25SZXN1bHQ7XG4gICAgY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIERvbm5cdTAwRTllcyB2YWxpZFx1MDBFOWVzLCBhcHBlbCBkZSBsYSBmb25jdGlvbmApO1xuXG4gICAgLy8gMi4gQXBwZWwgZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgY1x1MDBGNHRcdTAwRTkgc2VydmV1clxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgICAgIGV2ZW50SWQsXG4gICAgICBldmVudERhdGEsXG4gICAgICB1c2VyLiRpZCxcbiAgICAgIGNvbnRlbnRIYXNoLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBPcFx1MDBFOXJhdGlvbiByXHUwMEU5dXNzaWUsIHJlZGlyZWN0aW9uIHZlcnMgbGEgbGlzdGVgLFxuICAgICk7XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgL3N2X3Byb2R1Y3RzLz9saXN0SWQ9JHtldmVudElkfWA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBjclx1MDBFOWF0aW9uOmAsXG4gICAgICBlcnJvci5tZXNzYWdlLFxuICAgICk7XG5cbiAgICAvLyBHZXN0aW9uIGRlcyBlcnJldXJzIHNwXHUwMEU5Y2lmaXF1ZXNcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhcImFscmVhZHlfZXhpc3RzXCIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2V0dGUgbGlzdGUgZGUgcHJvZHVpdHMgZXhpc3RlIGRcdTAwRTlqXHUwMEUwLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBhdmVjIHVuIElEIGRpZmZcdTAwRTlyZW50LlwiLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoXCJ0cmFuc2FjdGlvbl9saW1pdF9leGNlZWRlZFwiKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkxpbWl0ZSBkZSB0cmFuc2FjdGlvbnMgZFx1MDBFOXBhc3NcdTAwRTllLiBWZXVpbGxleiByXHUwMEU5ZHVpcmUgbGUgbm9tYnJlIGQnaW5nclx1MDBFOWRpZW50cyBvdSByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tFeGlzdGluZ01haW5Hcm91cChtYWluR3JvdXBJZCkge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHNpIGxlIGRvY3VtZW50IGV4aXN0ZSBkaXJlY3RlbWVudCBkYW5zIGxhIGNvbGxlY3Rpb24gJ21haW4nXG4gICAgY29uc3QgZXhpc3RpbmdNYWluR3JvdXAgPSBhd2FpdCBkYXRhYmFzZXMuZ2V0RG9jdW1lbnQoXG4gICAgICBcIjY4OWQxNWIxMDAwM2E1YTEzNjM2XCIsXG4gICAgICBcIm1haW5cIixcbiAgICAgIG1haW5Hcm91cElkLFxuICAgICk7XG4gICAgcmV0dXJuICEhZXhpc3RpbmdNYWluR3JvdXA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBMZSBkb2N1bWVudCBuJ2V4aXN0ZSBwYXNcbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIFwiW0FwcHdyaXRlIENsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZHUgbWFpbiBncm91cCBleGlzdGFudDpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgdHJ5IHtcbiAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGF3YWl0IGFjYy5kZWxldGVTZXNzaW9uKFwiY3VycmVudFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIGRcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgKHBldXQtXHUwMEVBdHJlIGRcdTAwRTlqXHUwMEUwIGRcdTAwRTljb25uZWN0XHUwMEU5KTpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIsIGVtYWlsKTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIiwgbmFtZSk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8qKlxuICogUydhYm9ubmUgYXV4IG1pc2VzIFx1MDBFMCBqb3VyIHRlbXBzIHJcdTAwRTllbCBwb3VyIHVuZSBsaXN0ZSBkZSBjb2xsZWN0aW9ucy5cbiAqIFV0aWxpc2UgbCdBUEkgQXBwd3JpdGUgc3Vic2NyaWJlKCkgcXVpIGdcdTAwRThyZSBhdXRvbWF0aXF1ZW1lbnQgbGVzIGNvbm5leGlvbnMgV2ViU29ja2V0LlxuICogQHBhcmFtIHtzdHJpbmdbXX0gY29sbGVjdGlvbk5hbWVzIC0gTm9tcyBkZXMgY29sbGVjdGlvbnMgKGV4OiBbJ2luZ3JlZGllbnRzJywgJ3B1cmNoYXNlcyddKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0SWQgLSBJRCBkZSBsYSBsaXN0ZSAocG91ciBmaWx0cmFnZSBzaSBuXHUwMEU5Y2Vzc2FpcmUpLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gb25NZXNzYWdlIC0gQ2FsbGJhY2sgcG91ciBsZXMgbWVzc2FnZXMgZGUgZG9ublx1MDBFOWVzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbm5lY3Rpb25DYWxsYmFja3MgLSBDYWxsYmFja3MgcG91ciBsZXMgXHUwMEU5dlx1MDBFOW5lbWVudHMgZGUgY29ubmV4aW9uLlxuICogQHJldHVybnMge2Z1bmN0aW9ufSBVbmUgZm9uY3Rpb24gcG91ciBzZSBkXHUwMEU5c2Fib25uZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zKFxuICBjb2xsZWN0aW9uTmFtZXMsXG4gIGxpc3RJZCxcbiAgb25NZXNzYWdlLFxuICBjb25uZWN0aW9uQ2FsbGJhY2tzID0ge30sXG4pIHtcbiAgY29uc3QgeyBvbkNvbm5lY3QsIG9uRGlzY29ubmVjdCwgb25FcnJvciB9ID0gY29ubmVjdGlvbkNhbGxiYWNrcztcblxuICBpZiAoIWNsaWVudCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIkltcG9zc2libGUgZGUgcydhYm9ubmVyIDogbGUgY2xpZW50IEFwcHdyaXRlIG4nZXN0IHBhcyBlbmNvcmUgaW5pdGlhbGlzXHUwMEU5LlwiLFxuICAgICk7XG4gICAgb25FcnJvcj8uKHsgbWVzc2FnZTogXCJDbGllbnQgQXBwd3JpdGUgbm9uIGluaXRpYWxpc1x1MDBFOVwiIH0pO1xuICAgIHJldHVybiAoKSA9PiB7fTtcbiAgfVxuXG4gIGNvbnN0IGNoYW5uZWxzID0gY29sbGVjdGlvbk5hbWVzXG4gICAgLm1hcCgobmFtZSkgPT4ge1xuICAgICAgY29uc3QgY29sbGVjdGlvbklkID0gQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBOb20gZGUgY29sbGVjdGlvbiBpbmNvbm51IGRhbnMgbGEgY29uZmlndXJhdGlvbjogJHtuYW1lfWAsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGBkYXRhYmFzZXMuJHtBUFBXUklURV9DT05GSUcuZGF0YWJhc2VJZH0uY29sbGVjdGlvbnMuJHtjb2xsZWN0aW9uSWR9LmRvY3VtZW50c2A7XG4gICAgfSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQWJvbm5lbWVudCBhdXggY2FuYXV4IGVuIGNvdXJzLi4uXCIsIGNoYW5uZWxzKTtcblxuICB0cnkge1xuICAgIC8vIExhIG1cdTAwRTl0aG9kZSBjbGllbnQuc3Vic2NyaWJlKCkgZ1x1MDBFOHJlIGF1dG9tYXRpcXVlbWVudCBsYSBjb25uZXhpb24gV2ViU29ja2V0XG4gICAgLy8gc2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBvZmZpY2llbGxlIEFwcHdyaXRlXG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSBjbGllbnQuc3Vic2NyaWJlKGNoYW5uZWxzLCAocmVzcG9uc2UpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWNlcHRpb24gdGVtcHMgclx1MDBFOWVsOlwiLCByZXNwb25zZSk7XG4gICAgICBvbk1lc3NhZ2UocmVzcG9uc2UpO1xuICAgIH0pO1xuXG4gICAgLy8gU2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBBcHB3cml0ZSwgbGEgc3Vic2NyaXB0aW9uIGVzdCBhdXRvbWF0aXF1ZW1lbnQgYWN0aXZlXG4gICAgLy8gT24gcGV1dCBjb25zaWRcdTAwRTlyZXIgbGEgY29ubmV4aW9uIGNvbW1lIFx1MDBFOXRhYmxpZSBpbW1cdTAwRTlkaWF0ZW1lbnRcbiAgICBpZiAob25Db25uZWN0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBDb25uZXhpb24gdGVtcHMgclx1MDBFOWVsIFx1MDBFOXRhYmxpZVwiKTtcbiAgICAgICAgb25Db25uZWN0KCk7XG4gICAgICB9LCA1MCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHNvdXNjcmlwdGlvbiB0ZW1wcyByXHUwMEU5ZWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIG9uRXJyb3I/LihlcnJvcik7XG4gICAgcmV0dXJuICgpID0+IHt9OyAvLyBSZXRvdXJuZXIgdW5lIGZvbmN0aW9uIHZpZGUgZW4gY2FzIGQnZXJyZXVyXG4gIH1cbn1cblxuLy8gRXhwb3J0IGRlcyBmb25jdGlvbnMgcHVibGlxdWVzXG5leHBvcnQge1xuICBBUFBXUklURV9DT05GSUcsIC8vIEFqb3V0XHUwMEU5IHBvdXIgY29uc29saWRlciBsZXMgZXhwb3J0c1xuICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gIGdldEFjY291bnQsXG4gIGdldEZ1bmN0aW9ucyxcbiAgZ2V0VGVhbXMsXG4gIGdldERhdGFiYXNlcyxcbiAgZ2V0Q29uZmlnLFxuICBpc0luaXRpYWxpemVkLFxuICBpbml0aWFsaXplQXBwd3JpdGUsXG4gIGdldExvY2FsQ21zVXNlcixcbiAgaXNBdXRoZW50aWNhdGVkQ21zLFxuICBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSxcbiAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgZ2V0VXNlckVtYWlsLFxuICBnZXRVc2VyTmFtZSxcbiAgY2xlYXJBdXRoRGF0YSxcbiAgc2V0QXV0aERhdGEsXG4gIGxvZ291dEdsb2JhbCxcbiAgaXNFbWFpbFZlcmlmaWVkLFxuICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gIHZlcmlmeUVtYWlsLFxuICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICBjcmVhdGVDb2xsYWJvcmF0aXZlUHJvZHVjdHNMaXN0RnJvbUV2ZW50LFxuICBjaGVja0V4aXN0aW5nTWFpbkdyb3VwLFxufTtcblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgIGdldEFwcHdyaXRlQ2xpZW50cyxcbiAgICBnZXRBY2NvdW50LFxuICAgIGdldEZ1bmN0aW9ucyxcbiAgICBnZXREYXRhYmFzZXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMsXG4gICAgaXNBdXRoZW50aWNhdGVkQXBwd3JpdGUsXG4gICAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgICBnZXRVc2VyRW1haWwsXG4gICAgZ2V0VXNlck5hbWUsXG4gICAgY2xlYXJBdXRoRGF0YSxcbiAgICBzZXRBdXRoRGF0YSxcbiAgICBsb2dvdXRHbG9iYWwsXG4gICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgICB2ZXJpZnlFbWFpbCxcbiAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICAgIGNyZWF0ZUNvbGxhYm9yYXRpdmVQcm9kdWN0c0xpc3RGcm9tRXZlbnQsXG4gICAgY2hlY2tFeGlzdGluZ01haW5Hcm91cCxcbiAgICBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zLFxuICB9O1xufVxuIiwgIlxuLy8gQ2hhcmdcdTAwRTkgcGFyIC9sb2dpblxuXG5pbXBvcnQge1xuICBnZXRBY2NvdW50LFxuICBnZXRGdW5jdGlvbnMsXG4gIGdldENvbmZpZyxcbiAgZ2V0TG9jYWxDbXNVc2VyLFxuICBjbGVhckF1dGhEYXRhLFxuICBzZXRBdXRoRGF0YSxcbiAgaXNFbWFpbFZlcmlmaWVkLFxuICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gIHZlcmlmeUVtYWlsLFxufSBmcm9tIFwiLi9hcHB3cml0ZS1jbGllbnQuanNcIjtcblxuLy8gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkZSBsYSBjb25maWd1cmF0aW9uXG5jb25zdCB7IEFQUFdSSVRFX0ZVTkNUSU9OX0lELCBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRCB9ID0gZ2V0Q29uZmlnKCk7XG5cbi8vIEV4dHJhaXJlIGxlIHBhcmFtXHUwMEU4dHJlIGRlIHJlZGlyZWN0aW9uIGRlIGwnVVJMXG5mdW5jdGlvbiBnZXRSZWRpcmVjdFVybCgpIHtcbiAgY29uc3QgdXJsUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbiAgY29uc3QgcmVkaXJlY3RQYXJhbSA9IHVybFBhcmFtcy5nZXQoJ3JlZGlyZWN0Jyk7XG5cbiAgaWYgKHJlZGlyZWN0UGFyYW0pIHtcbiAgICAvLyBWYWxpZGVyIHF1ZSBsJ1VSTCBlc3QgcmVsYXRpdmUgcG91ciBcdTAwRTl2aXRlciBsZXMgcmVkaXJlY3Rpb25zIG1hbHZlaWxsYW50ZXNcbiAgICBpZiAocmVkaXJlY3RQYXJhbS5zdGFydHNXaXRoKCcvJykgJiYgIXJlZGlyZWN0UGFyYW0uc3RhcnRzV2l0aCgnLy8nKSkge1xuICAgICAgcmV0dXJuIHJlZGlyZWN0UGFyYW07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgXHUwMEU5bFx1MDBFOW1lbnRzIGR1IERPTVxuY29uc3QgbG9hZGluZ1N0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsb2FkaW5nLXN0YXRlXCIpO1xuY29uc3QgbG9nZ2VkSW5TdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidXNlci1sb2dnZWQtaW5cIik7XG5jb25zdCBsb2dnZWRPdXRTdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidXNlci1sb2dnZWQtb3V0XCIpO1xuY29uc3QgbG9nZ2VkT3V0U2VjdGlvbnMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxvZ2dlZC1vdXQtc2VjdGlvbnNcIik7XG5jb25zdCBsb2dpbkZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxvZ2luLWZvcm1cIik7XG5jb25zdCBsb2dvdXRCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxvZ291dC1idXR0b25cIik7XG5jb25zdCBlcnJvck1lc3NhZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImVycm9yLW1lc3NhZ2VcIik7XG5jb25zdCBsb2dpbkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibG9naW4tYnV0dG9uXCIpO1xuY29uc3QgbG9naW5TcGlubmVyID0gbG9naW5CdXR0b24/LnF1ZXJ5U2VsZWN0b3IoXCIuc3Bpbm5lci1ib3JkZXJcIik7XG5jb25zdCB1c2VyRW1haWxEaXNwbGF5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ1c2VyLWVtYWlsLWRpc3BsYXlcIik7XG5jb25zdCB1c2VyRW5jYXNHbXggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInVzZXItZW5jYXMtZ214XCIpO1xuY29uc3Qgd2VsY29tZVVzZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIndlbGNvbWUtdXNlclwiKTtcbmNvbnN0IGhlYWRlckxvZ2dlZE91dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaGVhZGVyLWxvZ2dlZC1vdXRcIik7XG5jb25zdCBoZWFkZXJMb2dnZWRJbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaGVhZGVyLWxvZ2dlZC1pblwiKTtcbmNvbnN0IGVtYWlsTm90VmVyaWZpZWRTdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZW1haWwtbm90LXZlcmlmaWVkXCIpO1xuY29uc3QgcmVzZW5kVmVyaWZpY2F0aW9uQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXG4gIFwicmVzZW5kLXZlcmlmaWNhdGlvblwiLFxuKTtcbmNvbnN0IGxvZ291dEJ1dHRvblVudmVyaWZpZWQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcbiAgXCJsb2dvdXQtYnV0dG9uLXVudmVyaWZpZWRcIixcbik7XG5jb25zdCBpbmZvTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW5mby1tZXNzYWdlXCIpO1xuY29uc3QgdXNlckVtYWlsVG9WZXJpZnkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInVzZXItZW1haWwtdG8tdmVyaWZ5XCIpO1xuXG5jb25zdCBmb3JtRW1haWxQd2QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImVtYWlsLXB3ZC1sb2dpblwiKTtcbmNvbnN0IGZvcm1QYXNzd29yZEZvcmdvdHRlbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGFzc3dvcmQtZm9yZ290dGVuXCIpO1xuY29uc3QgZm9yZ290UGFzc3dvcmRCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZm9yZ290LXBhc3N3b3JkLWJ1dHRvbicpO1xuY29uc3QgcGFzc3dvcmRGb3Jnb3R0ZW5Gb3JtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Bhc3N3b3JkLWZvcmdvdHRlbi1mb3JtJyk7XG5jb25zdCBzdWJtaXRQYXNzd29yZEZvcmdvdHRlbkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQtcGFzc3dvcmQtZm9yZ290dGVuJyk7XG5jb25zdCBzdWJtaXRQYXNzd29yZEZvcmdvdHRlblNwaW5uZXIgPSBzdWJtaXRQYXNzd29yZEZvcmdvdHRlbkJ1dHRvbj8ucXVlcnlTZWxlY3RvcignLnNwaW5uZXItYm9yZGVyJyk7XG5cblxuXG4vKipcbiAqIEFmZmljaGUgdW4gXHUwMEU5dGF0IGRlIGwnVUkgZXQgbWFzcXVlIGxlcyBhdXRyZXMuXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RhdGUgLSBMJ1x1MDBFOXRhdCBcdTAwRTAgYWZmaWNoZXIgKCdsb2FkaW5nJywgJ2xvZ2dlZEluJywgJ2xvZ2dlZE91dCcsICdlbWFpbE5vdFZlcmlmaWVkJywgJ2ZvcmdvdFBhc3N3b3JkJylcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIC0gTWVzc2FnZSBvcHRpb25uZWwgXHUwMEUwIGFmZmljaGVyIGRhbnMgbGEgYmFubmlcdTAwRThyZSBkJ2VycmV1ci9pbmZvLlxuICovXG5mdW5jdGlvbiBzaG93VUlTdGF0ZShzdGF0ZSwgbWVzc2FnZSA9ICcnKSB7XG4gIC8vIE1hc3F1ZXIgdG91dGVzIGxlcyBzZWN0aW9ucyBwcmluY2lwYWxlcyBkJ2Fib3JkXG4gIGlmIChsb2FkaW5nU3RhdGUpIGxvYWRpbmdTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBpZiAobG9nZ2VkSW5TdGF0ZSkgbG9nZ2VkSW5TdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBpZiAobG9nZ2VkT3V0U3RhdGUpIGxvZ2dlZE91dFN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChlbWFpbE5vdFZlcmlmaWVkU3RhdGUpIGVtYWlsTm90VmVyaWZpZWRTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBpZiAobG9nZ2VkT3V0U2VjdGlvbnMpIGxvZ2dlZE91dFNlY3Rpb25zLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChmb3JtRW1haWxQd2QpIGZvcm1FbWFpbFB3ZC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBpZiAoZm9ybVBhc3N3b3JkRm9yZ290dGVuKSBmb3JtUGFzc3dvcmRGb3Jnb3R0ZW4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAvLyBBZmZpY2hlciBsZXMgc2VjdGlvbnMgZW4gZm9uY3Rpb24gZGUgbCdcdTAwRTl0YXRcbiAgc3dpdGNoIChzdGF0ZSkge1xuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgICAgaWYgKGxvYWRpbmdTdGF0ZSkgbG9hZGluZ1N0YXRlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbG9nZ2VkSW4nOlxuICAgICAgaWYgKGxvZ2dlZEluU3RhdGUpIGxvZ2dlZEluU3RhdGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkSW4pIGhlYWRlckxvZ2dlZEluLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkT3V0KSBoZWFkZXJMb2dnZWRPdXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIGNvbnN0IGFwcFdyaXRlVXNlck5hbWUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImFwcHdyaXRlLXVzZXItbmFtZVwiKTtcbiAgICAgIGlmICh1c2VyRW5jYXNHbXggJiYgYXBwV3JpdGVVc2VyTmFtZSA9PT0gXCJlbmNhcy1jb29rYm9va1wiKSB7XG4gICAgICAgIHVzZXJFbmNhc0dteC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgfSBlbHNlIGlmICh3ZWxjb21lVXNlciAmJiBhcHBXcml0ZVVzZXJOYW1lKSB7XG4gICAgICAgIHdlbGNvbWVVc2VyLnRleHRDb250ZW50ID0gYEJpZW52ZW51ZSAke2FwcFdyaXRlVXNlck5hbWV9YDtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2xvZ2dlZE91dCc6XG4gICAgICBpZiAobG9nZ2VkT3V0U3RhdGUpIGxvZ2dlZE91dFN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgaWYgKGxvZ2dlZE91dFNlY3Rpb25zKSBsb2dnZWRPdXRTZWN0aW9ucy5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgaWYgKGZvcm1FbWFpbFB3ZCkgZm9ybUVtYWlsUHdkLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgaWYgKGhlYWRlckxvZ2dlZE91dCkgaGVhZGVyTG9nZ2VkT3V0LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkSW4pIGhlYWRlckxvZ2dlZEluLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlbWFpbE5vdFZlcmlmaWVkJzpcbiAgICAgIGlmIChlbWFpbE5vdFZlcmlmaWVkU3RhdGUpIGVtYWlsTm90VmVyaWZpZWRTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIGlmIChsb2dnZWRPdXRTZWN0aW9ucykgbG9nZ2VkT3V0U2VjdGlvbnMuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgIGlmIChoZWFkZXJMb2dnZWRPdXQpIGhlYWRlckxvZ2dlZE91dC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgaWYgKGhlYWRlckxvZ2dlZEluKSBoZWFkZXJMb2dnZWRJbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZm9yZ290UGFzc3dvcmQnOlxuICAgICAgaWYgKGxvZ2dlZE91dFN0YXRlKSBsb2dnZWRPdXRTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIGlmIChsb2dnZWRPdXRTZWN0aW9ucykgbG9nZ2VkT3V0U2VjdGlvbnMuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgIGlmIChmb3JtUGFzc3dvcmRGb3Jnb3R0ZW4pIGZvcm1QYXNzd29yZEZvcmdvdHRlbi5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIGlmIChoZWFkZXJMb2dnZWRPdXQpIGhlYWRlckxvZ2dlZE91dC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgaWYgKGhlYWRlckxvZ2dlZEluKSBoZWFkZXJMb2dnZWRJbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICAvLyBBZmZpY2hlciBsZSBtZXNzYWdlIGQnZXJyZXVyIHNpIGZvdXJuaVxuICBpZiAoZXJyb3JNZXNzYWdlICYmIG1lc3NhZ2UpIHtcbiAgICBlcnJvck1lc3NhZ2UudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIGVycm9yTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgfSBlbHNlIGlmIChlcnJvck1lc3NhZ2UpIHtcbiAgICBlcnJvck1lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxuXG4gIC8vIEdcdTAwRTlyZXIgbGUgbWVzc2FnZSBkJ2luZm9ybWF0aW9uIHBvdXIgbCdcdTAwRTl0YXQgZW1haWxOb3RWZXJpZmllZFxuICBpZiAoaW5mb01lc3NhZ2UpIHtcbiAgICBpZiAoc3RhdGUgPT09ICdlbWFpbE5vdFZlcmlmaWVkJyAmJiBtZXNzYWdlICYmIG1lc3NhZ2UuaW5jbHVkZXMoJ3N1Y2NcdTAwRThzJykpIHtcbiAgICAgIGluZm9NZXNzYWdlLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICAgIGluZm9NZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbmZvTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsYSBzb3VtaXNzaW9uIGR1IGZvcm11bGFpcmUgZGUgbW90IGRlIHBhc3NlIG91YmxpXHUwMEU5LlxuICogRW52b2llIHVuIGVtYWlsIGRlIHJcdTAwRTljdXBcdTAwRTlyYXRpb24gZGUgbW90IGRlIHBhc3NlIHZpYSBBcHB3cml0ZS5cbiAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gTCdcdTAwRTl2XHUwMEU5bmVtZW50IGRlIHNvdW1pc3Npb24gZHUgZm9ybXVsYWlyZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlUGFzc3dvcmRGb3Jnb3R0ZW5TdWJtaXQoZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgY29uc29sZS5sb2coJ1tBdXRoQXBwd3JpdGVdIFNvdW1pc3Npb24gZHUgZm9ybXVsYWlyZSBkZSBtb3QgZGUgcGFzc2Ugb3VibGlcdTAwRTknKTtcblxuICBjb25zdCBlbWFpbElucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VtYWlsJyk7IC8vIEwnSUQgZGUgbCdpbnB1dCBlbWFpbCBkYW5zIGxlIGZvcm11bGFpcmUgXCJwYXNzd29yZC1mb3Jnb3R0ZW4tZm9ybVwiXG4gIGNvbnN0IGVtYWlsID0gZW1haWxJbnB1dCA/IGVtYWlsSW5wdXQudmFsdWUgOiAnJztcblxuICBpZiAoIWVtYWlsKSB7XG4gICAgc2hvd1VJU3RhdGUoJ2ZvcmdvdFBhc3N3b3JkJywgJ1ZldWlsbGV6IGVudHJlciB2b3RyZSBhZHJlc3NlIGVtYWlsLicpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChzdWJtaXRQYXNzd29yZEZvcmdvdHRlbkJ1dHRvbikgc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5CdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5TcGlubmVyKSBzdWJtaXRQYXNzd29yZEZvcmdvdHRlblNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICBpZiAoZXJyb3JNZXNzYWdlKSBlcnJvck1lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICB0cnkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgLy8gTCdVUkwgZGUgcmVkaXJlY3Rpb24gZXN0IGwnVVJMIG9cdTAwRjkgQXBwd3JpdGUgcmVkaXJpZ2VyYSBsJ3V0aWxpc2F0ZXVyIGFwclx1MDBFOHMgcXUnaWwgYWl0IGNsaXF1XHUwMEU5IHN1ciBsZSBsaWVuIGRhbnMgbCdlbWFpbC5cbiAgICAvLyBDZXR0ZSBwYWdlIChlLmcuLCAvcmVzZXQtcGFzc3dvcmQpIHNlcmEgcmVzcG9uc2FibGUgZGUgZmluYWxpc2VyIGxhIHJcdTAwRTlpbml0aWFsaXNhdGlvbiBhdmVjIHVwZGF0ZVJlY292ZXJ5LlxuICAgIGNvbnN0IHJlc2V0VVJMID0gYCR7d2luZG93LmxvY2F0aW9uLm9yaWdpbn0vcmVzZXQtcGFzc3dvcmRgO1xuICAgIGF3YWl0IGFjY291bnQuY3JlYXRlUmVjb3ZlcnkoZW1haWwsIHJlc2V0VVJMKTtcbiAgICBjb25zb2xlLmxvZygnW0F1dGhBcHB3cml0ZV0gRW1haWwgZGUgclx1MDBFOWluaXRpYWxpc2F0aW9uIGRlIG1vdCBkZSBwYXNzZSBlbnZveVx1MDBFOS4nKTtcbiAgICBzaG93VUlTdGF0ZSgnbG9nZ2VkT3V0JywgJ1VuIGVtYWlsIGRlIHJcdTAwRTlpbml0aWFsaXNhdGlvbiBkZSBtb3QgZGUgcGFzc2UgYSBcdTAwRTl0XHUwMEU5IGVudm95XHUwMEU5IFx1MDBFMCB2b3RyZSBhZHJlc3NlLiBWZXVpbGxleiB2XHUwMEU5cmlmaWVyIHZvdHJlIGJvXHUwMEVFdGUgZGUgclx1MDBFOWNlcHRpb24uJyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW0F1dGhBcHB3cml0ZV0gRXJyZXVyIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIGxcXCdlbWFpbCBkZSByXHUwMEU5aW5pdGlhbGlzYXRpb246JywgZXJyb3IpO1xuICAgIGxldCB1c2VyTWVzc2FnZSA9ICdVbmUgZXJyZXVyIGVzdCBzdXJ2ZW51ZSBsb3JzIGRlIGxcXCdlbnZvaSBkZSBsXFwnZW1haWwgZGUgclx1MDBFOWluaXRpYWxpc2F0aW9uLic7XG4gICAgaWYgKGVycm9yLnJlc3BvbnNlICYmIGVycm9yLnJlc3BvbnNlLmNvZGUgPT09IDQwNCkge1xuICAgICAgdXNlck1lc3NhZ2UgPSAnQXVjdW4gY29tcHRlIG5cXCdlc3QgYXNzb2NpXHUwMEU5IFx1MDBFMCBjZXR0ZSBhZHJlc3NlIGVtYWlsLic7XG4gICAgfVxuICAgIHNob3dVSVN0YXRlKCdmb3Jnb3RQYXNzd29yZCcsIHVzZXJNZXNzYWdlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5CdXR0b24pIHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuU3Bpbm5lcikgc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5TcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH1cbn1cblxuLyoqXG4gKiBHXHUwMEU4cmUgbGEgbmF2aWdhdGlvbiB2ZXJzIGxlIGZvcm11bGFpcmUgZGUgbW90IGRlIHBhc3NlIG91YmxpXHUwMEU5LlxuICovXG5mdW5jdGlvbiBoYW5kbGVGb3Jnb3RQYXNzd29yZENsaWNrKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBzaG93VUlTdGF0ZSgnZm9yZ290UGFzc3dvcmQnKTtcbn1cblxuLyoqXG4gKiBHXHUwMEU4cmUgbGUgcHJvY2Vzc3VzIGQnYXV0aGVudGlmaWNhdGlvbiBDTVMgYXByXHUwMEU4cyB1bmUgY29ubmV4aW9uIEFwcHdyaXRlIHJcdTAwRTl1c3NpZS5cbiAqIEFwcGVsbGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgJ2Ntcy1hdXRoLWZ1bmN0aW9uJyBwb3VyIG9idGVuaXIgdW4gdG9rZW4gQ01TLlxuICovXG5hc3luYyBmdW5jdGlvbiBzZXR1cENtc0F1dGhlbnRpY2F0aW9uKCkge1xuICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICBjb25zdCBmdW5jdGlvbnMgPSBhd2FpdCBnZXRGdW5jdGlvbnMoKTtcblxuICB0cnkge1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBVdGlsaXNhdGV1ciBBcHB3cml0ZSByXHUwMEU5Y3VwXHUwMEU5clx1MDBFOTpcIiwgdXNlci5lbWFpbCk7XG5cbiAgICBpZiAoIXVzZXIuZW1haWxWZXJpZmljYXRpb24pIHtcbiAgICAgIC8vIGNvbnNvbGUud2FybihcIlx1MjZBMFx1RkUwRiBbc2V0dXBDbXNBdXRoZW50aWNhdGlvbl0gRW1haWwgbm9uIHZcdTAwRTlyaWZpXHUwMEU5IHBvdXI6XCIsIHVzZXIuZW1haWwpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRU1BSUxfTk9UX1ZFUklGSUVEXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7IGVtYWlsOiB1c2VyLmVtYWlsIH0pO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDA0IFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBBcHBlbCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aCBhdmVjIHBheWxvYWQ6XCIsIHBheWxvYWQpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgIEFQUFdSSVRFX0ZVTkNUSU9OX0lELFxuICAgICAgcGF5bG9hZCxcbiAgICAgIGZhbHNlLCAvLyBQYXMgZGUgbGVjdHVyZVxuICAgICAgYC9jbXMtYXV0aC8ke3VzZXIuZW1haWx9YCxcbiAgICAgIFwiUE9TVFwiLFxuICAgICk7XG5cbiAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjcwNSBbc2V0dXBDbXNBdXRoZW50aWNhdGlvbl0gRXhcdTAwRTljdXRpb24gZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgclx1MDBFOXVzc2llOlwiLCByZXN1bHQpO1xuXG4gICAgY29uc3QgcmVzcG9uc2VEYXRhID0gSlNPTi5wYXJzZShyZXN1bHQucmVzcG9uc2VCb2R5KTtcbiAgICAvLyBjb25zb2xlLmxvZyhcIlx1RDgzRFx1REQwRCBbc2V0dXBDbXNBdXRoZW50aWNhdGlvbl0gUlx1MDBFOXBvbnNlIGRlIGxhIGZvbmN0aW9uIENNUzpcIiwgcmVzcG9uc2VEYXRhKTtcblxuICAgIGlmIChyZXNwb25zZURhdGEgJiYgcmVzcG9uc2VEYXRhLnRva2VuKSB7XG4gICAgICBjb25zdCBjbXNBdXRoID0ge1xuICAgICAgICB0b2tlbjogcmVzcG9uc2VEYXRhLnRva2VuLFxuICAgICAgICBpZDogcmVzcG9uc2VEYXRhLnVzZXJfaWQsIC8vIE91IGwnSUQgcmV0b3Vyblx1MDBFOSBwYXIgbGEgZm9uY3Rpb25cbiAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgIG5hbWU6IHVzZXIubmFtZSxcbiAgICAgICAgYmFja2VuZE5hbWU6IFwiYXBwd3JpdGVcIixcbiAgICAgIH07XG4gICAgICBzZXRBdXRoRGF0YSh1c2VyLmVtYWlsLCB1c2VyLm5hbWUsIGNtc0F1dGgpO1xuICAgICAgcmV0dXJuIGNtc0F1dGg7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiXHUyNzRDIFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBSXHUwMEU5cG9uc2UgZGUgbGEgZm9uY3Rpb24gQ01TIGludmFsaWRlOlwiLFxuICAgICAgICByZXNwb25zZURhdGEsXG4gICAgICApO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVG9rZW4gQ01TIG1hbnF1YW50IGRhbnMgbGEgclx1MDBFOXBvbnNlIGRlIGxhIGZvbmN0aW9uLlwiKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIFwiXHUyNzRDIFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBFcnJldXIgZGFucyBzZXR1cENtc0F1dGhlbnRpY2F0aW9uOlwiLFxuICAgICAgZXJyb3IsXG4gICAgKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsYSBsb2dpcXVlIGRlIGxhIHBhZ2UgZGUgY29ubmV4aW9uIGF1IGNoYXJnZW1lbnQuXG4gKiBWXHUwMEU5cmlmaWUgbCdcdTAwRTl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGV0IG1ldCBcdTAwRTAgam91ciBsJ1VJIGVuIGNvbnNcdTAwRTlxdWVuY2UuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxvZ2luUGFnZUxvYWQoKSB7XG4gIHNob3dVSVN0YXRlKFwibG9hZGluZ1wiKTtcblxuICB0cnkge1xuICAgIGlmICghd2luZG93LkFwcHdyaXRlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiXHUyNzRDIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBTREsgQXBwd3JpdGUgbm9uIGRpc3BvbmlibGUgIVwiKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlNESyBBcHB3cml0ZSBub24gY2hhcmdcdTAwRTlcIik7XG4gICAgfVxuICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBTREsgQXBwd3JpdGUgZGlzcG9uaWJsZVwiKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3QgY21zVXNlciA9IGdldExvY2FsQ21zVXNlcigpO1xuICAgIGxldCBhcHB3cml0ZVVzZXIgPSBudWxsO1xuXG4gICAgLy8gRGVidWc6IEFmZmljaGVyIGwnXHUwMEU5dGF0IGR1IHRva2VuIENNU1xuICAgIC8vIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDBEIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUb2tlbiBDTVMgYnJ1dDpcIiwgY21zVXNlcik7XG5cbiAgICAvLyAxLiBUZW50ZXIgZGUgclx1MDBFOWN1cFx1MDBFOXJlciBsYSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZVxuICAgIHRyeSB7XG4gICAgICBhcHB3cml0ZVVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuICAgICAgLy8gY29uc29sZS5sb2coXCJcdTI3MDUgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFNlc3Npb24gQXBwd3JpdGUgdHJvdXZcdTAwRTllOlwiLCBhcHB3cml0ZVVzZXIuZW1haWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyMTM5XHVGRTBGIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBQYXMgZGUgc2Vzc2lvbiBBcHB3cml0ZSBhY3RpdmU6XCIsIGUubWVzc2FnZSk7XG4gICAgfVxuXG4gICAgLy8gMi4gVlx1MDBFOXJpZmllciBzaSBsZSB0b2tlbiBDTVMgZXN0IHZhbGlkZSAodmFsaWRhdGlvbiBwbHVzIHBlcm1pc3NpdmUpXG4gICAgY29uc3QgaXNWYWxpZENtc1VzZXIgPVxuICAgICAgY21zVXNlciAmJlxuICAgICAgY21zVXNlci50b2tlbiAmJlxuICAgICAgdHlwZW9mIGNtc1VzZXIudG9rZW4gPT09IFwic3RyaW5nXCIgJiZcbiAgICAgIGNtc1VzZXIudG9rZW4udHJpbSgpICE9PSBcIlwiICYmXG4gICAgICBjbXNVc2VyLnRva2VuICE9PSBcIltdXCIgJiZcbiAgICAgIGNtc1VzZXIudG9rZW4gIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICAgIGNtc1VzZXIudG9rZW4gIT09IFwibnVsbFwiO1xuXG4gICAgLy8gY29uc29sZS5sb2coXCJcdUQ4M0RcdUREMEQgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFRva2VuIENNUyB2YWxpZGU6XCIsIGlzVmFsaWRDbXNVc2VyKTtcbiAgICBpZiAoY21zVXNlcikge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJcdUQ4M0RcdUREMEQgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFRva2VuIENNUyBkZXRhaWxzIC0gdG9rZW4gbGVuZ3RoOlwiLCBjbXNVc2VyLnRva2VuPy5sZW5ndGgsIFwiaWQ6XCIsIGNtc1VzZXIuaWQpO1xuICAgIH1cblxuICAgIC8vIDMuIENhcyAxOiBTZXNzaW9uIEFwcHdyaXRlIEVUIHRva2VuIENNUyB2YWxpZGUgPSB1dGlsaXNhdGV1ciBhdXRoZW50aWZpXHUwMEU5XG4gICAgaWYgKGFwcHdyaXRlVXNlciAmJiBpc1ZhbGlkQ21zVXNlcikge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJcdTI3MDUgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIEF1dGhlbnRpZmljYXRpb24gY29tcGxcdTAwRTh0ZSAtIEFwcHdyaXRlICsgQ01TXCIpO1xuICAgICAgc2V0QXV0aERhdGEoYXBwd3JpdGVVc2VyLmVtYWlsLCBhcHB3cml0ZVVzZXIubmFtZSwgY21zVXNlcik7XG4gICAgICBpZiAodXNlckVtYWlsRGlzcGxheSlcbiAgICAgICAgdXNlckVtYWlsRGlzcGxheS50ZXh0Q29udGVudCA9IGAgKCR7YXBwd3JpdGVVc2VyLmVtYWlsfSlgO1xuICAgICAgc2hvd1VJU3RhdGUoXCJsb2dnZWRJblwiKTtcblxuICAgICAgLy8gUmVkaXJpZ2VyIHNpIG5cdTAwRTljZXNzYWlyZVxuICAgICAgY29uc3QgcmVkaXJlY3RVcmwgPSBnZXRSZWRpcmVjdFVybCgpO1xuICAgICAgaWYgKHJlZGlyZWN0VXJsKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dGhBcHB3cml0ZV0gVXRpbGlzYXRldXIgZFx1MDBFOWpcdTAwRTAgYXV0aGVudGlmaVx1MDBFOSwgcmVkaXJlY3Rpb24gdmVyczpcIiwgcmVkaXJlY3RVcmwpO1xuICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlZGlyZWN0VXJsO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDQuIENhcyAyOiBTZXNzaW9uIEFwcHdyaXRlIHZhbGlkZSBNQUlTIHBhcyBkZSB0b2tlbiBDTVMgKG91IGludmFsaWRlKVxuICAgIC8vIFx1MjE5MiBUZW50ZXIgZGUgclx1MDBFOWN1cFx1MDBFOXJlciB1biBub3V2ZWF1IHRva2VuIENNU1xuICAgIGlmIChhcHB3cml0ZVVzZXIgJiYgIWlzVmFsaWRDbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjZBMFx1RkUwRiBbaGFuZGxlTG9naW5QYWdlTG9hZF0gU2Vzc2lvbiBBcHB3cml0ZSBPSyBtYWlzIHRva2VuIENNUyBtYW5xdWFudC9pbnZhbGlkZVwiKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDA0IFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUZW50YXRpdmUgZGUgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSB0b2tlbiBDTVMuLi5cIik7XG4gICAgICAgIGF3YWl0IHNldHVwQ21zQXV0aGVudGljYXRpb24oKTtcbiAgICAgICAgY29uc3QgbmV3Q21zVXNlciA9IGdldExvY2FsQ21zVXNlcigpO1xuICAgICAgICBjb25zdCBpc05ld0Ntc1VzZXJWYWxpZCA9XG4gICAgICAgICAgbmV3Q21zVXNlciAmJlxuICAgICAgICAgIG5ld0Ntc1VzZXIudG9rZW4gJiZcbiAgICAgICAgICB0eXBlb2YgbmV3Q21zVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgICAgIG5ld0Ntc1VzZXIudG9rZW4udHJpbSgpICE9PSBcIlwiICYmXG4gICAgICAgICAgbmV3Q21zVXNlci50b2tlbiAhPT0gXCJbXVwiO1xuXG4gICAgICAgIGlmIChpc05ld0Ntc1VzZXJWYWxpZCkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUb2tlbiBDTVMgclx1MDBFOWN1cFx1MDBFOXJcdTAwRTkgYXZlYyBzdWNjXHUwMEU4c1wiKTtcbiAgICAgICAgICBzZXRBdXRoRGF0YShhcHB3cml0ZVVzZXIuZW1haWwsIGFwcHdyaXRlVXNlci5uYW1lLCBuZXdDbXNVc2VyKTtcbiAgICAgICAgICBpZiAodXNlckVtYWlsRGlzcGxheSlcbiAgICAgICAgICAgIHVzZXJFbWFpbERpc3BsYXkudGV4dENvbnRlbnQgPSBgICgke2FwcHdyaXRlVXNlci5lbWFpbH0pYDtcbiAgICAgICAgICBzaG93VUlTdGF0ZShcImxvZ2dlZEluXCIpO1xuXG4gICAgICAgICAgLy8gUmVkaXJpZ2VyIHNpIG5cdTAwRTljZXNzYWlyZVxuICAgICAgICAgIGNvbnN0IHJlZGlyZWN0VXJsID0gZ2V0UmVkaXJlY3RVcmwoKTtcbiAgICAgICAgICBpZiAocmVkaXJlY3RVcmwpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0F1dGhBcHB3cml0ZV0gVG9rZW4gQ01TIHJcdTAwRTljdXBcdTAwRTlyXHUwMEU5LCByZWRpcmVjdGlvbiB2ZXJzOlwiLCByZWRpcmVjdFVybCk7XG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlZGlyZWN0VXJsO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgIFwiXHUyNzRDIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBcdTAwQzljaGVjIGRlIHJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgdG9rZW4gQ01TXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGUgdG9rZW4gQ01TXCIpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiXHUyNzRDIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGR1IHRva3BlbiBDTVM6XCIsXG4gICAgICAgICAgZXJyb3IsXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gR2VzdGlvbiBzcFx1MDBFOWNpZmlxdWUgZGUgbCdlcnJldXIgXCJlbWFpbCBub24gdlx1MDBFOXJpZmlcdTAwRTlcIlxuICAgICAgICBpZiAoZXJyb3IubWVzc2FnZSA9PT0gXCJFTUFJTF9OT1RfVkVSSUZJRURcIikge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIFwiXHUyNkEwXHVGRTBGIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBFbWFpbCBub24gdlx1MDBFOXJpZmlcdTAwRTkgLSBhZmZpY2hhZ2UgZHUgbWVzc2FnZSBhcHByb3ByaVx1MDBFOVwiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgLy8gQWZmaWNoZXIgbCdlbWFpbCBkZSBsJ3V0aWxpc2F0ZXVyIFx1MDBFMCB2XHUwMEU5cmlmaWVyXG4gICAgICAgICAgaWYgKHVzZXJFbWFpbFRvVmVyaWZ5ICYmIGFwcHdyaXRlVXNlcikge1xuICAgICAgICAgICAgdXNlckVtYWlsVG9WZXJpZnkudGV4dENvbnRlbnQgPSBhcHB3cml0ZVVzZXIuZW1haWw7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIE5lIHBhcyBuZXR0b3llciBsYSBzZXNzaW9uLCBsJ3V0aWxpc2F0ZXVyIGRvaXQgcG91dm9pciBwb3V2b2lyIHZcdTAwRTlyaWZpZXIgc29uIGVtYWlsXG4gICAgICAgICAgc2hvd1VJU3RhdGUoXCJlbWFpbE5vdFZlcmlmaWVkXCIpOyAvLyBVdGlsaXNlciBsZSBub3V2ZWwgXHUwMEU5dGF0IHNwXHUwMEU5Y2lmaXF1ZVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5ldHRveWVyIGxhIHNlc3Npb24gQXBwd3JpdGUgZFx1MDBFOWZhaWxsYW50ZSBwb3VyIGxlcyBhdXRyZXMgZXJyZXVyc1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGFjY291bnQuZGVsZXRlU2Vzc2lvbihcImN1cnJlbnRcIik7XG4gICAgICAgIH0gY2F0Y2ggKGNsZWFudXBFcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIFwiRXJyZXVyIGxvcnMgZHUgbmV0dG95YWdlIGRlIGxhIHNlc3Npb24gQXBwd3JpdGU6XCIsXG4gICAgICAgICAgICBjbGVhbnVwRXJyb3IsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgICAgIHNob3dVSVN0YXRlKFwibG9nZ2VkT3V0XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gNS4gQ2FzIDM6IFRva2VuIENNUyB2YWxpZGUgTUFJUyBwYXMgZGUgc2Vzc2lvbiBBcHB3cml0ZVxuICAgIC8vIFx1MjE5MiBMZSB0b2tlbiBDTVMgc2V1bCBuZSBzdWZmaXQgcGFzLCBuZXR0b3llclxuICAgIGlmICghYXBwd3JpdGVVc2VyICYmIGlzVmFsaWRDbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjZBMFx1RkUwRiBbaGFuZGxlTG9naW5QYWdlTG9hZF0gVG9rZW4gQ01TIHZhbGlkZSBtYWlzIHBhcyBkZSBzZXNzaW9uIEFwcHdyaXRlIC0gbmV0dG95YWdlXCIpO1xuICAgICAgY2xlYXJBdXRoRGF0YSgpO1xuICAgICAgc2hvd1VJU3RhdGUoXCJsb2dnZWRPdXRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gNi4gQ2FzIDQ6IE5pIHNlc3Npb24gQXBwd3JpdGUgbmkgdG9rZW4gQ01TIHZhbGlkZVxuICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyMTM5XHVGRTBGIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBBdWN1bmUgYXV0aGVudGlmaWNhdGlvbiB0cm91dlx1MDBFOWUgLSBhZmZpY2hhZ2UgZHUgZm9ybXVsYWlyZVwiKTtcbiAgICBjbGVhckF1dGhEYXRhKCk7IC8vIE5ldHRveWVyIGF1IGNhcyBvXHUwMEY5XG4gICAgc2hvd1VJU3RhdGUoXCJsb2dnZWRPdXRcIik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBFUlJFVVIgQ1JJVElRVUUgW2hhbmRsZUxvZ2luUGFnZUxvYWRdOlwiLCBlcnJvci5tZXNzYWdlKTtcbiAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgc2hvd1VJU3RhdGUoXCJsb2dnZWRPdXRcIik7XG4gIH1cbn1cblxuLyoqXG4gKiBHXHUwMEU4cmUgbGEgc291bWlzc2lvbiBkdSBmb3JtdWxhaXJlIGRlIGNvbm5leGlvbi5cbiAqIENyXHUwMEU5ZSB1bmUgc2Vzc2lvbiBBcHB3cml0ZSBldCB0ZW50ZSBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIHVuIHRva2VuIENNUy5cbiAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gTCdcdTAwRTl2XHUwMEU5bmVtZW50IGRlIHNvdW1pc3Npb24gZHUgZm9ybXVsYWlyZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlTG9naW5TdWJtaXQoZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgaWYgKGxvZ2luQnV0dG9uKSBsb2dpbkJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChsb2dpblNwaW5uZXIpIGxvZ2luU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gXCJpbmxpbmUtYmxvY2tcIjtcbiAgaWYgKGVycm9yTWVzc2FnZSkgZXJyb3JNZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuICBjb25zdCBlbWFpbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibG9naW4tZW1haWxcIikudmFsdWU7XG4gIGNvbnN0IHBhc3N3b3JkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsb2dpbi1wYXNzd29yZFwiKS52YWx1ZTtcblxuICB0cnkge1xuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGFjY291bnQuY3JlYXRlRW1haWxQYXNzd29yZFNlc3Npb24oZW1haWwsIHBhc3N3b3JkKTtcbiAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjcwNSBbaGFuZGxlTG9naW5TdWJtaXRdIFNlc3Npb24gQXBwd3JpdGUgY3JcdTAwRTlcdTAwRTllOlwiLCBzZXNzaW9uKTtcblxuICAgIC8vIFRlbnRlciBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIHRva2VuIENNU1xuICAgIGF3YWl0IHNldHVwQ21zQXV0aGVudGljYXRpb24oKTtcblxuICAgIGNvbnN0IGNtc1VzZXIgPSBnZXRMb2NhbENtc1VzZXIoKTtcbiAgICBpZiAoY21zVXNlcikge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJcdTI3MDUgW2hhbmRsZUxvZ2luU3VibWl0XSBBdXRoZW50aWZpY2F0aW9uIENNUyByXHUwMEU5dXNzaWUgYXByXHUwMEU4cyBsb2dpbi5cIik7XG4gICAgICBzZXRBdXRoRGF0YShlbWFpbCwgc2Vzc2lvbi5wcm92aWRlclVpZCwgY21zVXNlcik7IC8vIFV0aWxpc2VyIHByb3ZpZGVyVWlkIGNvbW1lIG5vbSB0ZW1wb3JhaXJlIHNpIGxlIG5vbSBuJ2VzdCBwYXMgZGlzcG9uaWJsZVxuICAgICAgaGFuZGxlUmVkaXJlY3QoKTsgLy8gUmVkaXJpZ2VyIG91IHJlY2hhcmdlciBsYSBwYWdlXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiXHUyNzRDIFtoYW5kbGVMb2dpblN1Ym1pdF0gSW1wb3NzaWJsZSBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIHRva2VuIENNUyBhcHJcdTAwRThzIGxhIGNvbm5leGlvbi5cIixcbiAgICAgICk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGUgdG9rZW4gQ01TLlwiKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBbaGFuZGxlTG9naW5TdWJtaXRdIEVycmV1ciBkZSBjb25uZXhpb246XCIsIGVycm9yKTtcbiAgICBsZXQgdXNlck1lc3NhZ2UgPSBcIlx1MDBDOWNoZWMgZGUgbGEgY29ubmV4aW9uLiBWZXVpbGxleiB2XHUwMEU5cmlmaWVyIHZvcyBpZGVudGlmaWFudHMuXCI7XG5cbiAgICBpZiAoZXJyb3IuY29kZSA9PT0gNDAxIHx8IGVycm9yLmNvZGUgPT09IDQwMCkge1xuICAgICAgdXNlck1lc3NhZ2UgPSBcIkVtYWlsIG91IG1vdCBkZSBwYXNzZSBpbmNvcnJlY3QuXCI7XG4gICAgfSBlbHNlIGlmIChlcnJvci5tZXNzYWdlID09PSBcIkVNQUlMX05PVF9WRVJJRklFRFwiKSB7XG4gICAgICB1c2VyTWVzc2FnZSA9IFwiVm90cmUgZW1haWwgbidlc3QgcGFzIHZcdTAwRTlyaWZpXHUwMEU5LiBWZXVpbGxleiB2XHUwMEU5cmlmaWVyIHZvdHJlIGJvXHUwMEVFdGUgZGUgclx1MDBFOWNlcHRpb24gb3UgY2xpcXVlciBzdXIgJ1JlbnZveWVyIGwnZW1haWwnLlwiO1xuICAgICAgc2hvd1VJU3RhdGUoXCJlbWFpbE5vdFZlcmlmaWVkXCIsIHVzZXJNZXNzYWdlKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoXCJBY2NvdW50IHdpdGggdGhlIGdpdmVuIGVtYWlsIGFscmVhZHkgZXhpc3RzXCIpKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlID0gXCJVbiBjb21wdGUgYXZlYyBjZXQgZW1haWwgZXhpc3RlIGRcdTAwRTlqXHUwMEUwLlwiO1xuICAgIH1cblxuICAgIHNob3dVSVN0YXRlKFwibG9nZ2VkT3V0XCIsIHVzZXJNZXNzYWdlKTsgLy8gQWZmaWNoZXIgbCdcdTAwRTl0YXQgZFx1MDBFOWNvbm5lY3RcdTAwRTkgYXZlYyB1biBtZXNzYWdlIGQnZXJyZXVyXG4gIH0gZmluYWxseSB7XG4gICAgaWYgKGxvZ2luQnV0dG9uKSBsb2dpbkJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChsb2dpblNwaW5uZXIpIGxvZ2luU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gIH1cbn1cblxuLyoqXG4gKiBSZWRpcmlnZSBsJ3V0aWxpc2F0ZXVyIHZlcnMgbCdVUkwgc3BcdTAwRTljaWZpXHUwMEU5ZSBkYW5zIGxlIHBhcmFtXHUwMEU4dHJlIHJlZGlyZWN0LCBvdSByZWNoYXJnZXJhIGxhIHBhZ2UuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZVJlZGlyZWN0KCkge1xuICBjb25zdCByZWRpcmVjdFVybCA9IGdldFJlZGlyZWN0VXJsKCk7XG4gIGlmIChyZWRpcmVjdFVybCkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gcmVkaXJlY3RVcmw7XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxhIGRcdTAwRTljb25uZXhpb24gZGUgbCd1dGlsaXNhdGV1ci5cbiAqIFN1cHByaW1lIGxhIHNlc3Npb24gQXBwd3JpdGUgZXQgbmV0dG9pZSBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxvZ291dCgpIHtcbiAgY2xlYXJBdXRoRGF0YSgpOyAvLyBOZXR0b3llciBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXMgaW1tXHUwMEU5ZGlhdGVtZW50XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2NvdW50LmRlbGV0ZVNlc3Npb24oXCJjdXJyZW50XCIpO1xuICAgIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dvdXRdIERcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgclx1MDBFOXVzc2llLlwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIlx1MjZBMFx1RkUwRiBbaGFuZGxlTG9nb3V0XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICB9IGZpbmFsbHkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTsgLy8gUmVjaGFyZ2VyIGxhIHBhZ2UgcG91ciBhZmZpY2hlciBsJ1x1MDBFOXRhdCBkXHUwMEU5Y29ubmVjdFx1MDBFOVxuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxlIHJlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uLlxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVSZXNlbmRWZXJpZmljYXRpb24oKSB7XG4gIGlmIChyZXNlbmRWZXJpZmljYXRpb25CdXR0b24pIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cbiAgLy8gUlx1MDBFOWN1cFx1MDBFOXJlciBsZSBzcGlubmVyIGV4aXN0YW50IGRhbnMgbGUgYm91dG9uXG4gIGNvbnN0IHJlc2VuZFNwaW5uZXIgPSByZXNlbmRWZXJpZmljYXRpb25CdXR0b24/LnF1ZXJ5U2VsZWN0b3IoJy5zcGlubmVyLWJvcmRlcicpO1xuICBpZiAocmVzZW5kU3Bpbm5lcikgcmVzZW5kU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZW5kVmVyaWZpY2F0aW9uRW1haWwoKTtcbiAgICBzaG93VUlTdGF0ZShcImVtYWlsTm90VmVyaWZpZWRcIiwgXCJFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiByZW52b3lcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cyAhIFZldWlsbGV6IHZcdTAwRTlyaWZpZXIgdm90cmUgYm9cdTAwRUV0ZSBkZSByXHUwMEU5Y2VwdGlvbi5cIik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBbaGFuZGxlUmVzZW5kVmVyaWZpY2F0aW9uXSBFcnJldXIgbG9ycyBkdSByZW52b2kgZGUgbCdlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbjpcIiwgZXJyb3IpO1xuICAgIHNob3dVSVN0YXRlKFwiZW1haWxOb3RWZXJpZmllZFwiLCBcIkVycmV1ciBsb3JzIGR1IHJlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIpO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChyZXNlbmRWZXJpZmljYXRpb25CdXR0b24pIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIC8vIE1hc3F1ZXIgbGUgc3Bpbm5lclxuICAgIGlmIChyZXNlbmRTcGlubmVyKSByZXNlbmRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH1cbn1cblxuLy8gRm9uY3Rpb24gcG91ciBnXHUwMEU5cmVyIGwnZW52b2kgZGUgbGEgZGVtYW5kZSBkJ2FjY1x1MDBFOHNcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUFjY2Vzc1JlcXVlc3QoZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgZm9ybSA9IGV2ZW50LnRhcmdldDtcbiAgY29uc3Qgc3VibWl0QnV0dG9uID0gZm9ybS5xdWVyeVNlbGVjdG9yKCcjRm9ybS1zdWJtaXQnKTtcbiAgY29uc3Qgc3VibWl0U3Bpbm5lciA9IHN1Ym1pdEJ1dHRvbi5xdWVyeVNlbGVjdG9yKCcuc3Bpbm5lci1ib3JkZXInKTtcbiAgY29uc3QgZW1haWxJbnB1dCA9IGZvcm0ucXVlcnlTZWxlY3RvcignI2NvbnRhY3QtZm9ybS1lbWFpbCcpO1xuICBjb25zdCBtZXNzYWdlSW5wdXQgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoJyNjb250YWN0LWZvcm0tbWVzc2FnZScpO1xuICBjb25zdCBmb3JtRmVlZGJhY2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZm9ybS1mZWVkYmFjaycpO1xuXG4gIGlmIChzdWJtaXRCdXR0b24pIHN1Ym1pdEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdWJtaXRTcGlubmVyKSBzdWJtaXRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgaWYgKGZvcm1GZWVkYmFjaykge1xuICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGZvcm1GZWVkYmFjay5jbGFzc05hbWUgPSAnbWItMyc7IC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgY2xhc3Nlc1xuICB9XG5cbiAgY29uc3QgZW1haWwgPSBlbWFpbElucHV0LnZhbHVlO1xuICBjb25zdCBtZXNzYWdlID0gbWVzc2FnZUlucHV0LnZhbHVlO1xuXG4gIGlmICghZW1haWwgfHwgIW1lc3NhZ2UpIHtcbiAgICBpZiAoZm9ybUZlZWRiYWNrKSB7XG4gICAgICBmb3JtRmVlZGJhY2sudGV4dENvbnRlbnQgPSAnVmV1aWxsZXogcmVtcGxpciB0b3VzIGxlcyBjaGFtcHMuJztcbiAgICAgIGZvcm1GZWVkYmFjay5jbGFzc0xpc3QuYWRkKCdhbGVydCcsICdhbGVydC1kYW5nZXInKTtcbiAgICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG4gICAgaWYgKHN1Ym1pdEJ1dHRvbikgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKHN1Ym1pdFNwaW5uZXIpIHN1Ym1pdFNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGZ1bmN0aW9ucyA9IGF3YWl0IGdldEZ1bmN0aW9ucygpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7IGVtYWlsLCBtZXNzYWdlIH0pO1xuICAgIGNvbnNvbGUubG9nKFwiW0FjY2Vzc1JlcXVlc3RdIEFwcGVsIGRlIGxhIGZvbmN0aW9uIGRlIGRlbWFuZGUgZCdhY2NcdTAwRThzIGF2ZWMgcGF5bG9hZDpcIiwgcGF5bG9hZCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBmdW5jdGlvbnMuY3JlYXRlRXhlY3V0aW9uKFxuICAgICAgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQsXG4gICAgICBwYXlsb2FkLFxuICAgICAgZmFsc2UsIC8vIE5lIHBhcyBsaXJlXG4gICAgICBgL2FjY2Vzcy1yZXF1ZXN0LyR7ZW1haWx9YCxcbiAgICAgIFwiUE9TVFwiLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcIltBY2Nlc3NSZXF1ZXN0XSBFeFx1MDBFOWN1dGlvbiBkZSBsYSBmb25jdGlvbiBBcHB3cml0ZSByXHUwMEU5dXNzaWU6XCIsIHJlc3VsdCk7XG5cbiAgICBpZiAocmVzdWx0LnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgaWYgKGZvcm1GZWVkYmFjaykge1xuICAgICAgICBmb3JtRmVlZGJhY2sudGV4dENvbnRlbnQgPSAnVm90cmUgZGVtYW5kZSBkXFwnYWNjXHUwMEU4cyBhIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIGF2ZWMgc3VjY1x1MDBFOHMgISBOb3VzIHZvdXMgcmVjb250YWN0ZXJvbnMgYmllbnRcdTAwRjR0Lic7XG4gICAgICAgIGZvcm1GZWVkYmFjay5jbGFzc0xpc3QuYWRkKCdhbGVydCcsICdhbGVydC1zdWNjZXNzJyk7XG4gICAgICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIH1cbiAgICAgIGZvcm0ucmVzZXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZXJyb3JEYXRhID0gSlNPTi5wYXJzZShyZXN1bHQucmVzcG9uc2VCb2R5KTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvckRhdGEubWVzc2FnZSB8fCBgRXJyZXVyIEFwcHdyaXRlOiAke3Jlc3VsdC5zdGF0dXNDb2RlfWApO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbQWNjZXNzUmVxdWVzdF0gRXJyZXVyIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIGxhIGRlbWFuZGUgZFxcJ2FjY1x1MDBFOHM6JywgZXJyb3IpO1xuICAgIGlmIChmb3JtRmVlZGJhY2spIHtcbiAgICAgIGZvcm1GZWVkYmFjay50ZXh0Q29udGVudCA9IGBFcnJldXIgOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ1VuZSBlcnJldXIgZXN0IHN1cnZlbnVlIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIHZvdHJlIGRlbWFuZGUuJ31gO1xuICAgICAgZm9ybUZlZWRiYWNrLmNsYXNzTGlzdC5hZGQoJ2FsZXJ0JywgJ2FsZXJ0LWRhbmdlcicpO1xuICAgICAgZm9ybUZlZWRiYWNrLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoc3VibWl0QnV0dG9uKSBzdWJtaXRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3VibWl0U3Bpbm5lcikgc3VibWl0U3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG59XG5cblxuLy8gQXR0YWNoZXIgbGVzIFx1MDBFOWNvdXRldXJzIGQnXHUwMEU5dlx1MDBFOW5lbWVudHMgdW5lIGZvaXMgcXVlIGxlIERPTSBlc3QgY2hhcmdcdTAwRTlcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgaGFuZGxlTG9naW5QYWdlTG9hZCgpO1xuXG4gIGlmIChsb2dpbkZvcm0pIHtcbiAgICBsb2dpbkZvcm0uYWRkRXZlbnRMaXN0ZW5lcihcInN1Ym1pdFwiLCBoYW5kbGVMb2dpblN1Ym1pdCk7XG4gIH1cblxuICBpZiAobG9nb3V0QnV0dG9uKSB7XG4gICAgbG9nb3V0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBoYW5kbGVMb2dvdXQpO1xuICB9XG5cbiAgaWYgKGxvZ291dEJ1dHRvblVudmVyaWZpZWQpIHtcbiAgICBsb2dvdXRCdXR0b25VbnZlcmlmaWVkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBoYW5kbGVMb2dvdXQpO1xuICB9XG5cbiAgaWYgKHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbikge1xuICAgIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgaGFuZGxlUmVzZW5kVmVyaWZpY2F0aW9uKTtcbiAgfVxuXG4gIGlmIChmb3Jnb3RQYXNzd29yZEJ1dHRvbikge1xuICAgIGZvcmdvdFBhc3N3b3JkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlRm9yZ290UGFzc3dvcmRDbGljayk7XG4gIH1cblxuICBpZiAocGFzc3dvcmRGb3Jnb3R0ZW5Gb3JtKSB7XG4gICAgcGFzc3dvcmRGb3Jnb3R0ZW5Gb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGhhbmRsZVBhc3N3b3JkRm9yZ290dGVuU3VibWl0KTtcbiAgfVxuXG4gIGNvbnN0IGFjY2Vzc1JlcXVlc3RGb3JtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjY2Vzcy1yZXF1ZXN0LWZvcm0nKTtcbiAgaWYgKGFjY2Vzc1JlcXVlc3RGb3JtKSB7XG4gICAgYWNjZXNzUmVxdWVzdEZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgaGFuZGxlQWNjZXNzUmVxdWVzdCk7XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7QUFNQSxNQUFNLGtCQUFrQjtBQUFBLElBQ3RCLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLFlBQVk7QUFBQSxJQUNaLFdBQVc7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULGVBQWU7QUFBQTtBQUFBLE1BRWYsYUFBYTtBQUFBLElBQ2Y7QUFBQSxJQUNBLGFBQWE7QUFBQSxNQUNYLE1BQU07QUFBQSxNQUNOLFdBQVc7QUFBQSxNQUNYLFVBQVU7QUFBQSxJQUNaO0FBQUEsRUFDRjtBQUdBLE1BQUksU0FBUztBQUNiLE1BQUksVUFBVTtBQUNkLE1BQUksWUFBWTtBQUNoQixNQUFJLFlBQVk7QUFDaEIsTUFBSSxRQUFRO0FBQ1osTUFBSSx3QkFBd0I7QUFPNUIsV0FBUyxnQkFBZ0IsY0FBYyxJQUFJLFdBQVcsS0FBSztBQUN6RCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN0QyxVQUFJLFdBQVc7QUFFZixlQUFTLGdCQUFnQjtBQUN2QjtBQUNBLFlBQ0UsT0FBTyxZQUNQLE9BQU8sU0FBUyxVQUNoQixPQUFPLFNBQVMsU0FDaEI7QUFDQSxrQkFBUTtBQUFBLFFBQ1YsV0FBVyxZQUFZLGFBQWE7QUFDbEMsa0JBQVE7QUFBQSxZQUNOO0FBQUEsVUFDRjtBQUNBLGlCQUFPLElBQUksTUFBTSwrQ0FBeUMsQ0FBQztBQUFBLFFBQzdELE9BQU87QUFDTCxxQkFBVyxlQUFlLFFBQVE7QUFBQSxRQUNwQztBQUFBLE1BQ0Y7QUFFQSxvQkFBYztBQUFBLElBQ2hCLENBQUM7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LGNBQWUsZUFBYyxNQUFNLFVBQVU7QUFBQSxJQUNuRDtBQUFBLEVBQ0Y7QUFJQSxXQUFTLGlCQUFpQixvQkFBb0IsTUFBTTtBQUNsRCx3QkFBb0I7QUFFcEIsUUFBSSxXQUFXO0FBQ2IsZ0JBQVUsaUJBQWlCLFVBQVUsaUJBQWlCO0FBQUEsSUFDeEQ7QUFFQSxRQUFJLGNBQWM7QUFDaEIsbUJBQWEsaUJBQWlCLFNBQVMsWUFBWTtBQUFBLElBQ3JEO0FBRUEsUUFBSSx3QkFBd0I7QUFDMUIsNkJBQXVCLGlCQUFpQixTQUFTLFlBQVk7QUFBQSxJQUMvRDtBQUVBLFFBQUksMEJBQTBCO0FBQzVCLCtCQUF5QixpQkFBaUIsU0FBUyx3QkFBd0I7QUFBQSxJQUM3RTtBQUVBLFFBQUksc0JBQXNCO0FBQ3hCLDJCQUFxQixpQkFBaUIsU0FBUyx5QkFBeUI7QUFBQSxJQUMxRTtBQUVBLFFBQUksdUJBQXVCO0FBQ3pCLDRCQUFzQixpQkFBaUIsVUFBVSw2QkFBNkI7QUFBQSxJQUNoRjtBQUVBLFVBQU0sb0JBQW9CLFNBQVMsZUFBZSxxQkFBcUI7QUFDdkUsUUFBSSxtQkFBbUI7QUFDckIsd0JBQWtCLGlCQUFpQixVQUFVLG1CQUFtQjtBQUFBLElBQ2xFO0FBQUEsRUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJhY2NvdW50IiwgImRhdGFiYXNlcyIsICJmdW5jdGlvbnMiLCAiYWNjb3VudCIsICJmdW5jdGlvbnMiXQp9Cg==

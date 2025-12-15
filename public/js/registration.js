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
  document.addEventListener("DOMContentLoaded", () => {
    const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } = getConfig();
    const DATABASE_ID = "689d15b10003a5a13636";
    const COLLECTION_ID = "689d15c900353f50464a";
    const REGISTER_FUNCTION_ID = "689d1836002b9b5cfda9";
    const CAMPAIGN_DOC_ID = document.querySelector("[data-campaign-doc-id]").dataset.campaignDocId;
    const loadingState = document.getElementById("loading-state");
    const campaignValid = document.getElementById("campaign-valid");
    const campaignInvalid = document.getElementById("campaign-invalid");
    const registrationForm = document.getElementById("registration-form");
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
    const remainingSlots = document.getElementById("remaining-slots");
    const invalidReason = document.getElementById("invalid-reason");
    let databases2 = null;
    async function initializeClients() {
      const { Client, Databases } = window.Appwrite;
      if (!databases2) {
        const client2 = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
        databases2 = new Databases(client2);
      }
      return databases2;
    }
    async function checkCampaignStatus() {
      try {
        const db = await initializeClients();
        const campaign = await db.getDocument(
          DATABASE_ID,
          COLLECTION_ID,
          CAMPAIGN_DOC_ID
        );
        const isExpired = /* @__PURE__ */ new Date() > new Date(campaign.expires_at);
        const isFull = campaign.current_count >= campaign.max_inscriptions;
        if (campaign.is_active && !isExpired && !isFull) {
          document.getElementById("remaining-slots").textContent = campaign.max_inscriptions - campaign.current_count;
          loadingState.style.display = "none";
          campaignValid.style.display = "block";
        } else {
          let reason = "La campagne est termin\xE9e.";
          if (isExpired) reason = "La campagne est expir\xE9e.";
          if (isFull) reason = "Le nombre maximum d'inscriptions est atteint.";
          document.getElementById("invalid-reason").textContent = reason;
          loadingState.style.display = "none";
          campaignInvalid.style.display = "block";
        }
      } catch (error) {
        document.getElementById("invalid-reason").textContent = "Impossible de v\xE9rifier la campagne. L'ID est peut-\xEAtre incorrect.";
        loadingState.style.display = "none";
        campaignInvalid.style.display = "block";
      }
    }
    if (registrationForm) {
      registrationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = registrationForm.querySelector('button[type="submit"]');
        const spinner = submitButton.querySelector(".spinner-border");
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-password-confirm").value;
        if (password !== confirmPassword) {
          errorMessage.textContent = "Les mots de passe ne correspondent pas.";
          errorMessage.style.display = "block";
          return;
        }
        submitButton.disabled = true;
        spinner.style.display = "inline-block";
        errorMessage.style.display = "none";
        successMessage.style.display = "none";
        try {
          const payload = {
            campaign_doc_id: CAMPAIGN_DOC_ID,
            name,
            email,
            password
          };
          const functions2 = await getFunctions();
          const response = await functions2.createExecution(REGISTER_FUNCTION_ID, JSON.stringify(payload));
          const result = JSON.parse(response.responseBody);
          if (!result.success) {
            throw new Error(result.error || "Une erreur est survenue lors de l'inscription.");
          }
          successMessage.textContent = "Inscription r\xE9ussie ! Connexion en cours et envoi de l'email de v\xE9rification...";
          successMessage.style.display = "block";
          registrationForm.style.display = "none";
          try {
            const { account: account2 } = await getAppwriteClients();
            await account2.createEmailPasswordSession(email, password);
            const verificationURL = `${window.location.origin}/verify-email`;
            await account2.createVerification(verificationURL);
            localStorage.setItem("appwrite-user-email", email);
            localStorage.setItem("appwrite-user-name", name);
            localStorage.setItem("email-verification-status", "not_verified");
            successMessage.innerHTML = `
            <strong>Inscription termin\xE9e !</strong><br>
            Un email de v\xE9rification a \xE9t\xE9 envoy\xE9 \xE0 <strong>${email}</strong>.<br>
            <small class="text-muted">V\xE9rifiez aussi votre dossier spam/courrier ind\xE9sirable.</small><br>
            Vous allez \xEAtre redirig\xE9 vers la page de connexion.
          `;
            setTimeout(() => {
              window.location.href = "/login";
            }, 3e3);
          } catch (verificationError) {
            console.warn("Erreur lors de l'envoi de l'email de v\xE9rification:", verificationError);
            let errorMsg = "L'email de v\xE9rification n'a pas pu \xEAtre envoy\xE9.";
            if (verificationError.code === 429) {
              errorMsg = "Trop de demandes d'emails. Veuillez patienter quelques minutes avant de r\xE9essayer.";
            } else if (verificationError.code === 401) {
              errorMsg = "Session expir\xE9e. Veuillez vous reconnecter.";
            }
            successMessage.innerHTML = `
            <strong>Inscription r\xE9ussie !</strong><br>
            <span class="text-warning">Attention : ${errorMsg}</span><br>
            Vous pouvez vous connecter et renvoyer l'email depuis votre profil.<br>
            Redirection vers la page de connexion...
          `;
            setTimeout(() => {
              window.location.href = "/login";
            }, 3e3);
          }
        } catch (e) {
          errorMessage.textContent = e.message;
          errorMessage.style.display = "block";
          submitButton.disabled = false;
          spinner.style.display = "none";
        }
      });
    }
    if (CAMPAIGN_DOC_ID) {
      checkCampaignStatus();
    } else {
      invalidReason.textContent = "L'ID de la campagne n'est pas configur\xE9 sur cette page.";
      loadingState.style.display = "none";
      campaignInvalid.style.display = "block";
    }
  });
})();

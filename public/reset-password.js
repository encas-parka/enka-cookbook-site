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
  document.addEventListener("DOMContentLoaded", async () => {
    const resetPasswordForm = document.getElementById("reset-password-form");
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const resetPasswordButton = document.getElementById("reset-password-button");
    const resetButtonSpinner = resetPasswordButton ? resetPasswordButton.querySelector(".spinner-border") : null;
    const messageDisplay = document.getElementById("reset-password-message");
    const passwordMatchError = document.getElementById("password-match-error");
    const successMessage = document.getElementById("success-message");
    function showMessage(type, text) {
      if (messageDisplay) {
        messageDisplay.textContent = text;
        messageDisplay.className = `alert alert-${type} my-4 rounded`;
        messageDisplay.style.display = "block";
      }
    }
    if (messageDisplay) messageDisplay.style.display = "none";
    if (passwordMatchError) passwordMatchError.style.display = "none";
    if (resetPasswordForm) resetPasswordForm.style.display = "none";
    if (successMessage) successMessage.style.display = "none";
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");
    const secret = urlParams.get("secret");
    if (!userId || !secret) {
      showMessage("danger", "Lien de r\xE9initialisation de mot de passe invalide ou expir\xE9.");
      return;
    }
    if (resetPasswordForm) resetPasswordForm.style.display = "block";
    resetPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const newPassword = newPasswordInput ? newPasswordInput.value : "";
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";
      if (messageDisplay) messageDisplay.style.display = "none";
      if (passwordMatchError) passwordMatchError.style.display = "none";
      if (newPassword !== confirmPassword) {
        if (passwordMatchError) passwordMatchError.style.display = "block";
        newPasswordInput.classList.add("is-invalid");
        confirmPasswordInput.classList.add("is-invalid");
        return;
      } else {
        newPasswordInput.classList.remove("is-invalid");
        confirmPasswordInput.classList.remove("is-invalid");
      }
      if (newPassword.length < 8) {
        showMessage("danger", "Le nouveau mot de passe doit contenir au moins 8 caract\xE8res.");
        newPasswordInput.classList.add("is-invalid");
        return;
      } else {
        newPasswordInput.classList.remove("is-invalid");
      }
      if (resetPasswordButton) resetPasswordButton.disabled = true;
      if (resetButtonSpinner) resetButtonSpinner.style.display = "inline-block";
      try {
        const account2 = await getAccount();
        await account2.updateRecovery(userId, secret, newPassword, confirmPassword);
        if (resetPasswordForm) resetPasswordForm.style.display = "none";
        if (successMessage) successMessage.style.display = "block";
        showMessage("success", "Votre mot de passe a \xE9t\xE9 r\xE9initialis\xE9 avec succ\xE8s !");
        setTimeout(() => {
          window.location.href = "/login";
        }, 5e3);
      } catch (error) {
        console.error("[ResetPassword] Erreur lors de la r\xE9initialisation du mot de passe:", error);
        let errorMessageText = "Une erreur est survenue lors de la r\xE9initialisation de votre mot de passe. Veuillez r\xE9essayer ou contacter l'administrateur.";
        if (error.response && error.response.message) {
          if (error.response.code === 401 && error.response.message.includes("Invalid secret")) {
            errorMessageText = "Le lien de r\xE9initialisation est invalide ou a expir\xE9. Veuillez refaire une demande.";
          } else {
            errorMessageText = error.response.message;
          }
        } else if (error.message) {
          errorMessageText = error.message;
        }
        showMessage("danger", errorMessageText);
      } finally {
        if (resetPasswordButton) resetPasswordButton.disabled = false;
        if (resetButtonSpinner) resetButtonSpinner.style.display = "none";
      }
    });
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvL0RldmVsb3BwZW1lbnQvRU5LQS1DT09LQk9PSy9odWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hcHB3cml0ZS1jbGllbnQuanMiLCAiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzXG4vLyBNb2R1bGUgY29tbXVuIHBvdXIgbCdpbml0aWFsaXNhdGlvbiBldCBsYSBnZXN0aW9uIGR1IGNsaWVudCBBcHB3cml0ZVxuLy8gXHUwMEM5dml0ZSBsYSBkdXBsaWNhdGlvbiBkJ2luaXRpYWxpc2F0aW9uIGVudHJlIGF1dGgtc3RhdHVzLmpzIGV0IGF1dGhBcHB3cml0ZS5qc1xuLy8gTEVHQUNZIDogbWlncmVyIHRvdXRlIGxlcyBkXHUwMEU5cGVuZGFuZGUgKGF1dGgsIGludml0YXRpb24sIGV0Yy4uLilcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQ0VOVFJBTEUgQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9DT05GSUcgPSB7XG4gIGVuZHBvaW50OiBcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIixcbiAgcHJvamVjdElkOiBcIjY4OTcyNTgyMDAyNGU4MTc4MWI3XCIsXG4gIGRhdGFiYXNlSWQ6IFwiNjg5ZDE1YjEwMDAzYTVhMTM2MzZcIixcbiAgZnVuY3Rpb25zOiB7XG4gICAgY21zQXV0aDogXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiLFxuICAgIGFjY2Vzc1JlcXVlc3Q6IFwiNjg5Y2RlYTUwMDFhNGQ3NDU0OWRcIixcbiAgICAvLyBjcmVhdGVQcm9kdWN0TGlzdDogXCI2OGYwMDQ4NzAwMGM2MjQ1MzNhM1wiLFxuICAgIGJhdGNoVXBkYXRlOiBcIjY4ZjAwNDg3MDAwYzYyNDUzM2EzXCIsXG4gIH0sXG4gIGNvbGxlY3Rpb25zOiB7XG4gICAgbWFpbjogXCJtYWluXCIsXG4gICAgcHVyY2hhc2VzOiBcInB1cmNoYXNlc1wiLFxuICAgIHByb2R1Y3RzOiBcInByb2R1Y3RzXCIsXG4gIH0sXG59O1xuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGRhdGFiYXNlcyA9IG51bGw7XG5sZXQgdGVhbXMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cblxuLyoqXG4gKiBBdHRlbmQgcXVlIGxlIFNESyBBcHB3cml0ZSBzb2l0IGNoYXJnXHUwMEU5IGV0IGluaXRpYWxpc2UgbGVzIGNsaWVudHNcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBQcm9taXNlIHF1aSBzZSByXHUwMEU5c291dCBxdWFuZCBsJ2luaXRpYWxpc2F0aW9uIGVzdCB0ZXJtaW5cdTAwRTllXG4gKi9cbmZ1bmN0aW9uIHdhaXRGb3JBcHB3cml0ZShtYXhBdHRlbXB0cyA9IDUwLCBpbnRlcnZhbCA9IDEwMCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGxldCBhdHRlbXB0cyA9IDA7XG5cbiAgICBmdW5jdGlvbiBjaGVja0FwcHdyaXRlKCkge1xuICAgICAgYXR0ZW1wdHMrKztcbiAgICAgIGlmIChcbiAgICAgICAgd2luZG93LkFwcHdyaXRlICYmXG4gICAgICAgIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiZcbiAgICAgICAgd2luZG93LkFwcHdyaXRlLkFjY291bnRcbiAgICAgICkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9IGVsc2UgaWYgKGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJbQXBwd3JpdGUgQ2xpZW50XSBTREsgQXBwd3JpdGUgbm9uIGNoYXJnXHUwMEU5IGFwclx1MDBFOHMgbGUgbm9tYnJlIG1heGltdW0gZGUgdGVudGF0aXZlc1wiLFxuICAgICAgICApO1xuICAgICAgICByZWplY3QobmV3IEVycm9yKFwiTGUgU0RLIEFwcHdyaXRlIG4nYSBwYXMgcHUgXHUwMEVBdHJlIGNoYXJnXHUwMEU5LlwiKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjaGVja0FwcHdyaXRlKCk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEluaXRpYWxpc2UgbGVzIGNsaWVudHMgQXBwd3JpdGUgKHVuZSBzZXVsZSBmb2lzKVxuICogQHJldHVybnMge1Byb21pc2U8e2NsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zLCBkYXRhYmFzZXN9Pn0gTGVzIGNsaWVudHMgaW5pdGlhbGlzXHUwMEU5c1xuICovXG5hc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwd3JpdGUoKSB7XG4gIGlmIChjbGllbnQgJiYgYWNjb3VudCAmJiBmdW5jdGlvbnMgJiYgZGF0YWJhc2VzKSB7XG4gICAgcmV0dXJuIHsgY2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnMsIGRhdGFiYXNlcyB9O1xuICB9XG5cbiAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgIHJldHVybiBpbml0aWFsaXphdGlvblByb21pc2U7XG4gIH1cblxuICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIERcdTAwRTlidXQgZGUgbCdpbml0aWFsaXNhdGlvblwiKTtcbiAgICAgIGF3YWl0IHdhaXRGb3JBcHB3cml0ZSgpO1xuXG4gICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zLCBEYXRhYmFzZXMsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAuc2V0RW5kcG9pbnQoQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50KVxuICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9DT05GSUcucHJvamVjdElkKTtcblxuICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG4gICAgICBkYXRhYmFzZXMgPSBuZXcgRGF0YWJhc2VzKGNsaWVudCk7XG4gICAgICB0ZWFtcyA9IG5ldyBUZWFtcyhjbGllbnQpO1xuXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucywgZGF0YWJhc2VzLCB0ZWFtcyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsXG4gICAgICAgIGVycm9yLFxuICAgICAgKTtcbiAgICAgIGNsaWVudCA9IG51bGw7XG4gICAgICBhY2NvdW50ID0gbnVsbDtcbiAgICAgIGZ1bmN0aW9ucyA9IG51bGw7XG4gICAgICBkYXRhYmFzZXMgPSBudWxsO1xuICAgICAgdGVhbXMgPSBudWxsO1xuICAgICAgaW5pdGlhbGl6YXRpb25Qcm9taXNlID0gbnVsbDtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfSkoKTtcblxuICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vLyAtLS0gRm9uY3Rpb25zIGV4cG9ydFx1MDBFOWVzIC0tLVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBcHB3cml0ZUNsaWVudHMoKSB7XG4gIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWNjb3VudCgpIHtcbiAgaWYgKCFhY2NvdW50KSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGFjY291bnQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlYW1zKCkge1xuICBpZiAoIXRlYW1zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIHRlYW1zO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGdW5jdGlvbnMoKSB7XG4gIGlmICghZnVuY3Rpb25zKSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9ucztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YWJhc2VzKCkge1xuICBpZiAoIWRhdGFiYXNlcykgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gIHJldHVybiBkYXRhYmFzZXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgcmV0dXJuIHtcbiAgICBBUFBXUklURV9FTkRQT0lOVDogQVBQV1JJVEVfQ09ORklHLmVuZHBvaW50LFxuICAgIEFQUFdSSVRFX1BST0pFQ1RfSUQ6IEFQUFdSSVRFX0NPTkZJRy5wcm9qZWN0SWQsXG4gICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQ6IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY21zQXV0aCxcbiAgICBBQ0NFU1NfUkVRVUVTVF9GVU5DVElPTl9JRDogQVBQV1JJVEVfQ09ORklHLmZ1bmN0aW9ucy5hY2Nlc3NSZXF1ZXN0LFxuICAgIEFQUFdSSVRFX0NPTkZJRzogQVBQV1JJVEVfQ09ORklHLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpc0luaXRpYWxpemVkKCkge1xuICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zICYmIGRhdGFiYXNlcyAmJiB0ZWFtcyk7XG59XG5cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgY29uc3QgY21zVXNlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiKTtcbiAgaWYgKCFjbXNVc2VyKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICBpZiAoXG4gICAgICBwYXJzZWRVc2VyLnRva2VuICYmXG4gICAgICB0eXBlb2YgcGFyc2VkVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgcGFyc2VkVXNlci50b2tlbi50cmltKCkgIT09IFwiXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBwYXJzZWRVc2VyO1xuICAgIH1cbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBdXRoZW50aWNhdGVkQ21zKCkge1xuICByZXR1cm4gZ2V0TG9jYWxDbXNVc2VyKCkgIT09IG51bGw7XG59XG5cbi8qKlxuICogVlx1MDBFOXJpZmllIHNpIHVuZSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZSBleGlzdGUuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVnJhaSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5LCBzaW5vbiBmYXV4LlxuICovXG5hc3luYyBmdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgYXdhaXQgYWNjLmdldCgpOyAvLyBMXHUwMEU4dmUgdW5lIGV4Y2VwdGlvbiBzaSBhdWN1bmUgc2Vzc2lvbiBuJ2VzdCBhY3RpdmVcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgY29ubmVjdFx1MDBFOSBhdmVjIHVuZSBzZXNzaW9uIEFwcHdyaXRlIHZhbGlkZS5cbiAqIENldHRlIGZvbmN0aW9uIHZcdTAwRTlyaWZpZSBcdTAwRTAgbGEgZm9pcyBsZSBjb21wdGUgdXRpbGlzYXRldXIgRVQgbGEgdmFsaWRpdFx1MDBFOSBkZSBsYSBzZXNzaW9uLlxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFZyYWkgc2kgYXV0aGVudGlmaVx1MDBFOSBhdmVjIHNlc3Npb24gYWN0aXZlLCBzaW5vbiBmYXV4XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzQ29ubmVjdGVkQXBwd3JpdGUoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuXG4gICAgLy8gVlx1MDBFOXJpZmllciBsZSBjb21wdGUgdXRpbGlzYXRldXJcbiAgICBjb25zdCBhY2NvdW50RGF0YSA9IGF3YWl0IGFjYy5nZXQoKTtcbiAgICBpZiAoIWFjY291bnREYXRhIHx8ICFhY2NvdW50RGF0YS4kaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWXHUwMEU5cmlmaWVyIGV4cGxpY2l0ZW1lbnQgbGEgc2Vzc2lvbiBjb3VyYW50ZVxuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBhY2MuZ2V0U2Vzc2lvbihcImN1cnJlbnRcIik7XG4gICAgaWYgKCFzZXNzaW9uIHx8ICFzZXNzaW9uLiRpZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHNlc3Npb24gbidlc3QgcGFzIGV4cGlyXHUwMEU5ZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZXhwaXJlRGF0ZSA9IG5ldyBEYXRlKHNlc3Npb24uZXhwaXJlKTtcbiAgICBpZiAobm93ID49IGV4cGlyZURhdGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXNzaW9uIHZhbGlkZSAtIHJldG91cm5lciB0cnVlIHNpbXBsZW1lbnRcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY2hlY2tpbmcgY29ubmVjdGlvbjpcIiwgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBhY2MuZ2V0KCk7XG4gICAgcmV0dXJuIHVzZXIuZW1haWxWZXJpZmljYXRpb24gfHwgZmFsc2U7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhY2MgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgY29uc3QgdmVyaWZpY2F0aW9uVVJMID1cbiAgICAgIHJlZGlyZWN0VVJMIHx8IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L3ZlcmlmeS1lbWFpbGA7XG4gICAgYXdhaXQgYWNjLmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbCdlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOlwiLFxuICAgICAgZXJyb3IsXG4gICAgKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFjYyA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2MudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgXCJbQXBwd3JpdGVDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uIGQnZW1haWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEF1dGhlbnRpY2F0aW9uU3RhdGUoKSB7XG4gIGNvbnN0IGNtc1VzZXIgPSBnZXRMb2NhbENtc1VzZXIoKTtcbiAgaWYgKCFjbXNVc2VyKVxuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgbmFtZTogbnVsbCxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZSxcbiAgICB9O1xuICB0cnkge1xuICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICByZXR1cm4ge1xuICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgaXNFbWFpbFZlcmlmaWVkOiBlbWFpbFZlcmlmaWVkLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZCxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiB7XG4gICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHRydWUsXG4gICAgICBpc0VtYWlsVmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgZW1haWw6IGdldFVzZXJFbWFpbCgpLFxuICAgICAgbmFtZTogZ2V0VXNlck5hbWUoKSxcbiAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VXNlckVtYWlsKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiYXBwd3JpdGUtdXNlci1uYW1lXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzXCIpO1xufVxuXG5mdW5jdGlvbiBjbGVhckF1dGhEYXRhKCkge1xuICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShcInN2ZWx0aWEtY21zLnVzZXJcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiYXBwd3JpdGUtdXNlci1lbWFpbFwiKTtcbiAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIik7XG4gIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwiZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1c1wiKTtcbn1cbi8qKlxuICogVmFsaWRlIGV0IHByXHUwMEU5cGFyZSBsZXMgZG9ublx1MDBFOWVzIG5cdTAwRTljZXNzYWlyZXMgcG91ciBsYSBjclx1MDBFOWF0aW9uIHRyYW5zYWN0aW9ubmVsbGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7ZXZlbnREYXRhLCB1c2VyLCBjb250ZW50SGFzaH0+fSBEb25uXHUwMEU5ZXMgdmFsaWRcdTAwRTllc1xuICovXG5hc3luYyBmdW5jdGlvbiB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCkge1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gVmFsaWRhdGlvbiBkZXMgZG9ublx1MDBFOWVzIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICApO1xuXG4gIC8vIFJcdTAwRTljdXBcdTAwRTlyZXIgZXQgdmFsaWRlciBsZXMgZG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgIGAvZXZlbmVtZW50cy8ke2V2ZW50SWR9L2luZ3JlZGllbnRzX2F3L2luZGV4Lmpzb25gLFxuICApO1xuICBpZiAoIXJlc3BvbnNlLm9rKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBJbXBvc3NpYmxlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGVzIGRvbm5cdTAwRTllcyBkZSBsJ1x1MDBFOXZcdTAwRTluZW1lbnQ6ICR7cmVzcG9uc2Uuc3RhdHVzfWAsXG4gICAgKTtcbiAgY29uc3QgZXZlbnREYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICBjb25zb2xlLmxvZyhcbiAgICBgW0FwcHdyaXRlIENsaWVudF0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudCByXHUwMEU5Y3VwXHUwMEU5clx1MDBFOWVzOmAsXG4gICAgZXZlbnREYXRhLFxuICApO1xuXG4gIGNvbnN0IHsgYWNjb3VudCwgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBVdGlsaXNhdGV1ciBhdXRoZW50aWZpXHUwMEU5OiAke3VzZXIuJGlkfWApO1xuXG4gIC8vIFZcdTAwRTlyaWZpZXIgc2kgbCdcdTAwRTl2XHUwMEU5bmVtZW50IGV4aXN0ZSBkXHUwMEU5alx1MDBFMFxuICB0cnkge1xuICAgIGF3YWl0IGRhdGFiYXNlcy5nZXREb2N1bWVudChcbiAgICAgIEFQUFdSSVRFX0NPTkZJRy5kYXRhYmFzZUlkLFxuICAgICAgQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zLm1haW4sXG4gICAgICBldmVudElkLFxuICAgICk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gTCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH0gZXhpc3RlIGRcdTAwRTlqXHUwMEUwIGRhbnMgbWFpbmAsXG4gICAgKTtcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGAvc3ZfcHJvZHVjdHMvP2xpc3RJZD0ke2V2ZW50SWR9YDtcbiAgICByZXR1cm4gbnVsbDsgLy8gUmV0b3VybmVyIG51bGwgcG91ciBpbmRpcXVlciB1bmUgcmVkaXJlY3Rpb25cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gNDA0KSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvLyBSXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIGhhc2ggZGVwdWlzIGxlcyBwYXJhbVx1MDBFOHRyZXMgZ2xvYmF1eFxuICBjb25zdCBjb250ZW50SGFzaCA9IHdpbmRvdy5fX0hVR09fUEFSQU1TX18/Lmxpc3RDb250ZW50SGFzaDtcbiAgaWYgKCFjb250ZW50SGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlIGhhc2ggZHUgY29udGVudSBuJ2VzdCBwYXMgZFx1MDBFOWZpbmlcIik7XG4gIH1cblxuICByZXR1cm4geyBldmVudERhdGEsIHVzZXIsIGNvbnRlbnRIYXNoIH07XG59XG5cbi8qKlxuICogQXBwZWxsZSBsYSBmb25jdGlvbiBBcHB3cml0ZSBjXHUwMEY0dFx1MDBFOSBzZXJ2ZXVyIHBvdXIgY3JcdTAwRTllciBsYSBsaXN0ZVxuICogVXRpbGlzZSBsZSBTREsgQXBwd3JpdGUgcG91ciBcdTAwRTl2aXRlciBsZXMgcHJvYmxcdTAwRThtZXMgQ09SU1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudElkIC0gSUQgZGUgbCdcdTAwRTl2XHUwMEU5bmVtZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZXZlbnREYXRhIC0gRG9ublx1MDBFOWVzIGRlIGwnXHUwMEU5dlx1MDBFOW5lbWVudFxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50SGFzaCAtIEhhc2ggZHUgY29udGVudVxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgZXZlbnRJZCxcbiAgZXZlbnREYXRhLFxuICB1c2VySWQsXG4gIGNvbnRlbnRIYXNoLFxuKSB7XG4gIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBBcHBlbCBkZSBsYSBmb25jdGlvbiBzZXJ2ZXVyIHBvdXIgJHtldmVudElkfWApO1xuXG4gIC8vIElEIHJcdTAwRTllbCBkZSB2b3RyZSBmb25jdGlvbiBBcHB3cml0ZVxuICBjb25zdCBGVU5DVElPTl9JRCA9IEFQUFdSSVRFX0NPTkZJRy5mdW5jdGlvbnMuY3JlYXRlUHJvZHVjdExpc3Q7XG5cbiAgY29uc3QgeyBmdW5jdGlvbnMgfSA9IGF3YWl0IGluaXRpYWxpemVBcHB3cml0ZSgpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgIEZVTkNUSU9OX0lELFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBldmVudElkLFxuICAgICAgICBldmVudERhdGEsXG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgY29udGVudEhhc2gsXG4gICAgICB9KSxcbiAgICAgIHRydWUsIC8vIGFzeW5jID0gdHJ1ZSAtIEVYXHUwMEM5Q1VUSU9OIEFTWU5DSFJPTkVcbiAgICAgIFwiL1wiLCAvLyBwYXRoIChvcHRpb25uZWwpXG4gICAgICBcIkdFVFwiLCAvLyBtZXRob2QgKG9wdGlvbm5lbClcbiAgICAgIHt9LCAvLyBQYXMgYmVzb2luIGQnZW4tdFx1MDBFQXRlcyBwZXJzb25uYWxpc1x1MDBFOXNcbiAgICApO1xuXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gZFx1MDBFOW1hcnJcdTAwRTllIGVuIG1vZGUgYXN5bmNocm9uZTpgLFxuICAgICAgcmVzdWx0LFxuICAgICk7XG5cbiAgICAvLyBFbiBtb2RlIGFzeW5jaHJvbmUsIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzLCBvbiBuZSBmYWl0IHBhcyBkZSBwb2xsaW5nXG4gICAgLy8gTGEgZm9uY3Rpb24gdmEgcydleFx1MDBFOWN1dGVyIGVuIGFycmlcdTAwRThyZS1wbGFuIGV0IG9uIHN1cHBvc2UgcXVlIFx1MDBFN2EgdmEgclx1MDBFOXVzc2lyXG4gICAgY29uc3QgZXhlY3V0aW9uSWQgPSByZXN1bHQuJGlkO1xuICAgIGNvbnNvbGUubG9nKGBbQXBwd3JpdGUgQ2xpZW50XSBFeGVjdXRpb24gSUQ6ICR7ZXhlY3V0aW9uSWR9YCk7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRXhcdTAwRTljdXRpb24gYXN5bmMgZFx1MDBFOW1hcnJcdTAwRTllIHBvdXIgMzAwKyBpbmdyXHUwMEU5ZGllbnRzIC0gcGFzIGRlIHBvbGxpbmdgLFxuICAgICk7XG5cbiAgICAvLyBQb3VyIDMwMCsgaW5nclx1MDBFOWRpZW50cywgb24gcmV0b3VybmUgaW1tXHUwMEU5ZGlhdGVtZW50IHVuIHN1Y2NcdTAwRThzXG4gICAgLy8gTCd1dGlsaXNhdGV1ciB2ZXJyYSBsZXMgclx1MDBFOXN1bHRhdHMgcXVhbmQgbGEgZm9uY3Rpb24gYXVyYSB0ZXJtaW5cdTAwRTlcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIGV2ZW50SWQsXG4gICAgICBleGVjdXRpb25JZCxcbiAgICAgIG1lc3NhZ2U6IFwiVHJhaXRlbWVudCBkXHUwMEU5bWFyclx1MDBFOSBlbiBhcnJpXHUwMEU4cmUtcGxhbiAoMzAwKyBpbmdyXHUwMEU5ZGllbnRzKVwiLFxuICAgICAgaXNBc3luYzogdHJ1ZSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnYXBwZWwgZm9uY3Rpb246YCwgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogRm9uY3Rpb24gcHJpbmNpcGFsZSAtIGNyXHUwMEU5ZSB1bmUgbGlzdGUgZGUgcHJvZHVpdHMgY29sbGFib3JhdGlmc1xuICogVXRpbGlzZSBtYWludGVuYW50IGxhIGZvbmN0aW9uIEFwcHdyaXRlIGNcdTAwRjR0XHUwMEU5IHNlcnZldXJcbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29sbGFib3JhdGl2ZVByb2R1Y3RzTGlzdEZyb21FdmVudChldmVudElkKSB7XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICBgW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWJ1dCBkZSBsYSBjclx1MDBFOWF0aW9uIHBvdXIgbCdcdTAwRTl2XHUwMEU5bmVtZW50ICR7ZXZlbnRJZH1gLFxuICAgICk7XG5cbiAgICAvLyAxLiBWYWxpZGF0aW9uIGV0IHByXHUwMEU5cGFyYXRpb24gZGVzIGRvbm5cdTAwRTllc1xuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSBhd2FpdCB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGEoZXZlbnRJZCk7XG4gICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0KSB7XG4gICAgICAvLyBSZWRpcmVjdGlvbiBkXHUwMEU5alx1MDBFMCBnXHUwMEU5clx1MDBFOWUgZGFucyB2YWxpZGF0ZUFuZFByZXBhcmVFdmVudERhdGFcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IGV2ZW50RGF0YSwgdXNlciwgY29udGVudEhhc2ggfSA9IHZhbGlkYXRpb25SZXN1bHQ7XG4gICAgY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIERvbm5cdTAwRTllcyB2YWxpZFx1MDBFOWVzLCBhcHBlbCBkZSBsYSBmb25jdGlvbmApO1xuXG4gICAgLy8gMi4gQXBwZWwgZGUgbGEgZm9uY3Rpb24gQXBwd3JpdGUgY1x1MDBGNHRcdTAwRTkgc2VydmV1clxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhbGxDcmVhdGVQcm9kdWN0c0xpc3RGdW5jdGlvbihcbiAgICAgIGV2ZW50SWQsXG4gICAgICBldmVudERhdGEsXG4gICAgICB1c2VyLiRpZCxcbiAgICAgIGNvbnRlbnRIYXNoLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBPcFx1MDBFOXJhdGlvbiByXHUwMEU5dXNzaWUsIHJlZGlyZWN0aW9uIHZlcnMgbGEgbGlzdGVgLFxuICAgICk7XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgL3N2X3Byb2R1Y3RzLz9saXN0SWQ9JHtldmVudElkfWA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBjclx1MDBFOWF0aW9uOmAsXG4gICAgICBlcnJvci5tZXNzYWdlLFxuICAgICk7XG5cbiAgICAvLyBHZXN0aW9uIGRlcyBlcnJldXJzIHNwXHUwMEU5Y2lmaXF1ZXNcbiAgICBpZiAoZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhcImFscmVhZHlfZXhpc3RzXCIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2V0dGUgbGlzdGUgZGUgcHJvZHVpdHMgZXhpc3RlIGRcdTAwRTlqXHUwMEUwLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBhdmVjIHVuIElEIGRpZmZcdTAwRTlyZW50LlwiLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UuaW5jbHVkZXMoXCJ0cmFuc2FjdGlvbl9saW1pdF9leGNlZWRlZFwiKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkxpbWl0ZSBkZSB0cmFuc2FjdGlvbnMgZFx1MDBFOXBhc3NcdTAwRTllLiBWZXVpbGxleiByXHUwMEU5ZHVpcmUgbGUgbm9tYnJlIGQnaW5nclx1MDBFOWRpZW50cyBvdSByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tFeGlzdGluZ01haW5Hcm91cChtYWluR3JvdXBJZCkge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZGF0YWJhc2VzIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHNpIGxlIGRvY3VtZW50IGV4aXN0ZSBkaXJlY3RlbWVudCBkYW5zIGxhIGNvbGxlY3Rpb24gJ21haW4nXG4gICAgY29uc3QgZXhpc3RpbmdNYWluR3JvdXAgPSBhd2FpdCBkYXRhYmFzZXMuZ2V0RG9jdW1lbnQoXG4gICAgICBcIjY4OWQxNWIxMDAwM2E1YTEzNjM2XCIsXG4gICAgICBcIm1haW5cIixcbiAgICAgIG1haW5Hcm91cElkLFxuICAgICk7XG4gICAgcmV0dXJuICEhZXhpc3RpbmdNYWluR3JvdXA7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBMZSBkb2N1bWVudCBuJ2V4aXN0ZSBwYXNcbiAgICB9XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIFwiW0FwcHdyaXRlIENsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZHUgbWFpbiBncm91cCBleGlzdGFudDpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgdHJ5IHtcbiAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgY29uc3QgYWNjID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgIGF3YWl0IGFjYy5kZWxldGVTZXNzaW9uKFwiY3VycmVudFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIGRcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgKHBldXQtXHUwMEVBdHJlIGRcdTAwRTlqXHUwMEUwIGRcdTAwRTljb25uZWN0XHUwMEU5KTpcIixcbiAgICAgIGVycm9yLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLWVtYWlsXCIsIGVtYWlsKTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJhcHB3cml0ZS11c2VyLW5hbWVcIiwgbmFtZSk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic3ZlbHRpYS1jbXMudXNlclwiLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8qKlxuICogUydhYm9ubmUgYXV4IG1pc2VzIFx1MDBFMCBqb3VyIHRlbXBzIHJcdTAwRTllbCBwb3VyIHVuZSBsaXN0ZSBkZSBjb2xsZWN0aW9ucy5cbiAqIFV0aWxpc2UgbCdBUEkgQXBwd3JpdGUgc3Vic2NyaWJlKCkgcXVpIGdcdTAwRThyZSBhdXRvbWF0aXF1ZW1lbnQgbGVzIGNvbm5leGlvbnMgV2ViU29ja2V0LlxuICogQHBhcmFtIHtzdHJpbmdbXX0gY29sbGVjdGlvbk5hbWVzIC0gTm9tcyBkZXMgY29sbGVjdGlvbnMgKGV4OiBbJ2luZ3JlZGllbnRzJywgJ3B1cmNoYXNlcyddKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0SWQgLSBJRCBkZSBsYSBsaXN0ZSAocG91ciBmaWx0cmFnZSBzaSBuXHUwMEU5Y2Vzc2FpcmUpLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gb25NZXNzYWdlIC0gQ2FsbGJhY2sgcG91ciBsZXMgbWVzc2FnZXMgZGUgZG9ublx1MDBFOWVzLlxuICogQHBhcmFtIHtvYmplY3R9IGNvbm5lY3Rpb25DYWxsYmFja3MgLSBDYWxsYmFja3MgcG91ciBsZXMgXHUwMEU5dlx1MDBFOW5lbWVudHMgZGUgY29ubmV4aW9uLlxuICogQHJldHVybnMge2Z1bmN0aW9ufSBVbmUgZm9uY3Rpb24gcG91ciBzZSBkXHUwMEU5c2Fib25uZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zKFxuICBjb2xsZWN0aW9uTmFtZXMsXG4gIGxpc3RJZCxcbiAgb25NZXNzYWdlLFxuICBjb25uZWN0aW9uQ2FsbGJhY2tzID0ge30sXG4pIHtcbiAgY29uc3QgeyBvbkNvbm5lY3QsIG9uRGlzY29ubmVjdCwgb25FcnJvciB9ID0gY29ubmVjdGlvbkNhbGxiYWNrcztcblxuICBpZiAoIWNsaWVudCkge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIkltcG9zc2libGUgZGUgcydhYm9ubmVyIDogbGUgY2xpZW50IEFwcHdyaXRlIG4nZXN0IHBhcyBlbmNvcmUgaW5pdGlhbGlzXHUwMEU5LlwiLFxuICAgICk7XG4gICAgb25FcnJvcj8uKHsgbWVzc2FnZTogXCJDbGllbnQgQXBwd3JpdGUgbm9uIGluaXRpYWxpc1x1MDBFOVwiIH0pO1xuICAgIHJldHVybiAoKSA9PiB7fTtcbiAgfVxuXG4gIGNvbnN0IGNoYW5uZWxzID0gY29sbGVjdGlvbk5hbWVzXG4gICAgLm1hcCgobmFtZSkgPT4ge1xuICAgICAgY29uc3QgY29sbGVjdGlvbklkID0gQVBQV1JJVEVfQ09ORklHLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgaWYgKCFjb2xsZWN0aW9uSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBbQXBwd3JpdGUgQ2xpZW50XSBOb20gZGUgY29sbGVjdGlvbiBpbmNvbm51IGRhbnMgbGEgY29uZmlndXJhdGlvbjogJHtuYW1lfWAsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGBkYXRhYmFzZXMuJHtBUFBXUklURV9DT05GSUcuZGF0YWJhc2VJZH0uY29sbGVjdGlvbnMuJHtjb2xsZWN0aW9uSWR9LmRvY3VtZW50c2A7XG4gICAgfSlcbiAgICAuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQWJvbm5lbWVudCBhdXggY2FuYXV4IGVuIGNvdXJzLi4uXCIsIGNoYW5uZWxzKTtcblxuICB0cnkge1xuICAgIC8vIExhIG1cdTAwRTl0aG9kZSBjbGllbnQuc3Vic2NyaWJlKCkgZ1x1MDBFOHJlIGF1dG9tYXRpcXVlbWVudCBsYSBjb25uZXhpb24gV2ViU29ja2V0XG4gICAgLy8gc2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBvZmZpY2llbGxlIEFwcHdyaXRlXG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSBjbGllbnQuc3Vic2NyaWJlKGNoYW5uZWxzLCAocmVzcG9uc2UpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWNlcHRpb24gdGVtcHMgclx1MDBFOWVsOlwiLCByZXNwb25zZSk7XG4gICAgICBvbk1lc3NhZ2UocmVzcG9uc2UpO1xuICAgIH0pO1xuXG4gICAgLy8gU2Vsb24gbGEgZG9jdW1lbnRhdGlvbiBBcHB3cml0ZSwgbGEgc3Vic2NyaXB0aW9uIGVzdCBhdXRvbWF0aXF1ZW1lbnQgYWN0aXZlXG4gICAgLy8gT24gcGV1dCBjb25zaWRcdTAwRTlyZXIgbGEgY29ubmV4aW9uIGNvbW1lIFx1MDBFOXRhYmxpZSBpbW1cdTAwRTlkaWF0ZW1lbnRcbiAgICBpZiAob25Db25uZWN0KSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBDb25uZXhpb24gdGVtcHMgclx1MDBFOWVsIFx1MDBFOXRhYmxpZVwiKTtcbiAgICAgICAgb25Db25uZWN0KCk7XG4gICAgICB9LCA1MCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGxhIHNvdXNjcmlwdGlvbiB0ZW1wcyByXHUwMEU5ZWw6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIG9uRXJyb3I/LihlcnJvcik7XG4gICAgcmV0dXJuICgpID0+IHt9OyAvLyBSZXRvdXJuZXIgdW5lIGZvbmN0aW9uIHZpZGUgZW4gY2FzIGQnZXJyZXVyXG4gIH1cbn1cblxuLy8gRXhwb3J0IGRlcyBmb25jdGlvbnMgcHVibGlxdWVzXG5leHBvcnQge1xuICBBUFBXUklURV9DT05GSUcsIC8vIEFqb3V0XHUwMEU5IHBvdXIgY29uc29saWRlciBsZXMgZXhwb3J0c1xuICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gIGdldEFjY291bnQsXG4gIGdldEZ1bmN0aW9ucyxcbiAgZ2V0VGVhbXMsXG4gIGdldERhdGFiYXNlcyxcbiAgZ2V0Q29uZmlnLFxuICBpc0luaXRpYWxpemVkLFxuICBpbml0aWFsaXplQXBwd3JpdGUsXG4gIGdldExvY2FsQ21zVXNlcixcbiAgaXNBdXRoZW50aWNhdGVkQ21zLFxuICBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSxcbiAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgZ2V0VXNlckVtYWlsLFxuICBnZXRVc2VyTmFtZSxcbiAgY2xlYXJBdXRoRGF0YSxcbiAgc2V0QXV0aERhdGEsXG4gIGxvZ291dEdsb2JhbCxcbiAgaXNFbWFpbFZlcmlmaWVkLFxuICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gIHZlcmlmeUVtYWlsLFxuICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICBjcmVhdGVDb2xsYWJvcmF0aXZlUHJvZHVjdHNMaXN0RnJvbUV2ZW50LFxuICBjaGVja0V4aXN0aW5nTWFpbkdyb3VwLFxufTtcblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgIGdldEFwcHdyaXRlQ2xpZW50cyxcbiAgICBnZXRBY2NvdW50LFxuICAgIGdldEZ1bmN0aW9ucyxcbiAgICBnZXREYXRhYmFzZXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMsXG4gICAgaXNBdXRoZW50aWNhdGVkQXBwd3JpdGUsXG4gICAgaXNDb25uZWN0ZWRBcHB3cml0ZSxcbiAgICBnZXRVc2VyRW1haWwsXG4gICAgZ2V0VXNlck5hbWUsXG4gICAgY2xlYXJBdXRoRGF0YSxcbiAgICBzZXRBdXRoRGF0YSxcbiAgICBsb2dvdXRHbG9iYWwsXG4gICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgICB2ZXJpZnlFbWFpbCxcbiAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzLFxuICAgIGNyZWF0ZUNvbGxhYm9yYXRpdmVQcm9kdWN0c0xpc3RGcm9tRXZlbnQsXG4gICAgY2hlY2tFeGlzdGluZ01haW5Hcm91cCxcbiAgICBzdWJzY3JpYmVUb0NvbGxlY3Rpb25zLFxuICB9O1xufVxuIiwgImltcG9ydCB7IGdldEFjY291bnQgfSBmcm9tICcuL2FwcHdyaXRlLWNsaWVudC5qcyc7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcmVzZXRQYXNzd29yZEZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXQtcGFzc3dvcmQtZm9ybScpO1xuICAgIGNvbnN0IG5ld1Bhc3N3b3JkSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbmV3LXBhc3N3b3JkJyk7XG4gICAgY29uc3QgY29uZmlybVBhc3N3b3JkSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1wYXNzd29yZCcpO1xuICAgIGNvbnN0IHJlc2V0UGFzc3dvcmRCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXQtcGFzc3dvcmQtYnV0dG9uJyk7XG4gICAgY29uc3QgcmVzZXRCdXR0b25TcGlubmVyID0gcmVzZXRQYXNzd29yZEJ1dHRvbiA/IHJlc2V0UGFzc3dvcmRCdXR0b24ucXVlcnlTZWxlY3RvcignLnNwaW5uZXItYm9yZGVyJykgOiBudWxsO1xuICAgIGNvbnN0IG1lc3NhZ2VEaXNwbGF5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0LXBhc3N3b3JkLW1lc3NhZ2UnKTtcbiAgICBjb25zdCBwYXNzd29yZE1hdGNoRXJyb3IgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFzc3dvcmQtbWF0Y2gtZXJyb3InKTtcbiAgICBjb25zdCBzdWNjZXNzTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWNjZXNzLW1lc3NhZ2UnKTtcblxuICAgIC8vIEZ1bmN0aW9uIHRvIGRpc3BsYXkgbWVzc2FnZXNcbiAgICBmdW5jdGlvbiBzaG93TWVzc2FnZSh0eXBlLCB0ZXh0KSB7XG4gICAgICAgIGlmIChtZXNzYWdlRGlzcGxheSkge1xuICAgICAgICAgICAgbWVzc2FnZURpc3BsYXkudGV4dENvbnRlbnQgPSB0ZXh0O1xuICAgICAgICAgICAgbWVzc2FnZURpc3BsYXkuY2xhc3NOYW1lID0gYGFsZXJ0IGFsZXJ0LSR7dHlwZX0gbXktNCByb3VuZGVkYDtcbiAgICAgICAgICAgIG1lc3NhZ2VEaXNwbGF5LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGlkZSBtZXNzYWdlIGVsZW1lbnRzIGluaXRpYWxseVxuICAgIGlmIChtZXNzYWdlRGlzcGxheSkgbWVzc2FnZURpc3BsYXkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZiAocGFzc3dvcmRNYXRjaEVycm9yKSBwYXNzd29yZE1hdGNoRXJyb3Iuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZiAocmVzZXRQYXNzd29yZEZvcm0pIHJlc2V0UGFzc3dvcmRGb3JtLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgaWYgKHN1Y2Nlc3NNZXNzYWdlKSBzdWNjZXNzTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgLy8gUGFyc2UgVVJMIGZvciB1c2VySWQgYW5kIHNlY3JldFxuICAgIGNvbnN0IHVybFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG4gICAgY29uc3QgdXNlcklkID0gdXJsUGFyYW1zLmdldCgndXNlcklkJyk7XG4gICAgY29uc3Qgc2VjcmV0ID0gdXJsUGFyYW1zLmdldCgnc2VjcmV0Jyk7XG5cbiAgICBpZiAoIXVzZXJJZCB8fCAhc2VjcmV0KSB7XG4gICAgICAgIHNob3dNZXNzYWdlKCdkYW5nZXInLCAnTGllbiBkZSByXHUwMEU5aW5pdGlhbGlzYXRpb24gZGUgbW90IGRlIHBhc3NlIGludmFsaWRlIG91IGV4cGlyXHUwMEU5LicpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWYgdXNlcklkIGFuZCBzZWNyZXQgYXJlIHByZXNlbnQsIHNob3cgdGhlIGZvcm1cbiAgICBpZiAocmVzZXRQYXNzd29yZEZvcm0pIHJlc2V0UGFzc3dvcmRGb3JtLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG4gICAgcmVzZXRQYXNzd29yZEZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgY29uc3QgbmV3UGFzc3dvcmQgPSBuZXdQYXNzd29yZElucHV0ID8gbmV3UGFzc3dvcmRJbnB1dC52YWx1ZSA6ICcnO1xuICAgICAgICBjb25zdCBjb25maXJtUGFzc3dvcmQgPSBjb25maXJtUGFzc3dvcmRJbnB1dCA/IGNvbmZpcm1QYXNzd29yZElucHV0LnZhbHVlIDogJyc7XG5cbiAgICAgICAgLy8gUmVzZXQgcHJldmlvdXMgbWVzc2FnZXNcbiAgICAgICAgaWYgKG1lc3NhZ2VEaXNwbGF5KSBtZXNzYWdlRGlzcGxheS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBpZiAocGFzc3dvcmRNYXRjaEVycm9yKSBwYXNzd29yZE1hdGNoRXJyb3Iuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICBpZiAobmV3UGFzc3dvcmQgIT09IGNvbmZpcm1QYXNzd29yZCkge1xuICAgICAgICAgICAgaWYgKHBhc3N3b3JkTWF0Y2hFcnJvcikgcGFzc3dvcmRNYXRjaEVycm9yLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgbmV3UGFzc3dvcmRJbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1pbnZhbGlkJyk7XG4gICAgICAgICAgICBjb25maXJtUGFzc3dvcmRJbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1pbnZhbGlkJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXdQYXNzd29yZElucHV0LmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcbiAgICAgICAgICAgIGNvbmZpcm1QYXNzd29yZElucHV0LmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdQYXNzd29yZC5sZW5ndGggPCA4KSB7XG4gICAgICAgICAgICBzaG93TWVzc2FnZSgnZGFuZ2VyJywgJ0xlIG5vdXZlYXUgbW90IGRlIHBhc3NlIGRvaXQgY29udGVuaXIgYXUgbW9pbnMgOCBjYXJhY3RcdTAwRThyZXMuJyk7XG4gICAgICAgICAgICBuZXdQYXNzd29yZElucHV0LmNsYXNzTGlzdC5hZGQoJ2lzLWludmFsaWQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld1Bhc3N3b3JkSW5wdXQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtaW52YWxpZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc2V0UGFzc3dvcmRCdXR0b24pIHJlc2V0UGFzc3dvcmRCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICBpZiAocmVzZXRCdXR0b25TcGlubmVyKSByZXNldEJ1dHRvblNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICAgICAgYXdhaXQgYWNjb3VudC51cGRhdGVSZWNvdmVyeSh1c2VySWQsIHNlY3JldCwgbmV3UGFzc3dvcmQsIGNvbmZpcm1QYXNzd29yZCk7XG5cbiAgICAgICAgICAgIGlmIChyZXNldFBhc3N3b3JkRm9ybSkgcmVzZXRQYXNzd29yZEZvcm0uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgIGlmIChzdWNjZXNzTWVzc2FnZSkgc3VjY2Vzc01lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICBzaG93TWVzc2FnZSgnc3VjY2VzcycsICdWb3RyZSBtb3QgZGUgcGFzc2UgYSBcdTAwRTl0XHUwMEU5IHJcdTAwRTlpbml0aWFsaXNcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cyAhJyk7XG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIHJlZGlyZWN0IHRvIGxvZ2luIHBhZ2UgYWZ0ZXIgYSBkZWxheVxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSAnL2xvZ2luJztcbiAgICAgICAgICAgIH0sIDUwMDApO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbUmVzZXRQYXNzd29yZF0gRXJyZXVyIGxvcnMgZGUgbGEgclx1MDBFOWluaXRpYWxpc2F0aW9uIGR1IG1vdCBkZSBwYXNzZTonLCBlcnJvcik7XG4gICAgICAgICAgICBsZXQgZXJyb3JNZXNzYWdlVGV4dCA9ICdVbmUgZXJyZXVyIGVzdCBzdXJ2ZW51ZSBsb3JzIGRlIGxhIHJcdTAwRTlpbml0aWFsaXNhdGlvbiBkZSB2b3RyZSBtb3QgZGUgcGFzc2UuIFZldWlsbGV6IHJcdTAwRTllc3NheWVyIG91IGNvbnRhY3RlciBsXFwnYWRtaW5pc3RyYXRldXIuJztcblxuICAgICAgICAgICAgaWYgKGVycm9yLnJlc3BvbnNlICYmIGVycm9yLnJlc3BvbnNlLm1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IucmVzcG9uc2UuY29kZSA9PT0gNDAxICYmIGVycm9yLnJlc3BvbnNlLm1lc3NhZ2UuaW5jbHVkZXMoJ0ludmFsaWQgc2VjcmV0JykpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JNZXNzYWdlVGV4dCA9ICdMZSBsaWVuIGRlIHJcdTAwRTlpbml0aWFsaXNhdGlvbiBlc3QgaW52YWxpZGUgb3UgYSBleHBpclx1MDBFOS4gVmV1aWxsZXogcmVmYWlyZSB1bmUgZGVtYW5kZS4nO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZVRleHQgPSBlcnJvci5yZXNwb25zZS5tZXNzYWdlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZVRleHQgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2hvd01lc3NhZ2UoJ2RhbmdlcicsIGVycm9yTWVzc2FnZVRleHQpO1xuXG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBpZiAocmVzZXRQYXNzd29yZEJ1dHRvbikgcmVzZXRQYXNzd29yZEJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHJlc2V0QnV0dG9uU3Bpbm5lcikgcmVzZXRCdXR0b25TcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7O0FBTUEsTUFBTSxrQkFBa0I7QUFBQSxJQUN0QixVQUFVO0FBQUEsSUFDVixXQUFXO0FBQUEsSUFDWCxZQUFZO0FBQUEsSUFDWixXQUFXO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxlQUFlO0FBQUE7QUFBQSxNQUVmLGFBQWE7QUFBQSxJQUNmO0FBQUEsSUFDQSxhQUFhO0FBQUEsTUFDWCxNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxVQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFHQSxNQUFJLFNBQVM7QUFDYixNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFDaEIsTUFBSSxZQUFZO0FBQ2hCLE1BQUksUUFBUTtBQUNaLE1BQUksd0JBQXdCO0FBTzVCLFdBQVMsZ0JBQWdCLGNBQWMsSUFBSSxXQUFXLEtBQUs7QUFDekQsV0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDdEMsVUFBSSxXQUFXO0FBRWYsZUFBUyxnQkFBZ0I7QUFDdkI7QUFDQSxZQUNFLE9BQU8sWUFDUCxPQUFPLFNBQVMsVUFDaEIsT0FBTyxTQUFTLFNBQ2hCO0FBQ0Esa0JBQVE7QUFBQSxRQUNWLFdBQVcsWUFBWSxh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

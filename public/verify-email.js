(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/appwrite-client.js
  var appwrite_client_exports = {};
  __export(appwrite_client_exports, {
    clearAuthData: () => clearAuthData,
    getAccount: () => getAccount,
    getAppwriteClients: () => getAppwriteClients,
    getConfig: () => getConfig,
    getFunctions: () => getFunctions,
    getLocalCmsUser: () => getLocalCmsUser,
    getLocalEmailVerificationStatus: () => getLocalEmailVerificationStatus,
    getTeams: () => getTeams,
    getUserEmail: () => getUserEmail,
    getUserName: () => getUserName,
    initializeAppwrite: () => initializeAppwrite,
    isAuthenticatedCms: () => isAuthenticatedCms,
    isEmailVerified: () => isEmailVerified,
    isInitialized: () => isInitialized,
    logoutGlobal: () => logoutGlobal,
    sendVerificationEmail: () => sendVerificationEmail,
    setAuthData: () => setAuthData,
    verifyEmail: () => verifyEmail
  });
  function waitForAppwrite(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function checkAppwrite() {
        attempts++;
        if (window.Appwrite && window.Appwrite.Client && window.Appwrite.Account) {
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error("[Appwrite Client] SDK Appwrite non charg\xE9 apr\xE8s le nombre maximum de tentatives");
          reject(new Error("Le SDK Appwrite n'a pas pu \xEAtre charg\xE9."));
        } else {
          setTimeout(checkAppwrite, interval);
        }
      }
      checkAppwrite();
    });
  }
  async function initializeAppwrite() {
    if (client && account && functions) {
      console.log("[Appwrite Client] Clients d\xE9j\xE0 initialis\xE9s, r\xE9utilisation");
      return { client, account, functions };
    }
    if (initializationPromise) {
      console.log("[Appwrite Client] Initialisation en cours, attente...");
      return initializationPromise;
    }
    initializationPromise = (async () => {
      try {
        console.log("[Appwrite Client] D\xE9but de l'initialisation");
        await waitForAppwrite();
        const { Client, Account, Functions } = window.Appwrite;
        client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
        account = new Account(client);
        functions = new Functions(client);
        console.log("[Appwrite Client] Initialisation termin\xE9e avec succ\xE8s");
        return { client, account, functions };
      } catch (error) {
        console.error("[Appwrite Client] Erreur lors de l'initialisation:", error);
        client = null;
        account = null;
        functions = null;
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
    const { account: account2 } = await initializeAppwrite();
    if (account2) {
      console.log("[Appwrite Client] R\xE9cup\xE9ration du compte Appwrite r\xE9ussie", account2);
    } else {
      console.error("[Appwrite Client] R\xE9cup\xE9ration du compte Appwrite \xE9chou\xE9e");
    }
    return account2;
  }
  async function getFunctions() {
    const { functions: functions2 } = await initializeAppwrite();
    return functions2;
  }
  async function getTeams() {
    const { Client, Teams } = window.Appwrite;
    if (!client) {
      await initializeAppwrite();
    }
    const teams = new Teams(client);
    return teams;
  }
  function getConfig() {
    return {
      APPWRITE_ENDPOINT,
      APPWRITE_PROJECT_ID,
      APPWRITE_FUNCTION_ID,
      ACCESS_REQUEST_FUNCTION_ID
    };
  }
  function isInitialized() {
    return !!(client && account && functions);
  }
  function getLocalCmsUser() {
    const cmsUser = localStorage.getItem("sveltia-cms.user");
    if (!cmsUser) {
      console.log("\u2139\uFE0F [getLocalCmsUser] Aucun token CMS dans localStorage");
      return null;
    }
    try {
      const parsedUser = JSON.parse(cmsUser);
      if (parsedUser.token && typeof parsedUser.token === "string" && parsedUser.token.trim() !== "") {
        console.log("\u2705 [getLocalCmsUser] Token CMS valide");
        return parsedUser;
      }
      console.log("\u26A0\uFE0F [getLocalCmsUser] Token CMS invalide - nettoyage");
      localStorage.removeItem("sveltia-cms.user");
      return null;
    } catch (e) {
      console.warn("\u274C [getLocalCmsUser] Donn\xE9es CMS corrompues dans localStorage. Nettoyage...", e);
      localStorage.removeItem("sveltia-cms.user");
      return null;
    }
  }
  function isAuthenticatedCms() {
    console.log("getLocalCmsUser(): ", getLocalCmsUser() !== null);
    return getLocalCmsUser() !== null;
  }
  async function isEmailVerified() {
    try {
      const account2 = await getAccount();
      const user = await account2.get();
      return user.emailVerification || false;
    } catch (error) {
      console.warn("[AppwriteClient] Impossible de v\xE9rifier l'\xE9tat de v\xE9rification d'email:", error);
      return false;
    }
  }
  async function sendVerificationEmail(redirectURL = null) {
    try {
      const account2 = await getAccount();
      const verificationURL = redirectURL || `${window.location.origin}/verify-email`;
      await account2.createVerification(verificationURL);
      console.log("[AppwriteClient] Email de v\xE9rification envoy\xE9 avec succ\xE8s");
    } catch (error) {
      console.error("[AppwriteClient] Erreur lors de l'envoi de l'email de v\xE9rification:", error);
      throw error;
    }
  }
  async function verifyEmail(userId, secret) {
    try {
      const account2 = await getAccount();
      await account2.updateVerification(userId, secret);
      console.log("[AppwriteClient] Email v\xE9rifi\xE9 avec succ\xE8s");
    } catch (error) {
      console.error("[AppwriteClient] Erreur lors de la v\xE9rification d'email:", error);
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
  async function logoutGlobal() {
    try {
      clearAuthData();
      const account2 = await getAccount();
      await account2.deleteSession("current");
    } catch (error) {
      console.warn("[Appwrite Client] Erreur lors de la d\xE9connexion Appwrite (peut-\xEAtre d\xE9j\xE0 d\xE9connect\xE9):", error);
    }
  }
  function setAuthData(email, name, cmsAuth) {
    localStorage.setItem("appwrite-user-email", email);
    localStorage.setItem("appwrite-user-name", name);
    localStorage.setItem("sveltia-cms.user", JSON.stringify(cmsAuth));
  }
  var APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_FUNCTION_ID, ACCESS_REQUEST_FUNCTION_ID, client, account, functions, initializationPromise;
  var init_appwrite_client = __esm({
    "ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/appwrite-client.js"() {
      APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
      APPWRITE_PROJECT_ID = "689725820024e81781b7";
      APPWRITE_FUNCTION_ID = "68976500002eb5c6ee4f";
      ACCESS_REQUEST_FUNCTION_ID = "689cdea5001a4d74549d";
      client = null;
      account = null;
      functions = null;
      initializationPromise = null;
      if (typeof window !== "undefined") {
        window.AppwriteClient = {
          getAppwriteClients,
          getAccount,
          getFunctions,
          getTeams,
          getConfig,
          isInitialized,
          initializeAppwrite,
          getLocalCmsUser,
          isAuthenticatedCms,
          getUserEmail,
          getUserName,
          clearAuthData,
          setAuthData,
          logoutGlobal,
          isEmailVerified,
          sendVerificationEmail,
          verifyEmail,
          getLocalEmailVerificationStatus
        };
      }
    }
  });

  // <stdin>
  init_appwrite_client();
  document.addEventListener("DOMContentLoaded", async () => {
    const loadingState = document.getElementById("loading-state");
    const successState = document.getElementById("success-state");
    const errorState = document.getElementById("error-state");
    const expiredState = document.getElementById("expired-state");
    const errorMessage = document.getElementById("error-message");
    const retryButton = document.getElementById("retry-button");
    const retrySpinner = retryButton?.querySelector(".spinner-border");
    const configState = document.getElementById("config-state");
    const editButton = document.getElementById("edit-button");
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");
    const secret = urlParams.get("secret");
    function showState(state) {
      if (loadingState) loadingState.style.display = state === "loading" ? "block" : "none";
      if (successState) successState.style.display = state === "success" ? "block" : "none";
      if (errorState) errorState.style.display = state === "error" ? "block" : "none";
      if (expiredState) expiredState.style.display = state === "expired" ? "block" : "none";
      if (configState) configState.style.display = state === "config" ? "block" : "none";
    }
    async function setupCmsAuthentication() {
      const { APPWRITE_FUNCTION_ID: APPWRITE_FUNCTION_ID2 } = await Promise.resolve().then(() => (init_appwrite_client(), appwrite_client_exports)).then((module) => module.getConfig());
      try {
        const account2 = await getAccount();
        const appwriteUser = await account2.get();
        if (!appwriteUser.emailVerification) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        const { getFunctions: getFunctions2 } = await Promise.resolve().then(() => (init_appwrite_client(), appwrite_client_exports));
        const functions2 = await getFunctions2();
        console.log("[Verify Email] Appel de la fonction CMS...");
        const execution = await functions2.createExecution(
          APPWRITE_FUNCTION_ID2,
          JSON.stringify({
            action: "get-cms-token",
            userId: appwriteUser.$id
          }),
          false
        );
        console.log("[Verify Email] R\xE9ponse de la fonction CMS:", execution.responseBody);
        let result;
        try {
          result = JSON.parse(execution.responseBody);
        } catch (parseError) {
          console.error("[Verify Email] Erreur de parsing de la r\xE9ponse CMS:", parseError);
          throw new Error(`Erreur de parsing: ${execution.responseBody}`);
        }
        if (!result.success) {
          throw new Error(`Erreur de la fonction CMS: ${result.error || "Erreur inconnue"}`);
        }
        const cmsUser = result.user;
        if (!cmsUser || !cmsUser.token || typeof cmsUser.token !== "string" || cmsUser.token.trim() === "") {
          throw new Error("Token CMS invalide re\xE7u de la fonction");
        }
        setAuthData(appwriteUser.email, appwriteUser.name, cmsUser);
        console.log("[Verify Email] Configuration CMS termin\xE9e avec succ\xE8s");
        return true;
      } catch (error) {
        console.error("[Verify Email] Erreur lors de la configuration CMS:", error);
        throw error;
      }
    }
    async function attemptVerification() {
      try {
        console.log("[Verify Email] Tentative de v\xE9rification avec userId:", userId);
        await verifyEmail(userId, secret);
        localStorage.removeItem("email-verification-status");
        console.log("[Verify Email] V\xE9rification r\xE9ussie");
        showState("config");
        try {
          await setupCmsAuthentication();
          console.log("[Verify Email] Configuration compl\xE8te termin\xE9e");
          showState("success");
          if (editButton) {
            editButton.disabled = false;
            editButton.classList.remove("btn-secondary");
            editButton.classList.add("btn-primary");
          }
        } catch (cmsError) {
          console.error("[Verify Email] Erreur lors de la configuration CMS:", cmsError);
          if (errorMessage) {
            errorMessage.textContent = "Email v\xE9rifi\xE9 mais erreur lors de la configuration du compte. Veuillez vous reconnecter.";
          }
          showState("error");
        }
      } catch (error) {
        console.error("[Verify Email] Erreur lors de la v\xE9rification:", error);
        if (error.code === 401 || error.message?.includes("invalid") || error.message?.includes("expired")) {
          showState("expired");
        } else {
          if (errorMessage) {
            errorMessage.textContent = error.message || "Une erreur inattendue est survenue lors de la v\xE9rification.";
          }
          showState("error");
        }
      }
    }
    if (retryButton) {
      retryButton.addEventListener("click", async () => {
        retryButton.disabled = true;
        if (retrySpinner) retrySpinner.style.display = "inline-block";
        showState("loading");
        await attemptVerification();
        retryButton.disabled = false;
        if (retrySpinner) retrySpinner.style.display = "none";
      });
    }
    if (!userId || !secret) {
      console.warn("[Verify Email] Param\xE8tres manquants - userId:", !!userId, "secret:", !!secret);
      if (errorMessage) {
        errorMessage.textContent = "Lien de v\xE9rification invalide. Les param\xE8tres requis sont manquants.";
      }
      showState("error");
      return;
    }
    setTimeout(async () => {
      await attemptVerification();
    }, 500);
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzIiwgIjxzdGRpbj4iXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FwcHdyaXRlLWNsaWVudC5qc1xuLy8gTW9kdWxlIGNvbW11biBwb3VyIGwnaW5pdGlhbGlzYXRpb24gZXQgbGEgZ2VzdGlvbiBkdSBjbGllbnQgQXBwd3JpdGVcbi8vIFx1MDBDOXZpdGUgbGEgZHVwbGljYXRpb24gZCdpbml0aWFsaXNhdGlvbiBlbnRyZSBhdXRoLXN0YXR1cy5qcyBldCBhdXRoQXBwd3JpdGUuanNcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9jbG91ZC5hcHB3cml0ZS5pby92MVwiO1xuY29uc3QgQVBQV1JJVEVfUFJPSkVDVF9JRCA9IFwiNjg5NzI1ODIwMDI0ZTgxNzgxYjdcIjtcbmNvbnN0IEFQUFdSSVRFX0ZVTkNUSU9OX0lEID0gXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC1mdW5jdGlvblxuY29uc3QgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQgPSBcIjY4OWNkZWE1MDAxYTRkNzQ1NDlkXCI7IC8vIElEIGRlIGxhIGZvbmN0aW9uIGQnZW52b2kgZCdlbWFpbFxuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cbi8qKlxuICogQXR0ZW5kIHF1ZSBsZSBTREsgQXBwd3JpdGUgc29pdCBjaGFyZ1x1MDBFOSBldCBpbml0aWFsaXNlIGxlcyBjbGllbnRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBxdWkgc2Ugclx1MDBFOXNvdXQgcXVhbmQgbCdpbml0aWFsaXNhdGlvbiBlc3QgdGVybWluXHUwMEU5ZVxuICovXG5mdW5jdGlvbiB3YWl0Rm9yQXBwd3JpdGUobWF4QXR0ZW1wdHMgPSA1MCwgaW50ZXJ2YWwgPSAxMDApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrQXBwd3JpdGUoKSB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIFZcdTAwRTlyaWZpY2F0aW9uIFNESyAtIHRlbnRhdGl2ZSAke2F0dGVtcHRzfS8ke21heEF0dGVtcHRzfWApO1xuXG4gICAgICAgICAgICBpZiAod2luZG93LkFwcHdyaXRlICYmIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiYgd2luZG93LkFwcHdyaXRlLkFjY291bnQpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBjaGFyZ1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdHMgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSBhcHJcdTAwRThzIGxlIG5vbWJyZSBtYXhpbXVtIGRlIHRlbnRhdGl2ZXNcIik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkxlIFNESyBBcHB3cml0ZSBuJ2EgcGFzIHB1IFx1MDBFQXRyZSBjaGFyZ1x1MDBFOS5cIikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrQXBwd3JpdGUoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXNlIGxlcyBjbGllbnRzIEFwcHdyaXRlICh1bmUgc2V1bGUgZm9pcylcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9uc30+fSBMZXMgY2xpZW50cyBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHB3cml0ZSgpIHtcbiAgICAvLyBTaSBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTksIHJldG91cm5lciBsZXMgY2xpZW50cyBleGlzdGFudHNcbiAgICBpZiAoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQ2xpZW50cyBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzLCByXHUwMEU5dXRpbGlzYXRpb25cIik7XG4gICAgICAgIHJldHVybiB7IGNsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zIH07XG4gICAgfVxuXG4gICAgLy8gU2kgdW5lIGluaXRpYWxpc2F0aW9uIGVzdCBlbiBjb3VycywgYXR0ZW5kcmUgcXUnZWxsZSBzZSB0ZXJtaW5lXG4gICAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGVuIGNvdXJzLCBhdHRlbnRlLi4uXCIpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xuICAgIH1cblxuICAgIC8vIENvbW1lbmNlciB1bmUgbm91dmVsbGUgaW5pdGlhbGlzYXRpb25cbiAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEXHUwMEU5YnV0IGRlIGwnaW5pdGlhbGlzYXRpb25cIik7XG5cbiAgICAgICAgICAgIC8vIEF0dGVuZHJlIHF1ZSBsZSBTREsgc29pdCBjaGFyZ1x1MDBFOVxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckFwcHdyaXRlKCk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzXG4gICAgICAgICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgICAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChBUFBXUklURV9FTkRQT0lOVClcbiAgICAgICAgICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9QUk9KRUNUX0lEKTtcblxuICAgICAgICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICAgICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgdmFyaWFibGVzIGVuIGNhcyBkJ2VycmV1clxuICAgICAgICAgICAgY2xpZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGFjY291bnQgPSBudWxsO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbnVsbDtcbiAgICAgICAgICAgIGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgQXBwd3JpdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXBwd3JpdGVDbGllbnRzKCkge1xuICAgIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgQWNjb3VudFxuICogQHJldHVybnMge1Byb21pc2U8QWNjb3VudD59IExlIGNsaWVudCBBY2NvdW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFjY291bnQoKSB7XG4gICAgY29uc3QgeyBhY2NvdW50IH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIHJcdTAwRTl1c3NpZVwiLCBhY2NvdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgXHUwMEU5Y2hvdVx1MDBFOWVcIik7XG4gICAgfVxuICAgIHJldHVybiBhY2NvdW50O1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBGdW5jdGlvbnNcbiAqIEByZXR1cm5zIHtQcm9taXNlPEZ1bmN0aW9ucz59IExlIGNsaWVudCBGdW5jdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25zKCkge1xuICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICByZXR1cm4gZnVuY3Rpb25zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBUZWFtc1xuICogQHJldHVybnMge1Byb21pc2U8VGVhbXM+fSBMZSBjbGllbnQgVGVhbXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0VGVhbXMoKSB7XG4gICAgY29uc3QgeyBDbGllbnQsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgfVxuICAgIGNvbnN0IHRlYW1zID0gbmV3IFRlYW1zKGNsaWVudCk7XG4gICAgcmV0dXJuIHRlYW1zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY29uc3RhbnRlcyBkZSBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBDb25maWd1cmF0aW9uIEFwcHdyaXRlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICAgIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEXG4gICAgfTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGVzIGNsaWVudHMgc29udCBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsZXMgY2xpZW50cyBzb250IGluaXRpYWxpc1x1MDBFOXNcbiAqL1xuZnVuY3Rpb24gaXNJbml0aWFsaXplZCgpIHtcbiAgICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdhdXRoZW50aWZpY2F0aW9uIENNUyBsb2NhbGUgKHNvdXJjZSBkZSB2XHUwMEU5cml0XHUwMEU5IHByaW5jaXBhbGUpXG4gKiBAcmV0dXJucyB7b2JqZWN0fG51bGx9IEwnb2JqZXQgdXRpbGlzYXRldXIgcydpbCBlc3QgdmFsaWRlLCBzaW5vbiBudWxsXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAvLyBjb25zb2xlLmxvZygnXHVEODNEXHVERDBEIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIGJydXQgZGVwdWlzIGxvY2FsU3RvcmFnZTonLCBjbXNVc2VyKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICBjb25zb2xlLmxvZygnXHUyMTM5XHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIEF1Y3VuIHRva2VuIENNUyBkYW5zIGxvY2FsU3RvcmFnZScpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBwYXJzXHUwMEU5OicsIHtcbiAgICAgICAgICAvLyAgICAgaGFzVG9rZW46ICEhcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5UeXBlOiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5MZW5ndGg6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgLy8gICAgIHRva2VuUHJldmlldzogcGFyc2VkVXNlci50b2tlbiA/IHBhcnNlZFVzZXIudG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogJ04vQScsXG4gICAgICAgICAgLy8gICAgIGhhc0lkOiAhIXBhcnNlZFVzZXIuaWQsXG4gICAgICAgICAgLy8gICAgIGhhc0VtYWlsOiAhIXBhcnNlZFVzZXIuZW1haWwsXG4gICAgICAgICAgLy8gICAgIGJhY2tlbmROYW1lOiBwYXJzZWRVc2VyLmJhY2tlbmROYW1lXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGlmIChwYXJzZWRVc2VyLnRva2VuICYmIHR5cGVvZiBwYXJzZWRVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJiBwYXJzZWRVc2VyLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gQ01TIHZhbGlkZScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyBpbnZhbGlkZSAtIG5ldHRveWFnZScpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignXHUyNzRDIFtnZXRMb2NhbENtc1VzZXJdIERvbm5cdTAwRTllcyBDTVMgY29ycm9tcHVlcyBkYW5zIGxvY2FsU3RvcmFnZS4gTmV0dG95YWdlLi4uJywgZSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOSAoYmFzXHUwMEU5IHN1ciBsZSB0b2tlbiBDTVMpXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gKi9cbmZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZENtcygpIHtcbiAgY29uc29sZS5sb2coJ2dldExvY2FsQ21zVXNlcigpOiAnLCBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbCk7XG4gICAgcmV0dXJuIGdldExvY2FsQ21zVXNlcigpICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgZ2V0QWNjb3VudFxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZXN0IHZcdTAwRTlyaWZpXHUwMEU5XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBzaSBsJ2VtYWlsIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICovXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgIHJldHVybiB1c2VyLmVtYWlsVmVyaWZpY2F0aW9uIHx8IGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBJbXBvc3NpYmxlIGRlIHZcdTAwRTlyaWZpZXIgbFxcJ1x1MDBFOXRhdCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBkXFwnZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEVudm9pZSB1biBlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBcdTAwRTAgbCd1dGlsaXNhdGV1ciBjb25uZWN0XHUwMEU5XG4gKiBAcGFyYW0ge3N0cmluZ30gcmVkaXJlY3RVUkwgLSBVUkwgdmVycyBsYXF1ZWxsZSByZWRpcmlnZXIgYXByXHUwMEU4cyB2XHUwMEU5cmlmaWNhdGlvblxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb25VUkwgPSByZWRpcmVjdFVSTCB8fCBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS92ZXJpZnktZW1haWxgO1xuICAgICAgICBhd2FpdCBhY2NvdW50LmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FwcHdyaXRlQ2xpZW50XSBFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBlbnZveVx1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBsJ2VtYWlsIGF2ZWMgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSB2XHUwMEU5cmlmaWNhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWNyZXQgLSBTZWNyZXQgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgdlx1MDBFOXJpZmlcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gY29tcGxldCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fSBcdTAwQzl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGF2ZWMgdlx1MDBFOXJpZmljYXRpb24gZW1haWxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRpb25TdGF0ZSgpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgY29uc3QgdXNlckVtYWlsID0gZ2V0VXNlckVtYWlsKCk7XG4gICAgY29uc3QgdXNlck5hbWUgPSBnZXRVc2VyTmFtZSgpO1xuXG4gICAgaWYgKCFjbXNVc2VyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZW1haWxWZXJpZmllZCxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxcXCdcdTAwRTl0YXQgZFxcJ2F1dGhlbnRpZmljYXRpb246JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZGVwdWlzIGxlIGxvY2FsU3RvcmFnZVxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyRW1haWwoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIGxlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpIDtcbn1cblxuXG4vKipcbiAqIE5ldHRvaWUgdG91dGVzIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJBdXRoRGF0YSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJyk7XG4gICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXMgbmV0dG95XHUwMEU5ZXNcIik7XG59XG5cbi8qKlxuICogRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIC0gc3VwcHJpbWUgbGEgc2Vzc2lvbiBBcHB3cml0ZSBldCBuZXR0b2llIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBOZXR0b3llciBkJ2Fib3JkIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG5cbiAgICAgICAgLy8gU3VwcHJpbWVyIGxhIHNlc3Npb24gQXBwd3JpdGVcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKCdjdXJyZW50Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIHJcdTAwRTl1c3NpZVwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsIGVycm9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBMZSBub20gZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtvYmplY3R9IGNtc0F1dGggLSBMJ29iamV0IGQnYXV0aGVudGlmaWNhdGlvbiBDTVNcbiAqL1xuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIGVtYWlsKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJywgbmFtZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8vIEV4cG9ydCBkZXMgZm9uY3Rpb25zIHB1YmxpcXVlc1xuZXhwb3J0IHtcbiAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgZ2V0QWNjb3VudCxcbiAgICBnZXRGdW5jdGlvbnMsXG4gICAgZ2V0VGVhbXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMgLFxuICAgIGdldFVzZXJFbWFpbCxcbiAgICBnZXRVc2VyTmFtZSxcbiAgICBjbGVhckF1dGhEYXRhLFxuICAgIHNldEF1dGhEYXRhLFxuICAgIGxvZ291dEdsb2JhbCxcbiAgICBpc0VtYWlsVmVyaWZpZWQsXG4gICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgIHZlcmlmeUVtYWlsLFxuICAgIGdldExvY2FsRW1haWxWZXJpZmljYXRpb25TdGF0dXNcbn07XG5cblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgICAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgICAgIGdldEFjY291bnQsXG4gICAgICAgIGdldEZ1bmN0aW9ucyxcbiAgICAgICAgZ2V0VGVhbXMsXG4gICAgICAgIGdldENvbmZpZyxcbiAgICAgICAgaXNJbml0aWFsaXplZCxcbiAgICAgICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgICAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZENtcyxcbiAgICAgICAgZ2V0VXNlckVtYWlsLFxuICAgICAgICBnZXRVc2VyTmFtZSxcbiAgICAgICAgY2xlYXJBdXRoRGF0YSxcbiAgICAgICAgc2V0QXV0aERhdGEsXG4gICAgICAgIGxvZ291dEdsb2JhbCxcbiAgICAgICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgICAgICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gICAgICAgIHZlcmlmeUVtYWlsLFxuICAgICAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG4gICAgfTtcbn1cbiIsICIvLyBodWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy92ZXJpZnktZW1haWwuanNcbi8vIFNjcmlwdCBwb3VyIGdcdTAwRTlyZXIgbGEgdlx1MDBFOXJpZmljYXRpb24gZCdlbWFpbCB2aWEgbGVzIHBhcmFtXHUwMEU4dHJlcyBVUkxcblxuaW1wb3J0IHsgdmVyaWZ5RW1haWwsIGdldEFjY291bnQsIHNldEF1dGhEYXRhLCBnZXRMb2NhbENtc1VzZXIgfSBmcm9tICcuL2FwcHdyaXRlLWNsaWVudC5qcyc7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhc3luYyAoKSA9PiB7XG4gIC8vIC0tLSBcdTAwQzlMXHUwMEM5TUVOVFMgRFUgRE9NIC0tLVxuICBjb25zdCBsb2FkaW5nU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZy1zdGF0ZScpO1xuICBjb25zdCBzdWNjZXNzU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VjY2Vzcy1zdGF0ZScpO1xuICBjb25zdCBlcnJvclN0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vycm9yLXN0YXRlJyk7XG4gIGNvbnN0IGV4cGlyZWRTdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdleHBpcmVkLXN0YXRlJyk7XG4gIGNvbnN0IGVycm9yTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcnJvci1tZXNzYWdlJyk7XG4gIGNvbnN0IHJldHJ5QnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JldHJ5LWJ1dHRvbicpO1xuICBjb25zdCByZXRyeVNwaW5uZXIgPSByZXRyeUJ1dHRvbj8ucXVlcnlTZWxlY3RvcignLnNwaW5uZXItYm9yZGVyJyk7XG4gIGNvbnN0IGNvbmZpZ1N0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpZy1zdGF0ZScpO1xuICBjb25zdCBlZGl0QnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2VkaXQtYnV0dG9uJyk7XG5cbiAgLy8gLS0tIFJcdTAwQzlDVVBcdTAwQzlSQVRJT04gREVTIFBBUkFNXHUwMEM4VFJFUyBVUkwgLS0tXG4gIGNvbnN0IHVybFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG4gIGNvbnN0IHVzZXJJZCA9IHVybFBhcmFtcy5nZXQoJ3VzZXJJZCcpO1xuICBjb25zdCBzZWNyZXQgPSB1cmxQYXJhbXMuZ2V0KCdzZWNyZXQnKTtcblxuICAvKipcbiAgICogQWZmaWNoZSB1biBcdTAwRTl0YXQgc3BcdTAwRTljaWZpcXVlIGRlIGwnVUlcbiAgICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlIC0gJ2xvYWRpbmcnLCAnc3VjY2VzcycsICdlcnJvcicsICdleHBpcmVkJ1xuICAgKi9cbiAgZnVuY3Rpb24gc2hvd1N0YXRlKHN0YXRlKSB7XG4gICAgaWYgKGxvYWRpbmdTdGF0ZSkgbG9hZGluZ1N0YXRlLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZSA9PT0gJ2xvYWRpbmcnID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgICBpZiAoc3VjY2Vzc1N0YXRlKSBzdWNjZXNzU3RhdGUuc3R5bGUuZGlzcGxheSA9IHN0YXRlID09PSAnc3VjY2VzcycgPyAnYmxvY2snIDogJ25vbmUnO1xuICAgIGlmIChlcnJvclN0YXRlKSBlcnJvclN0YXRlLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZSA9PT0gJ2Vycm9yJyA/ICdibG9jaycgOiAnbm9uZSc7XG4gICAgaWYgKGV4cGlyZWRTdGF0ZSkgZXhwaXJlZFN0YXRlLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZSA9PT0gJ2V4cGlyZWQnID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgICBpZiAoY29uZmlnU3RhdGUpIGNvbmZpZ1N0YXRlLnN0eWxlLmRpc3BsYXkgPSBzdGF0ZSA9PT0gJ2NvbmZpZycgPyAnYmxvY2snIDogJ25vbmUnO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVsbGUgbGEgZm9uY3Rpb24gQ01TIHBvdXIgclx1MDBFOWN1cFx1MDBFOXJlciBsZSB0b2tlbiBhcHJcdTAwRThzIHZcdTAwRTlyaWZpY2F0aW9uXG4gICAqL1xuICBhc3luYyBmdW5jdGlvbiBzZXR1cENtc0F1dGhlbnRpY2F0aW9uKCkge1xuICAgIGNvbnN0IHsgQVBQV1JJVEVfRlVOQ1RJT05fSUQgfSA9IGF3YWl0IGltcG9ydCgnLi9hcHB3cml0ZS1jbGllbnQuanMnKS50aGVuKG1vZHVsZSA9PiBtb2R1bGUuZ2V0Q29uZmlnKCkpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICBjb25zdCBhcHB3cml0ZVVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuXG4gICAgICBpZiAoIWFwcHdyaXRlVXNlci5lbWFpbFZlcmlmaWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFTUFJTF9OT1RfVkVSSUZJRURcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIEltcG9ydGVyIGdldEZ1bmN0aW9ucyBkeW5hbWlxdWVtZW50XG4gICAgICBjb25zdCB7IGdldEZ1bmN0aW9ucyB9ID0gYXdhaXQgaW1wb3J0KCcuL2FwcHdyaXRlLWNsaWVudC5qcycpO1xuICAgICAgY29uc3QgZnVuY3Rpb25zID0gYXdhaXQgZ2V0RnVuY3Rpb25zKCk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdbVmVyaWZ5IEVtYWlsXSBBcHBlbCBkZSBsYSBmb25jdGlvbiBDTVMuLi4nKTtcbiAgICAgIGNvbnN0IGV4ZWN1dGlvbiA9IGF3YWl0IGZ1bmN0aW9ucy5jcmVhdGVFeGVjdXRpb24oXG4gICAgICAgIEFQUFdSSVRFX0ZVTkNUSU9OX0lELFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYWN0aW9uOiBcImdldC1jbXMtdG9rZW5cIixcbiAgICAgICAgICB1c2VySWQ6IGFwcHdyaXRlVXNlci4kaWRcbiAgICAgICAgfSksXG4gICAgICAgIGZhbHNlXG4gICAgICApO1xuXG4gICAgICBjb25zb2xlLmxvZygnW1ZlcmlmeSBFbWFpbF0gUlx1MDBFOXBvbnNlIGRlIGxhIGZvbmN0aW9uIENNUzonLCBleGVjdXRpb24ucmVzcG9uc2VCb2R5KTtcblxuICAgICAgbGV0IHJlc3VsdDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlc3VsdCA9IEpTT04ucGFyc2UoZXhlY3V0aW9uLnJlc3BvbnNlQm9keSk7XG4gICAgICB9IGNhdGNoIChwYXJzZUVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWZXJpZnkgRW1haWxdIEVycmV1ciBkZSBwYXJzaW5nIGRlIGxhIHJcdTAwRTlwb25zZSBDTVM6JywgcGFyc2VFcnJvcik7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyZXVyIGRlIHBhcnNpbmc6ICR7ZXhlY3V0aW9uLnJlc3BvbnNlQm9keX1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycmV1ciBkZSBsYSBmb25jdGlvbiBDTVM6ICR7cmVzdWx0LmVycm9yIHx8ICdFcnJldXIgaW5jb25udWUnfWApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjbXNVc2VyID0gcmVzdWx0LnVzZXI7XG4gICAgICBpZiAoIWNtc1VzZXIgfHwgIWNtc1VzZXIudG9rZW4gfHwgdHlwZW9mIGNtc1VzZXIudG9rZW4gIT09ICdzdHJpbmcnIHx8IGNtc1VzZXIudG9rZW4udHJpbSgpID09PSAnJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUb2tlbiBDTVMgaW52YWxpZGUgcmVcdTAwRTd1IGRlIGxhIGZvbmN0aW9uXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBDb25maWd1cmVyIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uXG4gICAgICBzZXRBdXRoRGF0YShhcHB3cml0ZVVzZXIuZW1haWwsIGFwcHdyaXRlVXNlci5uYW1lLCBjbXNVc2VyKTtcblxuICAgICAgY29uc29sZS5sb2coJ1tWZXJpZnkgRW1haWxdIENvbmZpZ3VyYXRpb24gQ01TIHRlcm1pblx1MDBFOWUgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWZXJpZnkgRW1haWxdIEVycmV1ciBsb3JzIGRlIGxhIGNvbmZpZ3VyYXRpb24gQ01TOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZW50ZSBkZSB2XHUwMEU5cmlmaWVyIGwnZW1haWwgYXZlYyBsZXMgcGFyYW1cdTAwRTh0cmVzIGZvdXJuaXNcbiAgICovXG4gIGFzeW5jIGZ1bmN0aW9uIGF0dGVtcHRWZXJpZmljYXRpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbVmVyaWZ5IEVtYWlsXSBUZW50YXRpdmUgZGUgdlx1MDBFOXJpZmljYXRpb24gYXZlYyB1c2VySWQ6JywgdXNlcklkKTtcbiAgICAgIGF3YWl0IHZlcmlmeUVtYWlsKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJylcblxuICAgICAgLy8gU3VjY1x1MDBFOHMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb25cbiAgICAgIGNvbnNvbGUubG9nKCdbVmVyaWZ5IEVtYWlsXSBWXHUwMEU5cmlmaWNhdGlvbiByXHUwMEU5dXNzaWUnKTtcblxuICAgICAgLy8gQWZmaWNoZXIgbCdcdTAwRTl0YXQgZGUgY29uZmlndXJhdGlvblxuICAgICAgc2hvd1N0YXRlKCdjb25maWcnKTtcblxuICAgICAgLy8gQ29uZmlndXJlciBsJ2F1dGhlbnRpZmljYXRpb24gQ01TXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXR1cENtc0F1dGhlbnRpY2F0aW9uKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbVmVyaWZ5IEVtYWlsXSBDb25maWd1cmF0aW9uIGNvbXBsXHUwMEU4dGUgdGVybWluXHUwMEU5ZScpO1xuICAgICAgICBzaG93U3RhdGUoJ3N1Y2Nlc3MnKTtcblxuICAgICAgICAvLyBBY3RpdmVyIGxlIGJvdXRvbiBkJ1x1MDBFOWRpdGlvblxuICAgICAgICBpZiAoZWRpdEJ1dHRvbikge1xuICAgICAgICAgIGVkaXRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICBlZGl0QnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ2J0bi1zZWNvbmRhcnknKTtcbiAgICAgICAgICBlZGl0QnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2J0bi1wcmltYXJ5Jyk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGNtc0Vycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWZXJpZnkgRW1haWxdIEVycmV1ciBsb3JzIGRlIGxhIGNvbmZpZ3VyYXRpb24gQ01TOicsIGNtc0Vycm9yKTtcbiAgICAgICAgaWYgKGVycm9yTWVzc2FnZSkge1xuICAgICAgICAgIGVycm9yTWVzc2FnZS50ZXh0Q29udGVudCA9ICdFbWFpbCB2XHUwMEU5cmlmaVx1MDBFOSBtYWlzIGVycmV1ciBsb3JzIGRlIGxhIGNvbmZpZ3VyYXRpb24gZHUgY29tcHRlLiBWZXVpbGxleiB2b3VzIHJlY29ubmVjdGVyLic7XG4gICAgICAgIH1cbiAgICAgICAgc2hvd1N0YXRlKCdlcnJvcicpO1xuICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWZXJpZnkgRW1haWxdIEVycmV1ciBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcblxuICAgICAgLy8gQW5hbHlzZXIgbGUgdHlwZSBkJ2VycmV1clxuICAgICAgaWYgKGVycm9yLmNvZGUgPT09IDQwMSB8fCBlcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnaW52YWxpZCcpIHx8IGVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdleHBpcmVkJykpIHtcbiAgICAgICAgLy8gTGllbiBpbnZhbGlkZSBvdSBleHBpclx1MDBFOVxuICAgICAgICBzaG93U3RhdGUoJ2V4cGlyZWQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF1dHJlIGVycmV1clxuICAgICAgICBpZiAoZXJyb3JNZXNzYWdlKSB7XG4gICAgICAgICAgZXJyb3JNZXNzYWdlLnRleHRDb250ZW50ID0gZXJyb3IubWVzc2FnZSB8fCAnVW5lIGVycmV1ciBpbmF0dGVuZHVlIGVzdCBzdXJ2ZW51ZSBsb3JzIGRlIGxhIHZcdTAwRTlyaWZpY2F0aW9uLic7XG4gICAgICAgIH1cbiAgICAgICAgc2hvd1N0YXRlKCdlcnJvcicpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIC0tLSBHRVNUSU9OIERVIEJPVVRPTiBSXHUwMEM5RVNTQVlFUiAtLS1cbiAgaWYgKHJldHJ5QnV0dG9uKSB7XG4gICAgcmV0cnlCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICByZXRyeUJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBpZiAocmV0cnlTcGlubmVyKSByZXRyeVNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgc2hvd1N0YXRlKCdsb2FkaW5nJyk7XG5cbiAgICAgIGF3YWl0IGF0dGVtcHRWZXJpZmljYXRpb24oKTtcblxuICAgICAgcmV0cnlCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgIGlmIChyZXRyeVNwaW5uZXIpIHJldHJ5U3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gLS0tIExPR0lRVUUgUFJJTkNJUEFMRSAtLS1cblxuICAvLyBWXHUwMEU5cmlmaWVyIGxhIHByXHUwMEU5c2VuY2UgZGVzIHBhcmFtXHUwMEU4dHJlcyByZXF1aXNcbiAgaWYgKCF1c2VySWQgfHwgIXNlY3JldCkge1xuICAgIGNvbnNvbGUud2FybignW1ZlcmlmeSBFbWFpbF0gUGFyYW1cdTAwRTh0cmVzIG1hbnF1YW50cyAtIHVzZXJJZDonLCAhIXVzZXJJZCwgJ3NlY3JldDonLCAhIXNlY3JldCk7XG4gICAgaWYgKGVycm9yTWVzc2FnZSkge1xuICAgICAgZXJyb3JNZXNzYWdlLnRleHRDb250ZW50ID0gJ0xpZW4gZGUgdlx1MDBFOXJpZmljYXRpb24gaW52YWxpZGUuIExlcyBwYXJhbVx1MDBFOHRyZXMgcmVxdWlzIHNvbnQgbWFucXVhbnRzLic7XG4gICAgfVxuICAgIHNob3dTdGF0ZSgnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBdHRlbmRyZSB1biBjb3VydCBkXHUwMEU5bGFpIHBvdXIgbCdhbmltYXRpb24gZGUgY2hhcmdlbWVudFxuICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBhdHRlbXB0VmVyaWZpY2F0aW9uKCk7XG4gIH0sIDUwMCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQW9CQSxXQUFTLGdCQUFnQixjQUFjLElBQUksV0FBVyxLQUFLO0FBQ3ZELFdBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLFVBQUksV0FBVztBQUVmLGVBQVMsZ0JBQWdCO0FBQ3JCO0FBR0EsWUFBSSxPQUFPLFlBQVksT0FBTyxTQUFTLFVBQVUsT0FBTyxTQUFTLFNBQVM7QUFFdEUsa0JBQVE7QUFBQSxRQUNaLFdBQVcsWUFBWSxhQUFhO0FBQ2hDLGtCQUFRLE1BQU0sdUZBQWlGO0FBQy9GLGlCQUFPLElBQUksTUFBTSwrQ0FBeUMsQ0FBQztBQUFBLFFBQy9ELE9BQU87QUFDSCxxQkFBVyxlQUFlLFFBQVE7QUFBQSxRQUN0QztBQUFBLE1BQ0o7QUFFQSxvQkFBYztBQUFBLElBQ2xCLENBQUM7QUFBQSxFQUNMO0FBTUEsaUJBQWUscUJBQXFCO0FBRWhDLFFBQUksVUFBVSxXQUFXLFdBQVc7QUFDaEMsY0FBUSxJQUFJLHVFQUEyRDtBQUN2RSxhQUFPLEVBQUUsUUFBUSxTQUFTLFVBQVU7QUFBQSxJQUN4QztBQUdBLFFBQUksdUJBQXVCO0FBQ3ZCLGNBQVEsSUFBSSx1REFBdUQ7QUFDbkUsYUFBTztBQUFBLElBQ1g7QUFHQSw2QkFBeUIsWUFBWTtBQUNqQyxVQUFJO0FBQ0EsZ0JBQVEsSUFBSSxnREFBNkM7QUFHekQsY0FBTSxnQkFBZ0I7QUFHdEIsY0FBTSxFQUFFLFFBQVEsU0FBUyxVQUFVLElBQUksT0FBTztBQUU5QyxpQkFBUyxJQUFJLE9BQU8sRUFDZixZQUFZLGlCQUFpQixFQUM3QixXQUFXLG1CQUFtQjtBQUVuQyxrQkFB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QUFBQSxRQUNuQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBR0EsUUFBSSxhQUFhO0FBQ2Ysa0JBQVksaUJBQWlCLFNBQVMsWUFBWTtBQUNoRCxvQkFBWSxXQUFXO0FBQ3ZCLFlBQUksYUFBYyxjQUFhLE1BQU0sVUFBVTtBQUMvQyxrQkFBVSxTQUFTO0FBRW5CLGNBQU0sb0JBQW9CO0FBRTFCLG9CQUFZLFdBQVc7QUFDdkIsWUFBSSxhQUFjLGNBQWEsTUFBTSxVQUFVO0FBQUEsTUFDakQsQ0FBQztBQUFBLElBQ0g7QUFLQSxRQUFJLENBQUMsVUFBVSxDQUFDLFFBQVE7QUFDdEIsY0FBUSxLQUFLLG9EQUFpRCxDQUFDLENBQUMsUUFBUSxXQUFXLENBQUMsQ0FBQyxNQUFNO0FBQzNGLFVBQUksY0FBYztBQUNoQixxQkFBYSxjQUFjO0FBQUEsTUFDN0I7QUFDQSxnQkFBVSxPQUFPO0FBQ2pCO0FBQUEsSUFDRjtBQUdBLGVBQVcsWUFBWTtBQUNyQixZQUFNLG9CQUFvQjtBQUFBLElBQzVCLEdBQUcsR0FBRztBQUFBLEVBQ1IsQ0FBQzsiLAogICJuYW1lcyI6IFsiYWNjb3VudCIsICJmdW5jdGlvbnMiLCAiQVBQV1JJVEVfRlVOQ1RJT05fSUQiLCAiYWNjb3VudCIsICJnZXRGdW5jdGlvbnMiLCAiZnVuY3Rpb25zIl0KfQo=

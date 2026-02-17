(() => {
  // ns-hugo-imp:/home/geo/.cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/encas-parka/hugo-cookbook-theme@v0.0.0-20251204214933-25586c2e961b/assets/js/appwrite-client.js
  var APPWRITE_ENDPOINT = "https://cloud.appwrite.io/v1";
  var APPWRITE_PROJECT_ID = "689725820024e81781b7";
  var APPWRITE_FUNCTION_ID = "68976500002eb5c6ee4f";
  var ACCESS_REQUEST_FUNCTION_ID = "689cdea5001a4d74549d";
  var client = null;
  var account = null;
  var functions = null;
  var initializationPromise = null;
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

  // <stdin>
  var { APPWRITE_FUNCTION_ID: APPWRITE_FUNCTION_ID2 } = getConfig();
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
      APPWRITE_FUNCTION_ID2,
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
      const teams = await getTeams();
      await teams.updateMembershipStatus(teamId, membershipId, userId, secret);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzIiwgIjxzdGRpbj4iXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FwcHdyaXRlLWNsaWVudC5qc1xuLy8gTW9kdWxlIGNvbW11biBwb3VyIGwnaW5pdGlhbGlzYXRpb24gZXQgbGEgZ2VzdGlvbiBkdSBjbGllbnQgQXBwd3JpdGVcbi8vIFx1MDBDOXZpdGUgbGEgZHVwbGljYXRpb24gZCdpbml0aWFsaXNhdGlvbiBlbnRyZSBhdXRoLXN0YXR1cy5qcyBldCBhdXRoQXBwd3JpdGUuanNcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9jbG91ZC5hcHB3cml0ZS5pby92MVwiO1xuY29uc3QgQVBQV1JJVEVfUFJPSkVDVF9JRCA9IFwiNjg5NzI1ODIwMDI0ZTgxNzgxYjdcIjtcbmNvbnN0IEFQUFdSSVRFX0ZVTkNUSU9OX0lEID0gXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC1mdW5jdGlvblxuY29uc3QgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQgPSBcIjY4OWNkZWE1MDAxYTRkNzQ1NDlkXCI7IC8vIElEIGRlIGxhIGZvbmN0aW9uIGQnZW52b2kgZCdlbWFpbFxuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cbi8qKlxuICogQXR0ZW5kIHF1ZSBsZSBTREsgQXBwd3JpdGUgc29pdCBjaGFyZ1x1MDBFOSBldCBpbml0aWFsaXNlIGxlcyBjbGllbnRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBxdWkgc2Ugclx1MDBFOXNvdXQgcXVhbmQgbCdpbml0aWFsaXNhdGlvbiBlc3QgdGVybWluXHUwMEU5ZVxuICovXG5mdW5jdGlvbiB3YWl0Rm9yQXBwd3JpdGUobWF4QXR0ZW1wdHMgPSA1MCwgaW50ZXJ2YWwgPSAxMDApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrQXBwd3JpdGUoKSB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIFZcdTAwRTlyaWZpY2F0aW9uIFNESyAtIHRlbnRhdGl2ZSAke2F0dGVtcHRzfS8ke21heEF0dGVtcHRzfWApO1xuXG4gICAgICAgICAgICBpZiAod2luZG93LkFwcHdyaXRlICYmIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiYgd2luZG93LkFwcHdyaXRlLkFjY291bnQpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBjaGFyZ1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdHMgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSBhcHJcdTAwRThzIGxlIG5vbWJyZSBtYXhpbXVtIGRlIHRlbnRhdGl2ZXNcIik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkxlIFNESyBBcHB3cml0ZSBuJ2EgcGFzIHB1IFx1MDBFQXRyZSBjaGFyZ1x1MDBFOS5cIikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrQXBwd3JpdGUoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXNlIGxlcyBjbGllbnRzIEFwcHdyaXRlICh1bmUgc2V1bGUgZm9pcylcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9uc30+fSBMZXMgY2xpZW50cyBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHB3cml0ZSgpIHtcbiAgICAvLyBTaSBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTksIHJldG91cm5lciBsZXMgY2xpZW50cyBleGlzdGFudHNcbiAgICBpZiAoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQ2xpZW50cyBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzLCByXHUwMEU5dXRpbGlzYXRpb25cIik7XG4gICAgICAgIHJldHVybiB7IGNsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zIH07XG4gICAgfVxuXG4gICAgLy8gU2kgdW5lIGluaXRpYWxpc2F0aW9uIGVzdCBlbiBjb3VycywgYXR0ZW5kcmUgcXUnZWxsZSBzZSB0ZXJtaW5lXG4gICAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGVuIGNvdXJzLCBhdHRlbnRlLi4uXCIpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xuICAgIH1cblxuICAgIC8vIENvbW1lbmNlciB1bmUgbm91dmVsbGUgaW5pdGlhbGlzYXRpb25cbiAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEXHUwMEU5YnV0IGRlIGwnaW5pdGlhbGlzYXRpb25cIik7XG5cbiAgICAgICAgICAgIC8vIEF0dGVuZHJlIHF1ZSBsZSBTREsgc29pdCBjaGFyZ1x1MDBFOVxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckFwcHdyaXRlKCk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzXG4gICAgICAgICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgICAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChBUFBXUklURV9FTkRQT0lOVClcbiAgICAgICAgICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9QUk9KRUNUX0lEKTtcblxuICAgICAgICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICAgICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgdmFyaWFibGVzIGVuIGNhcyBkJ2VycmV1clxuICAgICAgICAgICAgY2xpZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGFjY291bnQgPSBudWxsO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbnVsbDtcbiAgICAgICAgICAgIGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgQXBwd3JpdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXBwd3JpdGVDbGllbnRzKCkge1xuICAgIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgQWNjb3VudFxuICogQHJldHVybnMge1Byb21pc2U8QWNjb3VudD59IExlIGNsaWVudCBBY2NvdW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFjY291bnQoKSB7XG4gICAgY29uc3QgeyBhY2NvdW50IH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIHJcdTAwRTl1c3NpZVwiLCBhY2NvdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgXHUwMEU5Y2hvdVx1MDBFOWVcIik7XG4gICAgfVxuICAgIHJldHVybiBhY2NvdW50O1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBGdW5jdGlvbnNcbiAqIEByZXR1cm5zIHtQcm9taXNlPEZ1bmN0aW9ucz59IExlIGNsaWVudCBGdW5jdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25zKCkge1xuICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICByZXR1cm4gZnVuY3Rpb25zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBUZWFtc1xuICogQHJldHVybnMge1Byb21pc2U8VGVhbXM+fSBMZSBjbGllbnQgVGVhbXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0VGVhbXMoKSB7XG4gICAgY29uc3QgeyBDbGllbnQsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgfVxuICAgIGNvbnN0IHRlYW1zID0gbmV3IFRlYW1zKGNsaWVudCk7XG4gICAgcmV0dXJuIHRlYW1zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY29uc3RhbnRlcyBkZSBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBDb25maWd1cmF0aW9uIEFwcHdyaXRlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICAgIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEXG4gICAgfTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGVzIGNsaWVudHMgc29udCBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsZXMgY2xpZW50cyBzb250IGluaXRpYWxpc1x1MDBFOXNcbiAqL1xuZnVuY3Rpb24gaXNJbml0aWFsaXplZCgpIHtcbiAgICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdhdXRoZW50aWZpY2F0aW9uIENNUyBsb2NhbGUgKHNvdXJjZSBkZSB2XHUwMEU5cml0XHUwMEU5IHByaW5jaXBhbGUpXG4gKiBAcmV0dXJucyB7b2JqZWN0fG51bGx9IEwnb2JqZXQgdXRpbGlzYXRldXIgcydpbCBlc3QgdmFsaWRlLCBzaW5vbiBudWxsXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAvLyBjb25zb2xlLmxvZygnXHVEODNEXHVERDBEIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIGJydXQgZGVwdWlzIGxvY2FsU3RvcmFnZTonLCBjbXNVc2VyKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICBjb25zb2xlLmxvZygnXHUyMTM5XHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIEF1Y3VuIHRva2VuIENNUyBkYW5zIGxvY2FsU3RvcmFnZScpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBwYXJzXHUwMEU5OicsIHtcbiAgICAgICAgICAvLyAgICAgaGFzVG9rZW46ICEhcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5UeXBlOiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5MZW5ndGg6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgLy8gICAgIHRva2VuUHJldmlldzogcGFyc2VkVXNlci50b2tlbiA/IHBhcnNlZFVzZXIudG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogJ04vQScsXG4gICAgICAgICAgLy8gICAgIGhhc0lkOiAhIXBhcnNlZFVzZXIuaWQsXG4gICAgICAgICAgLy8gICAgIGhhc0VtYWlsOiAhIXBhcnNlZFVzZXIuZW1haWwsXG4gICAgICAgICAgLy8gICAgIGJhY2tlbmROYW1lOiBwYXJzZWRVc2VyLmJhY2tlbmROYW1lXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGlmIChwYXJzZWRVc2VyLnRva2VuICYmIHR5cGVvZiBwYXJzZWRVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJiBwYXJzZWRVc2VyLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gQ01TIHZhbGlkZScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyBpbnZhbGlkZSAtIG5ldHRveWFnZScpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignXHUyNzRDIFtnZXRMb2NhbENtc1VzZXJdIERvbm5cdTAwRTllcyBDTVMgY29ycm9tcHVlcyBkYW5zIGxvY2FsU3RvcmFnZS4gTmV0dG95YWdlLi4uJywgZSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOSAoYmFzXHUwMEU5IHN1ciBsZSB0b2tlbiBDTVMpXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gKi9cbmZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZENtcygpIHtcbiAgY29uc29sZS5sb2coJ2dldExvY2FsQ21zVXNlcigpOiAnLCBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbCk7XG4gICAgcmV0dXJuIGdldExvY2FsQ21zVXNlcigpICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgZ2V0QWNjb3VudFxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZXN0IHZcdTAwRTlyaWZpXHUwMEU5XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBzaSBsJ2VtYWlsIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICovXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgIHJldHVybiB1c2VyLmVtYWlsVmVyaWZpY2F0aW9uIHx8IGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBJbXBvc3NpYmxlIGRlIHZcdTAwRTlyaWZpZXIgbFxcJ1x1MDBFOXRhdCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBkXFwnZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEVudm9pZSB1biBlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBcdTAwRTAgbCd1dGlsaXNhdGV1ciBjb25uZWN0XHUwMEU5XG4gKiBAcGFyYW0ge3N0cmluZ30gcmVkaXJlY3RVUkwgLSBVUkwgdmVycyBsYXF1ZWxsZSByZWRpcmlnZXIgYXByXHUwMEU4cyB2XHUwMEU5cmlmaWNhdGlvblxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb25VUkwgPSByZWRpcmVjdFVSTCB8fCBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS92ZXJpZnktZW1haWxgO1xuICAgICAgICBhd2FpdCBhY2NvdW50LmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FwcHdyaXRlQ2xpZW50XSBFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBlbnZveVx1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBsJ2VtYWlsIGF2ZWMgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSB2XHUwMEU5cmlmaWNhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWNyZXQgLSBTZWNyZXQgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgdlx1MDBFOXJpZmlcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gY29tcGxldCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fSBcdTAwQzl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGF2ZWMgdlx1MDBFOXJpZmljYXRpb24gZW1haWxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRpb25TdGF0ZSgpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgY29uc3QgdXNlckVtYWlsID0gZ2V0VXNlckVtYWlsKCk7XG4gICAgY29uc3QgdXNlck5hbWUgPSBnZXRVc2VyTmFtZSgpO1xuXG4gICAgaWYgKCFjbXNVc2VyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZW1haWxWZXJpZmllZCxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxcXCdcdTAwRTl0YXQgZFxcJ2F1dGhlbnRpZmljYXRpb246JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZGVwdWlzIGxlIGxvY2FsU3RvcmFnZVxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyRW1haWwoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIGxlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpIDtcbn1cblxuXG4vKipcbiAqIE5ldHRvaWUgdG91dGVzIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJBdXRoRGF0YSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJyk7XG4gICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXMgbmV0dG95XHUwMEU5ZXNcIik7XG59XG5cbi8qKlxuICogRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIC0gc3VwcHJpbWUgbGEgc2Vzc2lvbiBBcHB3cml0ZSBldCBuZXR0b2llIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBOZXR0b3llciBkJ2Fib3JkIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG5cbiAgICAgICAgLy8gU3VwcHJpbWVyIGxhIHNlc3Npb24gQXBwd3JpdGVcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKCdjdXJyZW50Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIHJcdTAwRTl1c3NpZVwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsIGVycm9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBMZSBub20gZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtvYmplY3R9IGNtc0F1dGggLSBMJ29iamV0IGQnYXV0aGVudGlmaWNhdGlvbiBDTVNcbiAqL1xuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIGVtYWlsKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJywgbmFtZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8vIEV4cG9ydCBkZXMgZm9uY3Rpb25zIHB1YmxpcXVlc1xuZXhwb3J0IHtcbiAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgZ2V0QWNjb3VudCxcbiAgICBnZXRGdW5jdGlvbnMsXG4gICAgZ2V0VGVhbXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMgLFxuICAgIGdldFVzZXJFbWFpbCxcbiAgICBnZXRVc2VyTmFtZSxcbiAgICBjbGVhckF1dGhEYXRhLFxuICAgIHNldEF1dGhEYXRhLFxuICAgIGxvZ291dEdsb2JhbCxcbiAgICBpc0VtYWlsVmVyaWZpZWQsXG4gICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgIHZlcmlmeUVtYWlsLFxuICAgIGdldExvY2FsRW1haWxWZXJpZmljYXRpb25TdGF0dXNcbn07XG5cblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgICAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgICAgIGdldEFjY291bnQsXG4gICAgICAgIGdldEZ1bmN0aW9ucyxcbiAgICAgICAgZ2V0VGVhbXMsXG4gICAgICAgIGdldENvbmZpZyxcbiAgICAgICAgaXNJbml0aWFsaXplZCxcbiAgICAgICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgICAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZENtcyxcbiAgICAgICAgZ2V0VXNlckVtYWlsLFxuICAgICAgICBnZXRVc2VyTmFtZSxcbiAgICAgICAgY2xlYXJBdXRoRGF0YSxcbiAgICAgICAgc2V0QXV0aERhdGEsXG4gICAgICAgIGxvZ291dEdsb2JhbCxcbiAgICAgICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgICAgICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gICAgICAgIHZlcmlmeUVtYWlsLFxuICAgICAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG4gICAgfTtcbn1cbiIsICIvLyBodWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9hY2NlcHQtaW52aXRhdGlvbi5qc1xuLy8gQ2Ugc2NyaXB0IGdcdTAwRThyZSBsYSBsb2dpcXVlIGRlIGxhIHBhZ2UgZCdhY2NlcHRhdGlvbiBkJ2ludml0YXRpb24gZW4gdXRpbGlzYW50IGwnQVBJIFRlYW1zIGQnQXBwd3JpdGVcbi8vIEV0IGxhIGZpbmFsaXNhdGlvbiBkdSBjb21wdGUgYXZlYyBsYSBkXHUwMEU5ZmluaXRpb24gZHUgbW90IGRlIHBhc3NlLlxuXG5pbXBvcnQgeyBnZXRBY2NvdW50LCBnZXRUZWFtcywgZ2V0RnVuY3Rpb25zLCBnZXRDb25maWcsIHNldEF1dGhEYXRhLCBjbGVhckF1dGhEYXRhIH0gZnJvbSAnLi9hcHB3cml0ZS1jbGllbnQuanMnO1xuXG4vLyBSXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxhIGNvbmZpZ3VyYXRpb25cbmNvbnN0IHsgQVBQV1JJVEVfRlVOQ1RJT05fSUQgfSA9IGdldENvbmZpZygpO1xuXG4vLyBJRCBkZSBsJ1x1MDBFOXF1aXBlIGRlIGNvbnRyaWJ1dGV1cnNcbmNvbnN0IFRFQU1fSUQgPSBcIjY4OWJmNmZlMDAwNjYyN2Q4OTU5XCI7XG5cbi8vIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgXHUwMEU5bFx1MDBFOW1lbnRzIGR1IERPTVxuY29uc3QgbG9hZGluZ1N0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJhY2NlcHQtaW52aXRhdGlvbi1sb2FkaW5nXCIpO1xuY29uc3QgZXJyb3JTdGF0ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYWNjZXB0LWludml0YXRpb24tZXJyb3JcIik7XG5jb25zdCBzdWNjZXNzU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImFjY2VwdC1pbnZpdGF0aW9uLXN1Y2Nlc3NcIik7XG5jb25zdCBlcnJvck1lc3NhZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImVycm9yLW1lc3NhZ2VcIik7XG5cbi8vIFNlY3Rpb24gZXQgZm9ybXVsYWlyZSBwb3VyIGxlIG1vdCBkZSBwYXNzZVxuY29uc3Qgc2V0UGFzc3dvcmRTZWN0aW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NldC1wYXNzd29yZC1zZWN0aW9uJyk7XG5jb25zdCBzZXRQYXNzd29yZEZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0LXBhc3N3b3JkLWZvcm0nKTtcbmNvbnN0IG5ld1Bhc3N3b3JkSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbmV3LXBhc3N3b3JkJyk7XG5jb25zdCBjb25maXJtUGFzc3dvcmRJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLXBhc3N3b3JkJyk7XG5jb25zdCBzZXRQYXNzd29yZEVycm9yID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NldC1wYXNzd29yZC1lcnJvcicpO1xuY29uc3Qgc2V0UGFzc3dvcmRCdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0LXBhc3N3b3JkLWJ1dHRvbicpO1xuY29uc3Qgc2V0UGFzc3dvcmRTcGlubmVyID0gc2V0UGFzc3dvcmRCdXR0b24/LnF1ZXJ5U2VsZWN0b3IoJy5zcGlubmVyLWJvcmRlcicpO1xuY29uc3QgZmluYWxTdWNjZXNzTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaW5hbC1zdWNjZXNzLW1lc3NhZ2UnKTtcblxuLyoqXG4gKiBBZmZpY2hlIHVuIFx1MDBFOXRhdCBkZSBsJ1VJIGV0IG1hc3F1ZSBsZXMgYXV0cmVzLlxuICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlIC0gTCdcdTAwRTl0YXQgXHUwMEUwIGFmZmljaGVyICgnbG9hZGluZycsICdlcnJvcicsICdzdWNjZXNzJywgJ3NldFBhc3N3b3JkJylcbiAqL1xuZnVuY3Rpb24gc2hvd1VJU3RhdGUoc3RhdGUpIHtcbiAgaWYgKGxvYWRpbmdTdGF0ZSkgbG9hZGluZ1N0YXRlLnN0eWxlLmRpc3BsYXkgPSAoc3RhdGUgPT09ICdsb2FkaW5nJykgPyAnYmxvY2snIDogJ25vbmUnO1xuICBpZiAoZXJyb3JTdGF0ZSkgZXJyb3JTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gKHN0YXRlID09PSAnZXJyb3InKSA/ICdibG9jaycgOiAnbm9uZSc7XG5cbiAgLy8gTGUgc3VjY1x1MDBFOHMgZGUgbCdpbnZpdGF0aW9uIGV0IGxlIGZvcm11bGFpcmUgZGUgbW90IGRlIHBhc3NlIHNvbnQgbGlcdTAwRTlzXG4gIGNvbnN0IGlzU3VjY2Vzc1N0YXRlID0gKHN0YXRlID09PSAnc3VjY2VzcycgfHwgc3RhdGUgPT09ICdzZXRQYXNzd29yZCcpO1xuICBpZiAoc3VjY2Vzc1N0YXRlKSBzdWNjZXNzU3RhdGUuc3R5bGUuZGlzcGxheSA9IGlzU3VjY2Vzc1N0YXRlID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgaWYgKHNldFBhc3N3b3JkU2VjdGlvbikgc2V0UGFzc3dvcmRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSAoc3RhdGUgPT09ICdzZXRQYXNzd29yZCcpID8gJ2Jsb2NrJyA6ICdub25lJztcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSByZXF1XHUwMEVBdGUgZGUgbCdVUkxcbiAqIEByZXR1cm5zIHtVUkxTZWFyY2hQYXJhbXN9IC0gTGVzIHBhcmFtXHUwMEU4dHJlcyBkZSByZXF1XHUwMEVBdGVcbiAqL1xuZnVuY3Rpb24gZ2V0UXVlcnlQYXJhbXMoKSB7XG4gIHJldHVybiBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufVxuXG4vKipcbiAqIENvbmZpZ3VyZSBsJ2F1dGhlbnRpZmljYXRpb24gZHUgQ01TIGVuIGFwcGVsYW50IGxhIGZvbmN0aW9uIEFwcHdyaXRlLlxuICogTFx1MDBFOHZlIHVuZSBleGNlcHRpb24gZW4gY2FzIGQnZXJyZXVyLlxuICovXG5hc3luYyBmdW5jdGlvbiBzZXR1cENtc0F1dGhlbnRpY2F0aW9uKCkge1xuICAvLyBjb25zb2xlLmxvZyhcIkFwcGVsIGRlIGxhIGZvbmN0aW9uIEFwcHdyaXRlIHBvdXIgb2J0ZW5pciBsZSB0b2tlbiBDTVMuLi5cIik7XG5cbiAgY29uc3QgZnVuY3Rpb25zID0gYXdhaXQgZ2V0RnVuY3Rpb25zKCk7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICBBUFBXUklURV9GVU5DVElPTl9JRCxcbiAgICAnJywgLy8gTGUgY29ycHMgZGUgbGEgcmVxdVx1MDBFQXRlIGVzdCB2aWRlXG4gICAgZmFsc2VcbiAgKTtcblxuICBpZiAocmVzcG9uc2UucmVzcG9uc2VTdGF0dXNDb2RlICE9PSAyMDApIHtcbiAgICBsZXQgc2VydmVyRXJyb3IgPSByZXNwb25zZS5yZXNwb25zZUJvZHk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhcnNlZEJvZHkgPSBKU09OLnBhcnNlKHJlc3BvbnNlLnJlc3BvbnNlQm9keSk7XG4gICAgICBpZiAocGFyc2VkQm9keS5lcnJvcikgc2VydmVyRXJyb3IgPSBwYXJzZWRCb2R5LmVycm9yO1xuICAgIH0gY2F0Y2ggKHBfZXJyKSB7IC8qIGlnbm9yZSAqLyB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJldXIgZGUgbGEgZm9uY3Rpb24gQ01TICgke3Jlc3BvbnNlLnJlc3BvbnNlU3RhdHVzQ29kZX0pOiAke3NlcnZlckVycm9yfWApO1xuICB9XG5cbiAgY29uc3QgY21zQXV0aCA9IEpTT04ucGFyc2UocmVzcG9uc2UucmVzcG9uc2VCb2R5KTtcbiAgLy8gc2V0QXV0aERhdGEgc2VyYSBhcHBlbFx1MDBFOSBhdmVjIGwnZW1haWwgZGVwdWlzIGwnZXh0XHUwMEU5cmlldXJcbiAgcmV0dXJuIGNtc0F1dGg7XG59XG5cbi8qKlxuICogTWV0IFx1MDBFMCBqb3VyIGxlIG1vdCBkZSBwYXNzZSBkZSBsJ3V0aWxpc2F0ZXVyIGFjdHVlbGxlbWVudCBhdXRoZW50aWZpXHUwMEU5LlxuICogR1x1MDBFOHJlIGxhIHZhbGlkYXRpb24gZW4gaW50ZXJuZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBuZXdQYXNzd29yZCAtIExlIG5vdXZlYXUgbW90IGRlIHBhc3NlLlxuICogQHBhcmFtIHtzdHJpbmd9IGNvbmZpcm1QYXNzd29yZCAtIExhIGNvbmZpcm1hdGlvbiBkdSBtb3QgZGUgcGFzc2UuXG4gKiBAdGhyb3dzIHtFcnJvcn0gc2kgbGEgdmFsaWRhdGlvbiBcdTAwRTljaG91ZSBvdSBzaSBsJ0FQSSBBcHB3cml0ZSByZW52b2llIHVuZSBlcnJldXIuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVVzZXJQYXNzd29yZChuZXdQYXNzd29yZCwgY29uZmlybVBhc3N3b3JkKSB7XG4gIGlmICghbmV3UGFzc3dvcmQgfHwgbmV3UGFzc3dvcmQubGVuZ3RoIDwgOCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlIG1vdCBkZSBwYXNzZSBkb2l0IGNvbnRlbmlyIGF1IG1vaW5zIDggY2FyYWN0XHUwMEU4cmVzLlwiKTtcbiAgfVxuICBpZiAobmV3UGFzc3dvcmQgIT09IGNvbmZpcm1QYXNzd29yZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkxlcyBtb3RzIGRlIHBhc3NlIG5lIGNvcnJlc3BvbmRlbnQgcGFzLlwiKTtcbiAgfVxuXG4gIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gIC8vIEwnYXBwZWwgXHUwMEUwIGwnQVBJIGVzdCBkXHUwMEU5alx1MDBFMCBkYW5zIHVuIGNvbnRleHRlIGF1dGhlbnRpZmlcdTAwRTlcbiAgYXdhaXQgYWNjb3VudC51cGRhdGVQYXNzd29yZChuZXdQYXNzd29yZCk7XG4gIC8vIGNvbnNvbGUubG9nKFwiTGUgbW90IGRlIHBhc3NlIGRlIGwndXRpbGlzYXRldXIgYSBcdTAwRTl0XHUwMEU5IG1pcyBcdTAwRTAgam91ciBhdmVjIHN1Y2NcdTAwRThzLlwiKTtcbn1cblxuLyoqXG4gKiBBY2NlcHRlIGwnaW52aXRhdGlvbiBldCwgZW4gY2FzIGRlIHN1Y2NcdTAwRThzLCBhZmZpY2hlIGxlIGZvcm11bGFpcmUgZGUgbW90IGRlIHBhc3NlLlxuICovXG5hc3luYyBmdW5jdGlvbiBhY2NlcHRJbnZpdGF0aW9uKCkge1xuICBzaG93VUlTdGF0ZSgnbG9hZGluZycpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcXVlcnlQYXJhbXMgPSBnZXRRdWVyeVBhcmFtcygpO1xuICAgIGNvbnN0IHRlYW1JZCA9IHF1ZXJ5UGFyYW1zLmdldCgndGVhbUlkJyk7XG4gICAgY29uc3QgbWVtYmVyc2hpcElkID0gcXVlcnlQYXJhbXMuZ2V0KCdtZW1iZXJzaGlwSWQnKTtcbiAgICBjb25zdCB1c2VySWQgPSBxdWVyeVBhcmFtcy5nZXQoJ3VzZXJJZCcpO1xuICAgIGNvbnN0IHNlY3JldCA9IHF1ZXJ5UGFyYW1zLmdldCgnc2VjcmV0Jyk7XG5cbiAgICBpZiAoIXRlYW1JZCB8fCAhbWVtYmVyc2hpcElkIHx8ICF1c2VySWQgfHwgIXNlY3JldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyYW1cdTAwRTh0cmVzIGQnaW52aXRhdGlvbiBtYW5xdWFudHMgZGFucyBsJ1VSTC5cIik7XG4gICAgfVxuICAgIGlmICh0ZWFtSWQgIT09IFRFQU1fSUQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNldHRlIGludml0YXRpb24gbidlc3QgcGFzIHZhbGlkZSBwb3VyIGNldHRlIGFwcGxpY2F0aW9uLlwiKTtcbiAgICB9XG5cbiAgICAvLyBBY2NlcHRlIGwnaW52aXRhdGlvbiBzYW5zIGF1dGhlbnRpZmljYXRpb24gcHJcdTAwRTlhbGFibGUuXG4gICAgLy8gTGUgc2VjcmV0IGRlIGwnaW52aXRhdGlvbiBzZXJ0IGQnYXV0aGVudGlmaWNhdGlvbiB0ZW1wb3JhaXJlLlxuICAgIC8vIGNvbnNvbGUubG9nKFwiQWNjZXB0YXRpb24gZGUgbCdpbnZpdGF0aW9uOlwiLCB7IHRlYW1JZCwgbWVtYmVyc2hpcElkLCB1c2VySWQsIHNlY3JldCB9KTtcbiAgICBcbiAgICBjb25zdCB0ZWFtcyA9IGF3YWl0IGdldFRlYW1zKCk7XG4gICAgYXdhaXQgdGVhbXMudXBkYXRlTWVtYmVyc2hpcFN0YXR1cyh0ZWFtSWQsIG1lbWJlcnNoaXBJZCwgdXNlcklkLCBzZWNyZXQpO1xuXG4gICAgLy8gQXByXHUwMEU4cyBhY2NlcHRhdGlvbiwgdW5lIHNlc3Npb24gZXN0IGNyXHUwMEU5XHUwMEU5ZS4gUlx1MDBFOWN1cFx1MDBFOXJlciBsZXMgaW5mb3MgdXRpbGlzYXRldXIuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgYWNjb3VudC5nZXQoKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIHVzZXIuZW1haWwpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhcHB3cml0ZS11c2VyLW5hbWUnLCB1c2VyLm5hbWUpO1xuXG4gICAgLy8gQWZmaWNoZSBsZSBtZXNzYWdlIGRlIHN1Y2NcdTAwRThzIGV0IGxlIGZvcm11bGFpcmUgcG91ciBkXHUwMEU5ZmluaXIgbGUgbW90IGRlIHBhc3NlXG4gICAgc2hvd1VJU3RhdGUoJ3NldFBhc3N3b3JkJyk7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyZXVyIGxvcnMgZGUgbCdhY2NlcHRhdGlvbiBkZSBsJ2ludml0YXRpb246XCIsIGVycm9yKTtcbiAgICBsZXQgZXJyb3JNc2cgPSBcIlVuZSBlcnJldXIgZXN0IHN1cnZlbnVlIGxvcnMgZHUgdHJhaXRlbWVudCBkZSB2b3RyZSBpbnZpdGF0aW9uLlwiO1xuICAgIFxuICAgIGlmIChlcnJvci5jb2RlID09PSA0MDEpIHtcbiAgICAgIGVycm9yTXNnID0gXCJDZXR0ZSBpbnZpdGF0aW9uIG4nZXN0IHBhcyB2YWxpZGUgb3UgYSBleHBpclx1MDBFOS5cIjtcbiAgICB9IGVsc2UgaWYgKGVycm9yLmNvZGUgPT09IDQwNCkge1xuICAgICAgZXJyb3JNc2cgPSBcIkNldHRlIGludml0YXRpb24gbidleGlzdGUgcGFzIG91IGEgZXhwaXJcdTAwRTkuXCI7XG4gICAgfSBlbHNlIGlmIChlcnJvci5jb2RlID09PSA0MDkpIHtcbiAgICAgIGVycm9yTXNnID0gXCJDZXR0ZSBpbnZpdGF0aW9uIGEgZFx1MDBFOWpcdTAwRTAgXHUwMEU5dFx1MDBFOSBhY2NlcHRcdTAwRTllLlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZSkge1xuICAgICAgZXJyb3JNc2cgPSBlcnJvci5tZXNzYWdlO1xuICAgIH1cblxuICAgIGlmIChlcnJvck1lc3NhZ2UpIGVycm9yTWVzc2FnZS50ZXh0Q29udGVudCA9IGVycm9yTXNnO1xuICAgIHNob3dVSVN0YXRlKCdlcnJvcicpO1xuXG4gIH1cbn1cblxuLyoqXG4gKiBHXHUwMEU4cmUgbGEgc291bWlzc2lvbiBkdSBmb3JtdWxhaXJlIGRlIG1vdCBkZSBwYXNzZS5cbiAqL1xuaWYgKHNldFBhc3N3b3JkRm9ybSkge1xuICBzZXRQYXNzd29yZEZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgYXN5bmMgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgc2V0UGFzc3dvcmRFcnJvci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIHNldFBhc3N3b3JkU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgc2V0UGFzc3dvcmRCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgbmV3UGFzc3dvcmQgPSBuZXdQYXNzd29yZElucHV0LnZhbHVlO1xuICAgIGNvbnN0IGNvbmZpcm1QYXNzd29yZCA9IGNvbmZpcm1QYXNzd29yZElucHV0LnZhbHVlO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFx1MDBDOXRhcGUgMTogTWV0dHJlIFx1MDBFMCBqb3VyIGxlIG1vdCBkZSBwYXNzZVxuICAgICAgYXdhaXQgdXBkYXRlVXNlclBhc3N3b3JkKG5ld1Bhc3N3b3JkLCBjb25maXJtUGFzc3dvcmQpO1xuXG4gICAgICAvLyBcdTAwQzl0YXBlIDI6IFJcdTAwRTljdXBcdTAwRTlyZXIgbCd1dGlsaXNhdGV1ciBwb3VyIG9idGVuaXIgc29uIGVtYWlsXG4gICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgY29uc3QgY3VycmVudFVzZXIgPSBhd2FpdCBhY2NvdW50LmdldCgpO1xuXG4gICAgICAvLyBcdTAwQzl0YXBlIDM6IE9idGVuaXIgbGUgdG9rZW4gQ01TXG4gICAgICBjb25zdCBjbXNBdXRoID0gYXdhaXQgc2V0dXBDbXNBdXRoZW50aWNhdGlvbigpO1xuXG4gICAgICAvLyBcdTAwQzl0YXBlIDQ6IFN0b2NrZXIgbGVzIGRvbm5cdTAwRTllcyBkJ2F1dGhlbnRpZmljYXRpb25cbiAgICAgIHNldEF1dGhEYXRhKGN1cnJlbnRVc2VyLmVtYWlsLCBjbXNBdXRoKTtcblxuICAgICAgLy8gXHUwMEM5dGFwZSA1OiBBZmZpY2hlciBsZSBzdWNjXHUwMEU4cyBmaW5hbFxuICAgICAgaWYoc3VjY2Vzc1N0YXRlKSBzdWNjZXNzU3RhdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIGlmKHNldFBhc3N3b3JkU2VjdGlvbikgc2V0UGFzc3dvcmRTZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBpZihmaW5hbFN1Y2Nlc3NNZXNzYWdlKSBmaW5hbFN1Y2Nlc3NNZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIEwnZXJyZXVyICh2YWxpZGF0aW9uIG91IEFQSSkgZXN0IGRpcmVjdGVtZW50IGFmZmljaFx1MDBFOWUgXHUwMEUwIGwndXRpbGlzYXRldXJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJldXIgbG9ycyBkZSBsYSBmaW5hbGlzYXRpb24gZHUgY29tcHRlOlwiLCBlcnJvcik7XG4gICAgICBzaG93UGFzc3dvcmRFcnJvcihlcnJvci5tZXNzYWdlKTsgLy8gT24gdXRpbGlzZSBlcnJvci5tZXNzYWdlIHF1aSBlc3QgZFx1MDBFOWpcdTAwRTAgY2xhaXJcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0UGFzc3dvcmRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAvLyBPbiBuZSByXHUwMEU5LWFjdGl2ZSBsZSBib3V0b24gcXVlIHNpIGxlIHByb2Nlc3N1cyBuJ2VzdCBwYXMgYWxsXHUwMEU5IGF1IGJvdXRcbiAgICAgIGlmIChmaW5hbFN1Y2Nlc3NNZXNzYWdlLnN0eWxlLmRpc3BsYXkgIT09ICdibG9jaycpIHtcbiAgICAgICAgIHNldFBhc3N3b3JkQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gc2hvd1Bhc3N3b3JkRXJyb3IobWVzc2FnZSkge1xuICBzZXRQYXNzd29yZEVycm9yLnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgc2V0UGFzc3dvcmRFcnJvci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgc2V0UGFzc3dvcmRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIHNldFBhc3N3b3JkQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG59XG5cbi8qKlxuICogTG9naXF1ZSBwcmluY2lwYWxlIGV4XHUwMEU5Y3V0XHUwMEU5ZSBhdSBjaGFyZ2VtZW50IGRlIGxhIHBhZ2VcbiAqL1xuYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZUFjY2VwdEludml0YXRpb24oKSB7XG4gIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERTgwIFtBY2NlcHQtSW52aXRhdGlvbl0gSW5pdGlhbGlzYXRpb24gZHUgdHJhaXRlbWVudFwiKTtcbiAgXG4gIGNvbnN0IHF1ZXJ5UGFyYW1zID0gZ2V0UXVlcnlQYXJhbXMoKTtcbiAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURDQ0IgW0FjY2VwdC1JbnZpdGF0aW9uXSBQYXJhbVx1MDBFOHRyZXMgVVJMOlwiLCB7XG4gICAgaGFzVGVhbUlkOiBxdWVyeVBhcmFtcy5oYXMoJ3RlYW1JZCcpLFxuICAgIGhhc01lbWJlcnNoaXBJZDogcXVlcnlQYXJhbXMuaGFzKCdtZW1iZXJzaGlwSWQnKSwgXG4gICAgaGFzVXNlcklkOiBxdWVyeVBhcmFtcy5oYXMoJ3VzZXJJZCcpLFxuICAgIGhhc1NlY3JldDogcXVlcnlQYXJhbXMuaGFzKCdzZWNyZXQnKSxcbiAgICB0ZWFtSWQ6IHF1ZXJ5UGFyYW1zLmdldCgndGVhbUlkJyksXG4gICAgbWVtYmVyc2hpcElkOiBxdWVyeVBhcmFtcy5nZXQoJ21lbWJlcnNoaXBJZCcpLFxuICAgIHVzZXJJZDogcXVlcnlQYXJhbXMuZ2V0KCd1c2VySWQnKSxcbiAgICBzZWNyZXQ6IHF1ZXJ5UGFyYW1zLmdldCgnc2VjcmV0JykgPyAnKioqJyA6IG51bGxcbiAgfSk7XG4gIFxuICBpZiAocXVlcnlQYXJhbXMuaGFzKCd0ZWFtSWQnKSAmJiBxdWVyeVBhcmFtcy5oYXMoJ21lbWJlcnNoaXBJZCcpICYmXG4gICAgICBxdWVyeVBhcmFtcy5oYXMoJ3VzZXJJZCcpICYmIHF1ZXJ5UGFyYW1zLmhhcygnc2VjcmV0JykpIHtcbiAgICBhY2NlcHRJbnZpdGF0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGVycm9yTWVzc2FnZSkge1xuICAgICAgZXJyb3JNZXNzYWdlLnRleHRDb250ZW50ID0gXCJBdWN1bmUgaW52aXRhdGlvbiB0cm91dlx1MDBFOWUgZGFucyBsJ1VSTC4gVmV1aWxsZXogdlx1MDBFOXJpZmllciBsZSBsaWVuIGQnaW52aXRhdGlvbi5cIjtcbiAgICB9XG4gICAgc2hvd1VJU3RhdGUoJ2Vycm9yJyk7XG4gIH1cbn1cblxuLy8gVlx1MDBFOXJpZmllIHNpIGxlIERPTSBlc3QgZFx1MDBFOWpcdTAwRTAgY2hhcmdcdTAwRTksIHNpbm9uIGF0dGVuZCBsJ1x1MDBFOXZcdTAwRTluZW1lbnRcbmlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcbiAgY29uc29sZS5sb2coXCJcdTIzRjMgW0FjY2VwdC1JbnZpdGF0aW9uXSBET00gZW4gY291cnMgZGUgY2hhcmdlbWVudCwgYXR0ZW50ZSBkZSBET01Db250ZW50TG9hZGVkXCIpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgaW5pdGlhbGl6ZUFjY2VwdEludml0YXRpb24pO1xufSBlbHNlIHtcbiAgY29uc29sZS5sb2coXCJcdTI3MDUgW0FjY2VwdC1JbnZpdGF0aW9uXSBET00gZFx1MDBFOWpcdTAwRTAgY2hhcmdcdTAwRTksIGV4XHUwMEU5Y3V0aW9uIGltbVx1MDBFOWRpYXRlXCIpO1xuICBpbml0aWFsaXplQWNjZXB0SW52aXRhdGlvbigpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7QUFLQSxNQUFNLG9CQUFvQjtBQUMx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QkFBbUIsTUFBTSxVQUFVO0FBQzFELFlBQUcsb0JBQXFCLHFCQUFvQixNQUFNLFVBQVU7QUFBQSxNQUU5RCxTQUFTLE9BQU87QUFFZCxnQkFBUSxNQUFNLDZDQUE2QyxLQUFLO0FBQ2hFLDBCQUFrQixNQUFNLE9BQU87QUFBQSxNQUNqQyxVQUFFO0FBQ0EsMkJBQW1CLE1BQU0sVUFBVTtBQUVuQyxZQUFJLG9CQUFvQixNQUFNLFlBQVksU0FBUztBQUNoRCw0QkFBa0IsV0FBVztBQUFBLFFBQ2hDO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFFQSxXQUFTLGtCQUFrQixTQUFTO0FBQ2xDLHFCQUFpQixjQUFjO0FBQy9CLHFCQUFpQixNQUFNLFVBQVU7QUFDakMsdUJBQW1CLE1BQU0sVUFBVTtBQUNuQyxzQkFBa0IsV0FBVztBQUFBLEVBQy9CO0FBS0EsaUJBQWUsNkJBQTZCO0FBQzFDLFlBQVEsSUFBSSw0REFBcUQ7QUFFakUsVUFBTSxjQUFjLGVBQWU7QUFDbkMsWUFBUSxJQUFJLG9EQUEwQztBQUFBLE1BQ3BELFdBQVcsWUFBWSxJQUFJLFFBQVE7QUFBQSxNQUNuQyxpQkFBaUIsWUFBWSxJQUFJLGNBQWM7QUFBQSxNQUMvQyxXQUFXLFlBQVksSUFBSSxRQUFRO0FBQUEsTUFDbkMsV0FBVyxZQUFZLElBQUksUUFBUTtBQUFBLE1BQ25DLFFBQVEsWUFBWSxJQUFJLFFBQVE7QUFBQSxNQUNoQyxjQUFjLFlBQVksSUFBSSxjQUFjO0FBQUEsTUFDNUMsUUFBUSxZQUFZLElBQUksUUFBUTtBQUFBLE1BQ2hDLFFBQVEsWUFBWSxJQUFJLFFBQVEsSUFBSSxRQUFRO0FBQUEsSUFDOUMsQ0FBQztBQUVELFFBQUksWUFBWSxJQUFJLFFBQVEsS0FBSyxZQUFZLElBQUksY0FBYyxLQUMzRCxZQUFZLElBQUksUUFBUSxLQUFLLFlBQVksSUFBSSxRQUFRLEdBQUc7QUFDMUQsdUJBQWlCO0FBQUEsSUFDbkIsT0FBTztBQUNMLFVBQUksY0FBYztBQUNoQixxQkFBYSxjQUFjO0FBQUEsTUFDN0I7QUFDQSxrQkFBWSxPQUFPO0FBQUEsSUFDckI7QUFBQSxFQUNGO0FBR0EsTUFBSSxTQUFTLGVBQWUsV0FBVztBQUNyQyxZQUFRLElBQUksb0ZBQStFO0FBQzNGLGFBQVMsaUJBQWlCLG9CQUFvQiwwQkFBMEI7QUFBQSxFQUMxRSxPQUFPO0FBQ0wsWUFBUSxJQUFJLGdGQUE0RDtBQUN4RSwrQkFBMkI7QUFBQSxFQUM3QjsiLAogICJuYW1lcyI6IFsiYWNjb3VudCIsICJmdW5jdGlvbnMiLCAiYWNjb3VudCIsICJhY2NvdW50IiwgIkFQUFdSSVRFX0ZVTkNUSU9OX0lEIiwgImZ1bmN0aW9ucyIsICJhY2NvdW50Il0KfQo=

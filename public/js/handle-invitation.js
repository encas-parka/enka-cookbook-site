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
  var { APPWRITE_ENDPOINT: APPWRITE_ENDPOINT2, APPWRITE_PROJECT_ID: APPWRITE_PROJECT_ID2 } = getConfig();
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
      const teams = await getTeams();
      debugLog("Clients Appwrite initialis\xE9s");
      debugLog("Configuration:", {
        endpoint: APPWRITE_ENDPOINT2,
        projectId: APPWRITE_PROJECT_ID2,
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
      const membership = await teams.createMembership(
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzIiwgIjxzdGRpbj4iXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FwcHdyaXRlLWNsaWVudC5qc1xuLy8gTW9kdWxlIGNvbW11biBwb3VyIGwnaW5pdGlhbGlzYXRpb24gZXQgbGEgZ2VzdGlvbiBkdSBjbGllbnQgQXBwd3JpdGVcbi8vIFx1MDBDOXZpdGUgbGEgZHVwbGljYXRpb24gZCdpbml0aWFsaXNhdGlvbiBlbnRyZSBhdXRoLXN0YXR1cy5qcyBldCBhdXRoQXBwd3JpdGUuanNcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9jbG91ZC5hcHB3cml0ZS5pby92MVwiO1xuY29uc3QgQVBQV1JJVEVfUFJPSkVDVF9JRCA9IFwiNjg5NzI1ODIwMDI0ZTgxNzgxYjdcIjtcbmNvbnN0IEFQUFdSSVRFX0ZVTkNUSU9OX0lEID0gXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC1mdW5jdGlvblxuY29uc3QgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQgPSBcIjY4OWNkZWE1MDAxYTRkNzQ1NDlkXCI7IC8vIElEIGRlIGxhIGZvbmN0aW9uIGQnZW52b2kgZCdlbWFpbFxuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cbi8qKlxuICogQXR0ZW5kIHF1ZSBsZSBTREsgQXBwd3JpdGUgc29pdCBjaGFyZ1x1MDBFOSBldCBpbml0aWFsaXNlIGxlcyBjbGllbnRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBxdWkgc2Ugclx1MDBFOXNvdXQgcXVhbmQgbCdpbml0aWFsaXNhdGlvbiBlc3QgdGVybWluXHUwMEU5ZVxuICovXG5mdW5jdGlvbiB3YWl0Rm9yQXBwd3JpdGUobWF4QXR0ZW1wdHMgPSA1MCwgaW50ZXJ2YWwgPSAxMDApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrQXBwd3JpdGUoKSB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIFZcdTAwRTlyaWZpY2F0aW9uIFNESyAtIHRlbnRhdGl2ZSAke2F0dGVtcHRzfS8ke21heEF0dGVtcHRzfWApO1xuXG4gICAgICAgICAgICBpZiAod2luZG93LkFwcHdyaXRlICYmIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiYgd2luZG93LkFwcHdyaXRlLkFjY291bnQpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBjaGFyZ1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdHMgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSBhcHJcdTAwRThzIGxlIG5vbWJyZSBtYXhpbXVtIGRlIHRlbnRhdGl2ZXNcIik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkxlIFNESyBBcHB3cml0ZSBuJ2EgcGFzIHB1IFx1MDBFQXRyZSBjaGFyZ1x1MDBFOS5cIikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrQXBwd3JpdGUoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXNlIGxlcyBjbGllbnRzIEFwcHdyaXRlICh1bmUgc2V1bGUgZm9pcylcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9uc30+fSBMZXMgY2xpZW50cyBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHB3cml0ZSgpIHtcbiAgICAvLyBTaSBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTksIHJldG91cm5lciBsZXMgY2xpZW50cyBleGlzdGFudHNcbiAgICBpZiAoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQ2xpZW50cyBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzLCByXHUwMEU5dXRpbGlzYXRpb25cIik7XG4gICAgICAgIHJldHVybiB7IGNsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zIH07XG4gICAgfVxuXG4gICAgLy8gU2kgdW5lIGluaXRpYWxpc2F0aW9uIGVzdCBlbiBjb3VycywgYXR0ZW5kcmUgcXUnZWxsZSBzZSB0ZXJtaW5lXG4gICAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGVuIGNvdXJzLCBhdHRlbnRlLi4uXCIpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xuICAgIH1cblxuICAgIC8vIENvbW1lbmNlciB1bmUgbm91dmVsbGUgaW5pdGlhbGlzYXRpb25cbiAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEXHUwMEU5YnV0IGRlIGwnaW5pdGlhbGlzYXRpb25cIik7XG5cbiAgICAgICAgICAgIC8vIEF0dGVuZHJlIHF1ZSBsZSBTREsgc29pdCBjaGFyZ1x1MDBFOVxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckFwcHdyaXRlKCk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzXG4gICAgICAgICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgICAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChBUFBXUklURV9FTkRQT0lOVClcbiAgICAgICAgICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9QUk9KRUNUX0lEKTtcblxuICAgICAgICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICAgICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgdmFyaWFibGVzIGVuIGNhcyBkJ2VycmV1clxuICAgICAgICAgICAgY2xpZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGFjY291bnQgPSBudWxsO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbnVsbDtcbiAgICAgICAgICAgIGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgQXBwd3JpdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXBwd3JpdGVDbGllbnRzKCkge1xuICAgIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgQWNjb3VudFxuICogQHJldHVybnMge1Byb21pc2U8QWNjb3VudD59IExlIGNsaWVudCBBY2NvdW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFjY291bnQoKSB7XG4gICAgY29uc3QgeyBhY2NvdW50IH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIHJcdTAwRTl1c3NpZVwiLCBhY2NvdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgXHUwMEU5Y2hvdVx1MDBFOWVcIik7XG4gICAgfVxuICAgIHJldHVybiBhY2NvdW50O1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBGdW5jdGlvbnNcbiAqIEByZXR1cm5zIHtQcm9taXNlPEZ1bmN0aW9ucz59IExlIGNsaWVudCBGdW5jdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25zKCkge1xuICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICByZXR1cm4gZnVuY3Rpb25zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBUZWFtc1xuICogQHJldHVybnMge1Byb21pc2U8VGVhbXM+fSBMZSBjbGllbnQgVGVhbXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0VGVhbXMoKSB7XG4gICAgY29uc3QgeyBDbGllbnQsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgfVxuICAgIGNvbnN0IHRlYW1zID0gbmV3IFRlYW1zKGNsaWVudCk7XG4gICAgcmV0dXJuIHRlYW1zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY29uc3RhbnRlcyBkZSBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBDb25maWd1cmF0aW9uIEFwcHdyaXRlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICAgIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEXG4gICAgfTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGVzIGNsaWVudHMgc29udCBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsZXMgY2xpZW50cyBzb250IGluaXRpYWxpc1x1MDBFOXNcbiAqL1xuZnVuY3Rpb24gaXNJbml0aWFsaXplZCgpIHtcbiAgICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdhdXRoZW50aWZpY2F0aW9uIENNUyBsb2NhbGUgKHNvdXJjZSBkZSB2XHUwMEU5cml0XHUwMEU5IHByaW5jaXBhbGUpXG4gKiBAcmV0dXJucyB7b2JqZWN0fG51bGx9IEwnb2JqZXQgdXRpbGlzYXRldXIgcydpbCBlc3QgdmFsaWRlLCBzaW5vbiBudWxsXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAvLyBjb25zb2xlLmxvZygnXHVEODNEXHVERDBEIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIGJydXQgZGVwdWlzIGxvY2FsU3RvcmFnZTonLCBjbXNVc2VyKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICBjb25zb2xlLmxvZygnXHUyMTM5XHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIEF1Y3VuIHRva2VuIENNUyBkYW5zIGxvY2FsU3RvcmFnZScpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBwYXJzXHUwMEU5OicsIHtcbiAgICAgICAgICAvLyAgICAgaGFzVG9rZW46ICEhcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5UeXBlOiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5MZW5ndGg6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgLy8gICAgIHRva2VuUHJldmlldzogcGFyc2VkVXNlci50b2tlbiA/IHBhcnNlZFVzZXIudG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogJ04vQScsXG4gICAgICAgICAgLy8gICAgIGhhc0lkOiAhIXBhcnNlZFVzZXIuaWQsXG4gICAgICAgICAgLy8gICAgIGhhc0VtYWlsOiAhIXBhcnNlZFVzZXIuZW1haWwsXG4gICAgICAgICAgLy8gICAgIGJhY2tlbmROYW1lOiBwYXJzZWRVc2VyLmJhY2tlbmROYW1lXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGlmIChwYXJzZWRVc2VyLnRva2VuICYmIHR5cGVvZiBwYXJzZWRVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJiBwYXJzZWRVc2VyLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gQ01TIHZhbGlkZScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyBpbnZhbGlkZSAtIG5ldHRveWFnZScpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignXHUyNzRDIFtnZXRMb2NhbENtc1VzZXJdIERvbm5cdTAwRTllcyBDTVMgY29ycm9tcHVlcyBkYW5zIGxvY2FsU3RvcmFnZS4gTmV0dG95YWdlLi4uJywgZSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOSAoYmFzXHUwMEU5IHN1ciBsZSB0b2tlbiBDTVMpXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gKi9cbmZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZENtcygpIHtcbiAgY29uc29sZS5sb2coJ2dldExvY2FsQ21zVXNlcigpOiAnLCBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbCk7XG4gICAgcmV0dXJuIGdldExvY2FsQ21zVXNlcigpICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgZ2V0QWNjb3VudFxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZXN0IHZcdTAwRTlyaWZpXHUwMEU5XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBzaSBsJ2VtYWlsIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICovXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgIHJldHVybiB1c2VyLmVtYWlsVmVyaWZpY2F0aW9uIHx8IGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBJbXBvc3NpYmxlIGRlIHZcdTAwRTlyaWZpZXIgbFxcJ1x1MDBFOXRhdCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBkXFwnZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEVudm9pZSB1biBlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBcdTAwRTAgbCd1dGlsaXNhdGV1ciBjb25uZWN0XHUwMEU5XG4gKiBAcGFyYW0ge3N0cmluZ30gcmVkaXJlY3RVUkwgLSBVUkwgdmVycyBsYXF1ZWxsZSByZWRpcmlnZXIgYXByXHUwMEU4cyB2XHUwMEU5cmlmaWNhdGlvblxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb25VUkwgPSByZWRpcmVjdFVSTCB8fCBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS92ZXJpZnktZW1haWxgO1xuICAgICAgICBhd2FpdCBhY2NvdW50LmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FwcHdyaXRlQ2xpZW50XSBFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBlbnZveVx1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBsJ2VtYWlsIGF2ZWMgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSB2XHUwMEU5cmlmaWNhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWNyZXQgLSBTZWNyZXQgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgdlx1MDBFOXJpZmlcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gY29tcGxldCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fSBcdTAwQzl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGF2ZWMgdlx1MDBFOXJpZmljYXRpb24gZW1haWxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRpb25TdGF0ZSgpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgY29uc3QgdXNlckVtYWlsID0gZ2V0VXNlckVtYWlsKCk7XG4gICAgY29uc3QgdXNlck5hbWUgPSBnZXRVc2VyTmFtZSgpO1xuXG4gICAgaWYgKCFjbXNVc2VyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZW1haWxWZXJpZmllZCxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxcXCdcdTAwRTl0YXQgZFxcJ2F1dGhlbnRpZmljYXRpb246JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZGVwdWlzIGxlIGxvY2FsU3RvcmFnZVxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyRW1haWwoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIGxlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpIDtcbn1cblxuXG4vKipcbiAqIE5ldHRvaWUgdG91dGVzIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJBdXRoRGF0YSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJyk7XG4gICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXMgbmV0dG95XHUwMEU5ZXNcIik7XG59XG5cbi8qKlxuICogRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIC0gc3VwcHJpbWUgbGEgc2Vzc2lvbiBBcHB3cml0ZSBldCBuZXR0b2llIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBOZXR0b3llciBkJ2Fib3JkIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG5cbiAgICAgICAgLy8gU3VwcHJpbWVyIGxhIHNlc3Npb24gQXBwd3JpdGVcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKCdjdXJyZW50Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIHJcdTAwRTl1c3NpZVwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsIGVycm9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBMZSBub20gZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtvYmplY3R9IGNtc0F1dGggLSBMJ29iamV0IGQnYXV0aGVudGlmaWNhdGlvbiBDTVNcbiAqL1xuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIGVtYWlsKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJywgbmFtZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8vIEV4cG9ydCBkZXMgZm9uY3Rpb25zIHB1YmxpcXVlc1xuZXhwb3J0IHtcbiAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgZ2V0QWNjb3VudCxcbiAgICBnZXRGdW5jdGlvbnMsXG4gICAgZ2V0VGVhbXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMgLFxuICAgIGdldFVzZXJFbWFpbCxcbiAgICBnZXRVc2VyTmFtZSxcbiAgICBjbGVhckF1dGhEYXRhLFxuICAgIHNldEF1dGhEYXRhLFxuICAgIGxvZ291dEdsb2JhbCxcbiAgICBpc0VtYWlsVmVyaWZpZWQsXG4gICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgIHZlcmlmeUVtYWlsLFxuICAgIGdldExvY2FsRW1haWxWZXJpZmljYXRpb25TdGF0dXNcbn07XG5cblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgICAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgICAgIGdldEFjY291bnQsXG4gICAgICAgIGdldEZ1bmN0aW9ucyxcbiAgICAgICAgZ2V0VGVhbXMsXG4gICAgICAgIGdldENvbmZpZyxcbiAgICAgICAgaXNJbml0aWFsaXplZCxcbiAgICAgICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgICAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZENtcyxcbiAgICAgICAgZ2V0VXNlckVtYWlsLFxuICAgICAgICBnZXRVc2VyTmFtZSxcbiAgICAgICAgY2xlYXJBdXRoRGF0YSxcbiAgICAgICAgc2V0QXV0aERhdGEsXG4gICAgICAgIGxvZ291dEdsb2JhbCxcbiAgICAgICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgICAgICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gICAgICAgIHZlcmlmeUVtYWlsLFxuICAgICAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG4gICAgfTtcbn1cbiIsICIvLyBodWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9oYW5kbGUtaW52aXRhdGlvbi5qc1xuXG5pbXBvcnQgeyBnZXRBcHB3cml0ZUNsaWVudHMsIGdldEFjY291bnQsIGdldFRlYW1zLCBnZXRDb25maWcsIGlzQXV0aGVudGljYXRlZENtcyB9IGZyb20gJy4vYXBwd3JpdGUtY2xpZW50LmpzJztcblxuLy8gY29uc29sZS5sb2coXCJbSGFuZGxlLUludml0YXRpb25dIFNjcmlwdCBjaGFyZ1x1MDBFOVwiKTtcblxuLy8gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkZSBsYSBjb25maWd1cmF0aW9uXG5jb25zdCB7IEFQUFdSSVRFX0VORFBPSU5ULCBBUFBXUklURV9QUk9KRUNUX0lEIH0gPSBnZXRDb25maWcoKTtcblxuLy8gTCdJRCBkZSBsJ1x1MDBFOXF1aXBlIGRhbnMgbGFxdWVsbGUgaW52aXRlciAobCdcdTAwRTlxdWlwZSBwcmluY2lwYWxlLCBQQVMgbGVzIGFkbWlucylcbmNvbnN0IFRFQU1fSURfVE9fSU5WSVRFID0gXCI2ODliZjZmZTAwMDY2MjdkODk1OVwiO1xuXG4vLyAtLS0gU1RPQ0tBR0UgTE9DQUwgUE9VUiBcdTAwQzlWSVRFUiBMRVMgRE9VQkxPTlMgLS0tXG5jb25zdCBJTlZJVEFUSU9OX1NFTlRfS0VZID0gJ2ludml0YXRpb25fc2VudF9lbWFpbHMnO1xuXG4vLyAtLS0gREVCVUcgLS0tXG5jb25zdCBERUJVR19NT0RFID0gZmFsc2U7XG5cbi8qKlxuICogTmV0dG9pZSBsJ2hpc3RvcmlxdWUgZGVzIGludml0YXRpb25zIGVudm95XHUwMEU5ZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJJbnZpdGF0aW9uSGlzdG9yeSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShJTlZJVEFUSU9OX1NFTlRfS0VZKTtcbiAgICBkZWJ1Z0xvZyhcIkhpc3RvcmlxdWUgZGVzIGludml0YXRpb25zIG5ldHRveVx1MDBFOVwiKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgdW5lIGludml0YXRpb24gYSBkXHUwMEU5alx1MDBFMCBcdTAwRTl0XHUwMEU5IGVudm95XHUwMEU5ZSBwb3VyIHVuIGVtYWlsXG4gKiBAcGFyYW0ge3N0cmluZ30gZW1haWwgLSBMJ2VtYWlsIFx1MDBFMCB2XHUwMEU5cmlmaWVyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBUcnVlIHNpIGwnaW52aXRhdGlvbiBhIGRcdTAwRTlqXHUwMEUwIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllXG4gKi9cbmZ1bmN0aW9uIGhhc0ludml0YXRpb25CZWVuU2VudChlbWFpbCkge1xuICAgIGNvbnN0IHNlbnRFbWFpbHMgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKElOVklUQVRJT05fU0VOVF9LRVkpIHx8ICdbXScpO1xuICAgIHJldHVybiBzZW50RW1haWxzLmluY2x1ZGVzKGVtYWlsKTtcbn1cblxuLyoqXG4gKiBNYXJxdWUgdW5lIGludml0YXRpb24gY29tbWUgZW52b3lcdTAwRTllXG4gKiBAcGFyYW0ge3N0cmluZ30gZW1haWwgLSBMJ2VtYWlsIGRlIGwnaW52aXRhdGlvbiBlbnZveVx1MDBFOWVcbiAqL1xuZnVuY3Rpb24gbWFya0ludml0YXRpb25Bc1NlbnQoZW1haWwpIHtcbiAgICBjb25zdCBzZW50RW1haWxzID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShJTlZJVEFUSU9OX1NFTlRfS0VZKSB8fCAnW10nKTtcbiAgICBpZiAoIXNlbnRFbWFpbHMuaW5jbHVkZXMoZW1haWwpKSB7XG4gICAgICAgIHNlbnRFbWFpbHMucHVzaChlbWFpbCk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKElOVklUQVRJT05fU0VOVF9LRVksIEpTT04uc3RyaW5naWZ5KHNlbnRFbWFpbHMpKTtcbiAgICAgICAgZGVidWdMb2coXCJJbnZpdGF0aW9uIG1hcnF1XHUwMEU5ZSBjb21tZSBlbnZveVx1MDBFOWVcIiwgeyBlbWFpbCB9KTtcbiAgICB9XG59XG5cbi8vIC0tLSBET00gRUxFTUVOVFMgLS0tXG5sZXQgc3RhdHVzQ29udGFpbmVyLCBzdGF0dXNNZXNzYWdlLCBzdGF0dXNEZXRhaWxzLCBsb2dpbkJ1dHRvbjtcblxuLyoqXG4gKiBKb3VybmFsaXNhdGlvbiBwb3VyIGxlIGRcdTAwRTlib2dhZ2VcbiAqL1xuZnVuY3Rpb24gZGVidWdMb2cobWVzc2FnZSwgZGF0YSA9IG51bGwpIHtcbiAgICBpZiAoREVCVUdfTU9ERSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhgW0hhbmRsZS1JbnZpdGF0aW9uIERlYnVnXSAke21lc3NhZ2V9YCwgZGF0YSB8fCAnJyk7XG4gICAgfVxufVxuXG4vKipcbiAqIEluaXRpYWxpc2UgbGVzIFx1MDBFOWxcdTAwRTltZW50cyBET01cbiAqL1xuZnVuY3Rpb24gaW5pdGlhbGl6ZURPTUVsZW1lbnRzKCkge1xuICAgIHN0YXR1c0NvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtY29udGFpbmVyJyk7XG4gICAgc3RhdHVzTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtbWVzc2FnZScpO1xuICAgIHN0YXR1c0RldGFpbHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhdHVzLWRldGFpbHMnKTtcbiAgICBsb2dpbkJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbi1idXR0b24nKTtcblxuICAgIGRlYnVnTG9nKFwiXHUwMEM5bFx1MDBFOW1lbnRzIERPTSBpbml0aWFsaXNcdTAwRTlzXCIsIHtcbiAgICAgICAgc3RhdHVzQ29udGFpbmVyOiAhIXN0YXR1c0NvbnRhaW5lcixcbiAgICAgICAgc3RhdHVzTWVzc2FnZTogISFzdGF0dXNNZXNzYWdlLFxuICAgICAgICBzdGF0dXNEZXRhaWxzOiAhIXN0YXR1c0RldGFpbHMsXG4gICAgICAgIGxvZ2luQnV0dG9uOiAhIWxvZ2luQnV0dG9uXG4gICAgfSk7XG5cbiAgICBpZiAoIXN0YXR1c0NvbnRhaW5lciB8fCAhc3RhdHVzTWVzc2FnZSB8fCAhc3RhdHVzRGV0YWlscykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDZXJ0YWlucyBcdTAwRTlsXHUwMEU5bWVudHMgRE9NIHJlcXVpcyBzb250IG1hbnF1YW50c1wiKTtcbiAgICB9XG59XG5cbi8qKlxuICogQWZmaWNoZSBsZSByXHUwMEU5c3VsdGF0IGZpbmFsIGRlIGwnb3BcdTAwRTlyYXRpb24uXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtICdzdWNjZXNzJywgJ2RhbmdlcicsICd3YXJuaW5nJywgJ2luZm8nXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAtIExlIG1lc3NhZ2UgXHUwMEUwIGFmZmljaGVyXG4gKi9cbmZ1bmN0aW9uIHNob3dSZXN1bHQodHlwZSwgbWVzc2FnZSkge1xuICAgIGRlYnVnTG9nKGBBZmZpY2hhZ2UgZHUgclx1MDBFOXN1bHRhdDogJHt0eXBlfWAsIG1lc3NhZ2UpO1xuXG4gICAgaWYgKHN0YXR1c0NvbnRhaW5lcikgc3RhdHVzQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgaWYgKHN0YXR1c0RldGFpbHMpIHtcbiAgICAgICAgc3RhdHVzRGV0YWlscy5jbGFzc05hbWUgPSBgYWxlcnQgYWxlcnQtJHt0eXBlfSBteS0yYDtcbiAgICAgICAgc3RhdHVzRGV0YWlscy50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgICAgIHN0YXR1c0RldGFpbHMuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgfVxufVxuXG4vKipcbiAqIE1ldCBcdTAwRTAgam91ciBsZSBtZXNzYWdlIGRlIHN0YXR1dFxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgLSBMZSBtZXNzYWdlIFx1MDBFMCBhZmZpY2hlclxuICovXG5mdW5jdGlvbiB1cGRhdGVTdGF0dXNNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICBkZWJ1Z0xvZyhcIk1pc2UgXHUwMEUwIGpvdXIgZHUgbWVzc2FnZSBkZSBzdGF0dXRcIiwgbWVzc2FnZSk7XG4gICAgaWYgKHN0YXR1c01lc3NhZ2UpIHtcbiAgICAgICAgc3RhdHVzTWVzc2FnZS50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgfVxufVxuXG4vKipcbiAqIExvZ2lxdWUgcHJpbmNpcGFsZVxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVJbnZpdGF0aW9uKCkge1xuICAgIGxldCByZXF1ZXN0ZXJFbWFpbCA9IG51bGw7XG5cbiAgICB0cnkge1xuICAgICAgICBkZWJ1Z0xvZyhcIkRcdTAwRTltYXJyYWdlIGR1IHRyYWl0ZW1lbnQgZGUgbCdpbnZpdGF0aW9uXCIpO1xuICAgICAgICBkZWJ1Z0xvZyhcIlVSTCBhY3R1ZWxsZTpcIiwgd2luZG93LmxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBkZWJ1Z0xvZyhcIlBhcmFtXHUwMEU4dHJlcyBVUkw6XCIsIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuXG4gICAgICAgIC8vIDEuIEluaXRpYWxpc2VyIGxlcyBcdTAwRTlsXHUwMEU5bWVudHMgRE9NXG4gICAgICAgIGluaXRpYWxpemVET01FbGVtZW50cygpO1xuXG4gICAgICAgIC8vIDIuIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzIEFwcHdyaXRlIHZpYSBsZSBtb2R1bGUgY29tbXVuXG4gICAgICAgIHVwZGF0ZVN0YXR1c01lc3NhZ2UoXCJJbml0aWFsaXNhdGlvbiBkdSBjbGllbnQgQXBwd3JpdGUuLi5cIik7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGNvbnN0IHRlYW1zID0gYXdhaXQgZ2V0VGVhbXMoKTtcblxuICAgICAgICBkZWJ1Z0xvZyhcIkNsaWVudHMgQXBwd3JpdGUgaW5pdGlhbGlzXHUwMEU5c1wiKTtcbiAgICAgICAgZGVidWdMb2coXCJDb25maWd1cmF0aW9uOlwiLCB7XG4gICAgICAgICAgICBlbmRwb2ludDogQVBQV1JJVEVfRU5EUE9JTlQsXG4gICAgICAgICAgICBwcm9qZWN0SWQ6IEFQUFdSSVRFX1BST0pFQ1RfSUQsXG4gICAgICAgICAgICB0ZWFtSWQ6IFRFQU1fSURfVE9fSU5WSVRFXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIDMuIEV4dHJhaXJlIGwnZW1haWwgZHUgZGVtYW5kZXVyIGRlcHVpcyBsJ1VSTFxuICAgICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuICAgICAgICByZXF1ZXN0ZXJFbWFpbCA9IHBhcmFtcy5nZXQoJ3JlcXVlc3RlcicpO1xuXG4gICAgICAgIGRlYnVnTG9nKFwiRW1haWwgZHUgZGVtYW5kZXVyIGV4dHJhaXRcIiwgcmVxdWVzdGVyRW1haWwpO1xuICAgICAgICBkZWJ1Z0xvZyhcIlRvdXMgbGVzIHBhcmFtXHUwMEU4dHJlcyBVUkw6XCIsIE9iamVjdC5mcm9tRW50cmllcyhwYXJhbXMuZW50cmllcygpKSk7XG5cbiAgICAgICAgaWYgKCFyZXF1ZXN0ZXJFbWFpbCkge1xuICAgICAgICAgICAgZGVidWdMb2coXCJFUlJFVVI6IEVtYWlsIGR1IGRlbWFuZGV1ciBtYW5xdWFudFwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ2RhbmdlcicsICdFbWFpbCBkdSBkZW1hbmRldXIgbWFucXVhbnQgZGFucyBsXFwnVVJMLiBMZSBsaWVuIGVzdCBwZXV0LVx1MDBFQXRyZSBjb3Jyb21wdS4nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDQuIFZcdTAwRTlyaWZpZXIgc2kgbCdhZG1pbmlzdHJhdGV1ciBlc3QgY29ubmVjdFx1MDBFOVxuICAgICAgICB1cGRhdGVTdGF0dXNNZXNzYWdlKFwiVlx1MDBFOXJpZmljYXRpb24gZGUgdm90cmUgYXV0aGVudGlmaWNhdGlvbi4uLlwiKTtcbiAgICAgICAgZGVidWdMb2coXCJUZW50YXRpdmUgZGUgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkZSBsJ3V0aWxpc2F0ZXVyIGNvdXJhbnQuLi5cIik7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRVc2VyID0gYXdhaXQgYWNjb3VudC5nZXQoKTtcblxuICAgICAgICBkZWJ1Z0xvZyhcIlV0aWxpc2F0ZXVyIGNvbm5lY3RcdTAwRTlcIiwge1xuICAgICAgICAgICAgbmFtZTogY3VycmVudFVzZXIubmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiBjdXJyZW50VXNlci5lbWFpbCxcbiAgICAgICAgICAgIGlkOiBjdXJyZW50VXNlci4kaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdXBkYXRlU3RhdHVzTWVzc2FnZShgQ29ubmVjdFx1MDBFOSBlbiB0YW50IHF1ZSAke2N1cnJlbnRVc2VyLm5hbWV9LiBFbnZvaSBkZSBsJ2ludml0YXRpb24gXHUwMEUwICR7cmVxdWVzdGVyRW1haWx9Li4uYCk7XG5cbiAgICAgICAgLy8gNS4gVlx1MDBFOXJpZmllciBzaSB1bmUgaW52aXRhdGlvbiBhIGRcdTAwRTlqXHUwMEUwIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIHBvdXIgY2V0IGVtYWlsXG4gICAgICAgIGRlYnVnTG9nKFwiVlx1MDBFOXJpZmljYXRpb24gZGVzIGludml0YXRpb25zIHByXHUwMEU5Y1x1MDBFOWRlbnRlc1wiLCB7IGVtYWlsOiByZXF1ZXN0ZXJFbWFpbCB9KTtcblxuICAgICAgICBpZiAoaGFzSW52aXRhdGlvbkJlZW5TZW50KHJlcXVlc3RlckVtYWlsKSkge1xuICAgICAgICAgICAgZGVidWdMb2coXCJJbnZpdGF0aW9uIGRcdTAwRTlqXHUwMEUwIGVudm95XHUwMEU5ZSBwclx1MDBFOWNcdTAwRTlkZW1tZW50IHBvdXIgY2V0IGVtYWlsXCIsIHsgZW1haWw6IHJlcXVlc3RlckVtYWlsIH0pO1xuICAgICAgICAgICAgc2hvd1Jlc3VsdCgnd2FybmluZycsIGBVbmUgaW52aXRhdGlvbiBhIGRcdTAwRTlqXHUwMEUwIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIFx1MDBFMCAke3JlcXVlc3RlckVtYWlsfS4gVmV1aWxsZXogcGF0aWVudGVyIHF1J2VsbGUgc29pdCBhY2NlcHRcdTAwRTllLmApO1xuXG4gICAgICAgICAgICAvLyBBam91dGVyIHVuIGJvdXRvbiBwb3VyIHJcdTAwRTlpbml0aWFsaXNlciBsJ2hpc3RvcmlxdWVcbiAgICAgICAgICAgIGlmIChzdGF0dXNEZXRhaWxzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzZXRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgICAgICAgICByZXNldEJ1dHRvbi5jbGFzc05hbWUgPSAnYnRuIGJ0bi13YXJuaW5nIGJ0bi1zbSBtcy0yJztcbiAgICAgICAgICAgICAgICByZXNldEJ1dHRvbi50ZXh0Q29udGVudCA9ICdSXHUwMEU5ZXNzYXllcic7XG4gICAgICAgICAgICAgICAgcmVzZXRCdXR0b24ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnZpdGF0aW9uSGlzdG9yeSgpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzdGF0dXNEZXRhaWxzLmFwcGVuZENoaWxkKHJlc2V0QnV0dG9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDYuIEVudm95ZXIgbCdpbnZpdGF0aW9uIFx1MDBFMCBsJ1x1MDBFOXF1aXBlXG4gICAgICAgIGRlYnVnTG9nKFwiRW52b2kgZGUgbCdpbnZpdGF0aW9uIFx1MDBFMCBsJ1x1MDBFOXF1aXBlXCIsIHtcbiAgICAgICAgICAgIHRlYW1JZDogVEVBTV9JRF9UT19JTlZJVEUsXG4gICAgICAgICAgICBlbWFpbDogcmVxdWVzdGVyRW1haWwsXG4gICAgICAgICAgICByb2xlczogWydvd25lciddLFxuICAgICAgICAgICAgcmVkaXJlY3RVcmw6IGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L2FjY2VwdC1pbnZpdGF0aW9uYFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBtZW1iZXJzaGlwID0gYXdhaXQgdGVhbXMuY3JlYXRlTWVtYmVyc2hpcChcbiAgICAgICAgICAgIFRFQU1fSURfVE9fSU5WSVRFLFxuICAgICAgICAgICAgWydvd25lciddLCAvLyBSXHUwMEY0bGUgXCJvd25lclwiIGNvbW1lIGRlbWFuZFx1MDBFOVxuICAgICAgICAgICAgcmVxdWVzdGVyRW1haWwsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS9hY2NlcHQtaW52aXRhdGlvbmAgLy8gUGFnZSBkZSByZWRpcmVjdGlvbiBwb3VyIGwnaW52aXRcdTAwRTlcbiAgICAgICAgKTtcblxuICAgICAgICAvLyA3LiBTdG9ja2VyIGwnZW1haWwgcG91ciBcdTAwRTl2aXRlciBsZXMgZG91YmxvbnNcbiAgICAgICAgbWFya0ludml0YXRpb25Bc1NlbnQocmVxdWVzdGVyRW1haWwpO1xuXG4gICAgICAgIGRlYnVnTG9nKFwiSW52aXRhdGlvbiBlbnZveVx1MDBFOWUgYXZlYyBzdWNjXHUwMEU4c1wiLCB7IG1lbWJlcnNoaXBJZDogbWVtYmVyc2hpcC4kaWQgfSk7XG4gICAgICAgIHNob3dSZXN1bHQoJ3N1Y2Nlc3MnLCBgSW52aXRhdGlvbiBlbnZveVx1MDBFOWUgYXZlYyBzdWNjXHUwMEU4cyBcdTAwRTAgJHtyZXF1ZXN0ZXJFbWFpbH0gIWApO1xuXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gR1x1MDBFOXJlciBsZXMgZXJyZXVyc1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyZXVyIGxvcnMgZHUgdHJhaXRlbWVudCBkZSBsJ2ludml0YXRpb24gOlwiLCBlcnJvcik7XG4gICAgICAgIGRlYnVnTG9nKFwiRXJyZXVyIGRcdTAwRTl0ZWN0XHUwMEU5ZVwiLCB7XG4gICAgICAgICAgICBjb2RlOiBlcnJvci5jb2RlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgIHR5cGU6IGVycm9yLnR5cGUsXG4gICAgICAgICAgICByZXNwb25zZTogZXJyb3IucmVzcG9uc2UsXG4gICAgICAgICAgICBzdGFjazogZXJyb3Iuc3RhY2tcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWZmaWNoZXIgcGx1cyBkZSBkXHUwMEU5dGFpbHMgZW4gbW9kZSBkZWJ1Z1xuICAgICAgICBpZiAoREVCVUdfTU9ERSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkRcdTAwRTl0YWlscyBjb21wbGV0cyBkZSBsJ2VycmV1cjpcIiwgZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09IDQwMSB8fCBlcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnbm90IGF1dGhlbnRpY2F0ZWQnKSB8fCBlcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnVW5hdXRob3JpemVkJykpIHsgLy8gTm9uIGF1dGhlbnRpZmlcdTAwRTlcbiAgICAgICAgICAgIGRlYnVnTG9nKFwiRXJyZXVyIGQnYXV0aGVudGlmaWNhdGlvblwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ2RhbmdlcicsICdWb3VzIGRldmV6IFx1MDBFQXRyZSBjb25uZWN0XHUwMEU5IGVuIHRhbnQgcXVcXCdhZG1pbmlzdHJhdGV1ciBwb3VyIGFwcHJvdXZlciB1bmUgaW52aXRhdGlvbi4nKTtcbiAgICAgICAgICAgIGlmIChsb2dpbkJ1dHRvbikgbG9naW5CdXR0b24uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICB9IGVsc2UgaWYgKGVycm9yLmNvZGUgPT09IDQwOSkgeyAvLyBDb25mbGl0XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkVycmV1ciBkZSBjb25mbGl0ICh1dGlsaXNhdGV1ciBkXHUwMEU5alx1MDBFMCBpbnZpdFx1MDBFOSlcIik7XG4gICAgICAgICAgICBzaG93UmVzdWx0KCd3YXJuaW5nJywgYCR7cmVxdWVzdGVyRW1haWwgfHwgJ2NldCB1dGlsaXNhdGV1cid9IGVzdCBkXHUwMEU5alx1MDBFMCBtZW1icmUgZGUgbCdcdTAwRTlxdWlwZSBvdSBhIGRcdTAwRTlqXHUwMEUwIHVuZSBpbnZpdGF0aW9uIGVuIGF0dGVudGUuYCk7XG5cbiAgICAgICAgICAgIC8vIFN0b2NrZXIgcXVhbmQgbVx1MDBFQW1lIGwnZW1haWwgcG91ciBcdTAwRTl2aXRlciBsZXMgdGVudGF0aXZlcyBmdXR1cmVzXG4gICAgICAgICAgICBpZiAocmVxdWVzdGVyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtYXJrSW52aXRhdGlvbkFzU2VudChyZXF1ZXN0ZXJFbWFpbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyb3IuY29kZSA9PT0gNDAwKSB7XG4gICAgICAgICAgICBkZWJ1Z0xvZyhcIkVycmV1ciBkZSByZXF1XHUwMEVBdGUgaW52YWxpZGVcIik7XG4gICAgICAgICAgICBzaG93UmVzdWx0KCdkYW5nZXInLCBgUmVxdVx1MDBFQXRlIGludmFsaWRlIDogJHtlcnJvci5tZXNzYWdlIHx8ICdWXHUwMEU5cmlmaWV6IGxlcyBwYXJhbVx1MDBFOHRyZXMgZGUgbFxcJ2ludml0YXRpb24nfWApO1xuICAgICAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdBcHB3cml0ZScpIHx8IGVycm9yLm1lc3NhZ2U/LmluY2x1ZGVzKCdTREsnKSkge1xuICAgICAgICAgICAgZGVidWdMb2coXCJFcnJldXIgbGlcdTAwRTllIGF1IFNESyBBcHB3cml0ZVwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ2RhbmdlcicsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVidWdMb2coXCJFcnJldXIgaW5hdHRlbmR1ZVwiKTtcbiAgICAgICAgICAgIHNob3dSZXN1bHQoJ2RhbmdlcicsIGBVbmUgZXJyZXVyIGluYXR0ZW5kdWUgZXN0IHN1cnZlbnVlIDogJHtlcnJvci5tZXNzYWdlIHx8ICdFcnJldXIgaW5jb25udWUnfWApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIERcdTAwRTltYXJyZXIgbGUgcHJvY2Vzc3VzIGxvcnNxdWUgbGUgRE9NIGVzdCBjaGFyZ1x1MDBFOVxuICovXG5cbi8vIFZcdTAwRTlyaWZpZXIgc2kgbGUgRE9NIGVzdCBkXHUwMEU5alx1MDBFMCBjaGFyZ1x1MDBFOVxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xuICAgIC8vIExlIERPTSBlc3QgZW5jb3JlIGVuIGNoYXJnZW1lbnQsIG9uIGF0dGVuZCBsJ1x1MDBFOXZcdTAwRTluZW1lbnRcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuICAgICAgICBkZWJ1Z0xvZyhcIkRPTSBjaGFyZ1x1MDBFOSB2aWEgXHUwMEU5dlx1MDBFOW5lbWVudCwgZFx1MDBFOW1hcnJhZ2UgZHUgcHJvY2Vzc3VzIGQnaW52aXRhdGlvblwiKTtcbiAgICAgICAgc3RhcnRJbnZpdGF0aW9uUHJvY2VzcygpO1xuICAgIH0pO1xufSBlbHNlIHtcbiAgICAvLyBMZSBET00gZXN0IGRcdTAwRTlqXHUwMEUwIGNoYXJnXHUwMEU5LCBvbiBkXHUwMEU5bWFycmUgaW1tXHUwMEU5ZGlhdGVtZW50XG4gICAgc3RhcnRJbnZpdGF0aW9uUHJvY2VzcygpO1xufVxuXG4vKipcbiAqIEZvbmN0aW9uIHByaW5jaXBhbGUgcG91ciBkXHUwMEU5bWFycmVyIGxlIHByb2Nlc3N1cyBkJ2ludml0YXRpb25cbiAqL1xuZnVuY3Rpb24gc3RhcnRJbnZpdGF0aW9uUHJvY2VzcygpIHtcbiAgICBoYW5kbGVJbnZpdGF0aW9uKCkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyZXVyIG5vbiBjYXB0dXJcdTAwRTllIGRhbnMgaGFuZGxlSW52aXRhdGlvbjpcIiwgZXJyb3IpO1xuICAgICAgICBkZWJ1Z0xvZyhcIkVSUkVVUiBDUklUSVFVRSBub24gY2FwdHVyXHUwMEU5ZVwiLCBlcnJvcik7XG4gICAgICAgIGlmIChzdGF0dXNEZXRhaWxzKSB7XG4gICAgICAgICAgICBzdGF0dXNEZXRhaWxzLmNsYXNzTmFtZSA9ICdhbGVydCBhbGVydC1kYW5nZXIgIG15LTInO1xuICAgICAgICAgICAgc3RhdHVzRGV0YWlscy50ZXh0Q29udGVudCA9ICdVbmUgZXJyZXVyIGNyaXRpcXVlIGVzdCBzdXJ2ZW51ZS4gVmV1aWxsZXogY29uc3VsdGVyIGxhIGNvbnNvbGUgcG91ciBwbHVzIGRlIGRcdTAwRTl0YWlscy4nO1xuICAgICAgICAgICAgc3RhdHVzRGV0YWlscy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdHVzQ29udGFpbmVyKSBzdGF0dXNDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9KTtcbn1cblxuLy8gQWpvdXRlciB1biB0aW1lb3V0IGdsb2JhbCBwb3VyIFx1MDBFOXZpdGVyIHF1ZSBsYSBwYWdlIHJlc3RlIGJsb3F1XHUwMEU5ZSBpbmRcdTAwRTlmaW5pbWVudFxuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKHN0YXR1c0NvbnRhaW5lciAmJiBzdGF0dXNDb250YWluZXIuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnKSB7XG4gICAgICAgIGRlYnVnTG9nKFwiVGltZW91dCBnbG9iYWwgYXR0ZWludCwgYWZmaWNoYWdlIGQndW4gbWVzc2FnZSBkJ2VycmV1clwiKTtcbiAgICAgICAgc2hvd1Jlc3VsdCgnZGFuZ2VyJywgJ0xlIHRyYWl0ZW1lbnQgcHJlbmQgdHJvcCBkZSB0ZW1wcy4gVmV1aWxsZXogdlx1MDBFOXJpZmllciB2b3RyZSBjb25uZXhpb24gZXQgclx1MDBFOWVzc2F5ZXIuJyk7XG4gICAgfVxufSwgMzAwMDApOyAvLyAzMCBzZWNvbmRlc1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7QUFLQSxNQUFNLG9CQUFvQjtBQUMxQixNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHVCQUF1QjtBQUM3QixNQUFNLDZCQUE2QjtBQUduQyxNQUFJLFNBQVM7QUFDYixNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFDaEIsTUFBSSx3QkFBd0I7QUFNNUIsV0FBUyxnQkFBZ0IsY0FBYyxJQUFJLFdBQVcsS0FBSztBQUN2RCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUNwQyxVQUFJLFdBQVc7QUFFZixlQUFTLGdCQUFnQjtBQUNyQjtBQUdBLFlBQUksT0FBTyxZQUFZLE9BQU8sU0FBUyxVQUFVLE9BQU8sU0FBUyxTQUFTO0FBRXRFLGtCQUFRO0FBQUEsUUFDWixXQUFXLFlBQVksYUFBYTtBQUNoQyxrQkFBUSxNQUFNLHVGQUFp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QU0sU0FBUyxPQUFPLE1BQU0sU0FBUyxTQUFTLG1CQUFtQixLQUFLLE1BQU0sU0FBUyxTQUFTLGNBQWMsR0FBRztBQUMvRyxpQkFBUywyQkFBMkI7QUFDcEMsbUJBQVcsVUFBVSx5RkFBb0Y7QUFDekcsWUFBSSxZQUFhLGFBQVksTUFBTSxVQUFVO0FBQUEsTUFDakQsV0FBVyxNQUFNLFNBQVMsS0FBSztBQUMzQixpQkFBUyxzREFBNkM7QUFDdEQsbUJBQVcsV0FBVyxHQUFHLGtCQUFrQixpQkFBaUIsa0ZBQW1FO0FBRy9ILFlBQUksZ0JBQWdCO0FBQ2hCLCtCQUFxQixjQUFjO0FBQUEsUUFDdkM7QUFBQSxNQUNKLFdBQVcsTUFBTSxTQUFTLEtBQUs7QUFDM0IsaUJBQVMsK0JBQTRCO0FBQ3JDLG1CQUFXLFVBQVUseUJBQXNCLE1BQU0sV0FBVywrQ0FBMEMsRUFBRTtBQUFBLE1BQzVHLFdBQVcsTUFBTSxTQUFTLFNBQVMsVUFBVSxLQUFLLE1BQU0sU0FBUyxTQUFTLEtBQUssR0FBRztBQUM5RSxpQkFBUyxnQ0FBNkI7QUFDdEMsbUJBQVcsVUFBVSxNQUFNLE9BQU87QUFBQSxNQUN0QyxPQUFPO0FBQ0gsaUJBQVMsbUJBQW1CO0FBQzVCLG1CQUFXLFVBQVUsd0NBQXdDLE1BQU0sV0FBVyxpQkFBaUIsRUFBRTtBQUFBLE1BQ3JHO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFPQSxNQUFJLFNBQVMsZUFBZSxXQUFXO0FBRW5DLGFBQVMsaUJBQWlCLG9CQUFvQixNQUFNO0FBQ2hELGVBQVMsMkVBQStEO0FBQ3hFLDZCQUF1QjtBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNMLE9BQU87QUFFSCwyQkFBdUI7QUFBQSxFQUMzQjtBQUtBLFdBQVMseUJBQXlCO0FBQzlCLHFCQUFpQixFQUFFLE1BQU0sV0FBUztBQUM5QixjQUFRLE1BQU0saURBQThDLEtBQUs7QUFDakUsZUFBUyxtQ0FBZ0MsS0FBSztBQUM5QyxVQUFJLGVBQWU7QUFDZixzQkFBYyxZQUFZO0FBQzFCLHNCQUFjLGNBQWM7QUFDNUIsc0JBQWMsTUFBTSxVQUFVO0FBQUEsTUFDbEM7QUFDQSxVQUFJLGdCQUFpQixpQkFBZ0IsTUFBTSxVQUFVO0FBQUEsSUFDekQsQ0FBQztBQUFBLEVBQ0w7QUFHQSxhQUFXLE1BQU07QUFDYixRQUFJLG1CQUFtQixnQkFBZ0IsTUFBTSxZQUFZLFFBQVE7QUFDN0QsZUFBUyx5REFBeUQ7QUFDbEUsaUJBQVcsVUFBVSwwRkFBb0Y7QUFBQSxJQUM3RztBQUFBLEVBQ0osR0FBRyxHQUFLOyIsCiAgIm5hbWVzIjogWyJhY2NvdW50IiwgImZ1bmN0aW9ucyIsICJhY2NvdW50IiwgImFjY291bnQiLCAiQVBQV1JJVEVfRU5EUE9JTlQiLCAiQVBQV1JJVEVfUFJPSkVDVF9JRCIsICJhY2NvdW50Il0KfQo=

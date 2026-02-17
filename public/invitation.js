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
  var TEAM_ID = "689bf6fe0006627d8959";
  var loadingState = document.getElementById("invitation-auth-loading");
  var deniedState = document.getElementById("invitation-auth-denied");
  var grantedState = document.getElementById("invitation-auth-granted");
  var invitationForm = document.getElementById("invitation-form");
  var invitationEmail = document.getElementById("invitation-email");
  var invitationButton = document.getElementById("invitation-button");
  var errorMessage = document.getElementById("invitation-error-message");
  var successMessage = document.getElementById("invitation-success-message");
  var spinner = invitationButton?.querySelector(".spinner-border");
  function showUIState(state) {
    if (loadingState) loadingState.style.display = state === "loading" ? "block" : "none";
    if (deniedState) deniedState.style.display = state === "denied" ? "block" : "none";
    if (grantedState) grantedState.style.display = state === "granted" ? "block" : "none";
  }
  if (invitationForm) {
    invitationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (errorMessage) errorMessage.style.display = "none";
      if (successMessage) successMessage.style.display = "none";
      if (spinner) spinner.style.display = "inline-block";
      if (invitationButton) invitationButton.disabled = true;
      const email = invitationEmail.value.trim();
      if (!isValidEmail(email)) {
        if (errorMessage) {
          errorMessage.textContent = `L'adresse email "${email}" n'est pas valide. Veuillez v\xE9rifier le format de l'email (exemple@domaine.com).`;
          errorMessage.style.display = "block";
        }
        if (spinner) spinner.style.display = "none";
        if (invitationButton) invitationButton.disabled = false;
        return;
      }
      try {
        const account2 = await getAccount();
        const currentUser = await account2.get();
        const teams = await getTeams();
        await teams.createMembership(
          TEAM_ID,
          ["owner"],
          // Rôle donné à la personne invitée. Mettez 'owner' pour qu'ils puissent inviter à leur tour.
          email,
          void 0,
          // userId (non requis pour une invitation par email)
          void 0,
          // phone (non requis)
          `${window.location.origin}/accept-invitation`
          // URL de redirection après acceptation
        );
        if (successMessage) {
          successMessage.textContent = `L'invitation a \xE9t\xE9 envoy\xE9e avec succ\xE8s \xE0 ${email} !`;
          successMessage.style.display = "block";
        }
        invitationForm.reset();
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'invitation:", error);
        let errorMsg = "Une erreur est survenue.";
        if (error.code === 401) {
          errorMsg = "Vous n'avez pas la permission d'inviter des membres. Seuls les propri\xE9taires de l'\xE9quipe le peuvent.";
        } else if (error.code === 409) {
          errorMsg = "Cette personne est d\xE9j\xE0 membre de l'\xE9quipe ou a d\xE9j\xE0 une invitation en attente.";
        } else if (error.message) {
          errorMsg = error.message;
        }
        if (errorMessage) {
          errorMessage.textContent = errorMsg;
          errorMessage.style.display = "block";
        }
      } finally {
        if (spinner) spinner.style.display = "none";
        if (invitationButton) invitationButton.disabled = false;
      }
    });
  }
  function isValidEmail(email) {
    if (!email || email.length === 0) {
      return false;
    }
    email = email.trim();
    if (/\s/.test(email)) {
      return false;
    }
    if (email.length < 5 || email.length > 254) {
      return false;
    }
    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    if (email.includes("..")) {
      return false;
    }
    return emailRegex.test(email);
  }
  async function initInvitationPage() {
    console.log("[Appwrite Client] Initialisation du client Appwrite");
    showUIState("loading");
    try {
      if (!isAuthenticatedCms()) {
        showUIState("denied");
        return;
      }
      try {
        const account2 = await getAccount();
        await account2.get();
        console.log("[Appwrite Client] R\xE9cup\xE9ration du compte Appwrite r\xE9ussie", account2);
        showUIState("granted");
      } catch (error) {
        showUIState("denied");
      }
    } catch (error) {
      console.error("Erreur inattendue au chargement de la page d'invitation:", error);
      showUIState("denied");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInvitationPage);
  } else {
    initInvitationPage();
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzIiwgIjxzdGRpbj4iXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FwcHdyaXRlLWNsaWVudC5qc1xuLy8gTW9kdWxlIGNvbW11biBwb3VyIGwnaW5pdGlhbGlzYXRpb24gZXQgbGEgZ2VzdGlvbiBkdSBjbGllbnQgQXBwd3JpdGVcbi8vIFx1MDBDOXZpdGUgbGEgZHVwbGljYXRpb24gZCdpbml0aWFsaXNhdGlvbiBlbnRyZSBhdXRoLXN0YXR1cy5qcyBldCBhdXRoQXBwd3JpdGUuanNcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9jbG91ZC5hcHB3cml0ZS5pby92MVwiO1xuY29uc3QgQVBQV1JJVEVfUFJPSkVDVF9JRCA9IFwiNjg5NzI1ODIwMDI0ZTgxNzgxYjdcIjtcbmNvbnN0IEFQUFdSSVRFX0ZVTkNUSU9OX0lEID0gXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC1mdW5jdGlvblxuY29uc3QgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQgPSBcIjY4OWNkZWE1MDAxYTRkNzQ1NDlkXCI7IC8vIElEIGRlIGxhIGZvbmN0aW9uIGQnZW52b2kgZCdlbWFpbFxuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cbi8qKlxuICogQXR0ZW5kIHF1ZSBsZSBTREsgQXBwd3JpdGUgc29pdCBjaGFyZ1x1MDBFOSBldCBpbml0aWFsaXNlIGxlcyBjbGllbnRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBxdWkgc2Ugclx1MDBFOXNvdXQgcXVhbmQgbCdpbml0aWFsaXNhdGlvbiBlc3QgdGVybWluXHUwMEU5ZVxuICovXG5mdW5jdGlvbiB3YWl0Rm9yQXBwd3JpdGUobWF4QXR0ZW1wdHMgPSA1MCwgaW50ZXJ2YWwgPSAxMDApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrQXBwd3JpdGUoKSB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIFZcdTAwRTlyaWZpY2F0aW9uIFNESyAtIHRlbnRhdGl2ZSAke2F0dGVtcHRzfS8ke21heEF0dGVtcHRzfWApO1xuXG4gICAgICAgICAgICBpZiAod2luZG93LkFwcHdyaXRlICYmIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiYgd2luZG93LkFwcHdyaXRlLkFjY291bnQpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBjaGFyZ1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdHMgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSBhcHJcdTAwRThzIGxlIG5vbWJyZSBtYXhpbXVtIGRlIHRlbnRhdGl2ZXNcIik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkxlIFNESyBBcHB3cml0ZSBuJ2EgcGFzIHB1IFx1MDBFQXRyZSBjaGFyZ1x1MDBFOS5cIikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrQXBwd3JpdGUoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXNlIGxlcyBjbGllbnRzIEFwcHdyaXRlICh1bmUgc2V1bGUgZm9pcylcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9uc30+fSBMZXMgY2xpZW50cyBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHB3cml0ZSgpIHtcbiAgICAvLyBTaSBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTksIHJldG91cm5lciBsZXMgY2xpZW50cyBleGlzdGFudHNcbiAgICBpZiAoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQ2xpZW50cyBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzLCByXHUwMEU5dXRpbGlzYXRpb25cIik7XG4gICAgICAgIHJldHVybiB7IGNsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zIH07XG4gICAgfVxuXG4gICAgLy8gU2kgdW5lIGluaXRpYWxpc2F0aW9uIGVzdCBlbiBjb3VycywgYXR0ZW5kcmUgcXUnZWxsZSBzZSB0ZXJtaW5lXG4gICAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGVuIGNvdXJzLCBhdHRlbnRlLi4uXCIpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xuICAgIH1cblxuICAgIC8vIENvbW1lbmNlciB1bmUgbm91dmVsbGUgaW5pdGlhbGlzYXRpb25cbiAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEXHUwMEU5YnV0IGRlIGwnaW5pdGlhbGlzYXRpb25cIik7XG5cbiAgICAgICAgICAgIC8vIEF0dGVuZHJlIHF1ZSBsZSBTREsgc29pdCBjaGFyZ1x1MDBFOVxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckFwcHdyaXRlKCk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzXG4gICAgICAgICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgICAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChBUFBXUklURV9FTkRQT0lOVClcbiAgICAgICAgICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9QUk9KRUNUX0lEKTtcblxuICAgICAgICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICAgICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgdmFyaWFibGVzIGVuIGNhcyBkJ2VycmV1clxuICAgICAgICAgICAgY2xpZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGFjY291bnQgPSBudWxsO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbnVsbDtcbiAgICAgICAgICAgIGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgQXBwd3JpdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXBwd3JpdGVDbGllbnRzKCkge1xuICAgIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgQWNjb3VudFxuICogQHJldHVybnMge1Byb21pc2U8QWNjb3VudD59IExlIGNsaWVudCBBY2NvdW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFjY291bnQoKSB7XG4gICAgY29uc3QgeyBhY2NvdW50IH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIHJcdTAwRTl1c3NpZVwiLCBhY2NvdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgXHUwMEU5Y2hvdVx1MDBFOWVcIik7XG4gICAgfVxuICAgIHJldHVybiBhY2NvdW50O1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBGdW5jdGlvbnNcbiAqIEByZXR1cm5zIHtQcm9taXNlPEZ1bmN0aW9ucz59IExlIGNsaWVudCBGdW5jdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25zKCkge1xuICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICByZXR1cm4gZnVuY3Rpb25zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBUZWFtc1xuICogQHJldHVybnMge1Byb21pc2U8VGVhbXM+fSBMZSBjbGllbnQgVGVhbXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0VGVhbXMoKSB7XG4gICAgY29uc3QgeyBDbGllbnQsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgfVxuICAgIGNvbnN0IHRlYW1zID0gbmV3IFRlYW1zKGNsaWVudCk7XG4gICAgcmV0dXJuIHRlYW1zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY29uc3RhbnRlcyBkZSBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBDb25maWd1cmF0aW9uIEFwcHdyaXRlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICAgIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEXG4gICAgfTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGVzIGNsaWVudHMgc29udCBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsZXMgY2xpZW50cyBzb250IGluaXRpYWxpc1x1MDBFOXNcbiAqL1xuZnVuY3Rpb24gaXNJbml0aWFsaXplZCgpIHtcbiAgICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdhdXRoZW50aWZpY2F0aW9uIENNUyBsb2NhbGUgKHNvdXJjZSBkZSB2XHUwMEU5cml0XHUwMEU5IHByaW5jaXBhbGUpXG4gKiBAcmV0dXJucyB7b2JqZWN0fG51bGx9IEwnb2JqZXQgdXRpbGlzYXRldXIgcydpbCBlc3QgdmFsaWRlLCBzaW5vbiBudWxsXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAvLyBjb25zb2xlLmxvZygnXHVEODNEXHVERDBEIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIGJydXQgZGVwdWlzIGxvY2FsU3RvcmFnZTonLCBjbXNVc2VyKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICBjb25zb2xlLmxvZygnXHUyMTM5XHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIEF1Y3VuIHRva2VuIENNUyBkYW5zIGxvY2FsU3RvcmFnZScpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBwYXJzXHUwMEU5OicsIHtcbiAgICAgICAgICAvLyAgICAgaGFzVG9rZW46ICEhcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5UeXBlOiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5MZW5ndGg6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgLy8gICAgIHRva2VuUHJldmlldzogcGFyc2VkVXNlci50b2tlbiA/IHBhcnNlZFVzZXIudG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogJ04vQScsXG4gICAgICAgICAgLy8gICAgIGhhc0lkOiAhIXBhcnNlZFVzZXIuaWQsXG4gICAgICAgICAgLy8gICAgIGhhc0VtYWlsOiAhIXBhcnNlZFVzZXIuZW1haWwsXG4gICAgICAgICAgLy8gICAgIGJhY2tlbmROYW1lOiBwYXJzZWRVc2VyLmJhY2tlbmROYW1lXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGlmIChwYXJzZWRVc2VyLnRva2VuICYmIHR5cGVvZiBwYXJzZWRVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJiBwYXJzZWRVc2VyLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gQ01TIHZhbGlkZScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyBpbnZhbGlkZSAtIG5ldHRveWFnZScpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignXHUyNzRDIFtnZXRMb2NhbENtc1VzZXJdIERvbm5cdTAwRTllcyBDTVMgY29ycm9tcHVlcyBkYW5zIGxvY2FsU3RvcmFnZS4gTmV0dG95YWdlLi4uJywgZSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOSAoYmFzXHUwMEU5IHN1ciBsZSB0b2tlbiBDTVMpXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gKi9cbmZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZENtcygpIHtcbiAgY29uc29sZS5sb2coJ2dldExvY2FsQ21zVXNlcigpOiAnLCBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbCk7XG4gICAgcmV0dXJuIGdldExvY2FsQ21zVXNlcigpICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgZ2V0QWNjb3VudFxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZXN0IHZcdTAwRTlyaWZpXHUwMEU5XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBzaSBsJ2VtYWlsIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICovXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgIHJldHVybiB1c2VyLmVtYWlsVmVyaWZpY2F0aW9uIHx8IGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBJbXBvc3NpYmxlIGRlIHZcdTAwRTlyaWZpZXIgbFxcJ1x1MDBFOXRhdCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBkXFwnZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEVudm9pZSB1biBlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBcdTAwRTAgbCd1dGlsaXNhdGV1ciBjb25uZWN0XHUwMEU5XG4gKiBAcGFyYW0ge3N0cmluZ30gcmVkaXJlY3RVUkwgLSBVUkwgdmVycyBsYXF1ZWxsZSByZWRpcmlnZXIgYXByXHUwMEU4cyB2XHUwMEU5cmlmaWNhdGlvblxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb25VUkwgPSByZWRpcmVjdFVSTCB8fCBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS92ZXJpZnktZW1haWxgO1xuICAgICAgICBhd2FpdCBhY2NvdW50LmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FwcHdyaXRlQ2xpZW50XSBFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBlbnZveVx1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBsJ2VtYWlsIGF2ZWMgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSB2XHUwMEU5cmlmaWNhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWNyZXQgLSBTZWNyZXQgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgdlx1MDBFOXJpZmlcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gY29tcGxldCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fSBcdTAwQzl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGF2ZWMgdlx1MDBFOXJpZmljYXRpb24gZW1haWxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRpb25TdGF0ZSgpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgY29uc3QgdXNlckVtYWlsID0gZ2V0VXNlckVtYWlsKCk7XG4gICAgY29uc3QgdXNlck5hbWUgPSBnZXRVc2VyTmFtZSgpO1xuXG4gICAgaWYgKCFjbXNVc2VyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZW1haWxWZXJpZmllZCxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxcXCdcdTAwRTl0YXQgZFxcJ2F1dGhlbnRpZmljYXRpb246JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZGVwdWlzIGxlIGxvY2FsU3RvcmFnZVxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyRW1haWwoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIGxlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpIDtcbn1cblxuXG4vKipcbiAqIE5ldHRvaWUgdG91dGVzIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJBdXRoRGF0YSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJyk7XG4gICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXMgbmV0dG95XHUwMEU5ZXNcIik7XG59XG5cbi8qKlxuICogRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIC0gc3VwcHJpbWUgbGEgc2Vzc2lvbiBBcHB3cml0ZSBldCBuZXR0b2llIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBOZXR0b3llciBkJ2Fib3JkIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG5cbiAgICAgICAgLy8gU3VwcHJpbWVyIGxhIHNlc3Npb24gQXBwd3JpdGVcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKCdjdXJyZW50Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIHJcdTAwRTl1c3NpZVwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsIGVycm9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBMZSBub20gZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtvYmplY3R9IGNtc0F1dGggLSBMJ29iamV0IGQnYXV0aGVudGlmaWNhdGlvbiBDTVNcbiAqL1xuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIGVtYWlsKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJywgbmFtZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8vIEV4cG9ydCBkZXMgZm9uY3Rpb25zIHB1YmxpcXVlc1xuZXhwb3J0IHtcbiAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgZ2V0QWNjb3VudCxcbiAgICBnZXRGdW5jdGlvbnMsXG4gICAgZ2V0VGVhbXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMgLFxuICAgIGdldFVzZXJFbWFpbCxcbiAgICBnZXRVc2VyTmFtZSxcbiAgICBjbGVhckF1dGhEYXRhLFxuICAgIHNldEF1dGhEYXRhLFxuICAgIGxvZ291dEdsb2JhbCxcbiAgICBpc0VtYWlsVmVyaWZpZWQsXG4gICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgIHZlcmlmeUVtYWlsLFxuICAgIGdldExvY2FsRW1haWxWZXJpZmljYXRpb25TdGF0dXNcbn07XG5cblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgICAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgICAgIGdldEFjY291bnQsXG4gICAgICAgIGdldEZ1bmN0aW9ucyxcbiAgICAgICAgZ2V0VGVhbXMsXG4gICAgICAgIGdldENvbmZpZyxcbiAgICAgICAgaXNJbml0aWFsaXplZCxcbiAgICAgICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgICAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZENtcyxcbiAgICAgICAgZ2V0VXNlckVtYWlsLFxuICAgICAgICBnZXRVc2VyTmFtZSxcbiAgICAgICAgY2xlYXJBdXRoRGF0YSxcbiAgICAgICAgc2V0QXV0aERhdGEsXG4gICAgICAgIGxvZ291dEdsb2JhbCxcbiAgICAgICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgICAgICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gICAgICAgIHZlcmlmeUVtYWlsLFxuICAgICAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG4gICAgfTtcbn1cbiIsICIvLyBodWdvLWNvb2tib29rLXRoZW1lL2Fzc2V0cy9qcy9pbnZpdGF0aW9uLmpzXG4vLyBDZSBzY3JpcHQgZ1x1MDBFOHJlIGxhIGxvZ2lxdWUgZGUgbGEgcGFnZSBkJ2ludml0YXRpb24gZW4gdXRpbGlzYW50IHVuZSBmb25jdGlvbiBBcHB3cml0ZVxuXG5pbXBvcnQgeyBnZXRBY2NvdW50LCBnZXRUZWFtcywgaXNBdXRoZW50aWNhdGVkQ21zIH0gZnJvbSAnLi9hcHB3cml0ZS1jbGllbnQuanMnO1xuXG4vLyAtLS0gQ09ORklHVVJBVElPTiAtLS1cbmNvbnN0IFRFQU1fSUQgPSBcIjY4OWJmNmZlMDAwNjYyN2Q4OTU5XCJcblxuLy8gUlx1MDBFOWN1cFx1MDBFOHJlIGxlcyBcdTAwRTlsXHUwMEU5bWVudHMgZHUgRE9NXG5jb25zdCBsb2FkaW5nU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludml0YXRpb24tYXV0aC1sb2FkaW5nXCIpO1xuY29uc3QgZGVuaWVkU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludml0YXRpb24tYXV0aC1kZW5pZWRcIik7XG5jb25zdCBncmFudGVkU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludml0YXRpb24tYXV0aC1ncmFudGVkXCIpO1xuY29uc3QgaW52aXRhdGlvbkZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludml0YXRpb24tZm9ybVwiKTtcbmNvbnN0IGludml0YXRpb25FbWFpbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW52aXRhdGlvbi1lbWFpbFwiKTtcbmNvbnN0IGludml0YXRpb25CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludml0YXRpb24tYnV0dG9uXCIpO1xuY29uc3QgZXJyb3JNZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJpbnZpdGF0aW9uLWVycm9yLW1lc3NhZ2VcIik7XG5jb25zdCBzdWNjZXNzTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW52aXRhdGlvbi1zdWNjZXNzLW1lc3NhZ2VcIik7XG5jb25zdCBzcGlubmVyID0gaW52aXRhdGlvbkJ1dHRvbj8ucXVlcnlTZWxlY3RvcihcIi5zcGlubmVyLWJvcmRlclwiKTtcblxuLyoqXG4gKiBBZmZpY2hlIHVuIFx1MDBFOXRhdCBkZSBsJ1VJIGV0IG1hc3F1ZSBsZXMgYXV0cmVzLlxuICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlIC0gTCdcdTAwRTl0YXQgXHUwMEUwIGFmZmljaGVyICgnbG9hZGluZycsICdkZW5pZWQnLCAnZ3JhbnRlZCcpXG4gKi9cbmZ1bmN0aW9uIHNob3dVSVN0YXRlKHN0YXRlKSB7XG4gIGlmIChsb2FkaW5nU3RhdGUpIGxvYWRpbmdTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gKHN0YXRlID09PSAnbG9hZGluZycpID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgaWYgKGRlbmllZFN0YXRlKSBkZW5pZWRTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gKHN0YXRlID09PSAnZGVuaWVkJykgPyAnYmxvY2snIDogJ25vbmUnO1xuICBpZiAoZ3JhbnRlZFN0YXRlKSBncmFudGVkU3RhdGUuc3R5bGUuZGlzcGxheSA9IChzdGF0ZSA9PT0gJ2dyYW50ZWQnKSA/ICdibG9jaycgOiAnbm9uZSc7XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxhIHNvdW1pc3Npb24gZHUgZm9ybXVsYWlyZSBkJ2ludml0YXRpb25cbiAqL1xuaWYgKGludml0YXRpb25Gb3JtKSB7XG4gIGludml0YXRpb25Gb3JtLmFkZEV2ZW50TGlzdGVuZXIoXCJzdWJtaXRcIiwgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlIGxlcyBtZXNzYWdlc1xuICAgIGlmIChlcnJvck1lc3NhZ2UpIGVycm9yTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgaWYgKHN1Y2Nlc3NNZXNzYWdlKSBzdWNjZXNzTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cbiAgICAvLyBBZmZpY2hlIGxlIHNwaW5uZXIgZXQgZFx1MDBFOXNhY3RpdmUgbGUgYm91dG9uXG4gICAgaWYgKHNwaW5uZXIpIHNwaW5uZXIuc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lLWJsb2NrXCI7XG4gICAgaWYgKGludml0YXRpb25CdXR0b24pIGludml0YXRpb25CdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gTmV0dG9pZSBldCB2YWxpZGUgbCdlbWFpbFxuICAgIGNvbnN0IGVtYWlsID0gaW52aXRhdGlvbkVtYWlsLnZhbHVlLnRyaW0oKTtcblxuICAgIC8vIFZhbGlkYXRpb24gY1x1MDBGNHRcdTAwRTkgY2xpZW50IGRlIGwnZW1haWxcbiAgICBpZiAoIWlzVmFsaWRFbWFpbChlbWFpbCkpIHtcbiAgICAgIGlmIChlcnJvck1lc3NhZ2UpIHtcbiAgICAgICAgZXJyb3JNZXNzYWdlLnRleHRDb250ZW50ID0gYEwnYWRyZXNzZSBlbWFpbCBcIiR7ZW1haWx9XCIgbidlc3QgcGFzIHZhbGlkZS4gVmV1aWxsZXogdlx1MDBFOXJpZmllciBsZSBmb3JtYXQgZGUgbCdlbWFpbCAoZXhlbXBsZUBkb21haW5lLmNvbSkuYDtcbiAgICAgICAgZXJyb3JNZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICB9XG5cbiAgICAgIC8vIE1hc3F1ZSBsZSBzcGlubmVyIGV0IHJcdTAwRTlhY3RpdmUgbGUgYm91dG9uXG4gICAgICBpZiAoc3Bpbm5lcikgc3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICBpZiAoaW52aXRhdGlvbkJ1dHRvbikgaW52aXRhdGlvbkJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyAxLiBWXHUwMEU5cmlmaWVyIHF1ZSBsJ3V0aWxpc2F0ZXVyIGVzdCBiaWVuIGNvbm5lY3RcdTAwRTkgKGltcG9ydGFudCBwb3VyIGxlcyBwZXJtaXNzaW9ucylcbiAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICBjb25zdCBjdXJyZW50VXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlV0aWxpc2F0ZXVyIGNvbm5lY3RcdTAwRTkgZXQgYXV0b3Jpc1x1MDBFOTpcIiwgY3VycmVudFVzZXIuZW1haWwpO1xuXG4gICAgICAvLyAyLiBBcHBlbGVyIGRpcmVjdGVtZW50IGwnQVBJIFRlYW1zIHBvdXIgY3JcdTAwRTllciBsJ2ludml0YXRpb25cbiAgICAgIC8vIGNvbnNvbGUubG9nKGBFbnZvaSBkZSBsJ2ludml0YXRpb24gXHUwMEUwICR7ZW1haWx9IHBvdXIgbCdcdTAwRTlxdWlwZSAke1RFQU1fSUR9YCk7XG5cbiAgICAgIGNvbnN0IHRlYW1zID0gYXdhaXQgZ2V0VGVhbXMoKTtcbiAgICAgIGF3YWl0IHRlYW1zLmNyZWF0ZU1lbWJlcnNoaXAoXG4gICAgICAgIFRFQU1fSUQsXG4gICAgICAgIFsnb3duZXInXSwgLy8gUlx1MDBGNGxlIGRvbm5cdTAwRTkgXHUwMEUwIGxhIHBlcnNvbm5lIGludml0XHUwMEU5ZS4gTWV0dGV6ICdvd25lcicgcG91ciBxdSdpbHMgcHVpc3NlbnQgaW52aXRlciBcdTAwRTAgbGV1ciB0b3VyLlxuICAgICAgICBlbWFpbCxcbiAgICAgICAgdW5kZWZpbmVkLCAvLyB1c2VySWQgKG5vbiByZXF1aXMgcG91ciB1bmUgaW52aXRhdGlvbiBwYXIgZW1haWwpXG4gICAgICAgIHVuZGVmaW5lZCwgLy8gcGhvbmUgKG5vbiByZXF1aXMpXG4gICAgICAgIGAke3dpbmRvdy5sb2NhdGlvbi5vcmlnaW59L2FjY2VwdC1pbnZpdGF0aW9uYCAvLyBVUkwgZGUgcmVkaXJlY3Rpb24gYXByXHUwMEU4cyBhY2NlcHRhdGlvblxuICAgICAgKTtcblxuICAgICAgLy8gMy4gQWZmaWNoZXIgbGUgbWVzc2FnZSBkZSBzdWNjXHUwMEU4c1xuICAgICAgaWYgKHN1Y2Nlc3NNZXNzYWdlKSB7XG4gICAgICAgIHN1Y2Nlc3NNZXNzYWdlLnRleHRDb250ZW50ID0gYEwnaW52aXRhdGlvbiBhIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIGF2ZWMgc3VjY1x1MDBFOHMgXHUwMEUwICR7ZW1haWx9ICFgO1xuICAgICAgICBzdWNjZXNzTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgfVxuICAgICAgaW52aXRhdGlvbkZvcm0ucmVzZXQoKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiRXJyZXVyIGxvcnMgZGUgbCdlbnZvaSBkZSBsJ2ludml0YXRpb246XCIsIGVycm9yKTtcbiAgICAgIGxldCBlcnJvck1zZyA9IFwiVW5lIGVycmV1ciBlc3Qgc3VydmVudWUuXCI7XG5cbiAgICAgIGlmIChlcnJvci5jb2RlID09PSA0MDEpIHsgLy8gVW5hdXRob3JpemVkXG4gICAgICAgIGVycm9yTXNnID0gXCJWb3VzIG4nYXZleiBwYXMgbGEgcGVybWlzc2lvbiBkJ2ludml0ZXIgZGVzIG1lbWJyZXMuIFNldWxzIGxlcyBwcm9wcmlcdTAwRTl0YWlyZXMgZGUgbCdcdTAwRTlxdWlwZSBsZSBwZXV2ZW50LlwiO1xuICAgICAgfSBlbHNlIGlmIChlcnJvci5jb2RlID09PSA0MDkpIHsgLy8gQ29uZmxpY3RcbiAgICAgICAgZXJyb3JNc2cgPSBcIkNldHRlIHBlcnNvbm5lIGVzdCBkXHUwMEU5alx1MDBFMCBtZW1icmUgZGUgbCdcdTAwRTlxdWlwZSBvdSBhIGRcdTAwRTlqXHUwMEUwIHVuZSBpbnZpdGF0aW9uIGVuIGF0dGVudGUuXCI7XG4gICAgICB9IGVsc2UgaWYgKGVycm9yLm1lc3NhZ2UpIHtcbiAgICAgICAgZXJyb3JNc2cgPSBlcnJvci5tZXNzYWdlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXJyb3JNZXNzYWdlKSB7XG4gICAgICAgIGVycm9yTWVzc2FnZS50ZXh0Q29udGVudCA9IGVycm9yTXNnO1xuICAgICAgICBlcnJvck1lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgaWYgKHNwaW5uZXIpIHNwaW5uZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgaWYgKGludml0YXRpb25CdXR0b24pIGludml0YXRpb25CdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xufVxuXG5cblxuLyoqXG4gKiBWYWxpZGUgbGUgZm9ybWF0IGQndW5lIGFkcmVzc2UgZW1haWxcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgXHUwMEUwIHZhbGlkZXJcbiAqIEByZXR1cm5zIHtib29sZWFufSAtIFRydWUgc2kgbCdlbWFpbCBlc3QgdmFsaWRlLCBmYWxzZSBzaW5vblxuICovXG5mdW5jdGlvbiBpc1ZhbGlkRW1haWwoZW1haWwpIHtcbiAgLy8gVlx1MDBFOXJpZmllIHF1ZSBsJ2VtYWlsIG4nZXN0IHBhcyB2aWRlXG4gIGlmICghZW1haWwgfHwgZW1haWwubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gTmV0dG9pZSBsJ2VtYWlsIGRlcyBlc3BhY2VzIGVuIGRcdTAwRTlidXQvZmluXG4gIGVtYWlsID0gZW1haWwudHJpbSgpO1xuXG4gIC8vIFZcdTAwRTlyaWZpZSBxdSdpbCBuJ3kgYSBwYXMgZCdlc3BhY2VzIGRhbnMgbCdlbWFpbFxuICBpZiAoL1xccy8udGVzdChlbWFpbCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBWXHUwMEU5cmlmaWUgbGEgbG9uZ3VldXIgbWluaW1hbGUgZXQgbWF4aW1hbGVcbiAgaWYgKGVtYWlsLmxlbmd0aCA8IDUgfHwgZW1haWwubGVuZ3RoID4gMjU0KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRXhwcmVzc2lvbiByXHUwMEU5Z3VsaVx1MDBFOHJlIHBvdXIgdmFsaWRlciBsZSBmb3JtYXQgZGUgbCdlbWFpbFxuICAvLyBDb21wYXRpYmxlIGF2ZWMgbGVzIGV4aWdlbmNlcyBkJ0FwcHdyaXRlLCBwbHVzIGZsZXhpYmxlXG4gIGNvbnN0IGVtYWlsUmVnZXggPSAvXlthLXpBLVowLTldKFthLXpBLVowLTkuXystXSpbYS16QS1aMC05XSk/QFthLXpBLVowLTldKFthLXpBLVowLTkuLV0qW2EtekEtWjAtOV0pP1xcLlthLXpBLVpdezIsfSQvO1xuXG4gIC8vIFZcdTAwRTlyaWZpZSBhdXNzaSBxdSdpbCBuJ3kgYSBwYXMgZGUgcG9pbnRzIGNvbnNcdTAwRTljdXRpZnNcbiAgaWYgKGVtYWlsLmluY2x1ZGVzKCcuLicpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIGVtYWlsUmVnZXgudGVzdChlbWFpbCk7XG59XG5cbi8qKlxuICogTG9naXF1ZSBwcmluY2lwYWxlIGV4XHUwMEU5Y3V0XHUwMEU5ZSBhdSBjaGFyZ2VtZW50IGRlIGxhIHBhZ2VcbiAqL1xuYXN5bmMgZnVuY3Rpb24gaW5pdEludml0YXRpb25QYWdlKCkge1xuICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGR1IGNsaWVudCBBcHB3cml0ZVwiKTtcbiAgc2hvd1VJU3RhdGUoJ2xvYWRpbmcnKTtcblxuICB0cnkge1xuICAgIC8vIFZcdTAwRTlyaWZpZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gICAgaWYgKCFpc0F1dGhlbnRpY2F0ZWRDbXMoKSkge1xuICAgICAgc2hvd1VJU3RhdGUoJ2RlbmllZCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFZcdTAwRTlyaWZpZSBsYSBzZXNzaW9uIEFwcHdyaXRlXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICBhd2FpdCBhY2NvdW50LmdldCgpOyAvLyBUZW50ZSBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIGxhIHNlc3Npb24gQXBwd3JpdGUgcG91ciB2XHUwMEU5cmlmaWVyIHNvbiBcdTAwRTl0YXRcbiAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgclx1MDBFOXVzc2llXCIsIGFjY291bnQpO1xuXG4gICAgICBzaG93VUlTdGF0ZSgnZ3JhbnRlZCcpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBTaSBhY2NvdW50LmdldCgpIFx1MDBFOWNob3VlIChwYXIgZXhlbXBsZSwgcGFzIGRlIHNlc3Npb24gYWN0aXZlIG91IHNlc3Npb24gZXhwaXJcdTAwRTllKVxuICAgICAgLy8gY29uc29sZS5sb2coXCJQYXMgZGUgc2Vzc2lvbiBBcHB3cml0ZSBhY3RpdmUgb3Ugc2Vzc2lvbiBpbnZhbGlkZSBwb3VyIGwnaW52aXRhdGlvbi5cIik7XG4gICAgICBzaG93VUlTdGF0ZSgnZGVuaWVkJyk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJldXIgaW5hdHRlbmR1ZSBhdSBjaGFyZ2VtZW50IGRlIGxhIHBhZ2UgZCdpbnZpdGF0aW9uOlwiLCBlcnJvcik7XG4gICAgc2hvd1VJU3RhdGUoJ2RlbmllZCcpO1xuICB9XG59XG5cbi8qKlxuICogR2VzdGlvbiBkdSBjaGFyZ2VtZW50IGR1IHNjcmlwdCBhdmVjIGFzeW5jXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGUgRE9NIGVzdCBkXHUwMEU5alx1MDBFMCBjaGFyZ1x1MDBFOSBvdSBub25cbiAqL1xuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xuICAvLyBMZSBET00gZXN0IGVuY29yZSBlbiBjb3VycyBkZSBjaGFyZ2VtZW50LCBvbiBham91dGUgbCdcdTAwRTljb3V0ZXVyIGQnXHUwMEU5dlx1MDBFOW5lbWVudHNcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGluaXRJbnZpdGF0aW9uUGFnZSk7XG59IGVsc2Uge1xuICAvLyBMZSBET00gZXN0IGRcdTAwRTlqXHUwMEUwIGNoYXJnXHUwMEU5LCBvbiBleFx1MDBFOWN1dGUgZGlyZWN0ZW1lbnRcbiAgaW5pdEludml0YXRpb25QYWdlKCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOztBQUtBLE1BQU0sb0JBQW9CO0FBQzFCLE1BQU0sc0JBQXNCO0FBQzVCLE1BQU0sdUJBQXVCO0FBQzdCLE1BQU0sNkJBQTZCO0FBR25DLE1BQUksU0FBUztBQUNiLE1BQUksVUFBVTtBQUNkLE1BQUksWUFBWTtBQUNoQixNQUFJLHdCQUF3QjtBQU01QixXQUFTLGdCQUFnQixjQUFjLElB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LFdBQVcsS0FBSyxLQUFLO0FBQUEsRUFDOUI7QUFLQSxpQkFBZSxxQkFBcUI7QUFDbEMsWUFBUSxJQUFJLHFEQUFxRDtBQUNqRSxnQkFBWSxTQUFTO0FBRXJCLFFBQUk7QUFFRixVQUFJLENBQUMsbUJBQW1CLEdBQUc7QUFDekIsb0JBQVksUUFBUTtBQUNwQjtBQUFBLE1BQ0Y7QUFHQSxVQUFJO0FBQ0YsY0FBTUEsV0FBVSxNQUFNLFdBQVc7QUFDakMsY0FBTUEsU0FBUSxJQUFJO0FBQ2xCLGdCQUFRLElBQUksc0VBQTZEQSxRQUFPO0FBRWhGLG9CQUFZLFNBQVM7QUFBQSxNQUN2QixTQUFTLE9BQU87QUFHZCxvQkFBWSxRQUFRO0FBQUEsTUFDdEI7QUFBQSxJQUNGLFNBQVMsT0FBTztBQUNkLGNBQVEsTUFBTSw0REFBNEQsS0FBSztBQUMvRSxrQkFBWSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNGO0FBTUEsTUFBSSxTQUFTLGVBQWUsV0FBVztBQUVyQyxhQUFTLGlCQUFpQixvQkFBb0Isa0JBQWtCO0FBQUEsRUFDbEUsT0FBTztBQUVMLHVCQUFtQjtBQUFBLEVBQ3JCOyIsCiAgIm5hbWVzIjogWyJhY2NvdW50IiwgImZ1bmN0aW9ucyIsICJhY2NvdW50IiwgImFjY291bnQiLCAiYWNjb3VudCJdCn0K

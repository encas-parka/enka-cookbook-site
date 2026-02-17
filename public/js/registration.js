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
  document.addEventListener("DOMContentLoaded", () => {
    const REGISTER_FUNCTION_ID = "689d1836002b9b5cfda9";
    const registrationForm = document.getElementById("registration-form");
    const errorMessage = document.getElementById("error-message");
    const successMessage = document.getElementById("success-message");
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
  });
})();

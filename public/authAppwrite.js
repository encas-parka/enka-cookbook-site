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
  var { APPWRITE_FUNCTION_ID: APPWRITE_FUNCTION_ID2, ACCESS_REQUEST_FUNCTION_ID: ACCESS_REQUEST_FUNCTION_ID2 } = getConfig();
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
        APPWRITE_FUNCTION_ID2,
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
        window.location.reload();
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
        ACCESS_REQUEST_FUNCTION_ID2,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibnMtaHVnby1pbXA6L2hvbWUvZ2VvLy5jYWNoZS9odWdvX2NhY2hlL21vZHVsZXMvZmlsZWNhY2hlL21vZHVsZXMvcGtnL21vZC9naXRodWIuY29tL2VuY2FzLXBhcmthL2h1Z28tY29va2Jvb2stdGhlbWVAdjAuMC4wLTIwMjUxMjA0MjE0OTMzLTI1NTg2YzJlOTYxYi9hc3NldHMvanMvYXBwd3JpdGUtY2xpZW50LmpzIiwgIjxzdGRpbj4iXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIGh1Z28tY29va2Jvb2stdGhlbWUvYXNzZXRzL2pzL2FwcHdyaXRlLWNsaWVudC5qc1xuLy8gTW9kdWxlIGNvbW11biBwb3VyIGwnaW5pdGlhbGlzYXRpb24gZXQgbGEgZ2VzdGlvbiBkdSBjbGllbnQgQXBwd3JpdGVcbi8vIFx1MDBDOXZpdGUgbGEgZHVwbGljYXRpb24gZCdpbml0aWFsaXNhdGlvbiBlbnRyZSBhdXRoLXN0YXR1cy5qcyBldCBhdXRoQXBwd3JpdGUuanNcblxuLy8gLS0tIENPTkZJR1VSQVRJT04gQVBQV1JJVEUgLS0tXG5jb25zdCBBUFBXUklURV9FTkRQT0lOVCA9IFwiaHR0cHM6Ly9jbG91ZC5hcHB3cml0ZS5pby92MVwiO1xuY29uc3QgQVBQV1JJVEVfUFJPSkVDVF9JRCA9IFwiNjg5NzI1ODIwMDI0ZTgxNzgxYjdcIjtcbmNvbnN0IEFQUFdSSVRFX0ZVTkNUSU9OX0lEID0gXCI2ODk3NjUwMDAwMmViNWM2ZWU0ZlwiOyAvLyBJRCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC1mdW5jdGlvblxuY29uc3QgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQgPSBcIjY4OWNkZWE1MDAxYTRkNzQ1NDlkXCI7IC8vIElEIGRlIGxhIGZvbmN0aW9uIGQnZW52b2kgZCdlbWFpbFxuXG4vLyBWYXJpYWJsZXMgZ2xvYmFsZXMgcG91ciBsZXMgY2xpZW50cyBBcHB3cml0ZSAoaW5pdGlhbGlzXHUwMEU5ZXMgdW5lIHNldWxlIGZvaXMpXG5sZXQgY2xpZW50ID0gbnVsbDtcbmxldCBhY2NvdW50ID0gbnVsbDtcbmxldCBmdW5jdGlvbnMgPSBudWxsO1xubGV0IGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG5cbi8qKlxuICogQXR0ZW5kIHF1ZSBsZSBTREsgQXBwd3JpdGUgc29pdCBjaGFyZ1x1MDBFOSBldCBpbml0aWFsaXNlIGxlcyBjbGllbnRzXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gUHJvbWlzZSBxdWkgc2Ugclx1MDBFOXNvdXQgcXVhbmQgbCdpbml0aWFsaXNhdGlvbiBlc3QgdGVybWluXHUwMEU5ZVxuICovXG5mdW5jdGlvbiB3YWl0Rm9yQXBwd3JpdGUobWF4QXR0ZW1wdHMgPSA1MCwgaW50ZXJ2YWwgPSAxMDApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBsZXQgYXR0ZW1wdHMgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrQXBwd3JpdGUoKSB7XG4gICAgICAgICAgICBhdHRlbXB0cysrO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYFtBcHB3cml0ZSBDbGllbnRdIFZcdTAwRTlyaWZpY2F0aW9uIFNESyAtIHRlbnRhdGl2ZSAke2F0dGVtcHRzfS8ke21heEF0dGVtcHRzfWApO1xuXG4gICAgICAgICAgICBpZiAod2luZG93LkFwcHdyaXRlICYmIHdpbmRvdy5BcHB3cml0ZS5DbGllbnQgJiYgd2luZG93LkFwcHdyaXRlLkFjY291bnQpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFNESyBBcHB3cml0ZSBjaGFyZ1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ZW1wdHMgPj0gbWF4QXR0ZW1wdHMpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSBhcHJcdTAwRThzIGxlIG5vbWJyZSBtYXhpbXVtIGRlIHRlbnRhdGl2ZXNcIik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIkxlIFNESyBBcHB3cml0ZSBuJ2EgcGFzIHB1IFx1MDBFQXRyZSBjaGFyZ1x1MDBFOS5cIikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrQXBwd3JpdGUsIGludGVydmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoZWNrQXBwd3JpdGUoKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBJbml0aWFsaXNlIGxlcyBjbGllbnRzIEFwcHdyaXRlICh1bmUgc2V1bGUgZm9pcylcbiAqIEByZXR1cm5zIHtQcm9taXNlPHtjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9uc30+fSBMZXMgY2xpZW50cyBpbml0aWFsaXNcdTAwRTlzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHB3cml0ZSgpIHtcbiAgICAvLyBTaSBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTksIHJldG91cm5lciBsZXMgY2xpZW50cyBleGlzdGFudHNcbiAgICBpZiAoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gQ2xpZW50cyBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzLCByXHUwMEU5dXRpbGlzYXRpb25cIik7XG4gICAgICAgIHJldHVybiB7IGNsaWVudCwgYWNjb3VudCwgZnVuY3Rpb25zIH07XG4gICAgfVxuXG4gICAgLy8gU2kgdW5lIGluaXRpYWxpc2F0aW9uIGVzdCBlbiBjb3VycywgYXR0ZW5kcmUgcXUnZWxsZSBzZSB0ZXJtaW5lXG4gICAgaWYgKGluaXRpYWxpemF0aW9uUHJvbWlzZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIEluaXRpYWxpc2F0aW9uIGVuIGNvdXJzLCBhdHRlbnRlLi4uXCIpO1xuICAgICAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xuICAgIH1cblxuICAgIC8vIENvbW1lbmNlciB1bmUgbm91dmVsbGUgaW5pdGlhbGlzYXRpb25cbiAgICBpbml0aWFsaXphdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEXHUwMEU5YnV0IGRlIGwnaW5pdGlhbGlzYXRpb25cIik7XG5cbiAgICAgICAgICAgIC8vIEF0dGVuZHJlIHF1ZSBsZSBTREsgc29pdCBjaGFyZ1x1MDBFOVxuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckFwcHdyaXRlKCk7XG5cbiAgICAgICAgICAgIC8vIEluaXRpYWxpc2VyIGxlcyBjbGllbnRzXG4gICAgICAgICAgICBjb25zdCB7IENsaWVudCwgQWNjb3VudCwgRnVuY3Rpb25zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG5cbiAgICAgICAgICAgIGNsaWVudCA9IG5ldyBDbGllbnQoKVxuICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChBUFBXUklURV9FTkRQT0lOVClcbiAgICAgICAgICAgICAgICAuc2V0UHJvamVjdChBUFBXUklURV9QUk9KRUNUX0lEKTtcblxuICAgICAgICAgICAgYWNjb3VudCA9IG5ldyBBY2NvdW50KGNsaWVudCk7XG4gICAgICAgICAgICBmdW5jdGlvbnMgPSBuZXcgRnVuY3Rpb25zKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gSW5pdGlhbGlzYXRpb24gdGVybWluXHUwMEU5ZSBhdmVjIHN1Y2NcdTAwRThzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBjbGllbnQsIGFjY291bnQsIGZ1bmN0aW9ucyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIltBcHB3cml0ZSBDbGllbnRdIEVycmV1ciBsb3JzIGRlIGwnaW5pdGlhbGlzYXRpb246XCIsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgdmFyaWFibGVzIGVuIGNhcyBkJ2VycmV1clxuICAgICAgICAgICAgY2xpZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGFjY291bnQgPSBudWxsO1xuICAgICAgICAgICAgZnVuY3Rpb25zID0gbnVsbDtcbiAgICAgICAgICAgIGluaXRpYWxpemF0aW9uUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICByZXR1cm4gaW5pdGlhbGl6YXRpb25Qcm9taXNlO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY2xpZW50cyBBcHB3cml0ZSBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2xpZW50LCBhY2NvdW50LCBmdW5jdGlvbnN9Pn0gTGVzIGNsaWVudHMgQXBwd3JpdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXBwd3JpdGVDbGllbnRzKCkge1xuICAgIHJldHVybiBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbn1cblxuLyoqXG4gKiBSXHUwMEU5Y3VwXHUwMEU4cmUgdW5pcXVlbWVudCBsZSBjbGllbnQgQWNjb3VudFxuICogQHJldHVybnMge1Byb21pc2U8QWNjb3VudD59IExlIGNsaWVudCBBY2NvdW50XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEFjY291bnQoKSB7XG4gICAgY29uc3QgeyBhY2NvdW50IH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICBpZiAoYWNjb3VudCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIltBcHB3cml0ZSBDbGllbnRdIFJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgY29tcHRlIEFwcHdyaXRlIHJcdTAwRTl1c3NpZVwiLCBhY2NvdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiW0FwcHdyaXRlIENsaWVudF0gUlx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSBjb21wdGUgQXBwd3JpdGUgXHUwMEU5Y2hvdVx1MDBFOWVcIik7XG4gICAgfVxuICAgIHJldHVybiBhY2NvdW50O1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBGdW5jdGlvbnNcbiAqIEByZXR1cm5zIHtQcm9taXNlPEZ1bmN0aW9ucz59IExlIGNsaWVudCBGdW5jdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0RnVuY3Rpb25zKCkge1xuICAgIGNvbnN0IHsgZnVuY3Rpb25zIH0gPSBhd2FpdCBpbml0aWFsaXplQXBwd3JpdGUoKTtcbiAgICByZXR1cm4gZnVuY3Rpb25zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSB1bmlxdWVtZW50IGxlIGNsaWVudCBUZWFtc1xuICogQHJldHVybnMge1Byb21pc2U8VGVhbXM+fSBMZSBjbGllbnQgVGVhbXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0VGVhbXMoKSB7XG4gICAgY29uc3QgeyBDbGllbnQsIFRlYW1zIH0gPSB3aW5kb3cuQXBwd3JpdGU7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgYXdhaXQgaW5pdGlhbGl6ZUFwcHdyaXRlKCk7XG4gICAgfVxuICAgIGNvbnN0IHRlYW1zID0gbmV3IFRlYW1zKGNsaWVudCk7XG4gICAgcmV0dXJuIHRlYW1zO1xufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsZXMgY29uc3RhbnRlcyBkZSBjb25maWd1cmF0aW9uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBDb25maWd1cmF0aW9uIEFwcHdyaXRlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBBUFBXUklURV9FTkRQT0lOVCxcbiAgICAgICAgQVBQV1JJVEVfUFJPSkVDVF9JRCxcbiAgICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICAgIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEXG4gICAgfTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbGVzIGNsaWVudHMgc29udCBkXHUwMEU5alx1MDBFMCBpbml0aWFsaXNcdTAwRTlzXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsZXMgY2xpZW50cyBzb250IGluaXRpYWxpc1x1MDBFOXNcbiAqL1xuZnVuY3Rpb24gaXNJbml0aWFsaXplZCgpIHtcbiAgICByZXR1cm4gISEoY2xpZW50ICYmIGFjY291bnQgJiYgZnVuY3Rpb25zKTtcbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgbCdhdXRoZW50aWZpY2F0aW9uIENNUyBsb2NhbGUgKHNvdXJjZSBkZSB2XHUwMEU5cml0XHUwMEU5IHByaW5jaXBhbGUpXG4gKiBAcmV0dXJucyB7b2JqZWN0fG51bGx9IEwnb2JqZXQgdXRpbGlzYXRldXIgcydpbCBlc3QgdmFsaWRlLCBzaW5vbiBudWxsXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsQ21zVXNlcigpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICAvLyBjb25zb2xlLmxvZygnXHVEODNEXHVERDBEIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIGJydXQgZGVwdWlzIGxvY2FsU3RvcmFnZTonLCBjbXNVc2VyKTtcblxuICAgIGlmICghY21zVXNlcikge1xuICAgICAgICBjb25zb2xlLmxvZygnXHUyMTM5XHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIEF1Y3VuIHRva2VuIENNUyBkYW5zIGxvY2FsU3RvcmFnZScpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwYXJzZWRVc2VyID0gSlNPTi5wYXJzZShjbXNVc2VyKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ1x1RDgzRFx1REQwRCBbZ2V0TG9jYWxDbXNVc2VyXSBUb2tlbiBwYXJzXHUwMEU5OicsIHtcbiAgICAgICAgICAvLyAgICAgaGFzVG9rZW46ICEhcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5UeXBlOiB0eXBlb2YgcGFyc2VkVXNlci50b2tlbixcbiAgICAgICAgICAvLyAgICAgdG9rZW5MZW5ndGg6IHBhcnNlZFVzZXIudG9rZW4gPyBwYXJzZWRVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgLy8gICAgIHRva2VuUHJldmlldzogcGFyc2VkVXNlci50b2tlbiA/IHBhcnNlZFVzZXIudG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogJ04vQScsXG4gICAgICAgICAgLy8gICAgIGhhc0lkOiAhIXBhcnNlZFVzZXIuaWQsXG4gICAgICAgICAgLy8gICAgIGhhc0VtYWlsOiAhIXBhcnNlZFVzZXIuZW1haWwsXG4gICAgICAgICAgLy8gICAgIGJhY2tlbmROYW1lOiBwYXJzZWRVc2VyLmJhY2tlbmROYW1lXG4gICAgICAgIC8vIH0pO1xuXG4gICAgICAgIGlmIChwYXJzZWRVc2VyLnRva2VuICYmIHR5cGVvZiBwYXJzZWRVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJiBwYXJzZWRVc2VyLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW2dldExvY2FsQ21zVXNlcl0gVG9rZW4gQ01TIHZhbGlkZScpO1xuICAgICAgICAgICAgcmV0dXJuIHBhcnNlZFVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnXHUyNkEwXHVGRTBGIFtnZXRMb2NhbENtc1VzZXJdIFRva2VuIENNUyBpbnZhbGlkZSAtIG5ldHRveWFnZScpO1xuICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignXHUyNzRDIFtnZXRMb2NhbENtc1VzZXJdIERvbm5cdTAwRTllcyBDTVMgY29ycm9tcHVlcyBkYW5zIGxvY2FsU3RvcmFnZS4gTmV0dG95YWdlLi4uJywgZSk7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdzdmVsdGlhLWNtcy51c2VyJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBWXHUwMEU5cmlmaWUgc2kgbCd1dGlsaXNhdGV1ciBlc3QgYXV0aGVudGlmaVx1MDBFOSAoYmFzXHUwMEU5IHN1ciBsZSB0b2tlbiBDTVMpXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBzaSBsJ3V0aWxpc2F0ZXVyIGVzdCBhdXRoZW50aWZpXHUwMEU5XG4gKi9cbmZ1bmN0aW9uIGlzQXV0aGVudGljYXRlZENtcygpIHtcbiAgY29uc29sZS5sb2coJ2dldExvY2FsQ21zVXNlcigpOiAnLCBnZXRMb2NhbENtc1VzZXIoKSAhPT0gbnVsbCk7XG4gICAgcmV0dXJuIGdldExvY2FsQ21zVXNlcigpICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0F1dGhlbnRpY2F0ZWRBcHB3cml0ZSgpIHtcbiAgZ2V0QWNjb3VudFxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBzaSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZXN0IHZcdTAwRTlyaWZpXHUwMEU5XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBzaSBsJ2VtYWlsIGVzdCB2XHUwMEU5cmlmaVx1MDBFOVxuICovXG5hc3luYyBmdW5jdGlvbiBpc0VtYWlsVmVyaWZpZWQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgIHJldHVybiB1c2VyLmVtYWlsVmVyaWZpY2F0aW9uIHx8IGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBJbXBvc3NpYmxlIGRlIHZcdTAwRTlyaWZpZXIgbFxcJ1x1MDBFOXRhdCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBkXFwnZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEVudm9pZSB1biBlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBcdTAwRTAgbCd1dGlsaXNhdGV1ciBjb25uZWN0XHUwMEU5XG4gKiBAcGFyYW0ge3N0cmluZ30gcmVkaXJlY3RVUkwgLSBVUkwgdmVycyBsYXF1ZWxsZSByZWRpcmlnZXIgYXByXHUwMEU4cyB2XHUwMEU5cmlmaWNhdGlvblxuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNlbmRWZXJpZmljYXRpb25FbWFpbChyZWRpcmVjdFVSTCA9IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhY2NvdW50ID0gYXdhaXQgZ2V0QWNjb3VudCgpO1xuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb25VUkwgPSByZWRpcmVjdFVSTCB8fCBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS92ZXJpZnktZW1haWxgO1xuICAgICAgICBhd2FpdCBhY2NvdW50LmNyZWF0ZVZlcmlmaWNhdGlvbih2ZXJpZmljYXRpb25VUkwpO1xuICAgICAgICBjb25zb2xlLmxvZygnW0FwcHdyaXRlQ2xpZW50XSBFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiBlbnZveVx1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFZcdTAwRTlyaWZpZSBsJ2VtYWlsIGF2ZWMgbGVzIHBhcmFtXHUwMEU4dHJlcyBkZSB2XHUwMEU5cmlmaWNhdGlvblxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCAtIElEIGRlIGwndXRpbGlzYXRldXJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWNyZXQgLSBTZWNyZXQgZGUgdlx1MDBFOXJpZmljYXRpb25cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICovXG5hc3luYyBmdW5jdGlvbiB2ZXJpZnlFbWFpbCh1c2VySWQsIHNlY3JldCkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gICAgICAgIGF3YWl0IGFjY291bnQudXBkYXRlVmVyaWZpY2F0aW9uKHVzZXJJZCwgc2VjcmV0KTtcbiAgICAgICAgY29uc29sZS5sb2coJ1tBcHB3cml0ZUNsaWVudF0gRW1haWwgdlx1MDBFOXJpZmlcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBcHB3cml0ZUNsaWVudF0gRXJyZXVyIGxvcnMgZGUgbGEgdlx1MDBFOXJpZmljYXRpb24gZFxcJ2VtYWlsOicsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gY29tcGxldCBkZSBsJ3V0aWxpc2F0ZXVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fSBcdTAwQzl0YXQgZCdhdXRoZW50aWZpY2F0aW9uIGF2ZWMgdlx1MDBFOXJpZmljYXRpb24gZW1haWxcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRpb25TdGF0ZSgpIHtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgY29uc3QgdXNlckVtYWlsID0gZ2V0VXNlckVtYWlsKCk7XG4gICAgY29uc3QgdXNlck5hbWUgPSBnZXRVc2VyTmFtZSgpO1xuXG4gICAgaWYgKCFjbXNVc2VyKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgbmFtZTogbnVsbCxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVtYWlsVmVyaWZpZWQgPSBhd2FpdCBpc0VtYWlsVmVyaWZpZWQoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzQXV0aGVudGljYXRlZDogdHJ1ZSxcbiAgICAgICAgICAgIGlzRW1haWxWZXJpZmllZDogZW1haWxWZXJpZmllZCxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiAhZW1haWxWZXJpZmllZFxuICAgICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0FwcHdyaXRlQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSByXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxcXCdcdTAwRTl0YXQgZFxcJ2F1dGhlbnRpZmljYXRpb246JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB0cnVlLFxuICAgICAgICAgICAgaXNFbWFpbFZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBuYW1lOiB1c2VyTmFtZSxcbiAgICAgICAgICAgIHJlcXVpcmVzQWN0aW9uOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIFJcdTAwRTljdXBcdTAwRThyZSBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgZGVwdWlzIGxlIGxvY2FsU3RvcmFnZVxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBMJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyRW1haWwoKSB7XG4gICAgcmV0dXJuIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG59XG5cbi8qKlxuICogUlx1MDBFOWN1cFx1MDBFOHJlIGxlIG5vbSBkZSBsJ3V0aWxpc2F0ZXVyIGRlcHVpcyBsZSBsb2NhbFN0b3JhZ2VcbiAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gTGUgbm9tIGRlIGwndXRpbGlzYXRldXIgb3UgbnVsbFxuICovXG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpIHtcbiAgICByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzKCkge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZW1haWwtdmVyaWZpY2F0aW9uLXN0YXR1cycpIDtcbn1cblxuXG4vKipcbiAqIE5ldHRvaWUgdG91dGVzIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqL1xuZnVuY3Rpb24gY2xlYXJBdXRoRGF0YSgpIHtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc3ZlbHRpYS1jbXMudXNlcicpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLWVtYWlsJyk7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ2FwcHdyaXRlLXVzZXItbmFtZScpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdlbWFpbC12ZXJpZmljYXRpb24tc3RhdHVzJyk7XG4gICAgLy8gY29uc29sZS5sb2coXCJbQXBwd3JpdGUgQ2xpZW50XSBEb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXMgbmV0dG95XHUwMEU5ZXNcIik7XG59XG5cbi8qKlxuICogRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIC0gc3VwcHJpbWUgbGEgc2Vzc2lvbiBBcHB3cml0ZSBldCBuZXR0b2llIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICogQHJldHVybnMge1Byb21pc2U8dm9pZD59XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvZ291dEdsb2JhbCgpIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBOZXR0b3llciBkJ2Fib3JkIGxlcyBkb25uXHUwMEU5ZXMgbG9jYWxlc1xuICAgICAgICBjbGVhckF1dGhEYXRhKCk7XG5cbiAgICAgICAgLy8gU3VwcHJpbWVyIGxhIHNlc3Npb24gQXBwd3JpdGVcbiAgICAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKCdjdXJyZW50Jyk7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiW0FwcHdyaXRlIENsaWVudF0gRFx1MDBFOWNvbm5leGlvbiBnbG9iYWxlIHJcdTAwRTl1c3NpZVwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oXCJbQXBwd3JpdGUgQ2xpZW50XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsIGVycm9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29uZmlndXJlIGxlcyBkb25uXHUwMEU5ZXMgZCdhdXRoZW50aWZpY2F0aW9uIGxvY2FsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbWFpbCAtIEwnZW1haWwgZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBMZSBub20gZGUgbCd1dGlsaXNhdGV1clxuICogQHBhcmFtIHtvYmplY3R9IGNtc0F1dGggLSBMJ29iamV0IGQnYXV0aGVudGlmaWNhdGlvbiBDTVNcbiAqL1xuZnVuY3Rpb24gc2V0QXV0aERhdGEoZW1haWwsIG5hbWUsIGNtc0F1dGgpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcsIGVtYWlsKTtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJywgbmFtZSk7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInLCBKU09OLnN0cmluZ2lmeShjbXNBdXRoKSk7XG59XG5cbi8vIEV4cG9ydCBkZXMgZm9uY3Rpb25zIHB1YmxpcXVlc1xuZXhwb3J0IHtcbiAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgZ2V0QWNjb3VudCxcbiAgICBnZXRGdW5jdGlvbnMsXG4gICAgZ2V0VGVhbXMsXG4gICAgZ2V0Q29uZmlnLFxuICAgIGlzSW5pdGlhbGl6ZWQsXG4gICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgIGdldExvY2FsQ21zVXNlcixcbiAgICBpc0F1dGhlbnRpY2F0ZWRDbXMgLFxuICAgIGdldFVzZXJFbWFpbCxcbiAgICBnZXRVc2VyTmFtZSxcbiAgICBjbGVhckF1dGhEYXRhLFxuICAgIHNldEF1dGhEYXRhLFxuICAgIGxvZ291dEdsb2JhbCxcbiAgICBpc0VtYWlsVmVyaWZpZWQsXG4gICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsLFxuICAgIHZlcmlmeUVtYWlsLFxuICAgIGdldExvY2FsRW1haWxWZXJpZmljYXRpb25TdGF0dXNcbn07XG5cblxuLy8gRXhwb3NpdGlvbiBnbG9iYWxlIHBvdXIgY29tcGF0aWJpbGl0XHUwMEU5IGF2ZWMgbGVzIHNjcmlwdHMgbm9uLW1vZHVsZVxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgd2luZG93LkFwcHdyaXRlQ2xpZW50ID0ge1xuICAgICAgICBnZXRBcHB3cml0ZUNsaWVudHMsXG4gICAgICAgIGdldEFjY291bnQsXG4gICAgICAgIGdldEZ1bmN0aW9ucyxcbiAgICAgICAgZ2V0VGVhbXMsXG4gICAgICAgIGdldENvbmZpZyxcbiAgICAgICAgaXNJbml0aWFsaXplZCxcbiAgICAgICAgaW5pdGlhbGl6ZUFwcHdyaXRlLFxuICAgICAgICBnZXRMb2NhbENtc1VzZXIsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZENtcyxcbiAgICAgICAgZ2V0VXNlckVtYWlsLFxuICAgICAgICBnZXRVc2VyTmFtZSxcbiAgICAgICAgY2xlYXJBdXRoRGF0YSxcbiAgICAgICAgc2V0QXV0aERhdGEsXG4gICAgICAgIGxvZ291dEdsb2JhbCxcbiAgICAgICAgaXNFbWFpbFZlcmlmaWVkLFxuICAgICAgICBzZW5kVmVyaWZpY2F0aW9uRW1haWwsXG4gICAgICAgIHZlcmlmeUVtYWlsLFxuICAgICAgICBnZXRMb2NhbEVtYWlsVmVyaWZpY2F0aW9uU3RhdHVzXG4gICAgfTtcbn1cbiIsICIvLyBDaGFyZ1x1MDBFOSBwYXIgL2xvZ2luXG5cbmltcG9ydCB7XG4gIGdldEFjY291bnQsXG4gIGdldEZ1bmN0aW9ucyxcbiAgZ2V0Q29uZmlnLFxuICBnZXRMb2NhbENtc1VzZXIsXG4gIGNsZWFyQXV0aERhdGEsXG4gIHNldEF1dGhEYXRhLFxuICBpc0VtYWlsVmVyaWZpZWQsXG4gIHNlbmRWZXJpZmljYXRpb25FbWFpbCxcbiAgdmVyaWZ5RW1haWwsXG59IGZyb20gXCIuL2FwcHdyaXRlLWNsaWVudC5qc1wiO1xuXG4vLyBSXHUwMEU5Y3VwXHUwMEU5cmF0aW9uIGRlIGxhIGNvbmZpZ3VyYXRpb25cbmNvbnN0IHsgQVBQV1JJVEVfRlVOQ1RJT05fSUQsIEFDQ0VTU19SRVFVRVNUX0ZVTkNUSU9OX0lEIH0gPSBnZXRDb25maWcoKTtcblxuLy8gUlx1MDBFOWN1cFx1MDBFOHJlIGxlcyBcdTAwRTlsXHUwMEU5bWVudHMgZHUgRE9NXG5jb25zdCBsb2FkaW5nU3RhdGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxvYWRpbmctc3RhdGVcIik7XG5jb25zdCBsb2dnZWRJblN0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ1c2VyLWxvZ2dlZC1pblwiKTtcbmNvbnN0IGxvZ2dlZE91dFN0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ1c2VyLWxvZ2dlZC1vdXRcIik7XG5jb25zdCBsb2dnZWRPdXRTZWN0aW9ucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibG9nZ2VkLW91dC1zZWN0aW9uc1wiKTtcbmNvbnN0IGxvZ2luRm9ybSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibG9naW4tZm9ybVwiKTtcbmNvbnN0IGxvZ291dEJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibG9nb3V0LWJ1dHRvblwiKTtcbmNvbnN0IGVycm9yTWVzc2FnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZXJyb3ItbWVzc2FnZVwiKTtcbmNvbnN0IGxvZ2luQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsb2dpbi1idXR0b25cIik7XG5jb25zdCBsb2dpblNwaW5uZXIgPSBsb2dpbkJ1dHRvbj8ucXVlcnlTZWxlY3RvcihcIi5zcGlubmVyLWJvcmRlclwiKTtcbmNvbnN0IHVzZXJFbWFpbERpc3BsYXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInVzZXItZW1haWwtZGlzcGxheVwiKTtcbmNvbnN0IHVzZXJFbmNhc0dteCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidXNlci1lbmNhcy1nbXhcIik7XG5jb25zdCB3ZWxjb21lVXNlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwid2VsY29tZS11c2VyXCIpO1xuY29uc3QgaGVhZGVyTG9nZ2VkT3V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJoZWFkZXItbG9nZ2VkLW91dFwiKTtcbmNvbnN0IGhlYWRlckxvZ2dlZEluID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJoZWFkZXItbG9nZ2VkLWluXCIpO1xuY29uc3QgZW1haWxOb3RWZXJpZmllZFN0YXRlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJlbWFpbC1ub3QtdmVyaWZpZWRcIik7XG5jb25zdCByZXNlbmRWZXJpZmljYXRpb25CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcbiAgXCJyZXNlbmQtdmVyaWZpY2F0aW9uXCIsXG4pO1xuY29uc3QgbG9nb3V0QnV0dG9uVW52ZXJpZmllZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFxuICBcImxvZ291dC1idXR0b24tdW52ZXJpZmllZFwiLFxuKTtcbmNvbnN0IGluZm9NZXNzYWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJpbmZvLW1lc3NhZ2VcIik7XG5jb25zdCB1c2VyRW1haWxUb1ZlcmlmeSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidXNlci1lbWFpbC10by12ZXJpZnlcIik7XG5cbmNvbnN0IGZvcm1FbWFpbFB3ZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZW1haWwtcHdkLWxvZ2luXCIpO1xuY29uc3QgZm9ybVBhc3N3b3JkRm9yZ290dGVuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwYXNzd29yZC1mb3Jnb3R0ZW5cIik7XG5jb25zdCBmb3Jnb3RQYXNzd29yZEJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmb3Jnb3QtcGFzc3dvcmQtYnV0dG9uJyk7XG5jb25zdCBwYXNzd29yZEZvcmdvdHRlbkZvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFzc3dvcmQtZm9yZ290dGVuLWZvcm0nKTtcbmNvbnN0IHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1Ym1pdC1wYXNzd29yZC1mb3Jnb3R0ZW4nKTtcbmNvbnN0IHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuU3Bpbm5lciA9IHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuQnV0dG9uPy5xdWVyeVNlbGVjdG9yKCcuc3Bpbm5lci1ib3JkZXInKTtcblxuXG5cbi8qKlxuICogQWZmaWNoZSB1biBcdTAwRTl0YXQgZGUgbCdVSSBldCBtYXNxdWUgbGVzIGF1dHJlcy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZSAtIEwnXHUwMEU5dGF0IFx1MDBFMCBhZmZpY2hlciAoJ2xvYWRpbmcnLCAnbG9nZ2VkSW4nLCAnbG9nZ2VkT3V0JywgJ2VtYWlsTm90VmVyaWZpZWQnLCAnZm9yZ290UGFzc3dvcmQnKVxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgLSBNZXNzYWdlIG9wdGlvbm5lbCBcdTAwRTAgYWZmaWNoZXIgZGFucyBsYSBiYW5uaVx1MDBFOHJlIGQnZXJyZXVyL2luZm8uXG4gKi9cbmZ1bmN0aW9uIHNob3dVSVN0YXRlKHN0YXRlLCBtZXNzYWdlID0gJycpIHtcbiAgLy8gTWFzcXVlciB0b3V0ZXMgbGVzIHNlY3Rpb25zIHByaW5jaXBhbGVzIGQnYWJvcmRcbiAgaWYgKGxvYWRpbmdTdGF0ZSkgbG9hZGluZ1N0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChsb2dnZWRJblN0YXRlKSBsb2dnZWRJblN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChsb2dnZWRPdXRTdGF0ZSkgbG9nZ2VkT3V0U3RhdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgaWYgKGVtYWlsTm90VmVyaWZpZWRTdGF0ZSkgZW1haWxOb3RWZXJpZmllZFN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChsb2dnZWRPdXRTZWN0aW9ucykgbG9nZ2VkT3V0U2VjdGlvbnMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgaWYgKGZvcm1FbWFpbFB3ZCkgZm9ybUVtYWlsUHdkLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChmb3JtUGFzc3dvcmRGb3Jnb3R0ZW4pIGZvcm1QYXNzd29yZEZvcmdvdHRlbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gIC8vIEFmZmljaGVyIGxlcyBzZWN0aW9ucyBlbiBmb25jdGlvbiBkZSBsJ1x1MDBFOXRhdFxuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSAnbG9hZGluZyc6XG4gICAgICBpZiAobG9hZGluZ1N0YXRlKSBsb2FkaW5nU3RhdGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdsb2dnZWRJbic6XG4gICAgICBpZiAobG9nZ2VkSW5TdGF0ZSkgbG9nZ2VkSW5TdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIGlmIChoZWFkZXJMb2dnZWRJbikgaGVhZGVyTG9nZ2VkSW4uc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgIGlmIChoZWFkZXJMb2dnZWRPdXQpIGhlYWRlckxvZ2dlZE91dC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgY29uc3QgYXBwV3JpdGVVc2VyTmFtZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiYXBwd3JpdGUtdXNlci1uYW1lXCIpO1xuICAgICAgaWYgKHVzZXJFbmNhc0dteCAmJiBhcHBXcml0ZVVzZXJOYW1lID09PSBcImVuY2FzLWNvb2tib29rXCIpIHtcbiAgICAgICAgdXNlckVuY2FzR214LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICB9IGVsc2UgaWYgKHdlbGNvbWVVc2VyICYmIGFwcFdyaXRlVXNlck5hbWUpIHtcbiAgICAgICAgd2VsY29tZVVzZXIudGV4dENvbnRlbnQgPSBgQmllbnZlbnVlICR7YXBwV3JpdGVVc2VyTmFtZX1gO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnbG9nZ2VkT3V0JzpcbiAgICAgIGlmIChsb2dnZWRPdXRTdGF0ZSkgbG9nZ2VkT3V0U3RhdGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBpZiAobG9nZ2VkT3V0U2VjdGlvbnMpIGxvZ2dlZE91dFNlY3Rpb25zLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBpZiAoZm9ybUVtYWlsUHdkKSBmb3JtRW1haWxQd2Quc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkT3V0KSBoZWFkZXJMb2dnZWRPdXQuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgIGlmIChoZWFkZXJMb2dnZWRJbikgaGVhZGVyTG9nZ2VkSW4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2VtYWlsTm90VmVyaWZpZWQnOlxuICAgICAgaWYgKGVtYWlsTm90VmVyaWZpZWRTdGF0ZSkgZW1haWxOb3RWZXJpZmllZFN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgaWYgKGxvZ2dlZE91dFNlY3Rpb25zKSBsb2dnZWRPdXRTZWN0aW9ucy5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgaWYgKGhlYWRlckxvZ2dlZE91dCkgaGVhZGVyTG9nZ2VkT3V0LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkSW4pIGhlYWRlckxvZ2dlZEluLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdmb3Jnb3RQYXNzd29yZCc6XG4gICAgICBpZiAobG9nZ2VkT3V0U3RhdGUpIGxvZ2dlZE91dFN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgaWYgKGxvZ2dlZE91dFNlY3Rpb25zKSBsb2dnZWRPdXRTZWN0aW9ucy5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgaWYgKGZvcm1QYXNzd29yZEZvcmdvdHRlbikgZm9ybVBhc3N3b3JkRm9yZ290dGVuLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgaWYgKGhlYWRlckxvZ2dlZE91dCkgaGVhZGVyTG9nZ2VkT3V0LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBpZiAoaGVhZGVyTG9nZ2VkSW4pIGhlYWRlckxvZ2dlZEluLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIC8vIEFmZmljaGVyIGxlIG1lc3NhZ2UgZCdlcnJldXIgc2kgZm91cm5pXG4gIGlmIChlcnJvck1lc3NhZ2UgJiYgbWVzc2FnZSkge1xuICAgIGVycm9yTWVzc2FnZS50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgZXJyb3JNZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICB9IGVsc2UgaWYgKGVycm9yTWVzc2FnZSkge1xuICAgIGVycm9yTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG5cbiAgLy8gR1x1MDBFOXJlciBsZSBtZXNzYWdlIGQnaW5mb3JtYXRpb24gcG91ciBsJ1x1MDBFOXRhdCBlbWFpbE5vdFZlcmlmaWVkXG4gIGlmIChpbmZvTWVzc2FnZSkge1xuICAgIGlmIChzdGF0ZSA9PT0gJ2VtYWlsTm90VmVyaWZpZWQnICYmIG1lc3NhZ2UgJiYgbWVzc2FnZS5pbmNsdWRlcygnc3VjY1x1MDBFOHMnKSkge1xuICAgICAgaW5mb01lc3NhZ2UudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgICAgaW5mb01lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZm9NZXNzYWdlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxhIHNvdW1pc3Npb24gZHUgZm9ybXVsYWlyZSBkZSBtb3QgZGUgcGFzc2Ugb3VibGlcdTAwRTkuXG4gKiBFbnZvaWUgdW4gZW1haWwgZGUgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkZSBtb3QgZGUgcGFzc2UgdmlhIEFwcHdyaXRlLlxuICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBMJ1x1MDBFOXZcdTAwRTluZW1lbnQgZGUgc291bWlzc2lvbiBkdSBmb3JtdWxhaXJlLlxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVQYXNzd29yZEZvcmdvdHRlblN1Ym1pdChldmVudCkge1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICBjb25zb2xlLmxvZygnW0F1dGhBcHB3cml0ZV0gU291bWlzc2lvbiBkdSBmb3JtdWxhaXJlIGRlIG1vdCBkZSBwYXNzZSBvdWJsaVx1MDBFOScpO1xuXG4gIGNvbnN0IGVtYWlsSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW1haWwnKTsgLy8gTCdJRCBkZSBsJ2lucHV0IGVtYWlsIGRhbnMgbGUgZm9ybXVsYWlyZSBcInBhc3N3b3JkLWZvcmdvdHRlbi1mb3JtXCJcbiAgY29uc3QgZW1haWwgPSBlbWFpbElucHV0ID8gZW1haWxJbnB1dC52YWx1ZSA6ICcnO1xuXG4gIGlmICghZW1haWwpIHtcbiAgICBzaG93VUlTdGF0ZSgnZm9yZ290UGFzc3dvcmQnLCAnVmV1aWxsZXogZW50cmVyIHZvdHJlIGFkcmVzc2UgZW1haWwuJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuQnV0dG9uKSBzdWJtaXRQYXNzd29yZEZvcmdvdHRlbkJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdWJtaXRQYXNzd29yZEZvcmdvdHRlblNwaW5uZXIpIHN1Ym1pdFBhc3N3b3JkRm9yZ290dGVuU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gIGlmIChlcnJvck1lc3NhZ2UpIGVycm9yTWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICAvLyBMJ1VSTCBkZSByZWRpcmVjdGlvbiBlc3QgbCdVUkwgb1x1MDBGOSBBcHB3cml0ZSByZWRpcmlnZXJhIGwndXRpbGlzYXRldXIgYXByXHUwMEU4cyBxdSdpbCBhaXQgY2xpcXVcdTAwRTkgc3VyIGxlIGxpZW4gZGFucyBsJ2VtYWlsLlxuICAgIC8vIENldHRlIHBhZ2UgKGUuZy4sIC9yZXNldC1wYXNzd29yZCkgc2VyYSByZXNwb25zYWJsZSBkZSBmaW5hbGlzZXIgbGEgclx1MDBFOWluaXRpYWxpc2F0aW9uIGF2ZWMgdXBkYXRlUmVjb3ZlcnkuXG4gICAgY29uc3QgcmVzZXRVUkwgPSBgJHt3aW5kb3cubG9jYXRpb24ub3JpZ2lufS9yZXNldC1wYXNzd29yZGA7XG4gICAgYXdhaXQgYWNjb3VudC5jcmVhdGVSZWNvdmVyeShlbWFpbCwgcmVzZXRVUkwpO1xuICAgIGNvbnNvbGUubG9nKCdbQXV0aEFwcHdyaXRlXSBFbWFpbCBkZSByXHUwMEU5aW5pdGlhbGlzYXRpb24gZGUgbW90IGRlIHBhc3NlIGVudm95XHUwMEU5LicpO1xuICAgIHNob3dVSVN0YXRlKCdsb2dnZWRPdXQnLCAnVW4gZW1haWwgZGUgclx1MDBFOWluaXRpYWxpc2F0aW9uIGRlIG1vdCBkZSBwYXNzZSBhIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTkgXHUwMEUwIHZvdHJlIGFkcmVzc2UuIFZldWlsbGV6IHZcdTAwRTlyaWZpZXIgdm90cmUgYm9cdTAwRUV0ZSBkZSByXHUwMEU5Y2VwdGlvbi4nKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbQXV0aEFwcHdyaXRlXSBFcnJldXIgbG9ycyBkZSBsXFwnZW52b2kgZGUgbFxcJ2VtYWlsIGRlIHJcdTAwRTlpbml0aWFsaXNhdGlvbjonLCBlcnJvcik7XG4gICAgbGV0IHVzZXJNZXNzYWdlID0gJ1VuZSBlcnJldXIgZXN0IHN1cnZlbnVlIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIGxcXCdlbWFpbCBkZSByXHUwMEU5aW5pdGlhbGlzYXRpb24uJztcbiAgICBpZiAoZXJyb3IucmVzcG9uc2UgJiYgZXJyb3IucmVzcG9uc2UuY29kZSA9PT0gNDA0KSB7XG4gICAgICB1c2VyTWVzc2FnZSA9ICdBdWN1biBjb21wdGUgblxcJ2VzdCBhc3NvY2lcdTAwRTkgXHUwMEUwIGNldHRlIGFkcmVzc2UgZW1haWwuJztcbiAgICB9XG4gICAgc2hvd1VJU3RhdGUoJ2ZvcmdvdFBhc3N3b3JkJywgdXNlck1lc3NhZ2UpO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChzdWJtaXRQYXNzd29yZEZvcmdvdHRlbkJ1dHRvbikgc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5CdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3VibWl0UGFzc3dvcmRGb3Jnb3R0ZW5TcGlubmVyKSBzdWJtaXRQYXNzd29yZEZvcmdvdHRlblNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsYSBuYXZpZ2F0aW9uIHZlcnMgbGUgZm9ybXVsYWlyZSBkZSBtb3QgZGUgcGFzc2Ugb3VibGlcdTAwRTkuXG4gKi9cbmZ1bmN0aW9uIGhhbmRsZUZvcmdvdFBhc3N3b3JkQ2xpY2soZSkge1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHNob3dVSVN0YXRlKCdmb3Jnb3RQYXNzd29yZCcpO1xufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsZSBwcm9jZXNzdXMgZCdhdXRoZW50aWZpY2F0aW9uIENNUyBhcHJcdTAwRThzIHVuZSBjb25uZXhpb24gQXBwd3JpdGUgclx1MDBFOXVzc2llLlxuICogQXBwZWxsZSBsYSBmb25jdGlvbiBBcHB3cml0ZSAnY21zLWF1dGgtZnVuY3Rpb24nIHBvdXIgb2J0ZW5pciB1biB0b2tlbiBDTVMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHNldHVwQ21zQXV0aGVudGljYXRpb24oKSB7XG4gIGNvbnN0IGFjY291bnQgPSBhd2FpdCBnZXRBY2NvdW50KCk7XG4gIGNvbnN0IGZ1bmN0aW9ucyA9IGF3YWl0IGdldEZ1bmN0aW9ucygpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgLy8gY29uc29sZS5sb2coXCJcdTI3MDUgW3NldHVwQ21zQXV0aGVudGljYXRpb25dIFV0aWxpc2F0ZXVyIEFwcHdyaXRlIHJcdTAwRTljdXBcdTAwRTlyXHUwMEU5OlwiLCB1c2VyLmVtYWlsKTtcblxuICAgIGlmICghdXNlci5lbWFpbFZlcmlmaWNhdGlvbikge1xuICAgICAgLy8gY29uc29sZS53YXJuKFwiXHUyNkEwXHVGRTBGIFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBFbWFpbCBub24gdlx1MDBFOXJpZmlcdTAwRTkgcG91cjpcIiwgdXNlci5lbWFpbCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFTUFJTF9OT1RfVkVSSUZJRURcIik7XG4gICAgfVxuXG4gICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHsgZW1haWw6IHVzZXIuZW1haWwgfSk7XG4gICAgLy8gY29uc29sZS5sb2coXCJcdUQ4M0RcdUREMDQgW3NldHVwQ21zQXV0aGVudGljYXRpb25dIEFwcGVsIGRlIGxhIGZvbmN0aW9uIGNtcy1hdXRoIGF2ZWMgcGF5bG9hZDpcIiwgcGF5bG9hZCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBmdW5jdGlvbnMuY3JlYXRlRXhlY3V0aW9uKFxuICAgICAgQVBQV1JJVEVfRlVOQ1RJT05fSUQsXG4gICAgICBwYXlsb2FkLFxuICAgICAgZmFsc2UsIC8vIFBhcyBkZSBsZWN0dXJlXG4gICAgICBgL2Ntcy1hdXRoLyR7dXNlci5lbWFpbH1gLFxuICAgICAgXCJQT1NUXCIsXG4gICAgKTtcblxuICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBFeFx1MDBFOWN1dGlvbiBkZSBsYSBmb25jdGlvbiBBcHB3cml0ZSByXHUwMEU5dXNzaWU6XCIsIHJlc3VsdCk7XG5cbiAgICBjb25zdCByZXNwb25zZURhdGEgPSBKU09OLnBhcnNlKHJlc3VsdC5yZXNwb25zZUJvZHkpO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDBEIFtzZXR1cENtc0F1dGhlbnRpY2F0aW9uXSBSXHUwMEU5cG9uc2UgZGUgbGEgZm9uY3Rpb24gQ01TOlwiLCByZXNwb25zZURhdGEpO1xuXG4gICAgaWYgKHJlc3BvbnNlRGF0YSAmJiByZXNwb25zZURhdGEudG9rZW4pIHtcbiAgICAgIGNvbnN0IGNtc0F1dGggPSB7XG4gICAgICAgIHRva2VuOiByZXNwb25zZURhdGEudG9rZW4sXG4gICAgICAgIGlkOiByZXNwb25zZURhdGEudXNlcl9pZCwgLy8gT3UgbCdJRCByZXRvdXJuXHUwMEU5IHBhciBsYSBmb25jdGlvblxuICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgbmFtZTogdXNlci5uYW1lLFxuICAgICAgICBiYWNrZW5kTmFtZTogXCJhcHB3cml0ZVwiLFxuICAgICAgfTtcbiAgICAgIHNldEF1dGhEYXRhKHVzZXIuZW1haWwsIHVzZXIubmFtZSwgY21zQXV0aCk7XG4gICAgICByZXR1cm4gY21zQXV0aDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgXCJcdTI3NEMgW3NldHVwQ21zQXV0aGVudGljYXRpb25dIFJcdTAwRTlwb25zZSBkZSBsYSBmb25jdGlvbiBDTVMgaW52YWxpZGU6XCIsXG4gICAgICAgIHJlc3BvbnNlRGF0YSxcbiAgICAgICk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUb2tlbiBDTVMgbWFucXVhbnQgZGFucyBsYSByXHUwMEU5cG9uc2UgZGUgbGEgZm9uY3Rpb24uXCIpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgXCJcdTI3NEMgW3NldHVwQ21zQXV0aGVudGljYXRpb25dIEVycmV1ciBkYW5zIHNldHVwQ21zQXV0aGVudGljYXRpb246XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxhIGxvZ2lxdWUgZGUgbGEgcGFnZSBkZSBjb25uZXhpb24gYXUgY2hhcmdlbWVudC5cbiAqIFZcdTAwRTlyaWZpZSBsJ1x1MDBFOXRhdCBkJ2F1dGhlbnRpZmljYXRpb24gZXQgbWV0IFx1MDBFMCBqb3VyIGwnVUkgZW4gY29uc1x1MDBFOXF1ZW5jZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlTG9naW5QYWdlTG9hZCgpIHtcbiAgc2hvd1VJU3RhdGUoXCJsb2FkaW5nXCIpO1xuXG4gIHRyeSB7XG4gICAgaWYgKCF3aW5kb3cuQXBwd3JpdGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJcdTI3NEMgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFNESyBBcHB3cml0ZSBub24gZGlzcG9uaWJsZSAhXCIpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOVwiKTtcbiAgICB9XG4gICAgLy8gY29uc29sZS5sb2coXCJcdTI3MDUgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFNESyBBcHB3cml0ZSBkaXNwb25pYmxlXCIpO1xuXG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBjb25zdCBjbXNVc2VyID0gZ2V0TG9jYWxDbXNVc2VyKCk7XG4gICAgbGV0IGFwcHdyaXRlVXNlciA9IG51bGw7XG5cbiAgICAvLyBEZWJ1ZzogQWZmaWNoZXIgbCdcdTAwRTl0YXQgZHUgdG9rZW4gQ01TXG4gICAgLy8gY29uc29sZS5sb2coXCJcdUQ4M0RcdUREMEQgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFRva2VuIENNUyBicnV0OlwiLCBjbXNVc2VyKTtcblxuICAgIC8vIDEuIFRlbnRlciBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIGxhIHNlc3Npb24gQXBwd3JpdGUgYWN0aXZlXG4gICAgdHJ5IHtcbiAgICAgIGFwcHdyaXRlVXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjcwNSBbaGFuZGxlTG9naW5QYWdlTG9hZF0gU2Vzc2lvbiBBcHB3cml0ZSB0cm91dlx1MDBFOWU6XCIsIGFwcHdyaXRlVXNlci5lbWFpbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gY29uc29sZS5sb2coXCJcdTIxMzlcdUZFMEYgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFBhcyBkZSBzZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZTpcIiwgZS5tZXNzYWdlKTtcbiAgICB9XG5cbiAgICAvLyAyLiBWXHUwMEU5cmlmaWVyIHNpIGxlIHRva2VuIENNUyBlc3QgdmFsaWRlICh2YWxpZGF0aW9uIHBsdXMgcGVybWlzc2l2ZSlcbiAgICBjb25zdCBpc1ZhbGlkQ21zVXNlciA9XG4gICAgICBjbXNVc2VyICYmXG4gICAgICBjbXNVc2VyLnRva2VuICYmXG4gICAgICB0eXBlb2YgY21zVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgY21zVXNlci50b2tlbi50cmltKCkgIT09IFwiXCIgJiZcbiAgICAgIGNtc1VzZXIudG9rZW4gIT09IFwiW11cIiAmJlxuICAgICAgY21zVXNlci50b2tlbiAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgY21zVXNlci50b2tlbiAhPT0gXCJudWxsXCI7XG5cbiAgICAvLyBjb25zb2xlLmxvZyhcIlx1RDgzRFx1REQwRCBbaGFuZGxlTG9naW5QYWdlTG9hZF0gVG9rZW4gQ01TIHZhbGlkZTpcIiwgaXNWYWxpZENtc1VzZXIpO1xuICAgIGlmIChjbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1RDgzRFx1REQwRCBbaGFuZGxlTG9naW5QYWdlTG9hZF0gVG9rZW4gQ01TIGRldGFpbHMgLSB0b2tlbiBsZW5ndGg6XCIsIGNtc1VzZXIudG9rZW4/Lmxlbmd0aCwgXCJpZDpcIiwgY21zVXNlci5pZCk7XG4gICAgfVxuXG4gICAgLy8gMy4gQ2FzIDE6IFNlc3Npb24gQXBwd3JpdGUgRVQgdG9rZW4gQ01TIHZhbGlkZSA9IHV0aWxpc2F0ZXVyIGF1dGhlbnRpZmlcdTAwRTlcbiAgICBpZiAoYXBwd3JpdGVVc2VyICYmIGlzVmFsaWRDbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjcwNSBbaGFuZGxlTG9naW5QYWdlTG9hZF0gQXV0aGVudGlmaWNhdGlvbiBjb21wbFx1MDBFOHRlIC0gQXBwd3JpdGUgKyBDTVNcIik7XG4gICAgICBzZXRBdXRoRGF0YShhcHB3cml0ZVVzZXIuZW1haWwsIGFwcHdyaXRlVXNlci5uYW1lLCBjbXNVc2VyKTtcbiAgICAgIGlmICh1c2VyRW1haWxEaXNwbGF5KVxuICAgICAgICB1c2VyRW1haWxEaXNwbGF5LnRleHRDb250ZW50ID0gYCAoJHthcHB3cml0ZVVzZXIuZW1haWx9KWA7XG4gICAgICBzaG93VUlTdGF0ZShcImxvZ2dlZEluXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDQuIENhcyAyOiBTZXNzaW9uIEFwcHdyaXRlIHZhbGlkZSBNQUlTIHBhcyBkZSB0b2tlbiBDTVMgKG91IGludmFsaWRlKVxuICAgIC8vIFx1MjE5MiBUZW50ZXIgZGUgclx1MDBFOWN1cFx1MDBFOXJlciB1biBub3V2ZWF1IHRva2VuIENNU1xuICAgIGlmIChhcHB3cml0ZVVzZXIgJiYgIWlzVmFsaWRDbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjZBMFx1RkUwRiBbaGFuZGxlTG9naW5QYWdlTG9hZF0gU2Vzc2lvbiBBcHB3cml0ZSBPSyBtYWlzIHRva2VuIENNUyBtYW5xdWFudC9pbnZhbGlkZVwiKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDA0IFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUZW50YXRpdmUgZGUgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSB0b2tlbiBDTVMuLi5cIik7XG4gICAgICAgIGF3YWl0IHNldHVwQ21zQXV0aGVudGljYXRpb24oKTtcbiAgICAgICAgY29uc3QgbmV3Q21zVXNlciA9IGdldExvY2FsQ21zVXNlcigpO1xuICAgICAgICBjb25zdCBpc05ld0Ntc1VzZXJWYWxpZCA9XG4gICAgICAgICAgbmV3Q21zVXNlciAmJlxuICAgICAgICAgIG5ld0Ntc1VzZXIudG9rZW4gJiZcbiAgICAgICAgICB0eXBlb2YgbmV3Q21zVXNlci50b2tlbiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgICAgIG5ld0Ntc1VzZXIudG9rZW4udHJpbSgpICE9PSBcIlwiICYmXG4gICAgICAgICAgbmV3Q21zVXNlci50b2tlbiAhPT0gXCJbXVwiO1xuXG4gICAgICAgIGlmIChpc05ld0Ntc1VzZXJWYWxpZCkge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUb2tlbiBDTVMgclx1MDBFOWN1cFx1MDBFOXJcdTAwRTkgYXZlYyBzdWNjXHUwMEU4c1wiKTtcbiAgICAgICAgICBzZXRBdXRoRGF0YShhcHB3cml0ZVVzZXIuZW1haWwsIGFwcHdyaXRlVXNlci5uYW1lLCBuZXdDbXNVc2VyKTtcbiAgICAgICAgICBpZiAodXNlckVtYWlsRGlzcGxheSlcbiAgICAgICAgICAgIHVzZXJFbWFpbERpc3BsYXkudGV4dENvbnRlbnQgPSBgICgke2FwcHdyaXRlVXNlci5lbWFpbH0pYDtcbiAgICAgICAgICBzaG93VUlTdGF0ZShcImxvZ2dlZEluXCIpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgXCJcdTI3NEMgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIFx1MDBDOWNoZWMgZGUgclx1MDBFOWN1cFx1MDBFOXJhdGlvbiBkdSB0b2tlbiBDTVNcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgZGUgclx1MDBFOWN1cFx1MDBFOXJlciBsZSB0b2tlbiBDTVNcIik7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJcdTI3NEMgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIEVycmV1ciBsb3JzIGRlIGxhIHJcdTAwRTljdXBcdTAwRTlyYXRpb24gZHUgdG9rcGVuIENNUzpcIixcbiAgICAgICAgICBlcnJvcixcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBHZXN0aW9uIHNwXHUwMEU5Y2lmaXF1ZSBkZSBsJ2VycmV1ciBcImVtYWlsIG5vbiB2XHUwMEU5cmlmaVx1MDBFOVwiXG4gICAgICAgIGlmIChlcnJvci5tZXNzYWdlID09PSBcIkVNQUlMX05PVF9WRVJJRklFRFwiKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgXCJcdTI2QTBcdUZFMEYgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIEVtYWlsIG5vbiB2XHUwMEU5cmlmaVx1MDBFOSAtIGFmZmljaGFnZSBkdSBtZXNzYWdlIGFwcHJvcHJpXHUwMEU5XCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgICAvLyBBZmZpY2hlciBsJ2VtYWlsIGRlIGwndXRpbGlzYXRldXIgXHUwMEUwIHZcdTAwRTlyaWZpZXJcbiAgICAgICAgICBpZiAodXNlckVtYWlsVG9WZXJpZnkgJiYgYXBwd3JpdGVVc2VyKSB7XG4gICAgICAgICAgICB1c2VyRW1haWxUb1ZlcmlmeS50ZXh0Q29udGVudCA9IGFwcHdyaXRlVXNlci5lbWFpbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gTmUgcGFzIG5ldHRveWVyIGxhIHNlc3Npb24sIGwndXRpbGlzYXRldXIgZG9pdCBwb3V2b2lyIHBvdXZvaXIgdlx1MDBFOXJpZmllciBzb24gZW1haWxcbiAgICAgICAgICBzaG93VUlTdGF0ZShcImVtYWlsTm90VmVyaWZpZWRcIik7IC8vIFV0aWxpc2VyIGxlIG5vdXZlbCBcdTAwRTl0YXQgc3BcdTAwRTljaWZpcXVlXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTmV0dG95ZXIgbGEgc2Vzc2lvbiBBcHB3cml0ZSBkXHUwMEU5ZmFpbGxhbnRlIHBvdXIgbGVzIGF1dHJlcyBlcnJldXJzXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgYWNjb3VudC5kZWxldGVTZXNzaW9uKFwiY3VycmVudFwiKTtcbiAgICAgICAgfSBjYXRjaCAoY2xlYW51cEVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgXCJFcnJldXIgbG9ycyBkdSBuZXR0b3lhZ2UgZGUgbGEgc2Vzc2lvbiBBcHB3cml0ZTpcIixcbiAgICAgICAgICAgIGNsZWFudXBFcnJvcixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGNsZWFyQXV0aERhdGEoKTtcbiAgICAgICAgc2hvd1VJU3RhdGUoXCJsb2dnZWRPdXRcIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA1LiBDYXMgMzogVG9rZW4gQ01TIHZhbGlkZSBNQUlTIHBhcyBkZSBzZXNzaW9uIEFwcHdyaXRlXG4gICAgLy8gXHUyMTkyIExlIHRva2VuIENNUyBzZXVsIG5lIHN1ZmZpdCBwYXMsIG5ldHRveWVyXG4gICAgaWYgKCFhcHB3cml0ZVVzZXIgJiYgaXNWYWxpZENtc1VzZXIpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNkEwXHVGRTBGIFtoYW5kbGVMb2dpblBhZ2VMb2FkXSBUb2tlbiBDTVMgdmFsaWRlIG1haXMgcGFzIGRlIHNlc3Npb24gQXBwd3JpdGUgLSBuZXR0b3lhZ2VcIik7XG4gICAgICBjbGVhckF1dGhEYXRhKCk7XG4gICAgICBzaG93VUlTdGF0ZShcImxvZ2dlZE91dFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyA2LiBDYXMgNDogTmkgc2Vzc2lvbiBBcHB3cml0ZSBuaSB0b2tlbiBDTVMgdmFsaWRlXG4gICAgLy8gY29uc29sZS5sb2coXCJcdTIxMzlcdUZFMEYgW2hhbmRsZUxvZ2luUGFnZUxvYWRdIEF1Y3VuZSBhdXRoZW50aWZpY2F0aW9uIHRyb3V2XHUwMEU5ZSAtIGFmZmljaGFnZSBkdSBmb3JtdWxhaXJlXCIpO1xuICAgIGNsZWFyQXV0aERhdGEoKTsgLy8gTmV0dG95ZXIgYXUgY2FzIG9cdTAwRjlcbiAgICBzaG93VUlTdGF0ZShcImxvZ2dlZE91dFwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiXHUyNzRDIEVSUkVVUiBDUklUSVFVRSBbaGFuZGxlTG9naW5QYWdlTG9hZF06XCIsIGVycm9yLm1lc3NhZ2UpO1xuICAgIGNsZWFyQXV0aERhdGEoKTtcbiAgICBzaG93VUlTdGF0ZShcImxvZ2dlZE91dFwiKTtcbiAgfVxufVxuXG4vKipcbiAqIEdcdTAwRThyZSBsYSBzb3VtaXNzaW9uIGR1IGZvcm11bGFpcmUgZGUgY29ubmV4aW9uLlxuICogQ3JcdTAwRTllIHVuZSBzZXNzaW9uIEFwcHdyaXRlIGV0IHRlbnRlIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgdW4gdG9rZW4gQ01TLlxuICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBMJ1x1MDBFOXZcdTAwRTluZW1lbnQgZGUgc291bWlzc2lvbiBkdSBmb3JtdWxhaXJlLlxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVMb2dpblN1Ym1pdChldmVudCkge1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICBpZiAobG9naW5CdXR0b24pIGxvZ2luQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKGxvZ2luU3Bpbm5lcikgbG9naW5TcGlubmVyLnN0eWxlLmRpc3BsYXkgPSBcImlubGluZS1ibG9ja1wiO1xuICBpZiAoZXJyb3JNZXNzYWdlKSBlcnJvck1lc3NhZ2Uuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG4gIGNvbnN0IGVtYWlsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsb2dpbi1lbWFpbFwiKS52YWx1ZTtcbiAgY29uc3QgcGFzc3dvcmQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImxvZ2luLXBhc3N3b3JkXCIpLnZhbHVlO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgYWNjb3VudC5jcmVhdGVFbWFpbFBhc3N3b3JkU2Vzc2lvbihlbWFpbCwgcGFzc3dvcmQpO1xuICAgIC8vIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dpblN1Ym1pdF0gU2Vzc2lvbiBBcHB3cml0ZSBjclx1MDBFOVx1MDBFOWU6XCIsIHNlc3Npb24pO1xuXG4gICAgLy8gVGVudGVyIGRlIHJcdTAwRTljdXBcdTAwRTlyZXIgbGUgdG9rZW4gQ01TXG4gICAgYXdhaXQgc2V0dXBDbXNBdXRoZW50aWNhdGlvbigpO1xuXG4gICAgY29uc3QgY21zVXNlciA9IGdldExvY2FsQ21zVXNlcigpO1xuICAgIGlmIChjbXNVc2VyKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlx1MjcwNSBbaGFuZGxlTG9naW5TdWJtaXRdIEF1dGhlbnRpZmljYXRpb24gQ01TIHJcdTAwRTl1c3NpZSBhcHJcdTAwRThzIGxvZ2luLlwiKTtcbiAgICAgIHNldEF1dGhEYXRhKGVtYWlsLCBzZXNzaW9uLnByb3ZpZGVyVWlkLCBjbXNVc2VyKTsgLy8gVXRpbGlzZXIgcHJvdmlkZXJVaWQgY29tbWUgbm9tIHRlbXBvcmFpcmUgc2kgbGUgbm9tIG4nZXN0IHBhcyBkaXNwb25pYmxlXG4gICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7IC8vIFJlY2hhcmdlciBsYSBwYWdlIHBvdXIgYWZmaWNoZXIgbCdcdTAwRTl0YXQgY29ubmVjdFx1MDBFOVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBcIlx1Mjc0QyBbaGFuZGxlTG9naW5TdWJtaXRdIEltcG9zc2libGUgZGUgclx1MDBFOWN1cFx1MDBFOXJlciBsZSB0b2tlbiBDTVMgYXByXHUwMEU4cyBsYSBjb25uZXhpb24uXCIsXG4gICAgICApO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSBkZSByXHUwMEU5Y3VwXHUwMEU5cmVyIGxlIHRva2VuIENNUy5cIik7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJcdTI3NEMgW2hhbmRsZUxvZ2luU3VibWl0XSBFcnJldXIgZGUgY29ubmV4aW9uOlwiLCBlcnJvcik7XG4gICAgbGV0IHVzZXJNZXNzYWdlID0gXCJcdTAwQzljaGVjIGRlIGxhIGNvbm5leGlvbi4gVmV1aWxsZXogdlx1MDBFOXJpZmllciB2b3MgaWRlbnRpZmlhbnRzLlwiO1xuXG4gICAgaWYgKGVycm9yLmNvZGUgPT09IDQwMSB8fCBlcnJvci5jb2RlID09PSA0MDApIHtcbiAgICAgIHVzZXJNZXNzYWdlID0gXCJFbWFpbCBvdSBtb3QgZGUgcGFzc2UgaW5jb3JyZWN0LlwiO1xuICAgIH0gZWxzZSBpZiAoZXJyb3IubWVzc2FnZSA9PT0gXCJFTUFJTF9OT1RfVkVSSUZJRURcIikge1xuICAgICAgdXNlck1lc3NhZ2UgPSBcIlZvdHJlIGVtYWlsIG4nZXN0IHBhcyB2XHUwMEU5cmlmaVx1MDBFOS4gVmV1aWxsZXogdlx1MDBFOXJpZmllciB2b3RyZSBib1x1MDBFRXRlIGRlIHJcdTAwRTljZXB0aW9uIG91IGNsaXF1ZXIgc3VyICdSZW52b3llciBsJ2VtYWlsJy5cIjtcbiAgICAgIHNob3dVSVN0YXRlKFwiZW1haWxOb3RWZXJpZmllZFwiLCB1c2VyTWVzc2FnZSk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChlcnJvci5tZXNzYWdlLmluY2x1ZGVzKFwiQWNjb3VudCB3aXRoIHRoZSBnaXZlbiBlbWFpbCBhbHJlYWR5IGV4aXN0c1wiKSkge1xuICAgICAgICB1c2VyTWVzc2FnZSA9IFwiVW4gY29tcHRlIGF2ZWMgY2V0IGVtYWlsIGV4aXN0ZSBkXHUwMEU5alx1MDBFMC5cIjtcbiAgICB9XG5cbiAgICBzaG93VUlTdGF0ZShcImxvZ2dlZE91dFwiLCB1c2VyTWVzc2FnZSk7IC8vIEFmZmljaGVyIGwnXHUwMEU5dGF0IGRcdTAwRTljb25uZWN0XHUwMEU5IGF2ZWMgdW4gbWVzc2FnZSBkJ2VycmV1clxuICB9IGZpbmFsbHkge1xuICAgIGlmIChsb2dpbkJ1dHRvbikgbG9naW5CdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAobG9naW5TcGlubmVyKSBsb2dpblNwaW5uZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxhIGRcdTAwRTljb25uZXhpb24gZGUgbCd1dGlsaXNhdGV1ci5cbiAqIFN1cHByaW1lIGxhIHNlc3Npb24gQXBwd3JpdGUgZXQgbmV0dG9pZSBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXMuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxvZ291dCgpIHtcbiAgY2xlYXJBdXRoRGF0YSgpOyAvLyBOZXR0b3llciBsZXMgZG9ublx1MDBFOWVzIGxvY2FsZXMgaW1tXHUwMEU5ZGlhdGVtZW50XG4gIHRyeSB7XG4gICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldEFjY291bnQoKTtcbiAgICBhd2FpdCBhY2NvdW50LmRlbGV0ZVNlc3Npb24oXCJjdXJyZW50XCIpO1xuICAgIGNvbnNvbGUubG9nKFwiXHUyNzA1IFtoYW5kbGVMb2dvdXRdIERcdTAwRTljb25uZXhpb24gQXBwd3JpdGUgclx1MDBFOXVzc2llLlwiKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICBcIlx1MjZBMFx1RkUwRiBbaGFuZGxlTG9nb3V0XSBFcnJldXIgbG9ycyBkZSBsYSBkXHUwMEU5Y29ubmV4aW9uIEFwcHdyaXRlIChwZXV0LVx1MDBFQXRyZSBkXHUwMEU5alx1MDBFMCBkXHUwMEU5Y29ubmVjdFx1MDBFOSk6XCIsXG4gICAgICBlcnJvcixcbiAgICApO1xuICB9IGZpbmFsbHkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTsgLy8gUmVjaGFyZ2VyIGxhIHBhZ2UgcG91ciBhZmZpY2hlciBsJ1x1MDBFOXRhdCBkXHUwMEU5Y29ubmVjdFx1MDBFOVxuICB9XG59XG5cbi8qKlxuICogR1x1MDBFOHJlIGxlIHJlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uLlxuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVSZXNlbmRWZXJpZmljYXRpb24oKSB7XG4gIGlmIChyZXNlbmRWZXJpZmljYXRpb25CdXR0b24pIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cbiAgLy8gUlx1MDBFOWN1cFx1MDBFOXJlciBsZSBzcGlubmVyIGV4aXN0YW50IGRhbnMgbGUgYm91dG9uXG4gIGNvbnN0IHJlc2VuZFNwaW5uZXIgPSByZXNlbmRWZXJpZmljYXRpb25CdXR0b24/LnF1ZXJ5U2VsZWN0b3IoJy5zcGlubmVyLWJvcmRlcicpO1xuICBpZiAocmVzZW5kU3Bpbm5lcikgcmVzZW5kU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZW5kVmVyaWZpY2F0aW9uRW1haWwoKTtcbiAgICBzaG93VUlTdGF0ZShcImVtYWlsTm90VmVyaWZpZWRcIiwgXCJFbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbiByZW52b3lcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cyAhIFZldWlsbGV6IHZcdTAwRTlyaWZpZXIgdm90cmUgYm9cdTAwRUV0ZSBkZSByXHUwMEU5Y2VwdGlvbi5cIik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlx1Mjc0QyBbaGFuZGxlUmVzZW5kVmVyaWZpY2F0aW9uXSBFcnJldXIgbG9ycyBkdSByZW52b2kgZGUgbCdlbWFpbCBkZSB2XHUwMEU5cmlmaWNhdGlvbjpcIiwgZXJyb3IpO1xuICAgIHNob3dVSVN0YXRlKFwiZW1haWxOb3RWZXJpZmllZFwiLCBcIkVycmV1ciBsb3JzIGR1IHJlbnZvaSBkZSBsJ2VtYWlsIGRlIHZcdTAwRTlyaWZpY2F0aW9uLiBWZXVpbGxleiByXHUwMEU5ZXNzYXllciBwbHVzIHRhcmQuXCIpO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChyZXNlbmRWZXJpZmljYXRpb25CdXR0b24pIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIC8vIE1hc3F1ZXIgbGUgc3Bpbm5lclxuICAgIGlmIChyZXNlbmRTcGlubmVyKSByZXNlbmRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH1cbn1cblxuLy8gRm9uY3Rpb24gcG91ciBnXHUwMEU5cmVyIGwnZW52b2kgZGUgbGEgZGVtYW5kZSBkJ2FjY1x1MDBFOHNcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUFjY2Vzc1JlcXVlc3QoZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgZm9ybSA9IGV2ZW50LnRhcmdldDtcbiAgY29uc3Qgc3VibWl0QnV0dG9uID0gZm9ybS5xdWVyeVNlbGVjdG9yKCcjRm9ybS1zdWJtaXQnKTtcbiAgY29uc3Qgc3VibWl0U3Bpbm5lciA9IHN1Ym1pdEJ1dHRvbi5xdWVyeVNlbGVjdG9yKCcuc3Bpbm5lci1ib3JkZXInKTtcbiAgY29uc3QgZW1haWxJbnB1dCA9IGZvcm0ucXVlcnlTZWxlY3RvcignI2NvbnRhY3QtZm9ybS1lbWFpbCcpO1xuICBjb25zdCBtZXNzYWdlSW5wdXQgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoJyNjb250YWN0LWZvcm0tbWVzc2FnZScpO1xuICBjb25zdCBmb3JtRmVlZGJhY2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZm9ybS1mZWVkYmFjaycpO1xuXG4gIGlmIChzdWJtaXRCdXR0b24pIHN1Ym1pdEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdWJtaXRTcGlubmVyKSBzdWJtaXRTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgaWYgKGZvcm1GZWVkYmFjaykge1xuICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGZvcm1GZWVkYmFjay5jbGFzc05hbWUgPSAnbWItMyc7IC8vIFJcdTAwRTlpbml0aWFsaXNlciBsZXMgY2xhc3Nlc1xuICB9XG5cbiAgY29uc3QgZW1haWwgPSBlbWFpbElucHV0LnZhbHVlO1xuICBjb25zdCBtZXNzYWdlID0gbWVzc2FnZUlucHV0LnZhbHVlO1xuXG4gIGlmICghZW1haWwgfHwgIW1lc3NhZ2UpIHtcbiAgICBpZiAoZm9ybUZlZWRiYWNrKSB7XG4gICAgICBmb3JtRmVlZGJhY2sudGV4dENvbnRlbnQgPSAnVmV1aWxsZXogcmVtcGxpciB0b3VzIGxlcyBjaGFtcHMuJztcbiAgICAgIGZvcm1GZWVkYmFjay5jbGFzc0xpc3QuYWRkKCdhbGVydCcsICdhbGVydC1kYW5nZXInKTtcbiAgICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG4gICAgaWYgKHN1Ym1pdEJ1dHRvbikgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKHN1Ym1pdFNwaW5uZXIpIHN1Ym1pdFNwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IGZ1bmN0aW9ucyA9IGF3YWl0IGdldEZ1bmN0aW9ucygpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7IGVtYWlsLCBtZXNzYWdlIH0pO1xuICAgIGNvbnNvbGUubG9nKFwiW0FjY2Vzc1JlcXVlc3RdIEFwcGVsIGRlIGxhIGZvbmN0aW9uIGRlIGRlbWFuZGUgZCdhY2NcdTAwRThzIGF2ZWMgcGF5bG9hZDpcIiwgcGF5bG9hZCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBmdW5jdGlvbnMuY3JlYXRlRXhlY3V0aW9uKFxuICAgICAgQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQsXG4gICAgICBwYXlsb2FkLFxuICAgICAgZmFsc2UsIC8vIE5lIHBhcyBsaXJlXG4gICAgICBgL2FjY2Vzcy1yZXF1ZXN0LyR7ZW1haWx9YCxcbiAgICAgIFwiUE9TVFwiLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhcIltBY2Nlc3NSZXF1ZXN0XSBFeFx1MDBFOWN1dGlvbiBkZSBsYSBmb25jdGlvbiBBcHB3cml0ZSByXHUwMEU5dXNzaWU6XCIsIHJlc3VsdCk7XG5cbiAgICBpZiAocmVzdWx0LnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgaWYgKGZvcm1GZWVkYmFjaykge1xuICAgICAgICBmb3JtRmVlZGJhY2sudGV4dENvbnRlbnQgPSAnVm90cmUgZGVtYW5kZSBkXFwnYWNjXHUwMEU4cyBhIFx1MDBFOXRcdTAwRTkgZW52b3lcdTAwRTllIGF2ZWMgc3VjY1x1MDBFOHMgISBOb3VzIHZvdXMgcmVjb250YWN0ZXJvbnMgYmllbnRcdTAwRjR0Lic7XG4gICAgICAgIGZvcm1GZWVkYmFjay5jbGFzc0xpc3QuYWRkKCdhbGVydCcsICdhbGVydC1zdWNjZXNzJyk7XG4gICAgICAgIGZvcm1GZWVkYmFjay5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIH1cbiAgICAgIGZvcm0ucmVzZXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZXJyb3JEYXRhID0gSlNPTi5wYXJzZShyZXN1bHQucmVzcG9uc2VCb2R5KTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvckRhdGEubWVzc2FnZSB8fCBgRXJyZXVyIEFwcHdyaXRlOiAke3Jlc3VsdC5zdGF0dXNDb2RlfWApO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbQWNjZXNzUmVxdWVzdF0gRXJyZXVyIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIGxhIGRlbWFuZGUgZFxcJ2FjY1x1MDBFOHM6JywgZXJyb3IpO1xuICAgIGlmIChmb3JtRmVlZGJhY2spIHtcbiAgICAgIGZvcm1GZWVkYmFjay50ZXh0Q29udGVudCA9IGBFcnJldXIgOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ1VuZSBlcnJldXIgZXN0IHN1cnZlbnVlIGxvcnMgZGUgbFxcJ2Vudm9pIGRlIHZvdHJlIGRlbWFuZGUuJ31gO1xuICAgICAgZm9ybUZlZWRiYWNrLmNsYXNzTGlzdC5hZGQoJ2FsZXJ0JywgJ2FsZXJ0LWRhbmdlcicpO1xuICAgICAgZm9ybUZlZWRiYWNrLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoc3VibWl0QnV0dG9uKSBzdWJtaXRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3VibWl0U3Bpbm5lcikgc3VibWl0U3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG59XG5cblxuLy8gQXR0YWNoZXIgbGVzIFx1MDBFOWNvdXRldXJzIGQnXHUwMEU5dlx1MDBFOW5lbWVudHMgdW5lIGZvaXMgcXVlIGxlIERPTSBlc3QgY2hhcmdcdTAwRTlcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgaGFuZGxlTG9naW5QYWdlTG9hZCgpO1xuXG4gIGlmIChsb2dpbkZvcm0pIHtcbiAgICBsb2dpbkZvcm0uYWRkRXZlbnRMaXN0ZW5lcihcInN1Ym1pdFwiLCBoYW5kbGVMb2dpblN1Ym1pdCk7XG4gIH1cblxuICBpZiAobG9nb3V0QnV0dG9uKSB7XG4gICAgbG9nb3V0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBoYW5kbGVMb2dvdXQpO1xuICB9XG5cbiAgaWYgKGxvZ291dEJ1dHRvblVudmVyaWZpZWQpIHtcbiAgICBsb2dvdXRCdXR0b25VbnZlcmlmaWVkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBoYW5kbGVMb2dvdXQpO1xuICB9XG5cbiAgaWYgKHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbikge1xuICAgIHJlc2VuZFZlcmlmaWNhdGlvbkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgaGFuZGxlUmVzZW5kVmVyaWZpY2F0aW9uKTtcbiAgfVxuXG4gIGlmIChmb3Jnb3RQYXNzd29yZEJ1dHRvbikge1xuICAgIGZvcmdvdFBhc3N3b3JkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlRm9yZ290UGFzc3dvcmRDbGljayk7XG4gIH1cblxuICBpZiAocGFzc3dvcmRGb3Jnb3R0ZW5Gb3JtKSB7XG4gICAgcGFzc3dvcmRGb3Jnb3R0ZW5Gb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGhhbmRsZVBhc3N3b3JkRm9yZ290dGVuU3VibWl0KTtcbiAgfVxuXG4gIGNvbnN0IGFjY2Vzc1JlcXVlc3RGb3JtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjY2Vzcy1yZXF1ZXN0LWZvcm0nKTtcbiAgaWYgKGFjY2Vzc1JlcXVlc3RGb3JtKSB7XG4gICAgYWNjZXNzUmVxdWVzdEZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgaGFuZGxlQWNjZXNzUmVxdWVzdCk7XG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7QUFLQSxNQUFNLG9CQUFvQjtBQUMxQixNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHVCQUF1QjtBQUM3QixNQUFNLDZCQUE2QjtBQUduQyxNQUFJLFNBQVM7QUFDYixNQUFJLFVBQVU7QUFDZCxNQUFJLFlBQVk7QUFDaEIsTUFBSSx3QkFBd0I7QUFNNUIsV0FBUyxnQkFBZ0IsY0FBYyxJQUFJLFdBQVcsS0FBSztBQUN2RCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUNwQyxVQUFJLFdBQVc7QUFFZixlQUFTLGdCQUFnQjtBQUNyQjtBQUdBLFlBQUksT0FBTyxZQUFZLE9BQU8sU0FBUyxVQUFVLE9BQU8sU0FBUyxTQUFTO0FBRXRFLGtCQUFRO0FBQUEsUUFDWixXQUFXLFlBQVksYUFBYTtBQUNoQyxrQkFBUSxNQUFNLHVGQUFpRjtBQUMvRixpQkFBTyxJQUFJLE1BQU0sK0NBQXlDLENBQUM7QUFBQSxRQUMvRCxPQUFPO0FBQ0gscUJBQVcsZUFBZSxRQUFRO0FBQUEsUUFDdEM7QUFBQSxNQUNKO0FBRUEsb0JBQWM7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O0FBRUEsY0FBUSxJQUFJLG9FQUE4RCxNQUFNO0FBRWhGLFVBQUksT0FBTyxlQUFlLEtBQUs7QUFDN0IsWUFBSSxjQUFjO0FBQ2hCLHVCQUFhLGNBQWM7QUFDM0IsdUJBQWEsVUFBVSxJQUFJLFNBQVMsZUFBZTtBQUNuRCx1QkFBYSxNQUFNLFVBQVU7QUFBQSxRQUMvQjtBQUNBLGFBQUssTUFBTTtBQUFBLE1BQ2IsT0FBTztBQUNMLGNBQU0sWUFBWSxLQUFLLE1BQU0sT0FBTyxZQUFZO0FBQ2hELGNBQU0sSUFBSSxNQUFNLFVBQVUsV0FBVyxvQkFBb0IsT0FBTyxVQUFVLEVBQUU7QUFBQSxNQUM5RTtBQUFBLElBQ0YsU0FBUyxPQUFPO0FBQ2QsY0FBUSxNQUFNLG9FQUFtRSxLQUFLO0FBQ3RGLFVBQUksY0FBYztBQUNoQixxQkFBYSxjQUFjLFlBQVksTUFBTSxXQUFXLDJEQUE0RDtBQUNwSCxxQkFBYSxVQUFVLElBQUksU0FBUyxjQUFjO0FBQ2xELHFCQUFhLE1BQU0sVUFBVTtBQUFBLE1BQy9CO0FBQUEsSUFDRixVQUFFO0FBQ0EsVUFBSSxhQUFjLGNBQWEsV0FBVztBQUMxQyxVQUFJLGNBQWUsZUFBYyxNQUFNLFVBQVU7QUFBQSxJQUNuRDtBQUFBLEVBQ0Y7QUFJQSxXQUFTLGlCQUFpQixvQkFBb0IsTUFBTTtBQUNsRCx3QkFBb0I7QUFFcEIsUUFBSSxXQUFXO0FBQ2IsZ0JBQVUsaUJBQWlCLFVBQVUsaUJBQWlCO0FBQUEsSUFDeEQ7QUFFQSxRQUFJLGNBQWM7QUFDaEIsbUJBQWEsaUJBQWlCLFNBQVMsWUFBWTtBQUFBLElBQ3JEO0FBRUEsUUFBSSx3QkFBd0I7QUFDMUIsNkJBQXVCLGlCQUFpQixTQUFTLFlBQVk7QUFBQSxJQUMvRDtBQUVBLFFBQUksMEJBQTBCO0FBQzVCLCtCQUF5QixpQkFBaUIsU0FBUyx3QkFBd0I7QUFBQSxJQUM3RTtBQUVBLFFBQUksc0JBQXNCO0FBQ3hCLDJCQUFxQixpQkFBaUIsU0FBUyx5QkFBeUI7QUFBQSxJQUMxRTtBQUVBLFFBQUksdUJBQXVCO0FBQ3pCLDRCQUFzQixpQkFBaUIsVUFBVSw2QkFBNkI7QUFBQSxJQUNoRjtBQUVBLFVBQU0sb0JBQW9CLFNBQVMsZUFBZSxxQkFBcUI7QUFDdkUsUUFBSSxtQkFBbUI7QUFDckIsd0JBQWtCLGlCQUFpQixVQUFVLG1CQUFtQjtBQUFBLElBQ2xFO0FBQUEsRUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJhY2NvdW50IiwgImZ1bmN0aW9ucyIsICJhY2NvdW50IiwgImFjY291bnQiLCAiQVBQV1JJVEVfRlVOQ1RJT05fSUQiLCAiQUNDRVNTX1JFUVVFU1RfRlVOQ1RJT05fSUQiLCAiYWNjb3VudCIsICJmdW5jdGlvbnMiXQp9Cg==

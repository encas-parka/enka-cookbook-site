(() => {
  // <stdin>
  window.debugAuth = async function() {
    console.log("\u{1F527} === DIAGNOSTIC D'AUTHENTIFICATION ===");
    console.log("\u{1F4CB} 1. V\xC9RIFICATION DES D\xC9PENDANCES");
    console.log("   - SDK Appwrite disponible:", !!window.Appwrite);
    console.log("   - AppwriteClient module disponible:", !!window.AppwriteClient);
    if (!window.Appwrite) {
      console.error("\u274C SDK Appwrite non charg\xE9 - arr\xEAt du diagnostic");
      return;
    }
    console.log("\u{1F4CB} 2. \xC9TAT DU LOCALSTORAGE");
    const cmsUserRaw = localStorage.getItem("sveltia-cms.user");
    const appwriteEmail = localStorage.getItem("appwrite-user-email");
    const appwriteName = localStorage.getItem("appwrite-user-name");
    console.log("   - sveltia-cms.user (brut):", cmsUserRaw);
    console.log("   - appwrite-user-email:", appwriteEmail);
    console.log("   - appwrite-user-name:", appwriteName);
    console.log("\u{1F4CB} 3. VALIDATION DU TOKEN CMS");
    let cmsUser = null;
    let cmsTokenValid = false;
    if (cmsUserRaw) {
      try {
        cmsUser = JSON.parse(cmsUserRaw);
        console.log("   - Token CMS pars\xE9:", {
          hasToken: !!cmsUser.token,
          tokenType: typeof cmsUser.token,
          tokenLength: cmsUser.token ? cmsUser.token.length : 0,
          tokenPreview: cmsUser.token ? cmsUser.token.substring(0, 30) + "..." : "N/A",
          hasId: !!cmsUser.id,
          id: cmsUser.id,
          hasEmail: !!cmsUser.email,
          email: cmsUser.email,
          hasLogin: !!cmsUser.login,
          login: cmsUser.login,
          backendName: cmsUser.backendName
        });
        cmsTokenValid = cmsUser && cmsUser.token && typeof cmsUser.token === "string" && cmsUser.token.trim() !== "" && cmsUser.token !== "[]" && cmsUser.token !== "undefined" && cmsUser.token !== "null";
        console.log("   - Token CMS valide selon validation actuelle:", cmsTokenValid);
      } catch (e) {
        console.error("   - Erreur de parsing du token CMS:", e);
      }
    } else {
      console.log("   - Aucun token CMS dans localStorage");
    }
    console.log("\u{1F4CB} 4. V\xC9RIFICATION SESSION APPWRITE");
    let appwriteUser = null;
    let appwriteSessionValid = false;
    try {
      if (window.AppwriteClient) {
        const account = await window.AppwriteClient.getAccount();
        appwriteUser = await account.get();
        appwriteSessionValid = true;
        console.log("   - Session Appwrite active:", {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          name: appwriteUser.name,
          emailVerification: appwriteUser.emailVerification,
          status: appwriteUser.status
        });
      } else {
        console.log("   - AppwriteClient non disponible, tentative directe...");
        const client = new window.Appwrite.Client().setEndpoint("https://cloud.appwrite.io/v1").setProject("689725820024e81781b7");
        const account = new window.Appwrite.Account(client);
        appwriteUser = await account.get();
        appwriteSessionValid = true;
        console.log("   - Session Appwrite active (directe):", {
          id: appwriteUser.$id,
          email: appwriteUser.email,
          name: appwriteUser.name
        });
      }
    } catch (e) {
      console.log("   - Pas de session Appwrite active:", e.message);
    }
    console.log("\u{1F4CB} 5. TEST DE LA FONCTION CMS-AUTH");
    if (appwriteSessionValid) {
      try {
        const functions = window.AppwriteClient ? await window.AppwriteClient.getFunctions() : new window.Appwrite.Functions(new window.Appwrite.Client().setEndpoint("https://cloud.appwrite.io/v1").setProject("689725820024e81781b7"));
        console.log("   - Appel de la fonction cms-auth...");
        const response = await functions.createExecution(
          "68976500002eb5c6ee4f",
          "",
          false
        );
        console.log("   - R\xE9ponse de la fonction:", {
          statusCode: response.responseStatusCode,
          responseBody: response.responseBody
        });
        if (response.responseStatusCode === 200) {
          const functionResult = JSON.parse(response.responseBody);
          console.log("   - Contenu de la r\xE9ponse:", {
            hasToken: !!functionResult.token,
            tokenLength: functionResult.token ? functionResult.token.length : 0,
            tokenPreview: functionResult.token ? functionResult.token.substring(0, 30) + "..." : "N/A",
            backendName: functionResult.backendName,
            id: functionResult.id,
            email: functionResult.email,
            login: functionResult.login
          });
        }
      } catch (e) {
        console.error("   - Erreur lors de l'appel de la fonction cms-auth:", e);
      }
    } else {
      console.log("   - Session Appwrite requise pour tester la fonction cms-auth");
    }
    console.log("\u{1F4CB} 6. R\xC9SUM\xC9 ET RECOMMANDATIONS");
    console.log("   - Session Appwrite valide:", appwriteSessionValid);
    console.log("   - Token CMS valide:", cmsTokenValid);
    console.log("   - \xC9tat d'authentification coh\xE9rent:", appwriteSessionValid && cmsTokenValid);
    if (!appwriteSessionValid && !cmsTokenValid) {
      console.log("   \u2705 \xC9tat normal : utilisateur non connect\xE9");
    } else if (appwriteSessionValid && cmsTokenValid) {
      console.log("   \u2705 \xC9tat normal : utilisateur authentifi\xE9");
    } else if (appwriteSessionValid && !cmsTokenValid) {
      console.log("   \u26A0\uFE0F Probl\xE8me : session Appwrite OK mais token CMS manquant/invalide");
      console.log("   \u2192 La fonction setupCmsAuthentication devrait \xEAtre appel\xE9e");
    } else {
      console.log("   \u26A0\uFE0F Probl\xE8me : token CMS pr\xE9sent mais pas de session Appwrite");
      console.log("   \u2192 Le token CMS devrait \xEAtre nettoy\xE9");
    }
    console.log("\u{1F527} === FIN DU DIAGNOSTIC ===");
  };
  window.clearAllAuth = function() {
    console.log("\u{1F9F9} Nettoyage complet de l'authentification...");
    localStorage.removeItem("sveltia-cms.user");
    localStorage.removeItem("appwrite-user-email");
    localStorage.removeItem("appwrite-user-name");
    console.log("\u2705 Nettoyage termin\xE9");
  };
  window.validateCmsToken = function(token) {
    console.log("\u{1F50D} Validation du token CMS:", token);
    const isValid = token && typeof token === "string" && token.trim() !== "" && token !== "[]" && token !== "undefined" && token !== "null";
    console.log("R\xE9sultat de validation:", isValid);
    return isValid;
  };
  console.log("\u{1F527} Scripts de diagnostic charg\xE9s !");
  console.log("Utilisez debugAuth() pour diagnostiquer l'authentification");
  console.log("Utilisez clearAllAuth() pour nettoyer compl\xE8tement");
  console.log("Utilisez validateCmsToken(token) pour tester la validation");
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gaHVnby1jb29rYm9vay10aGVtZS9hc3NldHMvanMvYXV0aC1kZWJ1Zy5qc1xuLy8gU2NyaXB0IGRlIGRpYWdub3N0aWMgcG91ciBsJ2F1dGhlbnRpZmljYXRpb24gLSBcdTAwRTAgdXRpbGlzZXIgZW4gY29uc29sZSBvdSBzdXIgdW5lIHBhZ2UgZGUgZGVidWdcblxuLyoqXG4gKiBGb25jdGlvbiBkZSBkaWFnbm9zdGljIGNvbXBsXHUwMEU4dGUgZGUgbCdcdTAwRTl0YXQgZCdhdXRoZW50aWZpY2F0aW9uXG4gKi9cbndpbmRvdy5kZWJ1Z0F1dGggPSBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcIlx1RDgzRFx1REQyNyA9PT0gRElBR05PU1RJQyBEJ0FVVEhFTlRJRklDQVRJT04gPT09XCIpO1xuXG4gICAgLy8gMS4gVlx1MDBFOXJpZmllciBsYSBkaXNwb25pYmlsaXRcdTAwRTkgZGVzIGRcdTAwRTlwZW5kYW5jZXNcbiAgICBjb25zb2xlLmxvZyhcIlx1RDgzRFx1RENDQiAxLiBWXHUwMEM5UklGSUNBVElPTiBERVMgRFx1MDBDOVBFTkRBTkNFU1wiKTtcbiAgICBjb25zb2xlLmxvZyhcIiAgIC0gU0RLIEFwcHdyaXRlIGRpc3BvbmlibGU6XCIsICEhd2luZG93LkFwcHdyaXRlKTtcbiAgICBjb25zb2xlLmxvZyhcIiAgIC0gQXBwd3JpdGVDbGllbnQgbW9kdWxlIGRpc3BvbmlibGU6XCIsICEhd2luZG93LkFwcHdyaXRlQ2xpZW50KTtcblxuICAgIGlmICghd2luZG93LkFwcHdyaXRlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJcdTI3NEMgU0RLIEFwcHdyaXRlIG5vbiBjaGFyZ1x1MDBFOSAtIGFyclx1MDBFQXQgZHUgZGlhZ25vc3RpY1wiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDIuIFZcdTAwRTlyaWZpZXIgbGUgbG9jYWxTdG9yYWdlXG4gICAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURDQ0IgMi4gXHUwMEM5VEFUIERVIExPQ0FMU1RPUkFHRVwiKTtcbiAgICBjb25zdCBjbXNVc2VyUmF3ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICBjb25zdCBhcHB3cml0ZUVtYWlsID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2FwcHdyaXRlLXVzZXItZW1haWwnKTtcbiAgICBjb25zdCBhcHB3cml0ZU5hbWUgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnYXBwd3JpdGUtdXNlci1uYW1lJyk7XG5cbiAgICBjb25zb2xlLmxvZyhcIiAgIC0gc3ZlbHRpYS1jbXMudXNlciAoYnJ1dCk6XCIsIGNtc1VzZXJSYXcpO1xuICAgIGNvbnNvbGUubG9nKFwiICAgLSBhcHB3cml0ZS11c2VyLWVtYWlsOlwiLCBhcHB3cml0ZUVtYWlsKTtcbiAgICBjb25zb2xlLmxvZyhcIiAgIC0gYXBwd3JpdGUtdXNlci1uYW1lOlwiLCBhcHB3cml0ZU5hbWUpO1xuXG4gICAgLy8gMy4gUGFyc2VyIGV0IHZhbGlkZXIgbGUgdG9rZW4gQ01TXG4gICAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURDQ0IgMy4gVkFMSURBVElPTiBEVSBUT0tFTiBDTVNcIik7XG4gICAgbGV0IGNtc1VzZXIgPSBudWxsO1xuICAgIGxldCBjbXNUb2tlblZhbGlkID0gZmFsc2U7XG5cbiAgICBpZiAoY21zVXNlclJhdykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY21zVXNlciA9IEpTT04ucGFyc2UoY21zVXNlclJhdyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIiAgIC0gVG9rZW4gQ01TIHBhcnNcdTAwRTk6XCIsIHtcbiAgICAgICAgICAgICAgICBoYXNUb2tlbjogISFjbXNVc2VyLnRva2VuLFxuICAgICAgICAgICAgICAgIHRva2VuVHlwZTogdHlwZW9mIGNtc1VzZXIudG9rZW4sXG4gICAgICAgICAgICAgICAgdG9rZW5MZW5ndGg6IGNtc1VzZXIudG9rZW4gPyBjbXNVc2VyLnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgICAgICAgdG9rZW5QcmV2aWV3OiBjbXNVc2VyLnRva2VuID8gY21zVXNlci50b2tlbi5zdWJzdHJpbmcoMCwgMzApICsgJy4uLicgOiAnTi9BJyxcbiAgICAgICAgICAgICAgICBoYXNJZDogISFjbXNVc2VyLmlkLFxuICAgICAgICAgICAgICAgIGlkOiBjbXNVc2VyLmlkLFxuICAgICAgICAgICAgICAgIGhhc0VtYWlsOiAhIWNtc1VzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgZW1haWw6IGNtc1VzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgaGFzTG9naW46ICEhY21zVXNlci5sb2dpbixcbiAgICAgICAgICAgICAgICBsb2dpbjogY21zVXNlci5sb2dpbixcbiAgICAgICAgICAgICAgICBiYWNrZW5kTmFtZTogY21zVXNlci5iYWNrZW5kTmFtZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFZhbGlkYXRpb24gc2Vsb24gbGEgbG9naXF1ZSBhY3R1ZWxsZVxuICAgICAgICAgICAgY21zVG9rZW5WYWxpZCA9IGNtc1VzZXIgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNtc1VzZXIudG9rZW4gJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBjbXNVc2VyLnRva2VuID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY21zVXNlci50b2tlbi50cmltKCkgIT09ICcnICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjbXNVc2VyLnRva2VuICE9PSAnW10nICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjbXNVc2VyLnRva2VuICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY21zVXNlci50b2tlbiAhPT0gJ251bGwnO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIiAgIC0gVG9rZW4gQ01TIHZhbGlkZSBzZWxvbiB2YWxpZGF0aW9uIGFjdHVlbGxlOlwiLCBjbXNUb2tlblZhbGlkKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIiAgIC0gRXJyZXVyIGRlIHBhcnNpbmcgZHUgdG9rZW4gQ01TOlwiLCBlKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiICAgLSBBdWN1biB0b2tlbiBDTVMgZGFucyBsb2NhbFN0b3JhZ2VcIik7XG4gICAgfVxuXG4gICAgLy8gNC4gVlx1MDBFOXJpZmllciBsYSBzZXNzaW9uIEFwcHdyaXRlXG4gICAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURDQ0IgNC4gVlx1MDBDOVJJRklDQVRJT04gU0VTU0lPTiBBUFBXUklURVwiKTtcbiAgICBsZXQgYXBwd3JpdGVVc2VyID0gbnVsbDtcbiAgICBsZXQgYXBwd3JpdGVTZXNzaW9uVmFsaWQgPSBmYWxzZTtcblxuICAgIHRyeSB7XG4gICAgICAgIGlmICh3aW5kb3cuQXBwd3JpdGVDbGllbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCB3aW5kb3cuQXBwd3JpdGVDbGllbnQuZ2V0QWNjb3VudCgpO1xuICAgICAgICAgICAgYXBwd3JpdGVVc2VyID0gYXdhaXQgYWNjb3VudC5nZXQoKTtcbiAgICAgICAgICAgIGFwcHdyaXRlU2Vzc2lvblZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgLSBTZXNzaW9uIEFwcHdyaXRlIGFjdGl2ZTpcIiwge1xuICAgICAgICAgICAgICAgIGlkOiBhcHB3cml0ZVVzZXIuJGlkLFxuICAgICAgICAgICAgICAgIGVtYWlsOiBhcHB3cml0ZVVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgbmFtZTogYXBwd3JpdGVVc2VyLm5hbWUsXG4gICAgICAgICAgICAgICAgZW1haWxWZXJpZmljYXRpb246IGFwcHdyaXRlVXNlci5lbWFpbFZlcmlmaWNhdGlvbixcbiAgICAgICAgICAgICAgICBzdGF0dXM6IGFwcHdyaXRlVXNlci5zdGF0dXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCIgICAtIEFwcHdyaXRlQ2xpZW50IG5vbiBkaXNwb25pYmxlLCB0ZW50YXRpdmUgZGlyZWN0ZS4uLlwiKTtcbiAgICAgICAgICAgIGNvbnN0IGNsaWVudCA9IG5ldyB3aW5kb3cuQXBwd3JpdGUuQ2xpZW50KClcbiAgICAgICAgICAgICAgICAuc2V0RW5kcG9pbnQoXCJodHRwczovL2Nsb3VkLmFwcHdyaXRlLmlvL3YxXCIpXG4gICAgICAgICAgICAgICAgLnNldFByb2plY3QoXCI2ODk3MjU4MjAwMjRlODE3ODFiN1wiKTtcbiAgICAgICAgICAgIGNvbnN0IGFjY291bnQgPSBuZXcgd2luZG93LkFwcHdyaXRlLkFjY291bnQoY2xpZW50KTtcbiAgICAgICAgICAgIGFwcHdyaXRlVXNlciA9IGF3YWl0IGFjY291bnQuZ2V0KCk7XG4gICAgICAgICAgICBhcHB3cml0ZVNlc3Npb25WYWxpZCA9IHRydWU7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIiAgIC0gU2Vzc2lvbiBBcHB3cml0ZSBhY3RpdmUgKGRpcmVjdGUpOlwiLCB7XG4gICAgICAgICAgICAgICAgaWQ6IGFwcHdyaXRlVXNlci4kaWQsXG4gICAgICAgICAgICAgICAgZW1haWw6IGFwcHdyaXRlVXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICBuYW1lOiBhcHB3cml0ZVVzZXIubmFtZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiICAgLSBQYXMgZGUgc2Vzc2lvbiBBcHB3cml0ZSBhY3RpdmU6XCIsIGUubWVzc2FnZSk7XG4gICAgfVxuXG4gICAgLy8gNS4gVGVzdGVyIGxhIGZvbmN0aW9uIGNtcy1hdXRoXG4gICAgY29uc29sZS5sb2coXCJcdUQ4M0RcdURDQ0IgNS4gVEVTVCBERSBMQSBGT05DVElPTiBDTVMtQVVUSFwiKTtcbiAgICBpZiAoYXBwd3JpdGVTZXNzaW9uVmFsaWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9ucyA9IHdpbmRvdy5BcHB3cml0ZUNsaWVudCA/XG4gICAgICAgICAgICAgICAgYXdhaXQgd2luZG93LkFwcHdyaXRlQ2xpZW50LmdldEZ1bmN0aW9ucygpIDpcbiAgICAgICAgICAgICAgICBuZXcgd2luZG93LkFwcHdyaXRlLkZ1bmN0aW9ucyhuZXcgd2luZG93LkFwcHdyaXRlLkNsaWVudCgpXG4gICAgICAgICAgICAgICAgICAgIC5zZXRFbmRwb2ludChcImh0dHBzOi8vY2xvdWQuYXBwd3JpdGUuaW8vdjFcIilcbiAgICAgICAgICAgICAgICAgICAgLnNldFByb2plY3QoXCI2ODk3MjU4MjAwMjRlODE3ODFiN1wiKSk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgLSBBcHBlbCBkZSBsYSBmb25jdGlvbiBjbXMtYXV0aC4uLlwiKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZnVuY3Rpb25zLmNyZWF0ZUV4ZWN1dGlvbihcbiAgICAgICAgICAgICAgICBcIjY4OTc2NTAwMDAyZWI1YzZlZTRmXCIsXG4gICAgICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiICAgLSBSXHUwMEU5cG9uc2UgZGUgbGEgZm9uY3Rpb246XCIsIHtcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiByZXNwb25zZS5yZXNwb25zZVN0YXR1c0NvZGUsXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VCb2R5OiByZXNwb25zZS5yZXNwb25zZUJvZHlcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UucmVzcG9uc2VTdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmdW5jdGlvblJlc3VsdCA9IEpTT04ucGFyc2UocmVzcG9uc2UucmVzcG9uc2VCb2R5KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIiAgIC0gQ29udGVudSBkZSBsYSByXHUwMEU5cG9uc2U6XCIsIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzVG9rZW46ICEhZnVuY3Rpb25SZXN1bHQudG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuTGVuZ3RoOiBmdW5jdGlvblJlc3VsdC50b2tlbiA/IGZ1bmN0aW9uUmVzdWx0LnRva2VuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgICAgICAgICAgIHRva2VuUHJldmlldzogZnVuY3Rpb25SZXN1bHQudG9rZW4gPyBmdW5jdGlvblJlc3VsdC50b2tlbi5zdWJzdHJpbmcoMCwgMzApICsgJy4uLicgOiAnTi9BJyxcbiAgICAgICAgICAgICAgICAgICAgYmFja2VuZE5hbWU6IGZ1bmN0aW9uUmVzdWx0LmJhY2tlbmROYW1lLFxuICAgICAgICAgICAgICAgICAgICBpZDogZnVuY3Rpb25SZXN1bHQuaWQsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiBmdW5jdGlvblJlc3VsdC5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgbG9naW46IGZ1bmN0aW9uUmVzdWx0LmxvZ2luXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCIgICAtIEVycmV1ciBsb3JzIGRlIGwnYXBwZWwgZGUgbGEgZm9uY3Rpb24gY21zLWF1dGg6XCIsIGUpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCIgICAtIFNlc3Npb24gQXBwd3JpdGUgcmVxdWlzZSBwb3VyIHRlc3RlciBsYSBmb25jdGlvbiBjbXMtYXV0aFwiKTtcbiAgICB9XG5cbiAgICAvLyA2LiBSXHUwMEU5c3VtXHUwMEU5IGV0IHJlY29tbWFuZGF0aW9uc1xuICAgIGNvbnNvbGUubG9nKFwiXHVEODNEXHVEQ0NCIDYuIFJcdTAwQzlTVU1cdTAwQzkgRVQgUkVDT01NQU5EQVRJT05TXCIpO1xuICAgIGNvbnNvbGUubG9nKFwiICAgLSBTZXNzaW9uIEFwcHdyaXRlIHZhbGlkZTpcIiwgYXBwd3JpdGVTZXNzaW9uVmFsaWQpO1xuICAgIGNvbnNvbGUubG9nKFwiICAgLSBUb2tlbiBDTVMgdmFsaWRlOlwiLCBjbXNUb2tlblZhbGlkKTtcbiAgICBjb25zb2xlLmxvZyhcIiAgIC0gXHUwMEM5dGF0IGQnYXV0aGVudGlmaWNhdGlvbiBjb2hcdTAwRTlyZW50OlwiLCBhcHB3cml0ZVNlc3Npb25WYWxpZCAmJiBjbXNUb2tlblZhbGlkKTtcblxuICAgIGlmICghYXBwd3JpdGVTZXNzaW9uVmFsaWQgJiYgIWNtc1Rva2VuVmFsaWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCIgICBcdTI3MDUgXHUwMEM5dGF0IG5vcm1hbCA6IHV0aWxpc2F0ZXVyIG5vbiBjb25uZWN0XHUwMEU5XCIpO1xuICAgIH0gZWxzZSBpZiAoYXBwd3JpdGVTZXNzaW9uVmFsaWQgJiYgY21zVG9rZW5WYWxpZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIiAgIFx1MjcwNSBcdTAwQzl0YXQgbm9ybWFsIDogdXRpbGlzYXRldXIgYXV0aGVudGlmaVx1MDBFOVwiKTtcbiAgICB9IGVsc2UgaWYgKGFwcHdyaXRlU2Vzc2lvblZhbGlkICYmICFjbXNUb2tlblZhbGlkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiICAgXHUyNkEwXHVGRTBGIFByb2JsXHUwMEU4bWUgOiBzZXNzaW9uIEFwcHdyaXRlIE9LIG1haXMgdG9rZW4gQ01TIG1hbnF1YW50L2ludmFsaWRlXCIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIiAgIFx1MjE5MiBMYSBmb25jdGlvbiBzZXR1cENtc0F1dGhlbnRpY2F0aW9uIGRldnJhaXQgXHUwMEVBdHJlIGFwcGVsXHUwMEU5ZVwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcIiAgIFx1MjZBMFx1RkUwRiBQcm9ibFx1MDBFOG1lIDogdG9rZW4gQ01TIHByXHUwMEU5c2VudCBtYWlzIHBhcyBkZSBzZXNzaW9uIEFwcHdyaXRlXCIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIiAgIFx1MjE5MiBMZSB0b2tlbiBDTVMgZGV2cmFpdCBcdTAwRUF0cmUgbmV0dG95XHUwMEU5XCIpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDI3ID09PSBGSU4gRFUgRElBR05PU1RJQyA9PT1cIik7XG59O1xuXG4vKipcbiAqIEZvbmN0aW9uIHBvdXIgbmV0dG95ZXIgY29tcGxcdTAwRTh0ZW1lbnQgbCdhdXRoZW50aWZpY2F0aW9uXG4gKi9cbndpbmRvdy5jbGVhckFsbEF1dGggPSBmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcIlx1RDgzRVx1RERGOSBOZXR0b3lhZ2UgY29tcGxldCBkZSBsJ2F1dGhlbnRpZmljYXRpb24uLi5cIik7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3N2ZWx0aWEtY21zLnVzZXInKTtcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnYXBwd3JpdGUtdXNlci1lbWFpbCcpO1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKCdhcHB3cml0ZS11c2VyLW5hbWUnKTtcbiAgICBjb25zb2xlLmxvZyhcIlx1MjcwNSBOZXR0b3lhZ2UgdGVybWluXHUwMEU5XCIpO1xufTtcblxuLyoqXG4gKiBGb25jdGlvbiBwb3VyIHNpbXVsZXIgbGEgdmFsaWRhdGlvbiBkdSB0b2tlbiBDTVNcbiAqL1xud2luZG93LnZhbGlkYXRlQ21zVG9rZW4gPSBmdW5jdGlvbih0b2tlbikge1xuICAgIGNvbnNvbGUubG9nKFwiXHVEODNEXHVERDBEIFZhbGlkYXRpb24gZHUgdG9rZW4gQ01TOlwiLCB0b2tlbik7XG5cbiAgICBjb25zdCBpc1ZhbGlkID0gdG9rZW4gJiZcbiAgICAgICAgICAgICAgICAgICB0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgICAgICAgICAgdG9rZW4udHJpbSgpICE9PSAnJyAmJlxuICAgICAgICAgICAgICAgICAgIHRva2VuICE9PSAnW10nICYmXG4gICAgICAgICAgICAgICAgICAgdG9rZW4gIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgICAgICAgICAgICAgdG9rZW4gIT09ICdudWxsJztcblxuICAgIGNvbnNvbGUubG9nKFwiUlx1MDBFOXN1bHRhdCBkZSB2YWxpZGF0aW9uOlwiLCBpc1ZhbGlkKTtcbiAgICByZXR1cm4gaXNWYWxpZDtcbn07XG5cbmNvbnNvbGUubG9nKFwiXHVEODNEXHVERDI3IFNjcmlwdHMgZGUgZGlhZ25vc3RpYyBjaGFyZ1x1MDBFOXMgIVwiKTtcbmNvbnNvbGUubG9nKFwiVXRpbGlzZXogZGVidWdBdXRoKCkgcG91ciBkaWFnbm9zdGlxdWVyIGwnYXV0aGVudGlmaWNhdGlvblwiKTtcbmNvbnNvbGUubG9nKFwiVXRpbGlzZXogY2xlYXJBbGxBdXRoKCkgcG91ciBuZXR0b3llciBjb21wbFx1MDBFOHRlbWVudFwiKTtcbmNvbnNvbGUubG9nKFwiVXRpbGlzZXogdmFsaWRhdGVDbXNUb2tlbih0b2tlbikgcG91ciB0ZXN0ZXIgbGEgdmFsaWRhdGlvblwiKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7O0FBTUEsU0FBTyxZQUFZLGlCQUFpQjtBQUNoQyxZQUFRLElBQUksaURBQTBDO0FBR3RELFlBQVEsSUFBSSxpREFBb0M7QUFDaEQsWUFBUSxJQUFJLGlDQUFpQyxDQUFDLENBQUMsT0FBTyxRQUFRO0FBQzlELFlBQVEsSUFBSSwwQ0FBMEMsQ0FBQyxDQUFDLE9BQU8sY0FBYztBQUU3RSxRQUFJLENBQUMsT0FBTyxVQUFVO0FBQ2xCLGNBQVEsTUFBTSw0REFBaUQ7QUFDL0Q7QUFBQSxJQUNKO0FBR0EsWUFBUSxJQUFJLHNDQUE0QjtBQUN4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

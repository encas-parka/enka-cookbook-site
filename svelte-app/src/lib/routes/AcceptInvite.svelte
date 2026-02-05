<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { getAppwriteInstances } from "$lib/services/appwrite";
  import { validateInvitation } from "$lib/services/appwrite-invitations";
  import { navigate, route } from "$lib/router";
  import { TriangleAlert } from "@lucide/svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { onDestroy } from "svelte";

  // États (Svelte 5 Runes)
  let loading = $state(true);
  let step = $state<"verifying" | "set-password" | "error">("verifying");
  let errorMsg = $state("");
  let membershipRevoked = $state(false);
  let teamName = $state("");

  // Formulaire
  let password = $state("");
  let passwordConfirm = $state("");
  let name = $state("");

  // L'URL ressemble à : #/accept-invite?userId=xyz&teamId=123
  let userId = $state("");
  let teamId = $state("");

  onMount(async () => {
    // 1. Récupération des paramètres via sv-router
    userId = (route.search.userId as string) || "";
    teamId = (route.search.teamId as string) || "";

    if (!userId || !teamId) {
      step = "error";
      errorMsg = "Lien d'invitation incomplet ou invalide.";
      loading = false;
      return;
    }

    try {
      console.log("[AcceptInvite] Initialisation...", {
        userId,
        teamId,
      });

      const { client, account } = await getAppwriteInstances();

      // 2. Vérification de l'invitation et récupération d'un Token Appwrite
      // La fonction vérifie si l'utilisateur a une membership dans la team (non-bloquant)
      // et nous renvoie un token Appwrite
      const result = await validateInvitation(userId, teamId);

      // Stocker l'info sur la membership révoquée si présente
      if (result.membershipRevoked) {
        membershipRevoked = true;
        teamName = result.teamName || "l'équipe";
      }

      console.log("[AcceptInvite] Token reçu, création session...");

      // 3. Création de la session persistante (Login)
      // C'est ici que l'utilisateur est réellement connecté
      await account.createSession({ userId: userId, secret: result.token });

      // 4. Récupération des infos utilisateur
      const user = await account.get();
      console.log("[AcceptInvite] Connecté en tant que :", user.name);

      // Pré-remplir le nom
      name = user.name;

      // Cas particulier : Si l'utilisateur a déjà un mot de passe
      if (user.passwordUpdate) {
        // L'utilisateur a déjà un mot de passe, on le redirige vers le dashboard
        navigate("/dashboard");
        return;
      }

      step = "set-password";
    } catch (e: any) {
      console.error("[AcceptInvite] Erreur validation:", e);
      step = "error";
      errorMsg = e.message || "Ce lien d'invitation est invalide.";
    } finally {
      loading = false;
    }
  });

  async function handleFinish() {
    if (!name || name.trim().length === 0) {
      alert("Veuillez saisir votre pseudo / nom.");
      return;
    }

    if (password.length < 8) {
      alert("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }

    if (password !== passwordConfirm) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    loading = true;
    try {
      const { client, account } = await getAppwriteInstances();

      // 4. Définition du mot de passe
      // Fonctionne car nous sommes authentifiés temporairement via le JWT
      await account.updatePassword({ password });

      // Mise à jour du nom si modifié par l'utilisateur
      if (name) await account.updateName({ name });

      console.log(
        "[AcceptInvite] Mot de passe défini, rafraîchissement auth...",
      );

      // 5. Rafraîchir l'état d'authentification et charger les stores
      // Cette étape est cruciale pour initialiser tous les stores utilisateur
      const { globalState } = await import("$lib/stores/GlobalState.svelte");
      await globalState.refreshAuthAfterLogin();

      console.log("[AcceptInvite] Auth rafraîchie, redirection...");

      // 6. Redirection vers le dashboard via le routeur
      navigate("/dashboard");
    } catch (e: any) {
      console.error("[AcceptInvite] Erreur finalisation:", e);
      alert("Erreur : " + e.message);
      loading = false;
    }
  }
  $effect(() => {
    navBarStore.setConfig({
      title: "Rejoindre l'équipe",
    });
  });

  onDestroy(() => {
    navBarStore.reset();
  });
</script>

<div
  class="bg-base-200 flex h-full items-center justify-center p-4"
  transition:fade
>
  <div class="card bg-base-100 w-full max-w-md shadow-xl">
    <div class="card-body text-center">
      {#if loading && step !== "set-password"}
        <span class="loading loading-spinner loading-lg text-primary mx-auto"
        ></span>
        <p class="text-base-content/70 mt-4">Vérification de l'invitation...</p>
      {:else if step === "error"}
        <TriangleAlert class="text-error mb-2 size-7" />
        <h2 class="text-error text-xl font-bold">Oups !</h2>
        <p class="py-4">{errorMsg}</p>
        <button class="btn btn-ghost" onclick={() => navigate("/")}>
          Retour à l'accueil
        </button>
      {:else if step === "set-password"}
        <div class="mb-2 text-4xl">👋</div>
        <h2 class="card-title justify-center text-2xl">Bienvenue !</h2>
        <p class="text-base-content/70 mb-6 text-sm">
          Votre invitation est validée. <br />
          Veuillez définir un mot de passe.
        </p>

        {#if membershipRevoked}
          <div class="alert alert-warning mb-4" role="alert">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              <strong>Information :</strong> Votre accès à {teamName} a été révoqué.
              Vous pouvez tout de même créer votre compte et vous connecter.
            </span>
          </div>
        {/if}

        <label class="w-full text-left">
          <div class="label">
            <span class="label-text">Votre Pseudo / Nom</span>
            <span class="label-text-alt text-error">*</span>
          </div>
          <input
            type="text"
            bind:value={name}
            class="input w-full"
            required
            maxlength="25"
          />
        </label>

        <label class="mt-3 w-full text-left">
          <div class="label">
            <span class="label-text">Nouveau mot de passe</span>
          </div>
          <input
            type="password"
            bind:value={password}
            placeholder="Minimum 8 caractères"
            class="input w-full"
          />
        </label>

        <label class="mt-3 w-full text-left">
          <div class="label">
            <span class="label-text">Confirmer le mot de passe</span>
          </div>
          <input
            type="password"
            bind:value={passwordConfirm}
            placeholder="Ressaisissez le mot de passe"
            class="input w-full"
          />
        </label>

        <div class="card-actions mt-6">
          <button
            class="btn btn-primary w-full"
            onclick={handleFinish}
            disabled={loading}
          >
            {#if loading}<span class="loading loading-spinner loading-xs"
              ></span>{/if}
            Terminer l'inscription
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

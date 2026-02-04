<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { getAppwriteInstances } from "$lib/services/appwrite";
  import { validateInvitation } from "$lib/services/appwrite-invitations";
  import { navigate, route } from "$lib/router";
  import { TriangleAlert } from "@lucide/svelte";
  import { navBarStore } from "../stores/NavBarStore.svelte";
  import { onDestroy } from "svelte";
  import { warmUpUsersTeamsManager } from "$lib/services/appwrite-warmup";

  // États (Svelte 5 Runes)
  let loading = $state(true);
  let step = $state<"verifying" | "set-password" | "error">("verifying");
  let errorMsg = $state("");

  // Formulaire
  let password = $state("");
  let name = $state("");

  // Params (récupérés via le Custom Router)
  // L'URL ressemble à : #/accept-invite?userId=xyz&eventId=abc OU #/accept-invite?userId=xyz&teamId=123
  let userId = "";
  let eventId = "";
  let teamId = "";

  onMount(async () => {
    // 0. Warm-up de la fonction usersTeamsManager
    // warmUpUsersTeamsManager();

    // 1. Récupération des paramètres via sv-router
    userId = route.search.userId || "";
    eventId = route.search.eventId || "";
    teamId = route.search.teamId || "";

    if (!userId || (!eventId && !teamId)) {
      step = "error";
      errorMsg = "Lien d'invitation incomplet ou invalide.";
      loading = false;
      return;
    }

    try {
      console.log("[AcceptInvite] Initialisation...", {
        userId,
        eventId,
        teamId,
      });

      const { client, account } = await getAppwriteInstances();

      // 2. Vérification de l'invitation et récupération d'un Token Appwrite
      // La fonction vérifie que l'utilisateur a le Label (event) ou la membership (team)
      // et nous renvoie un token Appwrite
      const { token } = await validateInvitation(userId, eventId, teamId);

      console.log("[AcceptInvite] Token reçu, création session...");

      // 3. Création de la session persistante (Login)
      // C'est ici que l'utilisateur est réellement connecté
      await account.createSession({ userId: userId, secret: token });

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

    loading = true;
    try {
      const { client, account } = await getAppwriteInstances();

      // 4. Définition du mot de passe
      // Fonctionne car nous sommes authentifiés temporairement via le JWT
      await account.updatePassword({ password });

      // Mise à jour du nom si modifié par l'utilisateur
      if (name) await account.updateName({ name });

      console.log("[AcceptInvite] Session créée, redirection...");

      // 6. Redirection vers le dashboard via le routeur
      // Utilisation de "/dashboard" qui est la route définie dans App.svelte
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
  class="bg-base-200 flex min-h-screen items-center justify-center p-4"
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

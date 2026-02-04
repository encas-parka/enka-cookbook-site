<script lang="ts">
  import { onMount } from "svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { MailCheck, XCircle, Loader2 } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { navigate, route } from "$lib/router";

  let status = $state<"loading" | "success" | "error">("loading");
  let message = $state("");

  onMount(async () => {
    // Extraire userId et secret de l'URL
    // Appwrite place les params AVANT le hash : /?userId=xxx&secret=yyy#/verify-email
    // On doit donc vérifier window.location.search en PRIORITÉ
    let userId = route.search.userId;
    let secret = route.search.secret;

    // Fallback : vérifier window.location.search (format Appwrite)
    if (!userId || !secret) {
      const urlParams = new URLSearchParams(window.location.search);
      userId = urlParams.get("userId");
      secret = urlParams.get("secret");
    }

    if (!userId || !secret) {
      status = "error";
      message =
        "Paramètres de vérification manquants. Vérifiez le lien dans l'email.";
      return;
    }

    try {
      // Appeler updateVerification pour finaliser la vérification
      const { account } = await import("$lib/services/appwrite").then((m) =>
        m.getAppwriteInstances(),
      );

      await (await account).updateVerification(userId, secret);

      // Rafraîchir les infos utilisateur
      await globalState.refreshAuthAfterLogin();

      status = "success";
      message =
        "Votre email a été vérifié avec succès ! Vous allez être redirigé...";

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la vérification:", error);
      status = "error";
      message =
        error instanceof Error
          ? error.message
          : "Une erreur est survenue lors de la vérification. Le lien a peut-être expiré.";
    }
  });

  function goToDashboard() {
    navigate("/dashboard");
  }
</script>

<div class="bg-base-200 flex min-h-screen items-center justify-center p-4">
  <div class="bg-base-100 max-w-md rounded-xl p-8 shadow-lg" in:fade>
    {#if status === "loading"}
      <div class="flex flex-col items-center gap-4 text-center">
        <Loader2 class="text-primary size-16 animate-spin" />
        <h2 class="text-2xl font-bold">Vérification en cours...</h2>
        <p class="text-base-content/70">
          Veuillez patienter pendant que nous vérifions votre email.
        </p>
      </div>
    {:else if status === "success"}
      <div class="flex flex-col items-center gap-4 text-center">
        <MailCheck class="text-success size-16" />
        <h2 class="text-success text-2xl font-bold">Email vérifié !</h2>
        <p class="text-base-content/70">{message}</p>
        <button class="btn btn-primary" onclick={goToDashboard}>
          Aller au tableau de bord
        </button>
      </div>
    {:else if status === "error"}
      <div class="flex flex-col items-center gap-4 text-center">
        <XCircle class="text-error size-16" />
        <h2 class="text-error text-2xl font-bold">Erreur de vérification</h2>
        <p class="text-base-content/70">{message}</p>
        <div class="flex gap-2">
          <button class="btn btn-outline" onclick={() => navigate("/")}>
            Retour à l'accueil
          </button>
          <button class="btn btn-primary" onclick={goToDashboard}>
            Tableau de bord
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { navigate, route } from "$lib/router";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { redeemShareLink } from "$lib/services/appwrite-invitations";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { db } from "$lib/db-sync/aw-sync";
  import AuthModal from "$lib/components/AuthModal.svelte";
  import { PartyPopper, TriangleAlert } from "@lucide/svelte";

  const SESSION_STORAGE_KEY = "pending_join_link";

  let linkId = $derived(route.params.linkId as string);
  let step = $state<"loading" | "auth-required" | "success" | "error">(
    "loading",
  );
  let errorMsg = $state("");
  let authModalOpen = $state(false);

  $effect(() => {
    navBarStore.setConfig({ title: "Rejoindre un événement" });
  });

  onMount(async () => {
    if (!linkId) {
      step = "error";
      errorMsg = "Lien invalide.";
      return;
    }

    // Vérifier d'abord le cache local joinLinks
    const cachedLink = await db.joinLinks.get(linkId);
    if (cachedLink) {
      // Lien déjà utilisé → redirection directe
      navigate(`/event/${cachedLink.eventId}`);
      return;
    }

    if (globalState.isAuthenticated && globalState.userId) {
      await attemptRedeem(linkId, globalState.userId);
    } else {
      // User non connecté : sauvegarder le linkId et afficher AuthModal
      sessionStorage.setItem(SESSION_STORAGE_KEY, linkId);
      step = "auth-required";
      authModalOpen = true;
    }
  });

  /**
   * Appelé par AuthModal après une connexion/inscription réussie.
   * Reprend la redemption avec le linkId sauvegardé.
   */
  async function handleAuthSuccess() {
    authModalOpen = false;

    // FORCER le rafraîchissement de l'état global pour récupérer l'utilisateur connecté
    await globalState.refreshAuthAfterLogin();

    const pendingLinkId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (pendingLinkId && globalState.userId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      step = "loading";
      await attemptRedeem(pendingLinkId, globalState.userId);
    } else {
      step = "error";
      errorMsg = "Une erreur est survenue lors de la connexion.";
    }
  }

  async function attemptRedeem(id: string, userId: string) {
    try {
      step = "loading";
      const { eventId } = await redeemShareLink(id, userId);

      // Sauvegarder dans le cache pour les prochaines fois
      await db.joinLinks.put({
        linkId: id,
        eventId: eventId,
        joinedAt: new Date().toISOString(),
      });

      // FORCER la synchronisation avec Appwrite pour obtenir la nouvelle liste des contributeurs (sinon le cache idb est utilisé)
      const { eventsStore } = await import("$lib/stores/EventsStore.svelte");
      await eventsStore.syncFromRemote();

      step = "success";
      toastService.success("Accès accordé ! Redirection en cours...");

      setTimeout(() => {
        navigate(`/event/${eventId}`);
      }, 1500);
    } catch (err: any) {
      step = "error";
      errorMsg =
        err.message || "Ce lien d'invitation est invalide ou a expiré.";
    }
  }
</script>

<div
  class="bg-base-200 flex min-h-dvh items-center justify-center p-4"
  transition:fade
>
  <div class="card bg-base-100 w-full max-w-sm shadow-xl">
    <div class="card-body items-center text-center">
      {#if step === "loading"}
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="text-base-content/60 mt-4">Vérification de l'invitation...</p>
      {:else if step === "auth-required"}
        <div class="mb-2 text-4xl">🔑</div>
        <h2 class="card-title">Connectez-vous pour continuer</h2>
        <p class="text-base-content/60 mt-1 text-sm">
          Ce lien d'invitation nécessite d'être connecté pour rejoindre
          l'événement.
        </p>
        <button
          class="btn btn-primary mt-4 w-full"
          onclick={() => (authModalOpen = true)}
        >
          Se connecter / Créer un compte
        </button>
      {:else if step === "success"}
        <PartyPopper class="text-success mb-2 size-12" />
        <h2 class="card-title text-success">Accès accordé !</h2>
        <p class="text-base-content/60 mt-1 text-sm">
          Vous avez rejoint l'événement. Redirection en cours...
        </p>
        <span class="loading loading-dots loading-sm text-primary mt-3"></span>
      {:else if step === "error"}
        <TriangleAlert class="text-error mb-2 size-10" />
        <h2 class="text-error card-title">Lien invalide</h2>
        <p class="py-3 text-sm">{errorMsg}</p>
        <button class="btn btn-ghost btn-sm" onclick={() => navigate("/")}>
          Retour à l'accueil
        </button>
      {/if}
    </div>
  </div>
</div>

<AuthModal bind:isOpen={authModalOpen} onAuth_success={handleAuthSuccess} />

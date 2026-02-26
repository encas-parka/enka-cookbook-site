<script lang="ts">
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { fade } from "svelte/transition";
  import { MailCheck } from "@lucide/svelte";
  import { toastService } from "$lib/services/toast.service.svelte";

  /**
   * Composant d'alerte pour les utilisateurs dont l'email n'est pas vérifié
   * S'affiche uniquement si l'utilisateur est authentifié mais que son email n'est pas vérifié
   */

  async function resendVerificationEmail() {
    try {
      const { account } = await import("$lib/services/appwrite").then((m) =>
        m.getAppwriteInstances(),
      );

      // Créer une verification avec URL de redirection
      // Le router est en mode path-based, Appwrite ajoutera ?userId=xxx&secret=xxx
      const token = await account.createEmailVerification({
        url: window.location.origin + "/verify-email",
      });

      toastService.success(
        "Email de vérification envoyé ! Vérifiez votre boîte de réception.",
      );
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de l'email de vérification:",
        error,
      );
      toastService.error(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer l'email de vérification",
      );
    }
  }

  // Vérifier si l'utilisateur est connecté mais avec email non vérifié
  const show = $derived(
    globalState.isAuthenticated &&
      globalState.user?.emailVerification === false,
  );
</script>

{#if show}
  <div
    class="alert alert-warning max-md:alert-vertical mx-auto mt-4 max-w-4xl shadow-lg"
    role="alert"
    in:fade={{ duration: 300 }}
  >
    <MailCheck class="size-6 shrink-0 " />
    <div class="flex-1">
      <h3 class="font-semibold">Email non vérifié</h3>
      <p class="text-sm opacity-90">
        Veuillez cliquez sur le lien envoyé sur votre email pour finaliser
        l'inscription (pensez à vérifier le dossier spam)
        <button class="link font-medium" onclick={resendVerificationEmail}>
          Renvoyer l'email de vérification
        </button>
      </p>
    </div>
  </div>
{/if}

<script lang="ts">
  import { getAppwriteInstances } from "../services/appwrite";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import { CircleX, CircleCheck, Mail, Lock, User } from "@lucide/svelte";

  let {
    isOpen = $bindable(),
    onAuth_success = async () => {},
    showLogin: initialShowLogin = true,
  } = $props();

  // États avec runes Svelte 5
  // svelte-ignore state_referenced_locally
  let showLogin = $state(initialShowLogin);
  let isLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  // Synchroniser showLogin avec la prop quand isOpen change
  $effect(() => {
    if (isOpen) {
      showLogin = initialShowLogin;
      showForgotPassword = false;
    }
  });

  // Formulaire de connexion
  let loginEmail = $state("");
  let loginPassword = $state("");

  // Formulaire d'inscription
  let registerName = $state("");
  let registerEmail = $state("");
  let registerPassword = $state("");
  let registerPasswordConfirm = $state("");

  // Formulaire mot de passe oublié
  let forgotEmail = $state("");
  let showForgotPassword = $state(false);

  // Références aux éléments form pour validation
  // svelte-ignore non_reactive_update
  let loginFormElement: HTMLFormElement;
  // svelte-ignore non_reactive_update
  let registerFormElement: HTMLFormElement;
  // svelte-ignore non_reactive_update
  let forgotFormElement: HTMLFormElement;

  // Gestionnaire de submit avec validation
  async function handleLoginSubmit(event: Event) {
    event.preventDefault();
    if (!loginFormElement.checkValidity()) {
      loginFormElement.reportValidity();
      errorMessage = "Formulaire invalide. Veuillez vérifier les champs.";
      return;
    }
    errorMessage = "";
    await handleLogin();
  }

  async function handleRegisterSubmit(event: Event) {
    event.preventDefault();

    // Validation d'égalité des mots de passe
    if (registerPassword !== registerPasswordConfirm) {
      errorMessage = "Les mots de passe ne correspondent pas.";
      return;
    }

    if (!registerFormElement.checkValidity()) {
      registerFormElement.reportValidity();
      errorMessage = "Formulaire invalide. Veuillez vérifier les champs.";
      return;
    }
    errorMessage = "";
    await handleRegister();
  }

  async function handleForgotSubmit(event: Event) {
    event.preventDefault();
    if (!forgotFormElement.checkValidity()) {
      forgotFormElement.reportValidity();
      errorMessage = "Formulaire invalide. Veuillez vérifier les champs.";
      return;
    }
    errorMessage = "";
    await handleForgotPassword();
  }

  async function handleLogin() {
    isLoading = true;

    try {
      const { account } = await getAppwriteInstances();

      // Créer la session
      await account.createEmailPasswordSession({
        email: loginEmail,
        password: loginPassword,
      });

      successMessage = "Connexion réussie !";
      setTimeout(() => {
        onAuth_success();
      }, 1000);
    } catch (error: any) {
      console.error("Erreur de connexion:", error);
      errorMessage = error.message || "Erreur lors de la connexion";
    } finally {
      isLoading = false;
    }
  }

  async function handleRegister() {
    isLoading = true;

    try {
      const { account } = await getAppwriteInstances();

      // Créer le compte
      await account.create({
        userId: "unique()",
        email: registerEmail,
        password: registerPassword,
        name: registerName,
      });

      // Créer la session
      await account.createEmailPasswordSession({
        email: registerEmail,
        password: registerPassword,
      });

      successMessage = "Compte créé et connecté !";
      setTimeout(() => {
        onAuth_success();
      }, 1000);
    } catch (error: any) {
      console.error("Erreur d'inscription:", error);
      errorMessage = error.message || "Erreur lors de la création du compte";
    } finally {
      isLoading = false;
    }
  }

  async function handleForgotPassword() {
    isLoading = true;

    try {
      const { account } = await getAppwriteInstances();

      await account.createRecovery({
        email: forgotEmail,
        url: `${window.location.origin}/#/reset-password`,
      });

      successMessage = "Email de réinitialisation envoyé !";
      setTimeout(() => {
        showForgotPassword = false;
        forgotEmail = "";
      }, 2000);
    } catch (error: any) {
      console.error("Erreur mot de passe oublié:", error);
      errorMessage = error.message || "Erreur lors de l'envoi de l'email";
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    if (!isLoading) {
      isOpen = false;
    }
  }

  // Reset des messages via effet réactif
  $effect(() => {
    if (showLogin || showForgotPassword) {
      errorMessage = "";
      successMessage = "";
    }
  });

  function getTitle() {
    if (showForgotPassword) return "Mot de passe oublié";
    if (showLogin) return "Connexion";
    return "Inscription";
  }
</script>

<ModalContainer {isOpen} onClose={closeModal} maxWidth="sm">
  <ModalHeader title={getTitle()} onClose={closeModal} />

  <ModalContent>
    <div class="space-y-4 py-4">
      <!-- Messages -->
      {#if errorMessage}
        <div role="alert" class="alert alert-error max-md:alert-vertical">
          <CircleX class="h-6 w-6 shrink-0 stroke-current" />
          <span>{errorMessage}</span>
        </div>
      {/if}

      {#if successMessage}
        <div role="alert" class="alert alert-success max-md:alert-vertical">
          <CircleCheck class="h-6 w-6 shrink-0 stroke-current" />
          <span>{successMessage}</span>
        </div>
      {/if}

      <!-- Mot de passe oublié -->
      {#if showForgotPassword}
        <form
          id="forgotForm"
          bind:this={forgotFormElement}
          onsubmit={handleForgotSubmit}
          class="space-y-4"
        >
          <fieldset>
            <label class="input validator required w-full">
              <Mail class="h-4 w-4 opacity-50" />
              <input
                type="email"
                bind:value={forgotEmail}
                placeholder="votre@email.com"
                disabled={isLoading}
                required
                aria-required="true"
              />
            </label>
            <span class="validator-hint hidden"
              >Adresse email valide requise</span
            >
          </fieldset>

          <div class="alert alert-info alert-soft">
            Un email avec un lien vous sera envoyé pour renouveller votre mot de
            passe.". Pensez à vérifier s'il n'a pas attéri dans votre dossier
            spam.
          </div>
        </form>

        <div class="text-center">
          <button
            onclick={() => (showForgotPassword = false)}
            class="btn btn-ghost btn-sm"
            disabled={isLoading}
          >
            ← Retour à la connexion
          </button>
        </div>

        <!-- Connexion -->
      {:else if showLogin}
        <form
          id="loginForm"
          bind:this={loginFormElement}
          onsubmit={handleLoginSubmit}
          class="space-y-4"
        >
          <fieldset>
            <label class="input validator required w-full">
              <Mail class="h-4 w-4 opacity-50" />
              <input
                type="email"
                bind:value={loginEmail}
                placeholder="votre@email.com"
                disabled={isLoading}
                required
                aria-required="true"
              />
            </label>
            <span class="validator-hint hidden"
              >Adresse email valide requise</span
            >
          </fieldset>

          <fieldset>
            <label class="input validator required w-full">
              <Lock class="h-4 w-4 opacity-50" />
              <input
                type="password"
                bind:value={loginPassword}
                placeholder="Mot de passe"
                disabled={isLoading}
                required
                aria-required="true"
              />
            </label>
            <span class="validator-hint hidden">Mot de passe requis</span>
          </fieldset>
        </form>

        <div class="space-y-2 text-center">
          <button
            onclick={() => (showForgotPassword = true)}
            class="btn btn-link btn-sm btn-primary"
            disabled={isLoading}
          >
            Mot de passe oublié ?
          </button>

          <div class="text-base-content/70 text-sm">
            Pas encore de compte ?
            <button
              onclick={() => (showLogin = false)}
              class="btn btn-primary btn-sm btn-soft ms-1"
              disabled={isLoading}
            >
              S'inscrire
            </button>
          </div>
        </div>

        <!-- Inscription -->
      {:else}
        <form
          id="registerForm"
          bind:this={registerFormElement}
          onsubmit={handleRegisterSubmit}
          class="space-y-4"
        >
          <fieldset>
            <label class="input validator required w-full">
              <User class="h-4 w-4 opacity-50" />
              <input
                type="text"
                bind:value={registerName}
                placeholder="Votre nom"
                disabled={isLoading}
                required
                aria-required="true"
                minlength="3"
                maxlength="25"
              />
            </label>
            <span class="validator-hint hidden">
              Doit comporter entre 3 et 25 caractères.
            </span>
          </fieldset>

          <fieldset>
            <label class="input validator required w-full">
              <Mail class="h-4 w-4 opacity-50" />
              <input
                type="email"
                bind:value={registerEmail}
                placeholder="votre@email.com"
                disabled={isLoading}
                required
                aria-required="true"
              />
            </label>
            <span class="validator-hint hidden"
              >Adresse email valide requise</span
            >
          </fieldset>

          <fieldset>
            <label class="input validator required w-full">
              <Lock class="h-4 w-4 opacity-50" />
              <input
                type="password"
                bind:value={registerPassword}
                placeholder="Mot de passe"
                disabled={isLoading}
                required
                aria-required="true"
                minlength="8"
                maxlength="25"
              />
            </label>
            <span class="validator-hint hidden">
              Doit comporter entre 8 et 25 caractères.
            </span>
          </fieldset>

          <fieldset>
            <label class="input validator required w-full">
              <Lock class="h-4 w-4 opacity-50" />
              <input
                type="password"
                bind:value={registerPasswordConfirm}
                placeholder="Confirmer le mot de passe"
                disabled={isLoading}
                required
                aria-required="true"
                minlength="8"
                maxlength="25"
              />
            </label>
            <span class="validator-hint hidden">
              Doit être identique au mot de passe ci-dessus.
            </span>
          </fieldset>

          <div class="alert alert-info alert-soft">
            Un email avec un lien vous sera envoyé. Pensez à vérifier s'il n'a
            pas attéri dans votre dossier spam.
          </div>
        </form>

        <div class="text-base-content/70 text-center text-sm">
          Déjà un compte ?
          <button
            onclick={() => (showLogin = true)}
            class="btn btn-soft btn-sm btn-primary ms-1"
            disabled={isLoading}
          >
            Se connecter
          </button>
        </div>
      {/if}
    </div>
  </ModalContent>

  <ModalFooter>
    {#if showForgotPassword}
      <button
        form="forgotForm"
        type="submit"
        class="btn btn-primary btn-block"
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="loading loading-spinner"></span>
        {:else}
          Envoyer l'email de réinitialisation
        {/if}
      </button>
    {:else if showLogin}
      <button
        form="loginForm"
        type="submit"
        class="btn btn-primary btn-block"
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="loading loading-spinner"></span>
        {:else}
          Se connecter
        {/if}
      </button>
    {:else}
      <button
        form="registerForm"
        type="submit"
        class="btn btn-success btn-block"
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="loading loading-spinner"></span>
        {:else}
          Créer un compte
        {/if}
      </button>
    {/if}
  </ModalFooter>
</ModalContainer>

<style>
  .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 1rem;
  }

  .space-y-2 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0.5rem;
  }
</style>

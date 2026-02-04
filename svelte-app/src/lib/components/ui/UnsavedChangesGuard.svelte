<script lang="ts">
  import { blockNavigation } from "$lib/router";

  interface Props {
    routeKey: string;
    shouldProtect: () => boolean;
    onLeaveWithoutSave?: () => void | Promise<void>;
    message?: string;
  }

  let {
    routeKey,
    shouldProtect,
    onLeaveWithoutSave,
    message = "Vous avez des modifications non sauvegardées. Voulez-vous quitter sans enregistrer ?",
  }: Props = $props();

  // Guard qui utilise la confirmation native du navigateur
  // Suivant le pattern officiel de sv-router
  blockNavigation(() => {
    if (!shouldProtect()) {
      return true; // Autoriser la navigation
    }

    // Utiliser la confirmation native
    // Le navigateur attend la réponse synchrone avant de continuer
    const confirmed = confirm(message);

    if (confirmed && onLeaveWithoutSave) {
      // Exécuter le cleanup si fourni
      onLeaveWithoutSave();
    }

    // Retourner true pour autoriser, false pour bloquer
    return confirmed;
  });
</script>

<!-- Ce composant n'a pas de markup HTML -->
<!-- Il enregistre seulement le guard de navigation -->

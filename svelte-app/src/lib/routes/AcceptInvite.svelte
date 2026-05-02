<script lang="ts">
  import { onMount } from "svelte";
  import { navigate } from "$lib/router";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { navBarStore } from "$lib/stores/NavBarStore.svelte";
  import { TriangleAlert } from "@lucide/svelte";

  $effect(() => {
    navBarStore.setConfig({ title: "Invitation" });
  });

  onMount(() => {
    toastService.info(
      "Le système d'invitation par email est en cours de migration. Utilisez les liens de partage pour inviter des participants.",
      { autoCloseDelay: 8000 },
    );
  });
</script>

<div class="bg-base-200 flex h-full items-center justify-center p-4">
  <div class="card bg-base-100 w-full max-w-md shadow-xl">
    <div class="card-body text-center">
      <TriangleAlert class="text-warning mb-2 size-7 mx-auto" />
      <h2 class="text-xl font-bold">Invitation par email</h2>
      <p class="text-base-content/70 py-4">
        Ce type d'invitation est en cours de migration vers le nouveau système.
      </p>
      <p class="text-base-content/50 text-sm mb-4">
        Demandez à l'organisateur de vous envoyer un <strong>lien de partage</strong>
        depuis la page de l'événement.
      </p>
      <button class="btn btn-primary" onclick={() => navigate("/")}>
        Retour à l'accueil
      </button>
    </div>
  </div>
</div>

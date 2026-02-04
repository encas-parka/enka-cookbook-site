<script lang="ts">
  import { navigate } from "$lib/router";
  import { Home, AlertCircle } from "@lucide/svelte";
  import { fade } from "svelte/transition";
</script>

<div
  transition:fade
  class="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
>
  <div class="flex flex-col items-center gap-4 text-center">
    <div class="text-error flex items-center gap-3">
      <AlertCircle class="size-12" />
      <h1 class="text-6xl font-bold">404</h1>
    </div>

    <h2 class="text-2xl font-semibold">Page non trouvée</h2>

    <p class="text-base-content/70 max-w-md">
      Désolé, la page que vous cherchez n'existe pas ou a été déplacée.
    </p>
  </div>

  <button onclick={() => navigate("/")} class="btn btn-primary btn-lg gap-2">
    <Home class="size-5" />
    Retour à l'accueil
  </button>
</div>

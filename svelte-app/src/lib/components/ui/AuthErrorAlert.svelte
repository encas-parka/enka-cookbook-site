<script lang="ts">
  import { TriangleAlertIcon, LogInIcon } from "@lucide/svelte";

  interface Props {
    message: string | null;
  }

  let { message }: Props = $props();
</script>

<div class="alert bg-error/20 max-md:alert-vertical">
  <div class="flex items-start gap-3">
    <TriangleAlertIcon class="mt-0.5 h-6 w-6 shrink-0 stroke-current" />

    <div class="flex-1">
      <h3 class="font-bold">Authentification requise</h3>
      <div class="text-sm">{message || "Erreur inconnue"}</div>
    </div>
  </div>
</div>

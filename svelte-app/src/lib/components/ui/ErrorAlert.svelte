<script lang="ts">
  import { XCircle } from "@lucide/svelte";

  interface Props {
    message: string;
  }

  let { message }: Props = $props();
</script>

<div class="alert alert-error max-md:alert-vertical shadow-lg">
  <XCircle class="h-6 w-6 shrink-0 stroke-current" />
  <div>
    <h3 class="font-bold">Erreur</h3>
    <div class="text-sm">{message}</div>
  </div>
</div>

<script lang="ts">
  import { MessageCircle } from "@lucide/svelte";

  interface Props {
    value: string | null;
    disabled?: boolean;
  }

  let { value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="input w-96">
  <MessageCircle size={20} class="text-base-centent/70" />
  <input
    type="text"
    bind:value
    placeholder="Commentaire (optionnel)"
    maxlength="100"
  />
</label>

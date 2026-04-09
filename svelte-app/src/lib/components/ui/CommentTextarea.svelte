<script lang="ts">
  interface Props {
    value: string | null;
    disabled?: boolean;
    id?: string;
  }

  let { value = $bindable(), disabled = false, id }: Props = $props();
</script>

<div class="flex min-w-0 flex-col">
  <span class="label">Informations complémentaires (optionnel)</span>

  <textarea
    class="textarea w-full text-sm"
    bind:value
    placeholder="Commentaire (optionnel)"
    rows="2"
    maxlength="250"
    {disabled}
    {id}
  ></textarea>
</div>

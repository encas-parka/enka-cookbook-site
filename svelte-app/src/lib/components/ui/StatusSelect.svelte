<script lang="ts">
  interface Props {
    status: "delivered" | "ordered" | null;
    deliveryDate?: string | null;
    disabled?: boolean;
  }

  let {
    status = $bindable(),
    deliveryDate = $bindable(),
    disabled = false,
  }: Props = $props();
</script>

<div class="flex w-full flex-wrap gap-4">
  <div class="flex flex-col">
    <select class="custom-select input w-52" bind:value={status} {disabled}>
      <option value="delivered" selected>Acheté</option>
      <option value="ordered">Commandé</option>
    </select>
    <div class="label text-xs {status === 'delivered' ? '' : 'hidden'}">
      Modifiez s'il s'agit d'une commande
    </div>
  </div>

  {#if status === "ordered"}
    <label class="input w-fit">
      <span class="label">Date de livraison</span>
      <input type="date" bind:value={deliveryDate} {disabled} />
    </label>
  {/if}
</div>

<script lang="ts">
  import { Search, X } from "@lucide/svelte";

  interface Props {
    searchQuery: string;
    onReset: () => void;
    placeholder?: string;
  }

  let {
    searchQuery = $bindable(),
    onReset,
    placeholder = "Rechercher...",
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onReset();
    }
  }
</script>

<div class="input w-full input-lg">
  <Search class="h-5 w-5 text-base-content/50" />
  <input
    type="text"
    class="min-w-0 grow"
    bind:value={searchQuery}
    onkeydown={handleKeydown}
    {placeholder}
    aria-label="Rechercher"
  />
  {#if searchQuery.length > 0}
    <button
      class="btn btn-ghost btn-lg"
      onclick={onReset}
      aria-label="Effacer la recherche"
    >
      <X class="h-5 w-5" />
    </button>
  {/if}
</div>

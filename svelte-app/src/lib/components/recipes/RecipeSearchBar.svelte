<script lang="ts">
  import { Search, X } from "@lucide/svelte";

  interface Props {
    searchQuery: string;
    onReset: () => void;
  }

  let { searchQuery = $bindable(), onReset }: Props = $props();
</script>

<div class="">
  <label class="input input-lg w-full">
    <Search class="h-5 w-5 opacity-50" />
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Rechercher... (parmi les titres, auteur·ices, spécialités. Désactive les filtres sélectionnés)"
      class=""
    />
    <button
      class="btn btn-circle"
      onclick={onReset}
      title="Effacer la recherche"
    >
      <X class="h-5 w-5" />
    </button>
  </label>
</div>

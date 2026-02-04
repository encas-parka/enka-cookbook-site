<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto p-4 sm:p-6 sm:pt-2">
  {@render children()}
</div>

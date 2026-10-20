<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="flex-none border-t border-base-300 bg-base-200 p-3">
  <div class="flex flex-wrap items-center justify-end gap-2">
    {@render children()}
  </div>
</div>

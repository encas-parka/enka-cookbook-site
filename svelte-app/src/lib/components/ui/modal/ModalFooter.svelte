<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="border-base-300 flex-none border-t px-4 py-3">
  <div class="flex flex-wrap items-center justify-end gap-2">
    {@render children()}
  </div>
</div>

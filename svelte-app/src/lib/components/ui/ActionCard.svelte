<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    icon: Snippet;
    action: Snippet;
  }

  let { title, description, icon, action }: Props = $props();
</script>

<div class="card bg-base-100 border-base-200 border shadow-sm">
  <div class="card-body">
    <div class="flex items-center gap-3">
      <div class="text-primary self-baseline stroke-3">{@render icon()}</div>
      <div>
        <h4 class="">{title}</h4>
        <p class="text-base-content/60 py-2 text-sm">{description}</p>
      </div>
    </div>
    <div class="card-actions mt-auto justify-end">
      {@render action()}
    </div>
  </div>
</div>

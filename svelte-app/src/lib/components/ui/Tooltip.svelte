<script lang="ts">
  import { type Icon as IconType } from "@lucide/svelte";

  interface Props {
    tip: string;
    icon?: IconType;
    iconSize?: number;
  }

  let { tip, icon, iconSize = 24 } = $props();

  // svelte-ignore state_referenced_locally
  let Icon = icon || undefined;
</script>

<div class="tooltip text-xs font-normal" data-tip={tip}>
  {#if icon}
    <Icon
      size={iconSize}
      class="align-top
"
    />
  {/if}
</div>

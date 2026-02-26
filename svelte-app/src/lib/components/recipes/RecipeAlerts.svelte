<script lang="ts">
  import { CircleAlert } from "@lucide/svelte";

  interface Props {
    isChecked?: boolean;
    defaultServings: number;
    checkedFor?: number;
  }

  let { isChecked = false, defaultServings, checkedFor }: Props = $props();
</script>

{#if isChecked}
  <div class="text-base-content/70 text-sm">
    Cette recette a été testée pour {defaultServings} couverts
    {#if checkedFor}
      et pour {checkedFor} couverts
    {/if}
  </div>
{:else}
  <div class="alert alert-error alert-soft max-md:alert-vertical">
    <CircleAlert class="h-5 w-5" />
    <div class="text-sm">
      Les auteur·ices de la recette ne l'ont <strong>pas testé</strong> pour le
      nombre de couverts indiqué par défaut ({defaultServings}).
    </div>
  </div>
{/if}

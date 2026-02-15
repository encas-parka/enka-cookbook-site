<script lang="ts">
  import { navigate, p } from "$lib/router";

  interface Alternative {
    recetteAlt: string;
  }

  interface Props {
    alternatives?: Alternative[];
    recipesIndex: Map<string, { n: string }>; // Pour résoudre les noms
  }

  let { alternatives = [], recipesIndex }: Props = $props();

  function getRecipeName(uuid: string): string {
    return recipesIndex.get(uuid)?.n || "Recette inconnue";
  }
</script>

{#if alternatives.length > 0}
  <div class="card bg-base-200">
    <div class="card-body p-4">
      <h4 class="card-title text-base">Préparation(s) alternative(s) :</h4>
      <ul class="space-y-1">
        {#each alternatives as { recetteAlt }}
          <li>
            <a class="link link-primary" href={p(`/recipe/${recetteAlt}`)}>
              {getRecipeName(recetteAlt)}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

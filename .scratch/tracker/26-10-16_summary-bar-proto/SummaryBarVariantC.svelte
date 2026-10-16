<!--
  PROTOTYPE jetable (skill /prototype — UI, sous-forme A) — à supprimer après choix.
  Question : une barre résumé Produits/Dépenses compacte et inline, wrap possible sur 2 lignes.
  Variante C — « Boutons porteurs de stats » : plus aucun conteneur ni carte. L'action
  devient primaire et porte la stat en badge dans le bouton (affordance-first). C'est la
  version la plus compacte : une ligne desktop, 2 lignes sur très petit écran.
  Comparaison : ?variant=a|b|c sur /event/:id/products (dev uniquement, défaut = prod).
-->
<script lang="ts">
  import { BadgeEuro, Plus } from "@lucide/svelte";
  import { hoverHelp } from "$lib/stores/GlobalState.svelte";

  interface Props {
    completed: number;
    missing: number;
    total: number;
    totalGlobal: number;
    canEdit: boolean;
    onAddProduct: () => void;
    onOpenPurchases: () => void;
  }

  let {
    completed,
    missing,
    total,
    totalGlobal,
    canEdit,
    onAddProduct,
    onOpenPurchases,
  }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-center gap-2 md:justify-end">
  <button
    class="btn btn-accent btn-outline btn-sm rounded-full"
    onclick={onAddProduct}
    onmouseenter={() => (hoverHelp.msg = "Ajouter un produit manuellement")}
    onmouseleave={() => hoverHelp.reset()}
    title="Ajouter un produit manuellement"
    disabled={!canEdit}
  >
    <Plus class="size-4" />
    <span class="hidden sm:inline">Ajouter un</span>produit
    {#if missing > 0}
      <span class="badge badge-error badge-sm">
        {missing} manquant{missing > 1 ? "s" : ""}
      </span>
    {:else}
      <span class="badge badge-success badge-sm">{completed}/{total} ok</span>
    {/if}
  </button>

  <button
    class="btn btn-primary btn-soft btn-sm rounded-full"
    onclick={onOpenPurchases}
    onmouseenter={() =>
      (hoverHelp.msg = "Consulter ou modifie le détail des dépenses")}
    onmouseleave={() => hoverHelp.reset()}
    title="Voir ou ajouter une dépense générale"
    disabled={!canEdit}
  >
    <BadgeEuro class="size-4" />
    Dépenses
    <span class="font-bold whitespace-nowrap">{totalGlobal} €</span>
  </button>
</div>

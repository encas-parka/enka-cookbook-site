<!--
  PROTOTYPE jetable (skill /prototype — UI, sous-forme A) — à supprimer après choix.
  Question : une barre résumé Produits/Dépenses compacte et inline, wrap possible sur 2 lignes.
  Variante A — « Chips inline » : chaque stat devient une puce autonome (icône + libellé +
  valeur), l'action est réduite à un bouton icône rond en bout de puce. Densité minimale,
  une ligne desktop, wrap naturel sur mobile.
  Comparaison : ?variant=a|b|c sur /event/:id/products (dev uniquement, défaut = prod).
-->
<script lang="ts">
  import { BadgeEuro, PackageCheck, Plus } from "@lucide/svelte";
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
  <!-- Chip produits -->
  <div
    class="border-warning/50 bg-warning/10 inline-flex items-center gap-2 rounded-full border py-1 ps-3 pe-1"
  >
    <PackageCheck class="text-warning size-4 shrink-0" />
    <span class="text-sm font-medium whitespace-nowrap">Produits</span>
    {#if missing > 0}
      <span class="badge badge-error badge-sm whitespace-nowrap">
        {missing} manquant{missing > 1 ? "s" : ""}
      </span>
    {:else}
      <span class="badge badge-success badge-sm whitespace-nowrap">
        {completed}/{total} ok
      </span>
    {/if}
    <button
      class="btn btn-accent btn-xs btn-circle"
      onclick={onAddProduct}
      onmouseenter={() => (hoverHelp.msg = "Ajouter un produit manuellement")}
      onmouseleave={() => hoverHelp.reset()}
      title="Ajouter un produit manuellement"
      disabled={!canEdit}
      aria-label="Ajouter un produit"
    >
      <Plus class="size-3.5" />
    </button>
  </div>

  <!-- Chip dépenses -->
  <div
    class="border-warning/50 bg-warning/10 inline-flex items-center gap-2 rounded-full border py-1 ps-3 pe-1"
  >
    <BadgeEuro class="text-warning size-4 shrink-0" />
    <span class="text-sm font-medium whitespace-nowrap">Dépenses</span>
    <span class="text-base-content/80 text-sm font-semibold whitespace-nowrap">
      {totalGlobal} €
    </span>
    <button
      class="btn btn-primary btn-soft btn-xs btn-circle"
      onclick={onOpenPurchases}
      onmouseenter={() =>
        (hoverHelp.msg = "Consulter ou modifie le détail des dépenses")}
      onmouseleave={() => hoverHelp.reset()}
      title="Voir ou ajouter une dépense générale"
      disabled={!canEdit}
      aria-label="Voir, ajouter des dépenses"
    >
      <Plus class="size-3.5" />
    </button>
  </div>
</div>

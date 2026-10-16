<!--
  PROTOTYPE jetable (skill /prototype — UI, sous-forme A) — à supprimer après choix.
  Question : une barre résumé Produits/Dépenses compacte et inline, wrap possible sur 2 lignes.
  Variante B — « Carte unifiée » : une seule carte segmentée Produits | Dépenses,
  horizontale sur desktop (moitié moins de place que les 2 cartes actuelles), empilée
  sur 2 lignes sur mobile via le séparateur responsive.
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

<div class="flex w-full md:justify-end">
  <div
    class="card card-xs border-warning/60 bg-base-100 w-full border shadow-sm md:w-auto"
  >
    <div
      class="card-body flex-row items-center gap-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-2"
    >
      <!-- Segment produits -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <PackageCheck class="text-warning size-6 shrink-0" />
          <div class="text-base whitespace-nowrap">
            {#if missing > 0}
              <span class="text-error font-bold">{missing}</span>
              <span class="text-base-content/60 text-sm">
                manquant{missing > 1 ? "s" : ""} / {total}
              </span>
            {:else}
              <span class="text-success font-bold">{completed}/{total}</span>
              <span class="text-base-content/60 text-sm">ok</span>
            {/if}
          </div>
        </div>
        <button
          class="btn btn-accent btn-sm"
          onclick={onAddProduct}
          onmouseenter={() =>
            (hoverHelp.msg = "Ajouter un produit manuellement")}
          onmouseleave={() => hoverHelp.reset()}
          title="Ajouter un produit manuellement"
          disabled={!canEdit}
        >
          <Plus class="size-4" />
          Ajouter
        </button>
      </div>

      <!-- Séparateur : vertical sur desktop, horizontal (2e ligne) sur mobile -->
      <div
        class="border-warning/30 self-stretch border-s max-sm:border-s-0 max-sm:border-t"
        aria-hidden="true"
      ></div>

      <!-- Segment dépenses -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <BadgeEuro class="text-warning size-6 shrink-0" />
          <span class="text-base font-semibold whitespace-nowrap">
            {totalGlobal} €
          </span>
        </div>
        <button
          class="btn btn-primary btn-soft btn-sm"
          onclick={onOpenPurchases}
          onmouseenter={() =>
            (hoverHelp.msg = "Consulter ou modifie le détail des dépenses")}
          onmouseleave={() => hoverHelp.reset()}
          title="Voir ou ajouter une dépense générale"
          disabled={!canEdit}
        >
          Voir, ajouter
        </button>
      </div>
    </div>
  </div>
</div>

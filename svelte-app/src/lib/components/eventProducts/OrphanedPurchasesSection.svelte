<script lang="ts">
  import type { Purchases } from "$lib/types/pb";
  import {
    getProductTypeInfo,
    formatPurchasesWithBadges,
  } from "@/lib/utils/products-display";
  import { Ghost, ShoppingCart, Package } from "@lucide/svelte";

  interface OrphanedPurchase {
    productId: string;
    productName: string;
    productType: string;
    /** Pourquoi le produit n'est plus affiché : record supprimé ou besoin retiré des recettes. */
    kind: "product-removed" | "need-removed";
    purchases: Purchases[];
  }

  interface Props {
    orphanedPurchases: OrphanedPurchase[];
  }

  let { orphanedPurchases }: Props = $props();
</script>

{#if orphanedPurchases.length > 0}
  <div class="mt-8 mb-8 print:hidden">
    <div
      class="sticky top-12 z-2 flex items-center gap-2 rounded-lg bg-warning/20 px-4 py-1 opacity-70 shadow-md"
    >
      <Ghost size={16} />
      <span class="font-bold">Achats sans produit actif</span>
      <span class="text-sm opacity-70"
        >({orphanedPurchases.reduce((s, o) => s + o.purchases.length, 0)}
        achats sur {orphanedPurchases.length} produits)</span
      >
    </div>
    <div class="m-2 alert alert-soft">
      Des achats ont été déclaré pour ces produits, mais ceux-ci ne sont plus
      présents dans les recettes de l'événement.
    </div>
    <div class="my-2 divide-y divide-neutral/20">
      {#each orphanedPurchases as orphan (orphan.productId)}
        {@const typeInfo = getProductTypeInfo(orphan.productType)}
        {@const badges = formatPurchasesWithBadges(orphan.purchases)}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5">
          <div class="flex min-w-0 flex-wrap items-center gap-3">
            <div
              class="flex shrink-0 items-center gap-1.5 rounded-sm px-0.5 text-warning/80"
            >
              <typeInfo.icon size={16} class="shrink-0" />
              <span class="font-semibold decoration-warning/40"
                >{orphan.productName}</span
              >
              <Ghost size={13} class="shrink-0" />
            </div>
          </div>

          <div
            class="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
          >
            <span class="text-xs text-warning/60 italic"
              >{orphan.kind === "need-removed"
                ? "besoin retiré des recettes"
                : "produit supprimé"}</span
            >

            <div
              class="flex min-h-6 flex-wrap items-center justify-end gap-2 rounded bg-success/5 px-1"
            >
              <div class="flex items-center gap-1">
                <ShoppingCart size={13} class="shrink-0 text-base-content/30" />
                <span class="text-xs font-light text-base-content/50"
                  >achats:</span
                >
              </div>

              {#if badges.length > 0}
                {#each badges as badge, i (i)}
                  <span
                    class="flex items-center gap-0.5 text-sm font-semibold whitespace-nowrap"
                  >
                    <Package size={13} class={badge.badgeClass} />
                    <span class={badge.badgeClass}
                      >{badge.quantity} {badge.unit}</span
                    >
                  </span>
                {/each}
              {:else}
                <span class="text-xs font-light text-base-content/60"
                  >aucun...</span
                >
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

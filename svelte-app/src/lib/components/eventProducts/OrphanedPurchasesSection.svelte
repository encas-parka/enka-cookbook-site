<script lang="ts">
  import type { Purchases } from "@/lib/types/appwrite";
  import {
    getProductTypeInfo,
    formatPurchasesWithBadges,
  } from "@/lib/utils/products-display";
  import { Ghost, ShoppingCart, Store, Users, Package } from "@lucide/svelte";

  interface OrphanedPurchase {
    productId: string;
    productName: string;
    productType: string;
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
      class="bg-warning/20 sticky top-12 z-2 flex items-center gap-2 rounded-lg px-4 py-1 opacity-70 shadow-md"
    >
      <Ghost size={16} />
      <span class="font-bold">Achats sans produit actif</span>
      <span class="text-sm opacity-70"
        >({orphanedPurchases.reduce((s, o) => s + o.purchases.length, 0)}
        achats sur {orphanedPurchases.length} produits)</span
      >
    </div>
    <div class="divide-neutral/20 my-2 divide-y">
      {#each orphanedPurchases as orphan (orphan.productId)}
        {@const typeInfo = getProductTypeInfo(orphan.productType)}
        {@const badges = formatPurchasesWithBadges(orphan.purchases)}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5">
          <div class="flex min-w-0 flex-wrap items-center gap-3">
            <div
              class="text-warning/80 flex shrink-0 items-center gap-1.5 rounded-sm px-0.5"
            >
              <typeInfo.icon size={16} class="shrink-0" />
              <span class="decoration-warning/40 font-semibold line-through"
                >{orphan.productName}</span
              >
              <Ghost size={13} class="shrink-0" />
            </div>
          </div>

          <div
            class="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1"
          >
            <span class="text-warning/60 text-xs italic">produit retiré</span>

            <div
              class="bg-success/5 flex min-h-6 flex-wrap items-center justify-end gap-2 rounded px-1"
            >
              <div class="flex items-center gap-1">
                <ShoppingCart size={13} class="text-base-content/30 shrink-0" />
                <span class="text-base-content/50 text-xs font-light"
                  >achats:</span
                >
              </div>

              {#if badges.length > 0}
                {#each badges as badge, i (i)}
                  {@const IconComponent = typeInfo.icon}
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
                <span class="text-base-content/60 text-xs font-light"
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

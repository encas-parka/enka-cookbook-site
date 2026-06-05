<!--
  Barre de badges cliquables représentant les achats groupés (FACTURE_*)
  dans le header de EventProductsPage.
-->
<script lang="ts">
  import {
    Calendar,
    CalendarArrowDown,
    CalendarMinus2,
    CalendarOff,
    PackageCheck,
    ShoppingCart,
    Store,
    User,
  } from "@lucide/svelte";
  import { formatDateOrNull } from "$lib/utils/products-display.js";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import type { GroupedInvoice } from "$lib/types/store.types";

  interface Props {
    canEdit: boolean;
    onInvoiceClick: (invoiceId: string) => void;
  }

  let { canEdit, onInvoiceClick }: Props = $props();

  let invoices = $derived(productsStore.groupedInvoices);
  let hasInvoices = $derived(invoices.length > 0 && canEdit);
</script>

{#if hasInvoices}
  <div class="mt-auto">
    <span
      class="text-base-content/60 text-xs font-medium tracking-wider uppercase"
    >
      Achats groupés
    </span>
    <div class="mt-1 flex flex-wrap gap-2">
      {#each invoices as invoice (invoice.invoiceId)}
        <button
          class="btn btn-sm gap-1.5 {invoice.purchaseStatus === 'delivered'
            ? 'btn-outline btn-success'
            : 'btn-outline btn-info'}"
          onclick={() => onInvoiceClick(invoice.invoiceId)}
          title="{invoice.store || 'Magasin'} — {invoice.who ||
            'Personne'} — {invoice.purchaseCount} produit{invoice.purchaseCount >
          1
            ? 's'
            : ''}"
        >
          {#if invoice.purchaseStatus === "delivered"}
            <PackageCheck class="size-4.5" />
          {:else}
            <ShoppingCart class="size-4.5" />
          {/if}

          <span class="max-w-25 truncate">{invoice.store || "?"}</span>

          <span class="text-base-content/50">•</span>

          <span class="text-sm">
            {invoice.invoiceTotal != null
              ? `${invoice.invoiceTotal.toFixed(0)}€`
              : "?"}
          </span>

          <span class="badge badge-sm badge-ghost">{invoice.purchaseCount}</span
          >

          {#if invoice.purchaseStatus === "ordered" && invoice.deliveryDate}
            <span
              class="text-base-content/80 flex items-center gap-0.5 text-sm"
            >
              <CalendarArrowDown class="size-4" />
              {formatDateOrNull(invoice.deliveryDate)}
            </span>
          {:else}
            <span
              class="text-base-content/80 flex items-center gap-0.5 text-sm"
            >
              <CalendarMinus2 class="size-4" />
            </span>
          {/if}

          {#if invoice.who}
            <span
              class="text-base-content/50 flex items-center gap-0.5 text-sm"
            >
              <User class="size-4" />
              {invoice.who}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

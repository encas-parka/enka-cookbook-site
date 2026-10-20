<!--
  Barre de badges cliquables représentant les achats groupés (FACTURE_*)
  dans le header de EventProductsPage.
-->
<script lang="ts">
  import {
    CalendarArrowDown,
    CalendarMinus2,
    PackageCheck,
    ShoppingCart,
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
  <div class="ms-auto mt-auto">
    <span
      class="text-xs font-medium tracking-wider text-base-content/60 uppercase"
    >
      Achats groupés
    </span>
    <div class="mt-1 flex flex-wrap gap-2">
      {#each invoices as invoice (invoice.invoiceId)}
        <button
          class="btn gap-1.5 btn-sm {invoice.purchaseStatus === 'delivered'
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

          <span class="badge badge-ghost badge-sm">{invoice.purchaseCount}</span
          >

          {#if invoice.purchaseStatus === "ordered" && invoice.deliveryDate}
            <span
              class="flex items-center gap-0.5 text-sm text-base-content/80"
            >
              <CalendarArrowDown class="size-4" />
              {formatDateOrNull(invoice.deliveryDate)}
            </span>
          {:else}
            <span
              class="flex items-center gap-0.5 text-sm text-base-content/80"
            >
              <CalendarMinus2 class="size-4" />
            </span>
          {/if}

          {#if invoice.who}
            <span
              class="flex items-center gap-0.5 text-sm text-base-content/50"
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

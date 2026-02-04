<!--
Modal de récapitulatif des dépenses
-->
<script lang="ts">
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    createExpensePurchase,
    updatePurchase,
  } from "$lib/services/appwrite-products";
  import type { Purchases } from "$lib/types/appwrite";
  import {
    BadgeEuro,
    PenLine,
    SquarePen,
    Calendar,
    Store as StoreIcon,
    User,
    Plus,
  } from "@lucide/svelte";
  import StoreInput from "$lib/components/ui/StoreInput.svelte";
  import WhoInput from "$lib/components/ui/WhoInput.svelte";
  import PriceInput from "$lib/components/ui/PriceInput.svelte";
  import CommentTextarea from "$lib/components/ui/CommentTextarea.svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import { formatDateDayMonthShort } from "@/lib/utils/date-helpers";

  let { isOpen = $bindable(false) } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let showAddForm = $state(false);

  // Formulaire d'ajout
  let newExpense = $state({
    invoiceTotal: 0,
    store: "",
    notes: "",
    who: "",
  });

  let editingPurchaseId = $state<string | null>(null);

  // Initialiser "who" avec l'utilisateur courant
  $effect(() => {
    if (isOpen && !editingPurchaseId) {
      const currentUser = localStorage.getItem("appwrite-user-name");
      if (currentUser) {
        newExpense.who = currentUser;
      }
    }
  });

  // Tri
  let sortColumn = $state<"date" | "amount" | "store" | "who">("date");
  let sortDirection = $state<"asc" | "desc">("desc");

  // Données dérivées du store
  let stats = $derived(productsStore.financialStats);
  let purchases = $derived(stats.allPurchases);

  // Filtrage et Tri local pour l'affichage
  let displayedPurchases = $derived.by(() => {
    let sorted = [...purchases];

    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortColumn) {
        case "date":
          valA = new Date(a.orderDate || a.$createdAt).getTime();
          valB = new Date(b.orderDate || b.$createdAt).getTime();
          break;
        case "amount":
          valA = a.invoiceTotal || a.price || 0;
          valB = b.invoiceTotal || b.price || 0;
          break;
        case "store":
          valA = (a.store || "").toLowerCase();
          valB = (b.store || "").toLowerCase();
          break;
        case "who":
          valA = (a.who || "").toLowerCase();
          valB = (b.who || "").toLowerCase();
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  });

  function toggleSort(column: "date" | "amount" | "store" | "who") {
    if (sortColumn === column) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "desc"; // Default desc for new column usually better for dates/amounts
    }
  }

  async function handleAddOrUpdateExpense() {
    if (!newExpense.invoiceTotal || newExpense.invoiceTotal <= 0) {
      error = "Le montant doit être supérieur à 0";
      return;
    }

    loading = true;
    error = null;

    try {
      const mainId = productsStore.currentMainId;
      if (!mainId) throw new Error("Aucun événement principal actif");

      if (editingPurchaseId) {
        // Mode Édition
        await updatePurchase(editingPurchaseId, {
          price: newExpense.invoiceTotal,
          invoiceTotal: newExpense.invoiceTotal,
          store: newExpense.store,
          notes: newExpense.notes,
          who: newExpense.who,
        });
      } else {
        // Mode Création
        await createExpensePurchase(
          mainId,
          undefined, // invoiceId auto-généré
          newExpense.invoiceTotal,
          newExpense.store,
          newExpense.notes,
          newExpense.who,
        );
      }

      // Reset form
      resetForm();
    } catch (e: any) {
      console.error("Erreur sauvegarde dépense:", e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    const currentUser = localStorage.getItem("appwrite-user-name") || "";
    newExpense = {
      invoiceTotal: 0,
      store: "",
      notes: "",
      who: currentUser,
    };
    editingPurchaseId = null;
    showAddForm = false;
  }

  function startEdit(purchase: Purchases) {
    newExpense = {
      invoiceTotal: purchase.invoiceTotal || purchase.price || 0,
      store: purchase.store || "",
      notes: purchase.notes || "",
      who: purchase.who || "",
    };
    editingPurchaseId = purchase.$id;
    showAddForm = true;
  }

  function handleClose() {
    isOpen = false;
    resetForm();
    error = null;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatPrice(amount: number | null) {
    return (amount || 0).toFixed(2) + " €";
  }
</script>

<ModalContainer {isOpen} onClose={handleClose} maxWidth="lg">
  <ModalHeader title="Gestion des Dépenses" onClose={handleClose}></ModalHeader>

  <ModalContent>
    <div class="space-y-6">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="stats bg-primary text-primary-content shadow">
          <div class="stat">
            <div class="stat-title text-primary-content/80">Total Global</div>
            <div class="stat-value text-xl">
              {formatPrice(stats.totalGlobal)}
            </div>
            <div class="stat-desc text-primary-content/80">
              {purchases.length} transactions
            </div>
          </div>
        </div>

        <!-- Breakdown Lists -->
        <div class="card bg-base-200 w-max-3xl h-full p-4 shadow-sm">
          <h4
            class="mb-2 text-sm font-semibold tracking-wider uppercase opacity-70"
          >
            Par Magasin
          </h4>
          <div class="w-max-3xl h-full space-y-1 text-sm">
            {#each Object.entries(stats.byStore).sort((a, b) => b[1] - a[1]) as [store, amount]}
              <div class="flex justify-between">
                <span>{store}</span>
                <span class="font-mono">{formatPrice(amount)}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="card bg-base-200 w-max-3xl h-full p-4 shadow-sm">
          <h4
            class="mb-2 text-sm font-semibold tracking-wider uppercase opacity-70"
          >
            Par Acheteur
          </h4>
          <div class="w-max-3xl h-full space-y-1 text-sm">
            {#each Object.entries(stats.byWho).sort((a, b) => b[1] - a[1]) as [who, amount]}
              <div class="flex justify-between">
                <span>{who}</span>
                <span class="font-mono">{formatPrice(amount)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-bold uppercase opacity-70">
          Liste des transactions
        </h4>
        {#if !showAddForm}
          <button
            class="btn btn-primary btn-sm"
            onclick={() => (showAddForm = true)}
          >
            <Plus class="mr-1 h-4 w-4" />
            Ajouter une dépense
          </button>
        {/if}
      </div>

      <!-- Add Expense Form -->
      {#if showAddForm}
        <div
          class="card bg-base-200 animate-in fade-in slide-in-from-top-4 shadow-md duration-300"
        >
          <div class="card-body p-4">
            <h4 class="card-title text-sm">
              {editingPurchaseId ? "Modifier la dépense" : "Nouvelle Dépense"}
            </h4>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PriceInput
                bind:value={newExpense.invoiceTotal}
                disabled={loading}
              />
              <StoreInput
                bind:value={newExpense.store}
                suggestions={productsStore.uniqueStores}
                disabled={loading}
              />
              <WhoInput
                bind:value={newExpense.who}
                suggestions={productsStore.uniqueWho}
                disabled={loading}
              />
              <CommentTextarea
                bind:value={newExpense.notes}
                disabled={loading}
              />
            </div>
            <div class="card-actions mt-2 justify-end">
              <button class="btn btn-sm btn-ghost" onclick={resetForm}
                >Annuler</button
              >
              <button
                class="btn btn-sm btn-primary"
                onclick={handleAddOrUpdateExpense}
                disabled={loading}
              >
                {#if loading}<span class="loading loading-spinner loading-xs"
                  ></span>{/if}
                {editingPurchaseId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
            {#if error}
              <div class="text-error mt-2 text-xs">{error}</div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Purchases Table (Desktop) -->
      {#if !globalState.isMobile}
        <div class="bg-base-100 border-base-200 rounded-lg border">
          <table class="table-zebra table-xs table w-full">
            <thead class="bg-base-200 sticky top-0">
              <tr>
                <th
                  class="hover:bg-base-300 cursor-pointer"
                  onclick={() => toggleSort("date")}
                >
                  Date {sortColumn === "date"
                    ? sortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </th>
                <th>Description</th>
                <th
                  class="hover:bg-base-300 cursor-pointer"
                  onclick={() => toggleSort("store")}
                >
                  Magasin {sortColumn === "store"
                    ? sortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </th>
                <th
                  class="hover:bg-base-300 cursor-pointer"
                  onclick={() => toggleSort("who")}
                >
                  Qui {sortColumn === "who"
                    ? sortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </th>
                <th
                  class="hover:bg-base-300 cursor-pointer text-right"
                  onclick={() => toggleSort("amount")}
                >
                  Montant {sortColumn === "amount"
                    ? sortDirection === "asc"
                      ? "↑"
                      : "↓"
                    : ""}
                </th>
                <th><PenLine size={14} /></th>
              </tr>
            </thead>
            <tbody>
              {#each displayedPurchases as purchase (purchase.$id)}
                <tr class="hover">
                  <td class="whitespace-nowrap"
                    >{formatDate(purchase.orderDate || purchase.$createdAt)}</td
                  >

                  <td class="max-w-xs truncate">
                    {#if purchase.status === "expense"}
                      <span class="text-base-content/70 italic"
                        >{purchase.notes || "-"}</span
                      >
                    {:else}
                      <span class="font-medium"
                        >{purchase["_productName"] || "Produit inconnu"}</span
                      >
                      {#if purchase.notes}
                        <span class="text-base-content/50 ml-1 text-xs"
                          >- {purchase.notes}</span
                        >
                      {/if}
                    {/if}
                  </td>
                  <td>{purchase.store || "-"}</td>
                  <td>{purchase.who || "-"}</td>
                  <td class="text-right font-mono font-bold">
                    {formatPrice(purchase.invoiceTotal || purchase.price)}
                  </td>
                  <td>
                    <button
                      class="btn btn-ghost btn-square"
                      onclick={() => startEdit(purchase)}
                    >
                      <SquarePen size={14} />
                    </button>
                  </td>
                </tr>
              {/each}
              {#if displayedPurchases.length === 0}
                <tr>
                  <td colspan="7" class="text-base-content/50 py-8 text-center"
                    >Aucune dépense trouvée</td
                  >
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      {:else}
        <!-- Mobile Card View -->
        <div class="space-y-3">
          {#each displayedPurchases as purchase (purchase.$id)}
            <div class="card bg-base-100 shadow-sm">
              <div class="card-body p-4">
                <div class="flex items-start justify-between gap-3">
                  <!-- Date et Montant -->
                  <div class="flex items-center gap-4 text-base">
                    <div class="flex items-center gap-2">
                      <Calendar class="h-3.5 w-3.5" />
                      <span
                        >{formatDateDayMonthShort(
                          purchase.orderDate || purchase.$createdAt,
                        )}</span
                      >
                    </div>
                    <div class="font-mono font-bold">
                      {formatPrice(purchase.invoiceTotal || purchase.price)}
                    </div>
                  </div>

                  <!-- Bouton édition -->
                  <button
                    class="btn btn-ghost btn-square btn-sm"
                    onclick={() => startEdit(purchase)}
                  >
                    <SquarePen size={16} />
                  </button>
                </div>

                <!-- Description -->
                <div class="">
                  {#if purchase.status === "expense" && purchase.notes}
                    <div class="text-sm italic opacity-70">
                      {purchase.notes}
                    </div>
                  {:else}
                    <div class="text-sm font-medium">
                      {purchase["_productName"] || "Produit inconnu"}
                    </div>
                    {#if purchase.notes}
                      <div class="text-xs opacity-60">{purchase.notes}</div>
                    {/if}
                  {/if}
                </div>

                <!-- Magasin et Qui -->
                <div class="mt-3 flex flex-wrap gap-3">
                  {#if purchase.store}
                    <div class="badge badge-soft gap-1">
                      <StoreIcon class="h-3 w-3" />
                      <span class="max-w-[150px] truncate"
                        >{purchase.store}</span
                      >
                    </div>
                  {/if}
                  {#if purchase.who}
                    <div class="badge badge-soft gap-1">
                      <User class="h-3 w-3" />
                      <span class="max-w-[100px] truncate">{purchase.who}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
          {#if displayedPurchases.length === 0}
            <div class="py-12 text-center opacity-50">
              <BadgeEuro class="mx-auto mb-3 h-12 w-12" />
              <p>Aucune dépense trouvée</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </ModalContent>
</ModalContainer>

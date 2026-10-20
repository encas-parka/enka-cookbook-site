<!--
  Modal de détail et gestion d'un achat groupé (FACTURE_*).
  Permet :
  - Visualiser les purchases du groupe
  - Modifier globalement le statut / date / who / store
  - Modifier un purchase individuel (détachement si status/who/store/date change)
  - Supprimer un purchase individuel (soft-delete)
  - Annuler tout l'achat groupé (batch soft-delete)
-->
<script lang="ts">
  import {
    Calendar,
    Check,
    Euro,
    PackageCheck,
    ShoppingCart,
    SquarePen,
    Trash2,
    User,
    Weight,
  } from "@lucide/svelte";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import type { DeliveryStatus } from "$lib/types/store.types";
  import type { Purchases } from "$lib/types/pb";
  import {
    formatDateOrNull,
    getStatusBadge,
  } from "$lib/utils/products-display.js";
  import { toInputDate } from "$lib/utils/date-helpers.js";
  import {
    formatSingleQuantity,
    convertAndFormatQuantity,
  } from "$lib/utils/QuantityFormatter.js";
  import { UnitConverter } from "$lib/utils/UnitConverter";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";
  import QuantityInput from "$lib/components/ui/QuantityInput.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";

  interface Props {
    invoiceId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
  }

  let { invoiceId, onClose, onSuccess }: Props = $props();

  // ─── État local ───────────────────────────────────────────
  let loading = $state(false);
  let error = $state<string | null>(null);

  // ConfirmModal
  let confirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmMessage = $state("");
  let confirmVariant = $state<"warning" | "danger">("warning");
  let confirmAction = $state<(() => Promise<void>) | null>(null);

  // ─── Édition globale (toujours visible) ───────────────────
  let globalStatus = $state<string>("");
  let globalDeliveryDate = $state<string>("");
  let globalWho = $state<string>("");
  let globalStore = $state<string>("");
  let globalInvoiceTotal = $state<string>("");

  // ─── Édition individuelle par purchase ────────────────────
  let editingPurchaseId = $state<string | null>(null);
  let editData = $state({
    quantity: 0,
    unit: "",
    price: "",
    status: "",
    deliveryDate: "",
    who: "",
    store: "",
  });

  // Dernier invoiceId synchronisé (pour ne réinitialiser qu'au changement)
  let prevInvoiceId = $state<string | null>(null);

  // ─── Données dérivées ─────────────────────────────────────
  let invoice = $derived(
    invoiceId
      ? (productsStore.groupedInvoices.find(
          (inv) => inv.invoiceId === invoiceId,
        ) ?? null)
      : null,
  );

  // Expense purchase du groupe (contient le prix total)
  let expensePurchase = $derived(
    invoice?.purchases.find((p) => p.status === "expense") ?? null,
  );

  let globalDirty = $derived.by(() => {
    if (!invoice) return false;
    const initialTotal =
      expensePurchase?.invoiceTotal != null
        ? String(expensePurchase.invoiceTotal)
        : "";
    return (
      globalStatus !== (invoice.purchaseStatus ?? "ordered") ||
      globalDeliveryDate !== toInputDate(invoice.deliveryDate) ||
      globalWho !== (invoice.who ?? "") ||
      globalStore !== (invoice.store ?? "") ||
      globalInvoiceTotal !== initialTotal
    );
  });

  // Purchases affichés (on exclut les expense)
  let displayPurchases = $derived(
    invoice?.purchases.filter((p) => p.status !== "expense") ?? [],
  );

  // Suggestions pour acheteur et magasin
  let whoSuggestions = $derived(productsStore.uniqueWho);
  let storeSuggestions = $derived(productsStore.uniqueStores);

  // ─── Effet : synchroniser les champs globaux au changement d'invoice ──
  $effect(() => {
    if (invoiceId && invoiceId !== prevInvoiceId) {
      prevInvoiceId = invoiceId;
      resetGlobalFields();
    }
  });

  // ─── Fonctions ────────────────────────────────────────────

  function resetGlobalFields() {
    if (!invoice) return;
    globalStatus = invoice.purchaseStatus ?? "ordered";
    globalDeliveryDate = toInputDate(invoice.deliveryDate);
    globalWho = invoice.who ?? "";
    globalStore = invoice.store ?? "";
    globalInvoiceTotal =
      expensePurchase?.invoiceTotal != null
        ? String(expensePurchase.invoiceTotal)
        : "";
  }

  function startEditPurchase(purchase: Purchases) {
    editingPurchaseId = purchase.id;
    const { value: displayQuantity, unit: displayUnit } =
      convertAndFormatQuantity(purchase.quantity, purchase.unit);
    editData = {
      quantity: displayQuantity,
      unit: displayUnit,
      price: purchase.price != null ? String(purchase.price) : "",
      status: purchase.status ?? "",
      deliveryDate: toInputDate(purchase.deliveryDate),
      who: purchase.who ?? "",
      store: purchase.store ?? "",
    };
  }

  function cancelEditPurchase() {
    editingPurchaseId = null;
  }

  /** Détermine si l'édition nécessite un détachement du groupe */
  function needsDetach(purchase: Purchases): boolean {
    return (
      editData.status !== (purchase.status ?? "") ||
      editData.deliveryDate !== toInputDate(purchase.deliveryDate) ||
      editData.who !== (purchase.who ?? "") ||
      editData.store !== (purchase.store ?? "")
    );
  }

  async function savePurchaseEdit(purchase: Purchases) {
    loading = true;
    error = null;

    const shouldDetach = needsDetach(purchase);
    const doSave = async () => {
      try {
        // Normaliser les unités pour le stockage (kg→gr., l.→ml)
        const normalized = UnitConverter.normalize(
          editData.quantity ?? 0,
          editData.unit,
        );
        await toastService.track(
          productsStore.updateInvoicePurchase(
            purchase.id,
            {
              quantity: normalized.quantity,
              unit: normalized.unit,
              price: editData.price !== "" ? Number(editData.price) : null,
              ...(shouldDetach && { status: editData.status || null }),
              ...(shouldDetach && {
                deliveryDate: editData.deliveryDate || null,
              }),
              ...(shouldDetach && { who: editData.who || null }),
              ...(shouldDetach && { store: editData.store || null }),
            },
            shouldDetach,
          ),
          {
            loading: "Enregistrement de l'achat…",
            success: shouldDetach
              ? "Achat modifié et détaché du groupe"
              : "Achat modifié",
            error: (e) => (e as Error).message,
          },
        );
        editingPurchaseId = null;
        onSuccess?.();
      } catch (e: any) {
        error = e.message;
      } finally {
        loading = false;
      }
    };

    if (shouldDetach) {
      confirmTitle = "Détacher du groupe";
      confirmMessage =
        "Modifier le statut, la date, l'acheteur ou le magasin de cet achat le détachera de l'achat groupé. Continuer ?";
      confirmVariant = "warning";
      confirmAction = doSave;
      confirmOpen = true;
    } else {
      await doSave();
    }
  }

  // ─── Actions globales ─────────────────────────────────────

  async function saveGlobal() {
    if (!invoice) return;
    loading = true;
    error = null;
    try {
      // Construire le payload expense pour inclusion dans le même batch
      const expenseUpdate:
        | {
            purchaseId: string;
            price: number;
            invoiceTotal: number;
          }
        | undefined =
        expensePurchase &&
        globalInvoiceTotal !== "" &&
        !isNaN(Number(globalInvoiceTotal)) &&
        Number(globalInvoiceTotal) !== expensePurchase.invoiceTotal
          ? {
              purchaseId: expensePurchase.id,
              price: Number(globalInvoiceTotal),
              invoiceTotal: Number(globalInvoiceTotal),
            }
          : undefined;

      await toastService.track(
        (async () => {
          await productsStore.updateInvoiceGroup(invoice.invoiceId, {
            status: globalStatus as DeliveryStatus,
            deliveryDate: globalDeliveryDate || null,
            who: globalWho || null,
            store: globalStore || null,
            expense: expenseUpdate,
          });

          // Création de l'expense à la volée (cas edge : pas d'expense existant)
          if (!expensePurchase && globalInvoiceTotal !== "") {
            const newTotal = Number(globalInvoiceTotal);
            if (!isNaN(newTotal)) {
              await productsStore.createExpense({
                invoiceTotal: newTotal,
                store: globalStore || undefined,
                who: globalWho || undefined,
                invoiceId: invoice.invoiceId,
              });
            }
          }
        })(),
        {
          loading: "Mise à jour de l'achat groupé…",
          success: "Achat groupé mis à jour",
          error: (e) => (e as Error).message,
        },
      );

      onSuccess?.();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function confirmDeleteGroup() {
    if (!invoice) return;
    confirmTitle = "Annuler cet achat groupé";
    confirmMessage =
      "L'annulation de cet achat groupé annulera l'ensemble des achats déclarés de cette liste. Cette action est irréversible.";
    confirmVariant = "danger";
    confirmAction = async () => {
      loading = true;
      error = null;
      try {
        await toastService.track(
          productsStore.deleteInvoiceGroup(invoice.invoiceId),
          {
            loading: "Annulation de l'achat groupé…",
            success: "Achat groupé annulé",
            error: (e) => (e as Error).message,
          },
        );
        onClose();
        onSuccess?.();
      } catch (e: any) {
        error = e.message;
      } finally {
        loading = false;
      }
    };
    confirmOpen = true;
  }

  // ─── Suppression individuelle ─────────────────────────────

  function confirmDeletePurchase(purchase: Purchases) {
    if (!invoice) return;
    const productName = productsStore.getProductNameForPurchase(purchase);
    const qty = formatSingleQuantity(purchase.quantity, purchase.unit);
    confirmTitle = "Supprimer cet achat";
    confirmMessage = `Supprimer l'achat de « ${productName} » (${qty}) de cet achat groupé (ceci supprimera l'achat, la quantité déclarée par celui-ci sera rétablie comme "manquante") ?  Cette action est irréversible.`;
    confirmVariant = "danger";
    confirmAction = async () => {
      loading = true;
      error = null;
      try {
        await toastService.track(
          productsStore.updateInvoicePurchase(purchase.id, {
            status: "deleted",
          }),
          {
            loading: "Suppression de l'achat…",
            success: "Achat supprimé",
            error: (e) => (e as Error).message,
          },
        );
        onSuccess?.();
      } catch (e: any) {
        error = e.message;
      } finally {
        loading = false;
      }
    };
    confirmOpen = true;
  }

  // ─── ConfirmModal handlers ────────────────────────────────

  async function handleConfirmOk() {
    confirmOpen = false;
    await confirmAction?.();
  }

  function handleConfirmCancel() {
    confirmOpen = false;
    confirmAction = null;
  }

  function handleClose() {
    editingPurchaseId = null;
    error = null;
    onClose();
  }
</script>

<ModalContainer isOpen={invoiceId !== null} onClose={handleClose} maxWidth="lg">
  <ModalHeader
    title={invoice
      ? `Achat groupé · ${invoice.store || "Magasin"}`
      : "Achat groupé"}
    onClose={handleClose}
  />

  <ModalContent>
    {#if invoice}
      <div class="space-y-5">
        <!-- Erreur -->
        {#if error}
          <div class="alert alert-soft alert-error">
            <span class="text-sm">{error}</span>
          </div>
        {/if}

        <!-- ═══ Header récapitulatif ═══ -->
        <div class="flex flex-wrap items-center gap-3">
          <div
            class="badge badge-md {invoice.purchaseStatus === 'delivered'
              ? 'badge-success'
              : 'badge-info'}"
          >
            {#if invoice.purchaseStatus === "delivered"}
              <PackageCheck class="size-3.5" />
              Livré
            {:else}
              <ShoppingCart class="size-3.5" />
              Commandé
            {/if}
          </div>

          {#if invoice.deliveryDate}
            <div class="flex items-center gap-1 text-sm">
              <Calendar class="size-3.5" />
              livré le : {formatDateOrNull(invoice.deliveryDate)}
            </div>
          {/if}

          {#if invoice.invoiceTotal != null}
            <div class="flex items-center gap-1 font-mono font-bold">
              <Euro class="size-3.5" />
              {invoice.invoiceTotal.toFixed(2)}€
            </div>
          {/if}

          <span class="text-xs text-base-content/50">
            {displayPurchases.length} achat{displayPurchases.length > 1
              ? "s"
              : ""}
          </span>
        </div>

        <!-- ═══ Zone : Modifier l'achat groupé ═══ -->
        <div class="rounded-lg bg-base-200 p-4">
          <div class="mb-3 text-sm font-semibold">Modifier l'achat groupé</div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Statut</legend>
              <select
                class="select w-full"
                bind:value={globalStatus}
                disabled={loading}
              >
                <option value="ordered">Commandé</option>
                <option value="delivered">Livré</option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Date de livraison</legend>
              <label class="input w-full">
                <input
                  type="date"
                  class="grow"
                  bind:value={globalDeliveryDate}
                  disabled={loading}
                />
              </label>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Acheteur</legend>
              <label class="input w-full">
                <input
                  type="text"
                  class="grow"
                  placeholder="Qui a fait les achats ?"
                  list="suggest-who"
                  bind:value={globalWho}
                  disabled={loading}
                />
              </label>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Magasin</legend>
              <label class="input w-full">
                <input
                  type="text"
                  class="grow"
                  placeholder="Nom du magasin"
                  list="suggest-store"
                  bind:value={globalStore}
                  disabled={loading}
                />
              </label>
            </fieldset>

            <fieldset class="fieldset">
              <legend class="fieldset-legend">Prix total (€)</legend>
              <label class="input w-full">
                <Euro class="opacity-50" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  class="grow"
                  placeholder="Montant total"
                  bind:value={globalInvoiceTotal}
                  disabled={loading}
                />
              </label>
            </fieldset>
          </div>

          <div class="mt-4 flex items-center justify-between gap-2">
            <button
              class="btn btn-ghost text-error"
              onclick={confirmDeleteGroup}
              disabled={loading}
            >
              <Trash2 class="size-4" />
              Annuler cet achat groupé
            </button>
            <div class="flex items-center gap-2">
              <button
                class="btn btn-ghost"
                onclick={resetGlobalFields}
                disabled={loading || !globalDirty}
              >
                Annuler
              </button>
              <button
                class="btn btn-primary"
                onclick={saveGlobal}
                disabled={loading || !globalDirty}
              >
                {#if loading}
                  <span class="loading loading-xs loading-spinner"></span>
                {:else}
                  <Check class="size-4" />
                {/if}
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        <!-- Datalists pour suggestions -->
        <datalist id="suggest-who">
          {#each whoSuggestions as name}
            <option value={name}></option>
          {/each}
        </datalist>
        <datalist id="suggest-store">
          {#each storeSuggestions as name}
            <option value={name}></option>
          {/each}
        </datalist>

        <!-- ═══ Liste des purchases ═══ -->
        <div class="space-y-2">
          {#each displayPurchases as purchase (purchase.id)}
            {#if editingPurchaseId === purchase.id}
              <!-- ─── Card en mode édition ─── -->
              <div
                class="card border border-primary/40 bg-base-100 shadow-sm card-xs"
              >
                <div class="card-body">
                  <div class="mb-2 text-sm font-medium">
                    {productsStore.getProductNameForPurchase(purchase)}
                  </div>
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <fieldset>
                      <legend class="fieldset-legend text-xs">Quantité</legend>
                      <div class="col-span-2 sm:col-span-1">
                        <QuantityInput
                          bind:quantity={editData.quantity}
                          bind:unit={editData.unit}
                          disabled={loading}
                          required={false}
                        />
                      </div>
                    </fieldset>
                    <fieldset class="fieldset">
                      <legend class="fieldset-legend text-xs">Statut</legend>
                      <select
                        class="select w-full"
                        bind:value={editData.status}
                        disabled={loading}
                      >
                        <option value="ordered">Commandé</option>
                        <option value="delivered">Livré</option>
                      </select>
                    </fieldset>
                    <fieldset class="fieldset">
                      <legend class="fieldset-legend text-xs"
                        >Date livraison</legend
                      >
                      <label class="input w-full">
                        <input
                          type="date"
                          class="grow"
                          bind:value={editData.deliveryDate}
                          disabled={loading}
                        />
                      </label>
                    </fieldset>
                    <fieldset class="fieldset">
                      <legend class="fieldset-legend text-xs">Acheteur</legend>
                      <label class="input w-full">
                        <input
                          type="text"
                          class="grow"
                          bind:value={editData.who}
                          disabled={loading}
                        />
                      </label>
                    </fieldset>
                  </div>
                  <div class="mt-2 flex items-center justify-end gap-2">
                    <button
                      class="btn btn-ghost btn-sm"
                      onclick={cancelEditPurchase}
                      disabled={loading}
                    >
                      Annuler
                    </button>
                    <button
                      class="btn btn-primary btn-sm"
                      onclick={() => savePurchaseEdit(purchase)}
                      disabled={loading}
                    >
                      {#if loading}
                        <span class="loading loading-xs loading-spinner"></span>
                      {:else}
                        <Check class="size-3.5" />
                      {/if}
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <!-- ─── Card en mode lecture ─── -->
              <div
                class="card border border-neutral/40 bg-base-100 shadow-sm card-xs"
              >
                <div class="card-body">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span class="text-sm font-medium">
                      {productsStore.getProductNameForPurchase(purchase)}
                    </span>

                    <span class="flex items-center gap-1 text-sm">
                      <Weight class="size-3.5" />
                      {formatSingleQuantity(purchase.quantity, purchase.unit)}
                    </span>

                    <span class="flex items-center gap-0.5 text-sm">
                      {purchase.price != null ? purchase.price : "?"}
                      <Euro class="inline size-3" />
                    </span>

                    <div
                      class="badge badge-sm {getStatusBadge(purchase.status)
                        .class}"
                    >
                      {getStatusBadge(purchase.status).text}
                    </div>

                    <div
                      class="ml-auto inline-flex shrink-0 items-center gap-1"
                    >
                      <button
                        class="btn btn-square btn-ghost btn-sm"
                        onclick={() => startEditPurchase(purchase)}
                        disabled={loading}
                        title="Modifier cet achat"
                      >
                        <SquarePen size={16} />
                      </button>
                      <button
                        class="btn btn-square btn-ghost text-error btn-sm"
                        onclick={() => confirmDeletePurchase(purchase)}
                        disabled={loading}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}

          {#if displayPurchases.length === 0}
            <div class="py-8 text-center text-sm text-base-content/50">
              Aucun achat dans ce groupe
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="py-8 text-center text-sm text-base-content/50">
        Achat groupé introuvable
      </div>
    {/if}
  </ModalContent>
</ModalContainer>

<ConfirmModal
  isOpen={confirmOpen}
  title={confirmTitle}
  message={confirmMessage}
  variant={confirmVariant}
  onConfirm={handleConfirmOk}
  onCancel={handleConfirmCancel}
/>

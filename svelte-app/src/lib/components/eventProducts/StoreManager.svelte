<script lang="ts">
  import type {
    StoreInfo,
    ProductModalStateType,
  } from "$lib/types/store.types";
  import { productsStore } from "$lib/stores/ProductsStore.svelte";
  import ArchiveMessage from "./ArchiveMessage.svelte";
  import StoreInput from "../ui/StoreInput.svelte";
  import CommentTextarea from "../ui/CommentTextarea.svelte";

  interface Props {
    modalState: ProductModalStateType;
    isArchiveMode?: boolean;
  }

  let { modalState, isArchiveMode = false }: Props = $props();

  const isFormValid = $derived(modalState?.hasChanges?.store || false);

  async function handleUpdateStore() {
    if (!isFormValid) return;

    const storeInfo: StoreInfo = {
      storeName: modalState.forms.store.name?.trim() || "",
      storeComment: modalState.forms.store.comment?.trim() || undefined,
    };

    await modalState.updateStore(storeInfo);
  }
</script>

<div class="space-y-4">
  {#if isArchiveMode}
    <ArchiveMessage
      title="Magasin non modifiable"
      message="L'événement est terminé, les informations de magasin ne peuvent plus être modifiées."
      data={modalState.product?.storeInfo}
      dataLabel="Magasin actuel"
    />
  {:else}
    <div class="card bg-base-200">
      <div class="card-body">
        <h4 class="card-title text-base">Magasin</h4>

        <p class="mb-4 text-sm opacity-75">
          Définissez le magasin où vous prévoyez d'acheter ce produit.
        </p>

        <div class="grid-col-1 grid gap-4">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <StoreInput
              bind:value={modalState.forms.store.name}
              suggestions={productsStore.uniqueStores}
              disabled={modalState.loading}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  handleUpdateStore();
                }
              }}
            />
          </div>

          <CommentTextarea
            bind:value={modalState.forms.store.comment}
            disabled={modalState.loading}
          />
        </div>

        <div class="card-actions mt-4 justify-end">
          <button
            class="btn btn-ghost btn-sm"
            onclick={() => {
              modalState.forms.store.name = "";
              modalState.forms.store.comment = "";
            }}
            disabled={modalState.loading}
          >
            Effacer
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

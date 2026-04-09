<script lang="ts">
  import {
    Soup,
    Zap,
    Flame,
    Package,
    Search,
    X,
    Check,
    ChefHat,
    Wrench,
    Utensils,
    Hand,
  } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import CatalogItemRow from "$lib/components/teamMatos/CatalogItemRow.svelte";
  import {
    MATERIEL_CATALOG,
    CATALOG_TYPE_GROUPS,
    type CatalogItem,
  } from "$lib/constants/materiel-catalog";
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type { CreateEventMaterielData } from "$lib/types/event-materiel.types";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
  }

  let { isOpen, onClose, eventId }: Props = $props();

  let searchQuery = $state("");
  let quantities = $state<Record<string, number>>({});
  let loading = $state(false);

  const unsourcedByCatalogName = $derived.by(() => {
    const result: Record<string, { quantity: number; ids: string[] }> = {};
    for (const m of eventMaterielStore.items) {
      if (!m.who && !m.where) {
        if (!result[m.name]) result[m.name] = { quantity: 0, ids: [] };
        result[m.name].quantity += m.quantity;
        result[m.name].ids.push(m.$id);
      }
    }
    return result;
  });

  const sourcedByCatalogName = $derived.by(() => {
    const result: Record<string, { label: string; qty: number }[]> = {};
    for (const m of eventMaterielStore.items) {
      if (m.who || m.where) {
        const label = m.fromTeamName || m.where || m.who || "source inconnue";
        if (!result[m.name]) result[m.name] = [];
        result[m.name].push({ label, qty: m.quantity });
      }
    }
    return result;
  });

  const catalogByType = $derived.by(() => {
    const map = new Map<CatalogItem["type"], CatalogItem[]>();
    for (const item of MATERIEL_CATALOG) {
      const q = searchQuery.toLowerCase().trim();
      if (q && !item.name.toLowerCase().includes(q)) continue;
      const list = map.get(item.type) || [];
      list.push(item);
      map.set(item.type, list);
    }
    return map;
  });

  const summary = $derived.by(() => {
    let itemCount = 0;
    let totalQty = 0;
    for (const [name, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        itemCount++;
        totalQty += qty;
      }
    }
    return { itemCount, totalQty };
  });

  const hasChanges = $derived.by(() => {
    for (const [name, qty] of Object.entries(quantities)) {
      const oldQty = unsourcedByCatalogName[name]?.quantity ?? 0;
      if (qty !== oldQty) return true;
    }
    return false;
  });

  const hasSelection = $derived(summary.itemCount > 0);

  function setQuantity(itemName: string, qty: number) {
    quantities[itemName] = qty;
  }

  const iconMap: Record<string, any> = {
    Soup,
    ChefHat,
    Wrench,
    Utensils,
    Zap,
    Flame,
    Hand,
    Package,
  };

  $effect(() => {
    if (isOpen) {
      const init: Record<string, number> = {};
      for (const item of MATERIEL_CATALOG) {
        const unsourced = unsourcedByCatalogName[item.name];
        if (unsourced) {
          init[item.name] = unsourced.quantity;
        }
      }
      quantities = init;
      searchQuery = "";
    }
  });

  async function handleSubmit() {
    if (!hasChanges || loading) return;

    loading = true;

    try {
      let created = 0;
      let updated = 0;
      let deleted = 0;

      for (const item of MATERIEL_CATALOG) {
        const newQty = quantities[item.name] ?? 0;
        const unsourced = unsourcedByCatalogName[item.name];

        if (!unsourced && newQty > 0) {
          const data: CreateEventMaterielData = {
            eventId,
            name: item.name,
            type: item.type as CreateEventMaterielData["type"],
            quantity: newQty,
          };
          await eventMaterielStore.addItem(data, globalState.userId || "");
          created++;
        } else if (unsourced) {
          if (newQty > 0 && newQty !== unsourced.quantity) {
            await eventMaterielStore.updateItem(unsourced.ids[0], {
              quantity: newQty,
            });
            updated++;
            for (let i = 1; i < unsourced.ids.length; i++) {
              await eventMaterielStore.deleteItem(unsourced.ids[i]);
              deleted++;
            }
          } else if (newQty === 0) {
            for (const id of unsourced.ids) {
              await eventMaterielStore.deleteItem(id);
              deleted++;
            }
          }
        }
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`${created} ajouté${created > 1 ? "s" : ""}`);
      if (updated > 0) parts.push(`${updated} mis à jour`);
      if (deleted > 0) parts.push(`${deleted} retiré${deleted > 1 ? "s" : ""}`);
      if (parts.length > 0) {
        toastService.success(`Besoins : ${parts.join(", ")}`);
      }
      handleClose();
    } catch (err) {
      toastService.error(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    searchQuery = "";
    quantities = {};
    onClose();
  }
</script>

<ModalContainer {isOpen} onClose={handleClose} maxWidth="lg">
  <ModalHeader title="Gérer les besoins rapidement" onClose={handleClose} />

  <ModalContent>
    <div class="mb-4">
      <label class="input input-bordered input-sm w-full">
        <Search class="size-4 opacity-50" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Rechercher dans le catalogue..."
        />
      </label>
    </div>

    <div class="space-y-2">
      {#each CATALOG_TYPE_GROUPS as group (group.type)}
        {@const items = catalogByType.get(group.type) || []}
        {#if items.length > 0}
          <div class="collapse-arrow bg-base-200 collapse">
            <input
              type="checkbox"
              checked={group.defaultOpen || searchQuery.trim().length > 0}
            />
            <div
              class="collapse-title flex items-center gap-2 text-sm font-semibold"
            >
              {#if iconMap[group.icon]}
                {@const Icon = iconMap[group.icon]}
                <Icon class="size-4" />
              {/if}
              {group.label}
              <span class="badge badge-sm badge-ghost">{items.length}</span>
            </div>
            <div class="collapse-content">
              <div class="space-y-1 pt-1">
                {#each items as item (item.name)}
                  <CatalogItemRow
                    name={item.name}
                    quantity={quantities[item.name] || 0}
                    existingQuantity={unsourcedByCatalogName[item.name]
                      ?.quantity || 0}
                    existingLabel="à trouver:"
                    sourcedBatches={sourcedByCatalogName[item.name]}
                    onchange={(qty) => setQuantity(item.name, qty)}
                  />
                {/each}
              </div>
            </div>
          </div>
        {/if}
      {/each}

      {#if catalogByType.size === 0}
        <div class="text-base-content/60 py-8 text-center">
          Aucun résultat pour "{searchQuery}"
        </div>
      {/if}
    </div>
  </ModalContent>

  <ModalFooter>
    <div class="flex w-full items-center justify-between">
      <span class="text-base-content/70 text-sm">
        {#if hasSelection}
          {summary.itemCount} item{summary.itemCount > 1 ? "s" : ""} — quantité totale
          : {summary.totalQty}
        {:else}
          Sélectionnez des items
        {/if}
      </span>

      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" onclick={handleClose}>
          <X class="size-4" />
          Annuler
        </button>
        <button
          class="btn btn-primary btn-sm"
          onclick={handleSubmit}
          disabled={!hasChanges || loading}
        >
          {#if loading}
            <span class="loading loading-spinner loading-xs"></span>
          {:else}
            <Check class="size-4" />
          {/if}
          Enregistrer
        </button>
      </div>
    </div>
  </ModalFooter>
</ModalContainer>

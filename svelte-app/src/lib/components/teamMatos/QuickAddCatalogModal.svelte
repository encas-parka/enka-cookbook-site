<script lang="ts">
  import { Soup, Zap, Flame, Package, Search, X, Check } from "@lucide/svelte";
  import ModalContainer from "$lib/components/ui/modal/ModalContainer.svelte";
  import ModalHeader from "$lib/components/ui/modal/ModalHeader.svelte";
  import ModalContent from "$lib/components/ui/modal/ModalContent.svelte";
  import ModalFooter from "$lib/components/ui/modal/ModalFooter.svelte";
  import CatalogItemRow from "$lib/components/teamMatos/CatalogItemRow.svelte";
  import {
    MATERIEL_CATALOG,
    CATALOG_TYPE_GROUPS,
  } from "$lib/constants/materiel-catalog";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import type { CatalogType } from "$lib/constants/materiel-catalog";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
  }

  let { isOpen, onClose, teamId, teamName }: Props = $props();

  let searchQuery = $state("");
  let quantities = $state<Record<string, number>>({});
  let loading = $state(false);

  const existingByCatalogName = $derived.by(() => {
    const result: Record<string, { id: string; quantity: number }> = {};
    for (const m of materielStore.getMaterielsByOwner(teamId)) {
      result[m.name] = { id: m.id, quantity: m.quantity };
    }
    return result;
  });

  const catalogByType = $derived.by(() => {
    const map = new Map<CatalogType, typeof MATERIEL_CATALOG>();
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
      const existing = existingByCatalogName[name];
      const oldQty = existing?.quantity ?? 0;
      if (qty !== oldQty) return true;
    }
    for (const name of Object.keys(existingByCatalogName)) {
      if (!(name in quantities)) continue;
    }
    return false;
  });

  const hasSelection = $derived(summary.itemCount > 0);

  function setQuantity(itemName: string, qty: number) {
    quantities[itemName] = qty;
  }

  $effect(() => {
    if (isOpen) {
      const init: Record<string, number> = {};
      for (const item of MATERIEL_CATALOG) {
        const existing = existingByCatalogName[item.name];
        if (existing) {
          init[item.name] = existing.quantity;
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

      for (const item of MATERIEL_CATALOG) {
        const newQty = quantities[item.name] ?? 0;
        const existing = existingByCatalogName[item.name];

        if (!existing && newQty > 0) {
          await materielStore.createMateriel({
            name: item.name,
            type: item.type,
            quantity: newQty,
            teamId,
            status: "ok",
          });
          created++;
        } else if (existing && newQty !== existing.quantity) {
          if (newQty > 0) {
            await materielStore.updateMateriel(existing.id, {
              quantity: newQty,
            });
            updated++;
          }
        }
      }

      const parts: string[] = [];
      if (created > 0) parts.push(`${created} ajouté${created > 1 ? "s" : ""}`);
      if (updated > 0) parts.push(`${updated} mis à jour`);
      if (parts.length > 0) {
        toastService.success(`Matériel : ${parts.join(", ")}`);
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
  <ModalHeader title="Gérer le matériel rapidement" onClose={handleClose} />

  <ModalContent>
    <div class="mb-4">
      <label class="input input-sm w-full">
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
              {#if group.icon === "Soup"}
                <Soup class="size-4" />
              {:else if group.icon === "Zap"}
                <Zap class="size-4" />
              {:else if group.icon === "Flame"}
                <Flame class="size-4" />
              {:else}
                <Package class="size-4" />
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
                    existingQuantity={existingByCatalogName[item.name]
                      ?.quantity || 0}
                    existingLabel="déjà possédé"
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

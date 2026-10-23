<script lang="ts">
  /**
   * Parcours legacy de sélection du matériel : autocomplétion + « ajout
   * rapide ». Conservé pour le rollback du prototype liste plate — il n'est
   * monté que par le modal (`selectionMode: "legacy"`), jamais par la page
   * dossier, qui ne charge donc pas ce composant.
   */
  import type { EnrichedMateriel } from "$lib/types/materiel.types";
  import type { MaterielWithAvailability } from "$lib/utils/materiel-list.utils";
  import AutocompleteInput from "../../ui/AutocompleteInput.svelte";
  import QuickMaterielSelectionModal from "../QuickMaterielSelectionModal.svelte";
  import type { SelectedMateriel } from "./loan.types";
  import {
    Box,
    ChefHat,
    Flame,
    Info,
    Minus,
    Package,
    Plus,
    SoapDispenserDroplet,
    Sparkles,
    Utensils,
    Wrench,
    X,
    Zap,
  } from "@lucide/svelte";

  interface Props {
    /** Matériels disponibles sur la période (hors fantômes). */
    availableMateriels: MaterielWithAvailability[];
    /** Inventaire complet de l'équipe, dispo comprise (catalogue rapide). */
    allMateriels: MaterielWithAvailability[];
    /** Disponibilité réelle par matériel (id → quantité). */
    availabilityMap: Map<string, number>;
    /** Matériels retenus ; la sélection est pilotée par le parent. */
    selectedMateriels: SelectedMateriel[];
    loading?: boolean;
  }

  let {
    availableMateriels,
    allMateriels,
    availabilityMap,
    selectedMateriels = $bindable([]),
    loading = false,
  }: Props = $props();

  let showQuickSelection = $state(false);

  function handleAddMateriel(materiel: EnrichedMateriel) {
    const maxQty =
      (materiel as MaterielWithAvailability).availableForPeriod ??
      materiel.availableQuantity;

    const existing = selectedMateriels.find(
      (m) => m.materielId === materiel.id,
    );
    if (existing) {
      if (existing.quantity < maxQty) {
        existing.quantity++;
      }
      return;
    }

    selectedMateriels = [
      ...selectedMateriels,
      {
        materielId: materiel.id,
        materielName: materiel.name,
        quantity: 1,
        type: materiel.type || "",
        maxQuantity: maxQty,
      },
    ];
  }

  function getStep(maxQuantity: number): number {
    if (maxQuantity <= 15) return 1;
    return 5;
  }

  // Plafond dynamique : lit la disponibilité réelle depuis availabilityMap
  // fallback = maxQuantity stocké (utile quand pas de dates)
  // Si absent de la map = matériel soft-deleté → 0
  function getEffectiveMax(materielId: string, fallbackMax: number): number {
    const available = availabilityMap.get(materielId);
    // Si le matériel est dans la map, c'est la vraie dispo sur la période
    if (available !== undefined) return available;
    // Si pas de dates, le matériel n'est pas dans la map
    // → vérifier s'il est deleted (maxQuantity === 0)
    const item = selectedMateriels.find((m) => m.materielId === materielId);
    if (item?.isDeleted) return 0;
    return fallbackMax;
  }

  function handleQuantityChange(materielId: string, newQuantity: number) {
    const max = getEffectiveMax(
      materielId,
      selectedMateriels.find((m) => m.materielId === materielId)?.maxQuantity ??
        0,
    );
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId
        ? { ...m, quantity: Math.max(0, Math.min(newQuantity, max)) }
        : m,
    );
  }

  function handleRemoveMateriel(materielId: string) {
    selectedMateriels = selectedMateriels.map((m) =>
      m.materielId === materielId ? { ...m, quantity: 0 } : m,
    );
  }

  function handleTakeAll() {
    selectedMateriels = selectedMateriels.map((m) => ({
      ...m,
      quantity: getEffectiveMax(m.materielId, m.maxQuantity),
    }));
  }

  function handleQuickSelectionAdd(materielIds: string[]) {
    // Retirer les matériels qui étaient sélectionnés mais ont été décochés
    const newIdsSet = new Set(materielIds);
    selectedMateriels = selectedMateriels.filter((m) =>
      newIdsSet.has(m.materielId),
    );

    // Ajouter les nouveaux matériels cochés
    materielIds.forEach((id) => {
      const already = selectedMateriels.find((m) => m.materielId === id);
      if (!already) {
        const materiel = availableMateriels.find((m) => m.id === id);
        if (materiel) {
          handleAddMateriel(materiel);
        }
      }
    });

    showQuickSelection = false;
  }

  function getItemConflictInfo(
    materielId: string,
    quantity: number,
  ): {
    isUnavailable: boolean;
    unavailableCount: number;
    available: number;
  } {
    // Pendant la sauvegarde, on fige l'affichage pour éviter un flash "indisponible"
    if (loading) {
      return { isUnavailable: false, unavailableCount: 0, available: quantity };
    }
    const available = availabilityMap.get(materielId) ?? 0;
    if (quantity > 0 && available === 0) {
      return { isUnavailable: true, unavailableCount: quantity, available: 0 };
    }
    if (quantity > available) {
      return {
        isUnavailable: false,
        unavailableCount: quantity - available,
        available,
      };
    }
    return { isUnavailable: false, unavailableCount: 0, available };
  }
</script>

<div class="space-y-4">
  <div class="flex flex-wrap gap-6">
    <div class="flex-1">
      <AutocompleteInput
        items={availableMateriels}
        itemToString={(m) => m.name}
        onSelect={(m) => handleAddMateriel(m)}
        placeholder="Rechercher du matériel..."
        disabled={loading}
      />
    </div>
    <button
      class="btn btn-md btn-secondary flex-1 gap-2"
      onclick={() => (showQuickSelection = true)}
      disabled={loading || availableMateriels.length === 0}
    >
      <Sparkles class="h-4 w-4" />
      Ajout rapide
    </button>
  </div>

  {#if availableMateriels.length === 0}
    <div class="alert alert-warning">
      <Info class="h-5 w-5" />
      <span>Aucun matériel disponible pour la période sélectionnée.</span>
    </div>
  {/if}

  {#if selectedMateriels.length > 0}
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold opacity-70">Matériels sélectionnés</p>
        {#if selectedMateriels.some((m) => {
          const eMax = getEffectiveMax(m.materielId, m.maxQuantity);
          return eMax > m.quantity && !getItemConflictInfo(m.materielId, m.quantity).isUnavailable;
        })}
          <button
            class="link link-primary text-xs font-medium"
            onclick={handleTakeAll}
            disabled={loading}
          >
            Tout prendre
          </button>
        {:else}
          <span class="text-xs font-medium">Tout pris</span>
        {/if}
      </div>
      {#each selectedMateriels as materiel (materiel.materielId)}
        {@const TypeIcon =
          materiel.type === "electronic"
            ? Zap
            : materiel.type === "manual"
              ? Wrench
              : materiel.type === "cooking"
                ? ChefHat
                : materiel.type === "dish"
                  ? Utensils
                  : materiel.type === "gaz"
                    ? Flame
                    : materiel.type === "hygiene"
                      ? SoapDispenserDroplet
                      : Box}
        {@const conflict = getItemConflictInfo(
          materiel.materielId,
          materiel.quantity,
        )}
        {@const hasConflict = conflict.unavailableCount > 0}
        {@const effectiveMax = getEffectiveMax(
          materiel.materielId,
          materiel.maxQuantity,
        )}

        <div
          class="rounded-lg p-2 transition-opacity {materiel.quantity === 0
            ? 'opacity-50'
            : hasConflict
              ? 'bg-error/20'
              : 'bg-base-200'}"
        >
          <div class="flex items-center gap-2">
            <div class="bg-base-300 rounded p-1">
              <TypeIcon class="h-4 w-4 opacity-70" />
            </div>

            <div
              class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
            >
              <div
                class="truncate font-medium {materiel.quantity === 0
                  ? 'line-through'
                  : ''}"
              >
                {materiel.materielName}
              </div>
              {#if materiel.isDeleted}
                <span class="badge badge-sm badge-error">Supprimé</span>
              {:else if hasConflict}
                <span class="badge badge-sm badge-error">
                  {conflict.isUnavailable
                    ? "Indisponible"
                    : `${conflict.unavailableCount} indisponible${conflict.unavailableCount > 1 ? "s" : ""}`}
                </span>
              {:else}
                <div class="text-xs opacity-70">
                  Disponible : <span class="font-semibold">{effectiveMax}</span>
                </div>
              {/if}
            </div>

            <div class="flex items-center gap-1">
              <button
                class="btn btn-circle btn-ghost text-error btn-xs"
                onclick={() => handleRemoveMateriel(materiel.materielId)}
                disabled={loading || materiel.quantity === 0}
                aria-label="Retirer"
              >
                <X class="size-3" />
              </button>
              <button
                class="btn btn-circle btn-ghost btn-xs hidden sm:flex"
                onclick={() =>
                  handleQuantityChange(
                    materiel.materielId,
                    materiel.quantity - getStep(materiel.maxQuantity),
                  )}
                disabled={loading || materiel.quantity <= 0}
                aria-label="Diminuer"
              >
                <Minus class="size-3" />
              </button>
              <input
                type="number"
                class="input input-sm w-16 [appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                min={0}
                max={effectiveMax}
                step={getStep(effectiveMax)}
                value={materiel.quantity}
                onchange={(e) => {
                  const target = e.target as HTMLInputElement;
                  handleQuantityChange(
                    materiel.materielId,
                    parseInt(target.value) || 0,
                  );
                }}
                disabled={loading}
              />
              <button
                class="btn btn-circle btn-ghost btn-xs hidden sm:flex"
                onclick={() =>
                  handleQuantityChange(
                    materiel.materielId,
                    materiel.quantity + getStep(effectiveMax),
                  )}
                disabled={loading || materiel.quantity >= effectiveMax}
                aria-label="Augmenter"
              >
                <Plus class="size-3" />
              </button>

              <button
                class="btn btn-ghost btn-xs"
                onclick={() =>
                  handleQuantityChange(materiel.materielId, effectiveMax)}
                disabled={loading || materiel.quantity >= effectiveMax}
              >
                tout
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-8 text-center opacity-50">
      <Package class="mx-auto mb-2 h-12" />
      <p class="text-sm">Aucun matériel sélectionné</p>
      <p class="text-xs">
        Utilisez la recherche ou l'ajout rapide pour ajouter du matériel
      </p>
    </div>
  {/if}
</div>

{#if showQuickSelection}
  <QuickMaterielSelectionModal
    isOpen={showQuickSelection}
    onClose={() => (showQuickSelection = false)}
    onAdd={handleQuickSelectionAdd}
    selectedIds={new Set(selectedMateriels.map((m) => m.materielId))}
    materiels={allMateriels}
  />
{/if}

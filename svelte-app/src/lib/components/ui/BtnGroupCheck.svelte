<script lang="ts">
  import { X, RotateCcw, Check, PlusIcon } from "@lucide/svelte";
  import CheckboxBadge from "$lib/components/ui/CheckboxBadge.svelte";

  // Interface générique pour les items
  interface BadgeItem {
    id: string;
    label: string;
    title?: string; // Tooltip optionnel
    selected?: boolean; // État initial de sélection (true/undefined = actif, false = inactif)
    badge?: string; // Badge optionnel pour afficher une information supplémentaire
    disabled?: boolean; // Si true, l'item est désactivé et non cliquable
  }

  interface Props {
    items: BadgeItem[];
    size?: "xs" | "sm" | "lg" | "md";
    color?:
      | "primary"
      | "secondary"
      | "accent"
      | "success"
      | "warning"
      | "error"
      | "info";
    badgeStyle?: string;
    onToggleItem?: (itemId: string) => void;
    showStats?: boolean;
  }

  let {
    items,
    size = "lg",
    color = "primary",
    onToggleItem = () => {},
    showStats = false,
  }: Props = $props();

  // État local pour gérer les items actifs/inactifs
  let itemStates = $state<Record<string, boolean>>({});

  // Initialiser l'état en fonction des items
  $effect(() => {
    const newStates: Record<string, boolean> = {};
    items.forEach((item) => {
      // Utiliser la valeur de selected pour déterminer l'état (false par défaut)
      newStates[item.id] = item.selected ?? true;
    });

    // Toujours synchroniser avec les props items.selected
    itemStates = newStates;
  });

  function handleToggleItem(itemId: string) {
    itemStates[itemId] = !itemStates[itemId];
    onToggleItem(itemId);
  }

  // Computed properties
  const activeCount = $derived(
    Object.values(itemStates).filter(Boolean).length,
  );
  const inactiveCount = $derived(
    Object.values(itemStates).filter((v) => !v).length,
  );
</script>

<div class="flex flex-wrap gap-2">
  {#each items as item (item.id)}
    {@const isActive = itemStates[item.id]}
    {@const isDisabled = item.disabled}
    <CheckboxBadge
      checked={isActive}
      label={item.label}
      {color}
      badge={item.badge}
      {size}
      disabled={isDisabled}
      onchange={() => !isDisabled && handleToggleItem(item.id)}
      title={item.title}
    />
  {/each}
</div>

<!-- Statistiques (optionnelles) -->
{#if showStats}
  <div class="mt-4 flex items-center justify-between text-sm opacity-70">
    <div class="flex items-center gap-4">
      <span class="flex items-center gap-1">
        <Check class="text-success h-3 w-3" />
        {activeCount} actifs
      </span>
      {#if inactiveCount > 0}
        <span class="flex items-center gap-1">
          <X class="text-error h-3 w-3" />
          {inactiveCount} retirés
        </span>
      {/if}
    </div>
    <span>Total: {items.length} items</span>
  </div>
{/if}

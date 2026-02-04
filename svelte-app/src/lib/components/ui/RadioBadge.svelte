<script lang="ts">
  import { Check } from "@lucide/svelte";

  interface Props {
    value: string;
    selectedValue: string;
    label: string;
    color?:
      | "primary"
      | "secondary"
      | "accent"
      | "success"
      | "warning"
      | "error"
      | "info"
      | "neutral";
    size?: "xs" | "sm" | "lg" | "md";
    disabled?: boolean;
  }

  let {
    value,
    selectedValue = $bindable(),
    label,
    color = "primary",
    size = "sm",
    disabled = false,
  }: Props = $props();

  // Fonction utilitaire pour générer les classes de taille
  function getSizeClass(size: string): string {
    const sizeMap: Record<string, string> = {
      xs: "btn-xs",
      sm: "btn-sm",
      md: "btn-md",
      lg: "btn-lg",
    };
    return sizeMap[size] || "btn-sm";
  }

  // Classes calculées
  const isSelected = $derived(value === selectedValue);
  const sizeClass = $derived(getSizeClass(size));

  function handleClick() {
    if (!disabled) {
      selectedValue = value;
    }
  }
</script>

<button
  class="btn {sizeClass} flex items-center gap-2 transition-all {`btn-${color}`} duration-200 {isSelected
    ? ''
    : 'btn-dash'}"
  class:opacity-50={disabled}
  class:cursor-not-allowed={disabled}
  onclick={handleClick}
  {disabled}
  type="button"
>
  <span>{label}</span>
  {#if isSelected}
    <Check class="h-3 w-3" />
  {/if}
</button>

<script lang="ts">
  interface Props {
    checked: boolean;
    label: string;
    color?:
      | "primary"
      | "secondary"
      | "accent"
      | "success"
      | "warning"
      | "error"
      | "info";
    rounded?: string;
    padding?: string;
    disabled?: boolean;
    badge?: string | null;
    size?: "xs" | "sm" | "lg" | "md";
    title?: string; // Tooltip optionnel
    onchange: () => void;
  }

  let {
    checked,
    label,
    color = "secondary",
    rounded = "rounded-lg",
    padding = "ps-2 py-1 pe-3",
    disabled = false,
    badge = null,
    size = "sm",
    title,
    onchange,
  }: Props = $props();

  // Fonction utilitaire pour générer les classes de couleur
  // → Nous devons mentionner toutes les classes explicitement pour éviter qu'elles soient tree-checké par tailwinds.
  function getColorClasses(color: string, checked: boolean): string {
    const colorMap: Record<string, { unchecked: string; checked: string }> = {
      primary: {
        unchecked: "bg-primary/10 hover:bg-primary/5",
        checked: "bg-primary/30 hover:bg-primary/20",
      },
      secondary: {
        unchecked: "bg-secondary/10 hover:bg-secondary/5",
        checked: "bg-secondary/30 hover:bg-secondary/20",
      },
      accent: {
        unchecked: "bg-accent/10 hover:bg-accent/5",
        checked: "bg-accent/30 hover:bg-accent/20",
      },
      success: {
        unchecked: "bg-success/10 hover:bg-success/5",
        checked: "bg-success/30 hover:bg-success/20",
      },
      warning: {
        unchecked: "bg-warning/10 hover:bg-warning/5",
        checked: "bg-warning/30 hover:bg-warning/20",
      },
      error: {
        unchecked: "bg-error/10 hover:bg-error/5",
        checked: "bg-error/30 hover:bg-error/20",
      },
      info: {
        unchecked: "bg-info/10 hover:bg-info/5",
        checked: "bg-info/30 hover:bg-info/20",
      },
    };

    const colorClasses = colorMap[color] || colorMap.secondary;
    return checked ? colorClasses.checked : colorClasses.unchecked;
  }

  // Fonction utilitaire pour générer les classes du badge
  function getBadgeColorClass(color: string): string {
    const badgeColorMap: Record<string, string> = {
      primary: "badge-primary",
      secondary: "badge-secondary",
      accent: "badge-accent",
      success: "badge-success",
      warning: "badge-warning",
      error: "badge-error",
      info: "badge-info",
    };
    return badgeColorMap[color] || "badge-secondary";
  }

  // Fonction utilitaire pour générer les classes de taille
  function getSizeClass(size: string): string {
    const sizeMap: Record<string, string> = {
      xs: "checkbox-xs",
      sm: "checkbox-sm",
      md: "checkbox-md",
      lg: "checkbox-lg",
    };
    return sizeMap[size] || "checkbox-sm";
  }

  // Classes calculées
  const bgClass = $derived(getColorClasses(color, checked));
  const badgeColorClass = $derived(getBadgeColorClass(color));
  const sizeClass = $derived(getSizeClass(size));
</script>

<label
  class="text-base-content/80 label {bgClass} cursor-pointer justify-start {rounded} {padding} font-family-sora"
  class:opacity-50={disabled}
  {title}
>
  <input
    type="checkbox"
    class="checkbox {sizeClass} bg-base-100"
    {checked}
    {onchange}
    {disabled}
  />
  <span class="label-text flex-1">{label}</span>
  {#if badge}
    <span class="badge badge-sm {badgeColorClass}">{badge}</span>
  {/if}
</label>

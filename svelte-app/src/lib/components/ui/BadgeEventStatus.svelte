<script lang="ts">
  import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    CalendarX,
  } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";

  type Status = "confirmed" | "proposition" | string;

  interface Props {
    status: Status;
    size?: string;
    class?: string;
  }

  let { status, size = "badge-lg", class: className = "" }: Props = $props();

  const badgeConfig = $derived.by(() => {
    if (status === "confirmed") {
      return {
        colorClass: "badge-success",
        label: "Confirmé",
        icon: CheckCircle2,
      };
    }
    if (status === "proposition") {
      return {
        colorClass: "badge-info",
        label: "Proposition",
        icon: Clock,
      };
    }
    if (status === "canceled") {
      return {
        colorClass: "badge-error",
        label: "Annulé",
        icon: CalendarX,
      };
    }
    // Fallback pour les statuts inconnus
    return {
      colorClass: "badge-warning",
      label: status,
      icon: AlertTriangle,
    };
  });
</script>

<div class="badge {size} {badgeConfig.colorClass} gap-1 {className}">
  {#if badgeConfig.icon === CheckCircle2}
    <CheckCircle2 class="h-3 w-3" />
  {:else if badgeConfig.icon === Clock}
    <Clock class="h-3 w-3" />
  {:else}
    <AlertTriangle class="h-3 w-3" />
  {/if}
  {badgeConfig.label}
</div>

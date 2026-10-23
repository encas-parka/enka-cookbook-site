<script lang="ts">
  /**
   * Groupe de matériel par type : en-tête compact (pastille colorée,
   * libellé, compteur, actions à droite) au-dessus d'un contenu libre
   * (rangées de sélection, rangées de lecture, cards d'inventaire).
   *
   * En desktop l'en-tête est une structure de lecture non interactive.
   * Avec `collapsible`, il devient un accordéon en mobile — un seul
   * groupe ouvert à la fois : l'état `openType` est possédé par le
   * parent et partagé entre les groupes ; `forcedOpen` l'emporte
   * (recherche active, filtres appliqués).
   *
   * Libellé : source unique `getMaterielTypeConfig().label`, avec
   * override tant que le flux emprunt conserve son vocabulaire
   * (backlog `labels-types-materiel`).
   */
  import { ChevronDown } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import {
    getMaterielTypeBgClass,
    getMaterielTypeColorClass,
    getMaterielTypeConfig,
    getMaterielTypeIcon,
  } from "$lib/utils/materiel.utils";

  interface Props {
    /** Clé du type (icône, couleurs, libellé). */
    type: string;
    /** Compteur affiché à côté du libellé ; undefined = pas de badge. */
    count?: number;
    /** Classe du badge de compteur (ex. "badge-primary" côté sélection). */
    countBadgeClass?: string;
    /** Accordéon mobile ; l'état d'ouverture vit dans le parent. */
    collapsible?: boolean;
    /** Force l'ouverture en mobile, quel que soit `openType`. */
    forcedOpen?: boolean;
    /** Type du groupe actuellement déplié (accordéon). */
    openType?: string | null;
    /** Contenu additionnel de l'en-tête (badges d'état, boutons). */
    headerRight?: Snippet;
    /** Override du libellé (vocabulaire du flux emprunt). */
    label?: string;
    children: Snippet;
  }

  let {
    type,
    count,
    countBadgeClass = "badge-ghost",
    collapsible = false,
    forcedOpen = false,
    openType = $bindable(null),
    headerRight,
    label,
    children,
  }: Props = $props();

  const interactive = $derived(collapsible && !globalState.isDesktop);
  const open = $derived(!interactive || forcedOpen || openType === type);
  const Icon = $derived(getMaterielTypeIcon(type));

  /** Accordéon : déplier ce groupe replie l'éventuel autre. */
  function toggle() {
    openType = openType === type ? null : type;
  }
</script>

{#snippet headerInner()}
  <span class="{getMaterielTypeBgClass(type)} rounded-lg p-1.5">
    <Icon class="{getMaterielTypeColorClass(type)} size-4" />
  </span>
  {label ?? getMaterielTypeConfig(type).label}
  {#if count !== undefined}
    <span class="badge badge-sm tabular-nums {countBadgeClass}">{count}</span>
  {/if}
  {@render headerRight?.()}
  {#if interactive}
    <ChevronDown
      class="ml-auto size-4 opacity-50 transition-transform {open
        ? ''
        : '-rotate-90'}"
    />
  {/if}
{/snippet}

<div class="rounded-lg border border-base-300 bg-base-200">
  {#if interactive}
    <button
      class="flex w-full items-center gap-2 p-3 text-left text-base font-semibold"
      onclick={toggle}
      aria-expanded={open}
    >
      {@render headerInner()}
    </button>
  {:else}
    <div
      class="flex w-full items-center gap-2 p-3 text-left text-base font-semibold"
    >
      {@render headerInner()}
    </div>
  {/if}
  {#if open}
    <div class="space-y-2 px-3 pb-3">
      {@render children()}
    </div>
  {/if}
</div>

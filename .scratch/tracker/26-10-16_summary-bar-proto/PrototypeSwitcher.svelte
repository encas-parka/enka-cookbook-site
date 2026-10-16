<!--
  PROTOTYPE jetable (skill /prototype — UI) — barre flottante de commutation.
  Flèches ← / → (clic ou clavier) pour cycler : Original → A → B → C → Original.
  « Original » supprime le paramètre ?variant. Auto-actualisée via searchParams
  (réactif), donc partageable et stable au rechargement. Rendu UNIQUEMENT en dev
  (import.meta.env.DEV) — jamais en production.
-->
<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { searchParams } from "$lib/router";

  const isDev = import.meta.env.DEV;

  const DEFAULT_VARIANT = { key: "", name: "Original (prod)" };
  const variants = [
    DEFAULT_VARIANT,
    { key: "a", name: "Chips inline" },
    { key: "b", name: "Carte unifiée" },
    { key: "c", name: "Boutons stats" },
  ];

  const current = $derived.by(() => {
    const key = searchParams.get("variant") ?? "";
    return variants.find((v) => v.key === key) ?? DEFAULT_VARIANT;
  });

  function cycle(direction: 1 | -1) {
    const key = searchParams.get("variant") ?? "";
    const index = variants.findIndex((v) => v.key === key);
    const next =
      variants[
        (Math.max(index, 0) + direction + variants.length) % variants.length
      ];
    if (next.key === "") {
      searchParams.delete("variant");
    } else {
      searchParams.set("variant", next.key);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isDev) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    ) {
      return;
    }
    if (event.key === "ArrowLeft") cycle(-1);
    else if (event.key === "ArrowRight") cycle(1);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isDev}
  <div class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 print:hidden">
    <div
      class="bg-neutral text-neutral-content flex items-center gap-1 rounded-full px-2 py-1 shadow-lg"
    >
      <button
        class="btn btn-ghost btn-xs btn-circle"
        onclick={() => cycle(-1)}
        aria-label="Variante précédente"
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="min-w-44 text-center text-xs whitespace-nowrap">
        {current.key ? current.key.toUpperCase() : "–"} · {current.name}
      </span>
      <button
        class="btn btn-ghost btn-xs btn-circle"
        onclick={() => cycle(1)}
        aria-label="Variante suivante"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
{/if}

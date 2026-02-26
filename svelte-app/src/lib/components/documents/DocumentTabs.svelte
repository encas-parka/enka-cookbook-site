<script lang="ts">
  import { Edit3, Eye } from "@lucide/svelte";
  import { searchParams } from "$lib/router";

  // Lire le mode depuis les query params
  const mode = $derived(
    (searchParams.get("mode") as "edit" | "preview" | null) || "preview",
  );

  function handleModeChange(newMode: "edit" | "preview") {
    // Mettre à jour le query param
    searchParams.set("mode", newMode);
  }
</script>

<div class="rounded-box bg-secondary/10 px-4 py-1">
  <div class="tabs tabs-border justify-center">
    <button
      class="tab gap-2 font-semibold"
      class:tab-active={mode === "edit"}
      onclick={() => handleModeChange("edit")}
    >
      <Edit3 class="h-4 w-4" />
      Édition
    </button>
    <button
      class="tab gap-2 font-semibold"
      class:tab-active={mode === "preview"}
      onclick={() => handleModeChange("preview")}
    >
      <Eye class="h-4 w-4" />
      Aperçu
    </button>
  </div>
</div>

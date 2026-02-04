<script lang="ts">
  import { ArrowUp } from "@lucide/svelte";
  import { scrollY } from "svelte/reactivity/window";
  import { fade } from "svelte/transition";

  let showButton = $derived((scrollY.current || 0) > 300);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

{#if showButton}
  <button
    onclick={scrollToTop}
    class="btn btn-primary btn-circle fixed right-[2%] bottom-10 z-50 rounded-full shadow-lg"
    aria-label="Retour en haut de page"
    transition:fade
  >
    <ArrowUp class="h-6 w-6" />
  </button>
{/if}

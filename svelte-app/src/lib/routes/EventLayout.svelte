<script lang="ts">
  import type { Snippet } from "svelte";
  import EventInvitationBanner from "$lib/components/EventInvitationBanner.svelte";

  /**
   * Layout de la branche /event/:id — rend une fois le bandeau d'invitation
   * au-dessus de chaque sous-page (racine incluse).
   */

  let { children }: { children: Snippet } = $props();
</script>

<EventInvitationBanner />
{@render children()}

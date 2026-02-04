<script lang="ts">
  import {X} from '@lucide/svelte'
  import {globalState} from '../stores/GlobalState.svelte';

 const conflicts = $derived(globalState.modalOverride.conflicts)

 function onClose() {
   globalState.modalOverride.isOpen = false;
 }

 function keepOverride(conflict) {
   globalState.modalOverride.conflicts = globalState.modalOverride.conflicts.filter(c => c !== conflict);
 }
</script>

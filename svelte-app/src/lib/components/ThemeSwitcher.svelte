<script>
  import {Sun, Moon} from "@lucide/svelte"
</script>

<label class="swap swap-rotate">
  <!-- this hidden checkbox controls the state -->
  <input type="checkbox" class="theme-controller" value="another" />

  <Sun class="swap-on fill-current"  />

  <Moon class="swap-off fill-current" />
</label>

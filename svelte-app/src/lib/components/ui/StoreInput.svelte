<script lang="ts">
  import { Store } from "@lucide/svelte";
  import Suggestions from "./Suggestions.svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { globalState } from "@/lib/stores/GlobalState.svelte";

  interface Props {
    value: string | null;
    suggestions?: string[];
    disabled?: boolean;
    [key: string]: any;
    flexCol?: boolean;
  }

  let {
    value = $bindable(),
    suggestions = [],
    disabled = false,
    flexCol = false,
    ...restProps
  }: Props = $props();

  const suggestionItems = $derived(
    suggestions.map((s) => ({ id: s, label: s, disabled: s === value })),
  );
</script>

<div class="flex w-full min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
  <label class="input w-full min-w-0 sm:w-72">
    <Store class="opacity-50" />
    <input
      type="text"
      bind:value
      placeholder="Magasin"
      maxlength="50"
      {disabled}
      {...restProps}
    />
  </label>
  {#if suggestions.length > 0}
    <Suggestions
      suggestions={suggestionItems}
      onSuggestionClick={(s) => (value = s.label)}
      buttonSize="btn-xs"
    />
  {/if}
</div>

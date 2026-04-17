<script lang="ts">
  import { User } from "@lucide/svelte";
  import Suggestions from "./Suggestions.svelte";

  interface Props {
    value: string | null;
    suggestions?: string[];
    disabled?: boolean;
    onkeydown?: (e: KeyboardEvent) => void;
    flexCol?: boolean;
  }

  let {
    value = $bindable(),
    suggestions = [],
    disabled = false,
    onkeydown,
    flexCol = false,
  }: Props = $props();

  const suggestionItems = $derived(
    suggestions.map((s) => ({ id: s, label: s, disabled: s === value })),
  );
</script>

<div class="flex w-full min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
  <label class="input w-full min-w-0 sm:w-72">
    <User class="opacity-50" />
    <input
      type="text"
      bind:value
      placeholder="Qui"
      maxlength="25"
      {disabled}
      {onkeydown}
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

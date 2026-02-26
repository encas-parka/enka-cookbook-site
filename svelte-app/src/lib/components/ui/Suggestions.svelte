<script lang="ts">
  import { PencilLine } from "@lucide/svelte";
  import type { ComponentType } from "svelte";

  interface SuggestionItem {
    id: string;
    label: string;
    icon?: ComponentType;
    disabled?: boolean;
  }

  interface Props {
    suggestions: SuggestionItem[];
    onSuggestionClick: (suggestion: SuggestionItem) => void;
    maxSuggestions?: number;
    title?: string;
    buttonSize?: "btn-xs" | "btn-sm" | "btn-md" | "btn-lg";
    buttonVariant?: "btn-soft" | "btn-outline" | "btn-ghost";
    disabled?: boolean;
  }

  let {
    suggestions,
    onSuggestionClick,
    maxSuggestions = 8,
    title,
    buttonSize = "btn-xs",
    buttonVariant = "btn-soft",
    disabled = false,
  }: Props = $props();

  // Limiter le nombre de suggestions
  const displaySuggestions = $derived(suggestions.slice(0, maxSuggestions));

  function handleSuggestionClick(suggestion: SuggestionItem) {
    if (!disabled && !suggestion.disabled) {
      onSuggestionClick(suggestion);
    }
  }
</script>

{#if displaySuggestions.length > 0}
  <div>
    {#if title}
      <div class="mb-1 text-xs opacity-70">{title}</div>
    {/if}
    <div class="ms-1 flex flex-wrap items-center gap-1">
      <PencilLine class="text-base-content/70 mr-1" size={14} />
      {#each displaySuggestions as suggestion (suggestion.id)}
        <button
          type="button"
          class="btn btn-primary {buttonSize} {buttonVariant} "
          onclick={() => handleSuggestionClick(suggestion)}
          disabled={disabled || suggestion.disabled}
          title={suggestion.disabled ? "Déjà sélectionné" : suggestion.label}
        >
          {#if suggestion.icon}
            <suggestion.icon class="h-3 w-3" />
          {/if}
          {suggestion.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

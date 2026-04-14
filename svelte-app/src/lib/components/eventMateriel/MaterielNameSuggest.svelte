<script lang="ts">
  import { eventMaterielStore } from "$lib/stores/EventMaterielStore.svelte";
  import { MATERIEL_CATALOG } from "$lib/constants/materiel-catalog";
  import type { EventMaterielType } from "$lib/types/event-materiel.types";
  import { Search } from "@lucide/svelte";

  interface Suggestion {
    name: string;
    type: EventMaterielType;
    source: "header" | "catalog";
    quantity?: number;
    alreadyExists?: boolean;
  }

  interface Props {
    value: string;
    onSelect: (suggestion: Suggestion) => void;
    onInput: (value: string) => void;
    placeholder?: string;
    class?: string;
  }

  let {
    value,
    onSelect,
    onInput,
    placeholder = "Nom * (ex: Table pliante)",
    class: className = "",
  }: Props = $props();

  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);

  const MIN_CHARS = 2;

  const suggestions = $derived.by(() => {
    const q = value.toLowerCase().trim();
    if (q.length < MIN_CHARS) return [];

    const results: Suggestion[] = [];
    const seenNames = new Set<string>();

    const headerNames = new Map<string, { type: EventMaterielType; quantity: number }>();
    for (const header of eventMaterielStore.headers) {
      const n = (header.name || "").toLowerCase().trim();
      if (n && n.includes(q)) {
        headerNames.set(n, {
          type: header.type as EventMaterielType,
          quantity: header.quantity || 0,
        });
      }
    }

    for (const [name, info] of headerNames) {
      const originalName = eventMaterielStore.headers.find(
        (h) => (h.name || "").toLowerCase().trim() === name,
      )?.name || name;
      results.push({
        name: originalName,
        type: info.type,
        source: "header",
        quantity: info.quantity,
        alreadyExists: true,
      });
      seenNames.add(name);
    }

    for (const item of MATERIEL_CATALOG) {
      const n = item.name.toLowerCase().trim();
      if (n.includes(q) && !seenNames.has(n)) {
        results.push({
          name: item.name,
          type: item.type as EventMaterielType,
          source: "catalog",
        });
        seenNames.add(n);
      }
    }

    const exact = q;
    results.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(exact) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(exact) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (a.source === "header" && b.source !== "header") return -1;
      if (a.source !== "header" && b.source === "header") return 1;
      return a.name.localeCompare(b.name, "fr");
    });

    return results.slice(0, 10);
  });

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    onInput(target.value);
    showDropdown = true;
    highlightedIndex = -1;
  }

  function handleFocus() {
    if (value.trim().length >= MIN_CHARS) {
      showDropdown = true;
    }
  }

  function handleBlur() {
    setTimeout(() => {
      showDropdown = false;
      highlightedIndex = -1;
    }, 150);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, suggestions.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      showDropdown = false;
    }
  }

  function selectSuggestion(s: Suggestion) {
    onSelect(s);
    showDropdown = false;
    highlightedIndex = -1;
  }

  const sourceLabel = $derived.by(() => {
    return (source: "header" | "catalog") => {
      return source === "header" ? "Existant" : "Catalogue";
    };
  });
</script>

<div class="relative {className}">
  <label class="input sm:col-span-2">
    <Search class="h-4 w-4 opacity-50" />
    <input
      type="text"
      {value}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      {placeholder}
      required
      autocomplete="off"
    />
  </label>

  {#if showDropdown && suggestions.length > 0}
    <ul
      class="bg-base-100 border-base-200 absolute z-50 mt-1 w-full rounded-box border shadow-lg"
      role="listbox"
    >
      {#each suggestions as suggestion, i (suggestion.name + suggestion.source)}
        <li>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm {i === highlightedIndex
              ? 'bg-primary/10'
              : 'hover:bg-base-200'}"
            role="option"
            aria-selected={i === highlightedIndex}
            onclick={() => selectSuggestion(suggestion)}
            onmouseenter={() => (highlightedIndex = i)}
          >
            <span class="flex-1 truncate">{suggestion.name}</span>
            {#if suggestion.alreadyExists && suggestion.quantity}
              <span class="badge badge-ghost badge-xs">
                x{suggestion.quantity}
              </span>
            {/if}
            <span
              class="badge {suggestion.source === 'header'
                ? 'badge-secondary'
                : 'badge-outline'} badge-xs"
            >
              {sourceLabel(suggestion.source)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

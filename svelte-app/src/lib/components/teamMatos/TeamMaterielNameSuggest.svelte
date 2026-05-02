<script lang="ts">
  import { MATERIEL_CATALOG, type CatalogType } from "$lib/constants/materiel-catalog";
  import { materielStore } from "$lib/stores/MaterielStore.svelte";
  import { Search, Package, Plus } from "@lucide/svelte";

  interface Suggestion {
    name: string;
    type: CatalogType;
    source: "existing" | "catalog";
    materielId?: string;
  }

  interface Props {
    value: string;
    onSelect: (suggestion: Suggestion) => void;
    onInput: (value: string) => void;
    placeholder?: string;
    teamId: string;
    class?: string;
  }

  let {
    value,
    onSelect,
    onInput,
    placeholder = "Ex: Mixeur professionnel",
    teamId,
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

    if (teamId) {
      for (const m of materielStore.getMaterielsByOwner(teamId)) {
        const n = m.name.toLowerCase().trim();
        if (n.includes(q) && !seenNames.has(n)) {
          results.push({
            name: m.name,
            type: m.type as CatalogType,
            source: "existing",
            materielId: m.id,
          });
          seenNames.add(n);
        }
      }
    }

    for (const item of MATERIEL_CATALOG) {
      const n = item.name.toLowerCase().trim();
      if (n.includes(q) && !seenNames.has(n)) {
        results.push({ name: item.name, type: item.type, source: "catalog" });
        seenNames.add(n);
      }
    }

    const exact = q;
    results.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(exact) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(exact) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      if (a.source === "existing" && b.source !== "existing") return -1;
      if (a.source !== "existing" && b.source === "existing") return 1;
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
</script>

<div class="relative {className}">
  <label class="input w-full">
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
      class="bg-base-100 border-base-200 rounded-box absolute z-50 mt-1 w-full border shadow-lg"
      role="listbox"
    >
      {#each suggestions as suggestion, i (suggestion.name + suggestion.source)}
        <li>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm {i === highlightedIndex ? 'bg-primary/10' : 'hover:bg-base-200'}"
            role="option"
            aria-selected={i === highlightedIndex}
            onclick={() => selectSuggestion(suggestion)}
            onmouseenter={() => (highlightedIndex = i)}
          >
            {#if suggestion.source === "existing"}
              <Package class="h-3 w-3 opacity-50" />
            {:else}
              <Plus class="h-3 w-3 opacity-40" />
            {/if}
            <span class="flex-1 truncate">{suggestion.name}</span>
            {#if suggestion.source === "existing"}
              <span class="badge badge-secondary badge-xs">Inventaire</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<script lang="ts">
  import { Search, X, ChevronDown, Check, Plus } from "@lucide/svelte";

  // ============================================================================
  // PROPS
  // ============================================================================
  interface Props {
    options: string[];
    selected: string[];
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    helpText?: string;
    closeOnSelect?: boolean;
    onChange?: (selected: string[]) => void;
    onCreateNew?: () => void;
    createLabel?: string;
  }

  let {
    options = [],
    selected = $bindable([]),
    placeholder = "Sélectionnez des options...",
    disabled = false,
    label,
    helpText,
    closeOnSelect = false,
    onChange,
    onCreateNew,
    createLabel = "Créer...",
  }: Props = $props();

  // ============================================================================
  // ÉTAT LOCAL
  // ============================================================================
  let searchQuery = $state("");
  let isOpen = $state(false);
  let highlightedIndex = $state(0);
  let containerRef: any = $state();
  let inputRef: HTMLInputElement | undefined = $state();

  let filteredOptions = $derived(
    searchQuery.length > 0
      ? options.filter((option) =>
          option.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : options,
  );

  // Réinitialiser l'index surligné quand les options changent
  $effect(() => {
    if (
      filteredOptions.length > 0 &&
      highlightedIndex >= filteredOptions.length
    ) {
      highlightedIndex = 0;
    }
  });

  // ============================================================================
  // FONCTIONS
  // ============================================================================
  function isSelected(option: string): boolean {
    return selected.includes(option);
  }

  function toggleOption(option: string) {
    if (isSelected(option)) {
      removeOption(option);
    } else {
      addOption(option);
    }
  }

  function addOption(option: string) {
    if (!selected.includes(option)) {
      selected = [...selected, option];
      onChange?.(selected);
    }
    searchQuery = "";
    highlightedIndex = 0;

    if (closeOnSelect) {
      closeDropdown();
    } else {
      inputRef?.focus();
    }
  }

  function removeOption(optionToRemove: string) {
    selected = selected.filter((option) => option !== optionToRemove);
    onChange?.(selected);
  }

  function removeLastOption() {
    if (selected.length > 0 && searchQuery === "") {
      const lastOption = selected[selected.length - 1];
      removeOption(lastOption);
    }
  }

  function openDropdown() {
    if (!disabled) {
      isOpen = true;
      highlightedIndex = 0;
    }
  }

  function closeDropdown() {
    isOpen = false;
    searchQuery = "";
    highlightedIndex = 0;
  }

  function toggleDropdown() {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
        } else if (highlightedIndex < filteredOptions.length - 1) {
          highlightedIndex++;
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (isOpen && highlightedIndex > 0) {
          highlightedIndex--;
        }
        break;

      case "Enter":
        event.preventDefault();
        if (isOpen && filteredOptions.length > 0) {
          toggleOption(filteredOptions[highlightedIndex]);
        } else if (!isOpen) {
          openDropdown();
        }
        break;

      case "Escape":
        event.preventDefault();
        closeDropdown();
        inputRef?.blur();
        break;

      case "Backspace":
        if (searchQuery === "" && selected.length > 0) {
          event.preventDefault();
          removeLastOption();
        }
        break;

      case "Tab":
        if (isOpen) {
          closeDropdown();
        }
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (containerRef && !containerRef.contains(event.target as Node)) {
      closeDropdown();
    }
  }

  // Gestion du click outside
  $effect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  });
</script>

<fieldset class="fieldset w-full" bind:this={containerRef}>
  {#if label}
    <legend class="fieldset-legend">{label}</legend>
  {/if}

  <div class="relative">
    <!-- Input container -->
    <div
      id="multi-select"
      class="input flex w-full items-center gap-2 pr-10 {disabled
        ? 'input-disabled'
        : ''}"
    >
      <!-- Search input -->
      <input
        bind:this={inputRef}
        type="text"
        bind:value={searchQuery}
        {placeholder}
        {disabled}
        class="w-full bg-transparent outline-none"
        onfocus={openDropdown}
        onkeydown={handleKeydown}
        autocomplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="options-list"
        aria-activedescendant={isOpen
          ? `option-${highlightedIndex}`
          : undefined}
      />
    </div>

    <!-- Dropdown toggle button -->
    <button
      type="button"
      class="btn btn-ghost btn-sm absolute top-1/2 right-1 -translate-y-1/2"
      onclick={toggleDropdown}
      {disabled}
      aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
    >
      <ChevronDown
        class="h-4 w-4 transition-transform {isOpen ? 'rotate-180' : ''}"
      />
    </button>

    <!-- Dropdown options -->
    {#if isOpen}
      <div
        id="options-list"
        class="border-base-300 bg-base-100 absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border shadow-lg"
        role="listbox"
      >
        {#if filteredOptions.length > 0}
          {#each filteredOptions as option, index}
            {@const selected = isSelected(option)}
            <button
              type="button"
              id="option-{index}"
              class="hover:bg-base-200 flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:cursor-pointer {index ===
              highlightedIndex
                ? 'bg-base-200'
                : ''} {selected ? 'bg-success/20' : ''}"
              onclick={() => toggleOption(option)}
              onmouseenter={() => (highlightedIndex = index)}
              role="option"
              aria-selected={selected}
            >
              <span>{option}</span>
              {#if selected}
                <Check class="text-success h-4 w-4" />
              {/if}
            </button>
          {/each}
        {:else}
          <div class="text-base-content/50 px-4 py-2 text-sm">
            Aucune option disponible
          </div>
        {/if}

        <!-- Option de création quand aucune correspondance -->
        {#if onCreateNew}
          <div class="border-base-300 mt-1 border-t pt-1">
            <button
              type="button"
              class="hover:bg-primary/20 text-primary flex w-full items-center gap-3 px-4 py-3 text-left hover:cursor-pointer"
              onclick={() => {
                onCreateNew();
                closeDropdown();
              }}
            >
              <Plus class="h-4 w-4" />
              <span class="text-sm font-medium">{createLabel}</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Selected items badges (outside input) -->
  {#if selected.length > 0}
    <div class="mt-2 flex flex-wrap gap-2">
      {#each selected as selectedItem}
        <div class="badge badge-lg badge-primary gap-2">
          <span>{selectedItem}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm hover:bg-primary-focus h-4 min-h-0 w-4 p-0"
            onclick={() => removeOption(selectedItem)}
            {disabled}
            aria-label="Supprimer {selectedItem}"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if helpText}
    <div class="fieldset-label">
      <span class="fieldset-label-text-alt opacity-70">{helpText}</span>
    </div>
  {/if}
</fieldset>

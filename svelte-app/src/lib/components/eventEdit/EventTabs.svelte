<script lang="ts">
  import { route } from "$lib/router";
  import {
    Pencil,
    CookingPot,
    ClipboardList,
    FileText,
    Image,
    Ellipsis,
    ListTodo,
  } from "@lucide/svelte";

  let {
    eventId,
    basePath = "/event",
  }: {
    eventId: string;
    basePath?: string;
  } = $props();

  let showDropdown = $state(false);

  // Onglets principaux
  const mainTabs = [
    { label: "Éditer", relativePath: "", icon: Pencil },
    { label: "Recettes", relativePath: "recipes", icon: CookingPot },
    { label: "Produits", relativePath: "products", icon: ClipboardList },
    { label: "Tâches", relativePath: "todos", icon: ListTodo },
  ];

  // Éléments du menu "..."
  const menuItems = [
    { label: "Affiches", relativePath: "posters", icon: Image },
    { label: "Documents", relativePath: "documents", icon: FileText },
  ];

  const activeTab = $derived.by(() => {
    const currentPath = route.pathname;

    if (currentPath.includes("/recipes")) return "main";
    if (currentPath.includes("/products")) return "main";
    if (currentPath.includes("/posters")) return "menu";
    if (currentPath.includes("/documents") || currentPath.includes("/document"))
      return "menu";
    return "main";
  });

  const activeMainIndex = $derived.by(() => {
    const currentPath = route.pathname;
    if (currentPath.includes("/recipes")) return 1;
    if (currentPath.includes("/products")) return 2;
    if (currentPath.includes("/todos")) return 3;
    return 0;
  });

  const isMenuActive = $derived(activeTab === "menu");

  function getMainPath(index: number) {
    if (!eventId) return "#";
    const relativePath = mainTabs[index].relativePath;
    return relativePath
      ? `${basePath}/${eventId}/${relativePath}`
      : `${basePath}/${eventId}`;
  }

  function getMenuPath(item: (typeof menuItems)[number]) {
    if (!eventId) return "#";
    return `${basePath}/${eventId}/${item.relativePath}`;
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".event-tabs-dropdown")) {
      closeDropdown();
    }
  }

  $effect(() => {
    if (showDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  });
</script>

<div class="rounded-box bg-accent/10 px-4 py-0">
  <div class="tabs justify-center py-1">
    {#each mainTabs as tab, index (index)}
      <a
        class="tab rounded-box {index === activeMainIndex
          ? 'text-base-content/80 bg-accent/30 font-bold'
          : 'text-accent font-medium'}"
        href={getMainPath(index)}
      >
        <tab.icon class="me-1 h-4 w-4" />
        {tab.label}
      </a>
    {/each}

    <!-- Dropdown "..." -->
    <div class="event-tabs-dropdown relative">
      <button
        class="tab border-accent/50 rounded-box ms-2 flex items-center gap-1 border {isMenuActive
          ? 'text-base-content/80 bg-accent/30 font-bold'
          : 'text-accent font-medium'}"
        onclick={toggleDropdown}
      >
        <Ellipsis class="h-4 w-4" />
      </button>
      {#if showDropdown}
        <ul
          class="menu dropdown-content bg-base-100 border-base-200 absolute right-0 z-50 mt-2 w-48 rounded-xl border p-2 shadow-xl"
        >
          {#each menuItems as item (item.relativePath)}
            <li>
              <a href={getMenuPath(item)} onclick={closeDropdown}>
                <item.icon class="h-4 w-4" />
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>

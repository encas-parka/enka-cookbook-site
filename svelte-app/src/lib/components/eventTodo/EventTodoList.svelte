<script lang="ts">
  import { Plus, Loader2 } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import EventTodoItem from "./EventTodoItem.svelte";
  import EventTodoModal from "./EventTodoModal.svelte";
  import type { EventContributor, EnrichedEvent } from "$lib/types/events";
  import type { EventTodo } from "$lib/types/events";

  interface Props {
    event: EnrichedEvent;
    contributors?: EventContributor[];
    onTodosChange?: (todos: EventTodo[]) => void;
    disabled?: boolean;
  }

  let {
    event,
    contributors = [],
    onTodosChange,
    disabled = false,
  }: Props = $props();

  // Derived todos from event - réactif aux mises à jour realtime
  const todos = $derived(event.todos ?? []);

  // Get unique taskOn types present in todos
  const uniqueTaskOnTypes = $derived.by(() => {
    const types = new SvelteSet<string>();
    todos.forEach((todo) => {
      if (todo.taskOn) types.add(todo.taskOn);
    });
    return Array.from(types);
  });

  // Number of columns based on unique types
  const numColumns = $derived(
    uniqueTaskOnTypes.length === 0 ? 1 : Math.min(uniqueTaskOnTypes.length, 3),
  );

  // Sort weight helper for enum ordering
  function getTaskOnWeight(value: string): number {
    const weights = { beforeEvent: 1, onEvent: 2, afterEvent: 3 };
    return weights[value] ?? 0;
  }

  // Label for taskOn type
  function getTaskOnLabel(value: string): string {
    const labels = {
      beforeEvent: "Avant l'événement",
      onEvent: "Pendant l'événement",
      afterEvent: "Après l'événement",
    };
    return labels[value] ?? value;
  }

  // Group todos by taskOn type
  const groupedTodos = $derived.by(() => {
    const groups: Record<string, EventTodo[]> = {};

    // Initialize groups for existing types
    uniqueTaskOnTypes.forEach((type) => {
      groups[type] = [];
    });

    // Sort and distribute todos
    const sortedTodos = [...todos].sort((a, b) => {
      const aTaskOnWeight = getTaskOnWeight(a.taskOn ?? "");
      const bTaskOnWeight = getTaskOnWeight(b.taskOn ?? "");
      const taskOnComparison = aTaskOnWeight - bTaskOnWeight;

      if (taskOnComparison !== 0) {
        return taskOnComparison;
      }

      const aDueDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDueDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDueDate - bDueDate;
    });

    sortedTodos.forEach((todo) => {
      const type = todo.taskOn ?? "unassigned";
      if (!groups[type]) groups[type] = [];
      groups[type].push(todo);
    });

    return groups;
  });

  // Modal State
  let showModal = $state(false);
  let todoToEdit = $state<EventTodo | null>(null);

  function handleAdd() {
    todoToEdit = null;
    showModal = true;
  }

  function handleEdit(todo: EventTodo) {
    todoToEdit = todo;
    showModal = true;
  }

  function handleTodoSaved(updatedTodos: EventTodo[]) {
    onTodosChange?.(updatedTodos);
  }
</script>

<!-- Header / Actions -->
<div class="mb-4 flex items-center justify-end">
  <button class="btn btn-sm btn-primary gap-2" onclick={handleAdd} {disabled}>
    <Plus class="size-4" /> Nouvelle tâche
  </button>
</div>

<!-- List - Grouped by taskOn type -->
{#if todos.length === 0}
  <div
    class="text-base-content/50 border-base-200 hover:border-primary/50 cursor-pointer rounded-lg border-2 border-dashed py-8 text-center text-sm italic transition-colors"
    onclick={handleAdd}
    onkeydown={(e) => e.key === "Enter" && handleAdd()}
    role="button"
    tabindex="0"
  >
    Aucune tâche pour le moment.
    <br />
    <span class="text-primary mt-1 inline-block font-medium"
      >Créer la première tâche +</span
    >
  </div>
{:else}
  <!-- Grid with columns based on unique taskOn types -->
  <div
    class="grid gap-4 {numColumns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : numColumns === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1'}"
  >
    {#each uniqueTaskOnTypes as taskOnType (taskOnType)}
      <div class="flex flex-col gap-3">
        <!-- Column Header -->
        <div
          class="text-base-content/70 border-base-200 border-b pb-2 text-sm font-medium"
        >
          {getTaskOnLabel(taskOnType)}
          <span class="text-base-content/40 ml-1 text-xs"
            >({groupedTodos[taskOnType]?.length ?? 0})</span
          >
        </div>

        <!-- Tasks in this column -->
        {#each groupedTodos[taskOnType] ?? [] as todo (todo.id)}
          <EventTodoItem
            {todo}
            eventId={event.id}
            onEdit={handleEdit}
            {disabled}
            {contributors}
          />
        {/each}
      </div>
    {/each}
  </div>
{/if}

<!-- Modal -->
<EventTodoModal
  open={showModal}
  eventId={event.id}
  {todoToEdit}
  {contributors}
  currentTodos={todos}
  onClose={() => (showModal = false)}
  onSave={handleTodoSaved}
/>

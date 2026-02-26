<script lang="ts">
  import { Plus, ListTodo, Loader2 } from "@lucide/svelte";
  import EventTodoItem from "./EventTodoItem.svelte";
  import EventTodoModal from "./EventTodoModal.svelte";
  import Fieldset from "../ui/Fieldset.svelte";
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

  // Sort weight helper for enum ordering
  function getTaskOnWeight(value: string): number {
    const weights = { beforeEvent: 1, onEvent: 2, afterEvent: 3 };
    return weights[value] ?? 0;
  }

  // Sorted todos derived: taskOn > dueDate
  const sortedTodos = $derived.by(() => {
    const todosCopy = [...todos];
    return todosCopy.sort((a, b) => {
      // First sort by taskOn
      const aTaskOnWeight = getTaskOnWeight(a.taskOn ?? "");
      const bTaskOnWeight = getTaskOnWeight(b.taskOn ?? "");
      const taskOnComparison = aTaskOnWeight - bTaskOnWeight;

      if (taskOnComparison !== 0) {
        return taskOnComparison;
      }

      // Then sort by dueDate (ascending - earliest first)
      const aDueDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDueDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDueDate - bDueDate;
    });
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

<Fieldset legend="Tâches & Organisation" legendSize="text-lg">
  <!-- Header / Actions -->
  <div class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-2 text-sm opacity-60">
      <ListTodo class="size-4" />
      <span>{todos.length} tâches</span>
    </div>
    <button class="btn btn-sm btn-primary gap-2" onclick={handleAdd}>
      <Plus class="size-4" /> Nouvelle tâche
    </button>
  </div>

  <!-- List -->
  <div class=" space-y-4">
    {#if sortedTodos.length === 0}
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
      {#each sortedTodos as todo (todo.id)}
        <EventTodoItem
          {todo}
          eventId={event.$id}
          onEdit={handleEdit}
          {disabled}
          {contributors}
        />
      {/each}
    {/if}
  </div>

  <!-- Modal -->
  <EventTodoModal
    open={showModal}
    eventId={event.$id}
    {todoToEdit}
    {contributors}
    currentTodos={todos}
    onClose={() => (showModal = false)}
    onSave={handleTodoSaved}
  />
</Fieldset>

<script lang="ts">
  import {
    Clock,
    ClockArrowUp,
    ClockArrowDown,
    Users,
    Minus,
    Calendar,
    PencilLine,
    Check,
  } from "@lucide/svelte";
  import type { EventTodo, EventContributor } from "$lib/types/events";
  import type { EventTodoStatus } from "$lib/types/events";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import CheckboxBadge from "../ui/CheckboxBadge.svelte";

  interface Props {
    todo: EventTodo;
    eventId: string;
    onEdit: (todo: EventTodo) => void;
    disabled?: boolean;
    contributors?: EventContributor[];
  }

  let {
    todo,
    eventId,
    onEdit,
    disabled = false,
    contributors = [],
  }: Props = $props();

  let isUpdating = $state(false);

  // Parse assignedTo - now it's string[] | null directly
  const assignedList = $derived(
    Array.isArray(todo.assignedTo) ? todo.assignedTo : [],
  );

  const isAssigned = $derived(
    globalState.userId && assignedList.includes(globalState.userId),
  );

  // Derive assignee information with avatars
  const assigneeInfos = $derived.by(() => {
    if (!todo.assignedTo) return [];
    return todo.assignedTo.map((userId: string) => {
      const contributor = contributors.find((c) => c.id === userId);
      const isCurrentUser = userId === globalState.userId;
      const name =
        contributor?.name || (isCurrentUser ? "Moi" : userId.substring(0, 5));
      return { userId, name, isCurrentUser };
    });
  });

  // Derived: Check if enough people are assigned
  const hasEnoughAssignees = $derived(
    assigneeInfos.length >= (todo.requiredPeopleNb || 1),
  );

  // Derived: TaskOn Card Config
  const taskOnCardConfig = $derived.by(() => {
    const t = todo.taskOn as string;
    switch (t) {
      case "beforeEvent":
        return {
          bg: "bg-accent/30",
          icon: ClockArrowUp,
          label: "Avant l'événement",
        };
      case "afterEvent":
        return {
          bg: "bg-secondary/10",
          icon: ClockArrowDown,
          label: "Après l'événement",
        };
      case "onEvent":
      default:
        return {
          bg: "bg-secondary/20",
          icon: Clock,
          label: "Pendant l'événement",
        };
    }
  });

  async function handleToggleStatus() {
    if (isUpdating || disabled) return;

    // Simplified: toggle between todo and done
    const s = todo.status as string;
    const next: EventTodoStatus = (
      s === "done" ? "todo" : "done"
    ) as EventTodoStatus;

    isUpdating = true;
    try {
      await eventsStore.updateTodo(eventId, todo.id, { status: next });
    } catch {
      toastService.error("Erreur màj statut");
    } finally {
      isUpdating = false;
    }
  }

  async function handleToggleAssign() {
    if (!globalState.userId || isUpdating) return;

    const newAssigned = isAssigned
      ? assignedList.filter((id: string) => id !== globalState.userId)
      : [...assignedList, globalState.userId];

    isUpdating = true;
    try {
      await eventsStore.updateTodo(eventId, todo.id, {
        assignedTo: newAssigned.length > 0 ? newAssigned : null,
      });
      toastService.success(
        !isAssigned
          ? "Vous avez quitté la tâche"
          : "Vous avez rejoint la tâche",
      );
    } catch (e) {
      toastService.error("Erreur assignation");
    } finally {
      isUpdating = false;
    }
  }
</script>

<div
  class="group bg-base-200/50 relative rounded-xl p-4 shadow transition-all {hasEnoughAssignees
    ? 'shadow-success/40 '
    : 'shadow-warning/40 '}"
  class:opacity-50={isUpdating}
>
  <div class="flex flex-col gap-3">
    <!-- Left: Status + Content -->
    <div class="flex min-w-0 items-start gap-3">
      <!-- Content -->
      <div class="flex min-w-0 grow flex-col gap-4">
        <!-- Title + Priority -->
        <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div
            class="text-base font-medium {todo.status === 'done'
              ? 'line-through opacity-50'
              : ''}"
          >
            {todo.taskName}
          </div>

          <div
            class="card card-sm {taskOnCardConfig.bg} ms-auto flex flex-col justify-end px-4 py-1"
          >
            <!-- Priority Badge -->
            {#if todo.priority && todo.priority !== "low"}
              <!-- <div
                class="badge badge-sm w-fit border-0"
              >
                {priorityConfig.label}
              </div> -->
            {/if}
            <!-- Moment (TaskOn) -->
            {#if todo.taskOn}
              <div class="flex items-center gap-2">
                <taskOnCardConfig.icon class="size-4 shrink-0 opacity-70" />
                <span>{taskOnCardConfig.label}</span>
              </div>
            {/if}

            <!-- Due Date -->
            {#if todo.dueDate}
              <div class="flex items-center gap-2">
                <Calendar class="size-4 shrink-0 opacity-70" />
                <span> A réaliser avant le :</span>
                <span class="font-medium">
                  {new Date(todo.dueDate).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Meta Information Grid -->
        <!-- Assignees -->
        <div class="flex items-center gap-2">
          <Users class="mt-1 mb-auto size-4 shrink-0 opacity-60" />
          <div class="flex min-w-0 items-center gap-1">
            <div class="flex flex-wrap gap-2">
              {#each assigneeInfos.slice(0, 3) as assignee, index (assignee.userId)}
                <div
                  title={assignee.name +
                    (assignee.isCurrentUser ? " (vous)" : "")}
                >
                  <div
                    class="badge badge-soft badge-info {assignee.isCurrentUser &&
                      'ring-info font-semibold ring-1'}"
                  >
                    <span>{assignee.name}</span>
                  </div>
                </div>
              {/each}

              {#if assigneeInfos.length > 3}
                <div class="" title="+{assigneeInfos.length - 3} autres">
                  <div class="bg-base-300 text-base-content w-7 rounded-full">
                    <span class="text-base">+{assigneeInfos.length - 3}</span>
                  </div>
                </div>
              {/if}

              {#if assigneeInfos.length === 0}
                <span class="text-warning mx-1 text-base italic">
                  Non assigné
                </span>
              {/if}
            </div>

            <span
              class="mx-1 {assigneeInfos.length < (todo.requiredPeopleNb || 1)
                ? 'text-warning'
                : 'text-success'} font-medium"
            >
              {assigneeInfos.length}/{todo.requiredPeopleNb || 1} pers. requise
            </span>
          </div>
        </div>

        <!-- Description (if exists) -->
        {#if todo.taskDescription}
          <p class="text-base-content/60 mt-1 line-clamp-2 text-sm">
            {todo.taskDescription}
          </p>
        {/if}
      </div>
    </div>
  </div>
  <!-- Actions -->
  <div class="mt-4 flex items-center justify-between gap-2">
    <div class="flex gap-2">
      {#if todo.taskOn === "beforeEvent"}
        <button
          onclick={handleToggleStatus}
          class="btn btn-sm {todo.status !== 'done'
            ? 'btn-dash'
            : 'btn-success'}"
          title={todo.status === "done" ? "Marquer à faire" : "Marquer fait"}
          {disabled}
        >
          <Check class="size-4 {todo.status !== 'done' && 'opacity-60'}" />
          Fait {#if todo.status !== "done"}
            ?
          {/if}
        </button>
      {/if}
    </div>
    <div class="ms-auto flex gap-2">
      <!-- Assign/Unassign button -->
      {#if !isAssigned}
        <button
          class="btn btn-primary btn-outline btn-sm gap-1"
          onclick={handleToggleAssign}
          title="Me porter volontaire pour cette tâche"
        >
          <Check class="size-4" />
          <span class="">M'inscrire</span>
        </button>
      {:else if isAssigned}
        <button
          class="btn btn-error btn-sm btn-outline gap-1"
          onclick={handleToggleAssign}
          title="Quitter cette tâche"
        >
          <Minus class="size-4" />
          <span>me désinscrire</span>
        </button>
      {/if}

      <!-- Edit button (always visible) -->
      <button
        class="btn btn-sm btn-square"
        onclick={() => onEdit(todo)}
        title="Modifier la tâche"
      >
        <PencilLine class="size-4" />
      </button>
    </div>
  </div>
</div>

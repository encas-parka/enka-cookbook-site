<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import { Markdown } from "tiptap-markdown";
  import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Type,
    RotateCcw,
    RotateCw,
  } from "@lucide/svelte";

  interface Props {
    value: string;
    placeholder?: string;
    label?: string;
    error?: string;
    id?: string;
  }

  let {
    value = $bindable(),
    placeholder = "Commencez à rédiger...",
    label,
    error,
    id,
  }: Props = $props();

  let element = $state<HTMLElement | null>(null);
  let editor = $state<Editor | null>(null);

  // Variable de déclenchement pour forcer la réactivité de la toolbar
  let updateTrigger = $state(0);

  // État pour savoir si l'éditeur est focalisé (optionnel pour le style)
  let isFocused = $state(false);

  onMount(() => {
    if (element) {
      editor = new Editor({
        element,
        extensions: [
          StarterKit.configure({
            // On peut désactiver ce dont on n'a pas besoin
            codeBlock: false,
            blockquote: false,
          }),
          Markdown.configure({
            html: false, // On préfère le pur Markdown
            tightLists: true,
          }),
        ],
        content: value,
        editorProps: {
          attributes: {
            class:
              "prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4",
          },
        },
        onUpdate: ({ editor }) => {
          const markdown = (editor.storage as any).markdown.getMarkdown();
          if (value !== markdown) {
            value = markdown;
          }
        },
        onSelectionUpdate: () => {
          updateTrigger++;
        },
        onTransaction: () => {
          updateTrigger++;
        },
        onFocus: () => (isFocused = true),
        onBlur: () => (isFocused = false),
      });
    }
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });

  // NOTE: Pas besoin de $effect pour la synchronisation descendante
  // value utilise $bindable() qui gère déjà la synchro automatiquement
  // Un $effect ici créerait une boucle infinie avec onUpdate -> onTransaction -> updateTrigger
</script>

<div class=" w-full">
  {#if label}
    <label class="label" for={id}>
      <span class="label-text font-medium">{label}</span>
    </label>
  {/if}

  <div
    class="bg-base-100 overflow-hidden rounded-lg border-2 transition-all"
    class:border-primary={isFocused}
    class:border-error={error}
    class:border-base-300={!isFocused && !error}
  >
    <!-- Toolbar -->
    {#if editor}
      <div
        class="border-base-200 bg-base-200 flex flex-wrap items-center gap-1 border-b p-1"
      >
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 && editor.isActive("bold")}
          onclick={() => editor!.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 && editor.isActive("italic")}
          onclick={() => editor!.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic class="h-4 w-4" />
        </button>
        <div class="divider divider-horizontal mx-0 h-6"></div>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 && editor.isActive("bulletList")}
          onclick={() => editor!.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 &&
            editor.isActive("orderedList")}
          onclick={() => editor!.chain().focus().toggleOrderedList().run()}
          title="Liste ordonnée"
        >
          <ListOrdered class="h-4 w-4" />
        </button>
        <div class="divider divider-horizontal mx-0 h-6"></div>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          onclick={() => editor!.chain().focus().undo().run()}
          disabled={!(updateTrigger >= 0 && editor.can().undo())}
          title="Annuler"
        >
          <RotateCcw class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          onclick={() => editor!.chain().focus().redo().run()}
          disabled={!(updateTrigger >= 0 && editor.can().redo())}
          title="Rétablir"
        >
          <RotateCw class="h-4 w-4" />
        </button>
      </div>
    {/if}

    <!-- Editor Surface -->
    <div
      bind:this={element}
      {id}
      class="max-h-[calc(100vh-200px)] min-h-96 overflow-auto"
    ></div>
  </div>

  {#if error}
    <div class="label">
      <span class="text-error">{error}</span>
    </div>
  {/if}
</div>

<style>
  :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #adb5bd;
    pointer-events: none;
    height: 0;
  }
</style>

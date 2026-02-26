<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import { Markdown } from "tiptap-markdown";
  import Highlight from "@tiptap/extension-highlight";
  import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Highlighter as HighlightIcon,
    Minus,
    RotateCcw,
    RotateCw,
    Type,
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

  // État du dropdown heading
  let showHeadingDropdown = $state(false);

  // Détection du heading actif avec $derived
  const currentHeading = $derived.by(() => {
    if (!editor) return 0;
    // Utiliser updateTrigger pour forcer la réactivité
    void updateTrigger;
    if (editor.isActive("heading", { level: 1 })) return 1;
    if (editor.isActive("heading", { level: 2 })) return 2;
    if (editor.isActive("heading", { level: 3 })) return 3;
    if (editor.isActive("heading", { level: 4 })) return 4;
    if (editor.isActive("heading", { level: 5 })) return 5;
    if (editor.isActive("heading", { level: 6 })) return 6;
    return 0;
  });

  onMount(() => {
    if (element) {
      editor = new Editor({
        element,
        extensions: [
          StarterKit.configure({
            codeBlock: false,
            blockquote: false,
          }) as any,

          Highlight.configure({
            multicolor: false,
          }) as any,

          Markdown.configure({
            html: false,
            tightLists: true,
          }) as any,
        ],
        content: value,
        editorProps: {
          attributes: {
            class:
              "prose prose-sm max-w-none focus:outline-none h-[80dvh] p-4 prose-li:marker:text-base-content/50 overflow-auto",
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

  function setHeading(level: number) {
    if (level === 0) {
      editor!.chain().focus().setParagraph().run();
    } else {
      editor!
        .chain()
        .focus()
        .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
    }
    showHeadingDropdown = false;
  }

  function insertHorizontalRule() {
    editor!.chain().focus().setHorizontalRule().run();
  }
</script>

<div class="form-control w-full">
  {#if label}
    <label class="label" for={id}>
      <span class="label-text font-medium">{label}</span>
    </label>
  {/if}

  <div
    class="bg-base-100 border-base-300 overflow-hidden rounded-lg border shadow-lg transition-all"
    class:border-error={error}
  >
    <!-- Toolbar -->
    {#if editor}
      <div
        class="border-base-200 bg-base-100 flex flex-wrap items-center gap-1 border-b p-1"
      >
        <!-- Heading Dropdown -->
        <div class="dropdown" class:dropdown-open={showHeadingDropdown}>
          <button
            type="button"
            tabindex="0"
            class="btn btn-ghost btn-sm gap-1"
            onclick={() => (showHeadingDropdown = !showHeadingDropdown)}
            title="Titre"
          >
            {#if currentHeading === 1}
              <Heading1 class="h-4 w-4" />
            {:else if currentHeading === 2}
              <Heading2 class="h-4 w-4" />
            {:else if currentHeading === 3}
              <Heading3 class="h-4 w-4" />
            {:else}
              <Type class="h-4 w-4" />
            {/if}
          </button>

          <ul
            tabindex="-1"
            class="menu dropdown-content bg-base-100 rounded-box z-50 w-52 shadow-xl"
          >
            <li>
              <button type="button" onclick={() => setHeading(0)}>
                <Type class="h-4 w-4" /> Paragraphe
              </button>
            </li>
            <li>
              <button type="button" onclick={() => setHeading(1)}>
                <Heading1 class="h-4 w-4" /> Titre 1
              </button>
            </li>
            <li>
              <button type="button" onclick={() => setHeading(2)}>
                <Heading2 class="h-4 w-4" /> Titre 2
              </button>
            </li>
            <li>
              <button type="button" onclick={() => setHeading(3)}>
                <Heading3 class="h-4 w-4" /> Titre 3
              </button>
            </li>
          </ul>
        </div>

        <div class="divider divider-horizontal mx-0 h-6"></div>

        <!-- Text Formatting -->
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
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 && editor.isActive("strike")}
          onclick={() => editor!.chain().focus().toggleStrike().run()}
          title="Barré"
        >
          <Strikethrough class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          class:btn-active={updateTrigger >= 0 && editor.isActive("highlight")}
          onclick={() => editor!.chain().focus().toggleHighlight().run()}
          title="Surlignage"
        >
          <HighlightIcon class="h-4 w-4" />
        </button>

        <div class="divider divider-horizontal mx-0 h-6"></div>

        <!-- Lists -->
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

        <!-- Horizontal Rule -->
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          onclick={insertHorizontalRule}
          title="Ligne horizontale"
        >
          <Minus class="h-4 w-4" />
        </button>

        <div class="divider divider-horizontal mx-0 h-6"></div>

        <!-- Undo/Redo -->
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
    <div bind:this={element} {id}></div>
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

  /* List styling - Fix for list items appearing on new lines */
  :global(.tiptap ul),
  :global(.tiptap ol) {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }

  :global(.tiptap ol) {
    list-style-type: decimal;
  }

  :global(.tiptap li) {
    display: list-item;
    margin: 0.25rem 0;
  }

  :global(.tiptap li p) {
    display: inline;
    margin: 0;
  }

  /* Highlight styling */
  :global(.tiptap mark) {
    background-color: #fef08a;
    color: inherit;
    padding: 0.1em 0.2em;
    border-radius: 0.2em;
  }

  /* Horizontal rule styling */
  :global(.tiptap hr) {
    border: none;
    border-top: 2px solid #e5e7eb;
    margin: 1rem 0;
  }
</style>

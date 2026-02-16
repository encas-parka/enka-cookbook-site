<script lang="ts">
  import { formatAuthorForDisplay } from "$lib/utils/utils";

  interface Props {
    auteur?: string | null;
    createdBy?: string | null;
    id: string;
    createdAt: string;
    updatedAt?: string | null;
  }

  let { auteur, createdBy, id, createdAt, updatedAt }: Props = $props();

  // Formater l'auteur en masquant les emails
  const formattedAuthor = $derived(
    auteur ? formatAuthorForDisplay(auteur) : null,
  );
  const formattedCreatedBy = $derived(
    createdBy ? formatAuthorForDisplay(createdBy) : null,
  );
</script>

<div class="bg-base-200 rounded-box mt-12 p-6 text-sm opacity-60 print:hidden">
  <div
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <div>
      <span class="font-semibold">Auteur :</span>
      {formattedAuthor || formattedCreatedBy || "Inconnu"}
    </div>
    <div>
      <span class="font-semibold">ID :</span>
      <span class="font-mono">{id}</span>
    </div>
    <div>
      <span class="font-semibold">Créé le :</span>
      {new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(createdAt))}
    </div>
    {#if updatedAt && updatedAt !== createdAt}
      <div>
        <span class="font-semibold">Modifié le :</span>
        {new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(updatedAt))}
      </div>
    {/if}
  </div>
</div>

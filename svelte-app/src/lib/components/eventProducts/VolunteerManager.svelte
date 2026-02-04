<script lang="ts">
  import { User, UserPlus, Users, X } from "@lucide/svelte";
  import type { ProductModalStateType } from "$lib/types/store.types.js";
  import { productsStore } from "$lib/stores/ProductsStore.svelte.js";
  import BtnGroupCheck from "../ui/BtnGroupCheck.svelte";
  import ArchiveMessage from "./ArchiveMessage.svelte";

  interface Props {
    modalState: ProductModalStateType;
    isArchiveMode?: boolean;
  }

  let { modalState, isArchiveMode = false }: Props = $props();

  // État local uniquement pour le nouveau volontaire
  let newVolunteerName = $state("");

  // ✅ Utilisation directe de modalState.forms.who - état centralisé

  // Créer la liste des items pour BtnGroupCheck
  const volunteerItems = $derived.by(() => {
    // ✅ Utiliser les contributors de l'événement comme source principale
    const eventContributors = productsStore.uniqueWho;

    // Combiner eventContributors et forms.who (pour les nouveaux volontaires ajoutés manuellement)
    const allVolunteers = new Set([
      ...eventContributors,
      ...modalState.forms.who,
    ]);

    return Array.from(allVolunteers).map((who) => ({
      id: who,
      label: who,
      selected: modalState.forms.who.includes(who),
    }));
  });

  function handleAddVolunteer(name: string) {
    const trimmedName = name.trim();
    if (trimmedName && !modalState.forms.who.includes(trimmedName)) {
      modalState.forms.who = [...modalState.forms.who, trimmedName];
    }
  }

  function handleRemoveVolunteer(volunteer: string) {
    modalState.forms.who = modalState.forms.who.filter((v) => v !== volunteer);
  }

  function handleToggleVolunteer(volunteerId: string) {
    if (modalState.forms.who.includes(volunteerId)) {
      handleRemoveVolunteer(volunteerId);
    } else {
      handleAddVolunteer(volunteerId);
    }
  }

  // Annuler les modifications
  function handleCancel() {
    modalState.forms.who = [...modalState.whoList];
    newVolunteerName = "";
  }

  function handleQuickAdd() {
    if (newVolunteerName.trim()) {
      handleAddVolunteer(newVolunteerName);
      newVolunteerName = "";
    }
  }
</script>

<div class="space-y-4">
  {#if isArchiveMode}
    <ArchiveMessage
      title="Volontaires non modifiables"
      message="L'événement est terminé, les volontaires assignés ne peuvent plus être modifiés."
    />
  {:else}
    <div class="card bg-base-200">
      <div class="card-body">
        <h4 class="card-title text-base">Gérer les volontaires</h4>

        <p class="mb-4 text-sm opacity-75">
          Ajoutez ou retirez des volontaires pour ce produit.
        </p>

        <div class="space-y-4">
          <!-- Ajout rapide -->
          <div class="flex gap-2">
            <label class="input w-72">
              <User class="h-4 w-4 opacity-50" />
              <input
                type="text"
                class="w-full"
                placeholder="Ajouter un volontaire..."
                bind:value={newVolunteerName}
                onkeydown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickAdd();
                  }
                }}
                disabled={modalState.loading}
              />
            </label>

            <button
              class="btn btn-square btn-primary"
              onclick={handleQuickAdd}
              disabled={modalState.loading || !newVolunteerName.trim()}
            >
              <UserPlus size={16} />
            </button>
          </div>

          <!-- Gestion des volontaires avec BtnGroupCheck -->
          <div>
            <h5 class="mb-2 font-medium">Selection rapide</h5>
            <BtnGroupCheck
              items={volunteerItems}
              onToggleItem={handleToggleVolunteer}
              size="sm"
              color="info"
            />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <!-- <div class="card-actions justify-end">
        <button
          class="btn btn-ghost btn-sm"
          onclick={handleCancel}
          disabled={modalState.loading}
        >
          Annuler
        </button>
      </div> -->
    </div>
  {/if}
</div>

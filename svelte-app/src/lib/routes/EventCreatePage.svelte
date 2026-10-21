<script lang="ts">
  import EventMealCard from "$lib/components/eventEdit/EventMealCard.svelte";
  import Fieldset from "$lib/components/ui/Fieldset.svelte";
  import { toastService } from "$lib/services/toast.service.svelte";
  import { eventsStore } from "$lib/stores/EventsStore.svelte";
  import { globalState } from "$lib/stores/GlobalState.svelte";
  import { nativeTeamsStore as teamsStore } from "$lib/stores/NativeTeamsStore.svelte";
  import type { EventMeal } from "$lib/types/events";
  import type { MainStatus } from "$lib/types/pb";
  import { Calendar, CalendarPlus2, Info, Plus, Save } from "@lucide/svelte";
  import { nanoid } from "nanoid";
  import { flip } from "svelte/animate";
  import { untrack } from "svelte";
  import { navigate, route, searchParams } from "$lib/router";
  import { newPbId } from "$lib/utils/pb-id";

  import { navBarStore } from "../stores/NavBarStore.svelte";

  // ============================================================================
  // STATE
  // ============================================================================

  let meals = $state<EventMeal[]>([]);
  let eventName = $state("");
  let description = $state("");

  let status = $state<MainStatus | "">("");
  let statusError = $state(false);
  let isBusy = $state(false);
  let editingMealIndex = $state<string | null>(null);

  // Meals triés par date pour l'affichage
  const sortedMeals = $derived(
    [...meals].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  );

  // Il y a des modifications si on a des données
  const hasData = $derived(eventName.trim().length > 0 || meals.length > 0);

  // Teams sélectionnées pour les permissions
  let selectedTeams = $state<string[]>([]);
  let sendEmailToExistingMembers = $state(true);

  const teamIdFromUrl = $derived(route.params.teamId);

  // Précocher la team si présente dans l'URL
  $effect(() => {
    const teamId = teamIdFromUrl;
    const myTeams = teamsStore.myTeams;
    if (teamId && myTeams.some((t) => t.id === teamId)) {
      untrack(() => {
        if (!selectedTeams.includes(teamId)) {
          selectedTeams = [teamId];
        }
      });
    }
  });

  // Fonction pour toggle une team
  function toggleTeam(teamId: string) {
    if (selectedTeams.includes(teamId)) {
      selectedTeams = selectedTeams.filter((id) => id !== teamId);
    } else {
      selectedTeams = [...selectedTeams, teamId];
    }
  }

  // Permissions Manager - création (pas d'édition)
  let minContrib = $state(1);

  // ============================================================================
  // NAVBAR CONFIGURATION
  // ============================================================================

  $effect(() => {
    navBarStore.setConfig({
      actions: navActions,
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function validateEventData() {
    if (!eventName.trim()) {
      return {
        isValid: false,
        errorMessage: "Veuillez renseigner le nom de l'événement",
      };
    }

    if (meals.length === 0) {
      return {
        isValid: false,
        errorMessage: "Veuillez ajouter au moins un repas",
      };
    }

    if (!status) {
      statusError = true;
      return {
        isValid: false,
        errorMessage: "Veuillez sélectionner le statut de l'événement",
      };
    }

    // Vérification des doublons
    const allDatesValidation = meals.map((m) => m.date);
    const duplicatedDates = allDatesValidation.filter(
      (date, index, self) => self.indexOf(date) !== index,
    );

    if (duplicatedDates.length > 0) {
      const duplicatedDatesFormatted = duplicatedDates.map((date) => {
        try {
          return new Date(date).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch (e) {
          return date;
        }
      });

      return {
        isValid: false,
        errorMessage: `Certaines dates sont en double: ${duplicatedDatesFormatted.join(", ")}`,
      };
    }

    statusError = false;
    return { isValid: true };
  }

  // ============================================================================
  // SAUVEGARDE
  // ============================================================================

  // Clé d'idempotence de la soumission : générée à la première tentative,
  // réutilisée tant que le formulaire vit — une re-soumission après un échec
  // réseau ambigu ne peut pas dupliquer l'event (le serveur rejette l'id déjà
  // pris et le store réconcilie l'event déjà créé).
  let submissionKey: string | null = null;

  async function saveEventData(): Promise<boolean> {
    const validation = validateEventData();
    if (!validation.isValid) {
      toastService.error(validation.errorMessage || "Erreur de validation");
      return false;
    }

    // Initialiser contributors avec l'utilisateur courant
    const contributorsToSave = [
      {
        id: globalState.userId || "",
        name: globalState.userName,
        status: "accepted" as const,
        invitedAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
      },
    ];

    const allDatesSorted = Array.from(
      new Set(sortedMeals.map((m) => m.date)),
    ).sort();

    // Préparer les données de l'événement
    // `teams` = relation PocketBase → ids ; `date` (JSON) est dérivé des repas côté store
    const eventData = {
      name: eventName,
      description,
      status: status as MainStatus,
      dateStart: allDatesSorted.length > 0 ? allDatesSorted[0] : null,
      dateEnd:
        allDatesSorted.length > 0
          ? allDatesSorted[allDatesSorted.length - 1]
          : null,
      teams: selectedTeams,
      contributors: contributorsToSave,
      meals: sortedMeals,
      minContrib,
    };

    try {
      // Utiliser la nouvelle méthode unifiée qui crée l'événement ET invite les teams
      // (l'envoi d'emails est géré par le système d'invitation PB — le flag
      // sendEmailToExistingMembers de la checkbox est actuellement sans effet)
      if (submissionKey === null) submissionKey = newPbId();
      const savedEvent = await eventsStore.createEventWithTeams(
        eventData,
        selectedTeams,
        submissionKey,
      );

      navigate(`/event/${savedEvent.id}`);
      return true;
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toastService.error("Erreur lors de la création");
      return false;
    }
  }

  async function handleSave() {
    isBusy = true;

    const success = await saveEventData();

    if (success) {
      toastService.success("Événement créé");
    }

    isBusy = false;
  }

  function handleNameInput(e: Event) {
    eventName = (e.target as HTMLInputElement).value;
  }

  function addMeal() {
    const mealId = nanoid(6);

    // Déterminer la date par défaut
    let defaultDateTime: string;

    if (sortedMeals.length === 0) {
      const today = new Date();
      today.setDate(today.getDate() + 7);
      today.setHours(20, 0, 0, 0);
      defaultDateTime = today.toISOString();
    } else {
      const lastMeal = sortedMeals[sortedMeals.length - 1];
      const lastDate = new Date(lastMeal.date);
      const lastHour = lastDate.getHours();

      if (lastHour < 14) {
        lastDate.setHours(20, 0, 0, 0);
      } else {
        lastDate.setDate(lastDate.getDate() + 1);
        lastDate.setHours(12, 0, 0, 0);
      }

      defaultDateTime = lastDate.toISOString();
    }

    const newMeal: EventMeal = {
      id: mealId,
      date: defaultDateTime,
      guests: 100,
      recipes: [],
    };

    meals = [...meals, newMeal];
    editingMealIndex = mealId;
  }

  function removeMeal(mealId: string) {
    meals = meals.filter((m) => m.id !== mealId);
  }

  function toggleEditMeal(mealId: string) {
    editingMealIndex = editingMealIndex === mealId ? null : mealId;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================
</script>

{#snippet navActions()}
  <div class="flex items-center gap-2">
    <button
      class="btn btn-accent btn-sm"
      onclick={handleSave}
      disabled={isBusy || !hasData}
    >
      {#if isBusy}
        <span class="loading loading-xs loading-spinner text-primary"></span>
      {:else}
        <Save size={18} class="mr-1" />
      {/if}
      <span class="hidden font-bold sm:inline">Créer</span>
    </button>
  </div>
{/snippet}

<div class="min-h-lvh space-y-10 bg-base-200 px-4 pt-4 pb-20 md:px-20">
  <div class="card bg-base-100 card-sm">
    <div class="card-body">
      <div class="mb-2 card-title">
        <CalendarPlus2 /> Création d'un événement
      </div>
      <p>
        La création d'événement permet d'organiser des menus sur plusieurs
        jours, se répartir les taches (une fois l'événement crée), gérer une
        liste de courses générées à partir des ingrédients des recettes, générer
        des affiches de menus...
      </p>
    </div>
  </div>

  <div class="flex flex-col justify-between gap-6">
    <div class="min-w-80 flex-1 gap-2">
      <input
        type="text"
        class="input min-w-2/3 shadow-md input-lg"
        value={eventName}
        oninput={handleNameInput}
        disabled={isBusy}
        placeholder="Nom de l'événement"
      />
    </div>
    <div class="flex flex-wrap gap-x-10 gap-y-6">
      <div class="span-2 flex min-w-xs flex-1 flex-col">
        <textarea
          class="shamd-sm textarea w-full"
          placeholder="Décrivez l'événement..."
          bind:value={description}
          maxlength="3000"
          rows="9"></textarea>
        <p class="label ms-auto me-2 text-end text-sm">
          {description.length}/3000 caractères
        </p>
      </div>

      <!-- Statut de l'événement -->
      <div class=" max-sm:w-full md:min-w-96">
        <Fieldset legend="Statut de l'événement">
          <div class="space-y-3">
            <label class="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                bind:group={status}
                value={"proposition"}
                class="radio radio-primary"
                onchange={() => (statusError = false)}
              />
              <div class="flex-1">
                <div class="font-medium">Proposition</div>
                <div class="text-sm opacity-70">En attente de confirmation</div>
              </div>
            </label>

            <label class="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                bind:group={status}
                value={"confirmed"}
                class="radio radio-primary"
                onchange={() => (statusError = false)}
              />
              <div class="flex-1">
                <div class="font-medium">Confirmé</div>
                <div class="text-sm opacity-70">Événement validé</div>
              </div>
            </label>
          </div>
          {#if statusError}
            <p class="mt-2 text-sm text-error">
              Veuillez sélectionner un statut
            </p>
          {/if}
        </Fieldset>
      </div>
    </div>
  </div>

  {#if isBusy}
    <div class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-lg loading-spinner text-primary"></span>
        <p class="text-base-content/60">Création de l'événement...</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Colonne Gauche : Permissions -->
      <div class="space-y-6 lg:col-span-1">
        <!-- Sélection des teams -->
        <Fieldset legend="Équipes participantes">
          {#if teamsStore.myTeams.length > 0}
            <fieldset class="mb-6 fieldset">
              <legend class="fieldset-legend">Minimum de participant·es</legend>
              <label class="input">
                <input
                  type="number"
                  min="1"
                  max="100"
                  bind:value={minContrib}
                  placeholder="1"
                />
              </label>
              <p class="fieldset-label text-base-content/60">
                Combien faudrait-il être pour tout gérer ?
              </p>
            </fieldset>

            <fieldset class="mb-4 fieldset">
              <legend class="fieldset-legend"
                >Sélectionnez les équipes à inviter à l'événement :</legend
              >
              <div class="flex flex-wrap gap-2">
                {#each teamsStore.myTeams as team (team.id)}
                  <label
                    class="flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/10 px-4 py-2 hover:bg-secondary/20 {selectedTeams.includes(
                      team.id,
                    ) && 'ring-2 ring-secondary'}"
                  >
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-secondary"
                      checked={selectedTeams.includes(team.id)}
                      onchange={() => toggleTeam(team.id)}
                    />
                    <div class="flex flex-col">
                      <span class="text-sm font-medium">
                        {team.name}
                        <span class="text-xs opacity-60">
                          ({team.total} membre{team.total > 1 ? "s" : ""})
                        </span>
                      </span>
                      <div class="text-xs opacity-70">
                        {teamsStore.getTeamMemberNames(team.id).join(", ")}
                      </div>
                    </div>
                  </label>
                {/each}
              </div>
              <div
                class="mt-4 alert alert-vertical text-sm text-base-content/70"
              >
                <Info class="size-4 shrink-0" />
                Une fois l'événement crée, il vous sera possible d'inviter des personnes
                individuellement, indépendamment des équipes.
              </div>
            </fieldset>

            <!-- Checkbox envoi d'emails -->
            {#if selectedTeams.length > 0}
              <label class="cursor-pointer justify-center gap-4">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  bind:checked={sendEmailToExistingMembers}
                />
                <span class="ms-1">
                  Envoyer un email de notification aux membres des équipes
                </span>
              </label>
              <p class="mt-1 text-xs text-base-content/60">
                Si désactivé, les membres auront accès à l'événement mais ne
                recevront pas d'email.
              </p>
            {/if}
          {:else}
            <p class="text-sm italic opacity-60">
              Vous ne faites partie d'aucune équipe.
            </p>
          {/if}
        </Fieldset>
      </div>

      <!-- Colonne Droite : Repas -->
      <div class="space-y-6 md:px-4 lg:col-span-2">
        <div class="mb-6 flex items-center justify-between">
          <h3 class="">
            Repas & Menus ({sortedMeals.length})
          </h3>
          <button class="btn btn-primary btn-sm" onclick={addMeal}>
            <Plus class="mr-1 h-4 w-4" />
            Ajouter un repas
          </button>
        </div>

        {#if sortedMeals.length === 0}
          <div
            class="flex flex-col items-center justify-center rounded-box border-2 border-dashed border-base-200 bg-base-200 py-12 text-base-content/60"
          >
            <div class="mb-4 rounded-full bg-base-200 p-4">
              <Calendar class="h-8 w-8 opacity-50" />
            </div>
            <p class="font-medium">Aucun repas planifié</p>
            <p class="mt-1 text-sm">
              Commencez par ajouter un repas à votre événement
            </p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each sortedMeals as meal (meal.id)}
              <div animate:flip={{ delay: 100, duration: 400 }}>
                <EventMealCard
                  bind:meal={meals[meals.findIndex((m) => m.id === meal.id)]}
                  isEditing={editingMealIndex === meal.id}
                  onEditToggle={() => toggleEditMeal(meal.id || "")}
                  onDelete={() => removeMeal(meal.id || "")}
                  allDates={meals.map((m) => m.date)}
                  disabled={false}
                />
              </div>
            {/each}
          </div>
        {/if}
        <div class="flex">
          <button
            class="btn mt-4 btn-block btn-outline btn-primary"
            onclick={addMeal}
          >
            <Plus class="mr-1 h-4 w-4" />
            Ajouter un repas
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Bouton flottant Créer (mobile uniquement) -->
  {#if hasData && !isBusy}
    <button
      class="btn sticky bottom-2 shadow-lg btn-accent btn-sm {!globalState.isMobile &&
        'hidden'}"
      onclick={handleSave}
      disabled={isBusy || !hasData}
    >
      <Save class="mr-1 size-4" />
      Créer
    </button>
  {/if}
</div>

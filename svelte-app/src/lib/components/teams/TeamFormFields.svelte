<script lang="ts">
  import { MapPin, Building2, Info } from "@lucide/svelte";

  interface Props {
    name: string;
    description: string;
    location?: string;
    city?: string;
    showLocation?: boolean;
    disabled?: boolean;
    nameMaxLength?: number;
    descriptionMaxLength?: number;
    onNameKeydown?: (e: KeyboardEvent) => void;
  }

  let {
    name = $bindable(),
    description = $bindable(),
    location = $bindable(""),
    city = $bindable(""),
    showLocation = false,
    disabled = false,
    nameMaxLength = 50,
    descriptionMaxLength = 350,
    onNameKeydown,
  }: Props = $props();

  let showAdminMsg = name !== "";
</script>

<div class="@container space-y-4">
  {#if showAdminMsg}
    <div class="alert alert-soft alert-warning @max-lg:alert-vertical">
      <Info class="size-5 shrink-0 self-baseline" /> Seul·es les admins peuvent modifier
      les paramètres de l'équipe.
    </div>
  {/if}
  <!-- Nom de l'équipe -->
  <fieldset class="fieldset">
    <legend class="fieldset-legend required">Nom de l'équipe</legend>
    <label class="input">
      <input
        type="text"
        bind:value={name}
        placeholder="Ex: Équipe Marketing"
        maxlength={nameMaxLength}
        {disabled}
        required
        aria-required="true"
        onkeydown={(e) => onNameKeydown?.(e)}
      />
    </label>
    <span class="fieldset-label text-xs"
      >{name.length}/{nameMaxLength} caractères</span
    >
  </fieldset>

  <!-- Description -->
  <fieldset class="fieldset">
    <legend class="fieldset-legend">Description</legend>
    <textarea
      class="textarea w-full"
      bind:value={description}
      rows="3"
      maxlength={descriptionMaxLength}
      {disabled}
    ></textarea>
    <span class="fieldset-label text-xs"
      >{description.length}/{descriptionMaxLength} caractères</span
    >
  </fieldset>

  <!-- Localisation -->
  {#if showLocation}
    <div class="grid grid-cols-2 gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-1">
          <MapPin class="h-4 w-4" />
          Département
        </legend>
        <label class="input">
          <input
            type="text"
            bind:value={location}
            placeholder="Ex: Île-de-France"
            maxlength="50"
            {disabled}
          />
        </label>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend flex items-center gap-1">
          <Building2 class="h-4 w-4" />
          Ville
        </legend>
        <label class="input">
          <input
            type="text"
            bind:value={city}
            placeholder="Ex: Paris"
            maxlength="50"
            {disabled}
          />
        </label>
      </fieldset>
    </div>
  {/if}
</div>

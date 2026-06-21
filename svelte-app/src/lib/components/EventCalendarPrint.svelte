<script lang="ts">
  interface CalendarRecipe {
    recipeUuid: string;
    title: string;
    plates: number;
    mealDate: string;
    typeR: string;
    preparation24h: string | null;
  }

  interface CalendarColumn {
    dateISO: string;
    label: string;
    mealsByMoment: Map<string, CalendarRecipe[]>;
  }

  interface Props {
    columns: CalendarColumn[];
  }

  let { columns }: Props = $props();

  /** Nombre maximum de jours (colonnes) par page imprimée. Au-delà, on
   *  pagine : un chunk = une page A4 paysage. */
  const COLUMNS_PER_PAGE = 5;

  /** Découpe les colonnes en chunks de COLUMNS_PER_PAGE pour paginer
   *  l'impression et éviter la compression horizontale des événements longs.
   *  Retourne [] si columns est vide (rien à imprimer). */
  const columnPages = $derived(
    columns.length === 0
      ? []
      : Array.from(
          { length: Math.ceil(columns.length / COLUMNS_PER_PAGE) },
          (_, i) =>
            columns.slice(i * COLUMNS_PER_PAGE, (i + 1) * COLUMNS_PER_PAGE),
        ),
  );

  const moments = [
    { key: "matin", label: "Matin" },
    { key: "midi", label: "Midi" },
    { key: "soir", label: "Soir" },
  ] as const;

  /** Moments ayant au moins une recette dans l'ensemble des colonnes
   *  (filtrage global, pas par page, pour la cohérence visuelle). */
  const activeMoments = $derived(
    moments.filter((m) =>
      columns.some((col) => (col.mealsByMoment.get(m.key) ?? []).length > 0),
    ),
  );

  /** Marqueur de type compact (E/P/D/A) pour gains de place. */
  function getTypeMark(typeR: string): string {
    if (typeR === "entree") return "E";
    if (typeR === "plat") return "P";
    if (typeR === "dessert") return "D";
    if (typeR === "autre") return "A";
    return "";
  }
</script>

{#each columnPages as pageCols, pageIdx (pageIdx)}
  <!-- Wrapper div : break-after fiable sur un div qu'un <table> (Chrome
       fragmente les tables et ignore souvent break-after sur elles). -->
  <div
    class="cal-print-page"
    class:cal-print-page-break={pageIdx < columnPages.length - 1}
  >
    <table class="cal-print">
      <thead>
        <tr>
          <th class="cal-print-corner"></th>
          {#each pageCols as col (col.dateISO)}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each activeMoments as moment (moment.key)}
          <tr>
            <td class="cal-print-moment">{moment.label}</td>
            {#each pageCols as col (col.dateISO)}
              {@const recipes = col.mealsByMoment.get(moment.key) ?? []}
              <td class="cal-print-cell">
                {#if recipes.length > 0}
                  <ul class="cal-print-recipes">
                    {#each recipes as recipe (recipe.recipeUuid)}
                      <li>
                        {#if getTypeMark(recipe.typeR)}
                          <span class="cal-print-type">
                            {getTypeMark(recipe.typeR)}
                          </span>
                        {/if}
                        <span class="cal-print-title">{recipe.title}</span>
                        <span class="cal-print-plates">({recipe.plates})</span>
                        {#if recipe.preparation24h}
                          <span class="cal-print-j1">J-1</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/each}

<div class="cal-print-legend">
  <strong>Légende :</strong>
  E = Entrée · P = Plat · D = Dessert · A = Autre ·
  <span class="cal-print-j1 cal-print-j1-legend">J-1</span>
  = Préparation la veille
</div>

<style>
  /* Tableau dédié à l'impression : sémantique <table> robuste, court-circuite
     les règles globales de app.css (.grid { display: block }) qui détruisent
     les layouts grid en print. */
  .cal-print {
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    /* Empêcher la fragmentation de la table : elle reste entière sur une
       page, ce qui rend break-after (sur le wrapper div) fiable. */
    break-inside: avoid-page;
  }

  .cal-print :global(th),
  .cal-print :global(td) {
    border: 1px solid #999;
    padding: 1.5mm 2mm;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .cal-print :global(th) {
    background-color: #eee;
    font-weight: 600;
    text-align: center;
  }

  .cal-print-corner,
  .cal-print-moment {
    width: 14mm;
    background-color: #f4f4f4;
    font-weight: 600;
    text-align: center;
  }

  .cal-print-cell {
    /* Hauteur minimale pour permettre d'éventuelles notes manuscrites
       même dans les cellules peu chargées. */
    height: 22mm;
  }

  .cal-print-recipes {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* !important : app.css force `p, li { margin-bottom: 0.35rem !important }`
     en print, écrasant toute margin-bottom sans !important. */
  .cal-print-recipes :global(li) {
    margin-bottom: 2.5mm !important;
    line-height: 1.15;
  }

  .cal-print-type {
    display: inline-block;
    min-width: 3mm;
    font-weight: 700;
    color: #555;
  }

  .cal-print-title {
    font-weight: 500;
  }

  .cal-print-plates {
    color: #666;
    margin-left: 1mm;
    white-space: nowrap;
  }

  .cal-print-j1 {
    display: inline-block;
    margin-left: 1.5mm;
    padding: 0 1mm;
    border: 1px solid #000;
    color: #000;
    font-size: 7.5pt;
    font-weight: 600;
    border-radius: 1mm;
  }

  .cal-print-legend {
    margin-top: 4mm;
    font-size: 8pt;
    color: #555;
  }

  .cal-print-j1-legend {
    margin-left: 0;
  }

  /* Saut de page : double mécanisme pour la fiabilité.
     1. min-height proche de la zone utile A4 paysage (200mm avec @page
        margin 1cm) force la pagination par débordement si break-after est
        ignoré. 175mm laisse une marge de sécurité pour éviter tout débordement.
     2. break-after: page comme backup si le navigateur l'honore. */
  .cal-print-page-break {
    min-height: 175mm;
    break-after: page;
    page-break-after: always;
  }
</style>

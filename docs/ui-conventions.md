# Conventions UI/UX — svelte-app

Conventions de chrome (navbar, retour, formulaires d'édition) pour garder des
pages cohérentes entre elles et entre breakpoints. Toute nouvelle page ou
composant de chrome se conforme à ce doc ; tout changement de convention se
écrit ici dans la même session.

Sources externes synthétisées : guidelines UX (back prédictible — sévérité
haute ; breadcrumbs inutiles sous 3 niveaux de profondeur), WCAG 2.2 AA
(cible ≥ 24 px CSS, écarts ≥ 8 px, viser 44 px sur mobile).

## Archétypes de pages et chrome

| Archétype                    | Chrome                                     | Back ?               | Exemples                                                                   |
| ---------------------------- | ------------------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| Liste top-level              | navigable depuis le header (menu, onglets) | non                  | `LoansPage`, `RecipesListPage`, `MaterielPage`, `DocumentListPage`         |
| Drill-in (dossier / édition) | actions contextuelles en navbar            | **oui**              | `LoanEditPage`, `RecipeEditPage`, `CreateDocumentPage`, `EditDocumentPage` |
| Page event à onglets         | barre interne (`EventTabs`)                | non (chrome interne) | `EventEditPage`, `EventRecipesPage`                                        |

## Geste retour

Un composant, posé dans la rangée du titre de la page :

```svelte
<PageBack
  label="Retour aux réservations"
  go={goBack}
  disabled={busy || saving}
/>
```

- **Tous breakpoints** : bouton icône seule (`ArrowLeft`, [PageBack.svelte](../svelte-app/src/lib/components/ui/PageBack.svelte))
  à gauche du H1 — l'utilisateur voit ce qu'il regarde et l'action de sortie
  au même endroit. `aria-label` + `title` = `label`, qui nomme la
  destination (jamais « Retour » seul).
- **La navbar ne porte jamais le geste** — ni desktop ni mobile : la barre
  est à densité figée et le bouton global poserait « retour vers où ? » ;
  seule la page connaît son parent.
- **`go` passe par `navigate()` vers le parent canonique** — jamais
  `history.back()` (imprévisible après un lien profond ou un refresh).
  Le guard `UnsavedChangesGuard` intercepte alors automatiquement la sortie
  si `dirty`.
- **Pas de bouton « Annuler » de formulaire** : un bouton qui « annule » sans
  modification est trompeur ; le back le remplace. Les actions destructrices
  contextuelles (ex. « Annuler la réservation ») restent près de leur
  contexte, dans la page.

À migrer vers cette convention : `RecipeCreatePage`, `RecipeEditPage`,
`CreateDocumentPage`, `EditDocumentPage` (les pages event tranchent par
surface : drill-in interne → back, sinon chrome d'onglets suffit).

## Formulaires d'édition

- **`dirty` en `$derived`** : signature JSON de l'état vs `baseline`
  d'ouverture — canon
  [LoanReturnForm.svelte](../svelte-app/src/lib/components/teamMatos/loan/LoanReturnForm.svelte).
  Jamais l'effet + recapture manuelle : l'effet ne re-court qu'aux
  changements de champs, une baseline recapturée après save y restait
  invisible et `dirty` restait à `true` (bug LoanForm corrigé — le guard
  demandait confirmation après un enregistrement réussi).
- La baseline initiale se capture **après le remplissage du formulaire**
  (ordre de déclaration des effets), et se recapture après un save sans
  changement de route ; le `$derived` rend ces recaptures fiables.
- **Save désactivé tant que `!dirty`** en édition :
  `disabled={!valid || busy || !dirty}` — canon
  [EventEditPage.svelte](../svelte-app/src/lib/routes/EventEditPage.svelte).
  En création, `valid` suffit (le formulaire vierge est invalide).
- **Guard sur toute surface d'édition** : `UnsavedChangesGuard` avec
  `shouldProtect` branché sur le `dirty` de l'onglet actif.

## Actions navbar

- Ordre : actions contextuelles/export à gauche, action primaire à droite.
- Spinner sur le primaire en cours (`loading loading-sm loading-spinner`).
- Libellés masqués en mobile (`hidden sm:inline`) mais **un bouton icône
  seule porte toujours `aria-label` + `title`**.
- Cibles tactiles : ≥ 24 px CSS (plancher WCAG 2.2 AA), 44 px visés,
  `gap-2` minimum entre cibles adjacentes.

## Responsive

- Le header mobile est à densité figée : tout nouveau geste entre par le
  contenu (bouton `PageBack` dans la rangée du titre, CTA dans la page),
  pas par la barre.
- Le dropdown contextuel central (onglets event, section matos) est un
  sélecteur de section, pas un geste de retour.

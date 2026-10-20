# Checklist click-through — SPA PocketBase (dev local)

> Une ligne = une action vérifiable à l'écran, à cocher sur place.
> Périmètre : parcours utilisateur et UI. Les règles d'API sont couvertes par le
> verdict du pipeline et les sondes HTTP — ne pas les re-tester ici.
> Reset 20-10 : toutes cases décochées ; les entrées décrivant des bugs corrigés
> depuis le run du 13-10 (et les prérequis Hugo, toolchain supprimée) ont été
> retirées — leur historique vit dans `.agents/plans/archive/`.

## 0. Prérequis

- [ ] Base dev réinitialisée par le pipeline : PB **arrêté**, puis
      `bun run scripts_dev/migrate.ts --pb-bin=pocketbase/pocketbase --pb-dir=pocketbase/pb_data --content-synced --yes`
      → verdict VERT (86/86).
- [ ] `bun run dev:all` → PocketBase 8090 (`/_/` accessible) + Vite 5173.
- [ ] IndexedDB `EnkaDB` supprimée (DevTools → Application → IndexedDB) :
      sinon fantômes de l'ancien dataset.
- [ ] Mot de passe posé via Admin UI pour le compte de test (l'import régénère
      des mots de passe aléatoires).
- [ ] SMTP non configuré en dev : aucun email ne part — les flux d'invitation
      se valident jusqu'au toast.

## 1. Public (non authentifié)

- [ ] `/` : home lisible, 0 erreur console.
- [ ] `/recipe` : liste publique, aucune recette en brouillon.
- [ ] `/recipe/:uuid` : détail complet — ingrédients, astuces en texte,
      préparation alternative.
- [ ] Recherche recettes (≥ 2 caractères) : résultats pertinents (fuzzysort 4),
      combinaison correcte avec le filtre `typeR`.
- [ ] Route privée en visiteur → tableau de bord, avec un feedback lisible :
      jamais page vide, jamais loading infini, jamais `effect_update_depth_exceeded`
      (vérifier `/event/:id`, `/recipe/:uuid/edit`, `/dashboard/*`, `/createdocument/*`).
- [ ] URL inconnue → page 404.

## 2. Auth & cache

- [ ] Login → atterrissage, events visibles immédiatement (sans reload).
- [ ] Logout → écran public, caches purgés.
- [ ] Login avec un 2e compte → aucune donnée du compte précédent.
- [ ] Visite non authentifiée puis login → aucun résidu IndexedDB.

## 3. Events

- [ ] `/dashboard/eventCreate` : création (teams, dates/repas, description,
      minContrib) → EventCard correcte après save.
- [ ] Créer 2 events successifs → pas de doublon.
- [ ] `/event/:id` : édition + save sans erreur console (`DataCloneError` =
      régression).
- [ ] Navigation entre les onglets d'un event (`recipes`, `products`,
      `materiel`, `posters`, `todos`, `documents`).
- [ ] Guard de navigation : modifier un champ puis changer de page → confirm
      demandé ; annuler en reste, puis sauver → pas de blocage fantôme
      (UnsavedChangesGuard, sv-router 0.19).
- [ ] `/eventList` : liste cohérente avec le dashboard.
- [ ] Suppression d'event : **pas d'UI** — ne pas compter comme régression
      (feature à évaluer).

## 4. Recettes (privé)

- [ ] `/recipe/my` : mes recettes ; `/recipe/my/draft` : brouillons seulement.
- [ ] Réglages des repas d'un event (`EventMealCard`) : compteur de parts
      modifiable, icônes lucide rendues (pas de trou ni décalage).
- [ ] Création `/recipe/new` : statut par défaut, id PB natif (le slug lisible
      est une idée produit, pas un bug).
- [ ] Édition `/recipe/:uuid/edit` : `permissionWrite` via PermissionsManager,
      save ne purge pas `publishedAt`.
- [ ] Duplication `/recipe/:uuid/duplicate`.
- [ ] Ajout d'ingrédient : autocomplete, création si absent, surlignage du match.
- [ ] Rendu markdown des instructions (svelte-markdown 2).
- [ ] Suppression d'une recette.

## 5. Products / purchases

- [ ] `/event/:id/products` : liste rendue, 0 erreur console.
- [ ] Création produit : `updatedBy` posé ; `store`/`specs` éditables et
      re-rendus.
- [ ] Édition d'un produit existant (upsert) : pas de « record not found in
      Dexie ».
- [ ] Validation rapide d'achat (crée le produit s'il n'existe pas).
- [ ] Création d'achat : `orderDate`/`deliveryDate` préremplies.
- [ ] Édition + suppression produit/achat.
- [ ] Recherche produits (nom, et titres de recettes quand l'option est active) :
      résultats pertinents.
- [ ] Calcul des besoins par date range.

## 6. Materiel & loans

- [ ] `/dashboard/materiel` : création et édition de materiel (équipe).
- [ ] Suppression de materiel : autorisée pour un membre de l'équipe.
- [ ] `/dashboard/loans` : création d'un loan sans event → aucun avertissement
      de disponibilité infondé.
- [ ] Loan lié à un event : synchronisation `event_materiel`, pas de 400, page
      `loans/<id>` affichée.
- [ ] `/dashboard/loans/return/:loanId` : retour de prêt complet.
- [ ] `/event/:id/materiel` : allocations, réattachement d'un groupe à un autre.
- [ ] Changement d'équipe : l'affichage se rétablit sans reload manuel.

## 7. Todos d'event

- [ ] `/event/:id/todos` : création de tâches, groupement par `taskOn`,
      assignation à un contributeur.
- [ ] Modification et suppression d'une tâche ; persistance après reload
      (stockage `events.todos`).
- [ ] Un contributeur invité voit et édite selon ses droits.

## 8. Documents & teamdocs

- [ ] `/createdocument/:teamId/new`, puis édition et lecture
      (`/documents/:teamId`).
- [ ] Teamdoc sans `eventId` : liste et édition OK (pas d'UI de suppression —
      feature à évaluer).
- [ ] Création d'un doc depuis un event par son créateur → succès, pas de 400.
- [ ] Doc créé par A : visible et éditable par B s'il a les droits team/event.
- [ ] Realtime document : A édite, B reste sur `editdocument/<id>` → mise à
      jour visible sans quitter la page ; pas d'écrasement silencieux.
- [ ] Bloc « documents liés par tag » sur les 4 pages event
      (materiel / produit / recette / tache).
- [ ] Drawer de lecture : ouverture, fermeture au clic extérieur et à Échap,
      scroll interne (svelte-drawer 2).

## 9. Posters

- [ ] `/event/:id/posters` : configuration (recettes, textes) appliquée au
      poster.
- [ ] Rendu imprimable : navigation et chrome masqués (`print:hidden`).

## 10. Invitations & partage

- [ ] Share link event : création depuis l'UI → ouverture du lien → l'event
      apparaît.
- [ ] Email d'invitation : toast `ok:false` attendu sans SMTP, invitation
      malgré tout posée.
- [ ] Invitation team (`invite-to-team`) : membre existant ajouté, roles
      préservés (TeamsManagement) ; côté invité, vérifier le feedback — l'event
      s'affiche aujourd'hui sans rien indiquer de sa participation.
- [ ] Flux invité sans compte : `/join/:linkId` → demande de connexion ou de
      création de compte → redirection vers l'event.

## 11. Locks & temps réel

- [ ] Même recette ouverte dans 2 navigateurs : badge de lock + `userName` ;
      expiration respectée ; reprise possible après release.
- [ ] SSE : modification dans A visible dans B sans reload (event, recette,
      produit, teamdoc). **À rejouer sur SDK pocketbase 0.28** (les deux items
      SSE de cette section).
- [ ] Coupure de `dev:pb` → StatusBar « connexion perdue » (~3 s) ; relance →
      « connecté » + resync silencieux.
- [ ] Onglet caché puis rouvert → resync sans flash de loading.

## 12. PWA / build (à la release)

- [ ] `bun run build` → 0 erreur.
- [ ] `version.json` bumpé (≤ 3 entrées) → modal de mise à jour du SW au reload.
- [ ] Au premier déploiement (1.8) : `sw.js` servi sans cache long.

## Non-bugs — ne pas compter comme régressions

- Events dupliqués (6 noms, 9 copies) : **dans la source Appwrite**, backloggé.
- `event_todos` et `notifications` : collections dormantes ; les todos de l'UI
  vivent dans `events.todos`.
- Checkbox « Envoyer un email de notification aux membres des équipes »
  (`EventCreatePage`) : sans effet assumé (commentaire dans le code).
- Ids PocketBase au lieu de slugs lisibles : état actuel, pas un bug.
- « 19 catégories » vs 60 rows : 19 `category` + 41 `equipment_tag`.
- og:image des recettes : cassé, backloggé.

## Problèmes constatés (à remplir pendant la passe)

Format : page / action / attendu vs obtenu / console (coller l'erreur exacte).

## Idées produit (hors gate, à ticketiser)

1. Après authentification, rediriger vers le dashboard plutôt que de rester sur
   la home.
2. Générer le share link à la création de l'event, pour qu'il existe toujours.
3. `EventMealCard` : auto-focus du champ `recipe.plates`, Entrée valide,
   Échap annule.
4. Permissions de recette : pouvoir lier une recette à un event à venir pour
   que ses participants obtiennent l'écriture.
5. `loans/<id>` : envisager une page dédiée plutôt qu'un modal.
6. Recettes : reprendre la logique de slug lisible pour les ids/URLs.

> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: bug · Urgence: soon · Source: tests composants teams (lot 6, commit `4e8c4137`) · Ancre: `svelte-app/src/lib/components/teams/TeamMembersList.svelte:152` (`isCurrentUser = member.id === currentUserId`)

# TeamMembersList : le membre courant n'est jamais reconnu (« (vous) », Quitter, crayon sur soi)

**Constat** — `TeamMembersList` détermine le membre courant par
`member.id === globalState.userId` (l.152), or `member.id` est l'id du record
PB de l'adhésion, pas l'id utilisateur — la comparaison correcte est
`member.userId === currentUserId` (comme dans `leaveTeam` l.74 et
`TeamCard.svelte` l.45). Conséquences, toutes mesurées en jsdom (suite
`TeamMembersList.test`, tests « BUG épinglé ») :

- le marqueur « (vous) » ne s'affiche jamais ;
- le bouton « Quitter l'équipe » (l.228, gardé par `isCurrentUser`) n'est
  **jamais rendu** : le flux confirm + `removeMember` de ce composant est
  inatteignable — un membre ne peut quitter son équipe que via `TeamCard`
  (dont la comparaison est correcte) ;
- le crayon « Gérer ce membre » s'affiche aussi sur sa propre ligne pour un
  owner (garde `canManageMembers && !isCurrentUser` contournée).

**Impact** — cosmétique pour « (vous) », fonctionnel pour le reste : le
chemin de désinscription de la liste est mort (doublon défaillant de
TeamCard) et un owner peut ouvrir la modale de gestion sur lui-même.

**Reco** — corriger la comparaison en `member.userId === currentUserId`
(l.152), puis retourner les tests « BUG épinglé » de `TeamMembersList.test`
vers le contrat nominal : « (vous) » affiché, bouton Quitter rendu pour un
membre non-owner (confirm → `removeMember` → `onMemberRemoved`), crayon
absent sur sa propre ligne — les deux flux (confirm, garde dernier admin)
sont déjà écrits en commentaire du contrat et prêts à réactiver.

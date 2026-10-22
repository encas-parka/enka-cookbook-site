# ADR 0002 — Le RSVP porte l'accès côté client, les règles serveur restent volontairement grossières

Date : 2026-10-22 · Statut : accepté

## Contexte

Héritage Appwrite : l'invitation d'emails extérieurs vivait dans un champ de
tracking `guestEmails[]` (transposé en json PocketBase à l'import), sans
chemin d'entrée pour l'invité — le champ servait de liste d'adresses
pré-enregistrées que rien ne consommait. Le durcissement des règles
([1791278800](../../pocketbase/pb_migrations/1791278800_rules_api_hardening.js))
avait déjà enterré le champ : aucune règle ne le lisait.

Le lot Participation RSVP a refondé le modèle d'invitation :

- l'accès serveur invité passe par la relation `guestUsers`, seule forme
  traversable par le moteur de règles PB (json non traversable) — les règles
  events list/view/update filtrent dessus ;
- l'état RSVP (invité / accepté / refusé, horodaté) vit dans le json
  `contributors` — le registre des participants, lu par l'UI, jamais par le
  serveur ;
- le hook
  [join-event.pb.js](../../pocketbase/pb_hooks/join-event.pb.js) pose
  l'entrée au registre en statut `invited` et rattache l'identifiant
  temporaire (nanoid) au vrai userId au premier join par lien de partage ;
- le client (inviter) et le hook n'écrivent plus `guestEmails` — le champ
  est supprimé du schéma par migration
  ([1792600000](../../pocketbase/pb_migrations/1792600000_events_drop_guest_emails.js)).

## Décision

Le RSVP porte l'accès côté client. Le serveur n'évalue pas l'invitation : il
expose deux canaux bruts que l'éditeur écrit en bloc — `guestUsers`
(visibilité individuelle) et `teams` (grant équipe) — et les règles events
restent la disjonction grossière `teams.members ~` / `guestUsers ~` /
`createdBy =`. Le dérivé « invité » (membre d'une équipe entière cochée, non
individualisé) est calculé côté UI à la lecture, jamais persisté ; la règle
des équipes entières reste le grant vivant — la règle serveur voit
`teams.members`, elle ne rejoue pas la logique d'invitation fine. Un email
extérieur devient participant par le lien de partage (le registre porte la
confirmation), pas par pré-enregistrement d'adresse : le champ de tracking
est supprimé, pas remplacé.

## Alternatives rejetées

- **Règles serveur fines sur `contributors`** — json non traversable par le
  moteur de règles : structurellement impossible, pas une option de design.
- **Table d'invitations dédiée, évaluée par les règles** — dupliquer une
  source de vérité que seule l'UI lit ; l'état existe déjà dans
  `contributors` et le lot n'a aucun besoin serveur au-delà de la
  visibilité.
- **Conserver `guestEmails` comme liste canonique d'invités** — un champ
  écrit sans lecteur promet une sémantique que rien ne maintient ; le
  registre `contributors` porte déjà les emails des invités réels.
- **Hook matérialisant `guestUsers` depuis les équipes cochées** — ferait
  doublon du grant vivant `teams.members ~` et imposerait une
  réconciliation à chaque changement de composition d'équipe.

## Conséquences

- Les règles ne séparent pas « qui pose les grants » de « qui confirme son
  RSVP » : un invité passe la même updateRule que l'éditeur et écrit le
  record entier. Modèle de confiance assumé — le client est le seul
  arbitre des champs de grant, le serveur les livre en bloc.
- Le statut « invité » des membres d'équipes entières est dérivé donc
  volatil : l'ajout d'un membre à une équipe cochée le rend visible sans
  aucune écriture d'event.
- Un email hors compte n'a aucune existence serveur avant le join par lien :
  ni visibilité, ni action — l'invitation s'arrête au registre côté
  éditeur.
- Une invitation fine côté serveur (réservation d'adresse, RSVP par email
  sans lien) demandera un nouvel ADR : le champ supprimé n'est pas
  réintroduit.

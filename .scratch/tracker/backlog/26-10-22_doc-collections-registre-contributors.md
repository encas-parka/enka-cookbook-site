# Doc de collections : le registre des participants n'y figure pas

> Backlog — open while this file exists. Delete when implemented or rejected (git history is the archive).

Tag: doc · Urgence: light · Source: review ticket 04 (lot 26-10-22_participation-rsvp) · Ancre: docs/pocketbase_collections.md

Le registre des participants (json `events.contributors` — source de vérité
de l'état de participation, jamais lu par le serveur, cf. ADR 0002) n'a
aucune mention dans la doc de collections : ni dans le tableau d'ensemble,
ni dans les « Points surprenants ». Le doc décrit le couplage schéma /
règles / app mais passe à côté du canal json central du flux RSVP (seul
`guestUsers` y transparaît via « membres/guests »). Préexistant au lot — le
champ y était déjà absent avant les tickets 01-04.

Reco : une entrée sur le modèle participants, comme il en existe une pour
« Le flux `ingredients.ref` » — registre (contributors) vs visibilité
(guestUsers) vs grant équipe (teams), et l'invariant « le registre ne porte
jamais la visibilité » (CONTEXT.md).

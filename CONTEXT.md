# ENKA-COOKBOOK

Application collaborative d'organisation d'événements culinaires (menus, repas, matériel, tâches) pour des équipes de cuisiniers. Ce glossaire fixe le vocabulaire du domaine participation & accès aux événements, et du matériel & emprunts.

## Participation

**Invitation**:
Demande adressée à une personne de participer à un événement, en attente de sa réponse. Un invité voit l'événement mais ne peut pas l'éditer. Une invitation envoyée est irrévocable : l'email qui l'accompagne contient le lien de partage, qui reste valable — seule la régénération du lien en coupe les futurs usages.
_Avoid_: demande de participation, pré-invitation, désinvitation

**RSVP**:
La réponse d'un invité à une invitation : accepter ou décliner. Le RSVP crée ou met à jour l'entrée de la personne dans le registre des participants.

**Participant confirmé**:
Personne ayant répondu « j'accepte » à une invitation. Avec le créateur, c'est la seule catégorie autorisée à éditer l'événement.
_Avoid_: membre, contributeur

**Décliné**:
Personne ayant répondu « je décline ». Conserve la visibilité de l'événement, sans édition ; peut changer d'avis et redevenir participant confirmé.

**Invitation virtuelle**:
Statut d'invité dérivé sans écriture : une personne rendue visible sur l'événement (par une équipe invitée ou par ajout individuel) qui n'a pas encore de RSVP enregistré. Sa réponse matérialise l'invitation dans le registre.
_Avoid_: fantôme, implicite

**Registre des participants**:
Liste individuelle des invitations et des RSVP portées par un événement. Source de vérité de l'état de participation ; ne porte jamais la visibilité.
_Avoid_: contributors (nom de champ), liste des gens

**Éditeur**:
Personne autorisée à modifier un événement : le créateur, et les participants confirmés. L'invitation et la gestion du partage sont des pouvoirs d'éditeur.

## Accès & partage

**Visibilité**:
Droit de voir un événement (dashboard, pages). Portée exclusivement par les canaux que les règles serveur savent lire : équipes invitées, invités individuels pourvus d'un compte, créateur.

**Équipe invitée**:
Équipe rattachée à un événement. Accorde la visibilité à tous ses membres, présents et futurs ; ne porte pas de RSVP individuel — chaque membre est invité à titre personnel en visitant l'événement.

**Lien de partage**:
Lien multi-usages permettant de rejoindre un événement ; actif jusqu'à désactivation. Arriver par le lien vaut réception d'une invitation (statut invité), pas une confirmation. Chaque événement en possède un, créé avec lui.

**Régénération**:
Désactivation du lien de partage précédent et création d'un nouveau — remède au cas de lien divulgué.

**Curieux** (informel):
Un invité qui consulte l'événement sans avoir confirmé sa participation. La distinction curieux / participant justifie la lecture seule avant RSVP.

## Matériel & emprunts

**Emprunt**:
Réservation de matériel appartenant à une équipe, pour une période (dates début/fin), portant une liste d'items {matériel, quantité}. L'UI emploie « réservation » pour le même objet.
_Avoid_: prêt (réservé au sens inverse : prêter SON matériel)

**Disponibilité sur période**:
Quantité réservable d'un matériel sur les dates d'un emprunt : stock possédé en état de servir — hors exemplaires en réparation — moins les quantités portées par les emprunts qui chevauchent la période. Seule notion de disponibilité exposée à l'utilisateur d'un emprunt — la disponibilité globale du stock n'a pas de sens dans ce flux.
_Avoid_: dispo globale (hors période), stock libre

**Sélection**:
Quantités demandées par matériel dans un emprunt en cours de saisie ; quantité 0 = non emprunté (état par défaut). Les conflits de disponibilité se jugent sur la sélection au moment de la soumission.

**Matériel fantôme**:
Item d'un emprunt dont le matériel a disparu de l'inventaire. L'emprunt conserve le snapshot de son nom et sa quantité ; il reste visible et identifiable sur l'emprunt, jamais proposable à une nouvelle réservation.
_Avoid_: item supprimé, matériel orphelin

**Retour**:
Déclaration de l'état du matériel rendu, item par item et en quantités — rendu, à réparer, manquant — complétée de notes de retour. Peut être anticipé (avant la date de fin) après confirmation ; enregistré, il clôt l'emprunt (statut « completed »).
_Avoid_: annulation (le retour n'annule pas la réservation), restitution

**Manquant**:
Exemplaire d'un matériel déclaré non revenu au retour, quelle que soit la cause — perdu, ou cassé puis jeté. Au niveau du stock, un manquant n'existe plus : sa disparition est définitive et diminue le stock ; l'emprunt qui l'a déclaré en conserve la trace.
_Avoid_: perdu, disparu

**Mouvement de stock**:
Variation datée, quantifiée et causée du stock d'un matériel : achat, perte, remise en service, réforme, correction. Le journal des mouvements est la source de vérité des variations ; les quantités d'un matériel en sont des projections. Un manquant n'est pas un état du matériel : c'est un mouvement.
_Avoid_: historique (pour la donnée), delta

**Remise en service**:
Geste qui fait revenir au stock en état de servir des exemplaires sortis pour réparation.
_Avoid_: réparé (le résultat, pas le geste)

**Réforme**:
Geste qui déclare des exemplaires définitivement hors service, typiquement jugés irréparables : ils quittent le stock et deviennent manquants.
_Avoid_: mise au rebut, destruction

**Rebut**:
Item dont la quantité est 0 : il reste visible dans l'inventaire et éditable, mais n'est plus empruntable — un état, pas un geste (la réforme est le geste).
_Avoid_: hors service, HS

**Stock épuisé**:
État d'affichage dérivé d'un matériel sans unité utilisable côté stock : quantité 0 (rebut) ou inconnue (lecture conservatrice) — à distinguer de « emprunté »/« réservé » (activité) et de « en réparation » (stock en réparation).
_Avoid_: rupture, stock mort

**Fiche de retour**:
L'export Markdown de l'état de retour, reflétant la saisie en cours (déclarations non encore enregistrées) autant que l'état persisté.
_Avoid_: bon de retour, inventaire de retour

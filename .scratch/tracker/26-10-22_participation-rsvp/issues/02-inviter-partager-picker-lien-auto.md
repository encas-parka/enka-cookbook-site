# 02: Inviter & partager — picker dégroupé, lien auto, email assumé

**What to build:** Tout nouvel événement naît avec son lien de partage (service partagé get-or-create) ; la section lien devient lecture seule (copier) avec Régénérer derrière ConfirmModal d'avertissement ; le tout réservé aux éditeurs. La modal d'invitation dégroupé : membres des équipes cochables individuellement, tout cocher/décocher, en-tête explicatif, déjà invités verrouillés (cochés-disabled + hint générique), ConfirmModal avant validation. Les écritures suivent la règle actée : personnes connues → visibilité individuelle + registre (invité) ; inconnus → registre avec identifiant temporaire ; le canal équipe n'est écrit que si tous les membres sont cochés ; plus aucune écriture du champ de tracking emails côté client.

**Blocked by:** 01 (modèle RSVP : registre, dérivation de statut pour l'affichage des déjà invités).

**Status:** done

- [x] Un event créé possède d'emblée son lien ; le bouton « Nouveau lien » a disparu ; Régénérer demande confirmation puis désactive l'ancien
- [x] Invitation et section lien invisibles ou inopérantes pour un non-éditeur
- [x] Cocher une équipe entière écrit le grant équipe (futurs membres hériteront) ; cochage partiel → individus seulement
- [x] Déjà invités : cochés-disabled avec hint générique (« accès actif »), quel que soit leur canal d'invitation
- [x] Le ConfirmModal (« un email avec le lien sera envoyé ») précède toute validation
- [x] Tests harness : règle équipe entière vs partiel, visibilité individuelle des connus, registre des inconnus, aucune écriture du champ de tracking

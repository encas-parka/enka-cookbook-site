# 03: Hooks — le lien invite, l'email part groupé

**What to build:** Rejoindre un événement par un lien de partage pose désormais le statut invité (et non confirmé) : la personne atterrit avec le bandeau et confirme sa participation dessus. Le hook de join n'écrit plus le champ de tracking emails. L'envoi d'emails d'invitation est regroupé : une seule expédition par événement, tous les destinataires en copie cachée (le wrapper mailer gagne le support BCC), contenu toujours relu côté serveur. La copy de la page de join est ajustée (« confirmez votre participation »).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Join via lien → entrée au registre en statut invité ; le bandeau propose de confirmer ; rejoin idempotent (dédoublonnage email, statut préservé)
- [x] Aucune écriture du champ de tracking emails au join
- [x] Une seule expédition SMTP par événement, destinataires en BCC (visible en dev stdout), réponse par destinataire inchangée
- [x] Sonde HTTP contre le PB de dev verte (statut invité, useCount, dédoublonnage, BCC) + items click-through listés

Sonde : `scripts_dev/probe-rsvp-join.mjs` — 14/14 PASS contre le PB de dev
(comptes dev, base jetable, config SMTP restaurée en fin de run). Récepteur
SMTP : `scripts_dev/smtp-sink.mjs` (dump enveloppe + en-têtes exposants).
Preuves : sink = 1 expédition, enveloppe `probe@enka.local` + 3 BCC,
en-tête To = expéditeur seul, pas d'en-tête Cc/Bcc ; stdout PB = une seule
ligne « Email envoye a … (bcc) » pour 3 destinataires.
Log tests : `/tmp/opencode/tests-rsvp-ticket03.log` (347/347).

Items click-through (passe humaine) :

1. Join par lien, user connecté : atterrit sur l'event, bandeau « Invitation à
   participer » avec Accepter/Refuser ; le registre liste l'entrée en « invité »
   ; édition verrouillée tant qu'il n'a pas accepté.
2. Accepter depuis le bandeau → participant confirmé, édition déverrouillée sur
   toutes les sous-pages.
3. Re-jointure par le même lien : aucun doublon au registre, bandeau inchangé,
   useCount stable (visible en Admin UI).
4. Invitation à plusieurs emails : un seul email reçu (sink Mailpit ou
   `scripts_dev/smtp-sink.mjs`), toutes les adresses en BCC, contenu relu
   (nom/description/dates réels de l'event).
5. Page de join, écran de succès : « Confirmez votre participation depuis le
   bandeau d'invitation. »
6. Join d'un user sans compte (AuthModal) → après login, le join reprend et
   aboutit au même état invité.
7. Desktop, pages à LeftPanel fixe : moitié gauche du bandeau sous le panneau
   (connu ticket 01) — les boutons Accepter/Refuser restent atteignables.

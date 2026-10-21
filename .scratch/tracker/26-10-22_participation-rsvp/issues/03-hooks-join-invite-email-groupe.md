# 03: Hooks — le lien invite, l'email part groupé

**What to build:** Rejoindre un événement par un lien de partage pose désormais le statut invité (et non confirmé) : la personne atterrit avec le bandeau et confirme sa participation dessus. Le hook de join n'écrit plus le champ de tracking emails. L'envoi d'emails d'invitation est regroupé : une seule expédition par événement, tous les destinataires en copie cachée (le wrapper mailer gagne le support BCC), contenu toujours relu côté serveur. La copy de la page de join est ajustée (« confirmez votre participation »).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Join via lien → entrée au registre en statut invité ; le bandeau propose de confirmer ; rejoin idempotent (dédoublonnage email, statut préservé)
- [ ] Aucune écriture du champ de tracking emails au join
- [ ] Une seule expédition SMTP par événement, destinataires en BCC (visible en dev stdout), réponse par destinataire inchangée
- [ ] Sonde HTTP contre le PB de dev verte (statut invité, useCount, dédoublonnage, BCC) + items click-through listés

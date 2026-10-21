# 01: Modèle RSVP — invitation virtuelle, upsert, édition sur confirm

**What to build:** Un membre d'une équipe invitée (ou toute personne rendue visible sans entrée au registre) voit le bandeau d'invitation sur la page racine de l'événement et peut Accepter ou Refuser ; sa réponse crée son entrée au registre des participants (upsert). Seuls le créateur et les participants confirmés édittent. Le bandeau migre dans un layout partagé de la branche événement du routeur — présent sur toutes les sous-pages — et les six pages event passent au point de passage unique d'édition.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Un membre d'une équipe invitée voit le bandeau sur la racine ET sur chaque sous-page event (layout partagé)
- [x] Accepter crée une entrée `accepted` au registre (upsert sans entrée préalable) et déverrouille l'édition sur toutes les pages
- [x] Refuser crée une entrée `declined` (lecture seule) ; le retour se fait via « je participe »
- [x] Édition : créateur ✓, participant confirmé ✓, invité (virtuel ou réel) ✗, décliné ✗ — un seul point de passage store, les six pages l'utilisent
- [x] Le bandeau gère son propre état d'occupation (découplé de celui des pages) et propose Accepter + Refuser
- [x] Tests harness verts : statut virtuel dérivé, upsert RSVP, sémantique d'édition ; `bun run check` vert

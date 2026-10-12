# 10: Durcissement double-création d'event (diag + garde conditionnelle)

**What to build:** la création de deux events successifs ne duplique jamais un
event, même sur connexion fragile. L'exposition réelle du bug historique
offline-first est tranchée par l'investigation du code, pas par un test click-through
non décisif.

**Evidence:** cf. `.scratch/tracker/clickthrough-checklist.md` §3 : « le test n'est
pas décisif [connexion instable pendant le test]. Investiguer le code et vérifier
si possibilité/nécessité de renforcer ». (Les events dupliqués dans la source sont
un non-bug connu, hors périmètre.)

**Blocked by:** 06 (même zone d'écriture — store events — écrivain unique).

**Status:** ready-for-agent

- [ ] Investigation du chemin de création : exposition confirmée ou écartée,
      décision documentée dans le ticket.
- [ ] Si exposé : garde d'idempotence/dedup côté client posée + test vitest vert.
- [ ] Si non exposé : conclusion consignée, aucun changement de code (ticket
      résolu par l'analyse).

# 05: UI retour — vocabulaire « manquant » et scénarios de bout en bout

**What to build:** la zone retour/emprunt adopte le vocabulaire du glossaire
(« manquant » remplace « perdu » dans la fiche de retour et la carte
d'emprunt, sans toucher au payload), puis valide dans l'app réelle les
scénarios de bout en bout de la définition de fini : retour partiel avec
casse, retour avec manquants, perte totale d'un petit emprunt dans un grand
stock, remise en service après réparation.

Références : spec (§ User Stories 1-4, 14, 16 ; § Further Notes, définition de fini) · glossaire CONTEXT.md (manquant, retour).
Zone : `svelte-app/src/lib/components/teamMatos/loan/LoanReturnForm.svelte`, `LoanCard.svelte` (badge local « tout perdu/cassé » à relabeliser). Le sélecteur d'emprunt (`LoanForm`, `LoanMaterielList`, `QuickMaterielSelectionModal`) ne doit PAS être modifié : il consomme les valeurs calculées par le store.

**Blocked by:** 03 (retour et gestes), 04 (gestes accessibles dans l'UI).

**Status:** ready-for-agent

- [ ] Fiche de retour : « Manquant / Manquants » partout (libellés, aria, aide), jamais « perdu » ; trio exclusif À réparer / Manquant / Ok intact ; bornage des saisies inchangé
- [ ] Carte d'emprunt : badge relabelisé sans « perdu »
- [ ] Payload du retour strictement inchangé (mêmes champs, mêmes noms) — aucun changement de contrat
- [ ] Click-through scénario 1 : 2 cassés sur 12 (6 empruntés) → 10 empruntables au sélecteur
- [ ] Click-through scénario 2 : 2 manquants sur 12 → stock 10 annoncé partout
- [ ] Click-through scénario 3 : 3 manquants sur un emprunt de 3, stock 50 → 47 empruntables
- [ ] Click-through scénario 4 : remise en service des 2 cassés → retour à la pleine disponibilité
- [ ] Comptes dev : voir AGENTS.md (`bun run dev:pb` + `bun run dev`, comptes ghald/marionael)

## Comments

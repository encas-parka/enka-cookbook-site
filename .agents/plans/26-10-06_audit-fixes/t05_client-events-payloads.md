# T5 — Client events : payloads de création/édition conformes au schéma (A1, B5, C7, C1)

**Sources** : schema-client §4 (A1, B5), §1 (C1, C5, C7), §5 (écritures dates) · rules-hooks (UI-2)
**Prérequis** : T3 (events.description/minContrib existent au schéma)

## Objectif

Faire passer les flux create/update d'event : la relation `teams` reçoit des **ids** (plus des noms), plus aucun champ fantôme dans les payloads, dates vides envoyées en `null`.

## Constats → fixes

- **A1** : `routes/EventCreatePage.svelte:185-186` envoie `teams: teamNames` (noms) et `teamsId: selectedTeams` (champ inexistant). `stores/EventsStore.svelte.ts:523-536` (`createEventWithTeams`) re-transmet tels quels `teams`, `teamsId`, `description`, `allDates`. → `teams: selectedTeams` (ids), supprimer `teamsId`, garder `description` (valide depuis T3), **supprimer `allDates`** (pas de champ — l'affichage dérive du JSON `date`, vérifier les lecteurs).
- **B5** : `#serializeUpdateData` (`EventsStore.svelte.ts:470-499`) envoie `allDates` (L476), `teamsId` (L479) — retirer ; `description`/`minContrib` valides (T3) — garder. `routes/EventEditPage.svelte:550-567` alimente description/minContrib/allDates — rebrancher allDates ou le retirer de la serialization (décider selon l'usage réel des lecteurs, documenter).
- **C7** : `EventCreatePage.svelte:180-184` : `dateStart/dateEnd = ""` → envoyer `null` (undefined/date réelle).
- **C1 (fast-win)** : retirer `Main.joinToken` de `types/pb.d.ts:83` (champ supprimé du schéma).
- **C5** : NE PAS traiter (différé produit — 3e argument `sendEmailToExistingMembers` ignoré, cf. run.md deferred).
- Vérifié en T4 : le client envoie bien `createdBy` à la création (EventsStore L523-533) — ne pas retoucher.

## Méthode suggérée

1. Grep les lecteurs de `allDates`/`teamsId` avant de retirer (composants UI qui les consommeraient côté client — les convertir au JSON `date` si besoin, sans sur-ingénierie).
2. Simuler curl les payloads EXACTS post-fix (create avec teams ids + description + minContrib + dateStart null ; update avec description/minContrib) contre la dev DB → 200 attendus. (Sondes = preuve du contrat payload↔schéma.)
3. `bun run check` au canon (0 erreur / 6 warnings).

## Critères

- [ ] Create event avec team sélectionnée : payload = ids + champs valides (sonde curl 200 loggée dans run.md)
- [ ] Update/auto-save : plus d'`allDates`/`teamsId` dans le serializer (grep vert) ; lecteurs allDates convertis ou confirmés inexistants
- [ ] Dates vides → `null`
- [ ] `Main.joinToken` retiré du type
- [ ] `bun run check` au canon ; run.md amendé (journal T5)

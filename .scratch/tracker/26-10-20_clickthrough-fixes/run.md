# Run report — fixes click-through (lot B + P12 court terme)

> Date : 20-10. Périmètre acté en session : P9, P12 court terme, lot B
> (P3/P7/P10/P11/P13/P1/P4). **Hors périmètre, reportés** : P14 (migration
> locks — décision du user, plus robuste que le fix minimal), P5 (différé),
> audit delta-sync (ticket research créé).

## Livré

| Bug | Fix | Fichiers |
| --- | --- | --- |
| P9 — crash autocomplete prêts | clé each composée `libellé-index` (1 ligne, 5 usages couverts) | `components/ui/AutocompleteInput.svelte` |
| P12 — teamdocs invisibles après join | primitive `resetCursor(scopeKey?)` sur `createSyncCollection` + `TeamdocsStore.resetCursorAndSync()` appelé par JoinPage après redeem ; test TDD `pb-sync-reset-cursor.test.ts` | `db-sync/pb-collection.ts`, `stores/TeamdocsStore.svelte.ts`, `routes/JoinPage.svelte`, `stores/__tests__/pb-sync-reset-cursor.test.ts` |
| P3 — bannière « email non vérifié » pour tous | `record.verified` (champ PB) au lieu d'`emailVerification` (champ Appwrite, toujours undefined) | `services/pb-auth.ts` |
| P7 — minContrib non persisté à la création | `minContrib` ajouté à `eventData` (la sérialisation EventsStore l.513 le gère déjà) | `routes/EventCreatePage.svelte` |
| P13 — échec d'emails d'invitation muet | toast warning sur échec partiel, error sur échec réseau (homogène NativeTeamsStore) ; toastService importé dans EventsStore | `stores/EventsStore.svelte.ts` |
| P4 — ids d'équipes bruts | `NativeTeamsStore.teamNames()` (fallback id brut) + 2 usages EventCard, 2 usages PermissionsManager | `stores/NativeTeamsStore.svelte.ts`, `components/dashboard/EventCard.svelte`, `components/PermissionsManager.svelte` |
| P10 — « Importer depuis » sans effet (≥ 2 équipes) | bouton d'état vide : picker équipe (dropdown) quand plusieurs, appel direct quand une seule — miroir de la navbar | `routes/EventMaterielPage.svelte` |
| P11 — « Modifié Hier » à l'instant | `Math.floor` au lieu de `Math.ceil` (commenté) | `utils/date-helpers.ts` |
| P1 — bloc alternatives jamais rendu | `RecipeAlternatives` monté (import existant absent), `prepAlt` mappé vers `Alternative[]`, `recipesIndexMap` réutilisé | `routes/RecipeDetailPage.svelte` |
| P14 — verrou de recette orphelin | migration du verrou vers la collection `locks` (`locksService`, resourceId `recipe_<uuid>`) : TTL `expiresAt` 7 min, heartbeat 4 min + refresh au retour d'onglet, takeover de l'expiré, reprise réactive au release SSE, releases idempotents (save + onDestroy), nom du détenteur affiché ; Smart Lock conservé. `recipes.lockedBy` mort — plus aucune lecture/écriture applicative (retrait schéma/types au cutover) ; contrat du socle piné par `services/__tests__/pb-locks.test.ts` | `routes/RecipeEditPage.svelte`, `routes/RecipeEditPage.ts`, `routes/RecipeCreatePage.svelte`, `routes/RecipeDetailPage.svelte`, `stores/RecipesStore.svelte.ts`, `utils/recipeUtils.ts`, `types/recipes.types.ts`, `services/__tests__/pb-locks.test.ts` |

## Vérifications

- Tests ciblés : `pb-sync-reset-cursor` + `pb-sync-scoped-cursor` 11/11 ;
  `date-helpers` 6/6 (aucune assertion ne pinait le `ceil`) ; `pb-locks`
  9/9 (contrat du socle de verrou — vague 2).
- `bun run check` : 0 erreur, 2 warnings a11y préexistants (pattern dropdown
  sans `role="button"` — mon ajout a le role, n'en ajoute pas).
- Suite complète : **263/263 (38 fichiers)** après P14 — log
  `/tmp/opencode/tests-full-suite.log`.

## Restes tracés (pour le handoff)

0. **Correctifs du premier test écran P14 (ghald)** : borne id `locks` 40→255
   (migration LOCK-3, PB à relancer), souscription lock découplée de la
   lecture initiale (autocancel), contrat `acquireLock` (false = refus,
   lève = panne), résolution des noms de contributeurs du panneau
   permissions (`resolveUserNames` dans pb-users, viewRule users).
1. **Audit delta-sync** : ticket research
   `26-10-20_delta-sync-audit/issues/01-audit-delta-vs-full-fetch.md`.
2. **Trou join-team symétrique (P12)** : pas de point d'entrée client unique
   (l'invitation team ajoute côté serveur, l'invité découvre en sync) —
   la détection « nouvelle team → resetCursor materiel/teamdocs » est une
   piste, laissée à l'audit (mentionné dans le ticket).
3. **P5 — 404 persistant** : différé, non élucidé statiquement (sv-router 0.19
   sans keep-alive ; symptôme contredit le mécanisme) — rejouage runtime avec
   inspection DOM requis.
4. **Retrait définitif de `recipes.lockedBy`** : le champ reste dans le
   schéma PB, `Recettes` (pb.d.ts), `pb-generated.ts` et l'index Dexie
   (versions historiques intouchables) jusqu'au cutover — plus aucune
   lecture/écriture applicative.
5. **Gate T12** : la checklist click-through (45/23) est à rejouer — les
   fixes des deux vagues touchent des parcours couverts (§3 création event,
   §4 détail recette, §6 materiel, §10 invitations, §2 bannière email,
   §P14 édition recette avec deux comptes).

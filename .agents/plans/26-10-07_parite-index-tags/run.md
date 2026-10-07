# Run — parité : indexes PB + restauration « documents liés par tag »

**Mode** : mini-run persistant (2 tickets, SÉQUENTIELS — même domaine PB : chaîne de migrations + boots de vérification).
**Autorisation** : utilisateur, 07-10 — (1) « l'index PB updated me semble devoir être ajouté (comme tout index pertinent étant donnée la façon dont sont requêté les données) » ; (2) « la suppression "documents liés par tag" est une regression feature […] Les modifications du schema nécessaires sont à effectué le cas écheant ».

## Faits établis (investigation orchestrateur, 07-10)

- **Index** : le snapshot PB ne porte AUCUN index métier (seuls idx_email/idx_ingredients + système). Les delta-sync filtrent `updated >= since` (full-scan aujourd'hui) ; les syncs scopés filtrent `eventId + updated` ; join-event cherche share_links ; locks cherche recordId+collection. Les index Appwrite prod (`idx_updatedAt` sur materiel/materiel_loan/products, `idx_main-update`) n'ont jamais eu d'équivalent PB.
- **Tags teamdocs** : la fonctionnalité « documents liés par tag » est une **coquille vide partout** — l'app prod (référence site) rend `EventDocumentsBloc` sur 4 pages événement (tags fixes : `produit` confirmé sur EventProductsPage:653 ; vérifier materiel/recettes/todos), le store filtre `tags?.includes(tag)`, MAIS l'attribut `tags` n'existe pas dans la collection Appwrite prod (export frais : 22 rows sans une seule clé `tags`). Le drop PB 1700000029 + le nettoyage triage (`8d4541a9`, −558 lignes) ont retiré cette coquille morte.
- **Code client de référence** : la version mig pré-suppression est dans git (`git show 8d4541a9^:<path>`) — déjà adaptée pb-sync. La version site (`enka-cookbook-site/svelte-app/src/lib/components/documents/EventDocumentsBloc.svelte` + `TeamdocsStore.svelte.ts` L56-76) est l'implémentation fonctionnelle de référence pour le comportement attendu.
- **Pipeline** : `2-transform-data.ts` §9 teamdocs (L809-838) ne mappe pas `tags` — à ajouter (`awDoc.tags || null`, tolérance standard ; prod n'a pas de valeurs, les futures docs créeront leurs tags via l'UI).

## Header — état du monde (07-10)

- **Base** : `f03b3295`. Arbre propre. Canons : `check` 0 err/6 warn · `test` **104/104** · `check-legacy` **0** (sortie 0 — NE PAS régresser) · build propre committé.
- Chaîne de migrations : 99 lignes `_migrations` appliquées à la dev DB ; tout delta = nouveau timestamp > 1791304200. Bootcheck sur copie AVANT application dev ; backup pb_data avant tout boot écrivant (`/tmp/orchestrate/pb_data-backup-<ticket>/` + sha256).
- Ports 8090/8091 : revérifier avant boot ; un seul process PB par répertoire.
- **Ticket suivant séquentiel** : T02 ne démarre qu'après l'attestation de T01 (migrations + boots partagés).

## Critères de fin de run

- [ ] T01 : indexes posés + preuves EXPLAIN QUERY PLAN avant/après
- [ ] T02 : fonctionnalité restaurée bout-en-bout (schéma + client + pipeline) + tests
- [ ] Canons verts aux deux portails ; run.md amendés ; backlog mis à jour (orchestrateur)

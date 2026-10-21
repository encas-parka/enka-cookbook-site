/**
 * Politique « curseurs de session » (ADR 0001) — constantes partagées.
 *
 * La politique vit dans l'option `sessionCursor` de `createSyncCollection`
 * (pb-collection.ts) : le fetch de session ignore le curseur persisté, le
 * delta intra-session assure le rattrapage fin (déconnexions SSE) et le SSE
 * tient la fraîcheur en continu. Les stores n'en savent rien.
 */

/**
 * Filet de sécurité pour les sessions longévives : au-delà de ce délai sans
 * fetch complet (typiquement un onglet laissé en arrière-plan), la prochaine
 * `revalidate` repasse par un fetch complet — les grants élargis pendant
 * l'arrière-plan (messages `team_joined` manqués) sont rattrapés. Défaut de
 * `sessionCursor` ; une collection peut le retuner via
 * `sessionCursor: { ttlMs }`.
 */
export const SESSION_FULL_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Borne du fetch complet de session des events : les events terminés depuis
 * plus de N jours ne sont pas re-populés à chaque session (les mutations
 * restent rattrapées par le delta — la borne ne s'applique qu'au fetch
 * complet). À étendre aux loans le jour où leur historique pèse.
 */
export const EVENTS_EPOCH_FLOOR_DAYS = 90;

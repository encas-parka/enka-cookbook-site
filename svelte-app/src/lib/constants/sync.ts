/**
 * Politique « curseurs de session » (ADR 0001) — constantes partagées.
 *
 * Les collections à grant dynamique (events, teamdocs, materiel,
 * materiel_loan) resetent leur curseur à chaque début de session
 * (`syncInitial`) : le fetch complet qui suit rattrape tout ce qui a été
 * manqué pendant l'absence, mutations ET élargissements d'autorisation.
 * Entre deux resets, le delta assure le rattrapage fin (déconnexions SSE)
 * et le SSE tient la fraîcheur en continu.
 */

/**
 * Filet de sécurité pour les sessions longevives : au-delà de ce délai sans
 * fetch complet (typiquement un onglet laissé en arrière-plan), la prochaine
 * revalidation repasse par un reset + fetch complet de session — les grants
 * élargis pendant l'arrière-plan (messages `team_joined` manqués) sont
 * rattrapés.
 */
export const SESSION_FULL_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Borne du fetch complet de session des events : les events terminés depuis
 * plus de N jours ne sont pas re-populés à chaque session (les mutations
 * restent rattrapées par le delta — la borne ne s'applique qu'au fetch
 * complet). À étendre aux loans le jour où leur historique pèse.
 */
export const EVENTS_EPOCH_FLOOR_DAYS = 90;

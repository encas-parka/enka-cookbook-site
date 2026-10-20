/**
 * Décision de propagation du contenu distant d'un teamdoc vers les inputs
 * locaux des pages d'édition (EditDocumentPage, EventDocumentEditPage) —
 * logique extraite pour être testable au seam vitest (ticket T05).
 *
 * Contrat :
 *  - l'utilisateur local non modifié (local == snapshot) reçoit le contenu
 *    distant (realtime) — sinon userB ne voit jamais les saves de userA ;
 *  - l'utilisateur local avec des saisies non sauvegardées (dirty) garde ses
 *    saisies : le contenu distant ne les écrase jamais (anti-écrasement
 *    minimal ; le lock reste le garde-fou principal contre l'édition
 *    concurrente, cette décision ne le contourne pas) ;
 *  - un contenu distant identique aux inputs locaux est ignoré (écho de
 *    sauvegarde — évite le churn d'effet et les écritures inutiles).
 */

export interface DocDraftState {
  title: string;
  content: string;
  tags: string[];
}

export type RemoteDocDecision =
  | { action: "apply"; draft: DocDraftState }
  | { action: "skip"; reason: "dirty" | "unchanged" };

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((tag, i) => tag === b[i]);
}

function draftsEqual(a: DocDraftState, b: DocDraftState): boolean {
  return (
    a.title === b.title && a.content === b.content && tagsEqual(a.tags, b.tags)
  );
}

export function resolveRemoteDocUpdate(
  local: DocDraftState,
  snapshot: DocDraftState,
  incoming: DocDraftState,
): RemoteDocDecision {
  if (draftsEqual(incoming, local)) {
    return { action: "skip", reason: "unchanged" };
  }

  const isDirty = !draftsEqual(local, snapshot);
  if (isDirty) {
    return { action: "skip", reason: "dirty" };
  }

  return { action: "apply", draft: incoming };
}

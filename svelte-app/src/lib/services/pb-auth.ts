/**
 * pb-auth — PocketBase Authentication Service
 *
 * Remplace `services/appwrite.ts` pour l'authentification. PocketBase SDK gère
 * le stockage du token JWT dans localStorage automatiquement via `pb.authStore`.
 *
 * Normalisation : PocketBase utilise `id`/`created`/`updated` → on normalise
 * en `$id`/`$createdAt`/`$updatedAt` pour compatibilité avec le reste du codebase.
 */

import { pb } from '$lib/db-sync/pb-sync';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Utilisateur authentifié normalisé (format Appwrite-compatible).
 * Seuls les champs utilisés par le codebase sont exposés.
 */
export interface PBAuthUser {
	$id: string;
	name: string;
	email: string;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalise un RecordModel PocketBase en PBAuthUser.
 */
function normalizeUser(record: Record<string, unknown>): PBAuthUser {
	return {
		$id: record.id as string,
		name: (record.name as string) || (record.username as string) || '',
		email: (record.email as string) || ''
	};
}

// =============================================================================
// AUTH API
// =============================================================================

/**
 * Récupère l'utilisateur actuellement authentifié (depuis pb.authStore).
 * Retourne null si non authentifié.
 */
export function getCurrentUser(): PBAuthUser | null {
	if (pb.authStore.isValid && pb.authStore.record) {
		return normalizeUser(pb.authStore.record);
	}
	return null;
}

/**
 * Vérifie si un utilisateur est authentifié.
 */
export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

/**
 * Connexion par email + mot de passe.
 * Le token JWT est automatiquement stocké dans pb.authStore (localStorage).
 */
export async function loginWithPassword(
	email: string,
	password: string
): Promise<PBAuthUser> {
	const result = await pb.collection('users').authWithPassword(email, password);
	return normalizeUser(result.record);
}

/**
 * Inscription + connexion automatique.
 * PocketBase n'a pas d'étape "create" puis "session" séparée — on crée
 * l'utilisateur puis on le connecte immédiatement.
 */
export async function register(
	name: string,
	email: string,
	password: string
): Promise<PBAuthUser> {
	// 1. Créer l'utilisateur
	await pb.collection('users').create({
		email,
		password,
		passwordConfirm: password,
		name
	});

	// 2. Connecter immédiatement
	return loginWithPassword(email, password);
}

/**
 * Déconnexion : efface le token JWT du authStore.
 * Le SDK PocketBase nettoie automatiquement le localStorage.
 */
export function logout(): void {
	pb.authStore.clear();
}

/**
 * Demande de réinitialisation de mot de passe.
 * Envoie un email avec un lien de reset via le template PocketBase configuré.
 */
export async function requestPasswordReset(email: string): Promise<void> {
	await pb.collection('users').requestPasswordReset(email);
}

/**
 * Vérifie si l'email existe déjà (pour le flow d'inscription).
 * Retourne true si un utilisateur avec cet email existe.
 */
export async function emailExists(email: string): Promise<boolean> {
	try {
		const records = await pb.collection('users').getList(1, 1, {
			filter: pb.filter('email = {:email}', { email })
		});
		return records.totalItems > 0;
	} catch {
		return false;
	}
}

/**
 * Écoute les changements d'authentification (login/logout).
 * Retourne une fonction de désabonnement.
 */
export function onAuthChange(
	callback: (user: PBAuthUser | null) => void
): () => void {
	return pb.authStore.onChange((_token, record) => {
		if (record) {
			callback(normalizeUser(record));
		} else {
			callback(null);
		}
	});
}

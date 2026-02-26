import type { Models } from "appwrite";

/**
 * Interface pour une équipe native enrichie avec ses membres et préférences
 */
export interface EnrichedNativeTeam {
  $id: string;
  name: string;
  total: number;
  $createdAt: string;
  $updatedAt: string;
  members: NativeTeamMember[];
  prefs: Record<string, any>;
  description?: string; // Optionnel, peut être stocké dans prefs
}

/**
 * Interface pour un membre d'une équipe native
 */
export interface NativeTeamMember {
  $id: string; // Membership ID
  id: string; // User ID
  name: string;
  userEmail: string;
  roles: string[]; // ["owner"] ou ["member"]
  joinedAt: string;
  confirmed: boolean; // Si l'invitation a été acceptée
}

/**
 * Résultat d'une invitation groupée
 */
export interface InviteResult {
  sent: string[];
  failed: { email: string; error: string }[];
}

/**
 * Préférences d'équipe
 */
export interface TeamPrefs {
  description?: string;
  location?: string;
  region?: string;
  city?: string;
  isPublic?: boolean;
}

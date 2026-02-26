import { getAppwriteInstances, getFunctionId } from "./appwrite";
import type { Models } from "appwrite";
import { ID, Query } from "appwrite";
import type { InviteResult } from "../types/aw_native_team";

/**
 * Liste les équipes de l'utilisateur actuel
 */
export async function listUserTeams(): Promise<
  Models.TeamList<Models.Preferences>
> {
  const { teams } = await getAppwriteInstances();
  return await teams.list();
}

/**
 * Récupère une équipe par son ID
 */
export async function getTeam(
  teamId: string,
): Promise<Models.Team<Models.Preferences>> {
  const { teams } = await getAppwriteInstances();
  return await teams.get({ teamId });
}

/**
 * Crée une nouvelle équipe native
 */
export async function createTeam(
  name: string,
): Promise<Models.Team<Models.Preferences>> {
  const { teams } = await getAppwriteInstances();
  return await teams.create({ teamId: ID.unique(), name });
}

/**
 * Met à jour le nom d'une équipe
 */
export async function updateTeam(
  teamId: string,
  name: string,
): Promise<Models.Team<Models.Preferences>> {
  const { teams } = await getAppwriteInstances();
  return await teams.updateName({ teamId, name });
}

/**
 * Supprime une équipe
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const { teams } = await getAppwriteInstances();
  await teams.delete({ teamId });
}

/**
 * Liste les membres d'une équipe
 */
export async function listMembers(
  teamId: string,
): Promise<Models.MembershipList> {
  const { teams } = await getAppwriteInstances();
  return await teams.listMemberships({ teamId });
}

/**
 * Supprime un membre d'une équipe (ou décline une invitation)
 */
export async function removeMember(
  teamId: string,
  membershipId: string,
): Promise<void> {
  const { teams } = await getAppwriteInstances();
  await teams.deleteMembership({ teamId, membershipId });
}

/**
 * Récupère une membership spécifique
 */
export async function getMember(
  teamId: string,
  membershipId: string,
): Promise<Models.Membership> {
  const { teams } = await getAppwriteInstances();
  return await teams.getMembership({ teamId, membershipId });
}

/**
 * Invite des membres via une Cloud Function pour envoyer des emails personnalisés
 */
export async function inviteMembers(
  teamId: string,
  emails: string[],
  message?: string,
): Promise<InviteResult> {
  const { functions } = await getAppwriteInstances();
  const functionId = getFunctionId("usersTeamsManager");

  const payload = {
    action: "native-invite",
    teamId,
    emails,
    message,
  };

  const response = await functions.createExecution({
    functionId,
    body: JSON.stringify(payload),
  });

  if (response.status !== "completed") {
    throw new Error(`Erreur lors de l'invitation : ${response.errors}`);
  }

  return JSON.parse(response.responseBody);
}

/**
 * Interface pour les préférences d'une équipe
 */
export interface TeamPrefs {
  description?: string;
  location?: string;
  city?: string;
  isPublic?: boolean;
}

/**
 * Met à jour les préférences (métadonnées) d'une équipe
 */
export async function updateTeamPrefs(
  teamId: string,
  prefs: TeamPrefs,
): Promise<Models.Preferences> {
  const { teams } = await getAppwriteInstances();
  return await teams.updatePrefs({ teamId, prefs });
}

/**
 * Met à jour le rôle d'un membre d'une équipe
 * @param teamId - ID de l'équipe
 * @param membershipId - ID de l'adhésion (membership)
 * @param roles - Nouveau rôle (ex: ["owner"] ou ["member"])
 */
export async function updateMembershipRoles(
  teamId: string,
  membershipId: string,
  roles: string[],
): Promise<Models.Membership> {
  const { teams } = await getAppwriteInstances();
  return await teams.updateMembership({ teamId, membershipId, roles });
}

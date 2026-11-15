import type { PlayerDocument } from '../types/player.types.js';

export type PublicPlayerDocument = Omit<
  PlayerDocument,
  | 'phoneNumber'
  | 'email'
  | 'currentAddress'
  | 'guardianName'
  | 'guardianPhone'
  | 'coachNotes'
>;

/**
 * Explicit allowlist for publicly readable player fields. New private fields
 * are excluded by default instead of being leaked through a spread.
 */
export function toPublicPlayer(player: PlayerDocument): PublicPlayerDocument {
  return {
    _id: player._id,
    fullName: player.fullName,
    slug: player.slug,
    jerseyNumber: player.jerseyNumber,
    position: player.position,
    nationality: player.nationality,
    dateOfBirth: player.dateOfBirth,
    height: player.height,
    weight: player.weight,
    bio: player.bio,
    photo: player.photo,
    secondaryPosition: player.secondaryPosition,
    dominantFoot: player.dominantFoot,
    playingExperienceYears: player.playingExperienceYears,
    previousClub: player.previousClub,
    previousTournaments: player.previousTournaments,
    achievements: player.achievements,
    playerStatus: player.playerStatus,
    joiningDate: player.joiningDate,
    trainingGroup: player.trainingGroup,
    statistics: player.statistics,
    isActive: player.isActive,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}

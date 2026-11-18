import { Db, IndexDescription } from 'mongodb';
import { getDB } from '../config/db.js';

export interface IndexInitResult {
  collection: string;
  indexes: string[];
}

export async function initializeIndexes(database?: Db): Promise<IndexInitResult[]> {
  const db = database || getDB();
  const results: IndexInitResult[] = [];

  console.log('[Database] Initializing MongoDB collection indexes...');

  // 1. Players Indexes
  const playerIndexes: IndexDescription[] = [
    { key: { slug: 1 }, unique: true, name: 'uniq_player_slug' },
    { key: { jerseyNumber: 1 }, name: 'idx_player_jerseyNumber' },
    { key: { position: 1 }, name: 'idx_player_position' },
    { key: { isActive: 1 }, name: 'idx_player_isActive' },
  ];
  await db.collection('players').createIndexes(playerIndexes);
  results.push({
    collection: 'players',
    indexes: playerIndexes.map((idx) => idx.name as string),
  });

  // 2. Matches Indexes
  const matchIndexes: IndexDescription[] = [
    { key: { matchDate: 1 }, name: 'idx_match_matchDate' },
    { key: { status: 1 }, name: 'idx_match_status' },
    { key: { status: 1, matchDate: 1 }, name: 'idx_match_status_date' },
  ];
  await db.collection('matches').createIndexes(matchIndexes);
  results.push({
    collection: 'matches',
    indexes: matchIndexes.map((idx) => idx.name as string),
  });

  // 3. Results Indexes (reference to Match)
  const resultIndexes: IndexDescription[] = [
    { key: { matchId: 1 }, name: 'idx_result_matchId' },
    { key: { matchDate: -1 }, name: 'idx_result_matchDate' },
  ];
  await db.collection('results').createIndexes(resultIndexes);
  results.push({
    collection: 'results',
    indexes: resultIndexes.map((idx) => idx.name as string),
  });

  // 4. Gallery Indexes
  const galleryIndexes: IndexDescription[] = [
    { key: { category: 1 }, name: 'idx_gallery_category' },
    { key: { isPublished: 1 }, name: 'idx_gallery_isPublished' },
    { key: { createdAt: -1 }, name: 'idx_gallery_createdAt' },
    { key: { isPublished: 1, category: 1, createdAt: -1 }, name: 'idx_gallery_pub_cat_date' },
  ];
  await db.collection('gallery').createIndexes(galleryIndexes);
  results.push({
    collection: 'gallery',
    indexes: galleryIndexes.map((idx) => idx.name as string),
  });

  // 5. Registrations Indexes
  const registrationIndexes: IndexDescription[] = [
    { key: { status: 1 }, name: 'idx_registration_status' },
    { key: { createdAt: -1 }, name: 'idx_registration_createdAt' },
    { key: { email: 1 }, name: 'idx_registration_email' },
  ];
  await db.collection('registrations').createIndexes(registrationIndexes);
  results.push({
    collection: 'registrations',
    indexes: registrationIndexes.map((idx) => idx.name as string),
  });

  // 6. Admins Indexes
  const adminIndexes: IndexDescription[] = [
    { key: { email: 1 }, unique: true, name: 'uniq_admin_email' },
    { key: { role: 1 }, name: 'idx_admin_role' },
  ];
  await db.collection('admins').createIndexes(adminIndexes);
  results.push({
    collection: 'admins',
    indexes: adminIndexes.map((idx) => idx.name as string),
  });

  // 7. Auth User Indexes (Better Auth)
  const userIndexes: IndexDescription[] = [
    { key: { email: 1 }, unique: true, name: 'uniq_user_email' },
  ];
  await db.collection('user').createIndexes(userIndexes);
  results.push({
    collection: 'user',
    indexes: userIndexes.map((idx) => idx.name as string),
  });

  // 8. Auth Account Indexes (Better Auth)
  const accountIndexes: IndexDescription[] = [
    { key: { userId: 1, providerId: 1 }, unique: true, name: 'uniq_account_user_provider' },
  ];
  await db.collection('account').createIndexes(accountIndexes);
  results.push({
    collection: 'account',
    indexes: accountIndexes.map((idx) => idx.name as string),
  });

  // 9. Tournaments Indexes
  const tournamentIndexes: IndexDescription[] = [
    { key: { slug: 1 }, unique: true, name: 'uniq_tournament_slug' },
    { key: { status: 1 }, name: 'idx_tournament_status' },
    { key: { season: 1 }, name: 'idx_tournament_season' },
    { key: { createdAt: -1 }, name: 'idx_tournament_createdAt' },
  ];
  await db.collection('tournaments').createIndexes(tournamentIndexes);
  results.push({
    collection: 'tournaments',
    indexes: tournamentIndexes.map((idx) => idx.name as string),
  });

  // 10. Tournament Teams Indexes
  const tournamentTeamIndexes: IndexDescription[] = [
    { key: { tournamentId: 1, name: 1 }, unique: true, name: 'uniq_tournament_team_name' },
    { key: { tournamentId: 1, playerIds: 1 }, unique: true, name: 'uniq_tournament_player' },
    { key: { tournamentId: 1 }, name: 'idx_tournament_team_tournamentId' },
    { key: { playerIds: 1 }, name: 'idx_tournament_team_playerIds' },
  ];
  await db.collection('tournament_teams').createIndexes(tournamentTeamIndexes);
  results.push({
    collection: 'tournament_teams',
    indexes: tournamentTeamIndexes.map((idx) => idx.name as string),
  });

  // 11. Tournament Matches Indexes
  const tournamentMatchIndexes: IndexDescription[] = [
    { key: { tournamentId: 1, matchNumber: 1 }, unique: true, name: 'uniq_tournament_match_number' },
    { key: { tournamentId: 1, stage: 1, status: 1 }, name: 'idx_tournament_match_stage_status' },
    { key: { tournamentId: 1, round: 1 }, name: 'idx_tournament_match_round' },
    { key: { 'goals.playerId': 1 }, name: 'idx_tournament_match_goal_scorer' },
  ];
  await db.collection('tournament_matches').createIndexes(tournamentMatchIndexes);
  results.push({
    collection: 'tournament_matches',
    indexes: tournamentMatchIndexes.map((idx) => idx.name as string),
  });

  // 12. Friendly Series Indexes
  const friendlySeriesIndexes: IndexDescription[] = [
    { key: { slug: 1 }, unique: true, name: 'uniq_friendly_series_slug' },
    { key: { status: 1 }, name: 'idx_friendly_series_status' },
    { key: { format: 1 }, name: 'idx_friendly_series_format' },
    { key: { teamAId: 1 }, name: 'idx_friendly_series_teamAId' },
    { key: { teamBId: 1 }, name: 'idx_friendly_series_teamBId' },
    { key: { createdAt: -1 }, name: 'idx_friendly_series_createdAt' },
  ];
  await db.collection('friendly_series').createIndexes(friendlySeriesIndexes);
  results.push({
    collection: 'friendly_series',
    indexes: friendlySeriesIndexes.map((idx) => idx.name as string),
  });

  // 13. Friendly Series Matches Indexes
  const friendlySeriesMatchIndexes: IndexDescription[] = [
    { key: { seriesId: 1, matchNumber: 1 }, unique: true, name: 'uniq_friendly_match_series_number' },
    { key: { seriesId: 1, status: 1 }, name: 'idx_friendly_match_series_status' },
    { key: { seriesId: 1 }, name: 'idx_friendly_match_seriesId' },
    { key: { 'goals.playerId': 1 }, name: 'idx_friendly_match_goal_scorer' },
  ];
  await db.collection('friendly_series_matches').createIndexes(friendlySeriesMatchIndexes);
  results.push({
    collection: 'friendly_series_matches',
    indexes: friendlySeriesMatchIndexes.map((idx) => idx.name as string),
  });

  console.log('[Database] All collection indexes successfully initialized.');
  return results;
}

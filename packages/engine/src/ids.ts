/**
 * Identifiers are plain strings. The engine never mints ids for teams or players:
 * the host application owns identity. Rounds, groups and matches get deterministic,
 * human-readable ids derived from their position (see `tournament/create.ts`), so
 * the same inputs always produce the same tournament.
 */
export type TournamentId = string;
export type RoundId = string;
export type GroupId = string;
export type MatchId = string;
export type TeamId = string;
export type PlayerId = string;

import type { GroupId, MatchId, PlayerId, RoundId, TeamId, TournamentId } from './ids.ts';
import type { Rules } from './rules.ts';

/**
 * Lifecycle of a match, as it runs in production:
 *
 *   CREATED ──(both teams assigned)──▶ READY ──(schedule set)──▶ CONFIRMED
 *   CONFIRMED ──(result recorded)──▶ PLAYED ──(publish)──▶ PUBLISHED ──(unpublish)──▶ PLAYED
 *   SUSPENDED is only reached by force-closing a round with pending matches.
 */
export type MatchStatus = 'CREATED' | 'READY' | 'CONFIRMED' | 'PLAYED' | 'PUBLISHED' | 'SUSPENDED';

/** One row of a match sheet: what a single player did in a single match. */
export interface PlayerLine {
  readonly playerId: PlayerId;
  readonly shirtNumber: number;
  readonly goals: number;
  readonly penalties: number;
  readonly yellow: number;
  readonly red: number;
  readonly blue: number;
}

/** A team's side of the match sheet. `otherPlayers` holds goals nobody was credited with. */
export interface TeamSheet {
  readonly players: readonly PlayerLine[];
  readonly otherPlayers: { readonly goals: number; readonly penalties: number };
}

/**
 * A walkover carries no sheets at all: the type itself guarantees that player
 * statistics are wiped, which production had to do by hand.
 */
export type MatchResult =
  | { readonly kind: 'PLAYED'; readonly home: TeamSheet; readonly away: TeamSheet }
  | { readonly kind: 'WALKOVER'; readonly winner: TeamId; readonly refereeReport: string };

export interface MatchSchedule {
  readonly locationId: string;
  readonly fieldId: string;
  /** ISO 8601 timestamp. The engine never parses it; it only requires it to be present. */
  readonly date: string;
}

export interface Match {
  readonly id: MatchId;
  readonly roundId: RoundId;
  readonly groupId: GroupId;
  /** 1-based matchday within the group ("J1", "J2", …). */
  readonly matchday: number;
  /** 1-based slots in the group the two sides come from. Fixed at fixture time. */
  readonly homePlace: number;
  readonly awayPlace: number;
  /** Teams are filled in when the slots are assigned; null until then. */
  readonly home: TeamId | null;
  readonly away: TeamId | null;
  readonly status: MatchStatus;
  readonly schedule: MatchSchedule | null;
  readonly result: MatchResult | null;
}

export interface Group {
  readonly id: GroupId;
  readonly roundId: RoundId;
  /** "A", "B", … "Z", "AA", "AB", … */
  readonly label: string;
  /** Index 0 is place 1. `null` means the slot has not been assigned yet. */
  readonly slots: readonly (TeamId | null)[];
}

export interface Round {
  readonly id: RoundId;
  /** 1-based position in the tournament. */
  readonly index: number;
  readonly name: string;
  readonly numberTeamsIn: number;
  /** How many teams advance. The final round has exactly 1. */
  readonly numberTeamsOut: number;
  readonly status: 'OPEN' | 'CLOSED';
  readonly groups: readonly Group[];
}

/**
 * The whole aggregate. Operations take a tournament and return a new one; the
 * input is never mutated. `matches` is a flat list so updates are O(1) by id and
 * every derived view (standings, fines, scorers) is a filter over it.
 */
export interface Tournament {
  readonly id: TournamentId;
  readonly rules: Rules;
  readonly teams: readonly TeamId[];
  readonly rounds: readonly Round[];
  readonly matches: readonly Match[];
}

export interface Standing {
  readonly position: number;
  readonly teamId: TeamId;
  readonly played: number;
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** points / played, rounded to 2 decimals; 0 when nothing has been played. */
  readonly averagePoints: number;
}

export interface Fine {
  readonly matchId: MatchId;
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly amount: number;
  readonly basis: 'red' | 'yellow' | 'blue';
}

export interface ScorerEntry {
  readonly playerId: PlayerId;
  readonly teamId: TeamId;
  readonly goals: number;
}

export interface DisciplineEntry {
  readonly playerId: PlayerId;
  readonly teamId: TeamId;
  readonly yellow: number;
  readonly red: number;
  readonly blue: number;
  /** red × 2 + yellow + blue */
  readonly score: number;
}

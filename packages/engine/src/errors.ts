import type { GroupId, MatchId, PlayerId, RoundId, TeamId } from './ids.ts';
import type { MatchStatus } from './model.ts';

/**
 * Every failure the engine can report. Discriminated on `code` so callers can
 * exhaustively switch over it; no operation ever throws.
 */
export type EngineError =
  | { readonly code: 'INVALID_INPUT'; readonly reason: string }
  | { readonly code: 'INVALID_RULES'; readonly reason: string }
  | {
      readonly code: 'NOT_FOUND';
      readonly entity: 'round' | 'group' | 'match' | 'team';
      readonly id: string;
    }
  | { readonly code: 'ROUND_ALREADY_OPEN'; readonly roundId: RoundId }
  | { readonly code: 'NO_OPEN_ROUND' }
  | { readonly code: 'ROUND_CLOSED'; readonly roundId: RoundId }
  | {
      readonly code: 'ROUND_HAS_PENDING_MATCHES';
      readonly roundId: RoundId;
      readonly matchIds: readonly MatchId[];
    }
  | { readonly code: 'TEAM_NOT_IN_TOURNAMENT'; readonly teamId: TeamId }
  | {
      readonly code: 'TEAM_ALREADY_PLACED';
      readonly roundId: RoundId;
      readonly teamId: TeamId;
    }
  | { readonly code: 'SLOT_OUT_OF_RANGE'; readonly groupId: GroupId; readonly place: number }
  | {
      readonly code: 'SLOT_TAKEN';
      readonly groupId: GroupId;
      readonly place: number;
      readonly occupiedBy: TeamId;
    }
  | {
      readonly code: 'INVALID_TRANSITION';
      readonly matchId: MatchId;
      readonly from: MatchStatus;
      readonly to: MatchStatus;
    }
  | { readonly code: 'INVALID_SCHEDULE'; readonly matchId: MatchId; readonly reason: string }
  | { readonly code: 'INVALID_RESULT'; readonly matchId: MatchId; readonly reason: string }
  | { readonly code: 'WALKOVER_REQUIRES_REPORT'; readonly matchId: MatchId }
  | {
      readonly code: 'WALKOVER_WINNER_NOT_IN_MATCH';
      readonly matchId: MatchId;
      readonly winner: TeamId;
    }
  | { readonly code: 'MISSING_RESULT'; readonly matchId: MatchId }
  | {
      readonly code: 'PLAYER_ON_TWO_TEAMS';
      readonly playerId: PlayerId;
      readonly teams: readonly [TeamId, TeamId];
    }
  | { readonly code: 'PERSON_BANNED'; readonly matchedBy: 'document' | 'email' | 'phone' };

export type EngineErrorCode = EngineError['code'];

/** Human-readable rendering, used by `unwrap` and handy for logs. */
export function describeError(error: EngineError): string {
  switch (error.code) {
    case 'INVALID_INPUT':
    case 'INVALID_RULES':
      return `${error.code}: ${error.reason}`;
    case 'NOT_FOUND':
      return `${error.code}: ${error.entity} "${error.id}"`;
    case 'ROUND_ALREADY_OPEN':
      return `${error.code}: round "${error.roundId}" is still open`;
    case 'NO_OPEN_ROUND':
      return `${error.code}: there is no open round`;
    case 'ROUND_CLOSED':
      return `${error.code}: round "${error.roundId}" is closed`;
    case 'ROUND_HAS_PENDING_MATCHES':
      return `${error.code}: round "${error.roundId}" has ${error.matchIds.length} unpublished match(es)`;
    case 'TEAM_NOT_IN_TOURNAMENT':
      return `${error.code}: team "${error.teamId}"`;
    case 'TEAM_ALREADY_PLACED':
      return `${error.code}: team "${error.teamId}" already has a slot in round "${error.roundId}"`;
    case 'SLOT_OUT_OF_RANGE':
      return `${error.code}: group "${error.groupId}" has no place ${error.place}`;
    case 'SLOT_TAKEN':
      return `${error.code}: place ${error.place} of group "${error.groupId}" is taken by "${error.occupiedBy}"`;
    case 'INVALID_TRANSITION':
      return `${error.code}: match "${error.matchId}" cannot go from ${error.from} to ${error.to}`;
    case 'INVALID_SCHEDULE':
    case 'INVALID_RESULT':
      return `${error.code}: match "${error.matchId}": ${error.reason}`;
    case 'WALKOVER_REQUIRES_REPORT':
      return `${error.code}: match "${error.matchId}"`;
    case 'WALKOVER_WINNER_NOT_IN_MATCH':
      return `${error.code}: "${error.winner}" does not play match "${error.matchId}"`;
    case 'MISSING_RESULT':
      return `${error.code}: match "${error.matchId}" has no result to publish`;
    case 'PLAYER_ON_TWO_TEAMS':
      return `${error.code}: player "${error.playerId}" is on "${error.teams[0]}" and "${error.teams[1]}"`;
    case 'PERSON_BANNED':
      return `${error.code}: matched by ${error.matchedBy}`;
  }
}

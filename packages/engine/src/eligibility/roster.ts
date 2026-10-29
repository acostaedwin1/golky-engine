import type { PlayerId, TeamId } from '../ids.ts';
import { err, ok, type Result } from '../result.ts';

export interface TeamRoster {
  readonly teamId: TeamId;
  readonly players: readonly PlayerId[];
}

/** A player can be on only one team in a tournament. */
export function validateRosters(rosters: readonly TeamRoster[]): Result<void> {
  const teamOf = new Map<PlayerId, TeamId>();
  for (const roster of rosters) {
    for (const playerId of roster.players) {
      const existing = teamOf.get(playerId);
      if (existing !== undefined && existing !== roster.teamId) {
        return err({ code: 'PLAYER_ON_TWO_TEAMS', playerId, teams: [existing, roster.teamId] });
      }
      teamOf.set(playerId, roster.teamId);
    }
  }
  return ok(undefined);
}

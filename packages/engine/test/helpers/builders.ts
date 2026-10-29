import type { MatchId, PlayerId, TeamId } from '../../src/ids.ts';
import { confirmMatch, publishMatch, recordResult } from '../../src/match/lifecycle.ts';
import type {
  MatchResult,
  MatchSchedule,
  PlayerLine,
  TeamSheet,
  Tournament,
} from '../../src/model.ts';
import { chain, type Result, unwrap } from '../../src/result.ts';
import type { RulesInput } from '../../src/rules.ts';
import { createTournament, openRound } from '../../src/tournament/create.ts';

export const when: MatchSchedule = {
  locationId: 'loc-1',
  fieldId: 'field-1',
  date: '2026-11-01T10:00:00Z',
};

export const TEAMS: readonly TeamId[] = ['ajax', 'boca', 'celta', 'dinamo', 'eibar', 'flamengo'];

export function line(
  playerId: PlayerId,
  overrides: Partial<Omit<PlayerLine, 'playerId'>> = {},
): PlayerLine {
  return {
    playerId,
    shirtNumber: 1,
    goals: 0,
    penalties: 0,
    yellow: 0,
    red: 0,
    blue: 0,
    ...overrides,
  };
}

export function sheet(goals = 0, players: readonly PlayerLine[] = [], penalties = 0): TeamSheet {
  return { players, otherPlayers: { goals, penalties } };
}

/** A played result scored entirely through `otherPlayers`. */
export function played(homeGoals: number, awayGoals: number): MatchResult {
  return { kind: 'PLAYED', home: sheet(homeGoals), away: sheet(awayGoals) };
}

export function walkover(winner: TeamId, refereeReport = 'Opponent did not show up'): MatchResult {
  return { kind: 'WALKOVER', winner, refereeReport };
}

/** A single-group league with the given teams, all slots seeded. */
export function league(teams: readonly TeamId[] = TEAMS, rules: RulesInput = {}): Tournament {
  const t = unwrap(createTournament({ id: 'liga', teams, rules }));
  return unwrap(openRound(t, { groups: 1, numberTeamsOut: 1, seed: teams }));
}

export function firstGroupId(t: Tournament): string {
  return (t.rounds[0]?.groups[0]?.id as string) ?? '';
}

/** Finds the (single-leg) match between two teams, in either order. */
export function matchBetween(t: Tournament, a: TeamId, b: TeamId): MatchId {
  const m = t.matches.find((x) => (x.home === a && x.away === b) || (x.home === b && x.away === a));
  if (!m) throw new Error(`no match between ${a} and ${b}`);
  return m.id;
}

/** confirm → record → publish in one go. */
export function play(t: Tournament, matchId: MatchId, result: MatchResult): Result<Tournament> {
  return chain(
    t,
    (x) => confirmMatch(x, matchId, when),
    (x) => recordResult(x, matchId, result),
    (x) => publishMatch(x, matchId),
  );
}

/** Publishes a scoreline between two teams; `[home, away]` given in that order. */
export function score(t: Tournament, home: TeamId, away: TeamId, h: number, a: number): Tournament {
  const id = matchBetween(t, home, away);
  const m = t.matches.find((x) => x.id === id);
  const result = m?.home === home ? played(h, a) : played(a, h);
  return unwrap(play(t, id, result));
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

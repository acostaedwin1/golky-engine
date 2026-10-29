export type { EngineError, EngineErrorCode } from './errors.ts';
export { describeError } from './errors.ts';
export { groupLabel, splitIntoGroups } from './fixture/groups.ts';
export type { Matchday, Pairing, RoundRobinOptions } from './fixture/round-robin.ts';
export { generateRoundRobin, matchdayLabel } from './fixture/round-robin.ts';
export type { GroupId, MatchId, PlayerId, RoundId, TeamId, TournamentId } from './ids.ts';
export type {
  DisciplineEntry,
  Fine,
  Group,
  Match,
  MatchResult,
  MatchSchedule,
  MatchStatus,
  PlayerLine,
  Round,
  ScorerEntry,
  Standing,
  TeamSheet,
  Tournament,
} from './model.ts';
export type { Err, Ok, Result } from './result.ts';
export { chain, EngineResultError, err, map, ok, unwrap } from './result.ts';
export type { LeftoverDistribution, Rules, RulesInput, TieBreaker } from './rules.ts';
export { defaultRules, resolveRules, TIE_BREAKERS } from './rules.ts';

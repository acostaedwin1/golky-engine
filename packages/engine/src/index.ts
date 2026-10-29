export { fineFor, listFines } from './discipline/fines.ts';
export { disciplineRanking, topScorers } from './discipline/ranking.ts';
export type { BannedPerson, PersonIdentity } from './eligibility/banned.ts';
export { checkBanned } from './eligibility/banned.ts';
export type { TeamRoster } from './eligibility/roster.ts';
export { validateRosters } from './eligibility/roster.ts';
export type { EngineError, EngineErrorCode } from './errors.ts';
export { describeError } from './errors.ts';
export { groupLabel, splitIntoGroups } from './fixture/groups.ts';
export type { Matchday, Pairing, RoundRobinOptions } from './fixture/round-robin.ts';
export { generateRoundRobin, matchdayLabel } from './fixture/round-robin.ts';
export type { GroupId, MatchId, PlayerId, RoundId, TeamId, TournamentId } from './ids.ts';
export {
  cancelConfirmation,
  confirmMatch,
  publishMatch,
  recordResult,
  unpublishMatch,
} from './match/lifecycle.ts';
export type { MatchScore, SideScore } from './match/score.ts';
export { scoreMatch, sheetTotals } from './match/score.ts';
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
export { computeGroupStandings, computeTournamentTable, tabulate } from './standings/compute.ts';
export type { HeadToHeadIndex, HeadToHeadRecord, StandingRow } from './standings/tiebreakers.ts';
export { compareStandings } from './standings/tiebreakers.ts';
export type { AdvanceRoundOptions } from './tournament/advance.ts';
export { advanceRound } from './tournament/advance.ts';
export type { CreateTournamentInput, OpenRoundInput } from './tournament/create.ts';
export { createTournament, openRound } from './tournament/create.ts';
export type { AssignSlotInput } from './tournament/slots.ts';
export { assignTeamToSlot, findGroup, teamsInRound } from './tournament/slots.ts';

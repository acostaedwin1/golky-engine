import { groupLabel, splitIntoGroups } from '../fixture/groups.ts';
import { generateRoundRobin } from '../fixture/round-robin.ts';
import type { TeamId, TournamentId } from '../ids.ts';
import type { Group, Match, Round, Tournament } from '../model.ts';
import { err, ok, type Result } from '../result.ts';
import { type RulesInput, resolveRules } from '../rules.ts';
import { assignTeamToSlot } from './slots.ts';

export interface CreateTournamentInput {
  readonly id: TournamentId;
  readonly teams: readonly TeamId[];
  readonly rules?: RulesInput;
}

const invalid = (reason: string) => err({ code: 'INVALID_INPUT' as const, reason });

/** A tournament with its teams registered and no rounds yet. */
export function createTournament(input: CreateTournamentInput): Result<Tournament> {
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    return invalid('tournament id must be a non-empty string');
  }
  if (!Array.isArray(input.teams) || input.teams.length < 2) {
    return invalid('a tournament needs at least 2 teams');
  }
  const seen = new Set<TeamId>();
  for (const team of input.teams) {
    if (typeof team !== 'string' || team.trim() === '') {
      return invalid('team ids must be non-empty strings');
    }
    if (seen.has(team)) return invalid(`duplicate team id "${team}"`);
    seen.add(team);
  }
  const rules = resolveRules(input.rules);
  if (!rules.ok) return rules;
  return ok({ id: input.id, rules: rules.value, teams: [...input.teams], rounds: [], matches: [] });
}

export interface OpenRoundInput {
  readonly name?: string;
  /** How many groups the incoming teams are split into. */
  readonly groups: number;
  /** How many teams advance out of this round. The final has 1. */
  readonly numberTeamsOut: number;
  /** Optional teams to pour into the slots, group by group, in this order. */
  readonly seed?: readonly TeamId[];
}

/**
 * Opens the next round: splits the incoming teams into groups, generates every
 * group's round-robin fixture as CREATED matches, and optionally seeds the slots.
 * The number of incoming teams is the previous round's `numberTeamsOut`, or the
 * whole tournament for the first round. Only one round can be open at a time.
 */
export function openRound(tournament: Tournament, input: OpenRoundInput): Result<Tournament> {
  const open = tournament.rounds.find((r) => r.status === 'OPEN');
  if (open) return err({ code: 'ROUND_ALREADY_OPEN', roundId: open.id });

  const previous = tournament.rounds[tournament.rounds.length - 1];
  const numberTeamsIn = previous ? previous.numberTeamsOut : tournament.teams.length;
  const { groups, numberTeamsOut } = input;
  if (!Number.isInteger(groups) || groups < 1 || groups > numberTeamsIn) {
    return invalid(`groups must be an integer between 1 and ${numberTeamsIn}`);
  }
  if (!Number.isInteger(numberTeamsOut) || numberTeamsOut < 1 || numberTeamsOut > numberTeamsIn) {
    return invalid(`numberTeamsOut must be an integer between 1 and ${numberTeamsIn}`);
  }
  if (input.seed && input.seed.length > numberTeamsIn) {
    return invalid(`seed has ${input.seed.length} teams but the round takes ${numberTeamsIn}`);
  }

  const { legs, leftover } = tournament.rules.fixture;
  const index = tournament.rounds.length + 1;
  const roundId = `round-${index}`;
  const sizes = splitIntoGroups(numberTeamsIn, groups, leftover);

  const roundGroups: Group[] = [];
  const matches: Match[] = [];
  sizes.forEach((size, i) => {
    const label = groupLabel(i);
    const groupId = `${roundId}/${label}`;
    roundGroups.push({
      id: groupId,
      roundId,
      label,
      slots: Array.from({ length: size }, () => null),
    });
    generateRoundRobin(size, { legs }).forEach((matchday, k) => {
      for (const [homePlace, awayPlace] of matchday) {
        matches.push({
          id: `${groupId}/J${k + 1}/${homePlace}v${awayPlace}`,
          roundId,
          groupId,
          matchday: k + 1,
          homePlace,
          awayPlace,
          home: null,
          away: null,
          status: 'CREATED',
          schedule: null,
          result: null,
        });
      }
    });
  });

  const round: Round = {
    id: roundId,
    index,
    name: input.name ?? `Round ${index}`,
    numberTeamsIn,
    numberTeamsOut,
    status: 'OPEN',
    groups: roundGroups,
  };

  let next: Tournament = {
    ...tournament,
    rounds: [...tournament.rounds, round],
    matches: [...tournament.matches, ...matches],
  };

  if (input.seed) {
    let groupIndex = 0;
    let place = 1;
    for (const teamId of input.seed) {
      const group = roundGroups[groupIndex] as Group;
      const assigned = assignTeamToSlot(next, { groupId: group.id, place, teamId });
      if (!assigned.ok) return assigned;
      next = assigned.value;
      place += 1;
      if (place > group.slots.length) {
        groupIndex += 1;
        place = 1;
      }
    }
  }
  return ok(next);
}

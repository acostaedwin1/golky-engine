import type { GroupId, TeamId } from '../ids.ts';
import type { Group, Round, Tournament } from '../model.ts';
import { err, ok, type Result } from '../result.ts';

export interface AssignSlotInput {
  readonly groupId: GroupId;
  /** 1-based place inside the group. */
  readonly place: number;
  readonly teamId: TeamId;
}

/** Every team that already has a slot somewhere in the round. */
export function teamsInRound(round: Round): readonly TeamId[] {
  return round.groups.flatMap((g) => g.slots.filter((s): s is TeamId => s !== null));
}

export function findGroup(
  tournament: Tournament,
  groupId: GroupId,
): { readonly round: Round; readonly group: Group } | undefined {
  for (const round of tournament.rounds) {
    const group = round.groups.find((g) => g.id === groupId);
    if (group) return { round, group };
  }
  return undefined;
}

/**
 * Puts a team into an empty slot of a group in the open round. Every match that
 * reads from that place learns its team, and a match whose two sides are now known
 * moves from CREATED to READY.
 */
export function assignTeamToSlot(
  tournament: Tournament,
  input: AssignSlotInput,
): Result<Tournament> {
  const { groupId, place, teamId } = input;
  if (!tournament.teams.includes(teamId)) return err({ code: 'TEAM_NOT_IN_TOURNAMENT', teamId });
  const found = findGroup(tournament, groupId);
  if (!found) return err({ code: 'NOT_FOUND', entity: 'group', id: groupId });
  const { round, group } = found;
  if (round.status !== 'OPEN') return err({ code: 'ROUND_CLOSED', roundId: round.id });
  if (!Number.isInteger(place) || place < 1 || place > group.slots.length) {
    return err({ code: 'SLOT_OUT_OF_RANGE', groupId, place });
  }
  const occupant = group.slots[place - 1];
  if (occupant !== null && occupant !== undefined) {
    return err({ code: 'SLOT_TAKEN', groupId, place, occupiedBy: occupant });
  }
  if (teamsInRound(round).includes(teamId)) {
    return err({ code: 'TEAM_ALREADY_PLACED', roundId: round.id, teamId });
  }

  const slots = group.slots.map((s, i) => (i === place - 1 ? teamId : s));
  const rounds = tournament.rounds.map((r) =>
    r.id !== round.id
      ? r
      : { ...r, groups: r.groups.map((g) => (g.id === groupId ? { ...g, slots } : g)) },
  );
  const matches = tournament.matches.map((m) => {
    if (m.groupId !== groupId) return m;
    const home = m.homePlace === place ? teamId : m.home;
    const away = m.awayPlace === place ? teamId : m.away;
    if (home === m.home && away === m.away) return m;
    const status = m.status === 'CREATED' && home !== null && away !== null ? 'READY' : m.status;
    return { ...m, home, away, status };
  });
  return ok({ ...tournament, rounds, matches });
}

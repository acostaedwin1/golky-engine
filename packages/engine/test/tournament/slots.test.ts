import { describe, expect, it } from 'vitest';
import { unwrap } from '../../src/result.ts';
import { advanceRound } from '../../src/tournament/advance.ts';
import { createTournament, openRound } from '../../src/tournament/create.ts';
import { assignTeamToSlot, teamsInRound } from '../../src/tournament/slots.ts';
import { TEAMS } from '../helpers/builders.ts';

function emptyLeague() {
  const t = unwrap(createTournament({ id: 'liga', teams: TEAMS }));
  return unwrap(openRound(t, { groups: 1, numberTeamsOut: 1 }));
}

describe('assignTeamToSlot', () => {
  it('fills the matches of that place and flips to READY only when both sides are known', () => {
    let t = emptyLeague();
    t = unwrap(assignTeamToSlot(t, { groupId: 'round-1/A', place: 1, teamId: 'ajax' }));
    const m = t.matches.find((x) => x.id === 'round-1/A/J1/1v6');
    expect(m).toMatchObject({ home: 'ajax', away: null, status: 'CREATED' });
    t = unwrap(assignTeamToSlot(t, { groupId: 'round-1/A', place: 6, teamId: 'boca' }));
    expect(t.matches.find((x) => x.id === 'round-1/A/J1/1v6')).toMatchObject({
      home: 'ajax',
      away: 'boca',
      status: 'READY',
    });
    expect(t.matches.filter((x) => x.status === 'READY')).toHaveLength(1);
    const round = t.rounds[0];
    expect(round && teamsInRound(round)).toEqual(['ajax', 'boca']);
  });

  it('reports the exact reason a slot cannot be filled', () => {
    let t = emptyLeague();
    t = unwrap(assignTeamToSlot(t, { groupId: 'round-1/A', place: 1, teamId: 'ajax' }));
    expect(assignTeamToSlot(t, { groupId: 'round-1/A', place: 1, teamId: 'boca' })).toMatchObject({
      ok: false,
      error: { code: 'SLOT_TAKEN', place: 1, occupiedBy: 'ajax' },
    });
    expect(assignTeamToSlot(t, { groupId: 'round-1/A', place: 2, teamId: 'ajax' })).toMatchObject({
      ok: false,
      error: { code: 'TEAM_ALREADY_PLACED', roundId: 'round-1', teamId: 'ajax' },
    });
    expect(assignTeamToSlot(t, { groupId: 'round-1/A', place: 7, teamId: 'boca' })).toMatchObject({
      ok: false,
      error: { code: 'SLOT_OUT_OF_RANGE', place: 7 },
    });
    expect(assignTeamToSlot(t, { groupId: 'round-1/A', place: 2, teamId: 'ghost' })).toMatchObject({
      ok: false,
      error: { code: 'TEAM_NOT_IN_TOURNAMENT', teamId: 'ghost' },
    });
    expect(assignTeamToSlot(t, { groupId: 'round-9/Z', place: 1, teamId: 'boca' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'group' },
    });
    const closed = unwrap(advanceRound(t, { force: true }));
    expect(
      assignTeamToSlot(closed, { groupId: 'round-1/A', place: 2, teamId: 'boca' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'ROUND_CLOSED', roundId: 'round-1' },
    });
  });
});

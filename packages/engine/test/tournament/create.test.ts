import { describe, expect, it } from 'vitest';
import { unwrap } from '../../src/result.ts';
import { createTournament, openRound } from '../../src/tournament/create.ts';
import { league, TEAMS } from '../helpers/builders.ts';

describe('createTournament', () => {
  it('registers teams and resolves rules', () => {
    const t = unwrap(createTournament({ id: 'liga', teams: TEAMS, rules: { points: { win: 2 } } }));
    expect(t.teams).toEqual(TEAMS);
    expect(t.rules.points.win).toBe(2);
    expect(t.rounds).toEqual([]);
    expect(t.matches).toEqual([]);
  });

  it.each([
    [{ id: '', teams: TEAMS }, 'INVALID_INPUT'],
    [{ id: 'x', teams: ['solo'] }, 'INVALID_INPUT'],
    [{ id: 'x', teams: ['a', 'a'] }, 'INVALID_INPUT'],
    [{ id: 'x', teams: ['a', ''] }, 'INVALID_INPUT'],
    [{ id: 'x', teams: ['a', 'b'], rules: { fixture: { legs: 5 as never } } }, 'INVALID_RULES'],
  ])('rejects %j', (input, code) => {
    const r = createTournament(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });
});

describe('openRound', () => {
  it('builds one group with a full round-robin of CREATED matches', () => {
    const t = unwrap(createTournament({ id: 'liga', teams: TEAMS }));
    const r = unwrap(openRound(t, { groups: 1, numberTeamsOut: 1 }));
    expect(r.rounds).toHaveLength(1);
    const round = r.rounds[0];
    expect(round).toMatchObject({
      id: 'round-1',
      index: 1,
      name: 'Round 1',
      numberTeamsIn: 6,
      numberTeamsOut: 1,
      status: 'OPEN',
    });
    expect(round?.groups).toHaveLength(1);
    expect(round?.groups[0]).toMatchObject({
      id: 'round-1/A',
      label: 'A',
      slots: [null, null, null, null, null, null],
    });
    expect(r.matches).toHaveLength(15);
    expect(new Set(r.matches.map((m) => m.status))).toEqual(new Set(['CREATED']));
    expect(r.matches[0]).toMatchObject({
      id: 'round-1/A/J1/1v6',
      matchday: 1,
      homePlace: 1,
      awayPlace: 6,
      home: null,
      away: null,
    });
    expect(new Set(r.matches.map((m) => m.id)).size).toBe(15);
  });

  it('splits 14 teams into 4 groups with PER_GROUP leftovers and labels them A–D', () => {
    const teams = Array.from({ length: 14 }, (_, i) => `t${i + 1}`);
    const t = unwrap(createTournament({ id: 'copa', teams }));
    const r = unwrap(openRound(t, { groups: 4, numberTeamsOut: 8 }));
    expect(r.rounds[0]?.groups.map((g) => g.slots.length)).toEqual([4, 4, 3, 3]);
    expect(r.rounds[0]?.groups.map((g) => g.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(r.matches).toHaveLength(6 + 6 + 3 + 3);
  });

  it('seeds slots in order and moves matches to READY', () => {
    const t = league();
    expect(t.rounds[0]?.groups[0]?.slots).toEqual(TEAMS);
    expect(new Set(t.matches.map((m) => m.status))).toEqual(new Set(['READY']));
    expect(t.matches[0]).toMatchObject({ home: 'ajax', away: 'flamengo' });
  });

  it('seeds across groups, group by group', () => {
    const teams = ['a', 'b', 'c', 'd', 'e'];
    const t = unwrap(createTournament({ id: 'x', teams }));
    const r = unwrap(openRound(t, { groups: 2, numberTeamsOut: 2, seed: teams }));
    expect(r.rounds[0]?.groups.map((g) => g.slots)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('doubles the matches with legs: 2', () => {
    const t = league(TEAMS, { fixture: { legs: 2 } });
    expect(t.matches).toHaveLength(30);
    expect(Math.max(...t.matches.map((m) => m.matchday))).toBe(10);
  });

  it('takes numberTeamsIn from the previous round', () => {
    const t = unwrap(createTournament({ id: 'x', teams: TEAMS }));
    let r = unwrap(openRound(t, { groups: 2, numberTeamsOut: 4 }));
    r = { ...r, rounds: r.rounds.map((x) => ({ ...x, status: 'CLOSED' as const })) };
    r = unwrap(openRound(r, { name: 'Semis', groups: 2, numberTeamsOut: 2 }));
    expect(r.rounds[1]).toMatchObject({
      id: 'round-2',
      index: 2,
      name: 'Semis',
      numberTeamsIn: 4,
      numberTeamsOut: 2,
    });
    expect(r.rounds[1]?.groups.map((g) => g.slots.length)).toEqual([2, 2]);
    expect(r.matches.filter((m) => m.roundId === 'round-2')).toHaveLength(2);
  });

  it('refuses a second open round and bad sizes', () => {
    const t = league();
    expect(openRound(t, { groups: 1, numberTeamsOut: 1 })).toMatchObject({
      ok: false,
      error: { code: 'ROUND_ALREADY_OPEN', roundId: 'round-1' },
    });
    const fresh = unwrap(createTournament({ id: 'x', teams: TEAMS }));
    for (const input of [
      { groups: 0, numberTeamsOut: 1 },
      { groups: 7, numberTeamsOut: 1 },
      { groups: 1, numberTeamsOut: 0 },
      { groups: 1, numberTeamsOut: 7 },
      { groups: 1, numberTeamsOut: 1, seed: [...TEAMS, 'extra'] },
    ]) {
      expect(openRound(fresh, input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
    }
    expect(openRound(fresh, { groups: 1, numberTeamsOut: 1, seed: ['ghost'] })).toMatchObject({
      ok: false,
      error: { code: 'TEAM_NOT_IN_TOURNAMENT' },
    });
  });

  it('never mutates its input', () => {
    const t = unwrap(createTournament({ id: 'x', teams: TEAMS }));
    const before = JSON.stringify(t);
    unwrap(openRound(t, { groups: 1, numberTeamsOut: 1, seed: TEAMS }));
    expect(JSON.stringify(t)).toBe(before);
  });
});

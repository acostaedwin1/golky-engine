import { describe, expect, it } from 'vitest';
import { computeGroupStandings, computeTournamentTable } from '../../src/standings/compute.ts';
import { firstGroupId, league, matchBetween, play, score, walkover } from '../helpers/builders.ts';

const order = (rows: { teamId: string }[]) => rows.map((r) => r.teamId);

describe('computeGroupStandings', () => {
  it('starts everyone at zero in slot order', () => {
    const t = league(['a', 'b', 'c']);
    const table = computeGroupStandings(t, firstGroupId(t));
    expect(order(table)).toEqual(['a', 'b', 'c']);
    expect(table[0]).toEqual({
      position: 1,
      teamId: 'a',
      played: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      averagePoints: 0,
    });
    expect(computeGroupStandings(t, 'nope')).toEqual([]);
  });

  it('ranks by points first', () => {
    let t = league(['a', 'b', 'c']);
    t = score(t, 'a', 'b', 1, 0);
    t = score(t, 'b', 'c', 2, 2);
    const table = computeGroupStandings(t, firstGroupId(t));
    // b and c both have 1 point; c's goal difference (0) beats b's (-1).
    expect(order(table)).toEqual(['a', 'c', 'b']);
    expect(table.map((r) => r.points)).toEqual([3, 1, 1]);
    expect(table[2]).toMatchObject({
      teamId: 'b',
      played: 2,
      wins: 0,
      ties: 1,
      losses: 1,
      goalsFor: 2,
      goalsAgainst: 3,
      goalDifference: -1,
      averagePoints: 0.5,
    });
  });

  it('breaks equal points by goal difference', () => {
    let t = league(['a', 'b', 'c', 'd']);
    t = score(t, 'a', 'c', 3, 0); // a +3
    t = score(t, 'b', 'd', 1, 0); // b +1
    expect(order(computeGroupStandings(t, firstGroupId(t)))).toEqual(['a', 'b', 'd', 'c']);
  });

  it('then by fewer goals against, which makes goals for unreachable in the production chain', () => {
    // Equal points and goal difference; a conceded fewer.
    let t = league(['a', 'b', 'c', 'd']);
    t = score(t, 'a', 'c', 1, 0); // a: GF1 GA0
    t = score(t, 'b', 'd', 2, 1); // b: GF2 GA1 (same +1)
    expect(order(computeGroupStandings(t, firstGroupId(t)))).toEqual(['a', 'b', 'c', 'd']);

    // Equal points and GD: goals against decides before goals for (1-1 beats 2-2).
    let u = league(['a', 'b', 'c', 'd']);
    u = score(u, 'a', 'c', 1, 1);
    u = score(u, 'b', 'd', 2, 2);
    expect(order(computeGroupStandings(u, firstGroupId(u)))).toEqual(['a', 'c', 'b', 'd']);
    // With GD and GA equal, GF is equal too (GD = GF - GA): 'goalsFor' only ever
    // matters in a custom chain that puts it before 'goalsAgainst'.
    const byGoalsFor = {
      ...u,
      rules: { ...u.rules, tieBreakers: ['points', 'goalsFor'] as const },
    };
    expect(order(computeGroupStandings(byGoalsFor, firstGroupId(u)))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('then by wins', () => {
    let v = league(['a', 'b', 'c', 'd'], { points: { win: 2, tied: 1, loser: 0 } });
    v = score(v, 'a', 'b', 1, 1);
    v = score(v, 'a', 'c', 1, 1);
    v = score(v, 'd', 'b', 2, 0);
    v = score(v, 'd', 'c', 0, 2);
    const table = computeGroupStandings(v, firstGroupId(v));
    const a = table.find((r) => r.teamId === 'a');
    const d = table.find((r) => r.teamId === 'd');
    expect(a).toMatchObject({
      points: 2,
      goalDifference: 0,
      goalsAgainst: 2,
      goalsFor: 2,
      wins: 0,
    });
    expect(d).toMatchObject({
      points: 2,
      goalDifference: 0,
      goalsAgainst: 2,
      goalsFor: 2,
      wins: 1,
    });
    expect((d?.position ?? 0) < (a?.position ?? 0)).toBe(true);
  });

  it('a walkover loser gets 0 points even when losing normally pays 1', () => {
    let t = league(['a', 'b', 'c', 'd'], { points: { win: 3, tied: 1, loser: 1 } });
    t = score(t, 'a', 'b', 1, 0);
    t = (() => {
      const id = matchBetween(t, 'c', 'd');
      const r = play(t, id, walkover('c'));
      if (!r.ok) throw new Error(r.error.code);
      return r.value;
    })();
    const table = computeGroupStandings(t, firstGroupId(t));
    expect(table.find((r) => r.teamId === 'b')).toMatchObject({ points: 1, losses: 1 });
    expect(table.find((r) => r.teamId === 'd')).toMatchObject({
      points: 0,
      losses: 1,
      goalsAgainst: 3,
    });
    expect(table.find((r) => r.teamId === 'c')).toMatchObject({ points: 3, wins: 1, goalsFor: 3 });
  });

  it('head-to-head breaks a full tie only when enabled', () => {
    const tieBreakers = ['points', 'goalDifference', 'goalsAgainst', 'goalsFor', 'wins'] as const;
    let u = league(['a', 'b', 'c', 'd'], { tieBreakers: [...tieBreakers] });
    u = score(u, 'b', 'a', 2, 1); // b beat a
    u = score(u, 'a', 'c', 2, 1); // a: 3 pts, GF3 GA3, 1 win
    u = score(u, 'd', 'b', 2, 1); // b: 3 pts, GF3 GA3, 1 win ; d: 3 pts, +1 -> first
    const withoutH2H = computeGroupStandings(u, firstGroupId(u));
    expect(order(withoutH2H)).toEqual(['d', 'a', 'b', 'c']); // slot order keeps a above b
    const withH2H = {
      ...u,
      rules: { ...u.rules, tieBreakers: [...tieBreakers, 'headToHead' as const] },
    };
    expect(order(computeGroupStandings(withH2H, firstGroupId(u)))).toEqual(['d', 'b', 'a', 'c']);
  });

  it('respects a custom tie-breaker order', () => {
    let t = league(['a', 'b', 'c', 'd'], { tieBreakers: ['goalsFor', 'points'] });
    t = score(t, 'a', 'b', 1, 0); // a 3pts GF1
    t = score(t, 'c', 'd', 3, 3); // c 1pt GF3
    expect(order(computeGroupStandings(t, firstGroupId(t))).slice(0, 2)).toEqual(['c', 'd']);
  });

  it('penaltiesCountAsGoals: false keeps penalties out of the table', () => {
    let t = league(['a', 'b'], { penaltiesCountAsGoals: false });
    const id = matchBetween(t, 'a', 'b');
    const r = play(t, id, {
      kind: 'PLAYED',
      home: { players: [], otherPlayers: { goals: 1, penalties: 4 } },
      away: { players: [], otherPlayers: { goals: 2, penalties: 0 } },
    });
    if (!r.ok) throw new Error(r.error.code);
    t = r.value;
    const table = computeGroupStandings(t, firstGroupId(t));
    expect(table[0]).toMatchObject({ teamId: 'b', goalsFor: 2, goalsAgainst: 1, points: 3 });
  });
});

describe('computeTournamentTable', () => {
  it('ranks by average points per match before anything else, rounded to 2 decimals', () => {
    let t = league(['a', 'b', 'c', 'd']);
    t = score(t, 'a', 'b', 1, 0); // a 3/1
    t = score(t, 'a', 'c', 1, 0); // a 6/2 = 3.00
    t = score(t, 'd', 'b', 1, 0); // d 3/1
    t = score(t, 'd', 'c', 1, 0); // d 6/2
    t = score(t, 'd', 'a', 1, 1); // d 7/3 = 2.33 ; a 7/3
    t = score(t, 'b', 'c', 0, 0); // b 1/3, c 1/3
    const table = computeTournamentTable(t);
    expect(table.map((r) => [r.teamId, r.averagePoints])).toEqual([
      ['a', 2.33],
      ['d', 2.33],
      ['b', 0.33],
      ['c', 0.33],
    ]);
    // a and d tie on average and points; a has GD +2? a: GF3 GA1 ; d: GF3 GA1 -> GA equal, GF equal, wins equal -> slot order.
  });

  it('a team with a game in hand and a better ratio ranks higher', () => {
    let t = league(['a', 'b', 'c', 'd']);
    t = score(t, 'a', 'b', 1, 0);
    t = score(t, 'a', 'c', 1, 0); // a: 6 pts / 2 = 3.00
    t = score(t, 'd', 'b', 1, 0);
    t = score(t, 'd', 'c', 1, 0);
    t = score(t, 'd', 'a', 1, 1); // d: 7 pts / 3 = 2.33 ; a: 7 / 3
    t = score(t, 'c', 'b', 1, 0); // c: 3/3 = 1.00
    // give a one more win so it has 10/4 = 2.5 vs d 7/3 = 2.33 (a has more points AND better avg)
    const table = computeTournamentTable(t);
    const a = table.find((r) => r.teamId === 'a');
    const d = table.find((r) => r.teamId === 'd');
    expect(a?.averagePoints).toBe(2.33);
    expect(d?.averagePoints).toBe(2.33);
    // Now a scenario where fewer points but better average wins:
    let u = league(['a', 'b', 'c', 'd']);
    u = score(u, 'a', 'b', 1, 0); // a 3/1 = 3.00
    u = score(u, 'c', 'd', 1, 0);
    u = score(u, 'c', 'b', 1, 1);
    u = score(u, 'c', 'a', 1, 1); // c 5/3 = 1.67 ; a 4/2 = 2.00
    expect(order(computeTournamentTable(u)).slice(0, 2)).toEqual(['a', 'c']);
    expect(computeTournamentTable(u)[0]?.points).toBe(4);
    expect(computeTournamentTable(u)[1]?.points).toBe(5);
  });
});

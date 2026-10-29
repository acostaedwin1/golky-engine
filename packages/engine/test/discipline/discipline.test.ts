import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fineFor, listFines } from '../../src/discipline/fines.ts';
import { disciplineRanking, topScorers } from '../../src/discipline/ranking.ts';
import { publishMatch, unpublishMatch } from '../../src/match/lifecycle.ts';
import { unwrap } from '../../src/result.ts';
import { league, line, matchBetween, play, sheet, walkover } from '../helpers/builders.ts';

const cards = { yellowCost: 5, redCost: 20, blueCost: 8 };

describe('fineFor', () => {
  it('charges reds alone, otherwise the larger of yellows and blues', () => {
    expect(fineFor(line('p', { yellow: 2, red: 1 }), cards)).toEqual({ amount: 20, basis: 'red' });
    expect(fineFor(line('p', { red: 2, blue: 3 }), cards)).toEqual({ amount: 40, basis: 'red' });
    expect(fineFor(line('p', { yellow: 2, blue: 1 }), cards)).toEqual({
      amount: 10,
      basis: 'yellow',
    });
    expect(fineFor(line('p', { yellow: 1, blue: 1 }), cards)).toEqual({ amount: 8, basis: 'blue' });
    expect(fineFor(line('p', { yellow: 2 }), { ...cards, yellowCost: 0 })).toBeNull();
    expect(fineFor(line('p', { red: 1 }), { ...cards, redCost: 0 })).toBeNull();
    expect(fineFor(line('p'), cards)).toBeNull();
  });
});

describe('listFines / rankings', () => {
  function sample() {
    let t = league(['a', 'b', 'c', 'd'], { cards });
    const ab = matchBetween(t, 'a', 'b');
    t = unwrap(
      play(t, ab, {
        kind: 'PLAYED',
        home: sheet(0, [
          line('p1', { goals: 2, yellow: 1 }),
          line('p2', { penalties: 1, red: 1, yellow: 1 }),
        ]),
        away: sheet(1, [line('p3', { goals: 1, blue: 2 }), line('p4')]),
      }),
    );
    return { t, ab };
  }

  it('lists one fine per player per published match, in sheet order', () => {
    const { t, ab } = sample();
    expect(listFines(t)).toEqual([
      { matchId: ab, teamId: 'a', playerId: 'p1', amount: 5, basis: 'yellow' },
      { matchId: ab, teamId: 'a', playerId: 'p2', amount: 20, basis: 'red' },
      { matchId: ab, teamId: 'b', playerId: 'p3', amount: 16, basis: 'blue' },
    ]);
  });

  it('fines vanish on unpublish and come back on republish; walkovers produce nothing', () => {
    const { t, ab } = sample();
    const before = listFines(t);
    const hidden = unwrap(unpublishMatch(t, ab));
    expect(listFines(hidden)).toEqual([]);
    expect(topScorers(hidden)).toEqual([]);
    expect(listFines(unwrap(publishMatch(hidden, ab)))).toEqual(before);
    const cd = matchBetween(t, 'c', 'd');
    const withWalkover = unwrap(play(t, cd, walkover('c')));
    expect(listFines(withWalkover)).toEqual(before);
  });

  it('ranks discipline by red×2 + yellow + blue and scorers by goals without penalties', () => {
    const { t } = sample();
    expect(disciplineRanking(t)).toEqual([
      { playerId: 'p2', teamId: 'a', yellow: 1, red: 1, blue: 0, score: 3 },
      { playerId: 'p3', teamId: 'b', yellow: 0, red: 0, blue: 2, score: 2 },
      { playerId: 'p1', teamId: 'a', yellow: 1, red: 0, blue: 0, score: 1 },
    ]);
    expect(topScorers(t)).toEqual([
      { playerId: 'p1', teamId: 'a', goals: 2 },
      { playerId: 'p3', teamId: 'b', goals: 1 },
    ]);
  });

  it('property: publishing then unpublishing a match leaves the fines exactly as they were', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ yellow: fc.nat(3), red: fc.nat(2), blue: fc.nat(3) }), {
          maxLength: 5,
        }),
        (lines) => {
          const { t } = sample();
          const cd = matchBetween(t, 'c', 'd');
          const before = listFines(t);
          const playersHome = lines.map((l, i) => line(`x${i}`, l));
          const after = unwrap(
            play(t, cd, { kind: 'PLAYED', home: sheet(0, playersHome), away: sheet() }),
          );
          expect(listFines(after).length).toBeGreaterThanOrEqual(before.length);
          expect(listFines(unwrap(unpublishMatch(after, cd)))).toEqual(before);
        },
      ),
    );
  });
});

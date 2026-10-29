import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateRoundRobin, type Matchday, matchdayLabel } from '../../src/fixture/round-robin.ts';

function stats(fixture: readonly Matchday[]) {
  const home = new Map<number, number>();
  const away = new Map<number, number>();
  const pairs = new Map<string, number>();
  let clashes = 0;
  for (const matchday of fixture) {
    const seen = new Set<number>();
    for (const [h, a] of matchday) {
      home.set(h, (home.get(h) ?? 0) + 1);
      away.set(a, (away.get(a) ?? 0) + 1);
      const key = h < a ? `${h}-${a}` : `${a}-${h}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
      if (seen.has(h) || seen.has(a)) clashes += 1;
      seen.add(h).add(a);
    }
  }
  return { home, away, pairs, clashes };
}

describe('generateRoundRobin', () => {
  it('6 teams: 15 matches over 5 matchdays, balanced home/away, highest place fixed', () => {
    const fixture = generateRoundRobin(6);
    expect(fixture).toHaveLength(5);
    expect(fixture.flat()).toHaveLength(15);
    const { home, away, pairs, clashes } = stats(fixture);
    expect(clashes).toBe(0);
    expect(pairs.size).toBe(15);
    for (let place = 1; place <= 6; place++) {
      expect(Math.abs((home.get(place) ?? 0) - (away.get(place) ?? 0))).toBeLessThanOrEqual(1);
    }
    // Place 6 appears in every matchday (it is the fixed team) and alternates sides.
    const sides = fixture.map((md) => md.find((p) => p.includes(6))).map((p) => p?.[0] === 6);
    expect(sides).toEqual([false, true, false, true, false]);
  });

  it('matches the published Berger table for 6 teams', () => {
    expect(generateRoundRobin(6)).toEqual([
      [
        [1, 6],
        [2, 5],
        [3, 4],
      ],
      [
        [6, 4],
        [5, 3],
        [1, 2],
      ],
      [
        [2, 6],
        [3, 1],
        [4, 5],
      ],
      [
        [6, 5],
        [1, 4],
        [2, 3],
      ],
      [
        [3, 6],
        [4, 2],
        [5, 1],
      ],
    ]);
  });

  it('5 teams: 5 matchdays of 2 matches, each place rests exactly once', () => {
    const fixture = generateRoundRobin(5);
    expect(fixture).toHaveLength(5);
    const rests: number[] = [];
    for (const matchday of fixture) {
      expect(matchday).toHaveLength(2);
      const playing = new Set(matchday.flat());
      const resting = [1, 2, 3, 4, 5].filter((p) => !playing.has(p));
      expect(resting).toHaveLength(1);
      rests.push(resting[0] as number);
    }
    expect([...rests].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('2 teams: a single match on J1 (a knockout tie)', () => {
    expect(generateRoundRobin(2)).toEqual([[[1, 2]]]);
    expect(matchdayLabel(1)).toBe('J1');
  });

  it('4 teams with two legs: 12 matches over 6 matchdays, second leg mirrored', () => {
    const fixture = generateRoundRobin(4, { legs: 2 });
    expect(fixture).toHaveLength(6);
    expect(fixture.flat()).toHaveLength(12);
    for (let k = 0; k < 3; k++) {
      const first = fixture[k] as Matchday;
      const second = fixture[k + 3] as Matchday;
      expect(second).toEqual(first.map(([h, a]) => [a, h]));
    }
    const { home, away } = stats(fixture);
    for (let place = 1; place <= 4; place++) expect(home.get(place)).toBe(away.get(place));
  });

  it('returns nothing for fewer than 2 places or non-integers', () => {
    expect(generateRoundRobin(1)).toEqual([]);
    expect(generateRoundRobin(0)).toEqual([]);
    expect(generateRoundRobin(2.5)).toEqual([]);
  });

  it('property: every pair meets exactly `legs` times, nobody plays twice per matchday, sides balanced', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 40 }), fc.constantFrom(1, 2), (n, legs) => {
        const fixture = generateRoundRobin(n, { legs: legs as 1 | 2 });
        const expectedMatchdays = (n % 2 === 0 ? n - 1 : n) * legs;
        expect(fixture).toHaveLength(expectedMatchdays);
        const { home, away, pairs, clashes } = stats(fixture);
        expect(clashes).toBe(0);
        expect(pairs.size).toBe((n * (n - 1)) / 2);
        for (const count of pairs.values()) expect(count).toBe(legs);
        for (let place = 1; place <= n; place++) {
          const diff = Math.abs((home.get(place) ?? 0) - (away.get(place) ?? 0));
          expect(diff).toBeLessThanOrEqual(legs === 2 ? 0 : 1);
        }
      }),
      { numRuns: 200 },
    );
  });
});

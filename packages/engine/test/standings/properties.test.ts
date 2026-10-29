import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  confirmMatch,
  publishMatch,
  recordResult,
  unpublishMatch,
} from '../../src/match/lifecycle.ts';
import type { MatchResult, Tournament } from '../../src/model.ts';
import { unwrap } from '../../src/result.ts';
import { computeGroupStandings, computeTournamentTable } from '../../src/standings/compute.ts';
import { firstGroupId, league, played, walkover, when } from '../helpers/builders.ts';

const TEAMS = ['a', 'b', 'c', 'd'];
const resultArb: fc.Arbitrary<(home: string) => MatchResult> = fc.oneof(
  fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })).map(
    ([h, a]) =>
      () =>
        played(h, a),
  ),
  fc.constant((home: string) => walkover(home)),
);

/** All six matches confirmed and recorded (PLAYED), with the given results. */
function recorded(results: ReadonlyArray<(home: string) => MatchResult>): Tournament {
  let t = league(TEAMS);
  t.matches.forEach((m, i) => {
    const make = results[i % results.length];
    if (!make) throw new Error('no result');
    t = unwrap(confirmMatch(t, m.id, when));
    t = unwrap(recordResult(t, m.id, make(m.home as string)));
  });
  return t;
}

describe('standings properties', () => {
  it('the table depends only on the set of published matches, not on the publish/unpublish history', () => {
    fc.assert(
      fc.property(
        fc.array(resultArb, { minLength: 6, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 40 }),
        (results, toggles) => {
          let t = recorded(results);
          const ids = t.matches.map((m) => m.id);
          for (const i of toggles) {
            const id = ids[i] as string;
            const status = t.matches.find((m) => m.id === id)?.status;
            t = unwrap(status === 'PUBLISHED' ? unpublishMatch(t, id) : publishMatch(t, id));
          }
          const published = new Set(
            t.matches.filter((m) => m.status === 'PUBLISHED').map((m) => m.id),
          );
          let direct = recorded(results);
          for (const id of ids) if (published.has(id)) direct = unwrap(publishMatch(direct, id));

          const g = firstGroupId(t);
          expect(computeGroupStandings(t, g)).toEqual(computeGroupStandings(direct, g));
          expect(computeTournamentTable(t)).toEqual(computeTournamentTable(direct));
          expect(computeGroupStandings(t, g)).toEqual(computeGroupStandings(t, g));
          for (const row of computeGroupStandings(t, g)) {
            for (const key of [
              'played',
              'wins',
              'ties',
              'losses',
              'goalsFor',
              'goalsAgainst',
              'points',
            ] as const) {
              expect(row[key]).toBeGreaterThanOrEqual(0);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('goals and results balance out, and points follow the formula', () => {
    fc.assert(
      fc.property(
        fc.array(resultArb, { minLength: 6, maxLength: 6 }),
        fc.subarray([0, 1, 2, 3, 4, 5]),
        fc.record({
          win: fc.integer({ min: 0, max: 5 }),
          tied: fc.integer({ min: 0, max: 5 }),
          loser: fc.integer({ min: 0, max: 5 }),
        }),
        (results, which, points) => {
          let t = { ...recorded(results), rules: { ...league(TEAMS).rules, points } };
          const ids = t.matches.map((m) => m.id);
          for (const i of which) t = unwrap(publishMatch(t, ids[i] as string));
          const table = computeGroupStandings(t, firstGroupId(t));
          const sum = (key: 'goalsFor' | 'goalsAgainst' | 'wins' | 'losses' | 'ties' | 'played') =>
            table.reduce((acc, r) => acc + r[key], 0);
          expect(sum('goalsFor')).toBe(sum('goalsAgainst'));
          expect(sum('wins')).toBe(sum('losses'));
          expect(sum('ties') % 2).toBe(0);
          expect(sum('played')).toBe(which.length * 2);
          const walkoverLosses = new Map<string, number>();
          for (const m of t.matches) {
            if (m.status === 'PUBLISHED' && m.result?.kind === 'WALKOVER') {
              const loser = m.result.winner === m.home ? m.away : m.home;
              walkoverLosses.set(loser as string, (walkoverLosses.get(loser as string) ?? 0) + 1);
            }
          }
          for (const row of table) {
            const normalLosses = row.losses - (walkoverLosses.get(row.teamId) ?? 0);
            expect(row.points).toBe(
              row.wins * points.win + row.ties * points.tied + normalLosses * points.loser,
            );
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('the order never depends on the order matches are stored in', () => {
    fc.assert(
      fc.property(
        fc.array(resultArb, { minLength: 6, maxLength: 6 }),
        fc.shuffledSubarray([0, 1, 2, 3, 4, 5], { minLength: 6 }),
        (results, permutation) => {
          let t = recorded(results);
          for (const m of t.matches) t = unwrap(publishMatch(t, m.id));
          const shuffled: Tournament = {
            ...t,
            matches: permutation.map((i) => t.matches[i] as Tournament['matches'][number]),
          };
          expect(computeGroupStandings(shuffled, firstGroupId(t))).toEqual(
            computeGroupStandings(t, firstGroupId(t)),
          );
          const table = computeGroupStandings(t, firstGroupId(t));
          for (let i = 1; i < table.length; i++) {
            const prev = table[i - 1] as (typeof table)[number];
            const cur = table[i] as (typeof table)[number];
            expect(prev.points >= cur.points).toBe(true);
            expect(prev.position).toBe(i);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

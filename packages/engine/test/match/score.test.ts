import { describe, expect, it } from 'vitest';
import { scoreMatch, sheetTotals } from '../../src/match/score.ts';
import type { Match } from '../../src/model.ts';
import { defaultRules } from '../../src/rules.ts';
import { line, played, sheet, walkover } from '../helpers/builders.ts';

const base: Match = {
  id: 'm',
  roundId: 'r',
  groupId: 'g',
  matchday: 1,
  homePlace: 1,
  awayPlace: 2,
  home: 'ajax',
  away: 'boca',
  status: 'PUBLISHED',
  schedule: null,
  result: null,
};

describe('scoreMatch', () => {
  it('sums player goals and otherPlayers goals', () => {
    const result = {
      kind: 'PLAYED' as const,
      home: sheet(1, [line('p1', { goals: 2 }), line('p2', { goals: 1 })]),
      away: sheet(3),
    };
    const s = scoreMatch({ ...base, result }, defaultRules);
    expect(s).toMatchObject({
      home: { teamId: 'ajax', goals: 4, total: 4 },
      away: { teamId: 'boca', goals: 3, total: 3 },
      outcome: 'HOME',
      walkover: false,
    });
    expect(sheetTotals(result.home)).toEqual({ goals: 4, penalties: 0 });
  });

  it('penalties decide and count as goals by default, and are ignored when disabled', () => {
    const result = { kind: 'PLAYED' as const, home: sheet(1, [], 2), away: sheet(2) };
    expect(scoreMatch({ ...base, result }, defaultRules)).toMatchObject({
      home: { goals: 1, penalties: 2, total: 3 },
      outcome: 'HOME',
    });
    expect(
      scoreMatch({ ...base, result }, { ...defaultRules, penaltiesCountAsGoals: false }),
    ).toMatchObject({
      home: { total: 1 },
      away: { total: 2 },
      outcome: 'AWAY',
    });
  });

  it('ties on equal totals', () => {
    expect(scoreMatch({ ...base, result: played(2, 2) }, defaultRules)?.outcome).toBe('TIE');
  });

  it('a walkover is goalsW–0 for the winner, on either side', () => {
    const rules = { ...defaultRules, walkover: { goalsW: 5 } };
    expect(scoreMatch({ ...base, result: walkover('boca') }, rules)).toMatchObject({
      home: { total: 0 },
      away: { total: 5 },
      outcome: 'AWAY',
      walkover: true,
    });
    expect(scoreMatch({ ...base, result: walkover('ajax') }, rules)).toMatchObject({
      home: { total: 5 },
      away: { total: 0 },
      outcome: 'HOME',
      walkover: true,
    });
  });

  it('returns null without a result or without both teams', () => {
    expect(scoreMatch(base, defaultRules)).toBeNull();
    expect(scoreMatch({ ...base, away: null, result: played(1, 0) }, defaultRules)).toBeNull();
  });
});

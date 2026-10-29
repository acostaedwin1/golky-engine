import { describe, expect, it } from 'vitest';
import { defaultRules, type RulesInput, resolveRules } from '../src/rules.ts';

describe('resolveRules', () => {
  it('returns the Golky profile when nothing is overridden', () => {
    const r = resolveRules();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual(defaultRules);
    expect(r.value.points).toEqual({ win: 3, tied: 1, loser: 0 });
    expect(r.value.tieBreakers).toEqual([
      'points',
      'goalDifference',
      'goalsAgainst',
      'goalsFor',
      'wins',
    ]);
    expect(r.value.suspensions.yellowThreshold).toBeNull();
  });

  it('merges nested overrides without losing the defaults', () => {
    const r = resolveRules({ points: { win: 2 }, cards: { yellowCost: 5 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.points).toEqual({ win: 2, tied: 1, loser: 0 });
    expect(r.value.cards).toEqual({ yellowCost: 5, redCost: 0, blueCost: 0 });
  });

  const invalidInputs: ReadonlyArray<readonly [RulesInput, string]> = [
    [{ points: { win: Number.NaN } }, 'points.win'],
    [{ walkover: { goalsW: -1 } }, 'goalsW'],
    [{ walkover: { goalsW: 1.5 } }, 'goalsW'],
    [{ tieBreakers: [] }, 'empty'],
    [{ tieBreakers: ['points', 'points'] }, 'duplicate'],
    [{ tieBreakers: ['magic' as never] }, 'unknown'],
    [{ cards: { redCost: -3 } }, 'cards.redCost'],
    [{ suspensions: { yellowThreshold: 0 } }, 'yellowThreshold'],
    [{ suspensions: { redBanMatchdays: -1 } }, 'matchdays'],
    [{ fixture: { legs: 3 as never } }, 'legs'],
    [{ fixture: { leftover: 'SPREAD' as never } }, 'leftover'],
  ];

  it.each(invalidInputs)('rejects %j', (input, fragment) => {
    const r = resolveRules(input);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('INVALID_RULES');
    if (r.error.code === 'INVALID_RULES') expect(r.error.reason).toContain(fragment);
  });

  it('exposes a frozen default profile', () => {
    expect(Object.isFrozen(defaultRules)).toBe(true);
    expect(Object.isFrozen(defaultRules.points)).toBe(true);
  });
});

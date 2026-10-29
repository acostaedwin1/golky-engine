import type { EngineError } from './errors.ts';
import { err, ok, type Result } from './result.ts';

export type LeftoverDistribution = 'PER_GROUP' | 'NEW_GROUP';

export type TieBreaker =
  | 'points'
  | 'goalDifference'
  | 'goalsAgainst'
  | 'goalsFor'
  | 'wins'
  | 'headToHead'
  | 'averagePoints';

export const TIE_BREAKERS: readonly TieBreaker[] = [
  'points',
  'goalDifference',
  'goalsAgainst',
  'goalsFor',
  'wins',
  'headToHead',
  'averagePoints',
];

/** Everything an organizer can configure. `defaultRules` is the profile production runs. */
export interface Rules {
  readonly points: { readonly win: number; readonly tied: number; readonly loser: number };
  readonly walkover: {
    /** Goals credited to the winner of a walkover (the loser gets 0 goals and 0 points). */
    readonly goalsW: number;
  };
  /**
   * When true, penalties in the match sheet count both to decide the winner and
   * as goals for/against in the table. This is how production behaves.
   */
  readonly penaltiesCountAsGoals: boolean;
  /** Applied in order after points; the first criterion that differs decides. */
  readonly tieBreakers: readonly TieBreaker[];
  readonly cards: {
    readonly yellowCost: number;
    readonly redCost: number;
    readonly blueCost: number;
  };
  /** Reserved for phase 1 (suspension enforcement). `yellowThreshold: null` disables it. */
  readonly suspensions: {
    readonly yellowThreshold: number | null;
    readonly yellowBanMatchdays: number;
    readonly redBanMatchdays: number;
  };
  readonly fixture: {
    /** 1 = single round-robin (production), 2 = home and away. */
    readonly legs: 1 | 2;
    readonly leftover: LeftoverDistribution;
  };
}

/** Deep-partial input for `resolveRules` / `createTournament`. */
export interface RulesInput {
  readonly points?: Partial<Rules['points']>;
  readonly walkover?: Partial<Rules['walkover']>;
  readonly penaltiesCountAsGoals?: boolean;
  readonly tieBreakers?: readonly TieBreaker[];
  readonly cards?: Partial<Rules['cards']>;
  readonly suspensions?: Partial<Rules['suspensions']>;
  readonly fixture?: Partial<Rules['fixture']>;
}

/**
 * The Golky profile: 3/1/0 points, a 3-0 walkover, penalties count as goals,
 * production's tie-breaker chain, no suspension enforcement, single round-robin.
 */
export const defaultRules: Rules = Object.freeze({
  points: Object.freeze({ win: 3, tied: 1, loser: 0 }),
  walkover: Object.freeze({ goalsW: 3 }),
  penaltiesCountAsGoals: true,
  tieBreakers: Object.freeze(['points', 'goalDifference', 'goalsAgainst', 'goalsFor', 'wins']),
  cards: Object.freeze({ yellowCost: 0, redCost: 0, blueCost: 0 }),
  suspensions: Object.freeze({ yellowThreshold: null, yellowBanMatchdays: 1, redBanMatchdays: 1 }),
  fixture: Object.freeze({ legs: 1, leftover: 'PER_GROUP' }),
}) as Rules;

const invalid = (reason: string): EngineError => ({ code: 'INVALID_RULES', reason });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** Merges `input` over `defaultRules` and validates the outcome. */
export function resolveRules(input: RulesInput = {}): Result<Rules> {
  const rules: Rules = {
    points: { ...defaultRules.points, ...input.points },
    walkover: { ...defaultRules.walkover, ...input.walkover },
    penaltiesCountAsGoals: input.penaltiesCountAsGoals ?? defaultRules.penaltiesCountAsGoals,
    tieBreakers: input.tieBreakers ?? defaultRules.tieBreakers,
    cards: { ...defaultRules.cards, ...input.cards },
    suspensions: { ...defaultRules.suspensions, ...input.suspensions },
    fixture: { ...defaultRules.fixture, ...input.fixture },
  };

  for (const [key, value] of Object.entries(rules.points)) {
    if (!isFiniteNumber(value)) return err(invalid(`points.${key} must be a finite number`));
  }
  if (!isNonNegativeInteger(rules.walkover.goalsW)) {
    return err(invalid('walkover.goalsW must be a non-negative integer'));
  }
  if (rules.tieBreakers.length === 0) return err(invalid('tieBreakers must not be empty'));
  const seen = new Set<TieBreaker>();
  for (const tb of rules.tieBreakers) {
    if (!TIE_BREAKERS.includes(tb)) return err(invalid(`unknown tie-breaker "${String(tb)}"`));
    if (seen.has(tb)) return err(invalid(`duplicate tie-breaker "${tb}"`));
    seen.add(tb);
  }
  for (const [key, value] of Object.entries(rules.cards)) {
    if (!isFiniteNumber(value) || value < 0) {
      return err(invalid(`cards.${key} must be a non-negative number`));
    }
  }
  const { yellowThreshold, yellowBanMatchdays, redBanMatchdays } = rules.suspensions;
  if (yellowThreshold !== null && !(Number.isInteger(yellowThreshold) && yellowThreshold >= 1)) {
    return err(invalid('suspensions.yellowThreshold must be null or an integer >= 1'));
  }
  if (!isNonNegativeInteger(yellowBanMatchdays) || !isNonNegativeInteger(redBanMatchdays)) {
    return err(invalid('suspensions ban matchdays must be non-negative integers'));
  }
  if (rules.fixture.legs !== 1 && rules.fixture.legs !== 2) {
    return err(invalid('fixture.legs must be 1 or 2'));
  }
  if (rules.fixture.leftover !== 'PER_GROUP' && rules.fixture.leftover !== 'NEW_GROUP') {
    return err(invalid('fixture.leftover must be PER_GROUP or NEW_GROUP'));
  }
  return ok(rules);
}

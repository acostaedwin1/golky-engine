import type { TeamId } from '../ids.ts';
import type { Standing } from '../model.ts';
import type { TieBreaker } from '../rules.ts';

export type StandingRow = Omit<Standing, 'position'>;

export interface HeadToHeadRecord {
  readonly points: number;
  readonly goalDifference: number;
  readonly goalsFor: number;
}

/** `index.get(a)?.get(b)` is what `a` achieved in the matches against `b`. */
export type HeadToHeadIndex = ReadonlyMap<TeamId, ReadonlyMap<TeamId, HeadToHeadRecord>>;

function compareOne(
  criterion: TieBreaker,
  a: StandingRow,
  b: StandingRow,
  headToHead: HeadToHeadIndex | undefined,
): number {
  switch (criterion) {
    case 'points':
      return b.points - a.points;
    case 'goalDifference':
      return b.goalDifference - a.goalDifference;
    case 'goalsAgainst':
      return a.goalsAgainst - b.goalsAgainst;
    case 'goalsFor':
      return b.goalsFor - a.goalsFor;
    case 'wins':
      return b.wins - a.wins;
    case 'averagePoints':
      return b.averagePoints - a.averagePoints;
    case 'headToHead': {
      const ab = headToHead?.get(a.teamId)?.get(b.teamId);
      const ba = headToHead?.get(b.teamId)?.get(a.teamId);
      if (!ab || !ba) return 0;
      return (
        ba.points - ab.points || ba.goalDifference - ab.goalDifference || ba.goalsFor - ab.goalsFor
      );
    }
  }
}

/**
 * A comparator that applies the criteria in order and stops at the first one
 * that separates the two rows. Returns 0 when every criterion ties, so a stable
 * sort keeps the teams in their slot order.
 */
export function compareStandings(
  tieBreakers: readonly TieBreaker[],
  headToHead?: HeadToHeadIndex,
): (a: StandingRow, b: StandingRow) => number {
  return (a, b) => {
    for (const criterion of tieBreakers) {
      const delta = compareOne(criterion, a, b, headToHead);
      if (delta !== 0) return delta;
    }
    return 0;
  };
}

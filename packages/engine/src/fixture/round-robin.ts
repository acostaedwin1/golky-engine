/** A pairing of two 1-based places: `[home, away]`. */
export type Pairing = readonly [home: number, away: number];
/** One matchday: the pairings played together. */
export type Matchday = readonly Pairing[];

export interface RoundRobinOptions {
  /** 1 = every pair meets once; 2 = twice, the second leg with home and away swapped. */
  readonly legs?: 1 | 2;
}

/**
 * Single or double round-robin for `n` places (1..n), built as a Berger table.
 *
 * - Even n: n − 1 matchdays, the highest place stays fixed and alternates home/away,
 *   the rest rotate by n/2 each matchday. This is the layout production uses.
 * - Odd n: a phantom place n + 1 is added and its pairing dropped, so there are
 *   n matchdays and exactly one place rests on each.
 * - Every place is home and away a balanced number of times (difference ≤ 1).
 * - With `legs: 2`, matchdays n..2n−1 mirror the first leg with sides swapped.
 *
 * Returns an empty schedule for n < 2.
 */
export function generateRoundRobin(
  n: number,
  options: RoundRobinOptions = {},
): readonly Matchday[] {
  const legs = options.legs ?? 1;
  if (!Number.isInteger(n) || n < 2) return [];

  const odd = n % 2 === 1;
  const m = odd ? n + 1 : n;
  const half = m / 2;
  const rotating = m - 1;
  const firstLeg: Matchday[] = [];

  for (let r = 0; r < m - 1; r++) {
    const list: number[] = [];
    for (let k = 0; k < rotating; k++) list.push(((k + r * half) % rotating) + 1);
    const matchday: Pairing[] = [];
    const first = list[0] as number;
    if (!odd) matchday.push(r % 2 === 0 ? [first, m] : [m, first]);
    for (let i = 1; i < half; i++) {
      matchday.push([list[i] as number, list[m - 1 - i] as number]);
    }
    firstLeg.push(matchday);
  }

  if (legs === 1) return firstLeg;
  const secondLeg = firstLeg.map((matchday) =>
    matchday.map(([home, away]): Pairing => [away, home]),
  );
  return [...firstLeg, ...secondLeg];
}

/** "J1", "J2", … — the label production prints on fixtures and match sheets. */
export function matchdayLabel(matchday: number): string {
  return `J${matchday}`;
}

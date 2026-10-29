import type { LeftoverDistribution } from '../rules.ts';

/**
 * How many teams go in each group when `n` teams are split into `groups` groups.
 *
 * - `PER_GROUP`: leftovers are handed one each to the first groups → 14 teams in 4 groups = [4, 4, 3, 3].
 * - `NEW_GROUP`: leftovers form one extra group → 14 teams in 4 groups = [3, 3, 3, 3, 2].
 *
 * Returns an empty array when the inputs make no sense (`groups < 1` or `n < groups`).
 */
export function splitIntoGroups(
  n: number,
  groups: number,
  leftover: LeftoverDistribution = 'PER_GROUP',
): readonly number[] {
  if (!Number.isInteger(n) || !Number.isInteger(groups) || groups < 1 || n < groups) return [];
  const base = Math.floor(n / groups);
  const rest = n % groups;
  const sizes = Array.from({ length: groups }, () => base);
  if (rest === 0) return sizes;
  if (leftover === 'NEW_GROUP') return [...sizes, rest];
  return sizes.map((size, i) => (i < rest ? size + 1 : size));
}

/** 0 → "A", 25 → "Z", 26 → "AA", 27 → "AB", … (bijective base-26). */
export function groupLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) return '';
  let label = '';
  let i = index;
  for (;;) {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
    if (i < 0) return label;
  }
}

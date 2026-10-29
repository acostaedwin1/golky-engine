import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { groupLabel, splitIntoGroups } from '../../src/fixture/groups.ts';

describe('splitIntoGroups', () => {
  it('spreads leftovers over the first groups with PER_GROUP', () => {
    expect(splitIntoGroups(14, 4, 'PER_GROUP')).toEqual([4, 4, 3, 3]);
    expect(splitIntoGroups(12, 4)).toEqual([3, 3, 3, 3]);
    expect(splitIntoGroups(7, 1)).toEqual([7]);
  });

  it('puts leftovers in an extra group with NEW_GROUP', () => {
    expect(splitIntoGroups(14, 4, 'NEW_GROUP')).toEqual([3, 3, 3, 3, 2]);
    expect(splitIntoGroups(12, 4, 'NEW_GROUP')).toEqual([3, 3, 3, 3]);
  });

  it('returns nothing for impossible inputs', () => {
    expect(splitIntoGroups(3, 4)).toEqual([]);
    expect(splitIntoGroups(3, 0)).toEqual([]);
    expect(splitIntoGroups(3.5, 1)).toEqual([]);
  });

  it('property: sizes add up to n and PER_GROUP never differs by more than 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 1, max: 20 }), (n, g) => {
        fc.pre(n >= g);
        const perGroup = splitIntoGroups(n, g, 'PER_GROUP');
        expect(perGroup).toHaveLength(g);
        expect(perGroup.reduce((a, b) => a + b, 0)).toBe(n);
        expect(Math.max(...perGroup) - Math.min(...perGroup)).toBeLessThanOrEqual(1);
        const newGroup = splitIntoGroups(n, g, 'NEW_GROUP');
        expect(newGroup.reduce((a, b) => a + b, 0)).toBe(n);
        expect(newGroup.length === g || newGroup.length === g + 1).toBe(true);
      }),
    );
  });
});

describe('groupLabel', () => {
  it('counts A..Z then AA, AB, …', () => {
    expect(groupLabel(0)).toBe('A');
    expect(groupLabel(25)).toBe('Z');
    expect(groupLabel(26)).toBe('AA');
    expect(groupLabel(27)).toBe('AB');
    expect(groupLabel(51)).toBe('AZ');
    expect(groupLabel(52)).toBe('BA');
    expect(groupLabel(702)).toBe('AAA');
    expect(groupLabel(-1)).toBe('');
  });
});

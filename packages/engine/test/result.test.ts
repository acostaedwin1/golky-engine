import { describe, expect, it } from 'vitest';
import { describeError } from '../src/errors.ts';
import { chain, EngineResultError, err, map, ok, unwrap } from '../src/result.ts';

describe('Result helpers', () => {
  it('unwrap returns the value or throws a typed error', () => {
    expect(unwrap(ok(42))).toBe(42);
    expect(() => unwrap(err({ code: 'NO_OPEN_ROUND' }))).toThrow(EngineResultError);
    try {
      unwrap(err({ code: 'NO_OPEN_ROUND' }));
    } catch (e) {
      expect((e as EngineResultError).error).toEqual({ code: 'NO_OPEN_ROUND' });
      expect((e as Error).message).toContain('NO_OPEN_ROUND');
    }
  });

  it('map transforms successes and passes errors through', () => {
    expect(map(ok(2), (n) => n * 2)).toEqual(ok(4));
    const failure = err({ code: 'NO_OPEN_ROUND' as const });
    expect(map(failure, (n: number) => n * 2)).toBe(failure);
  });

  it('chain feeds each op the previous value and stops at the first error', () => {
    const calls: number[] = [];
    const r = chain(
      1,
      (n) => {
        calls.push(n);
        return ok(n + 1);
      },
      (n) => {
        calls.push(n);
        return err({ code: 'INVALID_INPUT' as const, reason: 'stop' });
      },
      (n) => {
        calls.push(n);
        return ok(n + 100);
      },
    );
    expect(r).toEqual(err({ code: 'INVALID_INPUT', reason: 'stop' }));
    expect(calls).toEqual([1, 2]);
    expect(chain(5)).toEqual(ok(5));
  });

  it('describeError renders every error code', () => {
    expect(describeError({ code: 'INVALID_INPUT', reason: 'x' })).toBe('INVALID_INPUT: x');
    expect(describeError({ code: 'NOT_FOUND', entity: 'match', id: 'm1' })).toContain('match "m1"');
    expect(
      describeError({ code: 'INVALID_TRANSITION', matchId: 'm1', from: 'READY', to: 'PUBLISHED' }),
    ).toContain('READY to PUBLISHED');
    expect(
      describeError({ code: 'ROUND_HAS_PENDING_MATCHES', roundId: 'r1', matchIds: ['a', 'b'] }),
    ).toContain('2 unpublished');
    expect(describeError({ code: 'PERSON_BANNED', matchedBy: 'email' })).toContain('email');
    expect(
      describeError({ code: 'PLAYER_ON_TWO_TEAMS', playerId: 'p', teams: ['a', 'b'] }),
    ).toContain('"a" and "b"');
    for (const e of [
      { code: 'INVALID_RULES', reason: 'r' },
      { code: 'ROUND_ALREADY_OPEN', roundId: 'r1' },
      { code: 'NO_OPEN_ROUND' },
      { code: 'TEAM_NOT_IN_TOURNAMENT', teamId: 't' },
      { code: 'TEAM_ALREADY_PLACED', roundId: 'r1', teamId: 't' },
      { code: 'SLOT_OUT_OF_RANGE', groupId: 'g', place: 9 },
      { code: 'SLOT_TAKEN', groupId: 'g', place: 1, occupiedBy: 't' },
      { code: 'INVALID_SCHEDULE', matchId: 'm', reason: 'r' },
      { code: 'INVALID_RESULT', matchId: 'm', reason: 'r' },
      { code: 'WALKOVER_REQUIRES_REPORT', matchId: 'm' },
      { code: 'WALKOVER_WINNER_NOT_IN_MATCH', matchId: 'm', winner: 'w' },
      { code: 'MISSING_RESULT', matchId: 'm' },
    ] as const) {
      expect(describeError(e)).toContain(e.code);
    }
  });
});

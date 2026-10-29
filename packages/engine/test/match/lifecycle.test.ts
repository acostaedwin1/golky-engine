import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cancelConfirmation,
  confirmMatch,
  publishMatch,
  recordResult,
  unpublishMatch,
} from '../../src/match/lifecycle.ts';
import type { MatchStatus, Tournament } from '../../src/model.ts';
import { type Result, unwrap } from '../../src/result.ts';
import { deepFreeze, league, line, played, sheet, walkover, when } from '../helpers/builders.ts';

const status = (t: Tournament, id: string): MatchStatus | undefined =>
  t.matches.find((m) => m.id === id)?.status;

const firstId = (t: Tournament): string => {
  const m = t.matches[0];
  if (!m) throw new Error('expected a match');
  return m.id;
};

describe('match lifecycle', () => {
  it('walks READY → CONFIRMED → PLAYED → PUBLISHED and back', () => {
    let t = league();
    const id = firstId(t);
    expect(status(t, id)).toBe('READY');
    t = unwrap(confirmMatch(t, id, when));
    expect(status(t, id)).toBe('CONFIRMED');
    expect(t.matches[0]?.schedule).toEqual(when);
    t = unwrap(recordResult(t, id, played(2, 1)));
    expect(status(t, id)).toBe('PLAYED');
    t = unwrap(publishMatch(t, id));
    expect(status(t, id)).toBe('PUBLISHED');
    t = unwrap(unpublishMatch(t, id));
    expect(status(t, id)).toBe('PLAYED');
    expect(t.matches[0]?.result).toEqual(played(2, 1));
  });

  it('rejects publishing twice, publishing without a result, and unknown matches', () => {
    let t = league();
    const id = firstId(t);
    t = unwrap(confirmMatch(t, id, when));
    expect(publishMatch(t, id)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION', from: 'CONFIRMED', to: 'PUBLISHED' },
    });
    t = unwrap(recordResult(t, id, played(0, 0)));
    t = unwrap(publishMatch(t, id));
    expect(publishMatch(t, id)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION', matchId: id, from: 'PUBLISHED', to: 'PUBLISHED' },
    });
    expect(recordResult(t, id, played(1, 1))).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION', from: 'PUBLISHED', to: 'PLAYED' },
    });
    const broken: Tournament = {
      ...t,
      matches: t.matches.map((m) => (m.id === id ? { ...m, status: 'PLAYED', result: null } : m)),
    };
    expect(publishMatch(broken, id)).toMatchObject({
      ok: false,
      error: { code: 'MISSING_RESULT' },
    });
    expect(confirmMatch(t, 'nope', when)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'match' },
    });
  });

  it('cancelling a confirmation clears the schedule', () => {
    let t = league();
    const id = firstId(t);
    t = unwrap(confirmMatch(t, id, when));
    t = unwrap(cancelConfirmation(t, id));
    expect(t.matches[0]).toMatchObject({ status: 'READY', schedule: null });
    expect(cancelConfirmation(t, id)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    });
  });

  it('validates the schedule', () => {
    const t = league();
    const id = firstId(t);
    expect(confirmMatch(t, id, { ...when, date: '' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SCHEDULE', reason: 'date is required' },
    });
    expect(confirmMatch(t, id, { ...when, locationId: ' ' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SCHEDULE' },
    });
  });

  it('validates walkovers: report required, winner must play the match', () => {
    let t = league();
    const id = firstId(t); // ajax vs flamengo
    t = unwrap(confirmMatch(t, id, when));
    expect(recordResult(t, id, walkover('ajax', '  '))).toMatchObject({
      ok: false,
      error: { code: 'WALKOVER_REQUIRES_REPORT' },
    });
    expect(recordResult(t, id, walkover('boca'))).toMatchObject({
      ok: false,
      error: { code: 'WALKOVER_WINNER_NOT_IN_MATCH', winner: 'boca' },
    });
    t = unwrap(recordResult(t, id, walkover('flamengo')));
    expect(t.matches[0]?.result).toEqual(walkover('flamengo'));
  });

  it('validates match sheets', () => {
    let t = league();
    const id = firstId(t);
    t = unwrap(confirmMatch(t, id, when));
    const bad = (home: ReturnType<typeof sheet>, away = sheet()) =>
      recordResult(t, id, { kind: 'PLAYED', home, away });
    const invalid = { ok: false, error: { code: 'INVALID_RESULT' } };
    expect(bad(sheet(-1))).toMatchObject(invalid);
    expect(bad(sheet(0, [line('p1', { goals: 1.5 })]))).toMatchObject(invalid);
    expect(bad(sheet(0, [line('p1'), line('p1')]))).toMatchObject(invalid);
    expect(bad(sheet(0, [line('')]))).toMatchObject(invalid);
    expect(bad(sheet(0, [line('p1', { shirtNumber: -4 })]))).toMatchObject(invalid);
    expect(bad(sheet(), sheet(0, [line('p2', { red: -1 })]))).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESULT', reason: expect.stringContaining('away') },
    });
    expect(recordResult(t, id, { kind: 'FORFEIT' } as never)).toMatchObject(invalid);
    expect(
      recordResult(t, id, {
        kind: 'PLAYED',
        home: sheet(1, [line('p1', { goals: 1 })]),
        away: sheet(),
      }).ok,
    ).toBe(true);
  });

  it('property: random operation sequences only follow legal transitions and never mutate inputs', () => {
    type Op = 'confirm' | 'cancel' | 'record' | 'publish' | 'unpublish';
    const legal: Record<Op, { from: MatchStatus[]; to: MatchStatus }> = {
      confirm: { from: ['READY'], to: 'CONFIRMED' },
      cancel: { from: ['CONFIRMED'], to: 'READY' },
      record: { from: ['CONFIRMED', 'PLAYED'], to: 'PLAYED' },
      publish: { from: ['PLAYED'], to: 'PUBLISHED' },
      unpublish: { from: ['PUBLISHED'], to: 'PLAYED' },
    };
    const run = (t: Tournament, id: string, op: Op): Result<Tournament> => {
      switch (op) {
        case 'confirm':
          return confirmMatch(t, id, when);
        case 'cancel':
          return cancelConfirmation(t, id);
        case 'record':
          return recordResult(t, id, played(1, 0));
        case 'publish':
          return publishMatch(t, id);
        case 'unpublish':
          return unpublishMatch(t, id);
      }
    };
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Op>('confirm', 'cancel', 'record', 'publish', 'unpublish'), {
          maxLength: 25,
        }),
        (ops) => {
          let t = deepFreeze(league(['a', 'b']));
          const id = firstId(t);
          for (const op of ops) {
            const before = status(t, id) as MatchStatus;
            const r = run(t, id, op);
            if (legal[op].from.includes(before)) {
              expect(r.ok).toBe(true);
              if (r.ok) {
                expect(status(r.value, id)).toBe(legal[op].to);
                t = deepFreeze(r.value);
              }
            } else {
              expect(r).toMatchObject({
                ok: false,
                error: { code: 'INVALID_TRANSITION', from: before },
              });
              expect(status(t, id)).toBe(before);
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

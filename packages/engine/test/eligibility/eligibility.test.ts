import { describe, expect, it } from 'vitest';
import { checkBanned } from '../../src/eligibility/banned.ts';
import { validateRosters } from '../../src/eligibility/roster.ts';

describe('checkBanned', () => {
  const banned = [
    { document: 'cc-100', reason: 'unpaid referee fees' },
    { email: 'Banned@Example.com' },
    { phone: '+57 300 123 4567' },
  ];

  it('matches by document, then email, then phone, ignoring case, spaces and phone punctuation', () => {
    expect(checkBanned({ document: ' CC-100 ' }, banned)).toEqual({
      ok: false,
      error: { code: 'PERSON_BANNED', matchedBy: 'document' },
    });
    expect(checkBanned({ email: 'banned@example.com' }, banned)).toEqual({
      ok: false,
      error: { code: 'PERSON_BANNED', matchedBy: 'email' },
    });
    expect(checkBanned({ phone: '3001234567' }, banned)).toEqual({ ok: true, value: undefined });
    expect(checkBanned({ phone: '(57) 300-123-4567' }, banned)).toEqual({
      ok: false,
      error: { code: 'PERSON_BANNED', matchedBy: 'phone' },
    });
    expect(checkBanned({ document: 'cc-100', email: 'banned@example.com' }, banned)).toMatchObject({
      error: { matchedBy: 'document' },
    });
    expect(
      checkBanned({ email: 'banned@example.com', phone: '573001234567' }, banned),
    ).toMatchObject({ error: { matchedBy: 'email' } });
  });

  it('passes clean people, empty values and empty lists', () => {
    expect(
      checkBanned({ document: 'cc-200', email: 'ok@example.com', phone: '1' }, banned),
    ).toEqual({ ok: true, value: undefined });
    expect(checkBanned({ document: '', email: '  ', phone: '+()' }, banned)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(checkBanned({ document: 'cc-100' }, [])).toEqual({ ok: true, value: undefined });
    expect(checkBanned({}, banned)).toEqual({ ok: true, value: undefined });
  });
});

describe('validateRosters', () => {
  it('finds a player listed on two different teams', () => {
    expect(
      validateRosters([
        { teamId: 'a', players: ['p1', 'p2'] },
        { teamId: 'b', players: ['p3', 'p2'] },
      ]),
    ).toEqual({
      ok: false,
      error: { code: 'PLAYER_ON_TWO_TEAMS', playerId: 'p2', teams: ['a', 'b'] },
    });
  });

  it('accepts disjoint rosters and tolerates a repeated line on the same team', () => {
    expect(
      validateRosters([
        { teamId: 'a', players: ['p1', 'p1'] },
        { teamId: 'b', players: ['p2'] },
      ]),
    ).toEqual({ ok: true, value: undefined });
    expect(validateRosters([])).toEqual({ ok: true, value: undefined });
  });
});

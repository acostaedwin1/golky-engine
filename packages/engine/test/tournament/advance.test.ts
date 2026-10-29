import { describe, expect, it } from 'vitest';
import { unwrap } from '../../src/result.ts';
import { advanceRound } from '../../src/tournament/advance.ts';
import { createTournament, openRound } from '../../src/tournament/create.ts';
import { league, play, played, TEAMS } from '../helpers/builders.ts';

describe('advanceRound', () => {
  it('refuses to close a round with unpublished matches and lists them', () => {
    const r = advanceRound(league());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('ROUND_HAS_PENDING_MATCHES');
    if (r.error.code === 'ROUND_HAS_PENDING_MATCHES') {
      expect(r.error.roundId).toBe('round-1');
      expect(r.error.matchIds).toHaveLength(15);
    }
  });

  it('closes the round once every match is published', () => {
    let t = league(['a', 'b']);
    const only = t.matches[0];
    if (!only) throw new Error('expected a match');
    t = unwrap(play(t, only.id, played(1, 0)));
    t = unwrap(advanceRound(t));
    expect(t.rounds[0]?.status).toBe('CLOSED');
    expect(advanceRound(t)).toMatchObject({ ok: false, error: { code: 'NO_OPEN_ROUND' } });
  });

  it('force-closes, suspends what is pending, and the next round takes numberTeamsOut slots', () => {
    let t = unwrap(createTournament({ id: 'x', teams: TEAMS }));
    t = unwrap(openRound(t, { groups: 2, numberTeamsOut: 4, seed: TEAMS }));
    const first = t.matches[0];
    if (!first) throw new Error('expected a match');
    t = unwrap(play(t, first.id, played(2, 2)));
    t = unwrap(advanceRound(t, { force: true }));
    expect(t.rounds[0]?.status).toBe('CLOSED');
    const statuses = t.matches.map((m) => m.status);
    expect(statuses.filter((s) => s === 'PUBLISHED')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'SUSPENDED')).toHaveLength(5);
    t = unwrap(openRound(t, { groups: 2, numberTeamsOut: 2 }));
    expect(t.rounds[1]).toMatchObject({ numberTeamsIn: 4, numberTeamsOut: 2, status: 'OPEN' });
    expect(t.rounds[1]?.groups.map((g) => g.slots.length)).toEqual([2, 2]);
  });
});

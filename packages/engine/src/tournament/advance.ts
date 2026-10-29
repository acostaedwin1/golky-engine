import type { MatchStatus, Tournament } from '../model.ts';
import { err, ok, type Result } from '../result.ts';

export interface AdvanceRoundOptions {
  /** Close the round even if matches are pending; they become SUSPENDED. */
  readonly force?: boolean;
}

const PENDING: readonly MatchStatus[] = ['CREATED', 'READY', 'CONFIRMED', 'PLAYED'];

/**
 * Closes the open round. Refused while any of its matches is still unpublished,
 * unless `force` is set, in which case those matches are marked SUSPENDED (what
 * production calls "forzar cierre de ronda"). Open the next round with `openRound`.
 */
export function advanceRound(
  tournament: Tournament,
  options: AdvanceRoundOptions = {},
): Result<Tournament> {
  const open = tournament.rounds.find((r) => r.status === 'OPEN');
  if (!open) return err({ code: 'NO_OPEN_ROUND' });
  const pending = tournament.matches.filter(
    (m) => m.roundId === open.id && PENDING.includes(m.status),
  );
  if (pending.length > 0 && !options.force) {
    return err({
      code: 'ROUND_HAS_PENDING_MATCHES',
      roundId: open.id,
      matchIds: pending.map((m) => m.id),
    });
  }
  const suspended = new Set(pending.map((m) => m.id));
  const matches =
    suspended.size === 0
      ? tournament.matches
      : tournament.matches.map((m) =>
          suspended.has(m.id) ? { ...m, status: 'SUSPENDED' as const } : m,
        );
  const rounds = tournament.rounds.map((r) =>
    r.id === open.id ? { ...r, status: 'CLOSED' as const } : r,
  );
  return ok({ ...tournament, rounds, matches });
}

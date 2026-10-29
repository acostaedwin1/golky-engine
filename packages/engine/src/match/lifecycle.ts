import type { MatchId } from '../ids.ts';
import type {
  Match,
  MatchResult,
  MatchSchedule,
  MatchStatus,
  TeamSheet,
  Tournament,
} from '../model.ts';
import { err, ok, type Result } from '../result.ts';

function findMatch(tournament: Tournament, matchId: MatchId): Result<Match> {
  const match = tournament.matches.find((m) => m.id === matchId);
  return match ? ok(match) : err({ code: 'NOT_FOUND', entity: 'match', id: matchId });
}

function replaceMatch(tournament: Tournament, match: Match): Tournament {
  return { ...tournament, matches: tournament.matches.map((m) => (m.id === match.id ? match : m)) };
}

function transition(match: Match, from: readonly MatchStatus[], to: MatchStatus): Result<Match> {
  if (!from.includes(match.status)) {
    return err({ code: 'INVALID_TRANSITION', matchId: match.id, from: match.status, to });
  }
  return ok(match);
}

const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

function validateSheet(sheet: TeamSheet, side: 'home' | 'away'): string | null {
  if (!sheet || !Array.isArray(sheet.players) || !sheet.otherPlayers) {
    return `${side} sheet is malformed`;
  }
  if (!isCount(sheet.otherPlayers.goals) || !isCount(sheet.otherPlayers.penalties)) {
    return `${side} otherPlayers must have non-negative integer goals and penalties`;
  }
  const seen = new Set<string>();
  for (const line of sheet.players) {
    if (typeof line.playerId !== 'string' || line.playerId === '') {
      return `${side} sheet has a line without playerId`;
    }
    if (seen.has(line.playerId)) return `${side} sheet lists player "${line.playerId}" twice`;
    seen.add(line.playerId);
    if (!isCount(line.shirtNumber))
      return `${side} player "${line.playerId}" has an invalid shirt number`;
    for (const field of ['goals', 'penalties', 'yellow', 'red', 'blue'] as const) {
      if (!isCount(line[field])) {
        return `${side} player "${line.playerId}" has an invalid ${field} count`;
      }
    }
  }
  return null;
}

function validateResult(match: Match, result: MatchResult): Result<MatchResult> {
  if (result.kind === 'WALKOVER') {
    if (typeof result.refereeReport !== 'string' || result.refereeReport.trim() === '') {
      return err({ code: 'WALKOVER_REQUIRES_REPORT', matchId: match.id });
    }
    if (result.winner !== match.home && result.winner !== match.away) {
      return err({
        code: 'WALKOVER_WINNER_NOT_IN_MATCH',
        matchId: match.id,
        winner: result.winner,
      });
    }
    return ok(result);
  }
  if (result.kind !== 'PLAYED') {
    return err({ code: 'INVALID_RESULT', matchId: match.id, reason: 'unknown result kind' });
  }
  const reason = validateSheet(result.home, 'home') ?? validateSheet(result.away, 'away');
  return reason ? err({ code: 'INVALID_RESULT', matchId: match.id, reason }) : ok(result);
}

/** READY → CONFIRMED. Needs a location, a field and a date. */
export function confirmMatch(
  tournament: Tournament,
  matchId: MatchId,
  schedule: MatchSchedule,
): Result<Tournament> {
  const found = findMatch(tournament, matchId);
  if (!found.ok) return found;
  const allowed = transition(found.value, ['READY'], 'CONFIRMED');
  if (!allowed.ok) return allowed;
  for (const field of ['locationId', 'fieldId', 'date'] as const) {
    if (typeof schedule?.[field] !== 'string' || schedule[field].trim() === '') {
      return err({ code: 'INVALID_SCHEDULE', matchId, reason: `${field} is required` });
    }
  }
  return ok(
    replaceMatch(tournament, { ...found.value, status: 'CONFIRMED', schedule: { ...schedule } }),
  );
}

/** CONFIRMED → READY. Clears the schedule. */
export function cancelConfirmation(tournament: Tournament, matchId: MatchId): Result<Tournament> {
  const found = findMatch(tournament, matchId);
  if (!found.ok) return found;
  const allowed = transition(found.value, ['CONFIRMED'], 'READY');
  if (!allowed.ok) return allowed;
  return ok(replaceMatch(tournament, { ...found.value, status: 'READY', schedule: null }));
}

/**
 * CONFIRMED | PLAYED → PLAYED. Stores the match sheet (or walkover) after
 * validating it. Recording again before publishing simply replaces the result.
 */
export function recordResult(
  tournament: Tournament,
  matchId: MatchId,
  result: MatchResult,
): Result<Tournament> {
  const found = findMatch(tournament, matchId);
  if (!found.ok) return found;
  const allowed = transition(found.value, ['CONFIRMED', 'PLAYED'], 'PLAYED');
  if (!allowed.ok) return allowed;
  const valid = validateResult(found.value, result);
  if (!valid.ok) return valid;
  return ok(replaceMatch(tournament, { ...found.value, status: 'PLAYED', result: valid.value }));
}

/** PLAYED → PUBLISHED. From here on the match counts for standings, fines and scorers. */
export function publishMatch(tournament: Tournament, matchId: MatchId): Result<Tournament> {
  const found = findMatch(tournament, matchId);
  if (!found.ok) return found;
  const allowed = transition(found.value, ['PLAYED'], 'PUBLISHED');
  if (!allowed.ok) return allowed;
  if (!found.value.result) return err({ code: 'MISSING_RESULT', matchId });
  return ok(replaceMatch(tournament, { ...found.value, status: 'PUBLISHED' }));
}

/** PUBLISHED → PLAYED. The result stays recorded; it just stops counting. */
export function unpublishMatch(tournament: Tournament, matchId: MatchId): Result<Tournament> {
  const found = findMatch(tournament, matchId);
  if (!found.ok) return found;
  const allowed = transition(found.value, ['PUBLISHED'], 'PLAYED');
  if (!allowed.ok) return allowed;
  return ok(replaceMatch(tournament, { ...found.value, status: 'PLAYED' }));
}

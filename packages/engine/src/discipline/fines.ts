import type { Fine, PlayerLine, Tournament } from '../model.ts';
import type { Rules } from '../rules.ts';
import { publishedLines } from './lines.ts';

/**
 * The fine one player owes for one match, or null when nothing is owed.
 * Production's rule: a red card is charged on its own (reds × redCost) and
 * swallows the other cards; otherwise the larger of yellows × yellowCost and
 * blues × blueCost applies.
 */
export function fineFor(
  line: PlayerLine,
  cards: Rules['cards'],
): { readonly amount: number; readonly basis: Fine['basis'] } | null {
  if (line.red > 0) {
    const amount = line.red * cards.redCost;
    return amount > 0 ? { amount, basis: 'red' } : null;
  }
  const yellow = line.yellow * cards.yellowCost;
  const blue = line.blue * cards.blueCost;
  if (yellow === 0 && blue === 0) return null;
  return yellow >= blue ? { amount: yellow, basis: 'yellow' } : { amount: blue, basis: 'blue' };
}

/**
 * Card fines owed across the tournament, derived from PUBLISHED matches only.
 * Nothing is stored: unpublishing a match makes its fines disappear, and a host
 * that persists bills should diff this list against what it already issued.
 */
export function listFines(tournament: Tournament): Fine[] {
  const fines: Fine[] = [];
  for (const { match, teamId, line } of publishedLines(tournament)) {
    const fine = fineFor(line, tournament.rules.cards);
    if (fine) fines.push({ matchId: match.id, teamId, playerId: line.playerId, ...fine });
  }
  return fines;
}

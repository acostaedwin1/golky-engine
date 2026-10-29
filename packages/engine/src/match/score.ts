import type { TeamId } from '../ids.ts';
import type { Match, TeamSheet } from '../model.ts';
import type { Rules } from '../rules.ts';

export interface SideScore {
  readonly teamId: TeamId;
  /** Open-play goals, including `otherPlayers`. */
  readonly goals: number;
  readonly penalties: number;
  /** What decides the match and feeds the table: goals, plus penalties when the rules say so. */
  readonly total: number;
}

export interface MatchScore {
  readonly home: SideScore;
  readonly away: SideScore;
  readonly outcome: 'HOME' | 'AWAY' | 'TIE';
  readonly walkover: boolean;
}

export function sheetTotals(sheet: TeamSheet): {
  readonly goals: number;
  readonly penalties: number;
} {
  let goals = sheet.otherPlayers.goals;
  let penalties = sheet.otherPlayers.penalties;
  for (const line of sheet.players) {
    goals += line.goals;
    penalties += line.penalties;
  }
  return { goals, penalties };
}

/**
 * The score of a match according to the rules, or null when it has no result or
 * its teams are not assigned. A walkover is `goalsW`–0 for the winner.
 */
export function scoreMatch(match: Match, rules: Rules): MatchScore | null {
  const { home, away, result } = match;
  if (!result || home === null || away === null) return null;

  if (result.kind === 'WALKOVER') {
    const w = rules.walkover.goalsW;
    const homeWins = result.winner === home;
    return {
      home: { teamId: home, goals: homeWins ? w : 0, penalties: 0, total: homeWins ? w : 0 },
      away: { teamId: away, goals: homeWins ? 0 : w, penalties: 0, total: homeWins ? 0 : w },
      outcome: homeWins ? 'HOME' : 'AWAY',
      walkover: true,
    };
  }

  const side = (teamId: TeamId, sheet: TeamSheet): SideScore => {
    const { goals, penalties } = sheetTotals(sheet);
    return {
      teamId,
      goals,
      penalties,
      total: goals + (rules.penaltiesCountAsGoals ? penalties : 0),
    };
  };
  const h = side(home, result.home);
  const a = side(away, result.away);
  const outcome = h.total > a.total ? 'HOME' : h.total < a.total ? 'AWAY' : 'TIE';
  return { home: h, away: a, outcome, walkover: false };
}

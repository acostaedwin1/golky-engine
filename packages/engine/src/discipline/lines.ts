import type { TeamId } from '../ids.ts';
import type { Match, PlayerLine, Tournament } from '../model.ts';

export interface PublishedLine {
  readonly match: Match;
  readonly teamId: TeamId;
  readonly line: PlayerLine;
}

/** Every player line of every PUBLISHED, played (not walkover) match, in match order. */
export function* publishedLines(tournament: Tournament): Generator<PublishedLine> {
  for (const match of tournament.matches) {
    const { result, home, away } = match;
    if (match.status !== 'PUBLISHED' || !result || result.kind !== 'PLAYED') continue;
    if (home === null || away === null) continue;
    for (const line of result.home.players) yield { match, teamId: home, line };
    for (const line of result.away.players) yield { match, teamId: away, line };
  }
}

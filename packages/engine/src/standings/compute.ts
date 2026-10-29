import type { GroupId, TeamId } from '../ids.ts';
import { type SideScore, scoreMatch } from '../match/score.ts';
import type { Match, Standing, Tournament } from '../model.ts';
import type { Rules, TieBreaker } from '../rules.ts';
import { findGroup } from '../tournament/slots.ts';
import { compareStandings, type HeadToHeadRecord, type StandingRow } from './tiebreakers.ts';

interface MutableRow {
  teamId: TeamId;
  played: number;
  wins: number;
  ties: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds a table for `teams` out of the PUBLISHED matches handed in. Everything is
 * recomputed from scratch on every call: the table is a pure function of the set
 * of published matches, which is what makes publish/unpublish safe in any order.
 */
export function tabulate(
  teams: readonly TeamId[],
  matches: readonly Match[],
  rules: Rules,
  tieBreakers: readonly TieBreaker[],
): Standing[] {
  const rows = new Map<TeamId, MutableRow>();
  for (const teamId of teams) {
    rows.set(teamId, {
      teamId,
      played: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }
  const headToHead = new Map<TeamId, Map<TeamId, HeadToHeadRecord>>();

  const credit = (
    side: SideScore,
    opponent: SideScore,
    outcome: 'W' | 'T' | 'L',
    walkover: boolean,
  ) => {
    const row = rows.get(side.teamId);
    if (!row) return;
    let points: number;
    if (outcome === 'W') {
      row.wins += 1;
      points = rules.points.win;
    } else if (outcome === 'T') {
      row.ties += 1;
      points = rules.points.tied;
    } else {
      row.losses += 1;
      points = walkover ? 0 : rules.points.loser;
    }
    row.played += 1;
    row.goalsFor += side.total;
    row.goalsAgainst += opponent.total;
    row.points += points;

    let versus = headToHead.get(side.teamId);
    if (!versus) {
      versus = new Map();
      headToHead.set(side.teamId, versus);
    }
    const previous = versus.get(opponent.teamId) ?? { points: 0, goalDifference: 0, goalsFor: 0 };
    versus.set(opponent.teamId, {
      points: previous.points + points,
      goalDifference: previous.goalDifference + side.total - opponent.total,
      goalsFor: previous.goalsFor + side.total,
    });
  };

  for (const match of matches) {
    if (match.status !== 'PUBLISHED') continue;
    const score = scoreMatch(match, rules);
    if (!score) continue;
    const homeOutcome = score.outcome === 'HOME' ? 'W' : score.outcome === 'TIE' ? 'T' : 'L';
    const awayOutcome = score.outcome === 'AWAY' ? 'W' : score.outcome === 'TIE' ? 'T' : 'L';
    credit(score.home, score.away, homeOutcome, score.walkover);
    credit(score.away, score.home, awayOutcome, score.walkover);
  }

  const unsorted: StandingRow[] = [...rows.values()].map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    averagePoints: row.played === 0 ? 0 : round2(row.points / row.played),
  }));
  const sorted = unsorted.sort(compareStandings(tieBreakers, headToHead));
  return sorted.map((row, i) => ({ position: i + 1, ...row }));
}

/** Table of one group, ordered by the tournament's tie-breakers. */
export function computeGroupStandings(tournament: Tournament, groupId: GroupId): Standing[] {
  const found = findGroup(tournament, groupId);
  if (!found) return [];
  const teams = found.group.slots.filter((s): s is TeamId => s !== null);
  const matches = tournament.matches.filter((m) => m.groupId === groupId);
  return tabulate(teams, matches, tournament.rules, tournament.rules.tieBreakers);
}

/**
 * Table of the whole tournament across every round, ordered first by average
 * points per match (teams may have played a different number of matches by now)
 * and then by the configured tie-breakers.
 */
export function computeTournamentTable(tournament: Tournament): Standing[] {
  const chain: TieBreaker[] = [
    'averagePoints',
    ...tournament.rules.tieBreakers.filter((tb) => tb !== 'averagePoints'),
  ];
  return tabulate(tournament.teams, tournament.matches, tournament.rules, chain);
}

import type { PlayerId } from '../ids.ts';
import type { DisciplineEntry, ScorerEntry, Tournament } from '../model.ts';
import { publishedLines } from './lines.ts';

/** Players ranked by discipline score (red × 2 + yellow + blue), worst first. */
export function disciplineRanking(tournament: Tournament): DisciplineEntry[] {
  const totals = new Map<PlayerId, { teamId: string; yellow: number; red: number; blue: number }>();
  for (const { teamId, line } of publishedLines(tournament)) {
    const entry = totals.get(line.playerId) ?? { teamId, yellow: 0, red: 0, blue: 0 };
    entry.yellow += line.yellow;
    entry.red += line.red;
    entry.blue += line.blue;
    totals.set(line.playerId, entry);
  }
  return [...totals.entries()]
    .map(([playerId, e]) => ({ playerId, ...e, score: e.red * 2 + e.yellow + e.blue }))
    .filter((e) => e.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.red - a.red ||
        b.yellow - a.yellow ||
        b.blue - a.blue ||
        a.playerId.localeCompare(b.playerId),
    );
}

/** Players ranked by open-play goals. Penalties never count here. */
export function topScorers(tournament: Tournament): ScorerEntry[] {
  const totals = new Map<PlayerId, { teamId: string; goals: number }>();
  for (const { teamId, line } of publishedLines(tournament)) {
    const entry = totals.get(line.playerId) ?? { teamId, goals: 0 };
    entry.goals += line.goals;
    totals.set(line.playerId, entry);
  }
  return [...totals.entries()]
    .map(([playerId, e]) => ({ playerId, ...e }))
    .filter((e) => e.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.playerId.localeCompare(b.playerId));
}

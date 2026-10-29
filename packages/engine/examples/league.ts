/**
 * A six-team league from kick-off to standings.
 * Run with: pnpm --filter golky-engine example   (builds first, then runs on Node 24)
 */
import {
  advanceRound,
  chain,
  computeGroupStandings,
  confirmMatch,
  createTournament,
  listFines,
  matchdayLabel,
  openRound,
  publishMatch,
  recordResult,
  topScorers,
  unwrap,
} from 'golky-engine';

const teams = [
  'Atlético Chía',
  'Cajicá FC',
  'Deportivo Sopó',
  'Real Tocancipá',
  'Tabio Stars',
  'Zipaquirá United',
];

// 1. Rules: the production profile, with card fines in Colombian pesos.
let t = unwrap(
  createTournament({
    id: 'liga-sabana-2026',
    teams,
    rules: { cards: { yellowCost: 5_000, redCost: 20_000, blueCost: 10_000 } },
  }),
);

// 2. One group, everybody plays everybody once, one champion comes out.
t = unwrap(openRound(t, { name: 'Fase única', groups: 1, numberTeamsOut: 1, seed: teams }));
const matchdays = Math.max(...t.matches.map((m) => m.matchday));
console.log(`${t.matches.length} matches over ${matchdays} matchdays\n`);
for (const m of t.matches.filter((m) => m.matchday === 1)) {
  console.log(`${matchdayLabel(m.matchday)}  ${m.home}  vs  ${m.away}`);
}

// 3. Matchday 1: a played match with a sheet, and a walkover.
const [first, second] = t.matches;
if (!first || !second?.home) throw new Error('expected fixtures');
const when = { locationId: 'cancha-la-70', fieldId: '1', date: '2026-11-01T10:00:00-05:00' };
const sheet = (goals: number) => ({ players: [], otherPlayers: { goals, penalties: 0 } });

t = unwrap(
  chain(
    t,
    (x) => confirmMatch(x, first.id, when),
    (x) =>
      recordResult(x, first.id, {
        kind: 'PLAYED',
        home: {
          players: [
            {
              playerId: 'p-10',
              shirtNumber: 10,
              goals: 2,
              penalties: 0,
              yellow: 1,
              red: 0,
              blue: 0,
            },
            { playerId: 'p-4', shirtNumber: 4, goals: 0, penalties: 0, yellow: 0, red: 1, blue: 0 },
          ],
          otherPlayers: { goals: 0, penalties: 0 },
        },
        away: sheet(1),
      }),
    (x) => publishMatch(x, first.id),
    (x) => confirmMatch(x, second.id, when),
    (x) =>
      recordResult(x, second.id, {
        kind: 'WALKOVER',
        winner: second.home as string,
        refereeReport: 'Away team did not show up',
      }),
    (x) => publishMatch(x, second.id),
  ),
);

// 4. Everything below is derived from the published matches. Nothing is stored.
const groupId = t.rounds[0]?.groups[0]?.id ?? '';
console.log('\nStandings');
console.table(
  computeGroupStandings(t, groupId).map(
    ({
      position,
      teamId,
      played,
      wins,
      ties,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
    }) => ({
      '#': position,
      team: teamId,
      PJ: played,
      PG: wins,
      PE: ties,
      PP: losses,
      GF: goalsFor,
      GC: goalsAgainst,
      DG: goalDifference,
      Pts: points,
    }),
  ),
);
console.log('Fines');
console.table(listFines(t));
console.log('Top scorers');
console.table(topScorers(t));

// 5. The round cannot close while matches are pending; errors are values.
const closed = advanceRound(t);
if (!closed.ok && closed.error.code === 'ROUND_HAS_PENDING_MATCHES') {
  console.log(`\nRound still open: ${closed.error.matchIds.length} matches to publish.`);
}

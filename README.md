# golky-engine

[![CI](https://github.com/acostaedwin1/golky-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/acostaedwin1/golky-engine/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/golky-engine.svg)](https://www.npmjs.com/package/golky-engine)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-d97757.svg)](https://claude.com/claude-code)

**The open-source, AI-native engine for amateur football tournaments.**

Fixtures, match sheets, standings, fines and suspensions for the leagues that run on a
WhatsApp group and a sheet of paper: Fútbol 5, 7, 8 and 11 in neighbourhood pitches
across Latin America. Pure TypeScript, no I/O, no framework, every rule tested.

The rules are not invented. They are extracted from [Golky](https://golky.co), a tournament
platform that has been running in production in Colombia since 2019 and has published more
than 25,000 matches from hand-written match sheets. This repository is a clean-room
rewrite of that domain, in the open, with the gaps production still has filled in.
See [`docs/ORIGIN.md`](https://github.com/acostaedwin1/golky-engine/blob/main/docs/ORIGIN.md).

> **Resumen en español.** Motor de torneos de fútbol aficionado, abierto y en TypeScript puro:
> fixture (todos contra todos, grupos, ida y vuelta), ciclo de vida del partido con planilla,
> W.O., tabla de posiciones con desempates configurables, multas por tarjeta, goleadores y
> vetados. Las reglas salen de Golky, que opera torneos reales en Colombia desde 2019. El
> roadmap añade bracket con seeding, suspensiones automáticas, una demo web y la lectura de
> planillas en papel con Claude. Todo el código y los commits están en inglés; las notas de
> diseño que importan están en los comentarios.

## Install

```sh
pnpm add golky-engine   # or npm / yarn
```

Node 20+. Ships ESM and CommonJS with type declarations, zero runtime dependencies.

## Ten lines, start to standings

```ts
import {
  chain,
  computeGroupStandings,
  confirmMatch,
  createTournament,
  listFines,
  openRound,
  publishMatch,
  recordResult,
  unwrap,
} from 'golky-engine';

const teams = ['ajax', 'boca', 'celta', 'dinamo', 'eibar', 'flamengo'];
let t = unwrap(
  createTournament({
    id: 'liga-2026',
    teams,
    rules: { cards: { yellowCost: 5, redCost: 20, blueCost: 10 } },
  }),
);
t = unwrap(openRound(t, { groups: 1, numberTeamsOut: 1, seed: teams })); // 15 matches, J1..J5, Berger table

const [m1, m2] = t.matches as [(typeof t.matches)[number], (typeof t.matches)[number]];
const when = { locationId: 'loc-1', fieldId: '1', date: '2026-11-01T10:00:00Z' };
t = unwrap(
  chain(
    t,
    (t) => confirmMatch(t, m1.id, when),
    (t) =>
      recordResult(t, m1.id, {
        kind: 'PLAYED',
        home: {
          players: [
            { playerId: 'p1', shirtNumber: 9, goals: 2, penalties: 0, yellow: 1, red: 0, blue: 0 },
          ],
          otherPlayers: { goals: 0, penalties: 0 },
        },
        away: { players: [], otherPlayers: { goals: 1, penalties: 0 } },
      }),
    (t) => publishMatch(t, m1.id),
    (t) => confirmMatch(t, m2.id, when),
    (t) =>
      recordResult(t, m2.id, {
        kind: 'WALKOVER',
        winner: m2.home as string,
        refereeReport: 'Away team absent',
      }),
    (t) => publishMatch(t, m2.id),
  ),
);

console.table(computeGroupStandings(t, 'round-1/A'));
console.table(listFines(t)); // [{ matchId, teamId: 'ajax', playerId: 'p1', amount: 5, basis: 'yellow' }]
```

Run the longer version: `pnpm --filter golky-engine example`.

## What it does

| Area                | Functions                                                                              | Rules it reproduces                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fixtures**        | `generateRoundRobin`, `splitIntoGroups`, `groupLabel`                                  | Berger-table round-robin (home/away balanced within 1), odd sizes with a resting team, single or double leg, leftovers `PER_GROUP` / `NEW_GROUP`, groups A…Z, AA…                   |
| **Tournament**      | `createTournament`, `openRound`, `assignTeamToSlot`, `advanceRound`                    | Rounds → groups → slots; a knockout tie is a 2-team group; a round only closes when every match is published, or is force-closed and the rest marked `SUSPENDED`                    |
| **Match lifecycle** | `confirmMatch`, `cancelConfirmation`, `recordResult`, `publishMatch`, `unpublishMatch` | `CREATED → READY → CONFIRMED → PLAYED → PUBLISHED`; publishing twice is rejected; walkovers need a referee report and wipe player stats by construction                             |
| **Score**           | `scoreMatch`, `sheetTotals`                                                            | Per-player lines plus unattributed `otherPlayers`; penalties decide and count as goals (configurable); walkover `goalsW`–0                                                          |
| **Standings**       | `computeGroupStandings`, `computeTournamentTable`, `tabulate`                          | Always recomputed from the set of `PUBLISHED` matches; configurable tie-breakers incl. head-to-head; tournament table led by average points per match; walkover losers get 0 points |
| **Discipline**      | `listFines`, `fineFor`, `disciplineRanking`, `topScorers`                              | Reds charged alone, else max(yellows, blues); fines are derived so unpublishing removes them; scorers exclude penalties                                                             |
| **Eligibility**     | `checkBanned`, `validateRosters`                                                       | Ban list by document → email → phone with normalization; one team per player per tournament                                                                                         |

Everything returns `Result<T, EngineError>`: the engine never throws, and every error has a
`code` you can switch on. Inputs are never mutated. Ids for rounds, groups and matches are
deterministic (`round-1/A/J3/2v5`), so the same input always yields the same tournament.

### The one invariant that matters

> **Standings, fines and rankings are pure functions of the set of published matches.**

Production used to update tables with incremental deltas on publish and unpublish. When a
score was corrected in between, the subtraction did not match the addition and tables drifted
into impossible values (`matchesTied = -1`) that never healed. The fix was to recompute from
scratch, and this engine is built on that lesson: there is no stored table to drift. A
property test publishes and unpublishes matches in random order and checks the table only
depends on the final set.

### Rules

`defaultRules` is the profile production runs. Override any part:

```ts
createTournament({
  id,
  teams,
  rules: {
    points: { win: 3, tied: 1, loser: 0 },
    walkover: { goalsW: 3 },
    penaltiesCountAsGoals: true, // production counts penalties in the table
    tieBreakers: ['points', 'goalDifference', 'goalsAgainst', 'goalsFor', 'wins'], // add 'headToHead', 'averagePoints'
    cards: { yellowCost: 0, redCost: 0, blueCost: 0 },
    suspensions: { yellowThreshold: null, yellowBanMatchdays: 1, redBanMatchdays: 1 }, // enforcement lands in phase 1
    fixture: { legs: 1, leftover: 'PER_GROUP' },
  },
});
```

Two production quirks are reproduced on purpose and documented in the tests: a walkover
loser earns 0 points even if `points.loser` is positive, and in the default chain
`goalsFor` can never decide (equal goal difference and goals against imply equal goals for),
so it only matters in a custom order.

## Roadmap

Phase 0 (this release) is the engine. Next, in order — see [`ROADMAP.md`](https://github.com/acostaedwin1/golky-engine/blob/main/ROADMAP.md):

1. **Knockout brackets with seeding and byes**, and **suspension enforcement** (yellow accumulation, straight reds), which production stores but never applies.
2. **Web demo** on Vercel: create a tournament, generate the fixture, load results, watch the table.
3. **`golky-vision`**: read a photographed, hand-written match sheet with Claude, reconciled against the roster, with a confidence per field, so results are published in minutes instead of days. Synthetic sheets only; no real player data.
4. **Organizer copilot**: tool-calling over the engine ("who is suspended for matchday 6?").

## Built with Claude Code

This project is developed with [Claude Code](https://claude.com/claude-code), and the repository
is set up for it: [`CLAUDE.md`](https://github.com/acostaedwin1/golky-engine/blob/main/CLAUDE.md)
carries the domain invariants and conventions, `.claude/commands/` has the workflows for adding a
rule and cutting a release, and a `Stop` hook refuses to end a turn with red tests. The process
behind phase 0: a read-only inventory of the production code (Java) produced a rule list with
file references; the TypeScript was then written clean-room against that list, with unit tests
for every rule and property tests for the invariants. Commit messages carry the co-author line.

## Development

```sh
pnpm install
pnpm check          # lint + typecheck + tests with coverage + build
pnpm test:watch
pnpm --filter golky-engine example
```

Releases use [Changesets](https://github.com/changesets/changesets): `pnpm changeset`, then CI opens
the version PR. Contributions welcome, in English or Spanish: see
[`CONTRIBUTING.md`](https://github.com/acostaedwin1/golky-engine/blob/main/CONTRIBUTING.md).

## License

MIT © [Edwin Acosta](https://edwinacosta.co)

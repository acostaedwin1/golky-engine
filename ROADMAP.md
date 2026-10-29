# Roadmap

The engine is the foundation. Each phase ships on its own and feeds the next.

## Phase 0 — Engine (done)

`packages/engine`: fixtures, tournament rounds, match lifecycle, scoring, standings,
discipline, eligibility. Pure TypeScript, `Result` instead of exceptions, property-tested
invariants, dual ESM/CJS build, CI.

## Phase 1 — Rules production never had

- **Knockout brackets** with seeding from the previous round's standings and byes when the
  number of teams is not a power of two. Today a knockout tie is a hand-seeded 2-team group.
- **Suspension enforcement**: accumulated yellows and straight reds translate into
  "cannot play the next N matchdays". Production stores the setting and never applies it;
  organizers compute it in their heads. `Rules.suspensions` is already reserved for this.
- **Head-to-head mini-table** for ties between three or more teams (pairwise comparison today).
- `removeTeamFromSlot` and reseeding while a round has no published matches.

## Phase 2 — Web demo (`apps/web`)

Next.js on Vercel: create a tournament, generate the fixture, record match sheets, publish,
and watch the table, fines and scorers update. Spanish UI, shareable read-only standings.
The demo is also the manual test bed for the engine's ergonomics.

## Phase 3 — `golky-vision`

The reason this project exists. Organizers photograph a hand-written match sheet; the package
straightens the image, crops it by printed regions, sends each region to Claude together with
the match roster (shirt numbers and names the system already knows) and returns a reconciled
`MatchResult` with a confidence per field. The organizer confirms instead of typing.

- Synthetic match-sheet generator (no real player data ever enters the repo).
- Evaluation harness: precision per field against a labelled set.
- Target: results published within hours of the final whistle instead of days.

## Phase 4 — Organizer copilot

Tool-calling over the engine's functions: "who is suspended for matchday 6?", "what does
team X owe?", "reschedule matchday 5 to Sunday". Reads first; writes with confirmation.
Rule: the arithmetic lives in code, the conversation lives in the model.

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`golky-engine` is an open-source, pure-TypeScript domain engine for amateur football
tournaments, extracted clean-room from Golky, a platform in production in Colombia since 2019.
pnpm monorepo: `packages/engine` (the library, npm `golky-engine`) and `apps/web` (phase 2
demo, placeholder today). Code, comments and commits are in English; the product domain is
Spanish-speaking, so Spanish terms appear in docs where they are the real names
(planilla = match sheet, W.O. = walkover, jornada = matchday "J1").

## Commands

```sh
pnpm install
pnpm check                         # lint + typecheck + test:coverage + build — run before finishing
pnpm test                          # vitest run (all packages)
pnpm test -- test/standings        # one folder; `-t "name"` for one case
pnpm lint:fix                      # biome check --write
pnpm --filter golky-engine example # builds, then runs examples/league.ts on Node 24
pnpm changeset                     # describe a user-facing change (required for releases)
```

Node 24 (`.nvmrc`), pnpm 12. TypeScript is pinned to 6.x on purpose: tsup's d.ts build
needs the compiler API that TypeScript 7 no longer ships.

## Architecture

`packages/engine/src`:

- `result.ts`, `errors.ts` — `Result<T, EngineError>`; nothing in the engine throws.
- `rules.ts` — `Rules`, `defaultRules` (the production profile), `resolveRules()`.
- `model.ts` — `Tournament → Round → Group(slots) ; Match(flat list)`; `MatchResult` is
  `PLAYED` (two sheets) or `WALKOVER` (no sheets, by construction).
- `fixture/` — `generateRoundRobin` (Berger table), `splitIntoGroups`, `groupLabel`.
- `tournament/` — `createTournament`, `openRound`, `assignTeamToSlot`, `advanceRound`.
- `match/` — `lifecycle.ts` (transition table + 5 operations), `score.ts`.
- `standings/` — `tabulate` recomputes from `PUBLISHED` matches; `tiebreakers.ts` comparator.
- `discipline/`, `eligibility/` — derived views and checks.

Tests mirror `src` under `test/`; `test/helpers/builders.ts` has `league()`, `score()`,
`play()`, `walkover()`, `deepFreeze()`.

## Invariants (do not break)

1. **Standings, fines and rankings are pure functions of the set of PUBLISHED matches.**
   Never add incremental updates or a stored table (that is the `matchesTied = -1` bug).
2. **Operations never mutate input.** Return new objects; tests deep-freeze inputs.
3. **Errors are values.** New failure mode → new `EngineError` member + `describeError` case
   - a test in `test/result.test.ts` that renders it.
4. **Ids are deterministic**: `round-1`, `round-1/A`, `round-1/A/J3/2v5`. Same input, same ids.
5. **`defaultRules` behaves like production.** Improvements are opt-in via `Rules`.

## Production quirks reproduced on purpose

- Penalties count as goals in the table (`penaltiesCountAsGoals: true`).
- A walkover loser gets 0 points even when `points.loser > 0`.
- Tie-breaker chain is points, GD, **fewer goals against**, GF, wins. With that order GF can
  never decide (equal GD and GA imply equal GF); it only matters in a custom order.
- Tournament-wide table ranks by average points per match first.
- `suspensions` is stored but not enforced yet (phase 1).

## Conventions

- Biome formats and lints; `pnpm lint:fix` before committing.
- Strict TS with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`: use `null`
  for absent `schedule`/`result`, guard indexed access.
- Every rule gets a unit test; invariants get a `fast-check` property.
- Conventional Commits in English, co-author line on commits made with Claude Code.
- A `Stop` hook in `.claude/settings.json` runs typecheck + tests; a red suite blocks the stop.

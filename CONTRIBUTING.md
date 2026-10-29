# Contributing

Issues and pull requests are welcome, in English or Spanish.

## Ground rules

- **The engine is pure.** No I/O, no dates parsed, no randomness, no mutation of inputs.
  Operations take a `Tournament` and return a new one inside a `Result`.
- **Nothing throws.** Add a member to `EngineError` (and to `describeError`) rather than throwing.
- **Derived, not stored.** Standings, fines and rankings are computed from the set of
  `PUBLISHED` matches on every call. Do not introduce incremental updates.
- **Every rule has a test**, and invariants get a `fast-check` property.
- **Reproduce production first, then improve it.** The Golky profile (`defaultRules`) must keep
  behaving like production; improvements are opt-in through `Rules`.

## Workflow

```sh
pnpm install
pnpm check                  # lint + typecheck + tests with coverage + build
pnpm test:watch             # while developing
pnpm changeset              # describe your change for the changelog
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) in English
(`feat(engine): …`, `fix(engine): …`, `docs: …`). CI must be green: Biome, `tsc`, Vitest with
coverage thresholds, the tsup build, and `attw` + `publint` on the package.

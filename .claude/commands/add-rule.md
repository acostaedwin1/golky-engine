---

description: Add a configurable rule to golky-engine end to end
argument-hint: <rule name and what it changes>
---

Add the rule described by `$ARGUMENTS` to the engine. Work in this order and keep tests green at every step:

1. **Model it in `packages/engine/src/rules.ts`**: extend `Rules` and `RulesInput`, give `defaultRules` the value that keeps production behaviour unchanged, and validate it in `resolveRules()` with a precise `INVALID_RULES` reason. Add the rejection case to `test/rules.test.ts`.
2. **Apply it** in the single module that owns the behaviour (`fixture/`, `match/score.ts`, `standings/`, `discipline/`…). Do not store derived state; standings and fines stay pure functions of the published matches.
3. **Test it**: one unit test that shows the default is unchanged, one that shows the new behaviour when enabled, and extend the relevant `fast-check` property if an invariant is affected.
4. **Document it**: the `Rules` table in `README.md` (root and `packages/engine/README.md` are identical), and `CLAUDE.md` if it is a production quirk.
5. `pnpm check`, then `pnpm changeset` (minor if it adds a rule, patch if it fixes one) and a Conventional Commit in English.

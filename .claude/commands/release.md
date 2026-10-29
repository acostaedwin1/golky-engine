---

## description: Prepare a golky-engine release with Changesets

Prepare a release:

1. Run `pnpm check`; stop if anything is red.
2. `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD` and make sure every user-facing change has a changeset in `.changeset/`. Write the missing ones with `pnpm changeset` (minor for new rules or functions, patch for fixes).
3. Run `pnpm changeset:version`, review `packages/engine/CHANGELOG.md` and `package.json`, and commit as `chore: version packages`.
4. Verify the package shape from `packages/engine`: `pnpm build && npx publint && npx attw --pack`.
5. Tag `golky-engine@<version>`, push with tags, and tell the user to run `pnpm release` (or let the Release workflow publish once `NPM_TOKEN` is set). Never publish to npm without the user's explicit go-ahead.

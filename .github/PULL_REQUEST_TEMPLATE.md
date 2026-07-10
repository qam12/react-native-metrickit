<!--
  Thanks for contributing!
  Please target the `dev` branch — `main` only receives stable, released code.
-->

## Summary

<!-- What does this change, and why? Link any related issue. -->

Closes #

## Type of change

- [ ] `fix` — bug fix
- [ ] `feat` — new feature
- [ ] `refactor` — no behavior change
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `chore` — tooling / CI / dependencies

## Platforms affected

- [ ] iOS
- [ ] Android
- [ ] JavaScript / TypeScript only
- [ ] Symbolication CLI

## Checklist

- [ ] This PR targets **`dev`**, not `main`
- [ ] `yarn typecheck` passes
- [ ] `yarn lint` passes
- [ ] `yarn test` passes
- [ ] `yarn prepare` (bob build) succeeds
- [ ] Tests added or updated (including a **malformed-input test** if a parser changed)
- [ ] Docs updated (`README.md`, and `ARCHITECTURE.md` if internals changed)
- [ ] An entry was added to the `Unreleased` section of `CHANGELOG.md`
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en)

## Crash-free review

The library must never crash the host app. If this PR touches collection or parsing:

- [ ] No force-unwraps in Swift; new parsing wrapped in `SafeExecutor`
- [ ] Kotlin OS reads wrapped and version-gated (`Build.VERSION.SDK_INT`)
- [ ] Bridge methods always `resolve` (never `reject`); fall back to `"[]"`
- [ ] New public JS methods routed through `safe.ts`
- [ ] Malformed records are dropped, not surfaced

## Verification

<!-- How did you test this? Note the device/OS, since MetricKit never delivers on the Simulator. -->

# Contributing

Contributions are always welcome, no matter how large or small.

We want this community to be friendly and respectful to each other. Please read the
[Code of Conduct](./CODE_OF_CONDUCT.md) before contributing, and follow it in all your
interactions with the project.

Before writing any code, it helps to read **[ARCHITECTURE.md](./ARCHITECTURE.md)** — it explains
the data flow, the module layout, and the design decisions you'll be working within.

## Table of contents

- [Branching strategy](#branching-strategy)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Running the example app](#running-the-example-app)
- [Native development](#native-development)
- [Verification](#verification)
- [The crash-free rule](#the-crash-free-rule)
- [Commit convention](#commit-convention)
- [Sending a pull request](#sending-a-pull-request)
- [Releasing](#releasing)
- [Scripts](#scripts)

## Branching strategy

| Branch | Purpose |
| --- | --- |
| `main` | **Production-ready.** Only receives thoroughly tested, stable code, and only through a reviewed merge. |
| `dev` | **Active development.** All features, fixes, and changes land here first. |

**Open your pull request against `dev`, never `main`.** Work is promoted `dev → main` only when
it is stable and released.

```sh
git checkout dev
git pull
git checkout -b feat/my-change   # branch off dev
# …work…
# open a PR: feat/my-change → dev
```

## Project layout

A Yarn workspaces monorepo:

- **The library** lives in the root: `src/` (TypeScript), `ios/` (Swift + ObjC++), `android/`
  (Kotlin), `bin/` (the symbolication CLI).
- **The example app** lives in `example/` — a runnable bare React Native app that consumes the
  library by its real package name. It is committed to Git but **never published to npm**.

## Getting started

Use the Node version in [`.nvmrc`](./.nvmrc). Install dependencies from the root:

```sh
yarn
```

> The project relies on Yarn workspaces; you cannot use `npm` for development without manually
> migrating.

## Running the example app

The example app is configured to use your local library source. **JavaScript changes hot-reload;
native changes require a rebuild.**

```sh
yarn example start     # Metro bundler
yarn example ios       # build + run on iOS
yarn example android   # build + run on Android
```

> `yarn start` at the root will fail — the root is a library, not an app. Always go through
> `yarn example …`.

To confirm the New Architecture is active, look for `"fabric":true` in the Metro logs.

## Native development

### iOS

```sh
cd example/ios && pod install
```

Open `example/ios/MetrickitExample.xcworkspace` in Xcode. The library sources appear under
**Pods → Development Pods → react-native-metrickit**.

Two things bite people:

1. **Adding or removing a Swift file requires re-running `pod install`.** The pod only generates
   the `Metrickit-Swift.h` interop header once CocoaPods knows it is compiling Swift. If you see
   `'Metrickit-Swift.h' file not found`, re-run `pod install` and clean the build folder.
2. **Editing `src/NativeMetrickit.ts` requires regenerating codegen.** `pod install` does this for
   iOS. Both native modules must then implement every method in the spec — codegen makes them
   abstract on Android and required by protocol on iOS.

You can compile just the library target without building the whole app:

```sh
cd example/ios
xcodebuild -project Pods/Pods.xcodeproj -target Metrickit -sdk iphonesimulator \
  -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

### Android

Open `example/android` in Android Studio; the library sources appear under
`react-native-metrickit`. `ApplicationExitInfo` requires **API 30+**, so test on an
Android 11+ device or emulator — below that the module correctly no-ops.

### Testing native changes without waiting for the OS

Real MetricKit / `ApplicationExitInfo` payloads arrive at a later launch (and never on the iOS
Simulator). Use `simulate()` to exercise the entire JS delivery path immediately, and add a JSON
fixture under `src/__fixtures__/` to unit-test the normalization.

## Verification

Everything below must pass before you open a pull request:

```sh
yarn typecheck   # TypeScript, strict
yarn lint        # ESLint + Prettier  (yarn lint --fix to autofix)
yarn test        # Jest unit tests
yarn prepare     # bob build — ensures the package still builds
```

CI additionally builds the example app for iOS and Android across **both** the New and Old
architectures.

## The crash-free rule

This is the project's single hardest constraint: **the library must never crash the host app.**
Concretely, when you touch code:

- **Swift** — no force-unwraps (`!`). Use `guard let` / `if let`. Wrap parsing in `SafeExecutor`.
  Gate OS APIs with `@available`.
- **Kotlin** — wrap every OS read in `SafeExecutor`. Gate with `Build.VERSION.SDK_INT`. Never let
  an exception escape into React Native.
- **Bridge** — always `resolve`, never `reject`. Return `"[]"` on failure.
- **TypeScript** — route every public method through `safe.ts` so failures return a benign
  fallback and log.
- **Parsing** — drop malformed records; never surface a partial object.

If you add a code path that can throw, wrap it. Add a malformed-input test alongside it.

## Commit convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/en) specification. A
`commit-msg` hook (lefthook + commitlint) enforces it, and a `pre-commit` hook runs ESLint and
TypeScript.

- `feat:` a new feature, e.g. add a new exported method
- `fix:` a bug fix, e.g. fix a crash on Android 11
- `refactor:` a code change that neither fixes a bug nor adds a feature
- `docs:` documentation only
- `test:` adding or updating tests
- `chore:` tooling, CI, dependencies

Scopes are encouraged where useful: `feat(ios): add MXMetricPayload metrics stream`.

## Sending a pull request

> **First pull request?** Learn how from this free series:
> [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

- **Target the `dev` branch.**
- Prefer small pull requests focused on one change.
- Verify that linters, types, and tests pass.
- Add tests for your change where possible — especially a malformed-input test for any new parser.
- Update the documentation (`README.md`, and `ARCHITECTURE.md` if you changed the internals).
- Add an entry to the `Unreleased` section of [CHANGELOG.md](./CHANGELOG.md).
- For changes to the public API or the native implementation, open an issue to discuss first.

## Releasing

Maintainers only. Releases are cut from `main` after `dev` has been merged.

```sh
yarn release
```

[release-it](https://github.com/release-it/release-it) bumps the version per semver from the
conventional commits, updates the changelog, creates the tag and GitHub release, and publishes to
npm. The `prepare` script (`bob build`) runs automatically on publish, so `lib/` is always built
fresh into the tarball.

Before releasing, confirm the shipped file set:

```sh
npm pack --dry-run
```

It must contain `src`, `lib`, `ios`, `android`, `bin`, the podspec, `react-native.config.js`,
`README.md`, `LICENSE`, and `CHANGELOG.md` — and must **not** contain `example/`, tests, or
fixtures.

## Scripts

| Script | Description |
| --- | --- |
| `yarn` | Install dependencies for every workspace |
| `yarn typecheck` | Type-check with TypeScript |
| `yarn lint` | Lint with ESLint (`--fix` to autofix formatting) |
| `yarn test` | Run unit tests with Jest |
| `yarn prepare` | Build the library with `react-native-builder-bob` |
| `yarn clean` | Remove build artifacts |
| `yarn example start` | Start Metro for the example app |
| `yarn example ios` | Run the example app on iOS |
| `yarn example android` | Run the example app on Android |
| `yarn release` | Publish a new version (maintainers) |

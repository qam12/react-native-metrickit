# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/).

## Versioning policy

While the package is **pre-1.0**, minor versions may contain breaking changes; patch versions
never will. The public API surface is everything exported from `react-native-metrickit-sdk` and
`react-native-metrickit-sdk/debug`, plus the `rn-metrickit-symbolicate` CLI. Anything under
`src/internal/` is private and may change at any time.

Releases are cut with [release-it](https://github.com/release-it/release-it) from conventional
commits.

## [Unreleased]

### Added

- Normalized `DiagnosticEvent` contract shared across both platforms.
- `onIOSDiagnostics` — iOS MetricKit diagnostics (crash / hang / CPU-exception / disk-write) via a
  Swift `MXMetricManagerSubscriber`.
- `onAndroidExitInfo` — Android `ApplicationExitInfo` (crash / native-crash / ANR / low-memory /
  kill) with cross-launch deduplication (API 30+).
- `onIOSMetrics` — iOS MetricKit `MXMetricPayload` metrics as a normalized `MetricSnapshot`,
  including **background and foreground exit counts by reason**, CPU time, memory, launch time,
  and network transfer.
- `setConsent` / `hasConsent` — consent gate (default **off**) applied natively before any
  emission.
- `setDiagnosticNotifications` — optional local notification on a non-empty diagnostics drain
  (both platforms, default off, consent-respecting).
- Opt-in capped ring buffer: `enableBuffer`, `disableBuffer`, `getBufferedDiagnostics`,
  `clearBuffer`.
- `DiagnosticsDebugView` and `simulate()`, shipped from a tree-shakeable
  `react-native-metrickit-sdk/debug` entry point. Tabs are platform-aware: iOS shows
  All / Crashes / Hangs / CPU / Disk / Metrics; Android shows All / Crashes / ANRs.
- Offline symbolication CLI `rn-metrickit-symbolicate` (`atos` / `ndk-stack` / `retrace`) with
  dSYM UUID validation and clear errors on mismatched artifacts.
- Structural crash-free guards across the native and JavaScript layers; unit tests with captured
  fixtures; a New + Old architecture CI matrix.
- Documentation: `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`.

### Removed

- The `multiply` demo from the project scaffold.

[Unreleased]: https://github.com/qam12/react-native-metrickit/compare/main...dev

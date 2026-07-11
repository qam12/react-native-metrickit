<div align="center">

# react-native-metrickit-sdk

**Crash-free React Native diagnostics.** Surfaces iOS **MetricKit** and Android
**`ApplicationExitInfo`** as one normalized event stream — and pipes it wherever you want.

[![npm version](https://img.shields.io/npm/v/react-native-metrickit-sdk.svg)](https://www.npmjs.com/package/react-native-metrickit-sdk)
[![license](https://img.shields.io/npm/l/react-native-metrickit-sdk.svg)](./LICENSE)
[![CI](https://github.com/qam12/react-native-metrickit/actions/workflows/ci.yml/badge.svg)](https://github.com/qam12/react-native-metrickit/actions/workflows/ci.yml)
[![platforms](https://img.shields.io/badge/platforms-iOS%2014%2B%20%7C%20Android%2011%2B-blue.svg)](#requirements--supported-platforms)

</div>

---

## Table of contents

- [Overview](#overview)
- [The problem](#the-problem)
- [The solution](#the-solution)
- [Features](#features)
- [Requirements & supported platforms](#requirements--supported-platforms)
- [Installation](#installation)
- [Native setup](#native-setup)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Debug UI](#debug-ui)
- [iOS metrics](#ios-metrics)
- [Offline symbolication](#offline-symbolication)
- [Platform-specific behavior](#platform-specific-behavior)
- [Error handling](#error-handling)
- [Limitations & known behaviors](#limitations--known-behaviors)
- [Best practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [How it works internally](#how-it-works-internally)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

---

## Overview

Both iOS and Android expose first-class, OS-level stability data — why your app crashed, hung,
was killed for memory, or blew its CPU budget. Neither is reachable from React Native without
writing native code, and the two APIs look nothing alike.

`react-native-metrickit-sdk` collects both, normalizes them into a single `DiagnosticEvent` shape,
and hands them to your JavaScript. It has **zero runtime dependencies**, **sends nothing over the
network**, and is engineered so that a failure inside the library can never crash your app.

## The problem

- **Crash reporters miss the OS's own view.** Watchdog terminations, background memory kills, and
  ANRs often never reach a JS-level crash handler — the process is simply gone.
- **The two platforms disagree on everything.** iOS gives you `MXDiagnosticPayload` with call-stack
  trees, delivered as a batch roughly once a day. Android gives you `ApplicationExitInfo` records
  with integer reason codes, readable instantly at the next launch.
- **Native diagnostics code is risky.** It runs at launch, parses OS payloads you don't control,
  and touches APIs that don't exist on older OS versions. A single force-unwrap turns your
  observability tool into your top crash.
- **Everything else wants to own your data.** Most SDKs bundle a network client and ship your
  stack traces to their servers by default.

## The solution

One normalized contract, two adapters, and a hard crash-free guarantee.

```
 iOS MetricKit ─┐                                        ┌─► your listener
                ├─► normalize ─► consent gate ─► JSON ─► ├─► dev ring buffer
 Android exit  ─┘   (native)      (native)       bridge  └─► debug UI
 info records
```

- **One contract.** Every source — iOS crash/hang/CPU/disk, Android crash/native-crash/ANR/kill —
  becomes the same [`DiagnosticEvent`](#diagnosticevent). Consumers stay source-agnostic.
- **Consent-gated at the source.** Nothing leaves native code until you call `setConsent(true)`.
- **No sinks, no network.** You get events; you decide where they go (your API, Sentry, a file,
  nowhere).
- **Crash-free by construction.** No force-unwraps, exhaustive OS-availability guards, every
  native read and every public method wrapped so failures degrade to a benign no-op.

For the internals — the full data flow, module map, and the rationale behind each decision — see
**[ARCHITECTURE.md](./ARCHITECTURE.md)**.

> [!IMPORTANT]
> **Delivery is batched, not real-time.** iOS MetricKit hands your app a batch at a **later
> launch**, up to ~24h after the event. Android exit records are readable **immediately at the
> next launch** (no 24h wait). Neither is a live crash feed. Use [`simulate()`](#simulatepartial)
> to see data instantly during development.

## Features

- 📊 **Two normalized streams** — `onIOSDiagnostics` and `onAndroidExitInfo`
- 📈 **iOS metrics** — `onIOSMetrics`, including **background exit counts by reason**
- 🔒 **Consent gate** — default **off**; nothing is emitted until you opt in
- 🔔 **Optional local notification** on a non-empty drain (both platforms, default off)
- 🧪 **`simulate()`** — inject a test event so you don't wait a day to see your UI work
- 🖥️ **Platform-aware debug view** — tree-shakeable, shipped from `react-native-metrickit-sdk/debug`
- 🧰 **Offline symbolication CLI** — `atos` / `ndk-stack` / `retrace`, with dSYM UUID checking
- 🪶 **Zero runtime dependencies**; `react` / `react-native` are peer deps only
- 🛡️ **Crash-free** — every failure path degrades to a logged no-op
- 🧵 **New + Old architecture** — TurboModule with interop support

## Requirements & supported platforms

| | Minimum | Behavior below the floor |
| --- | --- | --- |
| **iOS** (diagnostics) | 14.0 | Clean no-op; subscriptions return a valid unsubscribe |
| **iOS** (metrics) | 13.0 (exit counts need 14.0) | Missing sections simply absent |
| **Android** | API 30 (Android 11) | Clean no-op; `ApplicationExitInfo` does not exist below 30 |
| **React Native** | 0.70+ (developed against 0.85) | — |
| **Node** (for the CLI / dev) | 20.19+ | — |

Works on **bare React Native (CLI)**. See [Expo](#expo) below.

## Installation

```sh
npm install react-native-metrickit-sdk
```

```sh
yarn add react-native-metrickit-sdk
```

## Native setup

Autolinking registers the module. Finish the native install:

### iOS

```sh
cd ios && pod install
```

MetricKit is weak-linked; no extra configuration is needed. The pod compiles Swift sources, so
**re-run `pod install` after upgrading this package** (see [Troubleshooting](#troubleshooting)).

### Android

No permissions are required to read exit info. If your app's `minSdkVersion` is below 30 the
module compiles fine and no-ops at runtime.

To show the optional local notification on Android 13+ (API 33), your app must request the
`POST_NOTIFICATIONS` runtime permission. The library does not request it for you.

### Expo

This package contains custom native code, so:

- ❌ **Expo Go** — not supported (it cannot load custom native modules).
- ⚠️ **Expo dev build / prebuild** — should work via `expo prebuild` or EAS Build, but **no config
  plugin is shipped** and this path is untested. You would wire the native setup manually.
- ✅ **Bare React Native CLI** — the supported, tested path.

## Quick start

```tsx
import {
  onIOSDiagnostics,
  onAndroidExitInfo,
  setConsent,
  type DiagnosticEvent,
} from 'react-native-metrickit-sdk';

// Consent defaults to OFF — nothing leaves native until you opt in.
// Call this only once you have the user's consent: stack traces can contain PII.
setConsent(true);

const send = (events: DiagnosticEvent[]) => {
  // Pipe anywhere: your API, Sentry, a log file, etc.
  events.forEach((e) => console.log(e.type, e.summary));
};

const unsubscribeIOS = onIOSDiagnostics(send);
const unsubscribeAndroid = onAndroidExitInfo(send);

// On teardown:
unsubscribeIOS();
unsubscribeAndroid();
```

Both subscriptions are safe to call on either platform — the non-matching one returns a no-op
unsubscribe and never fires.

---

## API reference

Everything is exported from `react-native-metrickit-sdk`, except `DiagnosticsDebugView`, which lives
at `react-native-metrickit-sdk/debug`.

**No method in this library ever throws.** See [Error handling](#error-handling).

### `onIOSDiagnostics(listener)`

Subscribe to iOS MetricKit diagnostics (crash, hang, CPU exception, disk write).

```ts
function onIOSDiagnostics(listener: DiagnosticListener): Unsubscribe;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `listener` | `(events: DiagnosticEvent[]) => void` | Called with a **batch** of normalized events. |

**Returns** `Unsubscribe` — `() => void`. Call it to stop receiving events and release the listener.

**Behavior.** Drains any diagnostics the OS has already delivered at subscribe time. On Android,
or on iOS below 14, it is a no-op and the returned function does nothing.

```tsx
useEffect(() => {
  const unsubscribe = onIOSDiagnostics((events) => {
    events.forEach((e) => analytics.track('ios_diagnostic', e));
  });
  return unsubscribe; // cleanup on unmount
}, []);
```

---

### `onAndroidExitInfo(listener)`

Subscribe to Android `ApplicationExitInfo` records (crash, native crash, ANR, low memory, kills),
**deduplicated across launches**.

```ts
function onAndroidExitInfo(listener: DiagnosticListener): Unsubscribe;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `listener` | `(events: DiagnosticEvent[]) => void` | Called with a batch of normalized events. |

**Returns** `Unsubscribe`.

**Behavior.** Reads the OS exit history on subscribe and emits only records newer than the
persisted cursor, then advances the cursor. On iOS, or Android below API 30, it is a no-op.

Unlike iOS, there is **no 24-hour delay** — the record is available as soon as the app relaunches.

---

### `onIOSMetrics(listener)`

Subscribe to iOS MetricKit `MXMetricPayload` metrics. See [iOS metrics](#ios-metrics).

```ts
function onIOSMetrics(listener: MetricListener): Unsubscribe;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `listener` | `(snapshots: MetricSnapshot[]) => void` | Called with a batch of metric snapshots. |

**Returns** `Unsubscribe`. **iOS-only**; a no-op on Android.

---

### `setConsent(consent)`

Gate **all** emission. Defaults to `false`.

```ts
function setConsent(consent: boolean): void;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `consent` | `boolean` | `true` to allow emission; `false` to stop it. |

**Returns** `void`.

The gate is applied **natively**, before any data crosses the bridge. While consent is `false`,
diagnostics remain buffered in native memory and are delivered once consent is granted — nothing
is lost, and nothing leaks. Callable at any time; takes effect on the next drain.

---

### `hasConsent()`

```ts
function hasConsent(): boolean;
```

**Returns** the JS-side mirror of the last value passed to `setConsent`. Useful for rendering UI;
the authoritative gate lives in native code.

---

### `setDiagnosticNotifications(enabled)`

Toggle a local OS notification posted when a **non-empty diagnostics batch is drained**.

```ts
function setDiagnosticNotifications(enabled: boolean): void;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Defaults to `false`. |

**Returns** `void`.

**Behavior.** Available on **both** platforms. Fires only when notifications are enabled **and**
consent is granted **and** the drained batch is non-empty. It is a normal, dismissible system
notification — not a modal alert, and **not** limited to dev builds. Metrics do **not** trigger
notifications. Requires OS notification permission (silently no-ops without it).

---

### Dev buffer

An opt-in, capped, overwrite-oldest ring buffer for inspection. **In-memory only** — cleared on
app restart. Off by default.

```ts
function enableBuffer(maxEntries?: number): void; // default 100
function disableBuffer(): void;                   // also clears
function getBufferedDiagnostics(): DiagnosticEvent[]; // snapshot, oldest first
function clearBuffer(): void;
```

```ts
enableBuffer(50);
// ...later
console.log(getBufferedDiagnostics().length);
```

---

### `simulate(partial?)`

Inject a synthetic `DiagnosticEvent` through the normal delivery path (subscribers + buffer +
debug view), so you can verify your integration without waiting for a real OS drain.

```ts
function simulate(partial?: Partial<DiagnosticEvent>): void;
```

| Parameter | Type | Description |
| --- | --- | --- |
| `partial` | `Partial<DiagnosticEvent>` | Optional overrides. Defaults: current platform, `type: 'crash'`, `timestamp: Date.now()`. |

**Returns** `void`.

**Dev-only.** Intentionally **bypasses the consent gate** — the payload is synthetic, not user
data. Diagnostics only; there is no metrics equivalent.

```ts
simulate({ type: 'hang', summary: 'Simulated 3s hang' });
```

---

### Types

#### `DiagnosticEvent`

| Field | Type | Notes |
| --- | --- | --- |
| `platform` | `'ios' \| 'android'` | Originating platform |
| `type` | `DiagnosticType` | Normalized category |
| `timestamp` | `number` | Epoch milliseconds |
| `reasonCode?` | `number` | Platform-native code, when provided |
| `callStack?` | `string` | **Unsymbolicated** stack, when available |
| `summary` | `string` | Human-readable one-liner |
| `appVersion` | `string` | |
| `osVersion` | `string` | |
| `raw` | `unknown` | The unmodified source payload |

#### `DiagnosticType`

`'crash'` · `'hang'` · `'cpu-exception'` · `'disk-write'` · `'native-crash'` · `'anr'` ·
`'low-memory'` · `'kill'` · `'other'`

Unrecognized source values are coerced to `'other'` rather than dropped.

#### `MetricSnapshot`

| Field | Type | Notes |
| --- | --- | --- |
| `platform` | `'ios'` | Always iOS |
| `timestamp` | `number` | Payload end time, epoch ms |
| `appVersion` / `osVersion` | `string` | |
| `cpuTimeMs?` | `number` | Cumulative CPU time |
| `peakMemoryBytes?` | `number` | |
| `averageSuspendedMemoryBytes?` | `number` | |
| `averageTimeToFirstDrawMs?` | `number` | Best-effort histogram average |
| `cellularDownloadBytes?` / `cellularUploadBytes?` | `number` | |
| `wifiDownloadBytes?` / `wifiUploadBytes?` | `number` | |
| `backgroundExitCounts?` | `MetricExitCounts` | **Exit counts by reason** (iOS 14+) |
| `foregroundExitCounts?` | `MetricExitCounts` | iOS 14+ |
| `raw` | `unknown` | Full source payload |

Every measurement is optional — the OS omits sections it has no data for.

#### Other types

```ts
type DiagnosticPlatform = 'ios' | 'android';
type DiagnosticListener  = (events: DiagnosticEvent[]) => void;
type MetricListener      = (metrics: MetricSnapshot[]) => void;
type MetricExitCounts    = Record<string, number>; // reason -> cumulative count
type Unsubscribe         = () => void;
```

---

## Debug UI

A single, platform-detecting debug view, shipped from a separate entry point so it tree-shakes
out of production bundles:

```tsx
import { DiagnosticsDebugView, simulate } from 'react-native-metrickit-sdk/debug';

<DiagnosticsDebugView tabs />;

simulate({ type: 'crash', summary: 'Simulated crash' });
```

### `DiagnosticsDebugViewProps`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tabs` | `boolean` | `false` | Show platform-aware type tabs |
| `style` | `ViewStyle` | — | Container style override |

Tabs adapt to the platform so none are ever dead:

| Platform | Tabs |
| --- | --- |
| **iOS** | All · Crashes · Hangs · CPU · Disk · Metrics |
| **Android** | All · Crashes · ANRs |

`low-memory` and `kill` events appear under **All** on Android. The view renders explicit empty,
unsupported-OS, and permission states rather than a blank screen.

> Gate it to development builds: `{__DEV__ && <DiagnosticsDebugView tabs />}`

## iOS metrics

MetricKit emits two different payloads. This package handles **both**, but they are separate
streams:

| | Payload | API |
| --- | --- | --- |
| Diagnostics | `MXDiagnosticPayload` | `onIOSDiagnostics` |
| Metrics | `MXMetricPayload` | `onIOSMetrics` |

```tsx
import { onIOSMetrics, type MetricSnapshot } from 'react-native-metrickit-sdk';

const unsubscribe = onIOSMetrics((snapshots: MetricSnapshot[]) => {
  const latest = snapshots[snapshots.length - 1];
  console.log('background exits by reason', latest?.backgroundExitCounts);
});
```

`backgroundExitCounts` is the most actionable field — it tells you *why* iOS killed your app in
the background (`memoryResourceLimitExit`, `appWatchdogExit`, `cpuResourceLimitExit`, …).

- **iOS-only.** Android has no `MXMetricPayload`; its exit reasons come from `onAndroidExitInfo`.
- **Battery drain is not included** — MetricKit exposes no direct battery-drain metric.
- Consent-gated, batched ~daily, physical device only.

## Offline symbolication

Diagnostics arrive **unsymbolicated** (hex offsets). Symbolicate offline in CI — never on device,
since it requires build artifacts:

```sh
# iOS: resolve frames with a matching dSYM (UUID-checked)
npx rn-metrickit-symbolicate --input event.json --platform ios --dsym MyApp.dSYM

# Android native: resolve a tombstone with NDK symbols
npx rn-metrickit-symbolicate --input event.json --platform android --symbols obj/local/arm64-v8a

# Android JVM: de-obfuscate with the R8/ProGuard mapping
npx rn-metrickit-symbolicate --input event.json --platform android --mapping mapping.txt
```

| Flag | Description |
| --- | --- |
| `--input`, `-i` | Exported `DiagnosticEvent` JSON (object or array) — **required** |
| `--platform`, `-p` | `ios` \| `android` — **required** |
| `--dsym` | iOS `.dSYM` bundle |
| `--symbols` | Android NDK unstripped symbols directory |
| `--mapping` | Android R8/ProGuard `mapping.txt` |
| `--arch` | iOS arch for `atos` (default `arm64`) |
| `--output`, `-o` | Write result JSON (default stdout) |

**Before:** `MyApp 0x0000000000004000` → **after:** `MyApp -[ViewController crash] (ViewController.m:42)`

Exits non-zero with a clear message when a dSYM/mapping is missing or its UUID doesn't match the
event — it will not silently emit wrong frames. Archive your dSYMs and `mapping.txt` per release.

## Platform-specific behavior

| | iOS | Android |
| --- | --- | --- |
| Source | MetricKit | `ApplicationExitInfo` |
| Floor | 14.0 | API 30 |
| Delivery | Batch, ~daily, at a later launch | Immediately readable at next launch |
| Simulator/emulator | **Never** produces real data | Real exit records available |
| Types produced | `crash`, `hang`, `cpu-exception`, `disk-write` | `crash`, `native-crash`, `anr`, `low-memory`, `kill` |
| Dedup | Handled by the OS | Persisted cursor (`SharedPreferences`) |
| Call stack | `MXCallStackTree` JSON | ANR trace / native tombstone |
| Metrics | `onIOSMetrics` | Not available |
| Notifications | `UNUserNotificationCenter` | `NotificationManager` + channel |
| Live push while running | Best-effort event → re-drain | Pull-only |

There is no `hang` on Android and no `anr` on iOS — those are platform concepts that do not exist
on the other side.

## Error handling

**Nothing in this library throws.** That is the central design guarantee, and you should not wrap
calls in `try/catch`.

| Failure | Result |
| --- | --- |
| Unsupported OS version | Clean no-op; subscriptions return a valid unsubscribe |
| Native module missing / bridge error | Drain resolves to `[]`; a warning is logged |
| Malformed OS payload | The bad record is **dropped**; well-formed records still delivered |
| Non-JSON bridge response | Empty array |
| A listener of yours throws | Logged and isolated; other listeners still run |
| Missing notification permission | Notification silently not posted |

All internal failures log to the console prefixed with `[react-native-metrickit]`. If you see no
events and no warnings, the most likely cause is that **consent is off** — not an error.

## Limitations & known behaviors

- **Not real-time.** iOS delivers ~daily at a later launch; Android at the next launch. Neither
  reports a crash as it happens.
- **No Simulator data on iOS.** MetricKit never delivers on the Simulator. Use `simulate()`.
- **Consent is off by default**, so a fresh integration emits nothing until `setConsent(true)`.
- **Metrics are iOS-only**, and **battery drain is not exposed** by MetricKit at all.
- **Call stacks are unsymbolicated** on device. Symbolicate offline.
- **The library persists nothing** except a single Android dedup timestamp. Store events yourself
  if you need history.
- **Android keeps a limited exit history** (~16 records) — a burst of crashes can age records out.
- **`averageTimeToFirstDrawMs` is a best-effort** histogram average; the exact histogram is in `raw`.
- **Expo Go is unsupported.**
- **On the web the package is inert.** It imports safely under `react-native-web` (so a shared
  RN + web codebase still bundles), but every method is a no-op — the OS diagnostics APIs simply
  do not exist there.

## Best practices

- **Ask for consent first.** Call `setConsent(true)` only after the user agrees, and be aware that
  `callStack` and `summary` can contain PII.
- **Always unsubscribe.** Return the unsubscribe function from your `useEffect` to avoid leaks.
- **Subscribe once, high in the tree.** Diagnostics arrive as one batch per launch; subscribing in
  many components just multiplies work.
- **Persist events yourself** the moment you receive them — the library keeps nothing.
- **Gate the debug view** behind `__DEV__`.
- **Use `simulate()` in development** rather than waiting a day for a real payload.
- **Archive dSYMs and `mapping.txt`** for every release, or symbolication is impossible later.
- **Don't `try/catch` this library.** It cannot throw; a `catch` block will simply never run.

## Troubleshooting

<details>
<summary><b><code>'Metrickit-Swift.h' file not found</code> when building iOS</b></summary>

The pod only generates that Swift↔ObjC interop header once it has compiled the Swift sources.
Re-run `pod install` and clean the build:

```sh
cd ios && pod install
# Xcode: Product → Clean Build Folder (⇧⌘K), then rebuild
```
</details>

<details>
<summary><b>No diagnostics ever arrive</b></summary>

In order of likelihood:
1. **Consent is off.** Call `setConsent(true)`.
2. You're on the **iOS Simulator** — MetricKit never delivers there. Use a physical device, or
   `simulate()`.
3. Delivery is **batched**: iOS waits until a later launch (~24h). Android needs the app to have
   actually died at least once.
4. **Android below API 30** — `ApplicationExitInfo` doesn't exist; the module no-ops.
</details>

<details>
<summary><b>The Metrics tab is always empty</b></summary>

`MXMetricPayload` only arrives on a **physical iOS device**, roughly once a day. There is no
`simulate()` for metrics. This is expected on a Simulator or a freshly installed app.
</details>

<details>
<summary><b>The notification never appears</b></summary>

It requires all of: `setDiagnosticNotifications(true)`, `setConsent(true)`, a **non-empty
diagnostics drain**, and OS notification permission. The library never prompts for permission —
your app must. On Android 13+ you need `POST_NOTIFICATIONS`. Metrics do not trigger notifications.
</details>

<details>
<summary><b><code>yarn start</code> fails: "Couldn't find a script named start"</b></summary>

The repository root is the library, not an app. Metro lives in the example app:

```sh
yarn example start   # or: yarn example ios / yarn example android
```
</details>

<details>
<summary><b>Native build fails after I edited <code>NativeMetrickit.ts</code></b></summary>

That file is the codegen spec. After changing it you must regenerate native code — `pod install`
re-runs codegen on iOS; rebuild on Android. Both native modules must implement every method in
the spec, or the generated interface won't be satisfied.
</details>

## How it works internally

**[ARCHITECTURE.md](./ARCHITECTURE.md)** documents the full internals: the end-to-end data flow,
a module-by-module map of `src/`, `ios/`, and `android/`, the eight key design decisions with
their rationale and rejected alternatives, the structural crash-free strategy, how to extend the
library with a new diagnostic source, and the testing strategy.

## Versioning

This project follows [Semantic Versioning](https://semver.org/).

While the package is **pre-1.0**, minor versions may contain breaking changes; patch versions
never will. The public API surface is everything exported from `react-native-metrickit-sdk` and
`react-native-metrickit-sdk/debug`, plus the `rn-metrickit-symbolicate` CLI. Anything under
`src/internal/` is private and may change at any time.

Releases are cut with [release-it](https://github.com/release-it/release-it) and conventional
commits. Every release is recorded in the [changelog](./CHANGELOG.md).

## Contributing

Contributions are welcome. Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
development workflow, the branching strategy (`dev` for active work, `main` for production), the
commit convention, and the pre-PR verification checklist. All contributors are expected to follow
the [Code of Conduct](./CODE_OF_CONDUCT.md).

Security issues should follow [SECURITY.md](./SECURITY.md) rather than a public issue.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © Qamber Haider

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)

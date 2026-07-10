# Architecture

This document explains how `react-native-metrickit` works internally: the end-to-end flow, the
responsibility of each module, and the design decisions behind them. It is written for
maintainers and contributors. For consumer-facing usage, see the [README](./README.md).

## Table of contents

- [Design goals](#design-goals)
- [End-to-end flow](#end-to-end-flow)
- [Layers](#layers)
- [Module map](#module-map)
- [Design decisions](#design-decisions)
- [The crash-free strategy](#the-crash-free-strategy)
- [Extending: adding a new source](#extending-adding-a-new-source)
- [Testing strategy](#testing-strategy)

---

## Design goals

Four constraints drove every decision. They are worth internalising before changing anything:

1. **Crash-free above all.** The package must never crash or destabilise the host app. A parse
   failure, a missing permission, or an unsupported OS must degrade to a benign no-op — never an
   exception that reaches the consumer.
2. **Zero network in core.** The package collects and normalises; it never transmits. Where data
   goes is the consumer's decision.
3. **One contract.** iOS and Android are wildly different sources. Consumers should not care.
   Both are adapted to a single normalised `DiagnosticEvent`.
4. **Honesty about delivery.** The underlying OS APIs are batched, not real-time. The library
   surfaces that plainly rather than pretending to be a real-time crash reporter.

---

## End-to-end flow

```
        ┌───────────────────────────────────────────────────────────┐
        │  OS  (the only real source of truth)                      │
        │                                                           │
        │  iOS: MetricKit             Android: ActivityManager      │
        │    MXDiagnosticPayload        getHistoricalProcess-       │
        │    MXMetricPayload            ExitReasons()               │
        └───────────────┬───────────────────────────┬───────────────┘
                        │ delivered ~daily,         │ readable immediately,
                        │ at a later launch         │ at next launch
                        ▼                           ▼
        ┌───────────────────────────┐   ┌───────────────────────────┐
        │  MetricKitManager.swift   │   │  MetrickitModule.kt       │
        │  · subscriber, buffers    │   │  · reads exit records     │
        │  · DiagnosticParser       │   │  · ExitInfoParser         │
        │  · MetricsParser          │   │  · cursor dedup (prefs)   │
        │  · SafeExecutor wraps all │   │  · SafeExecutor wraps all │
        └───────────────┬───────────┘   └───────────┬───────────────┘
                        │                           │
                        └──────────┬────────────────┘
                                   ▼
                        ┌──────────────────────┐
                        │   CONSENT GATE       │  ← applied natively, before
                        │   (drain returns []) │    anything leaves native
                        └──────────┬───────────┘
                                   │ JSON string
                                   ▼
                        ┌──────────────────────┐
                        │  TurboModule bridge  │  NativeMetrickit.ts
                        │  getIOSDiagnostics() │  getAndroidExitInfo()
                        │  getIOSMetrics()     │
                        └──────────┬───────────┘
                                   ▼
                        ┌──────────────────────┐
                        │  parse + validate    │  internal/parse.ts
                        │  drop malformed      │  internal/parseMetrics.ts
                        └──────────┬───────────┘
                                   ▼
                        ┌──────────────────────┐
                        │  registry fan-out    │  internal/registry.ts
                        │  (crash-isolated)    │
                        └───┬──────────┬───────┘
                            │          │
              ┌─────────────┘          └─────────────┐
              ▼                                      ▼
    ┌───────────────────┐                  ┌───────────────────┐
    │ your listeners    │                  │ dev ring buffer   │
    │ (onIOSDiagnostics)│                  │ (opt-in)          │
    └───────────────────┘                  └───────────────────┘
                            │
                            └──────────► DiagnosticsDebugView
```

`simulate()` injects a synthetic event directly at the **registry fan-out** stage, bypassing
native and the consent gate — the payload is synthetic, not user data.

---

## Layers

### 1. OS sources

| | iOS | Android |
| --- | --- | --- |
| API | MetricKit (`MXMetricManagerSubscriber`) | `ActivityManager.getHistoricalProcessExitReasons` |
| Floor | iOS 14+ (diagnostics), 13+ (metrics) | API 30+ |
| Timing | OS **pushes** a payload ~daily, at a later launch | App **pulls** the history; records exist immediately |
| Payloads | `MXDiagnosticPayload` (crash/hang/cpu/disk), `MXMetricPayload` (metrics) | `ApplicationExitInfo` records |

This asymmetry is the single most important thing to understand. iOS is push-and-batched;
Android is pull-and-immediate. The library hides the difference behind two subscriptions that
both *look* the same, but the Android one has no 24-hour latency.

### 2. Native collectors

Both platforms follow the same shape: **collect → parse → format → normalise → gate → serialise**.

- **iOS** — `MetricKitManager` registers a subscriber at launch and buffers payloads in memory.
  `DiagnosticParser` walks `MXCallStackTree` and extracts the four diagnostic types;
  `MetricsParser` extracts `MXMetricPayload` fields (including exit counts by reason).
  `DiagnosticFormatter` builds the human-readable `summary`.
- **Android** — `MetrickitModule` reads the exit history, filters by a persisted cursor,
  and delegates to `ExitInfoParser` / `ExitInfoFormatter`.

Nothing is written to disk except the Android dedup cursor (see below).

### 3. The consent gate

Applied **natively, inside `drain()`**, before any bytes cross the bridge. With consent off,
`drain()` returns an empty array *without clearing the buffer* — so once consent is granted,
previously-buffered diagnostics are still delivered. This is the whole privacy posture: no
consent, nothing leaves native.

### 4. The bridge

A codegen'd TurboModule (`src/NativeMetrickit.ts`) exposing three pull methods
(`getIOSDiagnostics`, `getAndroidExitInfo`, `getIOSMetrics`), two controls, and the
`addListener`/`removeListeners` pair required by `NativeEventEmitter`.

Batches cross as **JSON strings**, not structured objects. See [D3](#d3--json-string-transport).

### 5. JS parse + fan-out

`internal/parse.ts` and `internal/parseMetrics.ts` validate every record and **drop malformed
ones** rather than surfacing a partial object. `internal/registry.ts` fans a batch out to
subscribers and the optional dev buffer, wrapping each listener call so one throwing listener
never blocks the others or the host.

---

## Module map

### JavaScript / TypeScript (`src/`)

| File | Responsibility |
| --- | --- |
| `types.ts` | The `DiagnosticEvent` and `MetricSnapshot` contracts. The single source of truth. |
| `NativeMetrickit.ts` | Codegen TurboModule spec. Changing this requires regenerating native code. |
| `safe.ts` | `safeSync` / `safeAsync` / `safeVoid` / `noop` — the JS half of the crash-free guarantee. |
| `subscriptions.ts` | `onIOSDiagnostics`, `onAndroidExitInfo`. Drains on subscribe. |
| `metrics.ts` | `onIOSMetrics`. Own listener set; iOS-only. |
| `consent.ts` | `setConsent` / `hasConsent`. Forwards to native; mirrors state. |
| `notifications.ts` | `setDiagnosticNotifications`. |
| `buffer.ts` | Opt-in, capped, overwrite-oldest ring buffer. In-memory only. |
| `simulate.ts` | Dev-only synthetic event injection. |
| `internal/parse.ts` | Validate + normalise a diagnostics JSON batch. Never throws. |
| `internal/parseMetrics.ts` | Same, for metric snapshots. |
| `internal/registry.ts` | Listener sets per stream + buffer sink; crash-isolated fan-out. |
| `debug/DiagnosticsDebugView.tsx` | Platform-aware debug UI. Shipped from `./debug` so it tree-shakes out. |

### iOS (`ios/`)

| File | Responsibility |
| --- | --- |
| `Metrickit.h/.mm` | ObjC++ TurboModule surface. Also an `RCTEventEmitter`. Delegates to Swift. |
| `MetricKitManager.swift` | `MXMetricManagerSubscriber`; buffers diagnostics + metrics; consent-gated `drain()`. |
| `DiagnosticParser.swift` | `MXDiagnosticPayload` → normalised dicts. Walks `MXCallStackTree`. |
| `MetricsParser.swift` | `MXMetricPayload` → normalised dict, incl. exit counts by reason. |
| `DiagnosticFormatter.swift` | Human-readable `summary` strings. |
| `NotificationHelper.swift` | Local notification via `UNUserNotificationCenter`. |
| `SafeExecutor.swift` | Swallow-and-log wrapper. |

The ObjC++ file imports the generated `Metrickit-Swift.h` interop header. That header only
exists after `pod install` compiles the Swift sources — see
[Troubleshooting](./README.md#troubleshooting).

### Android (`android/src/main/java/com/metrickit/`)

| File | Responsibility |
| --- | --- |
| `MetrickitModule.kt` | TurboModule impl; reads exit reasons; cursor dedup; consent gate. |
| `MetrickitPackage.kt` | React package registration. |
| `ExitInfoParser.kt` | `ApplicationExitInfo` → normalised JSON. Reads the trace/tombstone defensively. |
| `ExitInfoFormatter.kt` | Reason-code → normalised type + summary. |
| `NotificationHelper.kt` | Local notification + channel. |
| `SafeExecutor.kt` | Swallow-and-log wrapper. |

### Tooling (`bin/`)

`rn-metrickit-symbolicate.js` — offline CLI. Pure helpers are exported for unit testing; the
process entry point only runs when invoked directly.

---

## Design decisions

### D1 — One normalised `DiagnosticEvent`; sources are adapters

Each platform gets a parser + formatter that emit the same shape. Consumers stay
source-agnostic, and adding a new source is additive.

*Rejected:* per-platform event types. That pushes normalisation into every consumer's code and
destroys the extensibility seam.

### D2 — A separate `MetricSnapshot` for metrics

Metrics are aggregate counters and measurements, not incident reports. They have no `type`, no
`callStack`, no single timestamp of occurrence. Forcing them into `DiagnosticEvent` would make
both types incoherent.

*Rejected:* overloading `DiagnosticEvent` with optional metric fields.

### D3 — JSON-string transport

React Native's codegen requires concrete types. Our `raw` field is, by definition, an arbitrary
OS payload we do not want to lose. Serialising the batch to a JSON string on the native side and
parsing it in JS is the only way to preserve `raw` faithfully while keeping the spec codegen-legal.

The cost is one serialise/parse per drain — negligible, given drains happen roughly once per
launch.

### D4 — Pull-based drain is the guaranteed path

`onIOSDiagnostics` / `onAndroidExitInfo` / `onIOSMetrics` all **drain on subscribe**. On iOS, a
live MetricKit callback additionally emits an event that triggers a re-drain — but that emission
is treated as a best-effort optimisation, not a correctness dependency.

This matters: if `RCTEventEmitter` emission misbehaves under a particular New/Old-architecture
configuration, **nothing breaks** — the next launch's drain still delivers everything. Correctness
never depends on the event.

### D5 — Consent defaults to OFF and gates at the source

Stack traces and exit descriptions can carry PII. The safe default is to emit nothing until the
integrator has decided. The gate lives in native `drain()`, not in JS, so a JS bug cannot leak
data that native never handed over.

The trade-off is real: developers see no events out of the box until they call
`setConsent(true)`. This is documented prominently, and the debug view's empty state explains it.

### D6 — Android dedup via a persisted cursor

`getHistoricalProcessExitReasons` returns a rolling history (~16 records). Without a cursor,
every launch would re-emit every old exit. We persist the newest emitted timestamp in
`SharedPreferences` (`react_native_metrickit` → `last_seen_exit_timestamp`) and only emit records
strictly newer than it.

**This single `Long` is the only thing the library ever writes to disk.**

*Rejected:* an in-memory cursor. It loses dedup across launches — precisely the scenario that
matters, since exit records are only ever read at launch.

### D7 — Debug UI behind a separate export

`DiagnosticsDebugView` lives at `react-native-metrickit/debug`, not the root index, so it and its
RN component imports tree-shake out of production bundles that never reference it.

### D8 — Symbolication is offline and CLI-only

Symbolication needs the dSYM / `mapping.txt` / NDK symbols — build artifacts that must never ship
to a device. The CLI runs in CI, validates the dSYM UUID against the event, and exits non-zero on
mismatch rather than silently producing wrong frames.

---

## The crash-free strategy

Crash-freedom is enforced **structurally**, not by convention. Every path has a guard:

| Layer | Mechanism |
| --- | --- |
| Swift | `SafeExecutor.attempt` wraps parsing; `guard let` / `if let` only — **no force-unwraps**; `@available` gates. |
| Kotlin | `SafeExecutor.value/attempt` wraps every read; hard `Build.VERSION.SDK_INT >= 30` gate; never throws into RN. |
| Bridge | Every promise resolves — with `"[]"` on any failure. Never rejects. |
| JS | Every public method routes through `safe.ts`; failures log and return a benign fallback. |
| Fan-out | Each listener invocation is individually wrapped; one throwing listener cannot block others. |
| Parsing | Malformed records are **dropped**, not surfaced. Non-JSON input yields `[]`. |

The practical rule for contributors: **if you add a code path that can throw, wrap it.** A new
native read goes inside `SafeExecutor`; a new public JS method goes inside `safe*`.

---

## Extending: adding a new source

The contract is the extension seam. To add a source (say, a new Android signal):

1. **Do not change `DiagnosticEvent`.** Map your source onto the existing `type` union, or add one
   variant to it.
2. Write a `FooParser` + `FooFormatter` on the native side that emit the same normalised dicts.
3. Buffer them and expose a consent-gated `drainFoo()`.
4. Add `getFoo(): Promise<string>` to `src/NativeMetrickit.ts`, and **implement it on both
   platforms** — codegen makes it abstract everywhere (return `"[]"` on the platform that has no
   such source).
5. Add a subscription in `subscriptions.ts` that drains and calls `deliver()`.

Consumers need no changes: their existing listeners receive the new events, already normalised.

> After editing `src/NativeMetrickit.ts` you **must** regenerate native code (`pod install` for
> iOS re-runs codegen) or the native module will not satisfy the generated interface.

---

## Testing strategy

| What | How | Where |
| --- | --- | --- |
| Normalisation + malformed-input crash-freedom | Jest, against captured fixtures | `src/__tests__/parse.test.ts`, `parseMetrics.test.ts` |
| Subscriptions, consent, buffer, simulate | Jest, with the TurboModule mocked | `src/__tests__/*.test.ts` |
| Symbolication CLI helpers | Jest, pure functions | `bin/__tests__/` |
| Bridge contract | RN codegen — generated signatures must match the native implementations | CI |
| Native compilation | `pod install` + `xcodebuild -target Metrickit` | CI / locally |
| Old + New architecture | CI build matrix | `.github/workflows/ci.yml` |

**What is not automatically verifiable:** a real `MXDiagnosticPayload` or `MXMetricPayload`
arrives only on a **physical device**, roughly daily. It never arrives on the Simulator. This is
why `simulate()` exists — it exercises the entire JS delivery path (parse → registry → listeners
→ debug view) without waiting on the OS.

When changing native parsers, the honest workflow is: unit-test the JS normalisation against a
fixture, compile-verify the native code, and then confirm on a real device before releasing.

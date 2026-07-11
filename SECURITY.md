# Security Policy

## Supported versions

While the package is pre-1.0, only the latest published version receives security fixes.

| Version | Supported |
| --- | --- |
| Latest `0.x` | ✅ |
| Older `0.x` | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report them privately via GitHub's
[private vulnerability reporting](https://github.com/qam12/react-native-metrickit/security/advisories/new),
or by email to `qamb565@gmail.com`.

Please include:

- a description of the issue and its impact,
- the affected version(s) and platform (iOS / Android),
- steps to reproduce, and a proof of concept if you have one.

You can expect an acknowledgement within a few days. Once the issue is confirmed, a fix will be
prepared and released, and you will be credited in the advisory unless you prefer otherwise.

## Security posture of this package

Understanding the design helps scope any report:

- **Zero network in core.** The package never transmits data. It normalizes OS diagnostics and
  hands them to your callback. Where the data goes afterwards is entirely your application's
  responsibility.
- **Consent-gated at the source.** Emission is off by default. The gate is enforced in **native**
  code, before any data crosses the bridge — a JavaScript-side bug cannot leak data that native
  never released.
- **Minimal on-device persistence.** The only thing the library writes to disk is a single
  `Long` timestamp (the Android dedup cursor) in app-private `SharedPreferences`. Diagnostics,
  metrics, and the optional dev buffer are held in memory only and are lost on app restart.
- **No `eval`, no dynamic `require`.** No reflection beyond guarded platform-API access.
- **Zero runtime dependencies.** `react` and `react-native` are peer dependencies.

## Handling diagnostic data responsibly

Diagnostic payloads can contain personally identifiable information:

- **`callStack`** may embed file paths, usernames, or values captured in frames.
- **`summary`** and **`raw`** may include OS-provided exit descriptions.

If you forward events off-device, treat them as sensitive: obtain user consent appropriate to
your jurisdiction before calling `setConsent(true)`, transmit over TLS, apply retention limits,
and scrub or hash anything you don't need. Symbolication should happen offline in CI using build
artifacts (dSYM, `mapping.txt`), which must never be shipped to devices.

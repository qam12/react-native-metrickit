import Foundation
#if canImport(MetricKit)
  import MetricKit
#endif

/// Internal MetricKit subscriber. Deliberately **not** exposed to Objective-C so
/// that MetricKit types never leak into the generated `Metrickit-Swift.h` interop
/// header (an `@import MetricKit;` there is fragile from the Objective-C++
/// TurboModule). All OS interaction is guarded and swallowed. See `ios-diagnostics`.
@available(iOS 13.0, *)
private final class MetricKitSubscriber: NSObject, MXMetricManagerSubscriber {
  var consentGranted = false
  var notificationsEnabled = false
  var onDiagnostics: (() -> Void)?

  private var pending: [[String: Any]] = []
  private var pendingMetrics: [[String: Any]] = []
  private let queue = DispatchQueue(label: "com.metrickit.diagnostics")

  /// Consent-gated drain: returns (and clears) buffered diagnostics only when
  /// consent is granted; otherwise returns empty and retains them for later.
  func drain() -> [[String: Any]] {
    return queue.sync {
      guard consentGranted else { return [] }
      let out = pending
      pending = []
      return out
    }
  }

  /// Consent-gated drain of buffered `MXMetricPayload` snapshots.
  func drainMetrics() -> [[String: Any]] {
    return queue.sync {
      guard consentGranted else { return [] }
      let out = pendingMetrics
      pendingMetrics = []
      return out
    }
  }

  func didReceive(_ payloads: [MXMetricPayload]) {
    queue.sync {
      for payload in payloads {
        SafeExecutor.attempt("MetricsParser.parse") {
          pendingMetrics.append(MetricsParser.parse(payload: payload))
        }
      }
    }
  }

  @available(iOS 14.0, *)
  func didReceive(_ payloads: [MXDiagnosticPayload]) {
    var newCount = 0
    queue.sync {
      for payload in payloads {
        SafeExecutor.attempt("DiagnosticParser.parse") {
          let events = DiagnosticParser.parse(payload: payload)
          pending.append(contentsOf: events)
          newCount += events.count
        }
      }
    }
    if newCount > 0 {
      if consentGranted && notificationsEnabled {
        NotificationHelper.post(count: newCount)
      }
      onDiagnostics?()
    }
  }
}

/// Objective-C facade for the bridge. Exposes only plain types (Bool, a block,
/// and `[[String: Any]]`) so the generated interop header stays MetricKit-free.
/// Registers the subscriber at launch. See `ios-diagnostics`.
@available(iOS 13.0, *)
@objc public final class MetricKitManager: NSObject {
  @objc public static let shared = MetricKitManager()

  private let subscriber = MetricKitSubscriber()
  private var started = false

  @objc public var consentGranted: Bool {
    get { subscriber.consentGranted }
    set { subscriber.consentGranted = newValue }
  }

  @objc public var notificationsEnabled: Bool {
    get { subscriber.notificationsEnabled }
    set { subscriber.notificationsEnabled = newValue }
  }

  /// Invoked (best-effort) when a live payload arrives so the bridge can nudge JS to re-drain.
  @objc public var onDiagnostics: (() -> Void)? {
    get { subscriber.onDiagnostics }
    set { subscriber.onDiagnostics = newValue }
  }

  @objc public func start() {
    guard !started else { return }
    started = true
    MXMetricManager.shared.add(subscriber)
  }

  @objc public func drain() -> [[String: Any]] {
    return subscriber.drain()
  }

  @objc public func drainMetrics() -> [[String: Any]] {
    return subscriber.drainMetrics()
  }
}

import Foundation
#if canImport(MetricKit)
  import MetricKit
#endif

/// Builds human-readable one-line summaries for each diagnostic type. Never
/// force-unwraps; missing detail degrades to a generic phrase.
@available(iOS 14.0, *)
enum DiagnosticFormatter {
  static func crash(_ diagnostic: MXCrashDiagnostic) -> String {
    let reason = diagnostic.terminationReason ?? "app terminated"
    if let type = diagnostic.exceptionType {
      return "Crash: \(reason) (exceptionType \(type))"
    }
    return "Crash: \(reason)"
  }

  static func hang(_ diagnostic: MXHangDiagnostic) -> String {
    let duration = diagnostic.hangDuration
    return "App hang for \(duration.value) \(duration.unit.symbol)"
  }

  static func cpu(_ diagnostic: MXCPUExceptionDiagnostic) -> String {
    let cpuTime = diagnostic.totalCPUTime
    return "CPU exception: \(cpuTime.value) \(cpuTime.unit.symbol) consumed"
  }

  static func disk(_ diagnostic: MXDiskWriteExceptionDiagnostic) -> String {
    let writes = diagnostic.totalWritesCaused
    return "Excessive disk writes: \(writes.value) \(writes.unit.symbol)"
  }
}

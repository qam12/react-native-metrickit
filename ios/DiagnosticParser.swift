import Foundation
#if canImport(MetricKit)
  import MetricKit
#endif

/// Extracts crash / hang / CPU-exception / disk-write diagnostics from an
/// `MXDiagnosticPayload` and normalizes each into a JSON-serializable dictionary
/// matching the `DiagnosticEvent` contract. Safely walks `MXCallStackTree`.
@available(iOS 14.0, *)
enum DiagnosticParser {
  static func parse(payload: MXDiagnosticPayload) -> [[String: Any]] {
    var events: [[String: Any]] = []
    let timestamp = Int(payload.timeStampEnd.timeIntervalSince1970 * 1000)
    let raw = jsonObject(from: payload.jsonRepresentation())

    for diagnostic in payload.crashDiagnostics ?? [] {
      events.append(
        build(
          type: "crash", timestamp: timestamp, metaData: diagnostic.metaData,
          reasonCode: diagnostic.exceptionType?.intValue, callStack: diagnostic.callStackTree,
          summary: DiagnosticFormatter.crash(diagnostic), raw: raw))
    }
    for diagnostic in payload.hangDiagnostics ?? [] {
      events.append(
        build(
          type: "hang", timestamp: timestamp, metaData: diagnostic.metaData,
          reasonCode: nil, callStack: diagnostic.callStackTree,
          summary: DiagnosticFormatter.hang(diagnostic), raw: raw))
    }
    for diagnostic in payload.cpuExceptionDiagnostics ?? [] {
      events.append(
        build(
          type: "cpu-exception", timestamp: timestamp, metaData: diagnostic.metaData,
          reasonCode: nil, callStack: diagnostic.callStackTree,
          summary: DiagnosticFormatter.cpu(diagnostic), raw: raw))
    }
    for diagnostic in payload.diskWriteExceptionDiagnostics ?? [] {
      events.append(
        build(
          type: "disk-write", timestamp: timestamp, metaData: diagnostic.metaData,
          reasonCode: nil, callStack: diagnostic.callStackTree,
          summary: DiagnosticFormatter.disk(diagnostic), raw: raw))
    }
    return events
  }

  private static func build(
    type: String, timestamp: Int, metaData: MXMetaData?, reasonCode: Int?,
    callStack: MXCallStackTree?, summary: String, raw: Any?
  ) -> [String: Any] {
    var dict: [String: Any] = [
      "platform": "ios",
      "type": type,
      "timestamp": timestamp,
      "summary": summary,
      "appVersion": appVersion(),
      "osVersion": metaData?.osVersion ?? osVersion(),
    ]
    if let reasonCode = reasonCode {
      dict["reasonCode"] = reasonCode
    }
    if let callStack = callStack, let text = callStackString(callStack) {
      dict["callStack"] = text
    }
    if let raw = raw {
      dict["raw"] = raw
    }
    return dict
  }

  private static func callStackString(_ tree: MXCallStackTree) -> String? {
    return String(data: tree.jsonRepresentation(), encoding: .utf8)
  }

  private static func jsonObject(from data: Data) -> Any? {
    return try? JSONSerialization.jsonObject(with: data, options: [])
  }

  private static func appVersion() -> String {
    return (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "unknown"
  }

  private static func osVersion() -> String {
    return ProcessInfo.processInfo.operatingSystemVersionString
  }
}

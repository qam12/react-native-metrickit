import Foundation
#if canImport(MetricKit)
  import MetricKit
#endif

/// Extracts the useful fields from an `MXMetricPayload` into a JSON-serializable
/// dictionary matching the `MetricSnapshot` contract. Every section is optional
/// (the OS omits what it has no data for); the full payload is retained in `raw`.
/// Internal — never exposed to Objective-C. See ARCHITECTURE.md.
@available(iOS 13.0, *)
enum MetricsParser {
  static func parse(payload: MXMetricPayload) -> [String: Any] {
    var dict: [String: Any] = [
      "platform": "ios",
      "timestamp": Int(payload.timeStampEnd.timeIntervalSince1970 * 1000),
      "appVersion": payload.latestApplicationVersion,
      "osVersion": ProcessInfo.processInfo.operatingSystemVersionString,
    ]

    if let cpu = payload.cpuMetrics {
      dict["cpuTimeMs"] = milliseconds(cpu.cumulativeCPUTime)
    }

    if let memory = payload.memoryMetrics {
      dict["peakMemoryBytes"] = bytes(memory.peakMemoryUsage)
      dict["averageSuspendedMemoryBytes"] = bytes(memory.averageSuspendedMemory.averageMeasurement)
    }

    if let network = payload.networkTransferMetrics {
      dict["cellularDownloadBytes"] = bytes(network.cumulativeCellularDownload)
      dict["cellularUploadBytes"] = bytes(network.cumulativeCellularUpload)
      dict["wifiDownloadBytes"] = bytes(network.cumulativeWifiDownload)
      dict["wifiUploadBytes"] = bytes(network.cumulativeWifiUpload)
    }

    if let launch = payload.applicationLaunchMetrics,
      let average = histogramAverageMs(launch.histogrammedTimeToFirstDraw)
    {
      dict["averageTimeToFirstDrawMs"] = average
    }

    if #available(iOS 14.0, *), let exits = payload.applicationExitMetrics {
      dict["backgroundExitCounts"] = backgroundCounts(exits.backgroundExitData)
      dict["foregroundExitCounts"] = foregroundCounts(exits.foregroundExitData)
    }

    dict["raw"] = jsonObject(from: payload.jsonRepresentation()) ?? [:]
    return dict
  }

  private static func milliseconds(_ measurement: Measurement<UnitDuration>) -> Double {
    return measurement.converted(to: .milliseconds).value
  }

  private static func bytes(_ measurement: Measurement<UnitInformationStorage>) -> Double {
    return measurement.converted(to: .bytes).value
  }

  private static func histogramAverageMs(_ histogram: MXHistogram<UnitDuration>) -> Double? {
    var totalCount = 0
    var weighted = 0.0
    let enumerator = histogram.bucketEnumerator
    while let bucket = enumerator.nextObject() as? MXHistogramBucket<UnitDuration> {
      let midpoint =
        (bucket.bucketStart.converted(to: .milliseconds).value
          + bucket.bucketEnd.converted(to: .milliseconds).value) / 2.0
      weighted += midpoint * Double(bucket.bucketCount)
      totalCount += bucket.bucketCount
    }
    return totalCount > 0 ? weighted / Double(totalCount) : nil
  }

  @available(iOS 14.0, *)
  private static func backgroundCounts(_ data: MXBackgroundExitData) -> [String: Int] {
    return [
      "normalAppExit": data.cumulativeNormalAppExitCount,
      "memoryResourceLimitExit": data.cumulativeMemoryResourceLimitExitCount,
      "cpuResourceLimitExit": data.cumulativeCPUResourceLimitExitCount,
      "memoryPressureExit": data.cumulativeMemoryPressureExitCount,
      "badAccessExit": data.cumulativeBadAccessExitCount,
      "abnormalExit": data.cumulativeAbnormalExitCount,
      "illegalInstructionExit": data.cumulativeIllegalInstructionExitCount,
      "appWatchdogExit": data.cumulativeAppWatchdogExitCount,
      "suspendedWithLockedFileExit": data.cumulativeSuspendedWithLockedFileExitCount,
      "backgroundTaskAssertionTimeoutExit": data.cumulativeBackgroundTaskAssertionTimeoutExitCount,
    ]
  }

  @available(iOS 14.0, *)
  private static func foregroundCounts(_ data: MXForegroundExitData) -> [String: Int] {
    return [
      "normalAppExit": data.cumulativeNormalAppExitCount,
      "memoryResourceLimitExit": data.cumulativeMemoryResourceLimitExitCount,
      "badAccessExit": data.cumulativeBadAccessExitCount,
      "abnormalExit": data.cumulativeAbnormalExitCount,
      "illegalInstructionExit": data.cumulativeIllegalInstructionExitCount,
      "appWatchdogExit": data.cumulativeAppWatchdogExitCount,
    ]
  }

  private static func jsonObject(from data: Data) -> Any? {
    return try? JSONSerialization.jsonObject(with: data, options: [])
  }
}

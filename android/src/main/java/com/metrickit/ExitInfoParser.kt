package com.metrickit

import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.RequiresApi
import org.json.JSONObject

/**
 * Normalizes a single `ApplicationExitInfo` record into a JSON object matching
 * the `DiagnosticEvent` contract. The trace/tombstone blob (when present) is
 * read defensively and capped; failure to read it yields an event without a
 * call stack rather than an error. See ARCHITECTURE.md.
 */
internal object ExitInfoParser {
  private const val MAX_TRACE_CHARS = 20_000

  @RequiresApi(Build.VERSION_CODES.R)
  fun toJson(info: ApplicationExitInfo, appVersion: String): JSONObject? {
    return SafeExecutor.value("ExitInfoParser.toJson", null) {
      val obj = JSONObject()
      obj.put("platform", "android")
      obj.put("type", ExitInfoFormatter.type(info.reason))
      obj.put("timestamp", info.timestamp)
      obj.put("reasonCode", info.reason)
      obj.put("summary", ExitInfoFormatter.summary(info))
      obj.put("appVersion", appVersion)
      obj.put("osVersion", Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString())

      readTrace(info)?.let { obj.put("callStack", it) }
      obj.put("raw", rawJson(info))
      obj
    }
  }

  @RequiresApi(Build.VERSION_CODES.R)
  private fun rawJson(info: ApplicationExitInfo): JSONObject {
    val raw = JSONObject()
    SafeExecutor.attempt("ExitInfoParser.rawJson") {
      raw.put("reason", info.reason)
      raw.put("description", info.description)
      raw.put("importance", info.importance)
      raw.put("processName", info.processName)
      raw.put("pss", info.pss)
      raw.put("rss", info.rss)
      raw.put("status", info.status)
      raw.put("timestamp", info.timestamp)
    }
    return raw
  }

  @RequiresApi(Build.VERSION_CODES.R)
  private fun readTrace(info: ApplicationExitInfo): String? {
    // getTraceInputStream() carries the ANR trace / native tombstone when the
    // OS captured one. Read defensively and cap the size.
    return SafeExecutor.value("ExitInfoParser.readTrace", null) {
      info.traceInputStream?.bufferedReader()?.use { reader ->
        val text = reader.readText()
        if (text.length > MAX_TRACE_CHARS) text.substring(0, MAX_TRACE_CHARS) else text
      }
    }
  }
}

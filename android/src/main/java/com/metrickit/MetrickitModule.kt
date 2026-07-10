package com.metrickit

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import org.json.JSONArray

/**
 * Reads Android `ApplicationExitInfo` (API 30+) and exposes a consent-gated,
 * cross-launch-deduped drain to the bridge. Below API 30 every read is a clean
 * no-op. Never throws into React Native. See ARCHITECTURE.md.
 */
class MetrickitModule(reactContext: ReactApplicationContext) :
  NativeMetrickitSpec(reactContext) {

  private val appContext: Context = reactContext.applicationContext
  private val prefs =
    appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Volatile private var consentGranted = false
  @Volatile private var notificationsEnabled = false

  override fun setConsent(consent: Boolean) {
    consentGranted = consent
  }

  override fun setDiagnosticNotifications(enabled: Boolean) {
    notificationsEnabled = enabled
  }

  override fun getIOSDiagnostics(promise: Promise) {
    // iOS-only source; on Android this is always empty.
    promise.resolve(EMPTY)
  }

  override fun getIOSMetrics(promise: Promise) {
    // iOS-only source; on Android this is always empty.
    promise.resolve(EMPTY)
  }

  override fun getAndroidExitInfo(promise: Promise) {
    val json = SafeExecutor.value("getAndroidExitInfo", EMPTY) {
      when {
        !consentGranted -> EMPTY
        Build.VERSION.SDK_INT < Build.VERSION_CODES.R -> EMPTY
        else -> readNewExitInfo()
      }
    }
    promise.resolve(json)
  }

  @RequiresApi(Build.VERSION_CODES.R)
  private fun readNewExitInfo(): String {
    val activityManager =
      appContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        ?: return EMPTY

    val records =
      activityManager.getHistoricalProcessExitReasons(appContext.packageName, 0, 0)
    val lastSeen = prefs.getLong(KEY_CURSOR, 0L)
    var newest = lastSeen
    val version = appVersion()
    val array = JSONArray()

    // Records are returned most-recent first; emit only those newer than the cursor.
    for (info in records) {
      val timestamp = info.timestamp
      if (timestamp <= lastSeen) {
        continue
      }
      if (timestamp > newest) {
        newest = timestamp
      }
      ExitInfoParser.toJson(info, version)?.let { array.put(it) }
    }

    if (newest > lastSeen) {
      prefs.edit().putLong(KEY_CURSOR, newest).apply()
    }

    val count = array.length()
    if (count > 0 && consentGranted && notificationsEnabled) {
      NotificationHelper.post(appContext, count)
    }
    return array.toString()
  }

  private fun appVersion(): String {
    return SafeExecutor.value("appVersion", "unknown") {
      appContext.packageManager
        .getPackageInfo(appContext.packageName, 0)
        .versionName ?: "unknown"
    }
  }

  // Required by the event-emitter contract; Android exit info is pull-only, so
  // these are no-ops (no live events are pushed).
  override fun addListener(eventName: String) {
    // no-op
  }

  override fun removeListeners(count: Double) {
    // no-op
  }

  companion object {
    const val NAME = NativeMetrickitSpec.NAME
    private const val EMPTY = "[]"
    private const val PREFS = "react_native_metrickit"
    private const val KEY_CURSOR = "last_seen_exit_timestamp"
  }
}

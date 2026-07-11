package com.metrickit

import android.util.Log

/**
 * Crash-free guard (Android side). Wraps reads so any failure is logged and
 * swallowed rather than thrown into React Native. See ARCHITECTURE.md.
 */
internal object SafeExecutor {
  private const val TAG = "react-native-metrickit"

  fun attempt(context: String, block: () -> Unit) {
    try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "$context failed (ignored)", t)
    }
  }

  fun <T> value(context: String, fallback: T, block: () -> T): T {
    return try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "$context failed (ignored)", t)
      fallback
    }
  }
}

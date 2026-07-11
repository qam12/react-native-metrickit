package com.metrickit

import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * Maps `ApplicationExitInfo` reason codes to normalized diagnostic types and
 * human-readable summaries. Retains the source `description` for the summary.
 */
internal object ExitInfoFormatter {
  @RequiresApi(Build.VERSION_CODES.R)
  fun type(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_CRASH -> "crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "native-crash"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "low-memory"
    ApplicationExitInfo.REASON_SIGNALED,
    ApplicationExitInfo.REASON_DEPENDENCY_DIED,
    ApplicationExitInfo.REASON_USER_REQUESTED,
    ApplicationExitInfo.REASON_USER_STOPPED -> "kill"
    else -> "other"
  }

  @RequiresApi(Build.VERSION_CODES.R)
  fun reasonName(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_ANR -> "ANR"
    ApplicationExitInfo.REASON_CRASH -> "app crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "native crash"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "low memory"
    ApplicationExitInfo.REASON_SIGNALED -> "signalled"
    ApplicationExitInfo.REASON_USER_REQUESTED -> "user requested"
    ApplicationExitInfo.REASON_USER_STOPPED -> "user stopped"
    ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "dependency died"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive resource usage"
    ApplicationExitInfo.REASON_EXIT_SELF -> "exit self"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "initialization failure"
    ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "permission change"
    else -> "other"
  }

  @RequiresApi(Build.VERSION_CODES.R)
  fun summary(info: ApplicationExitInfo): String {
    val name = reasonName(info.reason)
    val description = info.description
    return if (description.isNullOrEmpty()) {
      "Process exit: $name"
    } else {
      "Process exit: $name ($description)"
    }
  }
}

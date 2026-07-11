package com.metrickit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * Posts a local notification on a non-empty drain. Best-effort: if the host app
 * lacks the runtime notification permission (Android 13+) the post silently
 * no-ops. Never throws.
 */
internal object NotificationHelper {
  private const val CHANNEL_ID = "react_native_metrickit_diagnostics"
  private const val CHANNEL_NAME = "Diagnostics"
  private const val NOTIFICATION_ID = 9317

  fun post(context: Context, count: Int) {
    SafeExecutor.attempt("NotificationHelper.post") {
      val manager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return@attempt

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW
        )
        manager.createNotificationChannel(channel)
      }

      val builder = android.app.Notification.Builder(context, CHANNEL_ID)
        .setContentTitle("New diagnostics captured")
        .setContentText(
          if (count == 1) "1 diagnostic is available." else "$count diagnostics are available."
        )
        .setSmallIcon(context.applicationInfo.icon)

      manager.notify(NOTIFICATION_ID, builder.build())
    }
  }
}

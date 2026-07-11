import Foundation
import UserNotifications

/// Posts a local notification when a non-empty diagnostic batch drains. If the
/// app lacks notification authorization the request silently no-ops — never a
/// crash, never a forced prompt.
enum NotificationHelper {
  static func post(count: Int) {
    let center = UNUserNotificationCenter.current()
    let content = UNMutableNotificationContent()
    content.title = "New diagnostics captured"
    content.body = count == 1 ? "1 diagnostic is available." : "\(count) diagnostics are available."
    let request = UNNotificationRequest(
      identifier: UUID().uuidString, content: content, trigger: nil)
    center.add(request, withCompletionHandler: nil)
  }
}

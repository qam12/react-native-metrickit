import Foundation

/// Crash-free guard (Swift side). Wraps throwing work so a parse failure is
/// logged and swallowed rather than propagated. See ARCHITECTURE.md.
enum SafeExecutor {
  static func attempt(_ context: String, _ block: () throws -> Void) {
    do {
      try block()
    } catch {
      NSLog("[react-native-metrickit] %@ failed (ignored): %@", context, String(describing: error))
    }
  }

  static func value<T>(_ context: String, default fallback: T, _ block: () throws -> T) -> T {
    do {
      return try block()
    } catch {
      NSLog("[react-native-metrickit] %@ failed (ignored): %@", context, String(describing: error))
      return fallback
    }
  }
}

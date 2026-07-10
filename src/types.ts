/**
 * The normalized diagnostic contract. Every source — iOS MetricKit and Android
 * `ApplicationExitInfo` — is adapted to this single shape so consumers stay
 * source-agnostic. See ARCHITECTURE.md.
 */

export type DiagnosticPlatform = 'ios' | 'android';

/**
 * Normalized diagnostic categories. iOS-origin: crash, hang, cpu-exception,
 * disk-write. Android-origin: crash, native-crash, anr, low-memory, kill.
 * `other` is the safe fallback for an unmapped source reason.
 */
export type DiagnosticType =
  | 'crash'
  | 'hang'
  | 'cpu-exception'
  | 'disk-write'
  | 'native-crash'
  | 'anr'
  | 'low-memory'
  | 'kill'
  | 'other';

export interface DiagnosticEvent {
  /** Originating platform. */
  platform: DiagnosticPlatform;
  /** Normalized diagnostic category. */
  type: DiagnosticType;
  /** Event time in epoch milliseconds. */
  timestamp: number;
  /** Platform-native reason code, when the source provides one. */
  reasonCode?: number;
  /** Human-readable (best-effort, unsymbolicated) call stack, when available. */
  callStack?: string;
  /** One-line human-readable description of what happened. */
  summary: string;
  /** Host app version at the time of the event. */
  appVersion: string;
  /** OS version at the time of the event. */
  osVersion: string;
  /** The unmodified source payload, retained so no detail is lost. */
  raw: unknown;
}

/** Callback receiving a batch of normalized diagnostics. */
export type DiagnosticListener = (events: DiagnosticEvent[]) => void;

/** Unsubscribe handle returned by every subscription. */
export type Unsubscribe = () => void;

/** Exit reason → cumulative count, from MetricKit `applicationExitMetrics`. */
export type MetricExitCounts = Record<string, number>;

/**
 * Normalized iOS MetricKit `MXMetricPayload` snapshot (aggregated ~daily). Every
 * measurement is optional because the OS omits sections it has no data for; the
 * full payload is always kept in `raw`. iOS-only. See ARCHITECTURE.md.
 */
export interface MetricSnapshot {
  platform: 'ios';
  /** Payload end time in epoch milliseconds. */
  timestamp: number;
  appVersion: string;
  osVersion: string;
  /** Cumulative CPU time consumed, milliseconds. */
  cpuTimeMs?: number;
  /** Peak memory usage, bytes. */
  peakMemoryBytes?: number;
  /** Average memory while suspended, bytes. */
  averageSuspendedMemoryBytes?: number;
  /** Best-effort average time-to-first-draw at launch, milliseconds. */
  averageTimeToFirstDrawMs?: number;
  cellularDownloadBytes?: number;
  cellularUploadBytes?: number;
  wifiDownloadBytes?: number;
  wifiUploadBytes?: number;
  /** Background exit counts by reason (iOS 14+). */
  backgroundExitCounts?: MetricExitCounts;
  /** Foreground exit counts by reason (iOS 14+). */
  foregroundExitCounts?: MetricExitCounts;
  /** The unmodified source payload. */
  raw: unknown;
}

/** Callback receiving a batch of metric snapshots. */
export type MetricListener = (metrics: MetricSnapshot[]) => void;

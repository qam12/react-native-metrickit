import type { MetricExitCounts, MetricSnapshot } from '../types';
import { logError } from '../safe';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function exitCounts(value: unknown): MetricExitCounts | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const out: MetricExitCounts = {};
  for (const [key, raw] of Object.entries(value)) {
    const count = num(raw);
    if (count !== undefined) {
      out[key] = count;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeOne(raw: unknown): MetricSnapshot | null {
  if (!isRecord(raw)) {
    return null;
  }
  const timestamp = num(raw.timestamp);
  if (timestamp === undefined) {
    return null;
  }

  const snapshot: MetricSnapshot = {
    platform: 'ios',
    timestamp,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : 'unknown',
    osVersion: typeof raw.osVersion === 'string' ? raw.osVersion : 'unknown',
    raw: 'raw' in raw ? raw.raw : raw,
  };

  const cpuTimeMs = num(raw.cpuTimeMs);
  if (cpuTimeMs !== undefined) {
    snapshot.cpuTimeMs = cpuTimeMs;
  }
  const peakMemoryBytes = num(raw.peakMemoryBytes);
  if (peakMemoryBytes !== undefined) {
    snapshot.peakMemoryBytes = peakMemoryBytes;
  }
  const averageSuspendedMemoryBytes = num(raw.averageSuspendedMemoryBytes);
  if (averageSuspendedMemoryBytes !== undefined) {
    snapshot.averageSuspendedMemoryBytes = averageSuspendedMemoryBytes;
  }
  const averageTimeToFirstDrawMs = num(raw.averageTimeToFirstDrawMs);
  if (averageTimeToFirstDrawMs !== undefined) {
    snapshot.averageTimeToFirstDrawMs = averageTimeToFirstDrawMs;
  }
  const cellularDownloadBytes = num(raw.cellularDownloadBytes);
  if (cellularDownloadBytes !== undefined) {
    snapshot.cellularDownloadBytes = cellularDownloadBytes;
  }
  const cellularUploadBytes = num(raw.cellularUploadBytes);
  if (cellularUploadBytes !== undefined) {
    snapshot.cellularUploadBytes = cellularUploadBytes;
  }
  const wifiDownloadBytes = num(raw.wifiDownloadBytes);
  if (wifiDownloadBytes !== undefined) {
    snapshot.wifiDownloadBytes = wifiDownloadBytes;
  }
  const wifiUploadBytes = num(raw.wifiUploadBytes);
  if (wifiUploadBytes !== undefined) {
    snapshot.wifiUploadBytes = wifiUploadBytes;
  }
  const background = exitCounts(raw.backgroundExitCounts);
  if (background !== undefined) {
    snapshot.backgroundExitCounts = background;
  }
  const foreground = exitCounts(raw.foregroundExitCounts);
  if (foreground !== undefined) {
    snapshot.foregroundExitCounts = foreground;
  }

  return snapshot;
}

/**
 * Parse a JSON metrics batch from native into validated snapshots. Any parse
 * failure yields an empty array; individually malformed records are dropped.
 * Never throws.
 */
export function parseMetricsBatch(json: string): MetricSnapshot[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch (error) {
    logError('parseMetricsBatch', error);
    return [];
  }
  if (!Array.isArray(decoded)) {
    return [];
  }

  const snapshots: MetricSnapshot[] = [];
  for (const item of decoded) {
    const normalized = normalizeOne(item);
    if (normalized !== null) {
      snapshots.push(normalized);
    }
  }
  return snapshots;
}

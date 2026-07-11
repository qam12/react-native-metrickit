import type {
  DiagnosticEvent,
  DiagnosticPlatform,
  DiagnosticType,
} from '../types';
import { logError } from '../safe';

const KNOWN_TYPES = new Set<DiagnosticType>([
  'crash',
  'hang',
  'cpu-exception',
  'disk-write',
  'native-crash',
  'anr',
  'low-memory',
  'kill',
  'other',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceType(value: unknown): DiagnosticType {
  return typeof value === 'string' && KNOWN_TYPES.has(value as DiagnosticType)
    ? (value as DiagnosticType)
    : 'other';
}

/**
 * Validate and normalize a single raw record into a `DiagnosticEvent`.
 * Returns `null` for anything malformed so the caller can drop it rather than
 * surface a partial/garbage event.
 */
function normalizeOne(
  raw: unknown,
  platform: DiagnosticPlatform
): DiagnosticEvent | null {
  if (!isRecord(raw)) {
    return null;
  }

  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : null;
  if (timestamp === null) {
    return null;
  }

  const event: DiagnosticEvent = {
    platform,
    type: coerceType(raw.type),
    timestamp,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : 'unknown',
    osVersion: typeof raw.osVersion === 'string' ? raw.osVersion : 'unknown',
    raw: 'raw' in raw ? raw.raw : raw,
  };

  if (typeof raw.reasonCode === 'number' && Number.isFinite(raw.reasonCode)) {
    event.reasonCode = raw.reasonCode;
  }
  if (typeof raw.callStack === 'string' && raw.callStack.length > 0) {
    event.callStack = raw.callStack;
  }

  return event;
}

/**
 * Parse a JSON batch string from native into validated events. Any parse
 * failure yields an empty array; individually malformed records are dropped.
 * Never throws.
 */
export function parseDiagnosticBatch(
  json: string,
  platform: DiagnosticPlatform
): DiagnosticEvent[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch (error) {
    logError('parseDiagnosticBatch', error);
    return [];
  }

  if (!Array.isArray(decoded)) {
    return [];
  }

  const events: DiagnosticEvent[] = [];
  for (const item of decoded) {
    const normalized = normalizeOne(item, platform);
    if (normalized !== null) {
      events.push(normalized);
    }
  }
  return events;
}

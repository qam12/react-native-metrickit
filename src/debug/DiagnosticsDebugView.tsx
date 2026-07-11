import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type {
  DiagnosticEvent,
  DiagnosticType,
  MetricSnapshot,
  Unsubscribe,
} from '../types';
import { onAndroidExitInfo, onIOSDiagnostics } from '../subscriptions';
import { onIOSMetrics } from '../metrics';

/**
 * Single, platform-detecting debug view. Auto-selects the relevant source from
 * `Platform.OS` (no iOS/Android tab split); optional tabs are by diagnostic
 * type. RN primitives only, dev-only, tree-shaken from `react-native-metrickit-sdk`
 * core (imported from `react-native-metrickit-sdk/debug`). See ARCHITECTURE.md.
 */

type TabKey = 'all' | 'crashes' | 'hangs' | 'anrs' | 'cpu' | 'disk' | 'metrics';

// `metrics` is special-cased (it renders a snapshot, not a filtered event list),
// so its `null` here is never used for filtering.
const TAB_TYPES: Record<TabKey, DiagnosticType[] | null> = {
  all: null,
  crashes: ['crash', 'native-crash'],
  hangs: ['hang'],
  anrs: ['anr'],
  cpu: ['cpu-exception'],
  disk: ['disk-write'],
  metrics: null,
};

const TAB_LABELS: Record<TabKey, string> = {
  all: 'All',
  crashes: 'Crashes',
  hangs: 'Hangs',
  anrs: 'ANRs',
  cpu: 'CPU',
  disk: 'Disk',
  metrics: 'Metrics',
};

// Platform-aware tab sets so no tab is ever dead: iOS surfaces hangs, CPU/disk
// exceptions, and MetricKit metrics; Android surfaces ANRs. Crashes and All apply
// to both.
const IOS_TABS: TabKey[] = [
  'all',
  'crashes',
  'hangs',
  'cpu',
  'disk',
  'metrics',
];
const ANDROID_TABS: TabKey[] = ['all', 'crashes', 'anrs'];
const PLATFORM_TABS: TabKey[] =
  Platform.OS === 'android' ? ANDROID_TABS : IOS_TABS;

const MAX_ROWS = 200;

export interface DiagnosticsDebugViewProps {
  /**
   * Show platform-aware type tabs (iOS: Crashes / Hangs / CPU / Disk;
   * Android: Crashes / ANRs). Defaults to false.
   */
  tabs?: boolean;
  /** Optional container style override. */
  style?: ViewStyle;
}

function osVersionNumber(): number {
  return Platform.OS === 'ios'
    ? Number.parseFloat(String(Platform.Version))
    : Number(Platform.Version);
}

function isSupported(): boolean {
  const version = osVersionNumber();
  if (Number.isNaN(version)) {
    return true; // don't block the view on an unparseable version
  }
  return Platform.OS === 'ios' ? version >= 14 : version >= 30;
}

export function DiagnosticsDebugView({
  tabs = false,
  style,
}: DiagnosticsDebugViewProps): React.JSX.Element {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [metrics, setMetrics] = useState<MetricSnapshot | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const supported = useMemo(isSupported, []);

  useEffect(() => {
    if (!supported) {
      return undefined;
    }
    const append = (batch: DiagnosticEvent[]): void => {
      setEvents((prev) => [...batch, ...prev].slice(0, MAX_ROWS));
    };
    const unsubscribe: Unsubscribe =
      Platform.OS === 'android'
        ? onAndroidExitInfo(append)
        : onIOSDiagnostics(append);
    return unsubscribe;
  }, [supported]);

  useEffect(() => {
    if (!supported || Platform.OS !== 'ios') {
      return undefined;
    }
    return onIOSMetrics((batch) => {
      const latest = batch[batch.length - 1];
      if (latest !== undefined) {
        setMetrics(latest);
      }
    });
  }, [supported]);

  const visible = useMemo(() => {
    const allowed = TAB_TYPES[tab];
    if (allowed === null) {
      return events;
    }
    return events.filter((event) => allowed.includes(event.type));
  }, [events, tab]);

  if (!supported) {
    const floor = Platform.OS === 'ios' ? 'iOS 14+' : 'Android 12+ (API 30+)';
    return (
      <View style={[styles.container, styles.center, style]}>
        <Text style={styles.muted}>
          Diagnostics require {floor}. This device is below the supported floor,
          so the module is a no-op here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>MetricKit Diagnostics ({Platform.OS})</Text>

      {tabs ? (
        <View style={styles.tabs}>
          {PLATFORM_TABS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {TAB_LABELS[key]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === 'metrics' ? (
        <MetricsPanel snapshot={metrics} />
      ) : visible.length === 0 ? (
        <View style={[styles.center, styles.grow]}>
          <Text style={styles.muted}>
            No diagnostics yet. Delivery is batched at next app launch — call{' '}
            <Text style={styles.code}>simulate()</Text> to inject a test event.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.grow}>
          {visible.map((event, index) => (
            <View key={`${event.timestamp}-${index}`} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.type}>{event.type}</Text>
                <Text style={styles.muted}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.summary}>{event.summary}</Text>
              <Text style={styles.meta}>
                {event.appVersion} · {Platform.OS} {event.osVersion}
                {event.reasonCode !== undefined
                  ? ` · code ${event.reasonCode}`
                  : ''}
              </Text>
              {event.callStack !== undefined ? (
                <Text style={styles.stack} numberOfLines={6}>
                  {event.callStack}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MetricsPanel({
  snapshot,
}: {
  snapshot: MetricSnapshot | null;
}): React.JSX.Element {
  if (snapshot === null) {
    return (
      <View style={[styles.center, styles.grow]}>
        <Text style={styles.muted}>
          No metrics yet. MetricKit delivers metrics ~daily on a physical device
          (never on the Simulator).
        </Text>
      </View>
    );
  }

  const rows: Array<[string, string]> = [];
  if (snapshot.cpuTimeMs !== undefined) {
    rows.push(['CPU time', `${snapshot.cpuTimeMs.toFixed(0)} ms`]);
  }
  if (snapshot.peakMemoryBytes !== undefined) {
    rows.push(['Peak memory', formatBytes(snapshot.peakMemoryBytes)]);
  }
  if (snapshot.averageSuspendedMemoryBytes !== undefined) {
    rows.push([
      'Suspended memory',
      formatBytes(snapshot.averageSuspendedMemoryBytes),
    ]);
  }
  if (snapshot.averageTimeToFirstDrawMs !== undefined) {
    rows.push([
      'Launch (avg)',
      `${snapshot.averageTimeToFirstDrawMs.toFixed(0)} ms`,
    ]);
  }
  if (snapshot.cellularDownloadBytes !== undefined) {
    rows.push(['Cellular down', formatBytes(snapshot.cellularDownloadBytes)]);
  }
  if (snapshot.wifiDownloadBytes !== undefined) {
    rows.push(['Wi-Fi down', formatBytes(snapshot.wifiDownloadBytes)]);
  }

  return (
    <ScrollView style={styles.grow}>
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.type}>Latest metrics</Text>
          <Text style={styles.muted}>
            {new Date(snapshot.timestamp).toLocaleString()}
          </Text>
        </View>
        {rows.map(([label, value]) => (
          <Text key={label} style={styles.meta}>
            {label}: {value}
          </Text>
        ))}
      </View>

      {snapshot.backgroundExitCounts !== undefined ? (
        <View style={styles.row}>
          <Text style={styles.type}>Background exits by reason</Text>
          {Object.entries(snapshot.backgroundExitCounts).map(
            ([reason, count]) => (
              <Text key={reason} style={styles.meta}>
                {reason}: {count}
              </Text>
            )
          )}
        </View>
      ) : null}

      {snapshot.foregroundExitCounts !== undefined ? (
        <View style={styles.row}>
          <Text style={styles.type}>Foreground exits by reason</Text>
          {Object.entries(snapshot.foregroundExitCounts).map(
            ([reason, count]) => (
              <Text key={reason} style={styles.meta}>
                {reason}: {count}
              </Text>
            )
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatBytes(value: number): string {
  if (value >= 1048576) {
    return `${(value / 1048576).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#111' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  grow: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: '#222',
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#aaa', fontSize: 12 },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  row: {
    backgroundColor: '#1b1b1b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  type: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  summary: { color: '#eee', fontSize: 13, marginBottom: 4 },
  meta: { color: '#888', fontSize: 11 },
  stack: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 6,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  muted: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },
  code: {
    color: '#fbbf24',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});

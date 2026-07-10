import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  onAndroidExitInfo,
  onIOSDiagnostics,
  onIOSMetrics,
  setConsent,
  simulate,
  type DiagnosticEvent,
  type MetricSnapshot,
} from 'react-native-metrickit';
import { DiagnosticsDebugView } from 'react-native-metrickit/debug';

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Grant consent so real drains flow. In a production app, call this only
    // once you have the user's consent — stack traces can contain PII.
    setConsent(true);

    const log = (source: string) => (events: DiagnosticEvent[]) => {
      setCount((prev) => prev + events.length);
      console.log(`[${source}] received`, events.length, 'from', source);
    };

    const unsubIOS = onIOSDiagnostics(log('ios'));
    const unsubAndroid = onAndroidExitInfo(log('android'));
    const unsubMetrics = onIOSMetrics((snapshots: MetricSnapshot[]) => {
      const latest = snapshots[snapshots.length - 1];
      console.log(
        '[ios-metrics] background exits',
        latest?.backgroundExitCounts
      );
    });
    return () => {
      unsubIOS();
      unsubAndroid();
      unsubMetrics();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>react-native-metrickit</Text>
      <Text style={styles.sub}>Diagnostics received this session: {count}</Text>

      <Pressable
        style={styles.button}
        onPress={() => simulate({ type: 'crash', summary: 'Simulated crash' })}
      >
        <Text style={styles.buttonText}>Simulate a diagnostic</Text>
      </Pressable>

      <View style={styles.debug}>
        <DiagnosticsDebugView tabs />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 12,
    backgroundColor: '#000',
  },
  header: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: '#9ca3af', marginTop: 4, marginBottom: 12 },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  debug: { flex: 1 },
});

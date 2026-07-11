import { NativeEventEmitter, Platform } from 'react-native';
import NativeMetrickit from './NativeMetrickit';
import type { DiagnosticListener, Unsubscribe } from './types';
import { addListener, deliver } from './internal/registry';
import { parseDiagnosticBatch } from './internal/parse';
import { noop, safeAsync, safeSync, safeVoid } from './safe';

/**
 * The two normalized data streams. Both deliver an array of `DiagnosticEvent`s
 * and return an unsubscribe fn. Delivery is pull-based (drained at subscribe
 * time — the guaranteed at-next-launch path); on iOS a live MetricKit callback
 * additionally triggers a re-drain. See `ios-diagnostics` / `android-exit-info`.
 */

const IOS_EVENT = 'onMetrickitDiagnostics';

type Removable = { remove: () => void };

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (emitter !== null) {
    return emitter;
  }
  return safeSync(
    'createEmitter',
    () => {
      // The TurboModule implements addListener/removeListeners for this.
      emitter = new NativeEventEmitter(
        NativeMetrickit as unknown as ConstructorParameters<
          typeof NativeEventEmitter
        >[0]
      );
      return emitter;
    },
    null
  );
}

async function drainIOS(): Promise<void> {
  const json = await safeAsync(
    'getIOSDiagnostics',
    () => NativeMetrickit.getIOSDiagnostics(),
    '[]'
  );
  deliver('ios', parseDiagnosticBatch(json, 'ios'));
}

async function drainAndroid(): Promise<void> {
  const json = await safeAsync(
    'getAndroidExitInfo',
    () => NativeMetrickit.getAndroidExitInfo(),
    '[]'
  );
  deliver('android', parseDiagnosticBatch(json, 'android'));
}

export function onIOSDiagnostics(listener: DiagnosticListener): Unsubscribe {
  if (Platform.OS !== 'ios') {
    return noop;
  }

  const removeLocal = addListener('ios', listener);

  let sub: Removable | null = null;
  const active = getEmitter();
  if (active !== null) {
    sub = safeSync<Removable | null>(
      'addIOSListener',
      () =>
        active.addListener(IOS_EVENT, () => {
          drainIOS();
        }),
      null
    );
  }

  // Drain whatever MetricKit already delivered before this subscription.
  drainIOS();

  return () => {
    removeLocal();
    safeVoid('removeIOSListener', () => sub?.remove());
  };
}

export function onAndroidExitInfo(listener: DiagnosticListener): Unsubscribe {
  if (Platform.OS !== 'android') {
    return noop;
  }

  const removeLocal = addListener('android', listener);
  drainAndroid();

  return () => {
    removeLocal();
  };
}

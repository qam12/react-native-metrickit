/**
 * react-native-metrickit
 * iOS TurboModule + RCTEventEmitter bridge.
 *
 * @author Qamber Haider <qamb565@gmail.com>
 * @license MIT
 * @see https://github.com/qam12/react-native-metrickit
 */

#import "Metrickit.h"

// Generated Swift interop header (module name == pod name "Metrickit").
// Framework linkage (`use_frameworks!`) exposes it under the module umbrella;
// static-library linkage (the default) exposes it by name.
#if __has_include(<Metrickit/Metrickit-Swift.h>)
#import <Metrickit/Metrickit-Swift.h>
#else
#import "Metrickit-Swift.h"
#endif

@implementation Metrickit {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    if (@available(iOS 13.0, *)) {
      __weak Metrickit *weakSelf = self;
      MetricKitManager.shared.onDiagnostics = ^{
        [weakSelf emitDiagnosticsAvailable];
      };
      // Register the MetricKit subscriber at launch.
      [MetricKitManager.shared start];
    }
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"onMetrickitDiagnostics" ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)emitDiagnosticsAvailable
{
  // MetricKit callbacks may arrive off the main thread; emit on main and only
  // when JS is listening (avoids RCTEventEmitter "no listeners" warnings).
  __weak Metrickit *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    Metrickit *strongSelf = weakSelf;
    if (strongSelf != nil && strongSelf->_hasListeners) {
      [strongSelf sendEventWithName:@"onMetrickitDiagnostics" body:@{}];
    }
  });
}

- (void)setConsent:(BOOL)consent
{
  if (@available(iOS 13.0, *)) {
    MetricKitManager.shared.consentGranted = consent;
  }
}

- (void)setDiagnosticNotifications:(BOOL)enabled
{
  if (@available(iOS 13.0, *)) {
    MetricKitManager.shared.notificationsEnabled = enabled;
  }
}

- (void)getIOSDiagnostics:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  NSArray *events = @[];
  if (@available(iOS 13.0, *)) {
    events = [MetricKitManager.shared drain] ?: @[];
  }
  resolve([self jsonStringFromEvents:events]);
}

- (void)getAndroidExitInfo:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  // Android-only source; on iOS this is always empty.
  resolve(@"[]");
}

- (void)getIOSMetrics:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  NSArray *metrics = @[];
  if (@available(iOS 13.0, *)) {
    metrics = [MetricKitManager.shared drainMetrics] ?: @[];
  }
  resolve([self jsonStringFromEvents:metrics]);
}

- (NSString *)jsonStringFromEvents:(NSArray *)events
{
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:events options:0 error:&error];
  if (data == nil || error != nil) {
    return @"[]";
  }
  NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  return json ?: @"[]";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeMetrickitSpecJSI>(params);
}

// NOTE: `+moduleName` is synthesized by RCT_EXPORT_MODULE() above (class name
// "Metrickit"), which matches the codegen spec name — do not redeclare it here.

@end

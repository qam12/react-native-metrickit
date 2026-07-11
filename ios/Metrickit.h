/**
 * react-native-metrickit
 * iOS TurboModule surface (delegates to Swift).
 *
 * @author Qamber Haider <qamb565@gmail.com>
 * @license MIT
 * @see https://github.com/qam12/react-native-metrickit
 */

#import <MetrickitSpec/MetrickitSpec.h>
#import <React/RCTEventEmitter.h>

@interface Metrickit : RCTEventEmitter <NativeMetrickitSpec>

@end

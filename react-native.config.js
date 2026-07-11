/**
 * Describes this library to React Native CLI autolinking. Native code lives in
 * the default locations (`android/`, `ios/`), so the platform entries are empty
 * — their presence opts the package into autolinking on both platforms.
 */
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: {},
    },
  },
};

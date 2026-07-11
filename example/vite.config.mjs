import { defineConfig, mergeConfig } from 'vite';

import config from 'react-native-builder-bob/vite-config';
import pack from '../package.json' with { type: 'json' };

export default defineConfig((env) =>
  mergeConfig(config(env), {
    resolve: {
      alias: {
        // The `./debug` subpath must be aliased before the bare package name:
        // the bare alias is a prefix match, so it would rewrite
        // `react-native-metrickit-sdk/debug` to `<root>/debug`, which does not exist.
        [`${pack.name}/debug`]: new URL(
          '../src/debug/index.tsx',
          import.meta.url
        ),
        [pack.name]: new URL('..', import.meta.url),
      },
      conditions: ['react-native-metrickit-source'],
      dedupe: Object.keys(pack.peerDependencies),
    },
  })
);

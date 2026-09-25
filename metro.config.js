const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /desktop-app\/dist-electron\/.*/,
      /desktop-app\/dist\/.*/,
      /desktop-app\/node_modules\/.*/
    ]
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

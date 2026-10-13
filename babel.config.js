module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    // Release bundles (store builds and Stallion OTA) ship no console output at all:
    // logs there are invisible to us but readable on the device, and several printed
    // tokens and personal data. Use Crashlytics for anything needed in production.
    production: {
      plugins: ['transform-remove-console'],
    },
  },
  // Must stay last.
  plugins: ['react-native-reanimated/plugin'],
};

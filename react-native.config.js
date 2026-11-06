module.exports = {
  assets: ['./src/assets/fonts'],
  dependencies: {
    // iOS only: CallKit + PushKit. Android rings with its own call notification
    // (android/.../call/IncomingCallNotification.kt), not ConnectionService.
    'react-native-callkeep': { platforms: { android: null } },
    'react-native-voip-push-notification': { platforms: { android: null } },
  },
};

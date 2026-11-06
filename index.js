/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';

// React Native Firebase logs a deprecation warning on every namespaced call
// (messaging(), crashlytics().log(...)), which flooded the dev logs - the call
// logger alone writes to Crashlytics on every event. The modular API migration is
// still to do before the next RNFirebase major removes the namespaced one.
global.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { handleBackgroundCallPush, handleCallActionTask } from './src/services/call/callPush';
import { name as appName } from './app.json';

// Must be registered outside React, before the app renders: Android delivers
// data messages to a headless task while the app is in the background or killed,
// and without a handler they are dropped with a warning. Notification taps are
// handled in useNotifications once the app is open.
messaging().setBackgroundMessageHandler(async message => {
  // Android: an incoming call while Tooka is backgrounded or killed rings the
  // full-screen call notification (iOS uses VoIP pushes + CallKit instead).
  await handleBackgroundCallPush(message?.data);
});
// Android: Decline on that notification when no JS was running.
AppRegistry.registerHeadlessTask('TookaCallAction', () => handleCallActionTask);

AppRegistry.registerComponent(appName, () => App);

/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered outside React, before the app renders: Android delivers
// data messages to a headless task while the app is in the background or killed,
// and without a handler they are dropped with a warning. Notification taps are
// handled in useNotifications once the app is open.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);

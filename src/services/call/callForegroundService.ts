import { NativeModules, Platform } from 'react-native';

import { callConsole } from './callLogger';

/**
 * Android only: a "microphone" foreground service (android/.../call/) that keeps a
 * connected call audible while Tooka is in the background. iOS needs nothing here;
 * the `audio` background mode in Info.plist covers it.
 */
const native: { start(title: string, text: string): void; stop(): void } | undefined =
  Platform.OS === 'android' ? NativeModules.CallForegroundService : undefined;

let running = false;

export const callForegroundService = {
  start(remoteName?: string) {
    if (!native || running) return;
    running = true;
    try {
      native.start('Tooka call', remoteName ? `On a call with ${remoteName}` : 'Call in progress');
    } catch (error) {
      running = false;
      callConsole.warn('[CallForegroundService] start failed', error);
    }
  },

  stop() {
    if (!native || !running) return;
    running = false;
    try {
      native.stop();
    } catch (error) {
      callConsole.warn('[CallForegroundService] stop failed', error);
    }
  },
};

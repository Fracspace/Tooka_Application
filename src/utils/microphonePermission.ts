/**
 * Microphone permission, usable outside React.
 *
 * PR-7: the permission check lived only in useMicrophonePermission, a hook, so only
 * CallScreen could run it — and CallScreen only runs it when PLACING a call. Answering
 * went straight to joinChannel with no check at all, so a user who had denied the mic
 * joined successfully and was simply inaudible, with nothing on screen to explain it.
 * callManager needs this from plain service code, hence a plain module.
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export type MicPermissionResult = 'granted' | 'denied' | 'blocked';

/**
 * Ask for the microphone, requesting it if necessary.
 *
 * iOS returns 'granted' without checking: there is no permission API available
 * without adding a native dependency, and Agora triggers the system prompt itself on
 * first use. A denial there surfaces at runtime instead — see the
 * LocalAudioStreamReasonDeviceNoPermission handling in CallContext, which covers both
 * platforms and also catches permission revoked mid-call.
 */
export const ensureMicrophonePermission = async (): Promise<MicPermissionResult> => {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  try {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (alreadyGranted) {
      return 'granted';
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'Tooka needs access to your microphone to make calls.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
    // PR-7: 'never_ask_again' was previously indistinguishable from a plain decline,
    // so the user was told permission was required with no way to grant it.
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return 'blocked';
    }
    return 'denied';
  } catch (error) {
    console.warn('[MicPermission] request failed', error);
    return 'denied';
  }
};

/** Explain the problem and offer the only route out of a 'blocked' state. */
export const promptForMicrophoneSettings = (
  message = 'Tooka needs microphone access for calls. Turn it on in Settings to be heard.',
) => {
  Alert.alert('Microphone is off', message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
};

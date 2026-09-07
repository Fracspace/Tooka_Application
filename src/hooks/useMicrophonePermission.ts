import { useState, useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { ensureMicrophonePermission } from '../utils/microphonePermission';

export const useMicrophonePermission = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        setHasPermission(granted);
      } else {
        // iOS permissions typically requested on first use natively by Agora, but you can add react-native-permissions here
        setHasPermission(true);
      }
    };
    
    checkPermission();
  }, []);

  // PR-7: delegates to the shared util so the placing-a-call path and the answering
  // path (callManager, which cannot use hooks) run exactly the same logic.
  const requestPermission = async () => {
    const result = await ensureMicrophonePermission();
    const granted = result === 'granted';
    setHasPermission(granted);
    return granted;
  };

  return { hasPermission, requestPermission };
};

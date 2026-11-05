import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { TERMINAL_CALL_STATES, isPlaceholderPartyName } from '../types/call';
import { useCallContext } from '../context/CallContext';
import { callManager } from '../services/call/callManager';

/**
 * The ringing screen: accept, reject, or cancel while connecting. It closes
 * itself once the call ends. The old layout and the v4 layout both read from
 * here.
 */
export function useIncomingCallScreen() {
  const { session, callState } = useCallContext();
  const navigation = useNavigation();

  // Only go back if the call reached a terminal state while this screen is active.
  // PR-4: MISSED and NO_ANSWER added - MISSED is now reachable via the ring timeout,
  // and without it this screen would stay up after the ringtone stopped.
  useEffect(() => {
    if (TERMINAL_CALL_STATES.has(callState)) {
      if (navigation.isFocused() && navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [callState, navigation]);

  // PR-4: block the Android hardware back button. Backing out used to dismiss this
  // screen while the ringtone kept looping and the state stayed INCOMING - leaving no
  // way to answer or reject, and no UI to get back to.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  // True from the Accept tap until the call connects or fails. Accepting can take
  // a while (mic prompt, server accept, Agora join), and the buttons used to stay
  // live with Reject silently doing nothing.
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await callManager.acceptCall();
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    await callManager.rejectCall();
  };

  const handleCancelAccept = () => {
    callManager.cancelAccept();
  };

  // Until the spa lookup resolves, the backend only sends a role ("Spa Owner").
  const rawCallerName = session?.caller?.name;
  const callerName =
    rawCallerName && !isPlaceholderPartyName(rawCallerName) ? rawCallerName : 'Your spa';

  return {
    session,
    callState,
    accepting,
    callerName,
    handleAccept,
    handleReject,
    handleCancelAccept,
  };
}

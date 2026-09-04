/**
 * ActiveCallBar
 *
 * PR-5: a call kept running after the user tapped the chevron to minimise the call
 * screen, and there was no way back to it — the screen had been popped and nothing
 * else referenced the live call. This is that way back.
 *
 * Rendered globally (App.tsx, inside CallProvider and above the navigator) so it can
 * overlay any screen. It deliberately does NOT use navigation hooks: it sits outside
 * NavigationContainer, so it tracks the active route through navigationRef instead.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCallContext } from '../../../context/CallContext';
import { useCallTimer } from '../../../hooks/useCallTimer';
import { CallState } from '../../../types/call';
import { navigationRef } from '../../../navigation/NavigationService';

/** Routes that already show the call, so the bar would be redundant. */
const CALL_ROUTES = ['CallScreen', 'IncomingCall'];

const LIVE_CALL_STATES: CallState[] = [
  CallState.OUTGOING,
  CallState.RINGING,
  CallState.CONNECTING,
  CallState.CONNECTED,
  CallState.RECONNECTING,
];

export const ActiveCallBar: React.FC = () => {
  const { callState, session, duration } = useCallContext();
  const insets = useSafeAreaInsets();
  const timer = useCallTimer(duration);
  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  const isLiveCall = LIVE_CALL_STATES.includes(callState);

  // Track the active route. Re-registered whenever the call state changes, which
  // also covers navigationRef not being ready on the very first mount.
  useEffect(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    const update = () => setRouteName(navigationRef.getCurrentRoute()?.name);
    update();
    const unsubscribe = navigationRef.addListener('state', update);
    return unsubscribe;
  }, [callState]);

  if (!isLiveCall) {
    return null;
  }
  if (routeName && CALL_ROUTES.includes(routeName)) {
    return null;
  }

  const isIncomingCall = session?.direction === 'inbound';
  const remoteParty = isIncomingCall ? session?.caller : session?.receiver;
  const remoteName = remoteParty?.name;
  const displayName =
    !remoteName || remoteName === 'Me' || remoteName === 'Spa'
      ? 'Ongoing call'
      : remoteName;

  const status =
    callState === CallState.CONNECTED
      ? timer
      : callState === CallState.RECONNECTING
      ? 'Reconnecting…'
      : callState === CallState.CONNECTING
      ? 'Connecting…'
      : 'Calling…';

  const handleReturn = () => {
    if (!navigationRef.isReady()) {
      return;
    }
    // CallScreen only starts a new call when callState is IDLE, so returning to a
    // live call cannot re-initiate one.
    navigationRef.navigate('CallScreen', {
      bookingId: session?.bookingId ?? '',
      spaId: session?.spaId ?? '',
      callType: session?.callType || 'voice',
      spaName: displayName,
      spaAvatar: remoteParty?.avatarUrl || '',
      isIncoming: isIncomingCall,
    });
  };

  return (
    <Pressable
      onPress={handleReturn}
      accessibilityRole="button"
      accessibilityLabel={`Return to call with ${displayName}`}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.row}>
        <Ionicons name="call" size={16} color="#FFF" />
        <Text style={styles.label} numberOfLines={1}>
          {displayName} · {status}
        </Text>
        <Text style={styles.action}>Tap to return</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#34C759',
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 999,
    elevation: 999,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  action: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
});

export default ActiveCallBar;

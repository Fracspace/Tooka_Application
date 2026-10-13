/**
 * ActiveCallBar
 *
 * PR-5: a call kept running after the user tapped the chevron to minimise the call
 * screen, and there was no way back to it — the screen had been popped and nothing
 * else referenced the live call. This is that way back.
 *
 * Rendered globally (App.tsx, inside CallProvider) WRAPPING the navigator. It used to
 * be absolutely positioned on top of every screen, which hid each screen's header and
 * back button for the whole call. It now sits in the layout above the navigator and
 * pushes the app down, like the iOS in-call bar: native SafeAreaViews below it stop
 * adding top padding on their own, and useSafeAreaInsets() consumers get top: 0 from
 * the overridden context.
 *
 * It deliberately does NOT use navigation hooks: it sits outside NavigationContainer,
 * so it tracks the active route through navigationRef instead.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCallContext } from '../../../context/CallContext';
import { useCallTimer } from '../../../hooks/useCallTimer';
import { CallState, isPlaceholderPartyName } from '../../../types/call';
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

export const ActiveCallBar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const isVisible = isLiveCall && !(routeName && CALL_ROUTES.includes(routeName));
  const childInsets = useMemo(
    () => (isVisible ? { ...insets, top: 0 } : insets),
    [isVisible, insets],
  );

  const isIncomingCall = session?.direction === 'inbound';
  const remoteParty = isIncomingCall ? session?.caller : session?.receiver;
  const remoteName = isPlaceholderPartyName(remoteParty?.name) ? '' : remoteParty?.name ?? '';
  const displayName = remoteName || 'Ongoing call';

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
      spaName: remoteName,
      spaAvatar: remoteParty?.avatarUrl || '',
      isIncoming: isIncomingCall,
    });
  };

  // Keep this tree shape fixed whether or not the bar shows, so toggling it never
  // remounts the navigator underneath.
  return (
    <View style={styles.root}>
      {isVisible ? (
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
      ) : null}
      <SafeAreaInsetsContext.Provider value={childInsets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    backgroundColor: '#34C759',
    paddingBottom: 10,
    paddingHorizontal: 16,
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

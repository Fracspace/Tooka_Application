import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallContext } from '../../context/CallContext';
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission';
import { CallState } from '../../types/call';

import { BackgroundOverlay } from './components/BackgroundOverlay';
import { CallHeader } from './components/CallHeader';
import { CallAvatar } from './components/CallAvatar';
import { CallStatus } from './components/CallStatus';
import { CallControls } from './components/CallControls';
import { IncomingActions } from './components/IncomingActions';
import { CallFooter } from './components/CallFooter';
import { CallInspectorOverlay } from './components/CallInspectorOverlay';
import { ENABLE_CALL_DIAGNOSTICS } from '../../services/call/callLogger';

export default function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Extract request params if starting a new call
  const { bookingId, spaId, callType, spaName, spaAvatar, isIncoming } = (route.params as any) || {};

  const {
    callState,
    session,
    isMuted,
    isSpeaker,
    duration,
    initiateCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    errorMessage,
  } = useCallContext();

  const { requestPermission } = useMicrophonePermission();

  const initRef = useRef(false);

  // Initialize call if params exist and state is IDLE
  useEffect(() => {
    const start = async () => {
      if (initRef.current) return;
      initRef.current = true;

      const hasPerm = await requestPermission();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Microphone permission is required for calls.');
        navigation.goBack();
        return;
      }
      if (callState === CallState.IDLE && bookingId && spaId && !isIncoming) {
        // PR-4: pass the spa's display details through - the /request response has no
        // spa profile, so without these the session receiver is the literal 'Spa'.
        await initiateCall({
          bookingId,
          spaId,
          callType: callType || 'voice',
          spaName,
          spaAvatarUrl: spaAvatar,
        });
      }
    };
    start();
  }, [callState, bookingId, spaId, callType, spaName, spaAvatar, isIncoming, initiateCall, requestPermission, navigation]);

  // PR-4: close once the call is over.
  // The old guard was `callState === IDLE && !bookingId && !isIncoming`, but bookingId
  // is always truthy for calls started from BookingCard - so it never fired and the
  // user was left staring at a black screen with no controls (CallControls and
  // CallFooter both render null for IDLE) until they found the chevron.
  const hasBeenActiveRef = useRef(false);
  useEffect(() => {
    if (callState !== CallState.IDLE) {
      hasBeenActiveRef.current = true;
      return;
    }
    // Still IDLE and a call is about to start: wait for it.
    if (!hasBeenActiveRef.current && (bookingId || isIncoming)) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [callState, bookingId, isIncoming, navigation]);

  // PR-4: swallow the Android hardware back button while a call is on screen.
  // Back used to pop the screen and leave the call running with no way back to it.
  // The chevron (handleMinimize) is still the deliberate way out.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  const handleMinimize = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleRetry = () => {
    if (bookingId && spaId) initiateCall({ bookingId, spaId, callType: callType || 'voice' });
  };

  const handleMessage = () => {
    // Navigate to chat or open modal
    handleMinimize();
  };

  // PR-4: show the OTHER party. On an incoming call the remote party is the caller;
  // session.receiver is us and its name is the literal 'Me', which this used to
  // display. 'Me'/'Spa' are placeholders the services fall back to - never show them.
  // PR-5: prefer the session's own (app-centric) direction over the route param, so
  // this is right however the screen was reached - including via ActiveCallBar.
  const isIncomingCall = session ? session.direction === 'inbound' : !!isIncoming;
  const remoteParty = isIncomingCall ? session?.caller : session?.receiver;
  const remoteName = remoteParty?.name;
  const isPlaceholderName = !remoteName || remoteName === 'Me' || remoteName === 'Spa';
  const displayName = (isPlaceholderName ? spaName : remoteName) || spaName || 'Unknown User';
  const displayAvatar = remoteParty?.avatarUrl || spaAvatar;

  return (
    <View style={styles.container}>
      <BackgroundOverlay avatarUrl={displayAvatar} />
      
      <CallHeader onMinimize={handleMinimize} />

      <View style={styles.content}>
        <View style={styles.spacer} />
        
        <CallAvatar name={displayName} avatarUrl={displayAvatar} state={callState} />
        <Text style={styles.nameLabel}>{displayName}</Text>
        <CallStatus state={callState} duration={duration} />
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        
        <View style={styles.spacer} />
      </View>

      <View style={styles.bottomContainer}>
        {callState === CallState.INCOMING ? (
          <IncomingActions onAccept={acceptIncomingCall} onDecline={declineIncomingCall} />
        ) : (
          <>
            <CallControls
              state={callState}
              isMuted={isMuted}
              isSpeaker={isSpeaker}
              onMuteToggle={toggleMute}
              onSpeakerToggle={toggleSpeaker}
              onEndCall={endCall}
              onCancelCall={endCall}
            />
            <CallFooter
              state={callState}
              onRetry={handleRetry}
              onMessage={handleMessage}
              onClose={handleMinimize}
            />
          </>
        )}
      </View>
      {callState === CallState.RECONNECTING && (
        <View style={styles.reconnectOverlay}>
          <Text style={styles.reconnectTitle}>Connection lost.</Text>
          <Text style={styles.reconnectSubtitle}>Trying to reconnect...</Text>
        </View>
      )}
      {ENABLE_CALL_DIAGNOSTICS && (
        <CallInspectorOverlay sessionId={session?.sessionId} callState={callState} />
      )}
    </View>
  );
}

import { Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  nameLabel: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 30,
    marginBottom: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomContainer: {
    width: '100%',
    paddingBottom: 20,
    alignItems: 'center',
  },
  reconnectOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  reconnectTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  reconnectSubtitle: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
});

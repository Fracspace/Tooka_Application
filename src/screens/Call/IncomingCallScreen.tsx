import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, SafeAreaView, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CallState } from '../../types/call';
import { useCallContext } from '../../context/CallContext';
import { callManager } from '../../services/call/callManager';
import { CallInspectorOverlay } from './components/CallInspectorOverlay';
import { ENABLE_CALL_DIAGNOSTICS } from '../../services/call/callLogger';

const IncomingCallScreen: React.FC = () => {
  const { session, callState } = useCallContext();
  const navigation = useNavigation();

  // Pulse animation for the caller avatar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Only go back if the call reached a terminal state while this screen is active.
  // PR-4: MISSED and NO_ANSWER added - MISSED is now reachable via the ring timeout,
  // and without it this screen would stay up after the ringtone stopped.
  useEffect(() => {
    if (
      callState === CallState.ENDED ||
      callState === CallState.REJECTED ||
      callState === CallState.FAILED ||
      callState === CallState.MISSED ||
      callState === CallState.NO_ANSWER
    ) {
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

  const handleAccept = async () => {
    await callManager.acceptCall();
  };

  const handleReject = async () => {
    await callManager.rejectCall();
  };

  // Safe fallback if session is somehow missing
  const callerName = session?.caller?.name || 'Unknown Caller';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Incoming Voice Call</Text>

        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.callerName}>{callerName}</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={handleReject}>
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={handleAccept}>
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
      </View>
      {ENABLE_CALL_DIAGNOSTICS && (
        <CallInspectorOverlay sessionId={session?.sessionId} callState={callState} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    color: '#A0A0A0',
    marginBottom: 60,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarText: {
    fontSize: 40,
    color: '#FFF',
    fontWeight: 'bold',
  },
  callerName: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  button: {
    width: 120,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default IncomingCallScreen;

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, SafeAreaView } from 'react-native';
import { CallInspectorOverlay } from './components/CallInspectorOverlay';
import { ENABLE_CALL_DIAGNOSTICS } from '../../services/call/callLogger';
import IncomingCallV4 from './v4/IncomingCallV4';
import { isV4 } from '../../config/uiFlags';
import { useIncomingCallScreen } from '../../hooks/useIncomingCallScreen';

const IncomingCallScreen: React.FC = () => {
  const screen = useIncomingCallScreen();
  if (isV4('incomingCall')) {
    return <IncomingCallV4 {...screen} />;
  }
  return <IncomingCallLegacy screen={screen} />;
};

function IncomingCallLegacy({ screen }: { screen: ReturnType<typeof useIncomingCallScreen> }): React.ReactElement {
  const { session, callState, accepting, callerName, handleAccept, handleReject, handleCancelAccept } = screen;
  // Pulse animation for the caller avatar
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start pulsing animation; stopped on unmount so the loop does not outlive the screen.
    const pulse = Animated.loop(
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
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

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
        {accepting ? <Text style={styles.connectingText}>Connecting…</Text> : null}
      </View>

      <View style={styles.actionContainer}>
        {accepting ? (
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleCancelAccept}
            accessibilityLabel="Cancel connecting call"
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={handleReject}>
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={handleAccept}>
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      {ENABLE_CALL_DIAGNOSTICS && (
        <CallInspectorOverlay sessionId={session?.sessionId} callState={callState} />
      )}
    </SafeAreaView>
  );
}

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
  connectingText: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
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

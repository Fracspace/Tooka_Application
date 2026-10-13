import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { CallState } from '../../../types/call';

interface CallControlsProps {
  state: CallState;
  isMuted: boolean;
  isSpeaker: boolean;
  onMuteToggle: () => void;
  onSpeakerToggle: () => void;
  onEndCall: () => void;
  onCancelCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = React.memo(({
  state,
  isMuted,
  isSpeaker,
  onMuteToggle,
  onSpeakerToggle,
  onEndCall,
  onCancelCall,
}) => {
  if (state === CallState.OUTGOING || state === CallState.RINGING || state === CallState.CONNECTING) {
    return (
      <View style={styles.containerSingle}>
        <ControlButton
          icon="close"
          color="#FF3B30"
          backgroundColor="rgba(255, 59, 48, 0.2)"
          onPress={onCancelCall}
        />
      </View>
    );
  }

  if (state === CallState.CONNECTED || state === CallState.RECONNECTING) {
    const isReconnecting = state === CallState.RECONNECTING;

    return (
      <View style={styles.containerRow}>
        <ControlButton
          icon={isMuted ? 'mic-off' : 'mic'}
          color={isMuted ? '#000' : '#FFF'}
          backgroundColor={isMuted ? '#FFF' : 'rgba(255, 255, 255, 0.2)'}
          onPress={onMuteToggle}
          disabled={isReconnecting}
        />
        
        <ControlButton
          icon="call"
          color="#FFF"
          backgroundColor="#FF3B30"
          size={72}
          iconSize={32}
          onPress={onEndCall}
        />

        <ControlButton
          icon={isSpeaker ? 'volume-high' : 'volume-medium'}
          color={isSpeaker ? '#000' : '#FFF'}
          backgroundColor={isSpeaker ? '#FFF' : 'rgba(255, 255, 255, 0.2)'}
          onPress={onSpeakerToggle}
          disabled={isReconnecting}
        />
      </View>
    );
  }

  return null;
});

interface ControlButtonProps {
  icon: string;
  color: string;
  backgroundColor: string;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  onPress: () => void;
}

const ControlButton: React.FC<ControlButtonProps> = ({
  icon,
  color,
  backgroundColor,
  size = 60,
  iconSize = 28,
  disabled = false,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  containerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  containerSingle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 40,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

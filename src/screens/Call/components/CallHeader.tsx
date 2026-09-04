import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CallHeaderProps {
  onMinimize?: () => void;
  title?: string;
}

// PR-6: the default title was 'End-to-end Encrypted'. Agora media is encrypted in
// transit but is NOT end-to-end encrypted unless enableEncryption() is configured with
// our own key, which it is not - so that was a false security claim shown on every
// call. This says something that is actually true, and is the real product promise:
// calls are routed through Agora precisely so phone numbers are never exchanged.
export const CallHeader: React.FC<CallHeaderProps> = React.memo(({ onMinimize, title = 'Number stays private' }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {onMinimize ? (
        <Pressable onPress={onMinimize} style={styles.iconButton}>
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
      
      <View style={styles.titleContainer}>
        <Ionicons name="lock-closed" size={12} color="#A0A0A0" />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.placeholder} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    width: '100%',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  placeholder: {
    width: 44,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  title: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '500',
  },
});

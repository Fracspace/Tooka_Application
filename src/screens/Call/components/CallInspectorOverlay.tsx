import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { callLogger, ENABLE_CALL_DIAGNOSTICS, AudioStateSnapshot } from '../../../services/call/callLogger';

const { height: screenHeight } = Dimensions.get('window');

interface CallInspectorOverlayProps {
  sessionId?: string;
  callState: string;
}

// The flag check lives in a wrapper so the panel's hooks always run in the same
// order (they used to sit below an early return).
export const CallInspectorOverlay: React.FC<CallInspectorOverlayProps> = (props) =>
  ENABLE_CALL_DIAGNOSTICS ? <CallInspectorPanel {...props} /> : null;

const CallInspectorPanel: React.FC<CallInspectorOverlayProps> = ({
  sessionId,
  callState,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [audioState, setAudioState] = useState<AudioStateSnapshot>(
    callLogger.getAudioSnapshot(sessionId)
  );

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Set initial logs
    if (sessionId) {
      setLogs(callLogger.getTimeline(sessionId));
    }

    const logListener = (newLog: string) => {
      setLogs((prev) => [...prev, newLog]);
    };

    const audioListener = (snapshot: AudioStateSnapshot) => {
      setAudioState(snapshot);
    };

    callLogger.registerLogCallback(logListener);
    callLogger.registerAudioCallback(audioListener);

    return () => {
      callLogger.unregisterLogCallback(logListener);
      callLogger.unregisterAudioCallback(audioListener);
    };
  }, [sessionId]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      {!isOpen ? (
        <TouchableOpacity style={styles.toggleButton} onPress={toggleOpen}>
          <Text style={styles.toggleText}>🔍 Inspect</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.overlayContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tooka Call Inspector</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={clearLogs}>
                <Text style={styles.actionBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={toggleOpen}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statusPanel}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>State:</Text>
              <Text style={styles.value}>{callState}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Session:</Text>
              <Text style={styles.value} numberOfLines={1}>
                {sessionId || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.audioPanel}>
            <Text style={styles.panelTitle}>Audio / Agora Snapshot</Text>
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Mic Muted</Text>
                <Text style={styles.gridValue}>{audioState.micMuted ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Speaker</Text>
                <Text style={styles.gridValue}>{audioState.speakerEnabled ? 'On' : 'Off'}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Route</Text>
                <Text style={styles.gridValue}>{audioState.audioRoute}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Remote Join</Text>
                <Text style={styles.gridValue}>{audioState.remoteJoined ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Pub State</Text>
                <Text style={styles.gridValue}>{audioState.publishState}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Sub State</Text>
                <Text style={styles.gridValue}>{audioState.subscribeState}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Local Audio</Text>
                <Text style={styles.gridValue}>{audioState.localAudioState}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Remote Audio</Text>
                <Text style={styles.gridValue}>{audioState.remoteAudioState}</Text>
              </View>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.logContainer}
            contentContainerStyle={styles.logContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {logs.map((log, idx) => {
              let color = '#E0E0E0';
              if (log.includes('[ERROR]')) color = '#FF8A80';
              else if (log.includes('[WARN]')) color = '#FFD54F';
              else if (log.includes('[AGORA]')) color = '#80D8FF';
              else if (log.includes('[SOCKET]')) color = '#B9F6CA';
              else if (log.includes('[REST]')) color = '#EA80FC';

              return (
                <Text key={idx} style={[styles.logText, { color }]}>
                  {log}
                </Text>
              );
            })}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  toggleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.7,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    marginRight: 12,
    backgroundColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  actionBtnText: {
    color: '#E0E0E0',
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusPanel: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 10,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderColor: '#222',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginRight: 4,
  },
  value: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  audioPanel: {
    backgroundColor: '#151515',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#222',
  },
  panelTitle: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '24%',
    backgroundColor: '#202020',
    padding: 4,
    borderRadius: 4,
    marginBottom: 4,
    alignItems: 'center',
  },
  gridLabel: {
    color: '#666',
    fontSize: 8,
    textAlign: 'center',
  },
  gridValue: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 2,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    padding: 8,
  },
  logContent: {
    paddingBottom: 20,
  },
  logText: {
    fontFamily: 'Courier',
    fontSize: 9,
    lineHeight: 12,
    marginBottom: 4,
  },
});

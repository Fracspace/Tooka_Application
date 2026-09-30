import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BookingSummarySheetProps = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  spaName?: string;
  spaImage?: string;
  location?: string;
  dateLabel: string;
  timeLabel: string;
  serviceName?: string;
  serviceDurationMinutes?: number;
  bookingFee: number;
  bookingFeeNote?: string;
};

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        <Ionicons name={icon} size={16} color="#FFAA26" />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function BookingSummarySheet({
  visible,
  loading = false,
  onClose,
  onConfirm,
  spaName,
  spaImage,
  location,
  dateLabel,
  timeLabel,
  serviceName,
  serviceDurationMinutes,
  bookingFee,
  bookingFeeNote,
}: BookingSummarySheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (!visible) {
      translateY.setValue(400);
      return;
    }
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [visible, translateY]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const serviceValue =
    serviceName && serviceDurationMinutes
      ? `${serviceName} • ${serviceDurationMinutes} min`
      : serviceName;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Booking Summary</Text>

          <View style={styles.spaRow}>
            {spaImage ? (
              <Image source={{ uri: spaImage }} style={styles.spaImage} resizeMode="cover" />
            ) : null}
            <View style={styles.spaCopy}>
              <Text style={styles.spaName} numberOfLines={2}>
                {spaName ?? 'Spa'}
              </Text>
              {location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color="#6C6258" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <SummaryRow icon="calendar-outline" label="Date" value={dateLabel} />
          <SummaryRow icon="time-outline" label="Time" value={timeLabel} />
          {serviceValue ? (
            <SummaryRow icon="sparkles-outline" label="Service" value={serviceValue} />
          ) : null}

          <View style={styles.divider} />

          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Booking fee</Text>
            <Text style={styles.feeValue}>₹{bookingFee}</Text>
          </View>
          {bookingFeeNote ? <Text style={styles.feeNote}>{bookingFeeNote}</Text> : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleClose}
              disabled={loading}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
            >
              <Text style={styles.secondaryBtnText}>Change</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Continue to Payment</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 23, 20, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4DCD2',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 20,
    color: '#1F1D1B',
    marginBottom: 16,
  },
  spaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spaImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F2ECE4',
  },
  spaCopy: {
    flex: 1,
  },
  spaName: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    color: '#2D2B28',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    flex: 1,
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    color: '#6C6258',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0E9E0',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontFamily: 'WorkSans-Medium',
    fontSize: 14,
    color: '#6C6258',
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'Sora-SemiBold',
    fontSize: 14,
    color: '#2D2B28',
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeLabel: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#2D2B28',
  },
  feeValue: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 18,
    color: '#FFAA26',
  },
  feeNote: {
    marginTop: 4,
    fontFamily: 'WorkSans-Regular',
    fontSize: 12,
    color: '#9A9084',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFAA26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#FFAA26',
  },
  primaryBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFAA26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default BookingSummarySheet;

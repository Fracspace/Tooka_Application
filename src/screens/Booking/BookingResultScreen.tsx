import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useBookingResultScreen, type ResultType } from '../../hooks/useBookingResultScreen';
import { isV4 } from '../../config/uiFlags';
import BookingResultV4 from './v4/BookingResultV4';

const COLORS = {
  background: '#FFF8F0',
  card: '#FFFFFF',
  primary: '#FFAF2E',
  primarySoft: '#FFF0D6',
  text: '#242424',
  muted: '#9A9A9A',
  border: '#FFD08A',
  divider: '#F3DDBB',
  danger: '#D94A45',
};

const FONTS = {
  heading: 'Sora-SemiBold',
  body: 'WorkSans-Regular',
  button: 'WorkSans-SemiBold',
};

const FALLBACK_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=70',
};

const STATE_COPY: Record<
  ResultType,
  {
    icon: string;
    title: string;
    subtitle: string;
    primaryLabel: string;
    secondaryLabel: string;
    color: string;
  }
> = {
  success: {
    icon: 'checkmark',
    title: 'Booking Confirmed!',
    subtitle: 'Your wellness session is all set.',
    primaryLabel: 'View My Bookings',
    secondaryLabel: 'Back To Home',
    color: COLORS.primary,
  },
  failure: {
    icon: 'close',
    title: 'Payment Failed',
    subtitle: "Your payment couldn't be completed.",
    primaryLabel: 'Retry Payment',
    secondaryLabel: 'Back To Home',
    color: COLORS.danger,
  },
  cancelled: {
    icon: 'alert',
    title: 'Payment Cancelled',
    subtitle: 'Your booking has not been confirmed.',
    primaryLabel: 'Retry Payment',
    secondaryLabel: 'Back',
    color: COLORS.primary,
  },
  processing: {
    icon: 'sync',
    title: 'Payment Processing',
    subtitle: 'Payment is still processing.',
    primaryLabel: 'View My Bookings',
    secondaryLabel: 'Back To Home',
    color: COLORS.primary,
  },
  timeout: {
    icon: 'sync',
    title: 'Payment Processing',
    subtitle: 'Payment is still processing.',
    primaryLabel: 'View My Bookings',
    secondaryLabel: 'Back To Home',
    color: COLORS.primary,
  },
  refunded: {
    icon: 'refresh',
    title: 'Payment Refunded',
    subtitle: 'Your payment was refunded.',
    primaryLabel: 'Retry Payment',
    secondaryLabel: 'Back To Home',
    color: COLORS.danger,
  },
};

function BookingResultScreenOld(): React.ReactElement {
  const {
    params,
    type,
    isProcessing,
    message,
    retrying,
    bookingCode,
    dateTime,
    paymentCompletedAt,
    showPaymentDetails,
    handleCopy,
    handlePrimary,
    handleSecondary,
  } = useBookingResultScreen();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const iconScale = useRef(new Animated.Value(0.9)).current;
  const contentTranslate = useRef(new Animated.Value(18)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const state = STATE_COPY[type];
  const maxWidth = Math.min(width - 40, 430);
  const topPadding = Math.max(insets.top + 20, height < 720 ? 20 : 40);

  const spinStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: spin.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [spin],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslate, iconScale]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [spin]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
        translucent={false}
      />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topPadding,
            paddingBottom: Math.max(insets.bottom + 30, 42),
          },
        ]}
      >
        <View style={[styles.inner, { maxWidth }]}>
          <Animated.View
            style={[styles.iconCircle, { transform: [{ scale: iconScale }] }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={state.title}
          >
            <Animated.View style={isProcessing ? spinStyle : undefined}>
              <Ionicons name={state.icon} size={50} color={state.color} />
            </Animated.View>
          </Animated.View>

          <Text style={styles.title}>{state.title}</Text>
          <Text style={styles.subtitle}>
            {message ?? state.subtitle}
          </Text>

          <Animated.View
            style={[
              styles.animatedContent,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslate }],
              },
            ]}
          >
            <View style={styles.bookingIdCard}>
              <View style={styles.bookingIdCopy}>
                <Text style={styles.cardLabel}>Booking ID</Text>
                <Text style={styles.bookingIdText}>{bookingCode ?? '--'}</Text>
              </View>
              {bookingCode ? (
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.copyButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy booking ID"
                >
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.spaRow}>
                <Image
                  source={
                    params?.spaImage
                      ? { uri: params.spaImage }
                      : FALLBACK_IMAGE
                  }
                  style={styles.spaImage}
                  resizeMode="cover"
                  accessibilityLabel="Spa image"
                />
                <View style={styles.spaCopy}>
                  <Text style={styles.spaName} numberOfLines={2}>
                    {params?.spaName ?? '--'}
                  </Text>
                  <Text style={styles.location} numberOfLines={1}>
                    {params?.location ?? '--'}
                  </Text>
                </View>
              </View>

              {/* <View style={styles.divider} /> */}

              {/* <Text style={styles.cardLabel}>Service</Text>
              <Text style={styles.detailValue}>{serviceText}</Text> */}

              <View style={styles.divider} />

              <Text style={styles.cardLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{dateTime}</Text>
            </View>

            {showPaymentDetails ? (
              <View style={styles.paymentDetailsCard}>
                <Text style={styles.sectionTitle}>Payment Details</Text>
                <View style={styles.divider} />
                <Text style={styles.cardLabel}>Payment Date & Time</Text>
                <Text style={styles.detailValue}>{paymentCompletedAt}</Text>
              </View>
            ) : null}

            {/* <Text style={styles.infoText}>
              We've sent the booking details to your email & phone.
            </Text> */}

            <Pressable
              disabled={retrying}
              onPress={handlePrimary}
              style={({ pressed }) => [
                styles.primaryButton,
                retrying && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={state.primaryLabel}
            >
              <Text style={styles.primaryText}>
                {retrying
                  ? 'Retrying'
                  : state.primaryLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSecondary}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={state.secondaryLabel}
            >
              <Text style={styles.secondaryText}>{state.secondaryLabel}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  inner: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 66,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  loader: {
    marginTop: -38,
    marginBottom: 20,
  },
  animatedContent: {
    width: '100%',
    alignItems: 'center',
  },
  bookingIdCard: {
    width: '100%',
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingLeft: 26,
    paddingRight: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bookingIdCopy: {
    flex: 1,
    paddingRight: 16,
  },
  cardLabel: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 8,
  },
  bookingIdText: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.text,
  },
  copyButton: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  copyText: {
    fontFamily: FONTS.button,
    fontSize: 16,
    color: COLORS.primary,
  },
  detailsCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  paymentDetailsCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.heading,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
  },
  spaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  spaImage: {
    width: 92,
    height: 62,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
  },
  spaCopy: {
    flex: 1,
    marginLeft: 20,
  },
  spaName: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 5,
  },
  location: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  divider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginBottom: 12,
  },
  detailValue: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 0,
  },
  infoText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  secondaryButton: {
    width: '100%',
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: FONTS.button,
    fontSize: 16,
    color: COLORS.card,
  },
  secondaryText: {
    fontFamily: FONTS.button,
    fontSize: 16,
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

function BookingResultScreenV4(): React.ReactElement {
  return <BookingResultV4 {...useBookingResultScreen()} />;
}

// Old and v4 layouts share useBookingResultScreen, so they behave the same.
function BookingResultScreen(): React.ReactElement {
  return isV4('booked') ? <BookingResultScreenV4 /> : <BookingResultScreenOld />;
}

export default BookingResultScreen;

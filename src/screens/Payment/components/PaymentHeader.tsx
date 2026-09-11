import React, { useCallback, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
  title?: string;
  onBack: () => void;
};

const HEADER_GRADIENT = {
  start: '#FFB02E',
  end: '#ffaf2e4c',
};

const HERO_ILLUSTRATION = {
  uri: 'https://d2f15ematxpwp4.cloudfront.net/appImages/bg.png',
};

export const PaymentHeader: React.FC<Props> = ({ title = 'Payment History', onBack }) => {
  const insets = useSafeAreaInsets();
  const [headerSize, setHeaderSize] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHeaderSize({ width, height });
  }, []);

  const paddingTop = insets.top + (Platform.OS === 'android' ? 12 : 8);

  return (
    <View
      style={[styles.header, { paddingTop }]}
      onLayout={handleLayout}
      accessibilityRole="header"
    >
      <StatusBar barStyle="light-content" backgroundColor={HEADER_GRADIENT.start} />

      {headerSize.width > 0 && headerSize.height > 0 ? (
        <Svg
          width={headerSize.width}
          height={headerSize.height}
          style={styles.headerGradient}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="paymentHeaderGrad" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={HEADER_GRADIENT.start} />
              <Stop offset="1" stopColor={HEADER_GRADIENT.end} />
            </LinearGradient>
          </Defs>
          <Rect
            width={headerSize.width}
            height={headerSize.height}
            fill="url(#paymentHeaderGrad)"
          />
        </Svg>
      ) : null}

      {/* Decorative ambient bubbles */}
      <View style={styles.bubbleLarge} pointerEvents="none" />
      <View style={styles.bubbleTopCenter} pointerEvents="none" />
      <View style={styles.bubbleDarkAmber} pointerEvents="none" />
      <View style={styles.bubbleSmallRight} pointerEvents="none" />

      {/* Top row with Back Button */}
      <View style={styles.backRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={10}
        >
          <Icon name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Hero content: text on left, illustration image on right */}
      <View style={styles.heroContentRow}>
        <View style={styles.textContainer}>
          <Text style={styles.eyebrow} allowFontScaling maxFontSizeMultiplier={1.2}>
            YOUR TRANSACTIONS
          </Text>
          <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.subtitle} allowFontScaling maxFontSizeMultiplier={1.3}>
            {'Track all your bookings and payments\nin one place.'}
          </Text>
        </View>

        <Image
          source={HERO_ILLUSTRATION}
          style={styles.heroImage}
          resizeMode="contain"
          accessible
          accessibilityLabel="Payment history illustration"
        />
      </View>
    </View>
  );
};

export default React.memo(PaymentHeader);

const styles = StyleSheet.create({
  header: {
    backgroundColor: HEADER_GRADIENT.start,
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 48, // Generous padding so rounded content card overlaps smoothly
  },
  headerGradient: {
    ...StyleSheet.absoluteFill,
  },

  // Decorative circles matching Figma screenshot
  bubbleLarge: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    right: -40,
    top: -80,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  bubbleTopCenter: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    left: '36%',
    top: 42,
    backgroundColor: 'rgba(235, 140, 0, 0.22)',
  },
  bubbleDarkAmber: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    right: 140,
    top: 105,
    backgroundColor: 'rgba(175, 90, 10, 0.42)',
  },
  bubbleSmallRight: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    right: 20,
    top: 78,
    backgroundColor: 'rgba(240, 150, 20, 0.3)',
  },

  // Back button
  backRow: {
    paddingHorizontal: 16,
    // marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: Platform.OS === 'ios' ? 0.7 : 1,
  },

  // Hero content row
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: '#4e4e4e',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Sora-Bold',
    fontSize: 20,
    fontWeight: '700',
    color: '#1f1f1f',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'WorkSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#5C442A',
  },

  // Hero Image illustration
  heroImage: {
    width: 130,
    height: 138,
    marginBottom: -8,
  },
});

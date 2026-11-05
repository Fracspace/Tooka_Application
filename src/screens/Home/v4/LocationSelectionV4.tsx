import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon, Screen, Text } from '../../../components/ui';
import { POPULAR_CITIES, type useLocationSelectionScreen } from '../../../hooks/useLocationSelectionScreen';
import { colors, fonts, motion, rise, useReduceMotion } from '../../../theme';

type Props = ReturnType<typeof useLocationSelectionScreen>;

const MAP_HEIGHT = 300;
const SELECTED_RING = 'rgba(251,243,232,0.6)';

const LocationSelectionV4: React.FC<Props> = ({
  location,
  query,
  setQuery,
  autocompleteResults,
  searching,
  searchFailed,
  selectingPlaceId,
  gpsLoading,
  gpsError,
  resolvingCity,
  currentSelectionLabel,
  handleUseCurrentLocation,
  handleOpenSettings,
  handleSelectAutocompleteItem,
  handleSelectPopularCity,
  goBack,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  // The sheet rises over the map while the user searches.
  const sheetUpTop = insets.top + 80;
  const sheetDownTop = MAP_HEIGHT + insets.top - 40;
  const sheetTop = useSharedValue(sheetDownTop);
  useEffect(() => {
    sheetTop.value = withTiming(isSearching ? sheetUpTop : sheetDownTop, {
      duration: motion.enter,
      easing: motion.out,
    });
  }, [isSearching, sheetDownTop, sheetTop, sheetUpTop]);
  const sheetStyle = useAnimatedStyle(() => ({ top: sheetTop.value }));

  const showEmpty = !searching && autocompleteResults.length === 0 && trimmed.length >= 2;

  return (
    <Screen>
      <MapBackdrop width={width} height={MAP_HEIGHT + insets.top} />

      <View style={[styles.bar, { top: insets.top + 12 }]}>
        <Pressable onPress={goBack} style={styles.round} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={20} />
        </Pressable>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city or locality"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search city or locality"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="close" size={12} strokeWidth={3} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.grab} />
        <ScrollView
          contentContainerStyle={[styles.sheetBody, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {isSearching ? (
            searching ? (
              <View style={styles.state}>
                <ActivityIndicator size="small" color={colors.brand2} />
                <Text style={styles.stateText}>Searching locations...</Text>
              </View>
            ) : showEmpty ? (
              <View style={styles.state}>
                <View style={styles.stateIcon}>
                  <Icon name="pin" size={26} color={colors.subtle} />
                </View>
                <Text style={styles.stateTitle}>{searchFailed ? "Couldn't search locations" : 'No locations found'}</Text>
                <Text style={styles.stateText}>
                  {searchFailed
                    ? 'Please check your connection and try again.'
                    : 'Try typing a different city or locality name.'}
                </Text>
              </View>
            ) : (
              <>
                {autocompleteResults.length > 0 ? (
                  <Text style={styles.label}>
                    {autocompleteResults.length} RESULT{autocompleteResults.length > 1 ? 'S' : ''}
                  </Text>
                ) : null}
                {autocompleteResults.map((item, i) => {
                  const isSelecting = selectingPlaceId === item.placeId;
                  const hit = item.mainText.toLowerCase().startsWith(trimmed.toLowerCase()) ? trimmed.length : 0;
                  return (
                    <Animated.View key={item.placeId} entering={rise(i * 40, 10)}>
                      <Pressable
                        style={({ pressed }) => [styles.result, pressed && styles.pressedRow]}
                        onPress={() => handleSelectAutocompleteItem(item)}
                        disabled={Boolean(selectingPlaceId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.mainText}${item.secondaryText ? `, ${item.secondaryText}` : ''}`}>
                        <View style={styles.resultIcon}>
                          <Icon name="pin" size={18} color={colors.muted} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            <Text style={[styles.resultTitle, styles.hit]}>{item.mainText.slice(0, hit)}</Text>
                            {item.mainText.slice(hit)}
                          </Text>
                          {item.secondaryText ? (
                            <Text style={styles.resultSub} numberOfLines={1}>
                              {item.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                        {isSelecting ? <ActivityIndicator size="small" color={colors.brand2} /> : null}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </>
            )
          ) : (
            <>
              <Text style={styles.h1}>Where should we look?</Text>

              {location && currentSelectionLabel ? (
                <>
                  <Text style={styles.label}>
                    {location.isManualSelection ? 'MANUALLY SELECTED LOCATION' : 'CURRENT GPS LOCATION'}
                  </Text>
                  <View style={[styles.card, styles.cardOn]}>
                    <View style={styles.cardIcon}>
                      <Icon name="pin" size={20} color={colors.brand2} />
                    </View>
                    <Text style={[styles.cardTitle, styles.flex]} numberOfLines={2}>
                      {currentSelectionLabel}
                    </Text>
                    <Icon name="check" size={20} color={colors.text} />
                  </View>
                </>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.card, styles.gpsCard, pressed && styles.pressed]}
                onPress={handleUseCurrentLocation}
                disabled={gpsLoading}
                accessibilityRole="button"
                accessibilityLabel="Use current location">
                <View style={styles.cardIcon}>
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color={colors.brand2} />
                  ) : (
                    <Icon name="directions" size={20} color={colors.brand2} />
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Use Current Location</Text>
                  <Text style={styles.cardSub}>Enable GPS for precise nearby spas</Text>
                </View>
              </Pressable>

              {gpsError ? (
                <View style={styles.error}>
                  <Text style={[styles.errorText, styles.flex]}>{gpsError}</Text>
                  {gpsError.includes('Settings') ? (
                    <Pressable onPress={handleOpenSettings} style={styles.settings} hitSlop={6} accessibilityRole="button">
                      <Text style={styles.settingsText}>Settings</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.label}>POPULAR CITIES</Text>
              <View style={styles.cities}>
                {POPULAR_CITIES.map((city, i) => {
                  const on =
                    location?.city?.toLowerCase() === city.name.toLowerCase() ||
                    location?.locality?.toLowerCase() === city.name.toLowerCase();
                  const resolving = resolvingCity === city.name;
                  return (
                    <Animated.View key={city.name} entering={rise(i * 45, 12)} style={styles.cityWrap}>
                      <Pressable
                        style={({ pressed }) => [styles.city, on && styles.cardOn, pressed && styles.pressed]}
                        onPress={() => handleSelectPopularCity(city)}
                        disabled={Boolean(resolvingCity)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${city.name}, ${city.state}`}>
                        {resolving ? (
                          <ActivityIndicator size="small" color={colors.brand2} />
                        ) : (
                          <Text style={[styles.mono, on && styles.monoOn]}>{city.name.slice(0, 2)}</Text>
                        )}
                        <View>
                          <Text style={styles.cityName} numberOfLines={1}>
                            {city.name}
                          </Text>
                          <Text style={styles.cityState} numberOfLines={1}>
                            {city.state}
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Screen>
  );
};

/** A quiet street-map drawing with a pulsing "you are here" pin. Decoration only. */
function MapBackdrop({ width, height }: { width: number; height: number }) {
  const reduceMotion = useReduceMotion();
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false);
    ringA.value = loop;
    ringB.value = withDelay(1100, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false));
    return () => {
      cancelAnimation(ringA);
      cancelAnimation(ringB);
    };
  }, [reduceMotion, ringA, ringB]);
  const ringStyleA = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - ringA.value), transform: [{ scale: 0.3 + 1.7 * ringA.value }] }));
  const ringStyleB = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - ringB.value), transform: [{ scale: 0.3 + 1.7 * ringB.value }] }));
  const pinTop = height * 0.52;

  return (
    <View style={[styles.map, { height }]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 390 ${height}`} preserveAspectRatio="xMidYMid slice" fill="none">
        <Path d="M-20 110 C80 140 160 80 260 130 S380 170 420 140" stroke="#2A241D" strokeWidth={14} strokeLinecap="round" />
        <Path d="M-20 280 C90 250 170 320 270 270 S370 240 420 280" stroke="#2A241D" strokeWidth={10} strokeLinecap="round" />
        <Path d="M120 -10 C140 120 100 220 150 420" stroke="#241F19" strokeWidth={8} strokeLinecap="round" />
        <Path d="M280 -10 C250 140 300 250 260 420" stroke="#241F19" strokeWidth={8} strokeLinecap="round" />
        <Path d="M0 200 H390M200 0 V420M60 0 L340 420M330 0 L40 420" stroke="#201B16" strokeWidth={3} />
        <Circle cx={80} cy={170} r={4} fill="#5C4A33" />
        <Circle cx={300} cy={210} r={4} fill="#5C4A33" />
        <Circle cx={140} cy={270} r={4} fill="#5C4A33" />
      </Svg>
      <View style={[styles.you, { top: pinTop, left: width / 2 }]}>
        <Animated.View style={[styles.ring, ringStyleA]} />
        <Animated.View style={[styles.ring, ringStyleB]} />
        <View style={styles.pinShadow} />
        <Svg width={44} height={58} viewBox="0 0 44 58" style={styles.pin}>
          <Path d="M22 2a20 20 0 0 1 20 20c0 14-20 34-20 34S2 36 2 22A20 20 0 0 1 22 2z" fill={colors.brand} />
          <Circle cx={22} cy={22} r={8} fill={colors.onBrand} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#17140F', overflow: 'hidden' },
  you: { position: 'absolute', width: 0, height: 0 },
  ring: {
    position: 'absolute',
    left: -30,
    top: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(251,243,232,0.35)',
  },
  pinShadow: {
    position: 'absolute',
    left: -9,
    top: -3,
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pin: { position: 'absolute', left: -22, top: -58 },
  bar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', gap: 10, zIndex: 3 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(29,25,21,0.94)',
    borderWidth: 1,
    borderColor: colors.edgeHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(29,25,21,0.94)',
    borderWidth: 1,
    borderColor: colors.edgeHi,
  },
  searchInput: { flex: 1, height: '100%', padding: 0, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.edgeHi,
    zIndex: 2,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, marginTop: 12, borderRadius: 2, backgroundColor: colors.s3 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, color: colors.text },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    color: colors.subtle,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
  },
  gpsCard: { marginTop: 12 },
  cardOn: { backgroundColor: colors.s2, borderColor: SELECTED_RING, borderWidth: 1.5 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  cardSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
  pressed: { transform: [{ scale: 0.98 }] },
  pressedRow: { opacity: 0.7 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(240,138,126,0.1)',
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger },
  settings: { paddingHorizontal: 12, height: 32, borderRadius: 10, backgroundColor: colors.s2, justifyContent: 'center' },
  settingsText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityWrap: { width: '31.6%' },
  city: {
    height: 84,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.edge,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mono: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 20, letterSpacing: -0.5, color: colors.subtle },
  monoOn: { color: colors.brand2 },
  cityName: { fontFamily: fonts.display, fontSize: 13, lineHeight: 18, color: colors.text },
  cityState: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: colors.subtle },
  state: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 12 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.text },
  stateText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.edge,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: colors.text },
  hit: { color: colors.brand2 },
  resultSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted },
});

export default LocationSelectionV4;

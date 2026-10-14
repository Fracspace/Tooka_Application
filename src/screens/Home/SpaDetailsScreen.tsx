import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import SpaDetailsContent from './SpaDetailsContent';
import { useSpaDetails } from '../../hooks/useSpaDetails';
import { useSlotBooking } from '../../hooks/useSlotBooking';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import BookingSummarySheet from '../Booking/components/BookingSummarySheet';
import { bookingOption } from '../Booking/bookingData';
import { Analytics, AnalyticsEvents, AnalyticsParams } from '../../services/firebase/analytics';
import { Crashlytics, CrashlyticsKeys } from '../../services/firebase/crashlytics';
import { formatPrice } from '../../utils/number';

type SpaDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SpaDetails'
>;
type SpaDetailsRouteProp = RouteProp<RootStackParamList, 'SpaDetails'>;

function SpaDetailsScreen(): React.ReactElement {
  const navigation = useNavigation<SpaDetailsNavigationProp>();
  const route = useRoute<SpaDetailsRouteProp>();
  const {
    spaId,
    serviceId,
    serviceName,
    selectedDateId: paramDateId,
    selectedSlotId: paramSlotId,
    openBooking,
    fromLogin,
    fromScreen,
  } = route.params;
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { spa, loading, refreshing, error, refetch, onRefresh } = useSpaDetails(spaId);
  const { isAuthenticated } = useAuth();

  const [selectedService, setSelectedService] = useState<{
    id?: string;
    name?: string;
  }>({
    id: serviceId,
    name: serviceName,
  });

  useEffect(() => {
    setSelectedService({ id: serviceId, name: serviceName });
  }, [serviceId, serviceName]);

  const activeServiceId = selectedService.id ?? serviceId;
  const targetService = useMemo(
    () => spa?.services?.find((s) => s.id === activeServiceId),
    [spa?.services, activeServiceId],
  );

  // The spa's own booking fee, or null (shown as "at payment") - never a guess.
  const bookingFeeText = useMemo(
    () => formatPrice(spa?.booking_fee ?? spa?.minimum_booking_amount),
    [spa?.booking_fee, spa?.minimum_booking_amount],
  );

  // The booking reserves a slot, not a service (createDirectBooking takes none), so
  // only name a service the user actually came from.
  const bookingDetails = useMemo(
    () => ({
      spaName: spa?.name,
      spaImage: targetService?.cover_image_url ?? spa?.cover_photo_url ?? undefined,
      location: spa?.locality_name ?? spa?.city_name ?? undefined,
      serviceName: targetService?.name ?? serviceName ?? bookingOption.title,
      serviceDurationMinutes: targetService?.duration_minutes ?? null,
    }),
    [spa, targetService, serviceName],
  );

  const booking = useSlotBooking({
    spaId,
    enabled: true,
    initialDateId: paramDateId,
    initialSlotId: paramSlotId,
    // After logging in to book, reopen the summary once the spa has loaded.
    autoOpenSummary: Boolean(openBooking && isAuthenticated && spa),
    details: bookingDetails,
  });

  useEffect(() => {
    if (!spa) return;
    Analytics.logEvent(AnalyticsEvents.SPA_VIEWED, {
      [AnalyticsParams.SPA_ID]: spa.id,
      [AnalyticsParams.SPA_NAME]: spa.name,
    });
    // Was called in the render body, i.e. on every re-render.
    Crashlytics.setCustomKey(CrashlyticsKeys.SPA_ID, spa.id);
    Crashlytics.setCustomKey(CrashlyticsKeys.SPA_NAME, spa.name);
  }, [spa]);

  const { openSummary, selectedDateId, selectedSlotId } = booking;

  // Primary Booking Proceed: validate, then show the booking summary
  const handleProceedBooking = useCallback(() => {
    if (spa && spa.is_bookable === false) {
      return;
    }

    if (!isAuthenticated) {
      navigation.navigate('Login', {
        spaId,
        serviceId: activeServiceId,
        serviceName: targetService?.name ?? serviceName,
        openBooking: true,
        selectedDateId,
        selectedSlotId: selectedSlotId || undefined,
        fromScreen: fromScreen ?? 'Home',
      });
      return;
    }

    openSummary();
  }, [
    spa,
    isAuthenticated,
    navigation,
    spaId,
    activeServiceId,
    targetService,
    serviceName,
    selectedDateId,
    selectedSlotId,
    fromScreen,
    openSummary,
  ]);

  const handleBack = useCallback(() => {
    if (fromLogin) {
      if (fromScreen === 'Explore') {
        navigation.navigate('BottomNavigation', { screen: 'Explore' });
      } else {
        navigation.navigate('BottomNavigation', { screen: 'Home' });
      }
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (fromScreen === 'Explore') {
      navigation.navigate('BottomNavigation', { screen: 'Explore' });
    } else {
      navigation.navigate('BottomNavigation', { screen: 'Home' });
    }
  }, [fromLogin, fromScreen, navigation]);

  useEffect(() => {
    if (!fromLogin) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fromScreen === 'Explore') {
        navigation.navigate('BottomNavigation', { screen: 'Explore' });
      } else {
        navigation.navigate('BottomNavigation', { screen: 'Home' });
      }
      return true;
    });
    return () => backHandler.remove();
  }, [fromLogin, fromScreen, navigation]);

  const summaryLocation = [spa?.locality_name, spa?.city_name].filter(Boolean).join(', ');

  // Pull-to-refresh used to reload the spa but leave stale slot availability.
  const { reloadAvailability } = booking;
  const handleRefresh = useCallback(() => {
    onRefresh();
    reloadAvailability();
  }, [onRefresh, reloadAvailability]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isTablet && styles.containerTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFAA26"
          />
        }
      >
        <SpaDetailsContent
          spa={spa}
          loading={loading}
          error={error}
          onRetry={refetch}
          onBack={handleBack}
          dates={booking.scheduleDates}
          selectedDateId={booking.selectedDateId}
          onSelectDate={booking.selectDate}
          slots={booking.timeSlots}
          selectedSlotId={booking.selectedSlotId}
          onSelectSlot={booking.selectSlot}
          loadingSlots={booking.loadingSlots}
          availabilityError={booking.availabilityError}
          bookingOption={bookingOption}
          onProceedBooking={handleProceedBooking}
          proceedLoading={booking.submitting}
          proceedDisabled={!booking.selectedSlot}
        />
      </ScrollView>

      <BookingSummarySheet
        visible={booking.summaryVisible && Boolean(booking.selectedSlot)}
        loading={booking.submitting}
        onClose={booking.closeSummary}
        onConfirm={booking.confirmBooking}
        spaName={spa?.name}
        spaImage={bookingDetails.spaImage}
        location={summaryLocation}
        dateLabel={booking.summaryDateLabel}
        timeLabel={booking.summaryTimeLabel}
        serviceName={bookingDetails.serviceName}
        serviceDurationMinutes={bookingDetails.serviceDurationMinutes ?? undefined}
        bookingFeeText={bookingFeeText}
        bookingFeeNote={bookingOption.description}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7EE',
  },
  container: {
    paddingBottom: 24,
  },
  containerTablet: {
    alignSelf: 'center',
    maxWidth: 720,
    width: '100%',
  },
});

export default SpaDetailsScreen;

import React from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SpaDetailsContent from './SpaDetailsContent';
import { useSpaDetailsScreen } from '../../hooks/useSpaDetailsScreen';
import BookingSummarySheet from '../Booking/components/BookingSummarySheet';
import SpaDetailsV4 from './v4/SpaDetailsV4';
import { isV4 } from '../../config/uiFlags';

function SpaDetailsScreen(): React.ReactElement {
  const screen = useSpaDetailsScreen();
  const {
    isTablet,
    spa,
    loading,
    refreshing,
    error,
    refetch,
    handleRefresh,
    handleBack,
    handleProceedBooking,
    booking,
    bookingOption,
    bookingDetails,
    bookingFeeText,
    summaryLocation,
  } = screen;

  const summarySheet = (
    <BookingSummarySheet
      visible={booking.summaryVisible && Boolean(booking.selectedSlot)}
      loading={booking.submitting}
      onClose={booking.closeSummary}
      onDismissed={booking.onSummaryDismissed}
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
  );

  if (isV4('spaDetails')) {
    return (
      <>
        <SpaDetailsV4 {...screen} />
        {summarySheet}
      </>
    );
  }

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

      {summarySheet}
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

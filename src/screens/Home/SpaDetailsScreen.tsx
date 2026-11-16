import React from 'react';

import { useSpaDetailsScreen } from '../../hooks/useSpaDetailsScreen';
import BookingSummarySheet from '../Booking/components/BookingSummarySheet';
import { slotMinutes } from '../Booking/slotFormat';
import SpaDetailsView from './SpaDetailsView';

type Screen = ReturnType<typeof useSpaDetailsScreen>;

/** The booking summary for a Spa Details screen (also used by the Home spotlight pager). */
export function SpaDetailsSummarySheet({ screen }: { screen: Screen }): React.ReactElement {
  const { spa, booking, bookingOption, bookingDetails, bookingFeeText, summaryLocation } = screen;
  return (
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
      slotDurationMinutes={slotMinutes(booking.selectedSlot)}
      serviceName={bookingDetails.serviceName}
      serviceDurationMinutes={bookingDetails.serviceDurationMinutes ?? undefined}
      bookingFeeText={bookingFeeText}
      bookingFeeNote={bookingOption.description}
    />
  );
}

function SpaDetailsScreen(): React.ReactElement {
  const screen = useSpaDetailsScreen();
  return (
    <>
      <SpaDetailsView {...screen} />
      <SpaDetailsSummarySheet screen={screen} />
    </>
  );
}

export default SpaDetailsScreen;

import React from 'react';

import BookingSummarySheetV4 from './v4/BookingSummarySheetV4';

export type BookingSummarySheetProps = {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Called once the sheet has fully closed (iOS); see useSlotBooking. */
  onDismissed?: () => void;
  spaName?: string;
  spaImage?: string;
  location?: string;
  dateLabel: string;
  timeLabel: string;
  serviceName?: string;
  serviceDurationMinutes?: number;
  /** Length of the booked slot; only the v4 sheet shows it. */
  slotDurationMinutes?: number;
  /** Formatted fee ("₹199"), or null when the spa has none on record. */
  bookingFeeText: string | null;
  bookingFeeNote?: string;
};

function BookingSummarySheet(props: BookingSummarySheetProps): React.ReactElement {
  return <BookingSummarySheetV4 {...props} />;
}

export default BookingSummarySheet;

import React from 'react';

import { useBookingResultScreen } from '../../hooks/useBookingResultScreen';
import BookingResultView from './BookingResultView';

function BookingResultScreen(): React.ReactElement {
  return <BookingResultView {...useBookingResultScreen()} />;
}

export default BookingResultScreen;

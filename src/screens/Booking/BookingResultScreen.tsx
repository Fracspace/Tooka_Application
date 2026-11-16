import React from 'react';

import { useBookingResultScreen } from '../../hooks/useBookingResultScreen';
import BookingResultV4 from './v4/BookingResultV4';

function BookingResultScreen(): React.ReactElement {
  return <BookingResultV4 {...useBookingResultScreen()} />;
}

export default BookingResultScreen;

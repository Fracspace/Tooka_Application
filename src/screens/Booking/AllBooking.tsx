import React from 'react';
import { useAllBookingScreen } from '../../hooks/useAllBookingScreen';
import AllBookingV4 from './v4/AllBookingV4';

const AllBookingScreen: React.FC = () => {
  const screen = useAllBookingScreen();
  return <AllBookingV4 {...screen} />;
};

export default AllBookingScreen;

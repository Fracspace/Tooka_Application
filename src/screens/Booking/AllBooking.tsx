import React from 'react';
import { useAllBookingScreen } from '../../hooks/useAllBookingScreen';
import AllBookingView from './AllBookingView';

const AllBookingScreen: React.FC = () => {
  const screen = useAllBookingScreen();
  return <AllBookingView {...screen} />;
};

export default AllBookingScreen;

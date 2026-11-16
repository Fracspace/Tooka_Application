import React from 'react';
import LocationSelectionV4 from './v4/LocationSelectionV4';
import { useLocationSelectionScreen } from '../../hooks/useLocationSelectionScreen';

const LocationSelectionScreen: React.FC = () => {
  const screen = useLocationSelectionScreen();
  return <LocationSelectionV4 {...screen} />;
};

export default LocationSelectionScreen;

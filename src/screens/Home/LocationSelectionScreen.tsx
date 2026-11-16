import React from 'react';
import LocationSelectionView from './LocationSelectionView';
import { useLocationSelectionScreen } from '../../hooks/useLocationSelectionScreen';

const LocationSelectionScreen: React.FC = () => {
  const screen = useLocationSelectionScreen();
  return <LocationSelectionView {...screen} />;
};

export default LocationSelectionScreen;

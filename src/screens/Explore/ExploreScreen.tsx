import React from 'react';

import { useExploreScreen } from '../../hooks/useExploreScreen';
import ExploreView from './ExploreView';

const ExploreScreen: React.FC = () => {
  const screen = useExploreScreen();
  return <ExploreView {...screen} />;
};

export default ExploreScreen;

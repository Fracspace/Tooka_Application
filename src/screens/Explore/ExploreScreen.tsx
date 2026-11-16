import React from 'react';

import { useExploreScreen } from '../../hooks/useExploreScreen';
import ExploreV4 from './v4/ExploreV4';

const ExploreScreen: React.FC = () => {
  const screen = useExploreScreen();
  return <ExploreV4 {...screen} />;
};

export default ExploreScreen;

import React from 'react';

import OnboardingView from './OnboardingView';
import { useOnboardingScreen } from '../../hooks/useOnboardingScreen';

export const OnboardingScreen: React.FC = () => {
  const screen = useOnboardingScreen();
  return <OnboardingView {...screen} />;
};

export default OnboardingScreen;

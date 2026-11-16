import React from 'react';

import OnboardingV4 from './v4/OnboardingV4';
import { useOnboardingScreen } from '../../hooks/useOnboardingScreen';

export const OnboardingScreen: React.FC = () => {
  const screen = useOnboardingScreen();
  return <OnboardingV4 {...screen} />;
};

export default OnboardingScreen;

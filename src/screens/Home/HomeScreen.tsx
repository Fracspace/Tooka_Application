import React from 'react';
import { useHomeScreen } from '../../hooks/useHomeScreen';
import HomeV4 from './v4/HomeV4';

const HomeScreen: React.FC = () => {
  const screen = useHomeScreen();
  return <HomeV4 {...screen} />;
};

export default HomeScreen;

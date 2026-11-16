import React from 'react';
import { useHomeScreen } from '../../hooks/useHomeScreen';
import HomeView from './HomeView';

const HomeScreen: React.FC = () => {
  const screen = useHomeScreen();
  return <HomeView {...screen} />;
};

export default HomeScreen;

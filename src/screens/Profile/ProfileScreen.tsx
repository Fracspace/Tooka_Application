import React from 'react';

import ProfileView from './ProfileView';
import { useProfileScreen } from '../../hooks/useProfileScreen';

const ProfileScreen: React.FC = () => {
  const screen = useProfileScreen();
  return <ProfileView {...screen} />;
};

export default ProfileScreen;

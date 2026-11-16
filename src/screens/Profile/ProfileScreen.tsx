import React from 'react';

import ProfileV4 from './v4/ProfileV4';
import { useProfileScreen } from '../../hooks/useProfileScreen';

const ProfileScreen: React.FC = () => {
  const screen = useProfileScreen();
  return <ProfileV4 {...screen} />;
};

export default ProfileScreen;

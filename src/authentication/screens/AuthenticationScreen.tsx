import React from 'react';

import AuthenticationV4 from '../v4/AuthenticationV4';
import { useAuthenticationScreen } from '../../hooks/useAuthenticationScreen';

interface AuthenticationScreenProps {
  isEmbedded?: boolean;
}

const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ isEmbedded = false }) => {
  const screen = useAuthenticationScreen({ isEmbedded });
  return <AuthenticationV4 {...screen} isEmbedded={isEmbedded} />;
};

export default AuthenticationScreen;

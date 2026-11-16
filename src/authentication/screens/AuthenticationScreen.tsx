import React from 'react';

import AuthenticationView from './AuthenticationView';
import { useAuthenticationScreen } from '../../hooks/useAuthenticationScreen';

interface AuthenticationScreenProps {
  isEmbedded?: boolean;
}

const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ isEmbedded = false }) => {
  const screen = useAuthenticationScreen({ isEmbedded });
  return <AuthenticationView {...screen} isEmbedded={isEmbedded} />;
};

export default AuthenticationScreen;

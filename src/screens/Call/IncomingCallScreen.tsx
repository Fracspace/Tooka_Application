import React from 'react';
import IncomingCallView from './IncomingCallView';
import { useIncomingCallScreen } from '../../hooks/useIncomingCallScreen';

const IncomingCallScreen: React.FC = () => {
  const screen = useIncomingCallScreen();
  return <IncomingCallView {...screen} />;
};

export default IncomingCallScreen;

import React from 'react';
import IncomingCallV4 from './v4/IncomingCallV4';
import { useIncomingCallScreen } from '../../hooks/useIncomingCallScreen';

const IncomingCallScreen: React.FC = () => {
  const screen = useIncomingCallScreen();
  return <IncomingCallV4 {...screen} />;
};

export default IncomingCallScreen;

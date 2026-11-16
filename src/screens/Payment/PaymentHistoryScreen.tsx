import React from 'react';
import { usePaymentHistoryScreen } from '../../hooks/usePaymentHistoryScreen';
import PaymentHistoryV4 from './v4/PaymentHistoryV4';

export const PaymentHistoryScreen: React.FC = () => {
  const screen = usePaymentHistoryScreen();
  return <PaymentHistoryV4 {...screen} />;
};

export default PaymentHistoryScreen;

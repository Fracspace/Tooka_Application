import React from 'react';
import { usePaymentHistoryScreen } from '../../hooks/usePaymentHistoryScreen';
import PaymentHistoryView from './PaymentHistoryView';

export const PaymentHistoryScreen: React.FC = () => {
  const screen = usePaymentHistoryScreen();
  return <PaymentHistoryView {...screen} />;
};

export default PaymentHistoryScreen;

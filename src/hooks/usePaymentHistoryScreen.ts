import { useMemo, useState } from 'react';

import { useMyBookings } from './useMyBookings';
import type { BackendBookingListItem } from '../types/booking';
import { bookingAmountsPaid } from '../utils/bookingTotals';
import { getBookingPaymentStatus, getPaymentCategory } from '../screens/Payment/utils/paymentFormatters';

export type PaymentFilterTab = 'all' | 'completed' | 'cancelled';

/**
 * Payments, filter tab and loading state for Payment history, shared by the
 * old and v4 layouts.
 */
export function usePaymentHistoryScreen() {
  const [activeTab, setActiveTab] = useState<PaymentFilterTab>('all');

  const {
    allBookings: allPayments,
    upcomingBookings,
    completedBookings,
    hasFetchedOnce,
    loading,
    refreshing,
    error,
    refetch,
    onRefresh,
  } = useMyBookings();

  // Filter by the real payment status. "Cancelled" used to mean "not captured",
  // so pending and never-paid bookings were listed (and labelled) as cancelled.
  const filteredPayments = useMemo(() => {
    const category = (item: BackendBookingListItem) =>
      getPaymentCategory(getBookingPaymentStatus(item));
    switch (activeTab) {
      case 'completed':
        return allPayments.filter(item => category(item) === 'completed');
      case 'cancelled':
        return allPayments.filter(item => category(item) === 'unsuccessful');
      case 'all':
      default:
        return allPayments;
    }
  }, [activeTab, allPayments]);

  // How many payments each tab holds, for the v4 filter chips.
  const tabCounts = useMemo(() => {
    const counts: Record<PaymentFilterTab, number> = { all: allPayments.length, completed: 0, cancelled: 0 };
    allPayments.forEach(item => {
      const category = getPaymentCategory(getBookingPaymentStatus(item));
      if (category === 'completed') {
        counts.completed += 1;
      } else if (category === 'unsuccessful') {
        counts.cancelled += 1;
      }
    });
    return counts;
  }, [allPayments]);

  // The summary card's total, worked out the same way as Profile's Paid stat.
  const amountsPaid = useMemo(
    () => (hasFetchedOnce ? bookingAmountsPaid(upcomingBookings, completedBookings) : null),
    [completedBookings, hasFetchedOnce, upcomingBookings],
  );

  return {
    activeTab,
    amountsPaid,
    setActiveTab,
    allPayments,
    filteredPayments,
    tabCounts,
    loading,
    refreshing,
    error,
    refetch,
    onRefresh,
  };
}


import { getBookingSection, isPaymentPendingStatus } from '../src/utils/getBookingSection';

describe('getBookingSection', () => {
  it('lists bookings awaiting payment under upcoming', () => {
    expect(getBookingSection('pending_payment')).toBe('upcoming');
    expect(getBookingSection(' PENDING_PAYMENT ')).toBe('upcoming');
    expect(isPaymentPendingStatus('pending_payment')).toBe(true);
  });

  it('keeps the other sections unchanged', () => {
    expect(getBookingSection('confirmed')).toBe('upcoming');
    expect(isPaymentPendingStatus('confirmed')).toBe(false);
    expect(getBookingSection('completed')).toBe('completed');
    expect(getBookingSection('cancelled_by_spa')).toBe('cancelled');
    expect(getBookingSection('something_new')).toBeNull();
  });
});

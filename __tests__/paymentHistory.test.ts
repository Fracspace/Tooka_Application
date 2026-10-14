import {
  extractPaymentDate,
  getBookingPaymentStatus,
  getPaymentCategory,
} from '../src/screens/Payment/utils/paymentFormatters';

describe('payment history status', () => {
  it('puts each payment in the right tab', () => {
    expect(getPaymentCategory('captured')).toBe('completed');
    expect(getPaymentCategory('failed')).toBe('unsuccessful');
    expect(getPaymentCategory('refunded')).toBe('unsuccessful');
    expect(getPaymentCategory('cancelled_by_user')).toBe('unsuccessful');
    // Used to be shown as "Cancelled".
    expect(getPaymentCategory('processing')).toBe('pending');
    expect(getPaymentCategory('initiated')).toBe('pending');
  });

  it('treats a pending_payment booking with no payment record as pending', () => {
    expect(getBookingPaymentStatus({ status: 'pending_payment', paymentStatus: null, raw: {} })).toBe(
      'pending',
    );
    expect(getBookingPaymentStatus({ status: 'confirmed', paymentStatus: 'captured' })).toBe('captured');
  });

  it('only reports a real payment time', () => {
    expect(extractPaymentDate({ payment: { payment_time: '2026-10-14T10:00:00Z' } } as any)).toBe(
      '2026-10-14T10:00:00Z',
    );
    // updated_at / created_at are not payment times.
    expect(extractPaymentDate({ updated_at: '2026-10-15T09:00:00Z' } as any)).toBeUndefined();
  });
});

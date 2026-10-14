import {
  mapInitiatePaymentResponse,
  mapPaymentVerificationResponse,
  mapSdkErrorToResult,
} from '../src/payment/PaymentMapper';
import { BackendPaymentStatus, SdkPaymentResult } from '../src/payment/PaymentTypes';

describe('mapPaymentVerificationResponse', () => {
  it('maps known statuses', () => {
    expect(mapPaymentVerificationResponse({ data: { status: 'captured' } }).status).toBe(
      BackendPaymentStatus.Captured,
    );
    expect(mapPaymentVerificationResponse({ status: 'FAILED' }).status).toBe(
      BackendPaymentStatus.Failed,
    );
  });

  it('maps unrecognised statuses to Unknown, never to a retryable "initiated"', () => {
    expect(mapPaymentVerificationResponse({ status: 'expired' }).status).toBe(
      BackendPaymentStatus.Unknown,
    );
    expect(mapPaymentVerificationResponse({}).status).toBe(BackendPaymentStatus.Unknown);
  });
});

describe('mapInitiatePaymentResponse', () => {
  const complete = {
    payment_id: 'pay_1',
    payment_session_id: 'session_1',
    cashfree_order_id: 'order_1',
    order_amount: '199.00',
    order_currency: 'INR',
  };

  it('accepts a complete response', () => {
    expect(mapInitiatePaymentResponse({ data: complete }).order_amount).toBe(199);
  });

  it('rejects a missing or zero amount instead of showing ₹0', () => {
    const withoutAmount: Record<string, unknown> = { ...complete };
    delete withoutAmount.order_amount;
    expect(() => mapInitiatePaymentResponse(withoutAmount)).toThrow();
    expect(() => mapInitiatePaymentResponse({ ...complete, order_amount: 0 })).toThrow();
  });
});

describe('mapSdkErrorToResult', () => {
  const sdkError = (code: string, message: string) => ({
    getCode: () => code,
    getMessage: () => message,
  });

  it('treats Cashfree refusing to open (untrusted installer) as failed, not unknown', () => {
    expect(
      mapSdkErrorToResult(
        sdkError(
          'installer_package_not_approved',
          'NOT_AVAILABLE is not a trusted source. App should be installed from play store or another whitelisted app store.',
        ),
      ),
    ).toBe(SdkPaymentResult.Failed);
  });

  it('still reads a user cancel sent with code payment_failed as cancelled', () => {
    expect(
      mapSdkErrorToResult(sdkError('payment_failed', 'User cancelled the transaction.')),
    ).toBe(SdkPaymentResult.Cancelled);
  });
});

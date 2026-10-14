const mockRelease = jest.fn();
const mockVerify = jest.fn();
jest.mock('../src/api/BookingApi', () => ({
  __esModule: true,
  default: { releaseBooking: (...args: unknown[]) => mockRelease(...args) },
}));
jest.mock('../src/api/PaymentApi', () => ({
  __esModule: true,
  default: { verifyPaymentStatus: (...args: unknown[]) => mockVerify(...args) },
}));

import { releaseSlotHold } from '../src/services/slotHold';

const httpError = (status?: number) =>
  Object.assign(new Error('request failed'), {
    isAxiosError: true,
    response: status ? { status, data: {} } : undefined,
  });

beforeEach(() => {
  mockRelease.mockReset().mockResolvedValue(undefined);
  mockVerify.mockReset();
});

describe('releaseSlotHold', () => {
  it('releases straight away when no payment was ever started', async () => {
    await expect(releaseSlotHold('b1')).resolves.toBe(true);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledWith('b1');
  });

  it.each(['initiated', 'pending', 'failed'])('releases when the payment is %s', async (status) => {
    mockVerify.mockResolvedValue({ status });
    await expect(releaseSlotHold('b1', 'p1')).resolves.toBe(true);
    expect(mockRelease).toHaveBeenCalledWith('b1');
  });

  it.each(['captured', 'processing', 'refunded', 'unknown'])(
    'keeps the slot when the payment is %s (money may have arrived)',
    async (status) => {
      mockVerify.mockResolvedValue({ status });
      await expect(releaseSlotHold('b1', 'p1')).resolves.toBe(false);
      expect(mockRelease).not.toHaveBeenCalled();
    },
  );

  it('keeps the slot when the payment status cannot be read', async () => {
    mockVerify.mockRejectedValue(httpError(500));
    await expect(releaseSlotHold('b1', 'p1')).resolves.toBe(false);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('retries once after a network error', async () => {
    jest.useFakeTimers();
    mockRelease.mockRejectedValueOnce(httpError()).mockResolvedValueOnce(undefined);
    const result = releaseSlotHold('b1');
    await jest.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe(true);
    expect(mockRelease).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry a 4xx (already released or expired)', async () => {
    mockRelease.mockRejectedValue(httpError(404));
    await expect(releaseSlotHold('b1')).resolves.toBe(false);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

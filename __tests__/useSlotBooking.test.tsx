import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockGetAvailability = jest.fn();
const mockCreateDirectBooking = jest.fn();
jest.mock('../src/api/BookingApi', () => ({
  __esModule: true,
  default: {
    getAvailability: (...args: unknown[]) => mockGetAvailability(...args),
    createDirectBooking: (...args: unknown[]) => mockCreateDirectBooking(...args),
  },
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
const mockProfile = { fullName: 'Asha Rao', phone: '+919999999999' };
jest.mock('../src/context/ProfileContext', () => ({ useProfile: () => ({ profile: mockProfile }) }));
const mockReleaseSlotHold = jest.fn();
jest.mock('../src/services/slotHold', () => ({
  releaseSlotHold: (...args: unknown[]) => mockReleaseSlotHold(...args),
}));
const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  Platform: { OS: 'ios' },
}));
const mockInitiatePayment = jest.fn();
jest.mock('../src/context/PaymentContext', () => ({
  usePaymentContext: () => ({
    initiatePayment: (...args: unknown[]) => mockInitiatePayment(...args),
    setBookingSummary: jest.fn(),
  }),
}));

import { useSlotBooking } from '../src/hooks/useSlotBooking';
import { buildScheduleDates } from '../src/utils/bookingSchedule';

const DETAILS = { serviceName: 'Standard slot booking', serviceDurationMinutes: null };
const [TODAY, TOMORROW] = buildScheduleDates();

const slot = (id: string, date: string, startTime: string, status = 'available') => ({
  slotId: id,
  date,
  startTime,
  endTime: startTime,
  status,
});

let latest: ReturnType<typeof useSlotBooking>;
function Harness({ spaId, autoOpenSummary }: { spaId: string; autoOpenSummary?: boolean }) {
  latest = useSlotBooking({ spaId, enabled: true, details: DETAILS, autoOpenSummary });
  return null;
}

const flush = () => ReactTestRenderer.act(async () => {
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
});

beforeEach(() => {
  mockGetAvailability.mockReset();
  mockCreateDirectBooking.mockReset();
  mockInitiatePayment.mockReset();
  mockNavigate.mockReset();
  mockReleaseSlotHold.mockReset();
  mockAlert.mockReset();
});

const slotOnHoldError = () =>
  Object.assign(new Error('Request failed with status code 409'), {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        success: false,
        message: 'Someone else is booking this slot right now.',
        error: { code: 'SLOT_ON_HOLD', statusCode: 409 },
      },
    },
  });

const renderAndOpenSummary = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Harness spaId="spa-a" />);
  });
  await flush();
  await ReactTestRenderer.act(async () => {
    latest.openSummary();
  });
  return renderer;
};

describe('useSlotBooking', () => {
  it('selects the next available slot automatically', async () => {
    mockGetAvailability.mockResolvedValue([
      slot('s1', TODAY.date, '10:00', 'booked'),
      slot('s2', TODAY.date, '11:00'),
      slot('s3', TODAY.date, '12:00'),
    ]);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness spaId="spa-a" />);
    });
    await flush();

    expect(latest.selectedSlotId).toBe('s2');
    expect(latest.summaryTimeLabel).toBe('11:00 AM');
  });

  it('moves to the next date when today is fully booked', async () => {
    mockGetAvailability.mockImplementation(({ date }: { date: string }) =>
      Promise.resolve(
        date === TODAY.date
          ? [slot('t1', TODAY.date, '10:00', 'booked')]
          : [slot('m1', TOMORROW.date, '09:00')],
      ),
    );

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness spaId="spa-a" />);
    });
    await flush();
    await flush();

    expect(latest.selectedDateId).toBe(TOMORROW.id);
    expect(latest.selectedSlotId).toBe('m1');
  });

  it('starts over with the new spa’s first open slot when the spa changes (Explore)', async () => {
    mockGetAvailability.mockImplementation(({ spaId }: { spaId: string }) =>
      Promise.resolve(
        spaId === 'spa-a'
          ? [slot('a1', TODAY.date, '10:00')]
          : [slot('b1', TODAY.date, '15:00')],
      ),
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<Harness spaId="spa-a" />);
    });
    await flush();
    expect(latest.selectedSlotId).toBe('a1');

    await ReactTestRenderer.act(async () => {
      renderer.update(<Harness spaId="spa-b" />);
    });
    await flush();

    expect(latest.selectedSlotId).toBe('b1');
    expect(latest.selectedDateId).toBe(TODAY.id);
  });

  it('opens the booking summary by itself after returning from Login', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness spaId="spa-a" autoOpenSummary />);
    });
    await flush();

    expect(latest.selectedSlotId).toBe('s1');
    expect(latest.summaryVisible).toBe(true);
  });

  it('does not open the summary on a normal visit', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness spaId="spa-a" />);
    });
    await flush();

    expect(latest.summaryVisible).toBe(false);
  });

  it('opens the payment screen only after the summary has fully closed (iOS Cashfree)', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);
    mockCreateDirectBooking.mockResolvedValue({ id: 'b1', booking_ref: 'REF1' });
    mockInitiatePayment.mockResolvedValue({ paymentId: 'p1', bookingId: 'b1' });

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<Harness spaId="spa-a" />);
    });
    await flush();
    await ReactTestRenderer.act(async () => {
      latest.openSummary();
    });

    let confirmed!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      confirmed = latest.confirmBooking();
    });
    await flush();

    // The Modal is closing but has not reported that it is gone yet.
    expect(latest.summaryVisible).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      latest.onSummaryDismissed();
      await confirmed;
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      'PaymentScreen',
      expect.objectContaining({ paymentId: 'p1', bookingId: 'b1' }),
    );
  });

  it('moves to the next open slot when someone else is paying for this one (SLOT_ON_HOLD)', async () => {
    mockGetAvailability
      .mockResolvedValueOnce([slot('s1', TODAY.date, '10:00'), slot('s2', TODAY.date, '11:00')])
      // After the 409 the backend reports s1 as held by the other user.
      .mockResolvedValueOnce([slot('s1', TODAY.date, '10:00', 'blocked'), slot('s2', TODAY.date, '11:00')]);
    mockCreateDirectBooking.mockRejectedValue(slotOnHoldError());

    await renderAndOpenSummary();
    expect(latest.selectedSlotId).toBe('s1');

    await ReactTestRenderer.act(async () => {
      await latest.confirmBooking();
    });
    await flush();

    expect(latest.summaryVisible).toBe(false);
    expect(mockGetAvailability).toHaveBeenCalledTimes(2);
    expect(latest.selectedSlotId).toBe('s2');
    expect(mockAlert).toHaveBeenCalledWith('This time is no longer available', expect.any(String));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('releases a booking whose payment never started once the user closes the summary', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);
    mockCreateDirectBooking.mockResolvedValue({ id: 'b1', booking_ref: 'REF1' });
    mockInitiatePayment.mockRejectedValue(new Error('gateway down'));

    await renderAndOpenSummary();
    await ReactTestRenderer.act(async () => {
      await latest.confirmBooking();
    });
    expect(mockAlert).toHaveBeenCalledWith('Payment initiation failed', expect.any(String));
    expect(mockReleaseSlotHold).not.toHaveBeenCalled();

    // Confirm again on the same slot: the booking is reused, not released.
    mockInitiatePayment.mockRejectedValueOnce(new Error('gateway down'));
    await ReactTestRenderer.act(async () => {
      await latest.confirmBooking();
    });
    expect(mockCreateDirectBooking).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      latest.closeSummary();
    });
    expect(mockReleaseSlotHold).toHaveBeenCalledWith('b1');
  });

  it('releases a booking whose payment never started when the screen closes', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);
    mockCreateDirectBooking.mockResolvedValue({ id: 'b1', booking_ref: 'REF1' });
    mockInitiatePayment.mockRejectedValue(new Error('gateway down'));

    const renderer = await renderAndOpenSummary();
    await ReactTestRenderer.act(async () => {
      await latest.confirmBooking();
    });
    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
    expect(mockReleaseSlotHold).toHaveBeenCalledWith('b1');
  });

  it('does not release a booking that went on to the payment screen', async () => {
    mockGetAvailability.mockResolvedValue([slot('s1', TODAY.date, '10:00')]);
    mockCreateDirectBooking.mockResolvedValue({ id: 'b1', booking_ref: 'REF1' });
    mockInitiatePayment.mockResolvedValue({ paymentId: 'p1', bookingId: 'b1' });

    const renderer = await renderAndOpenSummary();
    let confirmed!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      confirmed = latest.confirmBooking();
    });
    await flush();
    await ReactTestRenderer.act(async () => {
      latest.onSummaryDismissed();
      await confirmed;
    });
    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
    expect(mockNavigate).toHaveBeenCalled();
    expect(mockReleaseSlotHold).not.toHaveBeenCalled();
  });
});

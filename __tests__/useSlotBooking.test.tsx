import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockGetAvailability = jest.fn();
jest.mock('../src/api/BookingApi', () => ({
  __esModule: true,
  default: { getAvailability: (...args: unknown[]) => mockGetAvailability(...args) },
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../src/context/ProfileContext', () => ({ useProfile: () => ({ profile: null }) }));
jest.mock('../src/context/PaymentContext', () => ({
  usePaymentContext: () => ({ initiatePayment: jest.fn(), setBookingSummary: jest.fn() }),
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

beforeEach(() => mockGetAvailability.mockReset());

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
});

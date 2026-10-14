import { getSlotBookingErrorMessage, isSlotUnavailableError } from '../src/utils/bookingSchedule';

const apiError = (status: number, data: unknown) =>
  Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status, data } });

// The body the backend sends when another user is paying for the slot.
const SLOT_ON_HOLD_BODY = {
  success: false,
  message: 'Someone else is booking this slot right now.',
  error: { code: 'SLOT_ON_HOLD', message: 'Someone else is booking this slot right now.', statusCode: 409 },
};

describe('booking error helpers', () => {
  it('recognises a slot held by someone else', () => {
    expect(isSlotUnavailableError(apiError(409, SLOT_ON_HOLD_BODY))).toBe(true);
    expect(isSlotUnavailableError(apiError(400, { error: { code: 'SLOT_ON_HOLD' } }))).toBe(true);
    expect(isSlotUnavailableError(apiError(400, { message: 'Invalid guest' }))).toBe(false);
    expect(isSlotUnavailableError(new Error('boom'))).toBe(false);
  });

  it('shows the API message, including from older backends that only send error.message', () => {
    expect(getSlotBookingErrorMessage(apiError(409, SLOT_ON_HOLD_BODY))).toBe(
      'Someone else is booking this slot right now.',
    );
    expect(
      getSlotBookingErrorMessage(apiError(409, { error: { message: 'Slot is on hold.' } })),
    ).toBe('Slot is on hold.');
    expect(getSlotBookingErrorMessage(apiError(500, {}))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

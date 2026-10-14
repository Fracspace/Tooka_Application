import { getGuestName } from '../src/utils/bookingGuest';

describe('getGuestName', () => {
  it('uses the first real name available', () => {
    expect(getGuestName({ fullName: '  Krishna Gupta ', displayName: 'KG' }, null)).toBe('Krishna Gupta');
    expect(getGuestName({ fullName: null, displayName: 'KG' } as any, null)).toBe('KG');
    expect(getGuestName(null, { fullName: undefined, userName: 'krishna' } as any)).toBe('krishna');
  });

  it('returns null instead of inventing "Guest"', () => {
    expect(getGuestName(null, null)).toBeNull();
    expect(getGuestName({ fullName: '  ', displayName: '' } as any, { userName: '' } as any)).toBeNull();
  });
});

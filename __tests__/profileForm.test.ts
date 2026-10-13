jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { buildUpdateProfilePayload, formFromProfile } from '../src/utils/profileForm';

describe('profile form', () => {
  it('does not invent a gender or date of birth', () => {
    const form = formFromProfile(null);
    expect(form.gender).toBeNull(); // was 'male'
    expect(form.dateOfBirth).toBeNull(); // was 18 Dec 2000
  });

  it('keeps values the user actually set', () => {
    const form = formFromProfile({ gender: 'Female', dateOfBirth: '1994-06-02' } as any);
    expect(form.gender).toBe('female');
    expect(form.dateOfBirth?.getFullYear()).toBe(1994);
  });

  it('leaves unset fields out of the saved payload', async () => {
    const payload = await buildUpdateProfilePayload(
      { ...formFromProfile(null), firstName: 'Krishna' },
      null,
    );
    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('dateOfBirth');
  });
});

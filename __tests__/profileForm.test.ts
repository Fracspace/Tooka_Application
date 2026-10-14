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

describe('profile payload does not overwrite server values', () => {
  it('never sends phone, and omits empty categories and push token', async () => {
    const payload = await buildUpdateProfilePayload(
      { ...formFromProfile({ phone: '+919876543210' } as any), firstName: 'Krishna' },
      null,
    );
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('preferredCategories');
    expect(payload).not.toHaveProperty('pushToken');
    expect(payload).not.toHaveProperty('pushTokenPlatform');
  });
});

describe('profile validation', () => {
  const { validateProfileUpdate } = require('../src/utils/profileValidation');

  it('accepts a single name and no gender', () => {
    expect(validateProfileUpdate({ fullName: 'Krishna' }, null).valid).toBe(true);
  });

  it('still requires a first name', () => {
    expect(validateProfileUpdate({ fullName: '  ' }, null).valid).toBe(false);
  });
});

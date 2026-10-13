import { formatPrice } from '../src/utils/number';

describe('formatPrice', () => {
  it('formats API decimal strings as whole rupees', () => {
    expect(formatPrice('999.00')).toBe('₹999');
    expect(formatPrice('149.00')).toBe('₹149');
  });

  it('uses Indian digit grouping', () => {
    expect(formatPrice('125000')).toBe('₹1,25,000');
  });

  it('returns null for missing, zero or invalid prices', () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice('')).toBeNull();
    expect(formatPrice('0.00')).toBeNull();
    expect(formatPrice('abc')).toBeNull();
  });
});

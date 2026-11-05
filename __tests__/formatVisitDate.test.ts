import { formatVisitDate } from '../src/utils/formatVisitDate';

describe('formatVisitDate', () => {
  it('reads the Z-tagged IST wall clock as-is', () => {
    expect(formatVisitDate('2026-10-23T12:30:00.000Z')).toBe('Fri, 23 Oct · 12:30 PM');
    expect(formatVisitDate('2026-11-05T08:30:00.000Z')).toBe('Thu, 5 Nov · 8:30 AM');
  });
  it('is null for bad input', () => {
    expect(formatVisitDate(null)).toBeNull();
  });
});

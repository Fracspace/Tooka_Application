import { nearestCity } from '../src/utils/nearestCity';

describe('nearestCity', () => {
  it('names Hyderabad for Secunderabad', () => {
    expect(nearestCity(17.4399, 78.4983)).toBe('Hyderabad');
  });
  it('names Hyderabad for Gachibowli', () => {
    expect(nearestCity(17.4401, 78.3489)).toBe('Hyderabad');
  });
  it('is null more than 50 km from every listed city (Vizag)', () => {
    expect(nearestCity(17.6868, 83.2185)).toBeNull();
  });
  it('is null without coordinates', () => {
    expect(nearestCity(null, 78.4)).toBeNull();
  });
});

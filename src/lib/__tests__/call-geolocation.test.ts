import { formatGeolocation, parseCoordinate } from '@/lib/call-geolocation';

describe('formatGeolocation', () => {
  it('formats a usable fix as "lat,lon"', () => {
    expect(formatGeolocation(39.1, -119.7)).toBe('39.1,-119.7');
  });

  it('keeps a single zero coordinate, which is a real place', () => {
    expect(formatGeolocation(0, 32.5)).toBe('0,32.5');
    expect(formatGeolocation(51.5, 0)).toBe('51.5,0');
  });

  it('is empty, never a bare ",", without a usable fix', () => {
    expect(formatGeolocation(undefined, undefined)).toBe('');
    expect(formatGeolocation(39.1, undefined)).toBe('');
    expect(formatGeolocation(null, null)).toBe('');
    expect(formatGeolocation(Number.NaN, 1)).toBe('');
    expect(formatGeolocation(0, 0)).toBe('');
    expect(formatGeolocation(91, 0.5)).toBe('');
    expect(formatGeolocation(45, 181)).toBe('');
  });
});

describe('parseCoordinate', () => {
  it('reads numbers and numeric strings', () => {
    expect(parseCoordinate('39.1')).toBe(39.1);
    expect(parseCoordinate(' -119.7 ')).toBe(-119.7);
    expect(parseCoordinate('0')).toBe(0);
    expect(parseCoordinate(12)).toBe(12);
  });

  it('is null for anything else', () => {
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('  ')).toBeNull();
    expect(parseCoordinate('abc')).toBeNull();
    expect(parseCoordinate(undefined)).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate(Number.NaN)).toBeNull();
  });
});

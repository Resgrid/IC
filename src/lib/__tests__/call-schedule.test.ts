import { getScheduledDispatchPrefill, isScheduledDispatchTooSoon, MIN_SCHEDULED_DISPATCH_LEAD_MINUTES, toDispatchOnUtc } from '@/lib/call-schedule';

const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const minutesFromNow = (minutes: number) => new Date(NOW + minutes * 60 * 1000).toISOString();

describe('getScheduledDispatchPrefill', () => {
  it('pre-fills a dispatch time that is still ahead', () => {
    expect(getScheduledDispatchPrefill('2026-10-08T14:30:00Z', NOW)).toBe('2026-10-08T14:30:00.000Z');
  });

  it('reads a stored time without a zone as UTC', () => {
    expect(getScheduledDispatchPrefill('2026-10-08T14:30:00', NOW)).toBe('2026-10-08T14:30:00.000Z');
  });

  it('leaves the field empty for a call already sent, or with no time', () => {
    expect(getScheduledDispatchPrefill('2026-10-08T11:59:00', NOW)).toBe('');
    expect(getScheduledDispatchPrefill('2026-10-08T12:00:00Z', NOW)).toBe('');
    expect(getScheduledDispatchPrefill('', NOW)).toBe('');
    expect(getScheduledDispatchPrefill(null, NOW)).toBe('');
    expect(getScheduledDispatchPrefill('not a date', NOW)).toBe('');
  });
});

describe('isScheduledDispatchTooSoon', () => {
  it('needs the time to be at least the minimum lead ahead', () => {
    expect(MIN_SCHEDULED_DISPATCH_LEAD_MINUTES).toBe(15);
    expect(isScheduledDispatchTooSoon(minutesFromNow(15), NOW)).toBe(false);
    expect(isScheduledDispatchTooSoon(minutesFromNow(60), NOW)).toBe(false);
    expect(isScheduledDispatchTooSoon(minutesFromNow(14), NOW)).toBe(true);
    expect(isScheduledDispatchTooSoon(minutesFromNow(-5), NOW)).toBe(true);
  });

  it('never blocks an empty field, and blocks a value that is not a time', () => {
    expect(isScheduledDispatchTooSoon('', NOW)).toBe(false);
    expect(isScheduledDispatchTooSoon(undefined, NOW)).toBe(false);
    expect(isScheduledDispatchTooSoon('soon', NOW)).toBe(true);
  });
});

describe('toDispatchOnUtc', () => {
  it('sends a chosen time as ISO 8601 UTC', () => {
    expect(toDispatchOnUtc('2026-10-09T14:30:00.000Z')).toBe('2026-10-09T14:30:00.000Z');
    expect(toDispatchOnUtc('2026-10-09T16:30:00+02:00')).toBe('2026-10-09T14:30:00.000Z');
  });

  it('leaves it out when no time is set', () => {
    expect(toDispatchOnUtc('')).toBeUndefined();
    expect(toDispatchOnUtc(undefined)).toBeUndefined();
    expect(toDispatchOnUtc('not a date')).toBeUndefined();
  });
});

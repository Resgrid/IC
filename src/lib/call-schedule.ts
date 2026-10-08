import { parseUtcMs } from './utils';

/**
 * Scheduled dispatch ("dispatch on") for the call forms. The form holds the chosen time as an ISO 8601
 * UTC string (what the date/time field produces), or '' for none.
 */

/** How far ahead a scheduled dispatch must be, the same rule as the web call form. */
export const MIN_SCHEDULED_DISPATCH_LEAD_MINUTES = 15;

/**
 * The edit form's starting value for a call's stored dispatch time (`DispatchedOnUtc`, UTC even without
 * a 'Z'): the time when it is still ahead, meaning the call is scheduled and has not gone out, and ''
 * otherwise — a dispatch time in the past is history, not a schedule to edit.
 */
export const getScheduledDispatchPrefill = (dispatchedOnUtc?: string | null, now: number = Date.now()): string => {
  const ms = parseUtcMs(dispatchedOnUtc);

  return ms !== null && ms > now ? new Date(ms).toISOString() : '';
};

/** True when a chosen time is less than the minimum lead ahead of now (or is not a time at all). No time is never too soon. */
export const isScheduledDispatchTooSoon = (value?: string | null, now: number = Date.now()): boolean => {
  if (!value) {
    return false;
  }

  const ms = parseUtcMs(value);

  return ms === null || ms < now + MIN_SCHEDULED_DISPATCH_LEAD_MINUTES * 60 * 1000;
};

/** The `DispatchOnUtc` to send for a chosen time, or undefined to leave it out of the request. */
export const toDispatchOnUtc = (value?: string | null): string | undefined => {
  const ms = parseUtcMs(value);

  return ms === null ? undefined : new Date(ms).toISOString();
};

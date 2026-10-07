import { isAxiosError } from 'axios';

/**
 * Close states accepted by `PUT Calls/CloseCall` (Core v4), in the order the pickers show them.
 * Shared by the close-call sheet and the End Command dialog so both offer the same seven choices.
 */
export const CALL_CLOSE_TYPES = [
  { value: 1, labelKey: 'call_detail.close_call_types.closed' },
  { value: 2, labelKey: 'call_detail.close_call_types.cancelled' },
  { value: 3, labelKey: 'call_detail.close_call_types.unfounded' },
  { value: 4, labelKey: 'call_detail.close_call_types.founded' },
  { value: 5, labelKey: 'call_detail.close_call_types.minor' },
  { value: 6, labelKey: 'call_detail.close_call_types.transferred' },
  { value: 7, labelKey: 'call_detail.close_call_types.false_alarm' },
] as const;

/** "Closed" — the default close state when a call is closed from the End Command dialog. */
export const DEFAULT_CALL_CLOSE_TYPE = 1;

/** Anything longer than this is not a reason written for a person (a stack trace, an error page). */
const MAX_SERVER_MESSAGE_LENGTH = 500;

/** The request never got an answer (offline, DNS, timeout): worth queueing for replay, not reporting as refused. */
export const isNetworkFailure = (error: unknown): boolean => isAxiosError(error) && !error.response;

/**
 * The server answered with a refusal that sending the same request again cannot change: a 4xx other than a
 * timeout or rate limit. No answer, a timeout, a rate limit or a 5xx may still go through on a retry.
 */
export const isServerRejection = (error: unknown): boolean => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429;
};

/** A call close the server refused for good, e.g. 400 "This call has an active incident command". */
export const isCallCloseRejection = isServerRejection;

/**
 * The reason the server gave for refusing a call close, when it gave one. The v4 controller answers a refused
 * close with a plain-text 400 body (for example "This call has an active incident command. Close the incident
 * command first, then close the call."); a JSON body's Message/detail/title is accepted too. Returns null for
 * network and server (5xx) failures, empty bodies and HTML error pages, so callers fall back to their own text.
 */
export const getCallCloseErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error) || !isCallCloseRejection(error)) {
    return null;
  }

  const data: unknown = error.response?.data;
  let text: unknown = data;
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    text = body.Message ?? body.message ?? body.detail ?? body.title;
  }

  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<') || trimmed.length > MAX_SERVER_MESSAGE_LENGTH) {
    return null;
  }
  return trimmed;
};

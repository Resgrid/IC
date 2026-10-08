import { isAxiosError } from 'axios';

import { type NewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { type DispatchSelection } from '@/stores/dispatch/store';

import { formatGeolocation, parseCoordinate } from './call-geolocation';

/**
 * Shared rules for applying the department's new-call field policy to this app's call forms (new call
 * and edit call), so the two screens cannot drift apart on what a field is called, what counts as
 * filled in, or which requirements the server actually enforces for this client.
 */

/**
 * The i18n key of each policy field's label. The policy speaks in stable wire keys; a dispatcher told
 * to fill in 'contactName' is being shown the protocol rather than their own form. Fields this app has
 * no input for still get a label, because the server may enforce them on save and the message has to
 * say what is missing in words the dispatcher recognises from the web form.
 */
export const CALL_FIELD_LABEL_KEYS: Record<NewCallFieldKey, string> = {
  [NewCallFieldKeys.Address]: 'calls.address',
  [NewCallFieldKeys.Geolocation]: 'calls.coordinates',
  [NewCallFieldKeys.What3Words]: 'calls.what3words',
  [NewCallFieldKeys.PlusCode]: 'calls.plus_code',
  [NewCallFieldKeys.DestinationPoi]: 'calls.destination_poi',
  [NewCallFieldKeys.IndoorLocation]: 'calls.indoor_location',
  [NewCallFieldKeys.Note]: 'calls.note',
  [NewCallFieldKeys.ContactName]: 'calls.contact_name',
  [NewCallFieldKeys.ContactInfo]: 'calls.contact_info',
  [NewCallFieldKeys.ExternalId]: 'call_detail.external_id',
  [NewCallFieldKeys.IncidentId]: 'calls.incident_id',
  [NewCallFieldKeys.ReferenceId]: 'call_detail.reference_id',
  [NewCallFieldKeys.Protocols]: 'protocols.title',
  [NewCallFieldKeys.LinkedCall]: 'calls.linked_call',
  [NewCallFieldKeys.DispatchOn]: 'calls.scheduled_dispatch',
  [NewCallFieldKeys.DispatchList]: 'calls.dispatch_to',
};

/** Lowercased key -> canonical key, so a key read back from a server message matches regardless of casing. */
const CANONICAL_KEYS = new Map<string, NewCallFieldKey>(Object.values(NewCallFieldKeys).map((key) => [key.toLowerCase(), key]));

/**
 * The labels for a list of policy keys, in order. A key this app does not know (a newer server) falls
 * back to the raw key, which at least names something, rather than being dropped from the message.
 */
export const getCallFieldLabels = (keys: readonly string[], t: (key: string) => string): string[] =>
  keys.map((key) => {
    const canonical = CANONICAL_KEYS.get(key.trim().toLowerCase());

    return canonical ? t(CALL_FIELD_LABEL_KEYS[canonical]) : key;
  });

/**
 * Requirements the server does not enforce on a new call from this app. This app has no indoor location,
 * protocol or linked-call picker and never sends IndoorMapZoneId, ProtocolIds or LinkedCallId, and
 * SaveCall skips each requirement for a client that omits its property. Checking them here would block
 * calls the server accepts.
 */
export const NEW_CALL_UNENFORCED_KEYS: ReadonlySet<NewCallFieldKey> = new Set<NewCallFieldKey>([NewCallFieldKeys.IndoorLocation, NewCallFieldKeys.Protocols, NewCallFieldKeys.LinkedCall]);

/**
 * Requirements the server does not enforce on an edit from this app:
 * - dispatchOn: never required on an edit (it only means something before a call goes out);
 * - indoorLocation, protocols, linkedCall: this app has no picker for them and never sends
 *   IndoorMapZoneId, ProtocolIds or LinkedCallId, and EditCall skips each requirement when its
 *   property is omitted;
 * - pluscode: a plus code is never stored on a call, so the server never requires it.
 */
export const EDIT_CALL_UNENFORCED_KEYS: ReadonlySet<NewCallFieldKey> = new Set<NewCallFieldKey>([
  NewCallFieldKeys.DispatchOn,
  NewCallFieldKeys.IndoorLocation,
  NewCallFieldKeys.Protocols,
  NewCallFieldKeys.LinkedCall,
  NewCallFieldKeys.PlusCode,
]);

/** Core's CallStates.Pending: saved and numbered, but not dispatched yet. */
export const CALL_STATE_PENDING = 8;

/**
 * Whether a call is Pending. The API reports State as Core's numeric CallStates value; a numeric
 * string and the name 'Pending' (older API versions) are accepted too.
 */
export const isPendingCallState = (state: unknown): boolean => {
  if (typeof state === 'number') {
    return state === CALL_STATE_PENDING;
  }

  if (typeof state === 'string') {
    const normalized = state.trim().toLowerCase();

    return normalized === String(CALL_STATE_PENDING) || normalized === 'pending';
  }

  return false;
};

/** True when the selection sends the call to someone: everyone, or at least one person, group, role or unit. */
export const hasDispatchRecipients = (selection?: DispatchSelection | null): boolean =>
  !!selection && (selection.everyone || selection.users.length > 0 || selection.groups.length > 0 || selection.roles.length > 0 || selection.units.length > 0);

/** The policy-relevant values of a call form, as the form holds them. */
export interface CallFieldFormValues {
  note?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  what3words?: string;
  plusCode?: string;
  contactName?: string;
  contactInfo?: string;
  externalId?: string;
  incidentId?: string;
  referenceId?: string;
  /** Scheduled dispatch time as the form holds it: ISO 8601 UTC, or '' for none. */
  dispatchOn?: string;
  destinationPoiId?: string;
  dispatchSelection?: DispatchSelection | null;
}

export type CallFieldValues = Partial<Record<NewCallFieldKey, unknown>>;

/**
 * New call: the value of each field exactly as createCall sends it. The indoor location, protocols and
 * linked call have no input in this app and are absent; the server does not enforce them for it (see
 * NEW_CALL_UNENFORCED_KEYS).
 */
export const getNewCallFieldValues = (values: CallFieldFormValues): CallFieldValues => ({
  [NewCallFieldKeys.Note]: values.note,
  [NewCallFieldKeys.Address]: values.address,
  [NewCallFieldKeys.Geolocation]: formatGeolocation(values.latitude, values.longitude),
  [NewCallFieldKeys.What3Words]: values.what3words,
  [NewCallFieldKeys.PlusCode]: values.plusCode,
  [NewCallFieldKeys.ContactName]: values.contactName,
  [NewCallFieldKeys.ContactInfo]: values.contactInfo,
  [NewCallFieldKeys.ExternalId]: values.externalId,
  [NewCallFieldKeys.IncidentId]: values.incidentId,
  [NewCallFieldKeys.ReferenceId]: values.referenceId,
  [NewCallFieldKeys.DispatchOn]: values.dispatchOn,
  [NewCallFieldKeys.DestinationPoi]: values.destinationPoiId,
  [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(values.dispatchSelection),
});

/** The stored call fields an edit can fall back to. */
export type StoredCallFieldValues = Partial<Pick<CallResultData, 'Note' | 'Address' | 'Latitude' | 'Longitude' | 'What3Words' | 'ContactName' | 'ContactInfo' | 'ExternalId' | 'IncidentId' | 'ReferenceId'>>;

const textOrStored = (submitted: string | undefined, stored: string | undefined): string => (submitted && submitted.trim() ? submitted : (stored ?? ''));

/**
 * Edit call: each field as the call will be after EditCall applies the submitted values, which is what
 * the server checks. A blank text input keeps the stored value. The destination and dispatch list are
 * whatever the form submits (it is pre-filled from the stored call) — an empty dispatch list would
 * re-dispatch the whole department, so it counts as blank.
 */
export const getEditCallFieldValues = (values: CallFieldFormValues, call: StoredCallFieldValues): CallFieldValues => {
  const submittedGeolocation = formatGeolocation(values.latitude, values.longitude);

  return {
    [NewCallFieldKeys.Note]: textOrStored(values.note, call.Note),
    [NewCallFieldKeys.Address]: textOrStored(values.address, call.Address),
    [NewCallFieldKeys.Geolocation]: submittedGeolocation || formatGeolocation(parseCoordinate(call.Latitude), parseCoordinate(call.Longitude)),
    [NewCallFieldKeys.What3Words]: textOrStored(values.what3words, call.What3Words),
    [NewCallFieldKeys.ContactName]: textOrStored(values.contactName, call.ContactName),
    [NewCallFieldKeys.ContactInfo]: textOrStored(values.contactInfo, call.ContactInfo),
    [NewCallFieldKeys.ExternalId]: textOrStored(values.externalId, call.ExternalId),
    [NewCallFieldKeys.IncidentId]: textOrStored(values.incidentId, call.IncidentId),
    [NewCallFieldKeys.ReferenceId]: textOrStored(values.referenceId, call.ReferenceId),
    [NewCallFieldKeys.DestinationPoi]: values.destinationPoiId,
    [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(values.dispatchSelection),
  };
};

/**
 * The required fields the policy says are missing, minus those the server will not enforce for this
 * screen. On a pending call nobody has been sent anything yet, so the dispatch list and dispatch time
 * are not required of it (the server skips both for pending calls too).
 */
export const getMissingRequiredCallFields = (policy: Pick<NewCallFieldPolicy, 'missingRequired'>, values: CallFieldValues, options: { unenforced: ReadonlySet<NewCallFieldKey>; isPending?: boolean }): NewCallFieldKey[] =>
  policy
    .missingRequired(values)
    .filter((key) => !options.unenforced.has(key))
    .filter((key) => !(options.isPending && (key === NewCallFieldKeys.DispatchList || key === NewCallFieldKeys.DispatchOn)));

const MISSING_FIELDS_PREFIX = 'required call fields are missing:';

/**
 * The policy keys from a SaveCall/EditCall refusal ("Required call fields are missing: key1, key2"),
 * or null when the error is anything else. Lets a screen name the fields in the dispatcher's language
 * when the server's policy disagrees with the one the form loaded (it changed in between, or the
 * lookup failed and the form fell open).
 */
export const getMissingRequiredFieldsFromError = (error: unknown): string[] | null => {
  if (!isAxiosError(error) || error.response?.status !== 400) {
    return null;
  }

  const data: unknown = error.response.data;
  let text: unknown = data;

  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    text = body.Message ?? body.message ?? body.detail ?? body.title;
  }

  if (typeof text !== 'string') {
    return null;
  }

  const index = text.toLowerCase().indexOf(MISSING_FIELDS_PREFIX);

  if (index < 0) {
    return null;
  }

  const keys = text
    .slice(index + MISSING_FIELDS_PREFIX.length)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  return keys.length > 0 ? keys : null;
};

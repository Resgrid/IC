import {
  CALL_FIELD_LABEL_KEYS,
  EDIT_CALL_UNENFORCED_KEYS,
  getCallFieldLabels,
  getEditCallFieldValues,
  getMissingRequiredCallFields,
  getMissingRequiredFieldsFromError,
  getNewCallFieldValues,
  hasDispatchRecipients,
  isPendingCallState,
  NEW_CALL_UNENFORCED_KEYS,
} from '@/lib/call-field-policy';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

import en from '../../translations/en.json';

const noDispatch = { everyone: false, users: [], groups: [], roles: [], units: [] };

const lookup = (key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), en);

/** A policy stand-in that reports the given keys as missing whatever the values. */
const policyMissing = (keys: NewCallFieldKey[]) => ({ missingRequired: jest.fn(() => keys) });

describe('call field labels', () => {
  it('has an English label for every policy key', () => {
    for (const key of Object.values(NewCallFieldKeys)) {
      expect(typeof lookup(CALL_FIELD_LABEL_KEYS[key])).toBe('string');
    }
  });

  it('labels keys in order, matching any casing, and keeps an unknown key as is', () => {
    const t = (key: string) => `t(${key})`;

    expect(getCallFieldLabels(['contactName', 'INCIDENTID', ' referenceId ', 'somethingNew'], t)).toEqual(['t(calls.contact_name)', 't(calls.incident_id)', 't(call_detail.reference_id)', 'somethingNew']);
  });
});

describe('isPendingCallState', () => {
  it.each([
    [8, true],
    ['8', true],
    ['Pending', true],
    [0, false],
    ['0', false],
    ['Active', false],
    [1, false],
    [undefined, false],
    [null, false],
  ])('%p -> %p', (state, expected) => {
    expect(isPendingCallState(state)).toBe(expected);
  });
});

describe('hasDispatchRecipients', () => {
  it('is false for nobody and true for everyone or anyone', () => {
    expect(hasDispatchRecipients(undefined)).toBe(false);
    expect(hasDispatchRecipients(noDispatch)).toBe(false);
    expect(hasDispatchRecipients({ ...noDispatch, everyone: true })).toBe(true);
    expect(hasDispatchRecipients({ ...noDispatch, units: ['3'] })).toBe(true);
    expect(hasDispatchRecipients({ ...noDispatch, roles: ['r'] })).toBe(true);
  });
});

describe('getNewCallFieldValues', () => {
  it('reports each field as createCall sends it', () => {
    const values = getNewCallFieldValues({
      note: 'n',
      address: 'a',
      latitude: 51.5,
      longitude: 0,
      what3words: 'w.w.w',
      plusCode: 'p',
      contactName: 'Jane',
      contactInfo: '555',
      externalId: 'CAD-9',
      incidentId: 'INC-1',
      referenceId: 'REF-1',
      destinationPoiId: '7',
      dispatchSelection: { ...noDispatch, users: ['u'] },
    });

    expect(values).toEqual({
      [NewCallFieldKeys.Note]: 'n',
      [NewCallFieldKeys.Address]: 'a',
      // A zero coordinate is a real place on the prime meridian.
      [NewCallFieldKeys.Geolocation]: '51.5,0',
      [NewCallFieldKeys.What3Words]: 'w.w.w',
      [NewCallFieldKeys.PlusCode]: 'p',
      [NewCallFieldKeys.ContactName]: 'Jane',
      [NewCallFieldKeys.ContactInfo]: '555',
      [NewCallFieldKeys.ExternalId]: 'CAD-9',
      [NewCallFieldKeys.IncidentId]: 'INC-1',
      [NewCallFieldKeys.ReferenceId]: 'REF-1',
      [NewCallFieldKeys.DestinationPoi]: '7',
      [NewCallFieldKeys.DispatchList]: true,
    });
  });

  it('treats no location and 0,0 as no geolocation', () => {
    expect(getNewCallFieldValues({})[NewCallFieldKeys.Geolocation]).toBe('');
    expect(getNewCallFieldValues({ latitude: 0, longitude: 0 })[NewCallFieldKeys.Geolocation]).toBe('');
  });

  it('reports the scheduled dispatch time as chosen, so a required one left empty reads as missing', () => {
    expect(getNewCallFieldValues({ dispatchOn: '2026-10-09T14:30:00.000Z' })[NewCallFieldKeys.DispatchOn]).toBe('2026-10-09T14:30:00.000Z');
    expect(getNewCallFieldValues({ dispatchOn: '' })[NewCallFieldKeys.DispatchOn]).toBe('');
  });

  it('leaves out the indoor location, protocols and linked call, which have no input', () => {
    const values = getNewCallFieldValues({});

    for (const key of [NewCallFieldKeys.IndoorLocation, NewCallFieldKeys.Protocols, NewCallFieldKeys.LinkedCall]) {
      expect(values).not.toHaveProperty(key);
    }
  });
});

describe('getEditCallFieldValues', () => {
  const stored = {
    Note: 'stored note',
    Address: '12 Main St',
    Latitude: '39.1',
    Longitude: '-119.7',
    What3Words: 'filled.count.soap',
    ContactName: 'Jane',
    ContactInfo: '555',
    ExternalId: 'CAD-9',
    IncidentId: '',
    ReferenceId: 'REF-1',
  };

  it('keeps the stored value where the submitted text is blank', () => {
    const values = getEditCallFieldValues({ note: '  ', address: '', what3words: '', contactName: '', contactInfo: '', externalId: '', incidentId: '', referenceId: '' }, stored);

    expect(values[NewCallFieldKeys.Note]).toBe('stored note');
    expect(values[NewCallFieldKeys.Address]).toBe('12 Main St');
    expect(values[NewCallFieldKeys.What3Words]).toBe('filled.count.soap');
    expect(values[NewCallFieldKeys.ContactName]).toBe('Jane');
    expect(values[NewCallFieldKeys.ContactInfo]).toBe('555');
    expect(values[NewCallFieldKeys.ExternalId]).toBe('CAD-9');
    expect(values[NewCallFieldKeys.IncidentId]).toBe('');
    expect(values[NewCallFieldKeys.ReferenceId]).toBe('REF-1');
    expect(values[NewCallFieldKeys.Geolocation]).toBe('39.1,-119.7');
  });

  it('uses submitted values over stored ones', () => {
    const values = getEditCallFieldValues({ note: 'new note', incidentId: 'INC-2', latitude: 40, longitude: -120 }, stored);

    expect(values[NewCallFieldKeys.Note]).toBe('new note');
    expect(values[NewCallFieldKeys.IncidentId]).toBe('INC-2');
    expect(values[NewCallFieldKeys.Geolocation]).toBe('40,-120');
  });

  it('counts an empty dispatch list as blank, since it would re-dispatch the whole department', () => {
    expect(getEditCallFieldValues({ dispatchSelection: noDispatch }, stored)[NewCallFieldKeys.DispatchList]).toBe(false);
    expect(getEditCallFieldValues({ dispatchSelection: { ...noDispatch, everyone: true } }, stored)[NewCallFieldKeys.DispatchList]).toBe(true);
  });

  it('has no stored location when the call has none', () => {
    expect(getEditCallFieldValues({}, { ...stored, Latitude: '', Longitude: '' })[NewCallFieldKeys.Geolocation]).toBe('');
  });
});

describe('getMissingRequiredCallFields', () => {
  it('drops the indoor location, protocols and the linked call on a new call', () => {
    const policy = policyMissing([NewCallFieldKeys.Note, NewCallFieldKeys.IndoorLocation, NewCallFieldKeys.Protocols, NewCallFieldKeys.LinkedCall, NewCallFieldKeys.DispatchOn]);

    expect(getMissingRequiredCallFields(policy, {}, { unenforced: NEW_CALL_UNENFORCED_KEYS })).toEqual([NewCallFieldKeys.Note, NewCallFieldKeys.DispatchOn]);
  });

  it('drops what an edit never enforces', () => {
    const policy = policyMissing([
      NewCallFieldKeys.DispatchOn,
      NewCallFieldKeys.IndoorLocation,
      NewCallFieldKeys.Protocols,
      NewCallFieldKeys.LinkedCall,
      NewCallFieldKeys.PlusCode,
      NewCallFieldKeys.ExternalId,
      NewCallFieldKeys.DispatchList,
    ]);

    expect(getMissingRequiredCallFields(policy, {}, { unenforced: EDIT_CALL_UNENFORCED_KEYS })).toEqual([NewCallFieldKeys.ExternalId, NewCallFieldKeys.DispatchList]);
  });

  it('does not require recipients or a dispatch time of a pending call', () => {
    const policy = policyMissing([NewCallFieldKeys.DispatchList, NewCallFieldKeys.DispatchOn, NewCallFieldKeys.Address]);

    expect(getMissingRequiredCallFields(policy, {}, { unenforced: new Set(), isPending: true })).toEqual([NewCallFieldKeys.Address]);
  });
});

describe('getMissingRequiredFieldsFromError', () => {
  const axiosError = (status: number, data: unknown) => ({ isAxiosError: true, message: 'failed', response: { status, data } });

  it('reads the keys from the server refusal', () => {
    expect(getMissingRequiredFieldsFromError(axiosError(400, 'Required call fields are missing: contactName, incidentId'))).toEqual(['contactName', 'incidentId']);
    expect(getMissingRequiredFieldsFromError(axiosError(400, { Message: 'Required call fields are missing: note' }))).toEqual(['note']);
  });

  it('ignores every other failure', () => {
    expect(getMissingRequiredFieldsFromError(new Error('Required call fields are missing: note'))).toBeNull();
    expect(getMissingRequiredFieldsFromError(axiosError(500, 'Required call fields are missing: note'))).toBeNull();
    expect(getMissingRequiredFieldsFromError(axiosError(400, 'LinkedCallId is not a call in this department.'))).toBeNull();
    expect(getMissingRequiredFieldsFromError(axiosError(400, 'Required call fields are missing: '))).toBeNull();
    expect(getMissingRequiredFieldsFromError({ isAxiosError: true, message: 'Network Error' })).toBeNull();
  });
});

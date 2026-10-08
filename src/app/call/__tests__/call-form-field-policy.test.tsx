/**
 * The department's new-call field policy on the two call form screens: hidden fields are not shown,
 * required ones are marked, and a save that would leave a required field blank is stopped with a
 * message naming the fields in the dispatcher's language.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCall } from '@/api/calls/calls';
import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

import EditCall from '../[id]/edit';
import NewCall from '../new';

// jest-setup stubs zod globally; these screens validate their forms with it, so use the real one.
jest.mock('zod', () => jest.requireActual('zod'));

jest.mock('@/api/calls/newCallFieldPolicy', () => ({
  getNewCallFieldPolicy: jest.fn(),
}));

jest.mock('@/api/calls/calls', () => ({
  createCall: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockToast = { show: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => mockToast,
}));

const mockTrackEvent = jest.fn();
jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { fields?: string }) => (options?.fields !== undefined ? `${key}|${options.fields}` : key),
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  // A getter: the screens are imported (and this factory run) before mockRouter is initialised.
  get router() {
    return mockRouter;
  },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronDownIcon: () => null,
  SearchIcon: () => null,
}));

jest.mock('@/components/ui/lucide-icons', () => ({
  ChevronDownIcon: () => null,
  PlusIcon: () => null,
  SearchIcon: () => null,
}));

// Stores — selector-style hooks over fixed state, so effects that depend on store values stay stable.
const mockCallsState = {
  callPriorities: [{ Id: 1, Name: 'High' }],
  callTypes: [{ Id: '1', Name: 'Fire' }],
  destinationPois: [],
  poiTypes: [],
  isLoading: false,
  error: null,
  fetchCallFormData: jest.fn(),
};
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: unknown) => unknown) => selector(mockCallsState),
}));

const mockDetailState: Record<string, unknown> = {};
jest.mock('@/stores/calls/detail-store', () => {
  const useCallDetailStore = (selector: (state: unknown) => unknown) => selector(mockDetailState);
  useCallDetailStore.getState = () => mockDetailState;
  return { useCallDetailStore };
});

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: (selector: (state: unknown) => unknown) => selector({ config: { GoogleMapsKey: 'key', W3WKey: 'key' } }),
}));

// Components with native or map dependencies.
jest.mock('@/components/calls/dispatch-selection-modal', () => ({ DispatchSelectionModal: () => null }));
jest.mock('@/components/common/header-back-button', () => ({ HeaderBackButton: () => null }));
jest.mock('@/components/common/loading', () => ({ Loading: () => null }));
jest.mock('@/components/maps/location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/full-screen-location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ isOpen, children }: any) => (isOpen ? children : null),
}));
// The date/time picker is a calendar modal; here it is a text input holding the ISO value it would commit.
jest.mock('@/components/common/date-time-field', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    DateTimeField: ({ testID, value, onChange, clearable = true }: any) => (
      <View>
        <TextInput testID={testID} value={value} onChangeText={onChange} />
        {clearable ? <Text testID={`${testID}-clear`}>dateTimePicker.clear</Text> : null}
      </View>
    ),
  };
});

// UI primitives as plain React Native elements. FormControl hands isRequired to its label the way
// gluestack does, which renders an asterisk after the label text.
jest.mock('@/components/ui/form-control', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const RequiredContext = React.createContext(false);

  return {
    FormControl: ({ children, isRequired }: any) => <RequiredContext.Provider value={!!isRequired}>{<View>{children}</View>}</RequiredContext.Provider>,
    FormControlLabel: ({ children }: any) => {
      const isRequired = React.useContext(RequiredContext);
      return (
        <Text>
          {children}
          {isRequired ? ' *' : null}
        </Text>
      );
    },
    FormControlLabelText: ({ children }: any) => <Text>{children}</Text>,
    FormControlError: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: any) => <View>{children}</View> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text: ({ children }: any) => <Text>{children}</Text> };
});

jest.mock('@/components/ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, testID, disabled, isDisabled }: any) => {
      const resolvedDisabled = !!(disabled ?? isDisabled);
      return (
        <TouchableOpacity onPress={onPress} testID={testID} disabled={resolvedDisabled} accessibilityState={{ disabled: resolvedDisabled }}>
          {children}
        </TouchableOpacity>
      );
    },
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/input', () => {
  const { TextInput, View } = require('react-native');
  return {
    Input: ({ children }: any) => <View>{children}</View>,
    InputField: ({ testID, placeholder, value, onChangeText }: any) => <TextInput testID={testID} placeholder={placeholder} value={value} onChangeText={onChangeText} />,
  };
});

jest.mock('@/components/ui/textarea', () => {
  const { TextInput, View } = require('react-native');
  return {
    Textarea: ({ children }: any) => <View>{children}</View>,
    TextareaInput: ({ testID, placeholder, value, onChangeText }: any) => <TextInput testID={testID} placeholder={placeholder} value={value} onChangeText={onChangeText} />,
  };
});

// A select is a text input here: typing an option's value selects it.
jest.mock('@/components/ui/select', () => {
  const { TextInput, View } = require('react-native');
  return {
    Select: ({ children, selectedValue, onValueChange }: any) => (
      <View>
        <TextInput testID="select-input" value={selectedValue} onChangeText={onValueChange} />
        {children}
      </View>
    ),
    SelectTrigger: () => null,
    SelectInput: () => null,
    SelectIcon: () => null,
    SelectPortal: () => null,
    SelectBackdrop: () => null,
    SelectContent: () => null,
    SelectItem: () => null,
  };
});

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;
const mockedCreateCall = createCall as jest.Mock;
const mockUpdateCall = jest.fn();

type Rule = { Key: string; Visible: boolean; Required: boolean };

const setPolicy = (rules: Rule[]) => mockedGetPolicy.mockResolvedValue({ Rules: rules });

const storedCall = (overrides: Record<string, unknown> = {}) => ({
  CallId: '42',
  Name: 'Structure fire',
  Nature: 'Smoke showing',
  Note: '',
  Address: '12 Main St',
  Geolocation: '39.1,-119.7',
  Latitude: '39.1',
  Longitude: '-119.7',
  What3Words: '',
  ContactName: 'Jane Caller',
  ContactInfo: '555-0100',
  ExternalId: 'CAD-9',
  IncidentId: '',
  ReferenceId: '',
  DestinationPoiId: null,
  Priority: 1,
  Type: 'Fire',
  State: 0,
  ...overrides,
});

const loadCall = (call: Record<string, unknown>, dispatches = [{ Id: 'user-1', Type: 'Personnel', Name: 'A' }]) => {
  Object.assign(mockDetailState, {
    call,
    callExtraData: { Dispatches: dispatches },
    isLoading: false,
    error: null,
    fetchCallDetail: jest.fn(),
    updateCall: mockUpdateCall,
  });
};

/** An ISO 8601 UTC time the given number of minutes from now, as the date/time field produces. */
const isoFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

/** Waits for the policy lookup to finish: the save/create button only enables once it has. */
const waitForPolicy = async (buttonTestId: string) => {
  await waitFor(() => expect(screen.getByTestId(buttonTestId)).not.toBeDisabled());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCall.mockResolvedValue(undefined);
  mockedCreateCall.mockResolvedValue({});
});

describe('edit call screen', () => {
  it('hides the fields the department turned off and marks the required ones', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.ContactInfo, Visible: false, Required: false },
      { Key: NewCallFieldKeys.PlusCode, Visible: false, Required: false },
      { Key: NewCallFieldKeys.Note, Visible: true, Required: true },
      { Key: NewCallFieldKeys.DispatchList, Visible: true, Required: true },
    ]);
    loadCall(storedCall());

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.queryByTestId('contact-info-input')).toBeNull();
    expect(screen.queryByTestId('plus-code-input')).toBeNull();
    // Same location inputs as the new call screen.
    expect(screen.getByTestId('address-input')).toBeTruthy();
    expect(screen.getByTestId('coordinates-input')).toBeTruthy();
    expect(screen.getByTestId('what3words-input')).toBeTruthy();

    expect(screen.getByText('calls.note *')).toBeTruthy();
    expect(screen.getByText('calls.dispatch_to *')).toBeTruthy();
    expect(screen.queryByText('calls.contact_name *')).toBeNull();
  });

  it('blocks the save and names the missing fields, checked against the call as the edit leaves it', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.Note, Visible: true, Required: true },
      // Blank on the form but stored on the call: a blank input keeps the stored value, so it is satisfied.
      { Key: NewCallFieldKeys.ContactName, Visible: true, Required: true },
      // Pre-filled from the call, which has none.
      { Key: NewCallFieldKeys.IncidentId, Visible: true, Required: true },
      // Stored on the call, so the pre-filled input satisfies it.
      { Key: NewCallFieldKeys.ExternalId, Visible: true, Required: true },
      // Never enforced on an edit, or not without a picker this app does not have.
      { Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true },
      { Key: NewCallFieldKeys.Protocols, Visible: true, Required: true },
      { Key: NewCallFieldKeys.LinkedCall, Visible: true, Required: true },
      { Key: NewCallFieldKeys.IndoorLocation, Visible: true, Required: true },
    ]);
    loadCall(storedCall());

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.changeText(screen.getByTestId('contact-name-input'), '');
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.note, calls.incident_id'));
    expect(mockUpdateCall).not.toHaveBeenCalled();
  });

  it('saves once the required fields are filled, and does not change hidden fields', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.Note, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ContactInfo, Visible: false, Required: false },
      { Key: NewCallFieldKeys.Geolocation, Visible: false, Required: false },
    ]);
    loadCall(storedCall());

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.changeText(screen.getByTestId('note-input'), 'Crews on scene');
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));

    const request = mockUpdateCall.mock.calls[0][0];
    expect(request.note).toBe('Crews on scene');
    // Hidden: blank text keeps the stored value, and no coordinates leave the stored location alone.
    expect(request.contactInfo).toBe('');
    expect(request.latitude).toBeUndefined();
    expect(request.longitude).toBeUndefined();
    // Visible and untouched: the stored values go back unchanged.
    expect(request.contactName).toBe('Jane Caller');
    expect(request.dispatchUsers).toEqual(['user-1']);
    expect(mockToast.success).toHaveBeenCalledWith('call_detail.update_call_success');
  });

  it('resends the loaded destination and recipients when the department hides them', async () => {
    // A current server keeps the stored values for a hidden field either way; an older one would clear a
    // missing destination and page the whole department for an empty dispatch list.
    setPolicy([
      { Key: NewCallFieldKeys.DestinationPoi, Visible: false, Required: false },
      { Key: NewCallFieldKeys.DispatchList, Visible: false, Required: false },
    ]);
    loadCall(storedCall({ DestinationPoiId: 7 }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.queryByTestId('dispatch-recipients-button')).toBeNull();
    expect(screen.queryByText('calls.destination_poi')).toBeNull();

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));

    const request = mockUpdateCall.mock.calls[0][0];
    expect(request.destinationPoiId).toBe(7);
    expect(request.dispatchEveryone).toBe(false);
    expect(request.dispatchUsers).toEqual(['user-1']);
  });

  it('pre-fills the call identifiers, sends edits to them, and blanks a hidden one', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.IncidentId, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ReferenceId, Visible: false, Required: false },
    ]);
    loadCall(storedCall({ IncidentId: 'INC-1', ReferenceId: 'REF-1' }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.getByTestId('external-id-input').props.value).toBe('CAD-9');
    expect(screen.getByTestId('incident-id-input').props.value).toBe('INC-1');
    expect(screen.queryByTestId('reference-id-input')).toBeNull();
    expect(screen.getByText('calls.incident_id *')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('incident-id-input'), 'INC-2');
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));

    const request = mockUpdateCall.mock.calls[0][0];
    expect(request.externalId).toBe('CAD-9');
    expect(request.incidentId).toBe('INC-2');
    expect(request.referenceId).toBe('');
  });

  it('keeps the form and what was typed when the save fails', async () => {
    setPolicy([]);
    loadCall(storedCall());
    mockUpdateCall.mockRejectedValue(new Error('offline'));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.changeText(screen.getByTestId('note-input'), 'Typed before the failure');
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('call_detail.update_call_error'));
    expect(screen.getByTestId('note-input').props.value).toBe('Typed before the failure');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('does not require recipients on a pending call', async () => {
    setPolicy([{ Key: NewCallFieldKeys.DispatchList, Visible: true, Required: true }]);
    loadCall(storedCall({ State: 8 }), []);

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.queryByText('calls.dispatch_to *')).toBeNull();

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('requires recipients on an active call', async () => {
    setPolicy([{ Key: NewCallFieldKeys.DispatchList, Visible: true, Required: true }]);
    loadCall(storedCall(), []);

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.dispatch_to'));
    expect(mockUpdateCall).not.toHaveBeenCalled();
  });

  it('names the fields when the server refuses the edit for missing required fields', async () => {
    setPolicy([]);
    loadCall(storedCall());
    mockUpdateCall.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { status: 400, data: 'Required call fields are missing: contactInfo, referenceId' },
    });

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.contact_info, call_detail.reference_id'));
  });
});

describe('new call screen', () => {
  const fillMandatoryFields = () => {
    fireEvent.changeText(screen.getByPlaceholderText('calls.name_placeholder'), 'Structure fire');
    fireEvent.changeText(screen.getByPlaceholderText('calls.nature_placeholder'), 'Smoke showing');
    const [priority, type] = screen.getAllByTestId('select-input');
    fireEvent.changeText(priority, 'High');
    fireEvent.changeText(type, 'Fire');
  };

  it('hides every location field the department turned off and marks the required ones', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.Address, Visible: false, Required: false },
      { Key: NewCallFieldKeys.What3Words, Visible: false, Required: false },
      { Key: NewCallFieldKeys.PlusCode, Visible: false, Required: false },
      { Key: NewCallFieldKeys.DispatchList, Visible: false, Required: false },
      { Key: NewCallFieldKeys.Geolocation, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ContactInfo, Visible: true, Required: true },
    ]);

    render(<NewCall />);
    await waitForPolicy('create-call-button');

    expect(screen.queryByTestId('address-input')).toBeNull();
    expect(screen.queryByTestId('what3words-input')).toBeNull();
    expect(screen.queryByTestId('plus-code-input')).toBeNull();
    expect(screen.queryByTestId('dispatch-recipients-button')).toBeNull();
    expect(screen.getByText('calls.coordinates *')).toBeTruthy();
    expect(screen.getByText('calls.contact_info *')).toBeTruthy();
    expect(screen.queryByText('calls.contact_name *')).toBeNull();
  });

  it('hides the location card once every location field is hidden', async () => {
    setPolicy(
      [NewCallFieldKeys.Address, NewCallFieldKeys.Geolocation, NewCallFieldKeys.What3Words, NewCallFieldKeys.PlusCode, NewCallFieldKeys.DestinationPoi].map((Key) => ({ Key, Visible: false, Required: false }))
    );

    render(<NewCall />);
    await waitForPolicy('create-call-button');

    expect(screen.queryByText('calls.call_location')).toBeNull();
  });

  it('names blank required fields, but not the indoor location, protocols or a linked call it never sends', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.ContactName, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ExternalId, Visible: true, Required: true },
      { Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true },
      { Key: NewCallFieldKeys.IndoorLocation, Visible: true, Required: true },
      { Key: NewCallFieldKeys.Protocols, Visible: true, Required: true },
      { Key: NewCallFieldKeys.LinkedCall, Visible: true, Required: true },
    ]);

    render(<NewCall />);
    await waitForPolicy('create-call-button');

    fillMandatoryFields();
    fireEvent.press(screen.getByTestId('create-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.contact_name, call_detail.external_id, calls.scheduled_dispatch'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('offers the call identifier inputs the policy shows, marks them and sends them', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.ExternalId, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ReferenceId, Visible: false, Required: false },
    ]);

    render(<NewCall />);
    await waitForPolicy('create-call-button');

    expect(screen.getByText('call_detail.external_id *')).toBeTruthy();
    expect(screen.getByTestId('incident-id-input')).toBeTruthy();
    expect(screen.queryByTestId('reference-id-input')).toBeNull();

    fillMandatoryFields();
    fireEvent.changeText(screen.getByTestId('external-id-input'), 'CAD-9');
    fireEvent.changeText(screen.getByTestId('incident-id-input'), 'INC-1');
    fireEvent.press(screen.getByTestId('create-call-button'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));

    const request = mockedCreateCall.mock.calls[0][0];
    expect(request.externalId).toBe('CAD-9');
    expect(request.incidentId).toBe('INC-1');
    expect(request.referenceId).toBe('');
  });

  it('sends the reporter name and contact info it checked', async () => {
    setPolicy([
      { Key: NewCallFieldKeys.ContactName, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ContactInfo, Visible: true, Required: true },
      { Key: NewCallFieldKeys.Protocols, Visible: true, Required: true },
    ]);

    render(<NewCall />);
    await waitForPolicy('create-call-button');

    fillMandatoryFields();
    fireEvent.changeText(screen.getByTestId('contact-name-input'), 'Jane Caller');
    fireEvent.changeText(screen.getByTestId('contact-info-input'), '555-0100');
    fireEvent.press(screen.getByTestId('create-call-button'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));

    const request = mockedCreateCall.mock.calls[0][0];
    expect(request.contactName).toBe('Jane Caller');
    expect(request.contactInfo).toBe('555-0100');
    expect(request).not.toHaveProperty('protocolIds');
    expect(request).not.toHaveProperty('linkedCallId');
    expect(request.dispatchOnUtc).toBeUndefined();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  describe('scheduled dispatch', () => {
    it('marks a required dispatch time and refuses to create the call without one', async () => {
      setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);

      render(<NewCall />);
      await waitForPolicy('create-call-button');

      expect(screen.getByText('calls.scheduled_dispatch *')).toBeTruthy();

      fillMandatoryFields();
      fireEvent.press(screen.getByTestId('create-call-button'));

      await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.required_fields_missing|calls.scheduled_dispatch'));
      expect(mockedCreateCall).not.toHaveBeenCalled();
    });

    it('refuses a time less than 15 minutes ahead', async () => {
      setPolicy([]);

      render(<NewCall />);
      await waitForPolicy('create-call-button');

      fillMandatoryFields();
      fireEvent.changeText(screen.getByTestId('dispatch-on-field'), isoFromNow(10));
      fireEvent.press(screen.getByTestId('create-call-button'));

      await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.scheduled_dispatch_too_soon'));
      expect(mockedCreateCall).not.toHaveBeenCalled();
    });

    it('sends a chosen time as DispatchOnUtc', async () => {
      setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);
      const when = isoFromNow(90);

      render(<NewCall />);
      await waitForPolicy('create-call-button');

      fillMandatoryFields();
      fireEvent.changeText(screen.getByTestId('dispatch-on-field'), when);
      fireEvent.press(screen.getByTestId('create-call-button'));

      await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
      expect(mockedCreateCall.mock.calls[0][0].dispatchOnUtc).toBe(when);
    });

    it('is not shown when the department hides it', async () => {
      setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: false, Required: false }]);

      render(<NewCall />);
      await waitForPolicy('create-call-button');

      expect(screen.queryByTestId('dispatch-on-field')).toBeNull();
    });
  });
});

describe('edit call screen scheduled dispatch', () => {
  // The API reports the stored dispatch time as UTC without a zone designator.
  const storedUtc = (minutes: number) => isoFromNow(minutes).replace('Z', '');

  it('pre-fills a call still waiting for its time, never marks it required, and does not resend it unchanged', async () => {
    setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);
    const stored = storedUtc(120);
    loadCall(storedCall({ DispatchedOnUtc: stored }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.getByTestId('dispatch-on-field').props.value).toBe(`${stored}Z`);
    expect(screen.getByText('calls.scheduled_dispatch')).toBeTruthy();
    expect(screen.queryByText('calls.scheduled_dispatch *')).toBeNull();
    // EditCall cannot remove a stored schedule, so the picker offers no clear and says why.
    expect(screen.queryByTestId('dispatch-on-field-clear')).toBeNull();
    expect(screen.getByText('calls.scheduled_dispatch_no_clear')).toBeTruthy();

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
  });

  it('leaves the field empty for a call that has already gone out, and does not require it', async () => {
    setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);
    loadCall(storedCall({ DispatchedOnUtc: storedUtc(-30) }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.getByTestId('dispatch-on-field').props.value).toBe('');
    // Nothing stored, so a time picked here can still be cleared again.
    expect(screen.getByTestId('dispatch-on-field-clear')).toBeTruthy();
    expect(screen.queryByText('calls.scheduled_dispatch_no_clear')).toBeNull();

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('sends a new time, and refuses one less than 15 minutes ahead', async () => {
    setPolicy([]);
    loadCall(storedCall({ DispatchedOnUtc: storedUtc(120) }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    fireEvent.changeText(screen.getByTestId('dispatch-on-field'), isoFromNow(5));
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('calls.scheduled_dispatch_too_soon'));
    expect(mockUpdateCall).not.toHaveBeenCalled();

    const when = isoFromNow(240);
    fireEvent.changeText(screen.getByTestId('dispatch-on-field'), when);
    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBe(when);
  });

  it('does not send a time when the department hides the field', async () => {
    setPolicy([{ Key: NewCallFieldKeys.DispatchOn, Visible: false, Required: false }]);
    loadCall(storedCall({ DispatchedOnUtc: storedUtc(120) }));

    render(<EditCall />);
    await waitForPolicy('save-call-button');

    expect(screen.queryByTestId('dispatch-on-field')).toBeNull();

    fireEvent.press(screen.getByTestId('save-call-button'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
  });
});

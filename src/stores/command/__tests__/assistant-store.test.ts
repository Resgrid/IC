import { act } from '@testing-library/react-native';
import { type TFunction } from 'i18next';

import en from '@/translations/en.json';

let mockOnline = true;
const mockAskIncidentAssistant = jest.fn();

jest.mock('@/lib/storage', () => ({
  zustandStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/api/chat/chatbot', () => ({
  askIncidentAssistant: (...args: unknown[]) => mockAskIncidentAssistant(...args),
}));

jest.mock('@/stores/offline-queue/store', () => ({
  useOfflineQueueStore: {
    getState: jest.fn(() => ({ isConnected: mockOnline, isNetworkReachable: mockOnline })),
  },
}));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const mockBoard = {
  Command: {
    IncidentCommandId: 'cmd-1',
    DepartmentId: 1,
    CallId: 42,
    EstablishedByUserId: 'user-1',
    EstablishedOn: minutesAgo(15),
    CurrentCommanderUserId: 'user-1',
    IcsLevel: 1,
    Status: 0,
  },
  Nodes: [],
  Assignments: [],
  Objectives: [],
  Needs: [],
  Timers: [],
  Annotations: [],
  Accountability: [{ UserId: 'user-2', FullName: 'Dana Cross', NeedsCheckIn: true, MinutesRemaining: -4, Status: 'Critical', DurationMinutes: 20, WarningThresholdMinutes: 5 }],
  Roles: [],
  Notes: [],
};

jest.mock('@/stores/command/store', () => ({
  useCommandStore: {
    getState: jest.fn(() => ({ boards: { '42': { callId: '42', board: mockBoard, adHocUnits: [], adHocPersonnel: [], isProvisional: false, lastRefreshed: null, timeline: [] } } })),
  },
}));

jest.mock('@/stores/calls/store', () => ({
  useCallsStore: {
    getState: jest.fn(() => ({ calls: [{ CallId: '42', Name: 'Structure fire', Number: '26-1', Address: '123 Main St', Type: 'Structure Fire', Nature: 'Smoke showing' }] })),
  },
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: { getState: jest.fn(() => ({ activeCall: null })) },
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: { getState: jest.fn(() => ({ users: [{ UserId: 'user-1', FirstName: 'Alex', LastName: 'Reed' }] })) },
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: { getState: jest.fn(() => ({ units: [] })) },
}));

// eslint-disable-next-line import/first
import { useIncidentAssistantStore } from '../assistant-store';

const t = ((key: string, options?: Record<string, unknown>): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), en);
  if (typeof value !== 'string') {
    return key;
  }
  return value.replace(/{{(\w+)}}/g, (_match, name: string) => String(options?.[name] ?? ''));
}) as unknown as TFunction;

const messages = () => useIncidentAssistantStore.getState().messagesByCallId['42'] ?? [];

describe('incident assistant store', () => {
  beforeEach(() => {
    mockOnline = true;
    mockAskIncidentAssistant.mockReset();
    useIncidentAssistantStore.setState({ messagesByCallId: {}, askingCallId: null });
  });

  it('answers a recognized question on-device and never calls the server', async () => {
    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'PAR', t);
    });

    const conversation = messages();
    expect(conversation).toHaveLength(2);
    expect(conversation[0]).toMatchObject({ role: 'user', text: 'PAR' });
    expect(conversation[1]).toMatchObject({ role: 'assistant', source: 'device' });
    expect(conversation[1].text).toContain('Dana Cross');
    expect(mockAskIncidentAssistant).not.toHaveBeenCalled();
  });

  it('sends a free-form question to the server with the incident scoped to the open board', async () => {
    mockAskIncidentAssistant.mockResolvedValue({ Answer: 'Winds are out of the northwest at 12 mph.', Processed: true });

    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'should I move staging because of the wind shift?', t);
    });

    expect(mockAskIncidentAssistant).toHaveBeenCalledWith(42, 'should I move staging because of the wind shift?');
    expect(messages()[1]).toMatchObject({ source: 'server', text: 'Winds are out of the northwest at 12 mph.' });
  });

  it('answers from the device instead of failing when the server call throws', async () => {
    mockAskIncidentAssistant.mockRejectedValue(new Error('network down'));

    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'can you get me an accountability rundown', t);
    });

    expect(messages()[1]).toMatchObject({ source: 'device' });
    expect(messages()[1].text).toContain('Dana Cross');
  });

  it('says plainly what it cannot answer offline rather than pretending', async () => {
    mockOnline = false;

    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'what is the wind doing', t);
    });

    expect(mockAskIncidentAssistant).not.toHaveBeenCalled();
    expect(messages()[1]).toMatchObject({ isError: true });
    expect(messages()[1].text).toContain("can't answer that without a connection");
  });

  it('still answers board questions offline', async () => {
    mockOnline = false;

    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'incident status', t);
    });

    expect(mockAskIncidentAssistant).not.toHaveBeenCalled();
    expect(messages()[1]).toMatchObject({ source: 'device' });
    expect(messages()[1].text).toContain('Command running 15m');
  });

  it('keeps a separate conversation per incident and clears only the one asked for', async () => {
    await act(async () => {
      await useIncidentAssistantStore.getState().ask('42', 'PAR', t);
    });

    expect(messages()).toHaveLength(2);

    act(() => useIncidentAssistantStore.getState().clear('42'));
    expect(messages()).toHaveLength(0);
  });

  it('suggests the questions matching the incident type inferred from the call', () => {
    const suggestions = useIncidentAssistantStore.getState().suggestions('42');

    // The call is a structure fire, so the RIT prompt is offered.
    expect(suggestions.map((s) => s.question)).toContain('Do I have a RIT?');
  });
});

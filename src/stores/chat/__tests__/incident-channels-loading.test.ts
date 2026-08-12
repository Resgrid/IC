/**
 * incidentChannelsByCallId holds undefined both before the fetch lands and for an incident that
 * genuinely has no channels, so callers (the command board's chat actions) need a separate in-flight
 * marker to avoid telling the user chat is unavailable while it is still loading.
 */
const mockGetChannels = jest.fn();

jest.mock('@/services/signalr.service', () => ({
  signalRService: { invoke: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/env', () => ({
  Env: { CHAT_HUB_NAME: 'chatHub' },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() },
}));

jest.mock('@/lib/i18n/utils', () => ({ translate: (key: string) => key }));

jest.mock('@/lib/storage', () => ({ zustandStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));

jest.mock('@/api/chat/chat', () => ({
  getChannels: (...args: unknown[]) => mockGetChannels(...args),
  getMessages: jest.fn().mockResolvedValue({ Data: [] }),
  getMembers: jest.fn().mockResolvedValue({ Data: [] }),
  getMyPendingAcks: jest.fn().mockResolvedValue({ Data: [] }),
  markRead: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/chat/chatbot', () => ({
  getChatbotChannel: jest.fn(),
  sendChatbotMessage: jest.fn(),
  newChatbotSession: jest.fn(),
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => ({ userId: 'user-1', profile: { name: 'Test User' } }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: jest.fn() }) },
}));

// Loaded lazily so the mock factories above run after their `mock*` consts exist.
type ChatStoreApi = typeof import('../store').useChatStore;
let useChatStore: ChatStoreApi;

beforeAll(() => {
  useChatStore = require('../store').useChatStore as ChatStoreApi;
});

describe('loadIncidentChannels loading marker', () => {
  beforeEach(() => {
    mockGetChannels.mockReset();
    useChatStore.setState({ incidentChannelsByCallId: {}, incidentChannelsLoadingByCallId: {} });
  });

  it('marks the incident as loading until the request resolves', async () => {
    let resolveChannels: (value: { Data: unknown[] }) => void = () => undefined;
    mockGetChannels.mockReturnValue(
      new Promise((resolve) => {
        resolveChannels = resolve as (value: { Data: unknown[] }) => void;
      })
    );

    const pending = useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsLoadingByCallId['42']).toBe(true);
    // The map is still empty mid-flight — the marker is the only way to tell that apart from "none".
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toBeUndefined();

    resolveChannels({ Data: [{ ChatChannelId: 'c-1', CallId: 42 }] });
    await pending;

    expect(useChatStore.getState().incidentChannelsLoadingByCallId['42']).toBe(false);
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toHaveLength(1);
  });

  it('records an empty result as loaded so callers can report chat unavailable', async () => {
    mockGetChannels.mockResolvedValue({ Data: [{ ChatChannelId: 'c-9', CallId: 99 }] });

    await useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsLoadingByCallId['42']).toBe(false);
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toEqual([]);
  });

  it('clears the loading marker when the request fails', async () => {
    mockGetChannels.mockRejectedValue(new Error('network down'));

    await useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsLoadingByCallId['42']).toBe(false);
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toBeUndefined();
  });

  it('does not mark loading for an unparseable call id', async () => {
    await useChatStore.getState().loadIncidentChannels('not-a-number');

    expect(mockGetChannels).not.toHaveBeenCalled();
    expect(useChatStore.getState().incidentChannelsLoadingByCallId['not-a-number']).toBeUndefined();
  });
});
